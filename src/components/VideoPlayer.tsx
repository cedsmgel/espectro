import React, { useRef, useState, useEffect } from 'react';

export interface VideoPlayerProps {
  src: string;
  poster?: string;
  title?: string;
  className?: string;
}

const SEEK_STEP = 10;
const SESSION_ACTIONS: MediaSessionAction[] = ['play', 'pause', 'stop', 'seekbackward', 'seekforward', 'seekto'];

// Só um vídeo toca por vez: é ele que aparece na tela de bloqueio e na central de controle
let activeVideo: HTMLVideoElement | null = null;

const updateSessionPosition = (video: HTMLVideoElement) => {
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
  if (!Number.isFinite(video.duration) || video.duration <= 0) return;
  try {
    navigator.mediaSession.setPositionState({
      duration: video.duration,
      playbackRate: video.playbackRate || 1,
      position: Math.min(video.currentTime, video.duration),
    });
  } catch {}
};

const setSessionHandlers = (video: HTMLVideoElement | null) => {
  const seekTo = (time: number) => {
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || time, time));
    updateSessionPosition(video);
  };
  const handlers: Record<string, MediaSessionActionHandler | null> = video
    ? {
        play: () => void video.play().catch(() => {}),
        pause: () => video.pause(),
        stop: () => {
          video.pause();
          seekTo(0);
        },
        seekbackward: (d) => seekTo(video.currentTime - (d.seekOffset || SEEK_STEP)),
        seekforward: (d) => seekTo(video.currentTime + (d.seekOffset || SEEK_STEP)),
        seekto: (d) => {
          if (d.seekTime != null) seekTo(d.seekTime);
        },
      }
    : {};
  // Nem todo navegador aceita todas as ações
  SESSION_ACTIONS.forEach((action) => {
    try {
      navigator.mediaSession.setActionHandler(action, handlers[action] || null);
    } catch {}
  });
};

const claimMediaSession = (video: HTMLVideoElement, title?: string, poster?: string) => {
  if (activeVideo && activeVideo !== video) activeVideo.pause();
  activeVideo = video;
  if (!('mediaSession' in navigator)) return;

  if (typeof MediaMetadata !== 'undefined') {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: title || 'Vídeo no Espectro',
      artist: 'Espectro',
      artwork: poster
        ? [{ src: poster }]
        : [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          ],
    });
  }
  setSessionHandlers(video);
  navigator.mediaSession.playbackState = 'playing';
  updateSessionPosition(video);
};

