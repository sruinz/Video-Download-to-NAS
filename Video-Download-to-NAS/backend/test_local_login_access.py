"""접속 주소별 관리자 백업 로그인과 비밀번호 인증 우회 방지를 검증한다."""

from unittest.mock import AsyncMock, patch
from urllib.parse import urlsplit

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

with patch("os.makedirs"):
    from app.auth import get_password_hash
    from app.database import Base, SystemSetting, User, get_db
    from app.telegram.encryption import TokenEncryption

    with patch.object(TokenEncryption, "_load_or_generate_key", return_value=Fernet.generate_key()):
        from app.main import app, limiter


@pytest.fixture
def login_context():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    password_hash = get_password_hash("test-password")
    db.add_all([
        User(username="recovery-admin", hashed_password=password_hash, role="super_admin", is_active=1),
        User(username="regular-user", hashed_password=password_hash, role="user", is_active=1),
        SystemSetting(key="local_login_enabled", value="false"),
    ])
    db.commit()
    app.dependency_overrides[get_db] = lambda: db
    limiter.reset()

    async def local_client(scope, receive, send):
        scope = dict(scope, client=("192.168.0.20", 50000))
        await app(scope, receive, send)

    try:
        with patch("app.main.download_video", new=AsyncMock()):
            yield TestClient(local_client), db
    finally:
        app.dependency_overrides.clear()
        db.close()
        engine.dispose()


@pytest.mark.parametrize("base_url,headers,allowed", [
    ("http://192.168.0.11:3000", {}, True),
    ("http://10.0.0.1", {}, True),
    ("http://172.16.0.1", {}, True),
    ("http://172.31.255.254", {}, True),
    ("http://127.0.0.1", {}, True),
    ("http://169.254.1.2", {}, True),
    ("http://[::1]:3000", {}, True),
    ("http://[fd12::1]", {}, True),
    ("http://[fe80::1]", {}, True),
    ("http://[::ffff:192.168.1.2]", {}, True),
    ("http://192.168.0.11", {"X-Forwarded-For": "192.168.0.20"}, True),
    ("https://video.example.com", {}, False),
    ("http://video.example.com", {}, False),
    ("http://nas.local", {}, False),
    ("https://192.168.0.11", {}, False),
    ("http://8.8.8.8", {}, False),
    ("http://100.64.0.1", {}, False),
    ("http://172.32.0.1", {}, False),
    ("http://192.0.2.1", {}, False),
    ("http://0.0.0.0", {}, False),
    ("http://[::]", {}, False),
    ("http://[2001:db8::1]", {}, False),
    ("http://192.168.0.11", {"X-Forwarded-Proto": "https"}, False),
    ("http://192.168.0.11", {"X-Forwarded-Proto": "http"}, False),
    ("http://192.168.0.11", {"X-Forwarded-Host": "video.example.com"}, False),
    ("http://192.168.0.11", {"Forwarded": "host=video.example.com;proto=https"}, False),
    ("http://192.168.0.11", {"X-Forwarded-For": "8.8.8.8"}, False),
    ("http://192.168.0.11", {"X-Forwarded-For": "192.168.0.20, 172.18.0.1"}, False),
    ("http://192.168.0.11", {"X-VDTN-External-Proxy": "1"}, False),
    ("http://192.168.0.11", {"Host": "192.168.0.11@example.com"}, False),
    ("http://192.168.0.11", {"Host": "192.168.0.11/path"}, False),
])
def test_public_settings_and_login_agree_on_recovery_access(login_context, base_url, headers, allowed):
    client, _db = login_context
    # Starlette 0.35의 테스트 전송기가 IPv6 URL을 파싱하지 못하므로 Host로 전달한다.
    if "[" in base_url:
        headers = {**headers, "Host": urlsplit(base_url).netloc}
        base_url = "http://testserver"
    settings = client.get(base_url + "/api/settings/public", headers=headers)
    assert settings.status_code == 200
    assert settings.json()["local_login_enabled"] is False
    assert settings.json().get("admin_local_login_allowed") is allowed
    assert settings.headers.get("cache-control") == "no-store"
    response = client.post(base_url + "/api/login", headers=headers,
                           json={"id": "recovery-admin", "pw": "test-password"})
    assert response.status_code == (200 if allowed else 403)
    assert ("access_token" in response.json()) is allowed


