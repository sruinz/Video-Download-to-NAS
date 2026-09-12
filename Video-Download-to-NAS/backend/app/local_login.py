"""NASCertPilot처럼 내부 HTTP 주소에서만 관리자 복구 로그인을 허용한다."""

from ipaddress import ip_address, ip_network
from urllib.parse import urlsplit

from fastapi import HTTPException, Request


LOCAL_NETWORKS = tuple(ip_network(network) for network in (
    "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.0/8",
    "169.254.0.0/16", "::1/128", "fc00::/7", "fe80::/10",
))


def is_local_address(host: str) -> bool:
    try:
        address = ip_address(host)
    except ValueError:
        return False
    if address.version == 6 and address.ipv4_mapped:
        address = address.ipv4_mapped
    return any(address in network for network in LOCAL_NETWORKS)


def admin_local_login_allowed(request: Request) -> bool:
    # 프록시가 전달한 주소를 내부 접속의 근거로 신뢰하지 않는다.
    if request.scope.get("scheme") != "http":
        return False
    if any(value.strip() for name in (
        "forwarded", "x-forwarded-proto", "x-forwarded-host",
    ) for value in request.headers.getlist(name)):
        return False
    if any(value != "0" for value in request.headers.getlist("x-vdtn-external-proxy")):
        return False

    hosts = request.headers.getlist("host")
    if len(hosts) != 1 or any(char in hosts[0] for char in "/\\?#@ \t\r\n"):
        return False
    try:
        host = urlsplit("//" + hosts[0])
        host.port  # 잘못된 포트도 거부한다.
        if not host.hostname or not is_local_address(host.hostname):
            return False
    except ValueError:
        return False

    if not request.client or not is_local_address(request.client.host):
        return False
    # 내장 Nginx가 추가하는 단일 내부 클라이언트 주소만 허용한다.
    forwarded_for = request.headers.getlist("x-forwarded-for")
    if forwarded_for and (len(forwarded_for) != 1 or not is_local_address(forwarded_for[0].strip())):
        return False
    real_ips = request.headers.getlist("x-real-ip")
    if real_ips and (len(real_ips) != 1 or not is_local_address(real_ips[0].strip())):
        return False
    return True


def enforce_local_login_access(request: Request, local_login_enabled: bool) -> None:
    if not local_login_enabled and not admin_local_login_allowed(request):
        raise HTTPException(
            status_code=403,
            detail="Local login is disabled. Admin recovery requires a direct internal HTTP address.",
        )


def enforce_local_login_role(user, local_login_enabled: bool) -> None:
    if not local_login_enabled and user.role != "super_admin":
        raise HTTPException(
            status_code=403,
            detail="Local login is disabled. Only super admin can login locally.",
        )
