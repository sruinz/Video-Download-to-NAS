import math
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass

from fastapi import HTTPException

from .settings_helper import get_setting


ROLE_RATE_LIMIT_DEFAULTS = {
    "super_admin": 0,
    "admin": 120,
    "user": 60,
    "guest": 30,
}
SAFE_USER_RATE_LIMIT = 60


@dataclass(frozen=True)
class RateLimitDecision:
    allowed: bool
    limit: int
    remaining: int
    reset_at: int
    retry_after: int


class DownloadRateLimiter:
    """인증된 사용자별 최근 요청 시각을 보관하는 이동 창 제한기."""

    def __init__(self, window_seconds=60):
        self.window_seconds = window_seconds
        self._requests = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, user_id, limit, now=None):
        if limit <= 0:
            return RateLimitDecision(
                allowed=True,
                limit=0,
                remaining=-1,
                reset_at=0,
                retry_after=0,
            )

        current_time = time.time() if now is None else now
        cutoff = current_time - self.window_seconds

        with self._lock:
            requests = self._requests[user_id]
            while requests and requests[0] <= cutoff:
                requests.popleft()

            if len(requests) >= limit:
                reset_time = (
                    requests[len(requests) - limit] + self.window_seconds
                )
                reset_at = math.ceil(reset_time)
                return RateLimitDecision(
                    allowed=False,
                    limit=limit,
                    remaining=0,
                    reset_at=reset_at,
                    retry_after=max(1, math.ceil(reset_time - current_time)),
                )

            requests.append(current_time)
            reset_at = math.ceil(requests[0] + self.window_seconds)
            return RateLimitDecision(
                allowed=True,
                limit=limit,
                remaining=limit - len(requests),
                reset_at=reset_at,
                retry_after=0,
            )


def _rate_limit_headers(decision):
    headers = {
        "X-RateLimit-Limit": str(decision.limit),
        "X-RateLimit-Remaining": str(decision.remaining),
        "X-RateLimit-Reset": str(decision.reset_at),
    }
    if not decision.allowed:
        headers["Retry-After"] = str(decision.retry_after)
    return headers


def enforce_download_rate_limit(response, db, user, limiter):
    """다운로드 제한을 검사하고 성공 또는 429 응답 헤더를 설정한다."""
    limit = resolve_download_rate_limit(db, user)
    decision = limiter.check(user.id, limit)
    headers = _rate_limit_headers(decision)

    if not decision.allowed:
        raise HTTPException(
            status_code=429,
            detail="Download request rate limit exceeded",
            headers=headers,
        )

    for name, value in headers.items():
        response.headers[name] = value
    return decision


def _non_negative_int(value, fallback):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return fallback
    return parsed if parsed >= 0 else fallback


def resolve_download_rate_limit(db, user):
    """사용자별 값이 있으면 우선하고, 없으면 역할별 다운로드 제한을 반환한다."""
    custom_limit = getattr(user, "custom_rate_limit", None)
    if custom_limit is not None:
        return _non_negative_int(custom_limit, SAFE_USER_RATE_LIMIT)

    role = getattr(user, "role", "user")
    if role not in ROLE_RATE_LIMIT_DEFAULTS:
        return SAFE_USER_RATE_LIMIT

    default_limit = ROLE_RATE_LIMIT_DEFAULTS[role]
    configured_limit = get_setting(
        db,
        f"rate_limit_{role}",
        str(default_limit),
    )
    return _non_negative_int(configured_limit, SAFE_USER_RATE_LIMIT)
