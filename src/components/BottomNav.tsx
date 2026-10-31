import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSidebar } from '../context/SidebarContext';
import { authStorage } from '../lib/api';
import { useUnreadDms } from '../hooks/useUnreadDms';

const ITEM_CLASS = 'flex-1 flex flex-col items-center justify-center py-1 min-w-[56px] min-h-[48px] transition-colors relative cursor-pointer';

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const { openCreatePostModal, hideBottomNav } = useSidebar();
  const user = authStorage.getUser();
  const unreadDms = useUnreadDms(user?.id);

  if (hideBottomNav) {
    return null;
  }

  const { pathname, search } = location;
  const isMessages = pathname.startsWith('/mensagens') || pathname.startsWith('/grupos');
  const isProfile = pathname.startsWith('/perfil') || pathname.startsWith('/profile') || pathname.startsWith('/u/');
  const tone = (active: boolean) => (active ? 'text-primary font-semibold' : 'text-on-surface-variant hover:text-on-surface');
  const fill = (active: boolean) => (active ? { fontVariationSettings: "'FILL' 1" } : undefined);

  return (
    <nav className="fixed bottom-0 left-0 right-0 w-full z-40 bg-surface-container-lowest/95 backdrop-blur-xl border-t border-outline-variant/30 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] md:hidden pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <div className="flex items-center justify-between h-16 px-1 max-w-md mx-auto">
        {/* 1. Início */}
        <Link
          to="/"
          aria-label="Ir para Início"
          className={`${ITEM_CLASS} ${tone(pathname === '/' && !search.includes('trending'))}`}
        >
          <span className="material-symbols-outlined text-[24px]" style={fill(pathname === '/')}>
            home
          </span>
          <span className="text-[11px] mt-0.5 tracking-tight">Início</span>
        </Link>

        {/* 2. Pesquisa: abre a mesma busca do cabeçalho */}
        <button
          type="button"
          aria-label="Pesquisar"
          onClick={() => window.dispatchEvent(new Event('espectro:open-mobile-search'))}
          className={`${ITEM_CLASS} ${tone(false)}`}
        >
          <span className="material-symbols-outlined text-[24px]">search</span>
          <span className="text-[11px] mt-0.5 tracking-tight">Pesquisar</span>
        </button>

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

        {/* 4. Mensagens */}
        <Link to="/mensagens" aria-label="Ir para Mensagens" className={`${ITEM_CLASS} ${tone(isMessages)}`}>
          <span className="material-symbols-outlined text-[24px]" style={fill(isMessages)}>
            chat_bubble
          </span>
          <span className="text-[11px] mt-0.5 tracking-tight">Mensagens</span>
          {unreadDms > 0 && (
            <span className="absolute top-1 right-2.5 px-1.5 py-0.2 rounded-full bg-secondary-container text-on-secondary-container text-[10px] leading-tight font-bold ring-2 ring-surface-container-lowest">
              {unreadDms}
            </span>
          )}
        </Link>

        {/* 5. Perfil */}
        <Link to="/perfil" aria-label="Ir para Perfil" className={`${ITEM_CLASS} ${tone(isProfile)}`}>
          <span className="material-symbols-outlined text-[24px]" style={fill(isProfile)}>
            account_circle
          </span>
          <span className="text-[11px] mt-0.5 tracking-tight">Perfil</span>
        </Link>
      </div>
    </nav>
  );
};
