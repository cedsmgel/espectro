import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSidebar } from '../context/SidebarContext';
import { authStorage, directMessagesApi } from '../lib/api';

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const { openCreatePostModal, hideBottomNav } = useSidebar();
  const user = authStorage.getUser();
  const [unreadDms, setUnreadDms] = useState(0);

  useEffect(() => {
    if (user?.id) {
      directMessagesApi
        .getUnreadCount()
        .then((res) => setUnreadDms(res.unread_count || 0))
        .catch(() => setUnreadDms(0));
    }
  }, [user?.id, location.pathname]);

  if (hideBottomNav) {
    return null;
  }

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 w-full z-40 bg-surface-container-lowest/95 backdrop-blur-xl border-t border-outline-variant/30 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] md:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-between h-16 px-1 max-w-md mx-auto">
        {/* 1. Início */}
        <Link
          to="/"
          aria-label="Ir para Início"
          className={`flex-1 flex flex-col items-center justify-center py-1 min-w-[56px] min-h-[44px] transition-colors cursor-pointer ${
            isActive('/') && !location.search.includes('trending')
              ? 'text-primary font-semibold'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span
            className="material-symbols-outlined text-[24px]"
            style={isActive('/') ? { fontVariationSettings: "'FILL' 1" } : undefined}
          >
            home
          </span>
          <span className="text-[11px] mt-0.5 tracking-tight">Início</span>
        </Link>

        {/* 2. Comunidades */}
        <Link
          to="/comunidades"
          aria-label="Ir para Comunidades"
          className={`flex-1 flex flex-col items-center justify-center py-1 min-w-[56px] min-h-[44px] transition-colors cursor-pointer ${
            isActive('/comunidades') || isActive('/c/')
              ? 'text-primary font-semibold'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span
            className="material-symbols-outlined text-[24px]"
            style={isActive('/comunidades') ? { fontVariationSettings: "'FILL' 1" } : undefined}
          >
            forum
          </span>
          <span className="text-[11px] mt-0.5 tracking-tight">Comunidades</span>
        </Link>

        {/* 3. Botão Central de Criar (+) */}
        <div className="flex-1 flex items-center justify-center min-w-[56px]">
          <button
            type="button"
            onClick={openCreatePostModal}
            aria-label="Criar nova publicação"
            className="w-12 h-12 rounded-full bg-primary-container text-on-primary flex items-center justify-center shadow-[0_4px_14px_rgba(79,70,229,0.4)] hover:bg-primary transition-all active:scale-95 cursor-pointer -mt-2 border-2 border-surface-container-lowest"
          >
            <span className="material-symbols-outlined text-[28px]">add</span>
          </button>
        </div>

        {/* 4. Vídeos */}
        <Link
          to="/videos"
          aria-label="Ir para Vídeos"
          className={`flex-1 flex flex-col items-center justify-center py-1 min-w-[56px] min-h-[44px] transition-colors cursor-pointer ${
            isActive('/videos')
              ? 'text-primary font-semibold'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span
            className="material-symbols-outlined text-[24px]"
            style={isActive('/videos') ? { fontVariationSettings: "'FILL' 1" } : undefined}
          >
            play_circle
          </span>
          <span className="text-[11px] mt-0.5 tracking-tight">Vídeos</span>
        </Link>

        {/* 5. Mensagens */}
        <Link
          to="/mensagens"
          aria-label="Ir para Mensagens"
          className={`flex-1 flex flex-col items-center justify-center py-1 min-w-[56px] min-h-[44px] transition-colors relative cursor-pointer ${
            isActive('/mensagens')
              ? 'text-primary font-semibold'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span
            className="material-symbols-outlined text-[24px]"
            style={isActive('/mensagens') ? { fontVariationSettings: "'FILL' 1" } : undefined}
          >
            chat_bubble
          </span>
          <span className="text-[11px] mt-0.5 tracking-tight">Mensagens</span>
          {unreadDms > 0 && (
            <span className="absolute top-1 right-2.5 px-1.5 py-0.2 rounded-full bg-secondary-container text-on-secondary-container text-[10px] leading-tight font-bold ring-2 ring-surface-container-lowest">
              {unreadDms}
            </span>
          )}
        </Link>
      </div>
    </nav>
  );
};
