import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  HelpCircle,
  RotateCcw,
  RotateCw,
  List,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Repeat,
  Repeat1,
  Shuffle,
  Subtitles,
  Check
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getSubtitleTrackUrl, getShareSubtitleTrackUrl } from '../../api';
import {
  getNextRepeatMode,
  resolveNextTrack,
  resolvePreviousTrack
} from '../../utils/playbackOrder';
import {
  getPlayerSubtitlePrefs,
  pickDefaultSubtitleTrack,
  buildSubtitleOverlayStyle,
  cleanCueText,
  SUBTITLE_POSITION_BOTTOM_CSS
} from '../../utils/subtitleUtils';

export default function VideoPlayerModal({ isOpen, file, playlist, currentIndex, onClose, setModalState }) {
  const { t, i18n } = useTranslation();
  const videoRef = useRef(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [subtitlePrefs, setSubtitlePrefs] = useState(() => getPlayerSubtitlePrefs());
  const [activeSubtitleId, setActiveSubtitleId] = useState(null);
  const [subtitleBlobUrl, setSubtitleBlobUrl] = useState(null);
  const [activeCueLines, setActiveCueLines] = useState([]);
  const trackRef = useRef(null);
  const lastSubtitleIdRef = useRef(null);
  const [repeatMode, setRepeatMode] = useState(() => {
    const saved = localStorage.getItem('videoPlayerRepeatMode');
    return ['off', 'all', 'one'].includes(saved) ? saved : 'off';
  });
  const [isShuffle, setIsShuffle] = useState(() => (
    localStorage.getItem('videoPlayerShuffle') === 'true'
  ));
  const controlsTimeoutRef = useRef(null);
  const clickTimeoutRef = useRef(null);
  const shuffleVisitedRef = useRef([]);
  const shuffleHistoryRef = useRef([]);

  const availableSubtitles = useMemo(
    () => (Array.isArray(file?.subtitles) ? file.subtitles : []),
    [file]
  );

  const activeSubtitleTrack = useMemo(
    () => availableSubtitles.find((track) => track.id === activeSubtitleId) || null,
    [availableSubtitles, activeSubtitleId]
  );

  const readActiveCues = () => {
    const trackEl = trackRef.current;
    const textTrack = trackEl?.track;
    if (!textTrack || !activeSubtitleId) {
      setActiveCueLines([]);
      return;
    }
    const cues = textTrack.activeCues ? Array.from(textTrack.activeCues) : [];
    const lines = cues.map((cue) => cleanCueText(cue.text)).filter(Boolean);
    setActiveCueLines(lines);
  };

  const syncTextTrackMode = () => {
    const video = videoRef.current;
    if (!video || !video.textTracks) return;
    for (let i = 0; i < video.textTracks.length; i += 1) {
      // 'hidden' 모드로 파싱 및 cuechange 이벤트만 수신하고 커스텀 오버레이로 일관되게 렌더링
      video.textTracks[i].mode = activeSubtitleId ? 'hidden' : 'disabled';
    }
    readActiveCues();
  };

  // 전체화면 상태 동기화 (ESC / F 키 포함)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // 영상 변경 시 사용자 자막 표시 설정에 따라 기본 자막 트랙 자동 선택
  useEffect(() => {
    if (!isOpen || !file) return;
    const prefs = getPlayerSubtitlePrefs();
    setSubtitlePrefs(prefs);
    setShowSubtitleMenu(false);

    if (file.file_type !== 'audio' && availableSubtitles.length > 0) {
      const picked = pickDefaultSubtitleTrack(availableSubtitles, prefs, i18n.language);
      const nextId = picked ? picked.id : null;
      setActiveSubtitleId(nextId);
      if (nextId) lastSubtitleIdRef.current = nextId;
    } else {
      setActiveSubtitleId(null);
    }
  }, [isOpen, file, availableSubtitles, i18n.language]);

  // 선택된 자막 트랙을 인증 요청으로 불러와 WebVTT Blob URL로 연결
  useEffect(() => {
    if (!isOpen || !file || !activeSubtitleId || file.file_type === 'audio') {
      setSubtitleBlobUrl(null);
      syncTextTrackMode();
      return undefined;
    }

    let cancelled = false;
    let objectUrl = null;

    const loadSubtitle = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = {};
        let url;

        if (file.shareToken) {
          url = getShareSubtitleTrackUrl(file.shareToken, activeSubtitleId, file.sharePassword);
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
        } else {
          if (!token) return;
          url = getSubtitleTrackUrl(activeSubtitleId, Boolean(file.fromPublicBoard));
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error('Failed to load subtitle');
        const vttText = await response.text();
        if (cancelled) return;
        const blob = new Blob([vttText], { type: 'text/vtt; charset=utf-8' });
        objectUrl = URL.createObjectURL(blob);
        setSubtitleBlobUrl(objectUrl);
      } catch (error) {
        console.error('Failed to load subtitle track:', error);
        if (!cancelled) {
          setSubtitleBlobUrl(null);
        }
      }
    };

    loadSubtitle();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [isOpen, file, activeSubtitleId]);

  useEffect(() => {
    if (!subtitleBlobUrl || !activeSubtitleId) {
      setActiveCueLines([]);
      syncTextTrackMode();
      return undefined;
    }

    syncTextTrackMode();
    const trackEl = trackRef.current;
    const textTrack = trackEl?.track;
    if (!textTrack) return undefined;

    const handleCueChange = () => readActiveCues();
    textTrack.addEventListener('cuechange', handleCueChange);
    return () => {
      textTrack.removeEventListener('cuechange', handleCueChange);
    };
  }, [subtitleBlobUrl, activeSubtitleId]);

  const toggleSubtitlesShortcut = () => {
    if (availableSubtitles.length === 0) return;
    setActiveSubtitleId((prev) => {
      if (prev) {
        lastSubtitleIdRef.current = prev;
        return null;
      }
      if (lastSubtitleIdRef.current && availableSubtitles.some((s) => s.id === lastSubtitleIdRef.current)) {
        return lastSubtitleIdRef.current;
      }
      const picked = pickDefaultSubtitleTrack(
        availableSubtitles,
        { ...subtitlePrefs, autoShow: true },
        i18n.language
      );
      return picked ? picked.id : availableSubtitles[0].id;
    });
  };

  useEffect(() => {
    localStorage.setItem('videoPlayerRepeatMode', repeatMode);
  }, [repeatMode]);

  useEffect(() => {
    localStorage.setItem('videoPlayerShuffle', String(isShuffle));
  }, [isShuffle]);

  useEffect(() => {
    if (!isOpen) return;
    shuffleVisitedRef.current = typeof currentIndex === 'number' ? [currentIndex] : [];
    shuffleHistoryRef.current = [];
  }, [isOpen, playlist]);

  const toggleRepeatMode = () => {
    setRepeatMode((prev) => getNextRepeatMode(prev));
  };

  const toggleShuffle = () => {
    setIsShuffle((prev) => {
      const next = !prev;
      if (next) {
        shuffleVisitedRef.current = typeof currentIndex === 'number' ? [currentIndex] : [];
        shuffleHistoryRef.current = [];
      }
      return next;
    });
  };

  const replayCurrentMedia = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  };

  // Navigation functions
  const goToNext = (fromEnded = false) => {
    const playlistLength = playlist ? playlist.length : 0;
    const resolution = resolveNextTrack({
      playlistLength,
      currentIndex: currentIndex || 0,
      repeatMode,
      isShuffle,
      visitedIndices: shuffleVisitedRef.current,
      fromEnded
    });

    if (resolution.action === 'replay') {
      replayCurrentMedia();
      return;
    }

    if (resolution.action === 'move' && playlist && playlist[resolution.nextIndex]) {
      if (isShuffle) {
        shuffleHistoryRef.current.push(currentIndex || 0);
        if (resolution.resetVisited) {
          shuffleVisitedRef.current = [resolution.nextIndex];
        } else if (!shuffleVisitedRef.current.includes(resolution.nextIndex)) {
          shuffleVisitedRef.current.push(resolution.nextIndex);
        }
      }

      const nextFile = playlist[resolution.nextIndex];
      setModalState(prev => ({
        ...prev,
        type: nextFile.file_type === 'audio' ? 'audio' : 'video',
        file: nextFile,
        currentIndex: resolution.nextIndex
      }));
    }
  };

  const goToPrevious = () => {
    const playlistLength = playlist ? playlist.length : 0;
    const resolution = resolvePreviousTrack({
      playlistLength,
      currentIndex: currentIndex || 0,
      repeatMode,
      isShuffle,
      historyStack: shuffleHistoryRef.current
    });

    if (resolution.action === 'replay') {
      replayCurrentMedia();
      return;
    }

    if (resolution.action === 'move' && playlist && playlist[resolution.prevIndex]) {
      if (resolution.popHistory) {
        shuffleHistoryRef.current.pop();
      }
      const prevFile = playlist[resolution.prevIndex];
      setModalState(prev => ({
        ...prev,
        type: prevFile.file_type === 'audio' ? 'audio' : 'video',
        file: prevFile,
        currentIndex: resolution.prevIndex
      }));
    }
  };

  const playFileAtIndex = (index) => {
    if (playlist && index >= 0 && index < playlist.length) {
      if (isShuffle) {
        shuffleHistoryRef.current.push(currentIndex || 0);
        if (!shuffleVisitedRef.current.includes(index)) {
          shuffleVisitedRef.current.push(index);
        }
      }
      const selectedFile = playlist[index];
      setModalState(prev => ({
        ...prev,
        type: selectedFile.file_type === 'audio' ? 'audio' : 'video',
        file: selectedFile,
        currentIndex: index
      }));
      setShowPlaylist(false);
    }
  };

  const hasMultipleTracks = Boolean(playlist && playlist.length > 1);
  const canGoPrevious = hasMultipleTracks && (
    currentIndex > 0 || repeatMode === 'all' || (isShuffle && shuffleHistoryRef.current.length > 0)
  );
  const canGoNext = hasMultipleTracks && (
    currentIndex < playlist.length - 1 || repeatMode === 'all' || isShuffle
  );

  const repeatTooltip = repeatMode === 'one'
    ? t('player.repeatOne')
    : repeatMode === 'all'
      ? t('player.repeatAll')
      : t('player.repeatOff');

  // Load video with auth token
  useEffect(() => {
    if (!isOpen || !file) return;

    const loadVideo = async () => {
      try {
        setIsBuffering(true);
        
        // Use appropriate endpoint based on file source
        let url;
        let headers = {};
        
        if (file.shareToken) {
          // Access via share link
          url = `/api/share-links/file/${file.shareToken}/${file.id}`;
          // Add password if provided
          if (file.sharePassword) {
            url += `?password=${encodeURIComponent(file.sharePassword)}`;
          }
          // Only add auth header if user is logged in
          const token = localStorage.getItem('token');
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
        } else if (file.fromPublicBoard) {
          // Access public board file
          url = `/api/public-board/files/${file.id}/stream`;
          headers['Authorization'] = `Bearer ${localStorage.getItem('token')}`;
        } else {
          // Normal authenticated access
          url = `/api/file/${file.id}`;
          headers['Authorization'] = `Bearer ${localStorage.getItem('token')}`;
        }
        
        const response = await fetch(url, { headers });

        if (!response.ok) throw new Error('Failed to load video');

        const blob = await response.blob();
        const videoUrl = URL.createObjectURL(blob);
        setVideoUrl(videoUrl);
      } catch (error) {
        console.error('Failed to load video:', error);
        onClose();
      }
    };

    loadVideo();

    // Cleanup
    return () => {
      // Don't exit PIP automatically - let user control it
      // Only clean up the blob URL
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [isOpen, file]);

  // Load saved volume
  useEffect(() => {
    const savedVolume = localStorage.getItem('videoPlayerVolume');
    if (savedVolume) {
      const vol = parseFloat(savedVolume);
      setVolume(vol);
      if (videoRef.current) {
        videoRef.current.volume = vol;
      }
    }
  }, []);

  // Auto-play when video is loaded
  useEffect(() => {
    if (videoUrl && videoRef.current) {
      videoRef.current.play().catch(err => {
        console.log('Auto-play prevented:', err);
      });
    }
  }, [videoUrl]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen || !videoRef.current) return;

    const handleKeyPress = (e) => {
      // Prevent if typing in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const video = videoRef.current;
      if (!video) return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          if (video.paused) {
            video.play();
          } else {
            video.pause();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          video.currentTime = Math.min(video.duration, video.currentTime + 5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          setVolume(video.volume);
          localStorage.setItem('videoPlayerVolume', video.volume.toString());
          break;
        case 'ArrowDown':
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          setVolume(video.volume);
          localStorage.setItem('videoPlayerVolume', video.volume.toString());
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          if (!document.fullscreenElement) {
            video.parentElement?.requestFullscreen();
          } else {
            document.exitFullscreen();
          }
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          video.muted = !video.muted;
          setIsMuted(video.muted);
          break;
        case 'c':
        case 'C':
          e.preventDefault();
          toggleSubtitlesShortcut();
          break;
        case 'Escape':
          if (document.fullscreenElement) {
            e.preventDefault();
            document.exitFullscreen();
          } else {
            onClose();
          }
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isOpen, onClose, availableSubtitles, subtitlePrefs, i18n.language]);

  // Hide controls after inactivity
  useEffect(() => {
    if (!isOpen) return;

    const resetControlsTimeout = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        if (isPlaying) {
          setShowControls(false);
        }
      }, 3000);
    };

    const handleMouseMove = () => {
      resetControlsTimeout();
    };

    // Add mouse move listener
    document.addEventListener('mousemove', handleMouseMove);
    resetControlsTimeout();

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isOpen, isPlaying]);

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const seek = (seconds) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
    }
  };

  const changeVolume = (delta) => {
    const newVolume = Math.max(0, Math.min(1, volume + delta));
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    localStorage.setItem('videoPlayerVolume', newVolume.toString());
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
  };

  const toggleFullscreen = () => {
    const container = videoRef.current?.parentElement;
    if (!document.fullscreenElement) {
      container?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const exitFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      syncTextTrackMode();
    }
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    if (videoRef.current) {
      videoRef.current.currentTime = pos * duration;
    }
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen || !file) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black flex items-center justify-center animate-fadeIn"
      style={{ cursor: showControls ? 'default' : 'none' }}
      onClick={onClose}
      onMouseMove={() => setShowControls(true)}
    >
      {/* Video Container */}
      <div 
        className="relative w-full h-full flex items-center justify-center"
        style={{ cursor: showControls ? 'default' : 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Video/Audio Element */}
        {file.file_type === 'audio' ? (
          <div className="relative w-full max-w-2xl">
            {/* Audio Thumbnail */}
            <div className="aspect-video bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center rounded-lg overflow-hidden relative">
              {file.thumbnail ? (
                <img
                  src={
                    file.thumbnail.startsWith('http') 
                      ? file.thumbnail 
                      : file.shareToken
                        ? `/api/share-links/thumbnail/${file.shareToken}/${file.id}${file.sharePassword ? `?password=${encodeURIComponent(file.sharePassword)}` : ''}`
                        : `/api/thumbnail/${file.id}?token=${localStorage.getItem('token') || ''}`
                  }
                  alt={file.filename}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center">
                  <div className="w-32 h-32 mx-auto mb-4 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm">
                    <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                    </svg>
                  </div>
                  <h3 className="text-white text-xl font-semibold mb-2">{file.filename.split('/').pop()}</h3>
                  <p className="text-white/60 text-sm">Audio File</p>
                </div>
              )}
            </div>
            {/* Audio Element */}
            <audio
              ref={videoRef}
              src={videoUrl}
              className="hidden"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onWaiting={() => setIsBuffering(true)}
              onCanPlay={() => setIsBuffering(false)}
              onEnded={() => goToNext(true)}
            />
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              src={videoUrl}
              poster={
                file.thumbnail 
                  ? (file.thumbnail.startsWith('http') 
                      ? file.thumbnail 
                      : `/api/thumbnail/${file.id}?token=${localStorage.getItem('token') || file.sharePassword || ''}`)
                  : undefined
              }
              className="vdtn-player-video w-full h-full object-contain"
              style={{ cursor: showControls ? 'default' : 'none' }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={handleTimeUpdate}
              onSeeked={readActiveCues}
              onLoadedMetadata={handleLoadedMetadata}
              onWaiting={() => setIsBuffering(true)}
              onCanPlay={() => setIsBuffering(false)}
              onEnded={() => goToNext(true)}
              onClick={(e) => {
                e.stopPropagation();
                // Clear any existing click timeout
                if (clickTimeoutRef.current) {
                  clearTimeout(clickTimeoutRef.current);
                  clickTimeoutRef.current = null;
                }
                
                // Set timeout for single click
                clickTimeoutRef.current = setTimeout(() => {
                  togglePlayPause();
                  clickTimeoutRef.current = null;
                }, 250);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                // Cancel single click action
                if (clickTimeoutRef.current) {
                  clearTimeout(clickTimeoutRef.current);
                  clickTimeoutRef.current = null;
                }
                // Only toggle fullscreen
                toggleFullscreen();
              }}
            >
              {subtitleBlobUrl && activeSubtitleTrack && (
                <track
                  ref={trackRef}
                  key={activeSubtitleTrack.id}
                  kind="subtitles"
                  src={subtitleBlobUrl}
                  srcLang={activeSubtitleTrack.lang || 'und'}
                  label={activeSubtitleTrack.shortLabel || 'CC'}
                  default
                  onLoad={syncTextTrackMode}
                />
              )}
            </video>

            {/* Custom Styled Subtitle Overlay (글꼴·크기·색상·배경 투명도·위치 일관 지원) */}
            {activeSubtitleId && activeCueLines.length > 0 && (
              <div
                className="absolute inset-x-4 sm:inset-x-10 flex flex-col items-center gap-1 pointer-events-none select-none z-[5] transition-all duration-200"
                style={{
                  bottom:
                    showControls && subtitlePrefs.position === 'low'
                      ? 'max(5%, 76px)'
                      : (SUBTITLE_POSITION_BOTTOM_CSS[subtitlePrefs.position] || '10%')
                }}
              >
                {activeCueLines.map((line, idx) => (
                  <div
                    key={`${idx}-${line.slice(0, 16)}`}
                    className="max-w-[90%] text-center rounded leading-snug whitespace-pre-line"
                    style={buildSubtitleOverlayStyle(subtitlePrefs)}
                  >
                    {line}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Buffering Indicator */}
        {isBuffering && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* Controls Overlay */}
        <div 
          className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/50 transition-opacity duration-300 pointer-events-none ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Top Bar */}
          <div className="absolute top-0 left-0 right-0 p-3 sm:p-4 flex items-center justify-between z-10 pointer-events-auto">
            <h3 className="text-white text-sm sm:text-base font-medium truncate flex-1">{file.filename.split('/').pop()}</h3>
            <div className="flex items-center gap-2">
              {file.original_url && (
                <a
                  href={file.original_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
                  title="원본 영상 보기"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </a>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </button>
            </div>
          </div>

          {/* Center Play Button (when paused) */}
          {!isPlaying && !isBuffering && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
              <button
                onClick={togglePlayPause}
                className="w-20 h-20 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors backdrop-blur-sm"
              >
                <Play className="w-10 h-10 text-white ml-1" />
              </button>
            </div>
          )}

          {/* Bottom Controls */}
          <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2 pointer-events-auto">
            {/* Progress Bar */}
            <div 
              className="w-full h-1 bg-white/30 rounded-full cursor-pointer hover:h-2 transition-all group"
              onClick={handleSeek}
            >
              <div 
                className="h-full bg-yt-red rounded-full relative"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center gap-2 sm:gap-4">
                {/* Previous Video (if playlist available) */}
                {canGoPrevious && (
                  <button
                    onClick={goToPrevious}
                    className="hover:text-yt-red transition-colors"
                    title={t('player.previous')}
                  >
                    <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                )}
                
                {/* Seek Back -5s */}
                <button
                  onClick={() => seek(-5)}
                  className="hover:text-yt-red transition-colors relative"
                  title="Rewind 5s"
                >
                  <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">5</span>
                </button>

                {/* Play/Pause */}
                <button
                  onClick={togglePlayPause}
                  className="hover:text-yt-red transition-colors"
                >
                  {isPlaying ? <Pause className="w-6 h-6 sm:w-7 sm:h-7" /> : <Play className="w-6 h-6 sm:w-7 sm:h-7" />}
                </button>

                {/* Seek Forward +5s */}
                <button
                  onClick={() => seek(5)}
                  className="hover:text-yt-red transition-colors relative"
                  title="Forward 5s"
                >
                  <RotateCw className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">5</span>
                </button>

                {/* Next Video (if playlist available) */}
                {canGoNext && (
                  <button
                    onClick={() => goToNext(false)}
                    className="hover:text-yt-red transition-colors"
                    title={t('player.next')}
                  >
                    <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                )}

                {/* Volume */}
                <div className="flex items-center gap-2 group">
                  <button
                    onClick={toggleMute}
                    className="hover:text-yt-red transition-colors"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-6 h-6" />
                    ) : (
                      <Volume2 className="w-6 h-6" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setVolume(val);
                      setIsMuted(val === 0);
                      if (videoRef.current) {
                        videoRef.current.volume = val;
                        videoRef.current.muted = val === 0;
                      }
                      localStorage.setItem('videoPlayerVolume', val.toString());
                    }}
                    className="w-0 group-hover:w-20 transition-all opacity-0 group-hover:opacity-100"
                  />
                </div>

                {/* Time */}
                <span className="text-sm">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <div className="flex items-center gap-2 sm:gap-4">
                {/* Subtitles / CC selector (if video has matching subtitles) */}
                {file.file_type !== 'audio' && availableSubtitles.length > 0 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowSubtitleMenu((prev) => !prev)}
                      className={`hover:text-yt-red transition-colors flex items-center gap-1 ${
                        activeSubtitleId ? 'text-yt-red' : ''
                      }`}
                      title={t('player.subtitlesToggle')}
                    >
                      <Subtitles className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>

                    {showSubtitleMenu && (
                      <div className="absolute bottom-10 right-0 w-44 bg-black/95 border border-gray-700 rounded-lg shadow-xl py-1.5 z-30 text-sm">
                        <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 border-b border-gray-800">
                          {t('player.subtitleTrack')}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSubtitleId(null);
                            setShowSubtitleMenu(false);
                          }}
                          className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center justify-between text-xs"
                        >
                          <span>{t('player.subtitlesOff')}</span>
                          {!activeSubtitleId && <Check className="w-3.5 h-3.5 text-yt-red" />}
                        </button>
                        {availableSubtitles.map((track) => (
                          <button
                            key={track.id}
                            type="button"
                            onClick={() => {
                              setActiveSubtitleId(track.id);
                              lastSubtitleIdRef.current = track.id;
                              setShowSubtitleMenu(false);
                            }}
                            className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center justify-between text-xs"
                          >
                            <span className="truncate">
                              {track.shortLabel} ({track.format})
                            </span>
                            {activeSubtitleId === track.id && (
                              <Check className="w-3.5 h-3.5 text-yt-red flex-shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Shuffle (if playlist has multiple items) */}
                {hasMultipleTracks && (
                  <button
                    onClick={toggleShuffle}
                    className={`hover:text-yt-red transition-colors ${isShuffle ? 'text-yt-red' : ''}`}
                    title={isShuffle ? t('player.shuffleOn') : t('player.shuffleOff')}
                  >
                    <Shuffle className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                )}

                {/* Repeat (off -> all -> one) */}
                <button
                  onClick={toggleRepeatMode}
                  className={`hover:text-yt-red transition-colors ${repeatMode !== 'off' ? 'text-yt-red' : ''}`}
                  title={repeatTooltip}
                >
                  {repeatMode === 'one' ? (
                    <Repeat1 className="w-5 h-5 sm:w-6 sm:h-6" />
                  ) : (
                    <Repeat className="w-5 h-5 sm:w-6 sm:h-6" />
                  )}
                </button>

                {/* Playlist (if available) */}
                {hasMultipleTracks && (
                  <button
                    onClick={() => setShowPlaylist(!showPlaylist)}
                    className={`hover:text-yt-red transition-colors ${showPlaylist ? 'text-yt-red' : ''}`}
                    title={t('player.playlist')}
                  >
                    <List className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                )}

                {/* Keyboard Help */}
                <button
                  onClick={() => setShowKeyboardHelp(!showKeyboardHelp)}
                  className={`hover:text-yt-red transition-colors ${showKeyboardHelp ? 'text-yt-red' : ''}`}
                  title="Keyboard shortcuts"
                >
                  <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>

                {/* Fullscreen */}
                <button
                  onClick={toggleFullscreen}
                  className="hover:text-yt-red transition-colors"
                >
                  {isFullscreen ? (
                    <Minimize className="w-5 h-5 sm:w-6 sm:h-6" />
                  ) : (
                    <Maximize className="w-5 h-5 sm:w-6 sm:h-6" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Keyboard Shortcuts Hint */}
        {showControls && showKeyboardHelp && (
          <div className="absolute bottom-20 left-4 text-white text-xs bg-black/80 px-3 py-2 rounded backdrop-blur-sm pointer-events-auto">
            <div className="space-y-1">
              <div><kbd className="px-1 bg-white/20 rounded">Space</kbd> Play/Pause</div>
              <div><kbd className="px-1 bg-white/20 rounded">←→</kbd> Seek ±5s</div>
              <div><kbd className="px-1 bg-white/20 rounded">↑↓</kbd> Volume</div>
              <div><kbd className="px-1 bg-white/20 rounded">F</kbd> Fullscreen</div>
              <div><kbd className="px-1 bg-white/20 rounded">M</kbd> Mute</div>
              <div><kbd className="px-1 bg-white/20 rounded">C</kbd> {t('player.subtitles')}</div>
              <div><kbd className="px-1 bg-white/20 rounded">ESC</kbd> Close</div>
            </div>
          </div>
        )}

        {/* Playlist Panel */}
        {showControls && showPlaylist && playlist && (
          <div className="absolute bottom-20 right-4 w-80 max-h-96 bg-black/90 backdrop-blur-sm rounded-lg overflow-hidden pointer-events-auto">
            <div className="p-3 border-b border-gray-700">
              <h3 className="text-white font-medium">Playlist ({playlist.length} videos)</h3>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {playlist.map((playlistFile, index) => (
                <div
                  key={playlistFile.id}
                  className={`p-3 border-b border-gray-800 cursor-pointer hover:bg-white/10 transition-colors ${
                    index === currentIndex ? 'bg-yt-red/20 border-yt-red' : ''
                  }`}
                  onClick={() => playFileAtIndex(index)}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xs ${index === currentIndex ? 'text-yt-red' : 'text-gray-400'}`}>
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${index === currentIndex ? 'text-white font-medium' : 'text-gray-300'}`}>
                        {playlistFile.filename.split('/').pop()}
                      </p>
                      <p className="text-xs text-gray-500">
                        {playlistFile.file_type} • {new Date(playlistFile.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {index === currentIndex && (
                      <div className="text-yt-red">
                        <Play className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
