import React from 'react';

// Provider icons as SVG components
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const MicrosoftIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 23 23">
    <path fill="#f35325" d="M0 0h11v11H0z"/>
    <path fill="#81bc06" d="M12 0h11v11H12z"/>
    <path fill="#05a6f0" d="M0 12h11v11H0z"/>
    <path fill="#ffba08" d="M12 12h11v11H12z"/>
  </svg>
);

const GitHubIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

const SynologyIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 32 32" fill="white">
    <path d="M16 2.667L4 8.667v10.666l12 6 12-6V8.667L16 2.667zm0 2.18l7.82 3.82L16 12.487l-7.82-3.82L16 4.847zM6 10.487l8 4v9.846l-8-4v-9.846zm20 0v9.846l-8 4v-9.846l8-4z"/>
  </svg>
);

const AuthentikIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 256 256" fill="white">
    <path d="M128 0C57.308 0 0 57.308 0 128s57.308 128 128 128 128-57.308 128-128S198.692 0 128 0zm0 234.667C68.776 234.667 21.333 187.224 21.333 128S68.776 21.333 128 21.333 234.667 68.776 234.667 128 187.224 234.667 128 234.667z"/>
    <path d="M128 64L64 128l64 64 64-64-64-64zm0 96l-32-32 32-32 32 32-32 32z"/>
  </svg>
);

const GenericOIDCIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
  </svg>
);

const providerIcons = {
  google: GoogleIcon,
  microsoft: MicrosoftIcon,
  github: GitHubIcon,
  synology: SynologyIcon,
  authentik: AuthentikIcon,
  generic_oidc: GenericOIDCIcon,
};

const providerColors = {
  google: 'bg-white hover:bg-gray-100 text-gray-800 border border-gray-300',
  microsoft: 'bg-[#2F2F2F] hover:bg-[#1F1F1F] text-white',
  github: 'bg-[#24292e] hover:bg-[#1a1e22] text-white',
  synology: 'bg-[#FF8C00] hover:bg-[#E67E00] text-white',
  authentik: 'bg-[#FD4B2D] hover:bg-[#E63E1F] text-white',
  generic_oidc: 'bg-blue-600 hover:bg-blue-700 text-white',
};

export default function SSOButton({ provider, displayName, onClick }) {
  const Icon = providerIcons[provider] || GenericOIDCIcon;
  const colorClass = providerColors[provider] || providerColors.generic_oidc;

  const handleClick = () => {
    // Redirect to SSO login endpoint
    window.location.href = `/api/sso/${provider}/login`;
  };

  return (
    <button
      onClick={onClick || handleClick}
      className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${colorClass}`}
    >
      <Icon />
      <span>{displayName}</span>
    </button>
  );
}
