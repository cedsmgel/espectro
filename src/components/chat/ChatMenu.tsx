import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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

const MENU_WIDTH = 256;
const EDGE = 8;

// Menu suspenso genérico (configurações da lista e da conversa).
// Renderizado em um portal no <body>: assim nenhum balão, rolagem ou camada da tela fica por cima dele.
export const ChatMenu: React.FC<ChatMenuProps> = ({ items, title, buttonClassName, align = 'right' }) => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const width = Math.min(MENU_WIDTH, window.innerWidth - EDGE * 2);
    const preferredLeft = align === 'right' ? rect.right - width : rect.left;
    const left = Math.max(EDGE, Math.min(preferredLeft, window.innerWidth - width - EDGE));
    setPosition({ top: rect.bottom + 6, left });
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const totalBadge = items.reduce((sum, item) => sum + (item.badge || 0), 0);
  const width = typeof window !== 'undefined' ? Math.min(MENU_WIDTH, window.innerWidth - EDGE * 2) : MENU_WIDTH;

  return (
    <>
      <button
        ref={buttonRef}
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

      {open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ position: 'fixed', top: position.top, left: position.left, width }}
            className="z-[70] py-1.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-xl"
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
          </div>,
          document.body
        )}
    </>
  );
};
