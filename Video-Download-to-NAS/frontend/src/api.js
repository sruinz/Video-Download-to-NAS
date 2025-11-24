import axios from 'axios';

// Get API URL from runtime config or environment variable
const getApiUrl = () => {
  // Priority: runtime config > environment variable > empty (same origin)
  if (window.APP_CONFIG && window.APP_CONFIG.API_URL) {
    return window.APP_CONFIG.API_URL;
  }
  return import.meta.env.VITE_API_URL || '';
};

const API_URL = getApiUrl();

// Helper function to get token
const getToken = () => {
  return localStorage.getItem('token');
};

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const login = async (id, pw) => {
  const response = await api.post('/api/login', { id, pw });
  return response.data;
};

export const register = async (username, email, password) => {
  const response = await api.post('/api/users/register', { username, email, password });
  return response.data;
};

// Downloads
export const startDownload = async (url, resolution = 'best') => {
  const response = await api.post('/api/download', { url, resolution });
  return response.data;
};

export const getDownloadStatus = async (downloadId) => {
  const response = await api.get(`/api/download/status/${downloadId}`);
  return response.data;
};

// Library
export const getLibrary = async () => {
  const response = await api.get('/api/library');
  return response.data;
};

export const searchLibrary = async (filters) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      params.append(key, value);
    }
  });
  const response = await api.get(`/api/library/search?${params.toString()}`);
  return response.data;
};

export const deleteFile = async (fileId) => {
  const response = await api.delete(`/api/file/${fileId}`);
  return response.data;
};

export const getFileUrl = (fileId) => {
  return `${API_URL}/api/file/${fileId}`;
};

// Sharing
export const createShareLink = async (fileId, expiresInHours = 24, password = null) => {
  const response = await api.post('/api/share', { 
    file_id: fileId, 
    expires_in_hours: expiresInHours,
    password 
  });
  return response.data;
};

export const deleteShareLink = async (token) => {
  const response = await api.delete(`/api/share/${token}`);
  return response.data;
};

// Users
export const getCurrentUser = async () => {
  const response = await api.get('/api/users/me');
  return response.data;
};

export const updateCurrentUser = async (data) => {
  const response = await api.put('/api/users/me', data);
  return response.data;
};

export const listUsers = async () => {
  const response = await api.get('/api/users/');
  return response.data;
};

export const updateUserRole = async (userId, role) => {
  const response = await api.put(`/api/users/${userId}/role`, { role });
  return response.data;
};

export const updateUserQuota = async (userId, storage_quota_gb) => {
  const response = await api.put(`/api/users/${userId}/quota`, { storage_quota_gb });
  return response.data;
};

export const updateUserRateLimit = async (userId, custom_rate_limit) => {
  const response = await api.put(`/api/users/${userId}/rate-limit`, { custom_rate_limit });
  return response.data;
};

export const deleteUser = async (userId) => {
  const response = await api.delete(`/api/users/${userId}`);
  return response.data;
};

// Settings
export const getPublicSettings = async () => {
  const response = await fetch('/api/settings/public');
  if (!response.ok) {
    throw new Error('Failed to get public settings');
  }
  return response.json();
};

export const getSettings = async () => {
  const response = await api.get('/api/settings/');
  return response.data;
};

export const updateSettings = async (settings) => {
  const response = await api.put('/api/settings/', settings);
  return response.data;
};

export const getSystemStats = async () => {
  const response = await api.get('/api/settings/stats');
  return response.data;
};

