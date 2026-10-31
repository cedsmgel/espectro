import React from 'react';

interface VoiceRecordingBarProps {
  seconds: number;
  onCancel: () => void;
  onSend: () => void;
}

const BARS = 28;

// Barra de gravação de voz: descartar, espectro animado, tempo e enviar
export const VoiceRecordingBar: React.FC<VoiceRecordingBarProps> = ({ seconds, onCancel, onSend }) => {
  const time = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 bg-surface-container-low rounded-full px-2 py-1.5 border border-outline-variant/30"
    >
      <button
        type="button"
        onClick={onCancel}
        className="w-8 h-8 rounded-full flex items-center justify-center text-error hover:bg-surface-container transition-colors cursor-pointer shrink-0"
        title="Cancelar gravação"
        aria-label="Cancelar gravação"
      >
        <span className="material-symbols-outlined text-[20px]">delete</span>
      </button>

      <span className="flex items-center gap-1.5 text-[11px] font-mono tabular-nums text-on-surface-variant shrink-0">
        <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
        {time}
      </span>

      <div className="flex-1 min-w-0 h-8 flex items-center justify-center gap-[3px] overflow-hidden" aria-hidden="true">
        {Array.from({ length: BARS }, (_, i) => (
          <span
            key={i}
            className="espectro-wave-bar w-[3px] rounded-full bg-primary"
            style={{ animationDelay: `${(i % 7) * 90}ms`, animationDuration: `${700 + (i % 5) * 120}ms` }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onSend}
        className="w-9 h-9 rounded-full flex items-center justify-center bg-primary-container text-on-primary hover:bg-primary transition-colors cursor-pointer shrink-0"
        title="Enviar áudio"
        aria-label="Enviar áudio"
      >
        <span className="material-symbols-outlined text-[20px]">send</span>
      </button>
    </div>
  );
};
