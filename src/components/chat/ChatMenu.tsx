import React, { useEffect, useRef, useState } from 'react';

export interface ChatMenuItem {
  key: string;
  label: string;
  icon: string;
  onSelect: () => void;
  badge?: number;
  active?: boolean;
  danger?: boolean;
  hidden?: boolean;
}

interface ChatMenuProps {
  items: ChatMenuItem[];
  title: string;
  buttonClassName?: string;
  align?: 'left' | 'right';
}

// Menu suspenso genérico (usado nas configurações da lista e da conversa)
export const ChatMenu: React.FC<ChatMenuProps> = ({ items, title, buttonClassName, align = 'right' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const totalBadge = items.reduce((sum, item) => sum + (item.badge || 0), 0);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={title}
        aria-label={title}
        aria-haspopup="menu"
        aria-expanded={open}
        className={
          buttonClassName ||
          'relative w-8 h-8 rounded-full flex items-center justify-center bg-surface-container-low text-on-surface hover:bg-surface-container transition-colors cursor-pointer'
        }
      >
        <span className="material-symbols-outlined text-[20px]">more_vert</span>
        {totalBadge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 rounded-full bg-error text-[9px] font-bold text-white flex items-center justify-center">
            {totalBadge > 9 ? '9+' : totalBadge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute top-full mt-1.5 z-50 w-64 py-1.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-xl ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items
            .filter((item) => !item.hidden)
            .map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left transition-colors cursor-pointer hover:bg-surface-container ${
                  item.danger ? 'text-error' : 'text-on-surface'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[18px] ${
                    item.danger ? 'text-error' : item.active ? 'text-primary' : 'text-on-surface-variant'
                  }`}
                >
                  {item.icon}
                </span>
                <span className="flex-1 font-medium">{item.label}</span>
                {item.badge ? (
                  <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-primary-container text-on-primary text-[10px] font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                ) : null}
                {item.active && <span className="material-symbols-outlined text-[16px] text-primary">check</span>}
              </button>
            ))}
        </div>
      )}
    </div>
  );
};
