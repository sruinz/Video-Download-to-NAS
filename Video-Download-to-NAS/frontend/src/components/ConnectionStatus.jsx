import { useWebSocket } from '../contexts/WebSocketContext';
import { useTranslation } from 'react-i18next';

export default function ConnectionStatus() {
  const { isConnected, isReconnecting, canReconnect, manualReconnect } = useWebSocket();
  const { t } = useTranslation();

  if (isConnected) {
    return null; // 연결되어 있으면 아무것도 표시하지 않음
  }

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded shadow-lg flex items-center gap-3 z-50">
      {isReconnecting ? (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-800"></div>
          <span>{t('reconnecting')}</span>
        </>
      ) : (
        <>
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{t('disconnected')}</span>
          {canReconnect && (
            <button
              onClick={manualReconnect}
              className="ml-2 px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors text-sm"
            >
              {t('reconnect')}
            </button>
          )}
        </>
      )}
    </div>
  );
}
