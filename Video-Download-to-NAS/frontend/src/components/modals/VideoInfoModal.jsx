import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Film,
  Music,
  Gauge,
  Zap,
  Monitor,
  Edit2,
  Save,
  Copy,
  Trash2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { updateFileMemo } from '../../api';
import { parseTextWithLinks } from '../../utils/textUtils';
import showToast from '../../utils/toast';

const MEMO_MAX_LENGTH = 10000;
const MEMO_COLLAPSE_CHAR_THRESHOLD = 360;
const MEMO_COLLAPSE_LINE_THRESHOLD = 6;

export default function VideoInfoModal({ file, onClose, onUpdated }) {
  const { t } = useTranslation();
  const [savedMemo, setSavedMemo] = useState(file?.memo || '');
  const [draftMemo, setDraftMemo] = useState(file?.memo || '');
  const [isEditingMemo, setIsEditingMemo] = useState(false);
  const [savingMemo, setSavingMemo] = useState(false);
  const [isMemoExpanded, setIsMemoExpanded] = useState(false);

  useEffect(() => {
    const initial = file?.memo || '';
    setSavedMemo(initial);
    setDraftMemo(initial);
    setIsEditingMemo(false);
    setIsMemoExpanded(false);
  }, [file?.id, file?.memo]);

  const memoTokens = useMemo(() => parseTextWithLinks(savedMemo), [savedMemo]);

  const isLongMemo = useMemo(() => {
    if (!savedMemo) return false;
    return (
      savedMemo.length > MEMO_COLLAPSE_CHAR_THRESHOLD ||
      savedMemo.split('\n').length > MEMO_COLLAPSE_LINE_THRESHOLD
    );
  }, [savedMemo]);

  if (!file) return null;

  const formatFileSize = (bytes) => {
    if (!bytes) return t('file.unknown');
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    const gb = mb / 1024;
    return gb >= 1 ? `${gb.toFixed(2)} GB` : `${mb.toFixed(2)} MB`;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return t('file.unknown');
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSaveMemo = async () => {
    try {
      setSavingMemo(true);
      const res = await updateFileMemo(file.id, draftMemo);
      const nextMemo = res.memo || '';
      setSavedMemo(nextMemo);
      setDraftMemo(nextMemo);
      setIsEditingMemo(false);
      showToast.success(t('videoInfo.memoSaved'));
      if (onUpdated) {
        onUpdated();
      }
    } catch (error) {
      console.error('Failed to save memo:', error);
      showToast.error(error.message || t('videoInfo.memoSaveFailed'));
    } finally {
      setSavingMemo(false);
    }
  };

  const handleCopyMemo = async () => {
    if (!savedMemo) return;
    try {
      await navigator.clipboard.writeText(savedMemo);
      showToast.success(t('videoInfo.memoCopied'));
    } catch (error) {
      console.error('Failed to copy memo:', error);
      showToast.error(t('videoInfo.memoCopyFailed'));
    }
  };

  const MetadataRow = ({ icon: Icon, label, value }) => {
    if (!value) return null;

    return (
      <div className="flex items-center gap-3 py-2 border-b border-gray-700 last:border-0">
        <Icon className="w-5 h-5 text-gray-400 flex-shrink-0" />
        <div className="flex-1">
          <div className="text-xs text-gray-400">{label}</div>
          <div className="text-sm font-medium">{value}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-yt-dark rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold">{t('videoInfo.title')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-yt-light rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Thumbnail */}
          {file.thumbnail && file.file_type !== 'subtitle' && (
            <div className="mb-4 rounded-lg overflow-hidden bg-yt-darker">
              <img
                src={
                  file.thumbnail.startsWith('http')
                    ? file.thumbnail
                    : `/api/thumbnail/${file.id}?token=${localStorage.getItem('token')}`
                }
                alt={file.filename}
                className="w-full h-auto"
              />
            </div>
          )}

          {/* Filename */}
          <div className="mb-4">
            <div className="text-xs text-gray-400 mb-1">{t('videoInfo.filename')}</div>
            <div className="text-sm font-medium break-all">{file.filename.split('/').pop()}</div>
          </div>

          {/* Integrated Memo / Description */}
          <div className="bg-yt-darker rounded-lg p-4 mb-4 border border-gray-800">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="text-sm font-semibold text-gray-300">
                {t('videoInfo.memoTitle')}
              </h3>
              {!isEditingMemo && (
                <div className="flex items-center gap-1.5">
                  {savedMemo && (
                    <button
                      type="button"
                      onClick={handleCopyMemo}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-yt-light hover:bg-gray-600 text-xs text-gray-200 transition-colors"
                      title={t('videoInfo.memoCopy')}
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{t('videoInfo.memoCopy')}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setDraftMemo(savedMemo);
                      setIsEditingMemo(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-xs text-cyan-300 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>{savedMemo ? t('videoInfo.memoEdit') : t('videoInfo.memoAdd')}</span>
                  </button>
                </div>
              )}
            </div>

            {isEditingMemo ? (
              <div className="space-y-2.5">
                <textarea
                  value={draftMemo}
                  onChange={(e) => setDraftMemo(e.target.value)}
                  maxLength={MEMO_MAX_LENGTH}
                  rows={6}
                  placeholder={t('videoInfo.memoPlaceholder')}
                  className="w-full bg-yt-dark border border-gray-600 focus:border-cyan-500 rounded-lg p-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none resize-y leading-relaxed"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-gray-500">
                    {draftMemo.length.toLocaleString()} / {MEMO_MAX_LENGTH.toLocaleString()}
                  </span>
                  <div className="flex items-center gap-2">
                    {draftMemo && (
                      <button
                        type="button"
                        onClick={() => setDraftMemo('')}
                        disabled={savingMemo}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-red-600/20 hover:bg-red-600/30 text-xs text-red-300 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{t('videoInfo.memoClear')}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setDraftMemo(savedMemo);
                        setIsEditingMemo(false);
                      }}
                      disabled={savingMemo}
                      className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-xs text-gray-200 transition-colors disabled:opacity-50"
                    >
                      {t('videoInfo.memoCancel')}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveMemo}
                      disabled={savingMemo}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-yt-red hover:bg-red-700 text-xs font-semibold text-white transition-colors disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{savingMemo ? t('videoInfo.memoSaving') : t('videoInfo.memoSave')}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : savedMemo ? (
              <div>
                <div
                  className={`text-sm text-gray-200 whitespace-pre-wrap break-words leading-relaxed ${
                    isLongMemo && !isMemoExpanded ? 'line-clamp-6' : ''
                  }`}
                >
                  {memoTokens.map((token, idx) => (
                    token.type === 'link' ? (
                      <a
                        key={idx}
                        href={token.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 underline break-all"
                      >
                        {token.value}
                      </a>
                    ) : (
                      <React.Fragment key={idx}>{token.value}</React.Fragment>
                    )
                  ))}
                </div>
                {isLongMemo && (
                  <button
                    type="button"
                    onClick={() => setIsMemoExpanded((prev) => !prev)}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    {isMemoExpanded ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" />
                        <span>{t('videoInfo.memoShowLess')}</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" />
                        <span>{t('videoInfo.memoShowMore')}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500">{t('videoInfo.memoEmpty')}</p>
            )}
          </div>

          {/* Basic Info */}
          <div className="bg-yt-darker rounded-lg p-4 mb-4">
            <h3 className="text-sm font-semibold mb-3 text-gray-300">{t('videoInfo.basicInfo')}</h3>
            <div className="space-y-2">
              <MetadataRow
                icon={Film}
                label={t('videoInfo.fileType')}
                value={t(`file.${file.file_type}`)}
              />
              <MetadataRow
                icon={Gauge}
                label={t('videoInfo.fileSize')}
                value={formatFileSize(file.file_size)}
              />
              {file.duration && file.file_type !== 'subtitle' && (
                <MetadataRow
                  icon={Zap}
                  label={t('videoInfo.duration')}
                  value={formatDuration(file.duration)}
                />
              )}
            </div>
          </div>

          {/* Video Metadata */}
          {file.file_type === 'video' && (file.resolution || file.video_codec || file.framerate) && (
            <div className="bg-yt-darker rounded-lg p-4 mb-4">
              <h3 className="text-sm font-semibold mb-3 text-gray-300">{t('videoInfo.videoMetadata')}</h3>
              <div className="space-y-2">
                <MetadataRow
                  icon={Monitor}
                  label={t('videoInfo.resolution')}
                  value={file.resolution}
                />
                <MetadataRow
                  icon={Film}
                  label={t('videoInfo.videoCodec')}
                  value={file.video_codec?.toUpperCase()}
                />
                <MetadataRow
                  icon={Zap}
                  label={t('videoInfo.framerate')}
                  value={file.framerate ? `${file.framerate} fps` : null}
                />
              </div>
            </div>
          )}

          {/* Audio Metadata */}
          {(file.audio_codec || file.bitrate) && (
            <div className="bg-yt-darker rounded-lg p-4 mb-4">
              <h3 className="text-sm font-semibold mb-3 text-gray-300">{t('videoInfo.audioMetadata')}</h3>
              <div className="space-y-2">
                <MetadataRow
                  icon={Music}
                  label={t('videoInfo.audioCodec')}
                  value={file.audio_codec?.toUpperCase()}
                />
                <MetadataRow
                  icon={Gauge}
                  label={t('videoInfo.bitrate')}
                  value={file.bitrate ? `${file.bitrate}bps` : null}
                />
              </div>
            </div>
          )}

          {/* Original URL */}
          {file.original_url && (
            <div className="bg-yt-darker rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-2 text-gray-300">{t('videoInfo.originalUrl')}</h3>
              <a
                href={file.original_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:text-blue-300 break-all"
              >
                {file.original_url}
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-yt-light hover:bg-gray-600 text-white font-semibold py-2 rounded-lg transition-colors"
          >
            {t('modal.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
