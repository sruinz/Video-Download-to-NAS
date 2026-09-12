# Administrator Recovery Login Access (1.1.8-2)

**English** | [한국어](LOCAL_LOGIN_RECOVERY.ko.md)

When local login is disabled, administrator recovery follows NASCertPilot's direct internal HTTP access policy. The server evaluates each request, and the login screen and password authentication APIs enforce the same policy.

| Access method | Administrator recovery login |
| --- | --- |
| Direct internal IP over HTTP, such as `http://192.168.0.11:3000` | Super administrator only |
| Direct internal IPv6, loopback, or link-local IP over HTTP | Super administrator only |
| Reverse proxy, external domain, or public IP | Hidden and blocked with HTTP 403 |
| HTTPS or a hostname such as `nas.local` | Hidden and blocked with HTTP 403 |
| Local login enabled | Existing password login behavior retained |

Allowed IPv4 ranges are `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, and `169.254.0.0/16`. IPv6 ranges are `::1`, `fc00::/7`, and `fe80::/10`. The connecting peer must also have an internal IP address. DNS resolution is not used to classify hostnames as internal.

## Scope

- `/api/settings/public` returns a request-specific `admin_local_login_allowed` value and disables response caching.
- The login screen shows a password form or administrator button only after verifying the server settings. Neither is shown if the settings request fails.
- Internal access retains the recovery button even if the SSO provider request fails.
- The same restriction applies to username/password authentication through `/api/login` and `/rest`. External requests are rejected before password verification.
- API token authentication through `/rest` and SSO login remain available.

## Reverse Proxy Configuration

Update the backend and frontend together. The bundled Nginx preserves evidence of an upstream proxy from `Forwarded`, `X-Forwarded-*`, and `X-Real-IP` headers and distinguishes it from its own forwarding.

The external proxy must preserve the original Host and set `X-Forwarded-Proto`. For example, use the following in the relevant Nginx proxy location:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

If an external proxy rewrites Host to an internal IP and strips every forwarding header, the application cannot distinguish it from direct internal access. This restriction does not replace a firewall; the backend port should not be exposed directly to the internet.

## Verification

The new regression tests use an isolated in-memory database. Run the following from the server directory:

```bash
cd backend
python -m pytest test_local_login_access.py test_server_release.py -q
cd ../frontend
npm run build
```

The existing `test_sso_auth_logic.py` test now checks effective permissions, including role inheritance, instead of the stored permission value.
