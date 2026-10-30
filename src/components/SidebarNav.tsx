import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { authStorage } from '../lib/api';
import { useSidebar } from '../context/SidebarContext';

interface SidebarNavProps {
  onOpenCreateModal?: () => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({ onOpenCreateModal }) => {
  const location = useLocation();
  const user = authStorage.getUser();
  const { isExpanded } = useSidebar();

  const isActive = (path: string) => {
    if (path === '/trending') return location.pathname === '/' && location.search.includes('trending');
    return location.pathname.startsWith(path);
  };

  const navItems = [
    {
      to: '/?filter=trending',
      title: 'Explorar & Em Alta',
      icon: 'trending_up',
      active: isActive('/trending'),
    },
    {
      to: '/comunidades',
      title: 'Comunidades',
      icon: 'forum',
      active: isActive('/comunidades'),
    },
    {
      to: '/videos',
      title: 'Vídeos & Clipes',
      icon: 'play_circle',
      active: isActive('/videos'),
    },
  ];

  return (
    <aside
      className={`fixed left-0 top-16 bottom-0 z-40 hidden md:flex flex-col justify-between py-4 border-r border-outline-variant/30 shadow-[0_1px_6px_rgba(0,0,0,0.02)] bg-surface-container-lowest transition-all duration-300 ease-in-out ${
        isExpanded ? 'w-64 px-3.5' : 'w-[72px] px-2.5'
      }`}
    >
      <div className="flex flex-col items-center gap-3 w-full">
        {/* Botão Criar Publicação */}
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
          className={`flex items-center rounded-2xl bg-primary-container text-on-primary shadow-sm hover:bg-primary transition-all duration-300 group relative cursor-pointer ${
            isExpanded
              ? 'w-full h-11 px-3.5 justify-start gap-3'
              : 'w-11 h-11 justify-center'
          }`}
        >
          <span className="material-symbols-outlined text-[22px] shrink-0">
            edit_square
          </span>
          {isExpanded ? (
            <span className="text-sm font-semibold truncate animate-in fade-in duration-200">
              Criar Publicação
            </span>
          ) : (
            <span className="absolute left-full ml-3 px-2.5 py-1 bg-on-surface text-surface text-xs rounded-md shadow-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              Criar Publicação
            </span>
          )}
        </button>

        {/* Navegação de Itens: Explorar, Comunidades e Vídeos */}
        <nav className="flex flex-col items-center gap-1.5 w-full">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              title={item.title}
              className={`flex items-center rounded-xl transition-all duration-200 group relative ${
                isExpanded
                  ? 'w-full h-11 px-3.5 justify-start gap-3.5'
                  : 'w-11 h-11 justify-center'
              } ${
                item.active
                  ? 'bg-primary-container text-on-primary shadow-xs font-semibold'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[22px] shrink-0">
                {item.icon}
              </span>

              {isExpanded ? (
                <span className="text-sm font-medium truncate animate-in fade-in duration-200">
                  {item.title}
                </span>
              ) : (
                <span className="absolute left-full ml-3 px-2.5 py-1 bg-on-surface text-surface text-xs rounded-md shadow-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                  {item.title}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </div>

      {/* Botão Inferior do Perfil / Conta */}
      <div className="flex flex-col items-center gap-2 pt-3 border-t border-outline-variant/30 w-full">
        {user ? (
          <Link
            to="/perfil"
            title={`@${user.username}`}
            className={`flex items-center rounded-xl p-1.5 transition-all duration-200 group ${
              isExpanded
                ? 'w-full px-3 py-2 justify-start gap-3 hover:bg-surface-container'
                : 'w-11 h-11 justify-center hover:ring-2 hover:ring-primary'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-xs uppercase shadow-xs shrink-0">
              {user.username.charAt(0)}
            </div>
            {isExpanded ? (
              <div className="flex flex-col min-w-0 text-left animate-in fade-in duration-200">
                <span className="text-xs font-bold text-on-surface truncate">
                  @{user.username}
                </span>
                <span className="text-[10px] text-on-surface-variant truncate">
                  Meu Perfil
                </span>
              </div>
            ) : (
              <span className="absolute left-full ml-3 px-2.5 py-1 bg-on-surface text-surface text-xs rounded-md shadow-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                @{user.username}
              </span>
            )}
          </Link>
        ) : (
          <Link
            to="/login"
            title="Acessar conta"
            className={`flex items-center rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors ${
              isExpanded
                ? 'w-full h-11 px-3.5 justify-start gap-3'
                : 'w-11 h-11 justify-center'
            }`}
          >
            <span className="material-symbols-outlined text-[22px] shrink-0">
              account_circle
            </span>
            {isExpanded && (
              <span className="text-sm font-semibold truncate animate-in fade-in duration-200">
                Entrar no Espectro
              </span>
            )}
          </Link>
        )}
      </div>
    </aside>
  );
};
