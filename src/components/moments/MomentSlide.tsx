import React from 'react';
import { MomentOverlay } from '../../lib/api';

export const MOMENT_FILTERS: { id: string; label: string; css: string }[] = [
  { id: 'none', label: 'Normal', css: '' },
  { id: 'bw', label: 'P&B', css: 'grayscale(1) contrast(1.1)' },
  { id: 'noir', label: 'Noir', css: 'grayscale(1) contrast(1.5) brightness(0.9)' },
  { id: 'contrast', label: 'Contraste', css: 'contrast(1.35) saturate(0.9)' },
  { id: 'soft', label: 'Suave', css: 'brightness(1.08) contrast(0.92) saturate(0.85)' },
  { id: 'vintage', label: 'Vintage', css: 'sepia(0.45) contrast(1.05) brightness(0.95)' },
];

export const MOMENT_BACKGROUNDS = ['#111111', '#404040', '#1f3a5f', '#5b2a3c', '#2d4a3a', '#f4f4f4'];

export function parseOverlay(raw: string | null | undefined): MomentOverlay {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as MomentOverlay) : {};
  } catch {
    return {};
  }
}

export function overlayFilter(overlay: MomentOverlay): string {
  const preset = MOMENT_FILTERS.find((f) => f.id === overlay.filter)?.css ?? '';
  const parts = [preset];
  if (overlay.brightness && overlay.brightness !== 100) parts.push(`brightness(${overlay.brightness / 100})`);
  if (overlay.contrast && overlay.contrast !== 100) parts.push(`contrast(${overlay.contrast / 100})`);
  return parts.filter(Boolean).join(' ') || 'none';
}

// Texto claro sobre fundo escuro e vice-versa
function textColorFor(bg: string): string {
  const n = parseInt(bg.slice(1), 16);
  const luminance = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return luminance > 150 ? '#111111' : '#ffffff';
}

interface MomentSlideProps {
  mediaUrl: string | null;
  mediaType: 'image' | 'video' | 'text';
  text: string | null;
  bg: string | null;
  overlay: MomentOverlay;
  videoRef?: React.Ref<HTMLVideoElement>;
  muted?: boolean;
  onVideoEnded?: () => void;
  onVideoReady?: (duration: number) => void;
  loopVideo?: boolean;
}

// Um Momentum na tela: foto, vídeo ou texto sobre cor, com filtros e legenda
export const MomentSlide: React.FC<MomentSlideProps> = ({
  mediaUrl,
  mediaType,
  text,
  bg,
  overlay,
  videoRef,
  muted = true,
  onVideoEnded,
  onVideoReady,
  loopVideo,
}) => {
  if (mediaType === 'text') {
    const color = bg || '#111111';
    return (
      <div className="w-full h-full flex items-center justify-center p-8 text-center" style={{ backgroundColor: color, color: textColorFor(color) }}>
        <p className="text-2xl sm:text-3xl font-semibold leading-snug whitespace-pre-wrap break-words max-w-md">{text}</p>
      </div>
    );
  }

  const filter = overlayFilter(overlay);
  const pos = overlay.text_pos || 'bottom';
  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center">
      {mediaType === 'video' ? (
        <video
          ref={videoRef}
          src={mediaUrl || undefined}
          playsInline
          muted={muted}
          loop={loopVideo}
          preload="auto"
          onEnded={onVideoEnded}
          onLoadedMetadata={(e) => onVideoReady?.(e.currentTarget.duration)}
          className="w-full h-full object-contain"
          style={{ filter }}
        />
      ) : (
        <img src={mediaUrl || undefined} alt="" className="w-full h-full object-contain" style={{ filter }} draggable={false} />
      )}
      {text && (
        <div
          className={`absolute inset-x-0 px-6 flex justify-center pointer-events-none ${
            pos === 'top' ? 'top-24' : pos === 'center' ? 'top-1/2 -translate-y-1/2' : 'bottom-28'
          }`}
        >
          <p className="max-w-md text-center text-lg font-semibold text-white bg-black/50 px-4 py-2 rounded-xl whitespace-pre-wrap break-words">{text}</p>
        </div>
      )}
    </div>
  );
};
