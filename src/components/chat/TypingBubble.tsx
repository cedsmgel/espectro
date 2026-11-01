import React from 'react';

// O que a outra pessoa está fazendo agora: digitando (três pontinhos) ou gravando áudio (microfone piscando)
export type ChatActivity = 'typing' | 'recording';

export const activityLabel = (kind: ChatActivity): string => (kind === 'recording' ? 'gravando áudio...' : 'escrevendo...');

interface TypingBubbleProps {
  kind: ChatActivity;
  // Nome de quem está agindo (usado nos grupos)
  name?: string;
  className?: string;
}

export const TypingBubble: React.FC<TypingBubbleProps> = ({ kind, name, className = '' }) => (
  <div className={`flex flex-col items-start gap-0.5 ${className}`} role="status" aria-live="polite">
    {name && <span className="text-[11px] font-bold ml-1 text-on-surface-variant">{name}</span>}
    <div className="w-fit px-4 py-3 rounded-2xl rounded-bl-xs bg-surface-container-low border border-outline-variant flex items-center gap-1.5">
      {kind === 'recording' ? (
        <>
          <span className="material-symbols-outlined text-[18px] text-error animate-pulse" style={{ fontVariationSettings: "'FILL' 1" }}>
            mic
          </span>
          <span className="text-[11px] text-on-surface-variant">gravando áudio</span>
        </>
      ) : (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-on-surface-variant animate-bounce" />
          <span className="w-1.5 h-1.5 rounded-full bg-on-surface-variant animate-bounce [animation-delay:0.15s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-on-surface-variant animate-bounce [animation-delay:0.3s]" />
          <span className="sr-only">escrevendo</span>
        </>
      )}
    </div>
  </div>
);
