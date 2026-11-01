import React, { useEffect, useRef, useState } from 'react';

// Velocidades da reprodução: 1x, 1,5x e 2x (toque no botão para trocar)
const RATES = [1, 1.5, 2];

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Player de mensagem de voz com controle de velocidade
export const AudioMessage: React.FC<{ src: string }> = ({ src }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rateIndex, setRateIndex] = useState(0);
  const rate = RATES[rateIndex];

  // A velocidade é aplicada ao elemento sempre que muda ou o áudio troca
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate, src]);

  // Para a reprodução se a mensagem sair da tela
  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio?.pause();
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  };

  const seek = (value: number) => {
    if (audioRef.current) audioRef.current.currentTime = value;
    setCurrent(value);
  };

  return (
    <div className="flex items-center gap-2 min-w-[210px] max-w-[260px]">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => {
          setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0);
          e.currentTarget.playbackRate = rate;
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pausar áudio' : 'Reproduzir áudio'}
        className="w-9 h-9 rounded-full flex items-center justify-center bg-primary-container text-on-primary shrink-0 cursor-pointer hover:bg-primary transition-colors"
      >
        <span className="material-symbols-outlined text-[22px]">{playing ? 'pause' : 'play_arrow'}</span>
      </button>

      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={current}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Posição do áudio"
          className="w-full h-1 accent-[var(--color-primary,#2563eb)] cursor-pointer"
        />
        <span className="text-[10px] text-on-surface-variant tabular-nums">
          {formatTime(current)} / {formatTime(duration)}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setRateIndex((i) => (i + 1) % RATES.length)}
        aria-label={`Velocidade ${rate}x`}
        title="Mudar velocidade"
        className="shrink-0 min-w-[40px] h-7 px-2 rounded-full text-[11px] font-bold bg-surface-container-high text-on-surface cursor-pointer hover:bg-surface-container-highest transition-colors tabular-nums"
      >
        {rate.toString().replace('.', ',')}x
      </button>
    </div>
  );
};
