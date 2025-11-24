"""SSO authentication providers module"""

from .oauth_provider import OAuth2Provider
from .google_provider import GoogleProvider
from .microsoft_provider import MicrosoftProvider
from .github_provider import GitHubProvider
from .synology_provider import SynologyProvider
from .authentik_provider import AuthentikProvider
from .generic_oidc_provider import GenericOIDCProvider
from .security import (
    encrypt_client_secret,
    decrypt_client_secret,
    generate_state,
    verify_state,
    cleanup_expired_states,
)
from .scheduler import start_scheduler, stop_scheduler

__all__ = [
    "OAuth2Provider",
    "GoogleProvider",
    "MicrosoftProvider",
    "GitHubProvider",
    "SynologyProvider",
    "AuthentikProvider",
    "GenericOIDCProvider",
    "encrypt_client_secret",
    "decrypt_client_secret",
    "generate_state",
    "verify_state",
    "cleanup_expired_states",
    "start_scheduler",
    "stop_scheduler",
]
