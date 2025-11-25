import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import showToast from '../utils/toast';

const WebSocketContext = createContext(null);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider = ({ children, onLibraryUpdate }) => {
  const [socket, setSocket] = useState(null);
  const [downloads, setDownloads] = useState(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [canReconnect, setCanReconnect] = useState(true);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10; // Increased from 5

  const handleMessage = useCallback((message) => {
    const { event, download_id } = message;
    console.log('[WebSocket] Handling event:', event, 'for download:', download_id);

    switch (event) {
      case 'download_started':
        setDownloads(prev => {
          const newDownloads = new Map(prev);
          newDownloads.set(download_id, {
            id: download_id,
            url: message.url,
            filename: message.filename,
            resolution: message.resolution,
            progress: 0,
            speed: 0,
            eta: 0,
            status: 'downloading',
            started_at: new Date()
          });
          console.log('[WebSocket] Downloads updated, size:', newDownloads.size);
          return newDownloads;
        });
        break;

      case 'download_progress':
        setDownloads(prev => {
          const newDownloads = new Map(prev);
          const download = newDownloads.get(download_id);
          if (download) {
            newDownloads.set(download_id, {
              ...download,
              progress: message.progress,
              speed: message.speed,
              eta: message.eta,
              filename: message.filename,
              status: 'downloading'
            });
          }
          return newDownloads;
        });
        break;

      case 'download_completed':
        setDownloads(prev => {
          const newDownloads = new Map(prev);
          const download = newDownloads.get(download_id);
          if (download) {
            newDownloads.set(download_id, {
              ...download,
              progress: 100,
              status: 'completed',
              filename: message.filename,
              file_id: message.file_id,
              file_size: message.file_size,
              completed_at: new Date()
            });

            // Show success toast
            showToast.success(`Download completed: ${message.filename}`);

            // Trigger library update
            if (onLibraryUpdate) {
              onLibraryUpdate();
            }

            // Auto-remove after 10 seconds (increased to see the notification)
            setTimeout(() => {
              setDownloads(current => {
                const updated = new Map(current);
                updated.delete(download_id);
                return updated;
              });
            }, 10000);
          }
          return newDownloads;
        });
        break;

      case 'download_failed':
        setDownloads(prev => {
          const newDownloads = new Map(prev);
          const download = newDownloads.get(download_id);
          if (download) {
            newDownloads.set(download_id, {
              ...download,
              status: 'failed',
              error: message.error,
              error_type: message.error_type,
              completed_at: new Date()
            });

            // Show error toast with specific message
            let errorMessage = 'Download failed';
            switch (message.error_type) {
              case 'network':
                errorMessage = 'Network error - check your connection';
                break;
              case 'invalid_url':
                errorMessage = 'Invalid video URL';
                break;
              case 'geo_restriction':
                errorMessage = 'Video not available in your region';
                break;
              default:
                errorMessage = `Download failed: ${message.error}`;
            }
            showToast.error(errorMessage);
          }
          return newDownloads;
        });
        break;

      default:
        console.log('Unknown WebSocket event:', event);
    }
  }, []);

  const connect = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('No token available for WebSocket connection');
      return;
    }

    try {
      // WebSocket URL - always use same host (nginx will proxy to backend)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host; // includes port if present
      const wsUrl = `${protocol}//${host}/ws?token=${token}`;

      console.log('Connecting to WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setIsReconnecting(false);
        setCanReconnect(true);
        reconnectAttemptsRef.current = 0;
        setSocket(ws);

        // Start heartbeat
        const heartbeat = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 30000); // Every 30 seconds

        ws.heartbeatInterval = heartbeat;
      };

      ws.onmessage = (event) => {
        // Ignore heartbeat pong messages
        if (event.data === 'pong') {
          return;
        }
        
        console.log('[WebSocket] Received message:', event.data);
        
        try {
          const message = JSON.parse(event.data);
          console.log('[WebSocket] Parsed message:', message);
          handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected', event.code, event.reason);
        setIsConnected(false);
        setSocket(null);

        // Clear heartbeat
        if (ws.heartbeatInterval) {
          clearInterval(ws.heartbeatInterval);
        }

        // Check if connection was replaced (code 4000)
        if (event.code === 4000) {
          console.log('Connection replaced by another tab/window');
          setCanReconnect(false);
          showToast.info('다른 탭에서 연결되었습니다');
          return;
        }

        // Attempt reconnection with exponential backoff + jitter
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          // Base delay: Start at 2 seconds, max 60 seconds
          const baseDelay = Math.min(2000 * Math.pow(2, reconnectAttemptsRef.current), 60000);
          // Add jitter: ±20%
          const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1);
          const delay = baseDelay + jitter;
          
          console.log(`Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);
          
          setIsReconnecting(true);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else {
          console.log('Max reconnection attempts reached');
          setIsReconnecting(false);
          setCanReconnect(false);
          showToast.error('연결이 끊어졌습니다. 수동으로 재연결하세요.');
        }
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }, [handleMessage, onLibraryUpdate]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (socket) {
      socket.close();
    }
  }, [socket]);

  const removeDownload = useCallback((downloadId) => {
    setDownloads(prev => {
      const newDownloads = new Map(prev);
      newDownloads.delete(downloadId);
      return newDownloads;
    });
  }, []);

  const manualReconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    setCanReconnect(true);
    connect();
  }, [connect]);

  // Connect on mount
  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socket) {
        socket.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const value = {
    socket,
    downloads: Array.from(downloads.values()),
    isConnected,
    isReconnecting,
    canReconnect,
    removeDownload,
    manualReconnect
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
