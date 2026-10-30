import React, { useRef, useState, useEffect } from 'react';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  title?: string;
  className?: string;
}

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

  const controlsTimeoutRef = useRef<any>(null);

  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 2500);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused || videoRef.current.ended) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    resetControlsTimeout();
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 0);
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

  const handleVideoEnded = () => {
    setIsPlaying(false);
    setShowControls(true);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !videoRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    videoRef.current.currentTime = pos * duration;
    setCurrentTime(pos * duration);
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
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(() => {});
    }
  };

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
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimeout}
      onMouseEnter={() => setShowControls(true)}
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
        src={src}
        poster={poster}
        playsInline
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleVideoEnded}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        className="w-full h-full object-cover cursor-pointer"
      />

      {/* Top Header Badge (Estilo X / Reddit / Stitch) */}
      <div
        className={`absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-20 pointer-events-none transition-opacity duration-300 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
        }`}
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
        <div className="absolute inset-0 flex items-center justify-center z-25 pointer-events-none">
          <div className="w-10 h-10 rounded-full border-3 border-primary/30 border-t-primary animate-spin" />
        </div>
      )}

      {/* Botão Play / Pause Central Compacto */}
      {(!isPlaying || showControls) && !isBuffering && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pausar vídeo' : 'Reproduzir vídeo'}
          className="absolute z-20 w-12 h-12 rounded-full bg-primary/90 text-on-primary flex items-center justify-center shadow-lg hover:scale-110 hover:bg-primary transition-all duration-200 cursor-pointer backdrop-blur-xs"
        >
          <span className="material-symbols-outlined text-[28px] ml-0.5">
            {isPlaying ? 'pause' : 'play_arrow'}
          </span>
        </button>
      )}

      {/* Barra de Controles Inferior com Gradiente Espectro */}
      <div
        className={`absolute bottom-0 inset-x-0 pt-6 pb-2 px-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-20 flex flex-col gap-1.5 transition-opacity duration-300 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Barra de Progresso com Gradiente do Espectro Visível */}
        <div
          ref={progressBarRef}
          onClick={handleSeek}
          className="relative w-full h-1 bg-white/20 hover:h-2 rounded-full cursor-pointer transition-all flex items-center group/progress"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary via-secondary to-tertiary-container relative"
            style={{ width: `${progressPercent}%` }}
          >
            {/* Knob interativo no hover */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-sm scale-0 group-hover/progress:scale-100 transition-transform" />
          </div>
        </div>

        {/* Linha de Controles: Botões e Timers */}
        <div className="flex items-center justify-between text-white text-[11px]">
          <div className="flex items-center gap-2">
            {/* Play/Pause */}
            <button
              type="button"
              onClick={togglePlay}
              className="p-1 rounded hover:bg-white/20 transition-colors flex items-center cursor-pointer"
              title={isPlaying ? 'Pausar (Espaço)' : 'Reproduzir (Espaço)'}
            >
              <span className="material-symbols-outlined text-[17px]">
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
            </button>

            {/* Mudo / Volume */}
            <div className="flex items-center gap-1 group/volume">
              <button
                type="button"
                onClick={toggleMute}
                className="p-1 rounded hover:bg-white/20 transition-colors flex items-center cursor-pointer"
                title={isMuted ? 'Ativar som' : 'Desativar som'}
              >
                <span className="material-symbols-outlined text-[17px]">
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
                className="w-12 h-1 bg-white/30 rounded-lg accent-primary cursor-pointer hidden group-hover/volume:block transition-all"
              />
            </div>

            {/* Timestamp */}
            <span className="text-[10px] font-medium tracking-wide text-white/80">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Tela Cheia */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1 rounded hover:bg-white/20 transition-colors flex items-center cursor-pointer"
              title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            >
              <span className="material-symbols-outlined text-[17px]">
                {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
