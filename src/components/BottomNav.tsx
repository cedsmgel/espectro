import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSidebar } from '../context/SidebarContext';
import { authStorage } from '../lib/api';
import { useUnreadDms } from '../hooks/useUnreadDms';
import { useNotificationCount } from '../hooks/useNotificationCount';
import { useMyAvatar } from '../hooks/useMyAvatar';

const ITEM_CLASS = 'flex-1 flex flex-col items-center justify-center py-1 min-w-[56px] min-h-[48px] transition-colors relative cursor-pointer';

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const { openCreatePostModal, hideBottomNav } = useSidebar();
  const user = authStorage.getUser();
  const unreadDms = useUnreadDms(user?.id);
  const myAvatar = useMyAvatar();
  const notificationCount = useNotificationCount(user?.id);

  if (hideBottomNav) {
    return null;
  }

  const { pathname, search } = location;
  const isMessages = pathname.startsWith('/mensagens') || pathname.startsWith('/grupos');
  const isNotifications = pathname.startsWith('/notificacoes') || pathname.startsWith('/notifications');
  const isProfile = pathname.startsWith('/perfil') || pathname.startsWith('/profile') || pathname.startsWith('/u/');
  const tone = (active: boolean) => (active ? 'text-primary font-semibold' : 'text-on-surface-variant hover:text-on-surface');
  const fill = (active: boolean) => (active ? { fontVariationSettings: "'FILL' 1" } : undefined);

  return (
    <nav className="fixed bottom-0 left-0 right-0 w-full z-40 bg-surface-container-lowest/95 backdrop-blur-xl border-t border-outline-variant md:hidden pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <div className="flex items-center justify-between h-14 px-1 max-w-md mx-auto">
        {/* 1. Início */}
        <Link
          to="/"
          aria-label="Ir para Início"
          className={`${ITEM_CLASS} ${tone(pathname === '/' && !search.includes('trending'))}`}
        >
          <span className="material-symbols-outlined text-[30px]" style={fill(pathname === '/')}>
            home
          </span>
        </Link>

        {/* 2. Notificações (a pesquisa fica no cabeçalho) */}
        <Link to="/notificacoes" aria-label="Ver notificações" className={`${ITEM_CLASS} ${tone(isNotifications)}`}>
          <span className="material-symbols-outlined text-[30px]" style={fill(isNotifications)}>
            notifications
          </span>
          {notificationCount > 0 && (
            <span className="absolute top-1 right-2.5 px-1.5 py-0.2 rounded-full bg-error text-white text-[10px] leading-tight font-bold ring-2 ring-surface-container-lowest">
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
        </Link>

        {/* 3. Botão Central de Criar (+) */}
        <div className="flex-1 flex items-center justify-center min-w-[56px]">
          <button
            type="button"
            onClick={openCreatePostModal}
            aria-label="Criar nova publicação"
            className="w-12 h-12 rounded-full bg-primary-container text-on-primary flex items-center justify-center hover:bg-primary transition-all active:scale-95 cursor-pointer -mt-2 border-2 border-surface-container-lowest"
          >
            <span className="material-symbols-outlined text-[28px]">add</span>
          </button>
        </div>

        {/* 4. Mensagens */}
        <Link to="/mensagens" aria-label="Ir para Mensagens" className={`${ITEM_CLASS} ${tone(isMessages)}`}>
          <span className="material-symbols-outlined text-[30px]" style={fill(isMessages)}>
            chat_bubble
          </span>
          {unreadDms > 0 && (
            <span className="absolute top-1 right-2.5 px-1.5 py-0.2 rounded-full bg-secondary-container text-on-secondary-container text-[10px] leading-tight font-bold ring-2 ring-surface-container-lowest">
              {unreadDms}
            </span>
          )}
        </Link>

        {/* 5. Perfil */}
        <Link to="/perfil" aria-label="Ir para Perfil" className={`${ITEM_CLASS} ${tone(isProfile)}`}>
          {myAvatar ? (
            <img
              src={myAvatar}
              alt=""
              className={`w-8 h-8 rounded-full object-cover ${isProfile ? 'ring-2 ring-on-surface ring-offset-2 ring-offset-surface-container-lowest' : ''}`}
            />
          ) : user ? (
            <span
              className={`w-8 h-8 rounded-full bg-primary-container text-on-primary text-sm font-bold uppercase flex items-center justify-center ${
                isProfile ? 'ring-2 ring-on-surface ring-offset-2 ring-offset-surface-container-lowest' : ''
              }`}
            >
              {user.username.charAt(0)}
            </span>
          ) : (
            <span className="material-symbols-outlined text-[30px]" style={fill(isProfile)}>
              account_circle
            </span>
          )}
        </Link>
      </div>
    </nav>
  );
};
