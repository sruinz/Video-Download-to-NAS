import React, { useState } from 'react';
import { X, Globe, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { publishFileToBoard } from '../../api';
import showToast from '../../utils/toast';

export default function PublishFileModal({ isOpen, onClose, file, onPublished }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(file?.filename?.split('/').pop() || '');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!title.trim()) {
      showToast.error(t('modal.validation.required'));
      return;
    }

    try {
      setLoading(true);
      await publishFileToBoard(file.id, title, description);
      showToast.success(t('publishModal.success'));
      if (onPublished) onPublished();
      onClose();
    } catch (error) {
      console.error('Failed to publish file:', error);
      showToast.error(t('publishModal.failed'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !file) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Globe className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold text-gray-900">{t('publishModal.title')}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('publishModal.titleLabel')} *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
              placeholder={t('publishModal.titlePlaceholder')}
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('publishModal.descriptionLabel')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 resize-none"
              placeholder={t('publishModal.descriptionPlaceholder')}
            />
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-2">
              <FileText className="w-5 h-5 text-purple-600 mt-0.5" />
              <div className="text-sm text-purple-900">
                <p className="font-medium mb-1">{t('publishModal.infoTitle')}</p>
                <p className="text-purple-700">
                  {t('publishModal.infoDescription')}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? t('publishModal.submitting') : t('publishModal.submit')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              {t('modal.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