const releaseMediaSession = (video: HTMLVideoElement) => {
  if (activeVideo !== video) return;
  activeVideo = null;
  if (!('mediaSession' in navigator)) return;
  setSessionHandlers(null);
  navigator.mediaSession.metadata = null;
  navigator.mediaSession.playbackState = 'none';
};

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  poster,
  title,
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);

  // Padrão de dimensionamento X/Twitter, Reddit e Facebook:
  // Landscape 16:9 -> 480x270px; Portrait 9:16 -> 240x360px; Square 1:1 -> 320x320px
  const [containerStyle, setContainerStyle] = useState<{
    aspectRatio: string;
    maxWidth: string;
    maxHeight: string;
  }>({
    aspectRatio: '16 / 9',
    maxWidth: '480px',
    maxHeight: '270px',
  });

  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSeekingRef = useRef(false);
  // No toque, o primeiro tap com os controles escondidos só os revela
  const revealedByTapRef = useRef(false);

  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    const video = videoRef.current;
    if (video && !video.paused && !video.ended) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 2500);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused || videoRef.current.ended) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
    resetControlsTimeout();
  };

  const handleVideoClick = () => {
    if (revealedByTapRef.current) {
      revealedByTapRef.current = false;
      return;
    }
    togglePlay();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    revealedByTapRef.current = e.pointerType !== 'mouse' && isPlaying && !showControls;
    resetControlsTimeout();
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const total = videoRef.current.duration;
      setDuration(Number.isFinite(total) ? total : 0);
      updateSessionPosition(videoRef.current);
      const { videoWidth, videoHeight } = videoRef.current;
      if (videoWidth && videoHeight) {
        const ratio = videoWidth / videoHeight;
        if (ratio >= 1.5) {
          // Horizontal (16:9) estilo X/Twitter e YouTube feed
          setContainerStyle({
            aspectRatio: '16 / 9',
            maxWidth: '480px',
            maxHeight: '270px',
          });
        } else if (ratio <= 0.75) {
          // Vertical (9:16) estilo Reels/Shorts/TikTok
          setContainerStyle({
            aspectRatio: '9 / 16',
            maxWidth: '240px',
            maxHeight: '360px',
          });
        } else if (ratio >= 0.9 && ratio <= 1.1) {
          // Quadrado (1:1) estilo Instagram/Facebook
          setContainerStyle({
            aspectRatio: '1 / 1',
            maxWidth: '320px',
            maxHeight: '320px',
          });
        } else {
          const calcMaxW = ratio > 1 ? '480px' : '300px';
          setContainerStyle({
            aspectRatio: `${videoWidth} / ${videoHeight}`,
            maxWidth: calcMaxW,
            maxHeight: '300px',
          });
        }
      }
    }
  };

  const handlePlay = () => {
    if (videoRef.current) claimMediaSession(videoRef.current, title, poster);
    setIsPlaying(true);
    resetControlsTimeout();
  };

  const handlePause = () => {
    const video = videoRef.current;
    setIsPlaying(false);
    setShowControls(true);
    if (video && activeVideo === video && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'paused';
      updateSessionPosition(video);
    }
  };

  const seekToPointer = (clientX: number) => {
    if (!progressBarRef.current || !videoRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    videoRef.current.currentTime = pos * duration;
    setCurrentTime(pos * duration);
    resetControlsTimeout();
  };

  const handleSeekKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const video = videoRef.current;
    if (!video || !duration) return;
    e.preventDefault();
    const next = video.currentTime + (e.key === 'ArrowLeft' ? -SEEK_STEP : SEEK_STEP);
    video.currentTime = Math.max(0, Math.min(duration, next));
    resetControlsTimeout();
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
    if (nextMuted) {
      videoRef.current.volume = 0;
    } else {
      videoRef.current.volume = volume || 0.8;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      const nextMuted = val === 0;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
    }
  };

  const toggleFullscreen = () => {
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!containerRef.current || !video) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (containerRef.current.requestFullscreen) {
      containerRef.current.requestFullscreen().catch(() => video.webkitEnterFullscreen?.());
    } else {
      // iPhone: só o próprio vídeo entra em tela cheia
      video.webkitEnterFullscreen?.();
    }
  };

  // A origem é definida aqui para que a limpeza consiga soltar o download e o decodificador
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.src = src;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsBuffering(false);
    setShowControls(true);

    return () => {
      releaseMediaSession(video);
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [src]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const controlButton =
    'w-12 h-12 shrink-0 rounded-full hover:bg-white/20 transition-colors flex items-center justify-center cursor-pointer';

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimeout}
      onMouseEnter={() => setShowControls(true)}
      onPointerDown={handlePointerDown}
      style={{
        aspectRatio: containerStyle.aspectRatio,
        maxWidth: containerStyle.maxWidth,
        maxHeight: containerStyle.maxHeight,
      }}
      className={`relative w-full mx-auto overflow-hidden rounded-xl bg-black group select-none shadow-sm border border-outline-variant/30 flex items-center justify-center ${className}`}
    >
      {/* Elemento de Vídeo */}
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        preload="metadata"
        onClick={handleVideoClick}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={handlePlay}
        onPause={handlePause}
        onSeeked={() => videoRef.current && updateSessionPosition(videoRef.current)}
        onRateChange={() => videoRef.current && updateSessionPosition(videoRef.current)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onCanPlay={() => setIsBuffering(false)}
        className={`w-full h-full cursor-pointer ${isFullscreen ? 'object-contain' : 'object-cover'}`}
      />

      {/* Top Header Badge (Estilo X / Reddit / Stitch) */}
      <div
        className={`absolute flex items-center justify-between z-20 pointer-events-none transition-opacity duration-300 ${
          isFullscreen
            ? 'top-[max(0.625rem,env(safe-area-inset-top))] left-[max(0.625rem,env(safe-area-inset-left))] right-[max(0.625rem,env(safe-area-inset-right))]'
            : 'top-2.5 left-2.5 right-2.5'
        } ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded bg-black/65 backdrop-blur-md text-white text-[10px] font-semibold flex items-center gap-1 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
            HD
          </span>
          {title && (
            <span className="px-2 py-0.5 rounded bg-black/50 backdrop-blur-md text-white/90 text-[10px] font-medium truncate max-w-[200px]">
              {title}
            </span>
          )}
        </div>
      </div>

      {/* Spinner de Buffering */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
          <div className="w-10 h-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
        </div>
      )}

      {/* Botão Play / Pause Central Compacto */}
      {(!isPlaying || showControls) && !isBuffering && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pausar vídeo' : 'Reproduzir vídeo'}
          className="absolute z-30 w-14 h-14 rounded-full bg-primary/90 text-on-primary flex items-center justify-center shadow-lg hover:scale-110 hover:bg-primary transition-all duration-200 cursor-pointer backdrop-blur-xs"
        >
          <span className="material-symbols-outlined text-[28px] ml-0.5">
            {isPlaying ? 'pause' : 'play_arrow'}
          </span>
        </button>
      )}

      {/* Barra de Controles Inferior com Gradiente Espectro */}
      <div
        className={`absolute bottom-0 inset-x-0 pt-2 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-20 flex flex-col transition-opacity duration-300 ${
          isFullscreen
            ? 'pl-[max(0.25rem,env(safe-area-inset-left))] pr-[max(0.25rem,env(safe-area-inset-right))] pb-[max(0.25rem,env(safe-area-inset-bottom))]'
            : 'px-1 pb-0.5'
        } ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        {/* Barra de Progresso: fina na tela, com área de toque maior */}
        <div
          ref={progressBarRef}
          role="slider"
          tabIndex={0}
          aria-label="Posição do vídeo"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(currentTime)}
          aria-valuetext={`${formatTime(currentTime)} de ${formatTime(duration)}`}
          onKeyDown={handleSeekKey}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            isSeekingRef.current = true;
            seekToPointer(e.clientX);
          }}
          onPointerMove={(e) => {
            if (isSeekingRef.current) seekToPointer(e.clientX);
          }}
          onPointerUp={() => {
            isSeekingRef.current = false;
          }}
          onPointerCancel={() => {
            isSeekingRef.current = false;
          }}
          className="relative w-[calc(100%-1rem)] mx-2 h-8 cursor-pointer touch-none flex items-center group/progress"
        >
          <div className="w-full h-1 group-hover/progress:h-2 bg-white/20 rounded-full transition-all">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary via-secondary to-tertiary-container relative"
              style={{ width: `${progressPercent}%` }}
            >
              {/* Knob interativo no hover */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-sm scale-0 group-hover/progress:scale-100 transition-transform" />
            </div>
          </div>
        </div>

        {/* Linha de Controles: Botões e Timers */}
        <div className="flex items-center justify-between text-white text-[11px]">
          <div className="flex items-center min-w-0">
            {/* Play/Pause */}
            <button
              type="button"
              onClick={togglePlay}
              className={controlButton}
              aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
              title={isPlaying ? 'Pausar' : 'Reproduzir'}
            >
              <span className="material-symbols-outlined text-[20px]">
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
            </button>

            {/* Mudo / Volume */}
            <div className="flex items-center group/volume">
              <button
                type="button"
                onClick={toggleMute}
                className={controlButton}
                aria-label={isMuted ? 'Ativar som' : 'Desativar som'}
                title={isMuted ? 'Ativar som' : 'Desativar som'}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {isMuted || volume === 0 ? 'volume_off' : volume < 0.5 ? 'volume_down' : 'volume_up'}
                </span>
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                aria-label="Volume"
                className="w-12 h-1 mr-1 bg-white/30 rounded-lg accent-primary cursor-pointer hidden group-hover/volume:block transition-all"
              />
            </div>

            {/* Timestamp */}
            <span className="ml-1 text-[10px] font-medium tracking-wide text-white/80 whitespace-nowrap tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Tela Cheia */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className={controlButton}
            aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          >
            <span className="material-symbols-outlined text-[20px]">
              {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