// === User Management (Admin) ===
export const getAllUsers = async () => {
  const response = await fetch('/api/users/admin/users', {
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to get users');
  }
  
  return response.json();
};

// === User Approval Management ===
export const getPendingUsers = async () => {
  const response = await fetch('/api/users/pending', {
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to get pending users');
  }
  
  return response.json();
};

export const getPendingUsersCount = async () => {
  const response = await fetch('/api/users/pending/count', {
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to get pending users count');
  }
  
  const data = await response.json();
  return data.count;
};

export const approveUser = async (userId) => {
  const response = await fetch(`/api/users/${userId}/approve`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to approve user');
  }
  
  return response.json();
};

export const rejectUser = async (userId) => {
  const response = await fetch(`/api/users/${userId}/reject`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to reject user');
  }
  
  return response.json();
};

export const createUser = async (userData) => {
  const response = await fetch('/api/users/admin/users', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(userData)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create user');
  }
  
  return response.json();
};

export const updateUserPermissions = async (userId, permissions) => {
  const response = await fetch(`/api/users/admin/users/${userId}/permissions`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(permissions)
  });
  
  if (!response.ok) {
    throw new Error('Failed to update permissions');
  }
  
  return response.json();
};

export const adminChangePassword = async (userId, newPassword) => {
  const response = await fetch(`/api/users/admin/users/${userId}/password`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ new_password: newPassword })
  });
  
  if (!response.ok) {
    throw new Error('Failed to change password');
  }
  
  return response.json();
};

export const adminUpdateUser = async (userId, data) => {
  const response = await fetch(`/api/users/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw error;
  }
  
  return response.json();
};

// === Public Board ===
export const getPublicFiles = async (page = 1, limit = 20, search = '') => {
  const params = new URLSearchParams({ page, limit });
  if (search) params.append('search', search);
  
  const response = await fetch(`/api/public-board/files?${params}`, {
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to get public files');
  }
  
  return response.json();
};

export const publishFileToBoard = async (fileId, title, description) => {
  const response = await fetch(`/api/public-board/files/${fileId}/publish`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title, description })
  });
  
  if (!response.ok) {
    throw new Error('Failed to publish file');
  }
  
  return response.json();
};

export const unpublishFileFromBoard = async (fileId) => {
  const response = await fetch(`/api/public-board/files/${fileId}/unpublish`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to unpublish file');
  }
  
  return response.json();
};

export default api;


// === Advanced Share Links Management ===
export const createAdvancedShareLink = async (data) => {
  const response = await fetch('/api/share-links/create', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create share link');
  }
  
  return response.json();
};

export const getMyAdvancedShareLinks = async () => {
  const response = await fetch('/api/share-links/my-links', {
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to get share links');
  }
  
  return response.json();
};

export const toggleAdvancedShareLink = async (linkId) => {
  const response = await fetch(`/api/share-links/${linkId}/toggle`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to toggle share link');
  }
  
  return response.json();
};

export const deleteAdvancedShareLink = async (linkId) => {
  const response = await fetch(`/api/share-links/${linkId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to delete share link');
  }
  
  return response.json();
};

export const accessAdvancedShareLink = async (token, password = null) => {
  const params = new URLSearchParams();
  if (password) params.append('password', password);
  
  const authToken = getToken();
  const headers = {
    'Content-Type': 'application/json'
  };
  
  // Only add Authorization header if token exists
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  const response = await fetch(`/api/share-links/access/${token}?${params}`, {
    headers
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to access share link');
  }
  
  return response.json();
};

// === Library Sync ===
export const syncLibrary = async (userId = null) => {
  const params = userId ? `?user_id=${userId}` : '';
  const response = await fetch(`/api/admin/sync-library${params}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to sync library');
  }
  
  return response.json();
};

export const getAdvancedShareLinkStats = async () => {
  const response = await fetch('/api/share-links/stats', {
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to get share link stats');
  }
  
  return response.json();
};

// === SSO ===
export const getEnabledSSOProviders = async () => {
  const response = await fetch('/api/sso/providers');
  
  if (!response.ok) {
    throw new Error('Failed to get SSO providers');
  }
  
  return response.json();
};

// === API Tokens ===
export const getAPITokens = async () => {
  const response = await fetch('/api/tokens/', {
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to get API tokens');
  }
  
  return response.json();
};

export const createAPIToken = async (name) => {
  const response = await fetch('/api/tokens/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create API token');
  }
  
  return response.json();
};

export const updateAPIToken = async (tokenId, name) => {
  const response = await fetch(`/api/tokens/${tokenId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name })
  });
  
  if (!response.ok) {
    throw new Error('Failed to update API token');
  }
  
  return response.json();
};

