import React, { useEffect, useRef, useState } from 'react';

interface ShareButtonProps {
  url: string;
  title: string;
  text?: string;
  variant?: 'icon' | 'pill';
}

// No celular abre a folha de compartilhar do sistema; no computador copia o link
export const ShareButton: React.FC<ShareButtonProps> = ({ url, title, text, variant = 'icon' }) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number>();

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();

    const canNativeShare = typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches;
    if (canNativeShare) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        // Fechar a folha de compartilhar não é erro
        if ((err as DOMException)?.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copie o link:', url);
      return;
    }
    setCopied(true);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), 2000);
  };

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={handleShare}
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-surface-container text-on-surface hover:bg-surface-container-high text-xs font-semibold cursor-pointer transition-colors"
      >
        <span className="material-symbols-outlined text-[16px]">{copied ? 'check' : 'share'}</span>
        <span>{copied ? 'Link copiado' : 'Compartilhar'}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="p-1.5 rounded-full hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
      title={copied ? 'Link copiado' : 'Compartilhar'}
      aria-label={copied ? 'Link copiado' : 'Compartilhar'}
    >
      <span className={`material-symbols-outlined text-[19px] ${copied ? 'text-primary' : ''}`}>{copied ? 'check' : 'share'}</span>
    </button>
  );
};
