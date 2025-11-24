import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import ModalWrapper from './ModalWrapper';

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  requireTyping,
  requireTypingLabel,
  onConfirm,
  onCancel
}) {
  const [typedText, setTypedText] = useState('');

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setTypedText('');
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (requireTyping && typedText !== requireTyping) {
      return;
    }
    onConfirm();
  };

  const isValid = !requireTyping || typedText === requireTyping;

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
    >
      <div className="space-y-6">
        {/* Icon and Message */}
        <div className="flex gap-4">
          {danger && (
            <div className="flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
          )}
          <div className="flex-1">
            <p className="text-gray-300 whitespace-pre-line">
              {message}
            </p>
          </div>
        </div>

        {/* Type to confirm */}
        {requireTyping && (
          <div className="space-y-2">
            {requireTypingLabel ? (
              <label className="block text-sm font-medium text-gray-300">
                {requireTypingLabel}
              </label>
            ) : (
              <label className="block text-sm font-medium text-gray-300">
                Type <span className="font-bold text-white">{requireTyping}</span> to confirm:
              </label>
            )}
            <input
              type="text"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              className={`w-full px-4 py-2 bg-yt-dark border rounded-lg text-white focus:outline-none focus:ring-2 transition-colors ${
                danger
                  ? 'border-red-700 focus:ring-red-500'
                  : 'border-gray-700 focus:ring-yt-red'
              }`}
              placeholder={requireTyping}
              autoFocus
            />
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            autoFocus={!requireTyping}
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValid}
            className={`px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              danger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-yt-red hover:bg-red-700'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}
