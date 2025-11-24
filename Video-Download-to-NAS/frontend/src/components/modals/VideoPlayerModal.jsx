import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Pause, Volume2, VolumeX, Maximize, Minimize, HelpCircle, RotateCcw, RotateCw, List, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

export default function VideoPlayerModal({ isOpen, file, playlist, currentIndex, onClose, setModalState }) {
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
  const controlsTimeoutRef = useRef(null);
  const clickTimeoutRef = useRef(null);

  // Navigation functions
  const goToNext = () => {
    if (playlist && currentIndex < playlist.length - 1) {
      const nextFile = playlist[currentIndex + 1];
      setModalState(prev => ({
        ...prev,
        file: nextFile,
        currentIndex: currentIndex + 1
      }));
    }
  };

  const goToPrevious = () => {
    if (playlist && currentIndex > 0) {
      const prevFile = playlist[currentIndex - 1];
      setModalState(prev => ({
        ...prev,
        file: prevFile,
        currentIndex: currentIndex - 1
      }));
    }
  };

  const playFileAtIndex = (index) => {
    if (playlist && index >= 0 && index < playlist.length) {
      const selectedFile = playlist[index];
      setModalState(prev => ({
        ...prev,
        file: selectedFile,
        currentIndex: index
      }));
      setShowPlaylist(false);
    }
  };

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
  }, [isOpen, onClose]);

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
              onEnded={() => {
                // Auto play next audio if available
                if (playlist && currentIndex < playlist.length - 1) {
                  goToNext();
                }
              }}
            />
          </div>
        ) : (
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
            className="max-w-full max-h-full"
            style={{ cursor: showControls ? 'default' : 'none' }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onWaiting={() => setIsBuffering(true)}
            onCanPlay={() => setIsBuffering(false)}
            onEnded={() => {
              // Auto play next video if available
              if (playlist && currentIndex < playlist.length - 1) {
                goToNext();
              }
            }}
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
          />
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
                {playlist && currentIndex > 0 && (
                  <button
                    onClick={goToPrevious}
                    className="hover:text-yt-red transition-colors"
                    title="Previous video"
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
                {playlist && currentIndex < playlist.length - 1 && (
                  <button
                    onClick={goToNext}
                    className="hover:text-yt-red transition-colors"
                    title="Next video"
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
                {/* Playlist (if available) */}
                {playlist && playlist.length > 1 && (
                  <button
                    onClick={() => setShowPlaylist(!showPlaylist)}
                    className={`hover:text-yt-red transition-colors ${showPlaylist ? 'text-yt-red' : ''}`}
                    title="Show playlist"
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