export const revokeAPIToken = async (tokenId) => {
  const response = await fetch(`/api/tokens/${tokenId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to revoke API token');
  }
  
  return response.json();
};

// === Telegram Bot ===
export const setupTelegramBot = async (botToken, botMode, notificationsEnabled, progressNotifications) => {
  const response = await fetch('/api/telegram-bot/setup', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      bot_token: botToken,
      bot_mode: botMode,
      notifications_enabled: notificationsEnabled,
      progress_notifications: progressNotifications
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to setup Telegram bot');
  }
  
  return response.json();
};

export const getTelegramBotStatus = async () => {
  const response = await fetch('/api/telegram-bot/status', {
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      return null; // Bot not configured
    }
    throw new Error('Failed to get Telegram bot status');
  }
  
  return response.json();
};

export const updateTelegramBot = async (botMode, notificationsEnabled, progressNotifications) => {
  const response = await fetch('/api/telegram-bot/', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      bot_mode: botMode,
      notifications_enabled: notificationsEnabled,
      progress_notifications: progressNotifications
    })
  });
  
  if (!response.ok) {
    throw new Error('Failed to update Telegram bot');
  }
  
  return response.json();
};

export const startTelegramBot = async () => {
  const response = await fetch('/api/telegram-bot/start', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to start Telegram bot');
  }
  
  return response.json();
};

export const stopTelegramBot = async () => {
  const response = await fetch('/api/telegram-bot/stop', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to stop Telegram bot');
  }
  
  return response.json();
};

export const testTelegramBot = async (botToken) => {
  const response = await fetch('/api/telegram-bot/test', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      bot_token: botToken
    })
  });
  
  if (!response.ok) {
    throw new Error('Failed to test Telegram bot');
  }
  
  return response.json();
};

export const deleteTelegramBot = async () => {
  const response = await fetch('/api/telegram-bot/', {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to delete Telegram bot');
  }
  
  return response.json();
};

export const resetTelegramBotChatId = async () => {
  const response = await fetch('/api/telegram-bot/reset-chat-id', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to reset chat ID');
  }
  
  return response.json();
};

export const getAllTelegramBots = async () => {
  const response = await fetch('/api/telegram-bot/admin/bots', {
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to get all Telegram bots');
  }
  
  return response.json();
};

export const adminStopTelegramBot = async (userId) => {
  const response = await fetch(`/api/telegram-bot/admin/bots/${userId}/stop`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to stop Telegram bot');
  }
  
  return response.json();
};

// === Role Permissions ===
export const getAllRolePermissions = async () => {
  const response = await fetch('/api/role-permissions/', {
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to get role permissions');
  }
  
  return response.json();
};

export const getRolePermissions = async (role) => {
  const response = await fetch(`/api/role-permissions/${role}`, {
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to get role permissions');
  }
  
  return response.json();
};

export const updateRolePermissions = async (role, permissions) => {
  const response = await fetch(`/api/role-permissions/${role}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(permissions)
  });
  
  if (!response.ok) {
    throw new Error('Failed to update role permissions');
  }
  
  return response.json();
};

// === Version Check ===
export const getCurrentVersion = async () => {
  const response = await fetch(`${API_URL}/api/version/current`);
  if (!response.ok) {
    throw new Error('Failed to get current version');
  }
  return response.json();
};

export const checkForUpdates = async () => {
  const response = await fetch(`${API_URL}/api/version/check`, {
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to check for updates');
  }
  
  return response.json();
};
