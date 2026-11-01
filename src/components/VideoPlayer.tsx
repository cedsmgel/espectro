import React, { useRef, useState, useEffect } from 'react';
import { useMutedPreference } from '../lib/mutePreference';

export interface VideoPlayerProps {
  src: string;
  poster?: string;
  // Usado no controle do sistema (tela de bloqueio) e como legenda quando não há outra
  title?: string;
  // Texto da publicação, mostrado numa linha sobre o vídeo
  caption?: string;
  className?: string;
  autoPlay?: boolean;
}

const SEEK_STEP = 10;
const SESSION_ACTIONS: MediaSessionAction[] = ['play', 'pause', 'stop', 'seekbackward', 'seekforward', 'seekto'];

// Só um vídeo toca por vez: é ele que aparece na tela de bloqueio e na central de controle
let activeVideo: HTMLVideoElement | null = null;

// Autoplay respeita quem pediu menos movimento ou economia de dados
function autoplayAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !connection?.saveData;
}

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

// Vídeo mudo (autoplay) só avisa o outro para parar; o controle do sistema só aparece quando há som
const claimMediaSession = (video: HTMLVideoElement, withSession: boolean, title?: string, poster?: string) => {
  if (activeVideo && activeVideo !== video) activeVideo.pause();
  activeVideo = video;
  if (!withSession || !('mediaSession' in navigator)) return;

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
  caption,
  className = '',
  autoPlay = true,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const { muted, toggleMuted } = useMutedPreference();
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // O botão grande aparece com o vídeo pausado e some sozinho ao tocar
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);

  // O quadro segue a proporção do vídeo, limitada entre 4:5 (vertical) e 1,91:1 (horizontal),
  // como no Instagram e no Reddit: o vídeo inteiro cabe e o que sobra fica preto
  const [aspect, setAspect] = useState(16 / 9);

  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSeekingRef = useRef(false);
  // Se a pessoa pausou, o autoplay não retoma até o vídeo sair da tela e voltar
  const userPausedRef = useRef(false);
  const interactedRef = useRef(false);

  const legend = (caption ?? title ?? '').trim();

  const revealControls = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    const video = videoRef.current;
    if (video && !video.paused && !video.ended) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 2200);
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    interactedRef.current = true;
    if (video.paused || video.ended) {
      userPausedRef.current = false;
      video.muted = mutedRef.current;
      void video.play().catch(() => {});
    } else {
      userPausedRef.current = true;
      video.pause();
    }
    revealControls();
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    updateSessionPosition(video);
    const { videoWidth, videoHeight } = video;
    if (videoWidth && videoHeight) {
      setAspect(Math.min(1.91, Math.max(0.8, videoWidth / videoHeight)));
    }
  };

  const handlePlay = () => {
    const video = videoRef.current;
    if (video) claimMediaSession(video, !mutedRef.current, title || legend, poster);
    setIsPlaying(true);
    // Autoplay não pisca o botão; quando a pessoa toca, ele aparece e some
    if (interactedRef.current) revealControls();
    else setShowControls(false);
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
    const bar = progressBarRef.current;
    const video = videoRef.current;
    if (!bar || !video || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    video.currentTime = pos * duration;
    setProgress(pos);
  };

  const handleSeekKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const video = videoRef.current;
    if (!video || !duration) return;
    e.preventDefault();
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + (e.key === 'ArrowLeft' ? -SEEK_STEP : SEEK_STEP)));
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
    video.muted = mutedRef.current;
    setIsPlaying(false);
    setProgress(0);
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

  // Som: segue a preferência da sessão; ao ligar o som num vídeo tocando, ele assume o controle do sistema
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    if (!muted && !video.paused) claimMediaSession(video, true, title || legend, poster);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted]);

  // Autoplay: toca (mudo) quando mais da metade está na tela e para quando sai
  useEffect(() => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!autoPlay || !container || !video || !autoplayAllowed() || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.intersectionRatio >= 0.6) {
            if (!userPausedRef.current && video.paused) {
              video.muted = mutedRef.current;
              void video.play().catch(() => {});
            }
          } else if (entry.intersectionRatio < 0.35) {
            userPausedRef.current = false;
            if (!video.paused) video.pause();
          }
        }
      },
      { threshold: [0, 0.35, 0.6, 1] }
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [src, autoPlay]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  const bigButtonVisible = !isBuffering && (!isPlaying || showControls);

  return (
    <div
      ref={containerRef}
      onMouseMove={() => {
        interactedRef.current = true;
        revealControls();
      }}
      style={{ aspectRatio: aspect }}
      className={`relative w-full max-h-[min(72vh,560px)] mx-auto overflow-hidden rounded-none bg-black group select-none flex items-center justify-center ${className}`}
    >
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        loop
        muted={muted}
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={(e) => {
          const { currentTime, duration: total } = e.currentTarget;
          if (!isSeekingRef.current && total > 0) setProgress(currentTime / total);
        }}
        onPlay={handlePlay}
        onPause={handlePause}
        onSeeked={() => videoRef.current && updateSessionPosition(videoRef.current)}
        onRateChange={() => videoRef.current && updateSessionPosition(videoRef.current)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onCanPlay={() => setIsBuffering(false)}
        className="w-full h-full object-contain"
      />

      {/* Toque em qualquer ponto do vídeo: pausa ou retoma */}
      <button
        type="button"
        data-tap
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pausar vídeo' : 'Reproduzir vídeo'}
        className="absolute inset-0 w-full h-full cursor-pointer"
      />

      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="w-10 h-10 rounded-full border-4 border-white/30 border-t-white animate-spin" />
        </div>
      )}

      {/* Botão grande de pausa e reprodução: fundo meio transparente */}
      {bigButtonVisible && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pausar vídeo' : 'Reproduzir vídeo'}
          className="absolute inset-0 m-auto z-20 w-16 h-16 rounded-full bg-black/45 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 active:scale-95 transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[38px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            {isPlaying ? 'pause' : 'play_arrow'}
          </span>
        </button>
      )}

      {/* Fileira inferior: legenda, som e tela cheia */}
      <div className="absolute inset-x-0 bottom-0 z-20 pt-10 pb-3 px-3 flex items-center gap-1 bg-gradient-to-t from-black/60 to-transparent text-white pointer-events-none">
        <p className="flex-1 min-w-0 truncate text-xs font-medium pr-2">{legend}</p>
        <button
          type="button"
          onClick={toggleMuted}
          aria-label={muted ? 'Ativar som' : 'Desativar som'}
          className="w-10 h-10 shrink-0 flex items-center justify-center cursor-pointer pointer-events-auto"
        >
          <span className="material-symbols-outlined text-[22px] drop-shadow">{muted ? 'volume_off' : 'volume_up'}</span>
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          className="w-10 h-10 shrink-0 flex items-center justify-center cursor-pointer pointer-events-auto"
        >
          <span className="material-symbols-outlined text-[22px] drop-shadow">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
        </button>
      </div>

      {/* Progresso: uma linha bem fina no pé do vídeo; a área de toque é maior que a linha */}
      <div
        ref={progressBarRef}
        role="slider"
        tabIndex={0}
        aria-label="Posição do vídeo"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(progress * duration)}
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
        className="absolute inset-x-0 bottom-0 z-30 h-3 flex items-end cursor-pointer touch-none group/progress"
      >
        <div className="w-full h-[2px] group-hover/progress:h-1 bg-white/25 transition-[height]">
          <div className="h-full bg-white" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </div>
  );
};
