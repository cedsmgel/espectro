import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { authStorage } from '../lib/api';

interface SidebarNavProps {
  onOpenCreateModal?: () => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({ onOpenCreateModal }) => {
  const location = useLocation();
  const user = authStorage.getUser();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/' && !location.search;
    if (path === '/trending') return location.pathname === '/' && location.search.includes('trending');
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-[72px] bg-surface-container-lowest z-40 hidden md:flex flex-col justify-between py-4 px-2.5 border-r border-outline-variant/30 shadow-[0_1px_6px_rgba(0,0,0,0.02)]">
      <div className="flex flex-col items-center gap-2 w-full">
        {/* Botão Compacto Criar Publicação "+" */}
        <button
          type="button"
          onClick={() => {
            if (onOpenCreateModal) {
              onOpenCreateModal();
            } else {
              const composer = document.getElementById('composer-textarea');
              if (composer) {
                composer.focus();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }
          }}
          aria-label="Criar Publicação"
          className="w-11 h-11 mb-2 flex items-center justify-center rounded-2xl bg-primary-container text-on-primary shadow-sm hover:bg-primary transition-colors group relative cursor-pointer"
        >
          <span className="material-symbols-outlined text-[22px]">edit_square</span>
          <span className="absolute left-full ml-3 px-2 py-1 bg-on-surface text-surface text-xs rounded-md shadow-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
            Criar Publicação
          </span>
        </button>

        {/* Navegação de Ícones */}
        <nav className="flex flex-col items-center gap-1.5 w-full">
          {/* Início */}
          <Link
            to="/"
            title="Início"
            className={`relative flex items-center justify-center w-11 h-11 rounded-xl transition-all group ${
              isActive('/')
                ? 'bg-primary-container text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">dynamic_feed</span>
            <span className="absolute left-full ml-3 px-2 py-1 bg-on-surface text-surface text-xs rounded-md shadow-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              Início
            </span>
          </Link>

          {/* Explorar & Em Alta */}
          <Link
            to="/?filter=trending"
            title="Explorar & Em Alta"
            className={`relative flex items-center justify-center w-11 h-11 rounded-xl transition-all group ${
              isActive('/trending')
                ? 'bg-primary-container text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">trending_up</span>
            <span className="absolute left-full ml-3 px-2 py-1 bg-on-surface text-surface text-xs rounded-md shadow-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              Explorar & Em Alta
            </span>
          </Link>

          {/* Comunidades */}
          <Link
            to="/comunidades"
            title="Comunidades"
            className={`relative flex items-center justify-center w-11 h-11 rounded-xl transition-all group ${
              isActive('/comunidades')
                ? 'bg-primary-container text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">forum</span>
            <span className="absolute left-full ml-3 px-2 py-1 bg-on-surface text-surface text-xs rounded-md shadow-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              Comunidades
            </span>
          </Link>

          {/* Vídeos (Espectro Play) */}
          <Link
            to="/videos"
            title="Vídeos & Clipes"
            className={`relative flex items-center justify-center w-11 h-11 rounded-xl transition-all group ${
              isActive('/videos')
                ? 'bg-primary-container text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">play_circle</span>
            <span className="absolute left-full ml-3 px-2 py-1 bg-on-surface text-surface text-xs rounded-md shadow-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              Vídeos
            </span>
          </Link>

          {/* Mensagens com badge */}
          <Link
            to="/mensagens"
            title="Mensagens"
            className={`relative flex items-center justify-center w-11 h-11 rounded-xl transition-all group ${
              isActive('/mensagens')
                ? 'bg-primary-container text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">chat_bubble</span>
            <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold flex items-center justify-center">
              4
            </span>
            <span className="absolute left-full ml-3 px-2 py-1 bg-on-surface text-surface text-xs rounded-md shadow-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              Mensagens (4)
            </span>
          </Link>

          {/* Notificações */}
          <button
            type="button"
            title="Notificações"
            className="relative flex items-center justify-center w-11 h-11 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all group cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-secondary" />
            <span className="absolute left-full ml-3 px-2 py-1 bg-on-surface text-surface text-xs rounded-md shadow-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              Notificações
            </span>
          </button>

          {/* Salvos */}
          <button
            type="button"
            title="Salvos"
            className="relative flex items-center justify-center w-11 h-11 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all group cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">bookmark</span>
            <span className="absolute left-full ml-3 px-2 py-1 bg-on-surface text-surface text-xs rounded-md shadow-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              Salvos
            </span>
          </button>
        </nav>
      </div>

      {/* Botão Inferior do Perfil / Configurações */}
      <div className="flex flex-col items-center gap-2 pt-3 border-t border-outline-variant/30 w-full">
        {user ? (
          <Link
            to="/perfil"
            title={`@${user.username}`}
            className="relative group p-0.5 rounded-full hover:ring-2 hover:ring-primary transition-all"
          >
            <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-xs uppercase shadow-xs">
              {user.username.charAt(0)}
            </div>
            <span className="absolute left-full ml-3 px-2 py-1 bg-on-surface text-surface text-xs rounded-md shadow-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              @{user.username}
            </span>
          </Link>
        ) : (
          <Link
            to="/login"
            title="Acessar conta"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[22px]">account_circle</span>
          </Link>
        )}
      </div>
    </aside>
  );
};