@pytest.mark.parametrize("path", ["/api/login", "/rest"])
@pytest.mark.parametrize("username,base_url,enabled,expected", [
    ("recovery-admin", "http://192.168.0.11", False, 200),
    ("regular-user", "http://192.168.0.11", False, 403),
    ("recovery-admin", "https://video.example.com", False, 403),
    ("regular-user", "https://video.example.com", False, 403),
    ("regular-user", "https://video.example.com", True, 200),
])
def test_password_entry_points_apply_same_policy(login_context, path, username, base_url, enabled, expected):
    client, db = login_context
    db.query(SystemSetting).filter_by(key="local_login_enabled").first().value = str(enabled).lower()
    db.commit()
    response = client.post(base_url + path, json={
        "id": username, "pw": "test-password", "url": "https://example.com/video", "resolution": "best",
    })
    assert response.status_code == expected


def test_external_request_is_blocked_before_password_validation(login_context):
    client, _db = login_context
    response = client.post("https://video.example.com/api/login", json={"id": "unknown", "pw": "wrong"})
    assert response.status_code == 403


def test_internal_recovery_still_checks_password(login_context):
    client, _db = login_context
    response = client.post("http://192.168.0.11/api/login", json={"id": "recovery-admin", "pw": "wrong"})
    assert response.status_code == 401


@pytest.mark.parametrize("placement", ["header", "body"])
def test_external_rest_keeps_api_token_authentication(login_context, placement):
    from app.database import APIToken
    from app.token_utils import hash_token

    client, db = login_context
    user = db.query(User).filter_by(username="regular-user").one()
    token = "vdtn_test_api_token_for_local_login_policy"
    db.add(APIToken(user_id=user.id, name="test", token_hash=hash_token(token), token_prefix="vdtn_test"))
    db.commit()
    payload = {"url": "https://example.com/video", "resolution": "best"}
    headers = {}
    if placement == "header":
        headers["Authorization"] = "Bearer " + token
    else:
        payload["token"] = token
    response = client.post("https://video.example.com/rest", json=payload, headers=headers)
    assert response.status_code == 200


@pytest.mark.parametrize("headers,peer,allowed", [
    ([(b"host", b"192.168.1.2"), (b"host", b"video.example.com")], "192.168.1.3", False),
    ([(b"host", b"192.168.1.2:bad")], "192.168.1.3", False),
    ([(b"host", b"[not-an-ip]")], "192.168.1.3", False),
    ([(b"host", b"192.168.1.2")], "8.8.8.8", False),
    ([(b"host", b"192.168.1.2")], "192.168.1.3", True),
    ([(b"host", b"192.168.1.2"), (b"x-forwarded-for", b"192.168.1.3"),
      (b"x-forwarded-for", b"192.168.1.4")], "192.168.1.3", False),
    ([(b"host", b"192.168.1.2"), (b"x-forwarded-proto", b""),
      (b"x-forwarded-proto", b"https")], "192.168.1.3", False),
    ([(b"host", b"192.168.1.2"), (b"x-real-ip", b"8.8.8.8")], "192.168.1.3", False),
    ([], "192.168.1.3", False),
])
def test_invalid_or_external_connection_cannot_spoof_local_host(headers, peer, allowed):
    from starlette.requests import Request
    from app.local_login import admin_local_login_allowed

    request = Request({"type": "http", "scheme": "http", "headers": headers, "client": (peer, 5000)})
    assert admin_local_login_allowed(request) is allowed
