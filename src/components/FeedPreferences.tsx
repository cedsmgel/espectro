import React, { useEffect, useRef, useState } from 'react';
import { FeedPrefs } from '../hooks/useFeedPrefs';

interface FeedPreferencesProps {
  prefs: FeedPrefs;
  isCustom: boolean;
  onChange: (patch: Partial<FeedPrefs>) => void;
  onReset: () => void;
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; text: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2 py-3 border-b border-outline-variant">
      <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className={`h-9 px-4 rounded-full border text-xs font-semibold cursor-pointer transition-colors ${
              value === o.id ? 'bg-on-surface text-surface border-on-surface' : 'border-outline-variant text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {o.text}
          </button>
        ))}
      </div>
    </div>
  );
}

// Menu de personalização do feed: ordem, tipo de conteúdo, comunidades e reprodução automática. Fica salvo neste aparelho.
export const FeedPreferences: React.FC<FeedPreferencesProps> = ({ prefs, isCustom, onChange, onReset }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Preferências do feed"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
      >
        <span className="material-symbols-outlined text-[20px]">tune</span>
        {isCustom && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-on-surface" aria-hidden="true" />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Personalizar o feed"
          className="absolute right-0 top-full mt-1 z-40 w-[min(20rem,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto rounded-2xl bg-surface border border-outline-variant p-4 animate-in fade-in zoom-in-95 duration-150 motion-reduce:animate-none"
        >
          <h2 className="text-sm font-bold pb-1">Personalizar o feed</h2>

          <Choice
            label="Ordem"
            value={prefs.sort}
            options={[
              { id: 'recent', text: 'Mais recentes' },
              { id: 'top', text: 'Mais votadas' },
            ]}
            onChange={(sort) => onChange({ sort })}
          />
          <Choice
            label="Mostrar"
            value={prefs.show}
            options={[
              { id: 'all', text: 'Tudo' },
              { id: 'media', text: 'Fotos e vídeos' },
              { id: 'text', text: 'Só texto' },
            ]}
            onChange={(show) => onChange({ show })}
          />
          <Choice
            label="Comunidades"
            value={prefs.communities}
            options={[
              { id: 'all', text: 'Incluir' },
              { id: 'hide', text: 'Ocultar' },
            ]}
            onChange={(communities) => onChange({ communities })}
          />

          <div className="flex items-center justify-between gap-4 py-3 border-b border-outline-variant">
            <div>
              <p className="text-sm font-semibold">Reproduzir vídeos sozinhos</p>
              <p className="text-xs text-on-surface-variant mt-0.5">Sempre sem som. Desligue para tocar só ao toque.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs.autoplay}
              aria-label="Reproduzir vídeos sozinhos"
              onClick={() => onChange({ autoplay: !prefs.autoplay })}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border border-outline-variant transition-colors ${prefs.autoplay ? 'bg-on-surface' : 'bg-transparent'}`}
            >
              <span className={`pointer-events-none absolute top-0.5 left-0.5 h-6 w-6 rounded-full transition-transform ${prefs.autoplay ? 'translate-x-5 bg-surface' : 'translate-x-0 bg-on-surface-variant'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between pt-3">
            <button type="button" onClick={onReset} disabled={!isCustom} className="text-xs font-semibold text-on-surface-variant hover:text-on-surface disabled:opacity-40 cursor-pointer">
              Restaurar padrão
            </button>
            <button type="button" onClick={() => setOpen(false)} className="h-9 px-5 rounded-full bg-primary-container text-on-primary text-xs font-semibold cursor-pointer">
              Pronto
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
