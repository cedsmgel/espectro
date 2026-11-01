import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authStorage } from '../lib/api';
import { useUnreadDms } from '../hooks/useUnreadDms';
import { useNotificationCount } from '../hooks/useNotificationCount';
import { useSidebar } from '../context/SidebarContext';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { useTheme } from '../context/ThemeContext';
import { RightSidebarSearch } from './RightSidebarSearch';

interface SidebarNavProps {
  onOpenCreateModal?: () => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({ onOpenCreateModal }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = authStorage.getUser();
  const { isExpanded, toggleSidebar, openCreatePostModal } = useSidebar();
  const isAdmin = useIsAdmin();
  const { isDark, toggleTheme } = useTheme();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const unreadDms = useUnreadDms(user?.id);
  const notificationCount = useNotificationCount(user?.id);

  const handleLogout = () => {
    authStorage.clear();
    setShowUserMenu(false);
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/' && !location.search.includes('filter=trending');
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
    {
      to: '/notificacoes',
      title: 'Notificações',
      icon: 'notifications',
      active: isActive('/notificacoes'),
      badge: notificationCount > 0 ? notificationCount : undefined,
    },
    {
      to: '/mensagens',
      title: 'Mensagens Diretas',
      icon: 'chat_bubble',
      active: isActive('/mensagens'),
      badge: unreadDms > 0 ? unreadDms : undefined,
    },
  ];

  return (
    <>
      {/* Backdrop para Mobile quando aberto como Drawer */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden animate-in fade-in duration-200"
          onClick={toggleSidebar}
        />
      )}

      {/* Espaçador: reserva 80px no fluxo apenas em layouts flex-row (Feed/PostDetail); em flex-col não ocupa altura */}
      <div aria-hidden="true" className="hidden md:block w-20 h-0 shrink-0" />

      {/* Sidebar Principal (Compacta estilo Instagram: w-20 fixa no Desktop com Tooltips Flutuantes no Hover) */}
      <aside
        className={`fixed left-0 top-0 h-screen z-50 md:z-30 flex flex-col justify-between py-4 border-r border-outline-variant bg-surface-container-lowest transition-all duration-300 ease-in-out shrink-0 ${
          isExpanded
            ? 'translate-x-0 w-64 px-3.5 md:w-20 md:px-2'
            : '-translate-x-full md:translate-x-0 w-20 px-2'
        }`}
      >
        <div className="flex flex-col items-center gap-3 w-full">
          {/* Logo Espectro (Ícone no Desktop + Texto apenas no Drawer Mobile) */}
          <div className="flex items-center justify-center w-full mb-1">
            <Link
              to="/"
              className="relative group flex items-center gap-2.5 cursor-pointer"
              aria-label="Página Inicial do Espectro"
            >
              <div className="w-10 h-10 rounded-xl bg-olive flex items-center justify-center text-on-primary font-bold text-base shadow-xs group-hover:scale-105 transition-transform shrink-0">
                E
              </div>
              {isExpanded && (
                <span className="text-xl font-bold text-on-surface tracking-tight animate-in fade-in duration-200 md:hidden">
                  Espectro
                </span>
              )}
              {/* Etiqueta Flutuante / Tooltip estilo Instagram */}
              <span
                role="tooltip"
                className="hidden md:block absolute left-full ml-4 top-1/2 -translate-y-1/2 bg-transparent text-on-surface text-xl font-bold tracking-tight pointer-events-none whitespace-nowrap z-50 opacity-0 -translate-x-1.5 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 ease-out"
              >
                Início
              </span>
            </Link>
          </div>

          {/* Botão Criar Publicação */}
          <button
            type="button"
            onClick={() => {
              if (onOpenCreateModal) {
                onOpenCreateModal();
              } else {
                openCreatePostModal();
              }
            }}
            aria-label="Criar Publicação"
            className={`flex items-center rounded-2xl border-2 border-on-surface text-on-surface bg-transparent hover:bg-surface-container active:bg-on-surface active:text-surface transition-all duration-200 group relative cursor-pointer my-1 ${
              isExpanded
                ? 'w-full h-11 px-3.5 justify-start gap-3 md:w-11 md:h-11 md:px-0 md:justify-center'
                : 'w-11 h-11 justify-center'
            }`}
          >
            <span className="material-symbols-outlined text-[22px] shrink-0">
              edit_square
            </span>
            {isExpanded && (
              <span className="text-sm font-semibold truncate animate-in fade-in duration-200 md:hidden">
                Criar Publicação
              </span>
            )}
            {/* Etiqueta Flutuante / Tooltip estilo Instagram */}
            <span
              role="tooltip"
              className="hidden md:block absolute left-full ml-4 top-1/2 -translate-y-1/2 bg-transparent text-on-surface text-xl font-bold tracking-tight pointer-events-none whitespace-nowrap z-50 opacity-0 -translate-x-1.5 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 ease-out"
            >
              Criar Publicação
            </span>
          </button>

          {/* Itens de Navegação */}
          <nav className="flex flex-col items-center gap-1.5 w-full">
            {/* Botão de Pesquisa Integrado */}
            <button
              type="button"
              onClick={() => setShowSearch((prev) => !prev)}
              aria-label="Pesquisar"
              className={`flex items-center rounded-xl transition-all duration-200 group relative cursor-pointer ${
                isExpanded
                  ? 'w-full h-11 px-3.5 justify-start gap-3.5 md:w-11 md:h-11 md:px-0 md:justify-center'
                  : 'w-11 h-11 justify-center'
              } ${
                showSearch
                  ? 'bg-surface-container text-on-surface font-semibold'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
            >
              <div className="relative flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[22px]">search</span>
              </div>
              {isExpanded && (
                <span className="text-sm font-medium truncate animate-in fade-in duration-200 md:hidden">
                  Pesquisar
                </span>
              )}
              <span
                role="tooltip"
                className="hidden md:block absolute left-full ml-4 top-1/2 -translate-y-1/2 bg-transparent text-on-surface text-xl font-bold tracking-tight pointer-events-none whitespace-nowrap z-50 opacity-0 -translate-x-1.5 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 ease-out"
              >
                Pesquisa
              </span>
            </button>

            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => {
                  if (isExpanded) toggleSidebar();
                }}
                aria-label={item.title}
                className={`flex items-center rounded-xl transition-all duration-200 group relative cursor-pointer ${
                  isExpanded
                    ? 'w-full h-11 px-3.5 justify-start gap-3.5 md:w-11 md:h-11 md:px-0 md:justify-center'
                    : 'w-11 h-11 justify-center'
                } ${
                  item.active
                    ? 'bg-surface-container text-on-surface font-semibold'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <div className="relative flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">
                    {item.icon}
                  </span>
                  {item.badge !== undefined && (
                    <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-secondary-container text-on-secondary-container text-[10px] leading-tight font-bold">
                      {item.badge}
                    </span>
                  )}
                </div>

                {isExpanded && (
                  <span className="text-sm font-medium truncate animate-in fade-in duration-200 md:hidden">
                    {item.title}
                  </span>
                )}

                {/* Etiqueta Flutuante / Tooltip estilo Instagram */}
                <span
                  role="tooltip"
                  className="hidden md:block absolute left-full ml-4 top-1/2 -translate-y-1/2 bg-transparent text-on-surface text-xl font-bold tracking-tight pointer-events-none whitespace-nowrap z-50 opacity-0 -translate-x-1.5 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 ease-out"
                >
                  {item.title}
                </span>
              </Link>
            ))}
          </nav>
        </div>

        {/* Rodapé: Perfil / Menu do Usuário */}
        <div className="relative flex flex-col items-center gap-2 pt-3 border-t border-outline-variant w-full">
          {user ? (
            <>
              <button
                type="button"
                onClick={() => setShowUserMenu((prev) => !prev)}
                aria-label={`Menu de @${user.username}`}
                className={`flex items-center rounded-xl p-1.5 transition-all duration-200 group relative cursor-pointer ${
                  isExpanded
                    ? 'w-full px-3 py-2 justify-between hover:bg-surface-container md:w-11 md:h-11 md:p-0 md:justify-center md:hover:ring-2 md:hover:ring-primary'
                    : 'w-11 h-11 justify-center hover:ring-2 hover:ring-primary'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-xs uppercase shadow-xs shrink-0">
                    {user.username.charAt(0)}
                  </div>
                  {isExpanded && (
                    <div className="flex flex-col min-w-0 text-left animate-in fade-in duration-200 md:hidden">
                      <span className="text-xs font-bold text-on-surface truncate">
                        @{user.username}
                      </span>
                      <span className="text-[10px] text-on-surface-variant truncate">
                        Minha Conta
                      </span>
                    </div>
                  )}
                </div>

                {isExpanded && (
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant md:hidden">
                    {showUserMenu ? 'expand_more' : 'unfold_more'}
                  </span>
                )}

                {/* Etiqueta Flutuante / Tooltip estilo Instagram */}
                <span
                  role="tooltip"
                  className="hidden md:block absolute left-full ml-4 top-1/2 -translate-y-1/2 bg-transparent text-on-surface text-xl font-bold tracking-tight pointer-events-none whitespace-nowrap z-50 opacity-0 -translate-x-1.5 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 ease-out"
                >
                  @{user.username}
                </span>
              </button>

              {/* Dropdown do Sub Menu - Flutua ao lado no Desktop */}
              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div
                    className="absolute bottom-16 left-3 md:left-full md:ml-3.5 md:bottom-2 z-50 w-56 bg-surface-container-lowest rounded-2xl p-2 shadow-2xl border border-outline-variant flex flex-col animate-in fade-in slide-in-from-bottom-2"
                  >
                    <div className="px-3 py-2 border-b border-outline-variant mb-1">
                      <p className="text-xs font-bold text-on-surface">@{user.username}</p>
                      <p className="text-[10px] text-on-surface-variant">Conectado ao Espectro</p>
                    </div>

                    <Link
                      to="/perfil"
                      onClick={() => setShowUserMenu(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-on-surface hover:bg-surface-container transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px] text-primary">person</span>
                      <span>Meu Perfil</span>
                    </Link>

                    <Link
                      to="/settings/profile"
                      onClick={() => setShowUserMenu(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-on-surface hover:bg-surface-container transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px] text-secondary">manage_accounts</span>
                      <span>Configurações do Perfil</span>
                    </Link>

                    <Link
                      to="/settings/account"
                      onClick={() => setShowUserMenu(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-on-surface hover:bg-surface-container transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px] text-tertiary">shield</span>
                      <span>Privacidade & Conta</span>
                    </Link>

                    {isAdmin && (
                      <Link
                        to="/admin"
                        onClick={() => setShowUserMenu(false)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-on-surface hover:bg-surface-container transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px] text-error">gavel</span>
                        <span>Moderação</span>
                      </Link>
                    )}

                    {/* Alternar Tema Light / Dark */}
                    <button
                      type="button"
                      onClick={toggleTheme}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-on-surface hover:bg-surface-container transition-colors cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-[18px] text-primary">
                          {isDark ? 'light_mode' : 'dark_mode'}
                        </span>
                        <span>Tema</span>
                      </div>
                      <span className="text-[11px] font-semibold text-on-surface-variant">
                        {isDark ? 'Escuro' : 'Claro'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-error hover:bg-error-container/20 transition-colors mt-1 border-t border-outline-variant cursor-pointer text-left"
                    >
                      <span className="material-symbols-outlined text-[18px]">logout</span>
                      <span>Sair</span>
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <Link
              to="/login"
              aria-label="Acessar conta"
              className={`flex items-center rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors group relative cursor-pointer ${
                isExpanded
                  ? 'w-full h-11 px-3.5 justify-start gap-3 md:w-11 md:h-11 md:px-0 md:justify-center'
                  : 'w-11 h-11 justify-center'
              }`}
            >
              <span className="material-symbols-outlined text-[22px] shrink-0">
                account_circle
              </span>
              {isExpanded && (
                <span className="text-sm font-semibold truncate animate-in fade-in duration-200 md:hidden">
                  Entrar no Espectro
                </span>
              )}
              {/* Etiqueta Flutuante / Tooltip estilo Instagram */}
              <span
                role="tooltip"
                className="hidden md:block absolute left-full ml-4 top-1/2 -translate-y-1/2 bg-transparent text-on-surface text-xl font-bold tracking-tight pointer-events-none whitespace-nowrap z-50 opacity-0 -translate-x-1.5 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 ease-out"
              >
                Entrar
              </span>
            </Link>
          )}
        </div>
      </aside>

      {/* Drawer Lateral de Pesquisa (Instagram Style) */}
      {showSearch && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
            onClick={() => setShowSearch(false)}
          />
          <aside className="fixed left-0 md:left-20 top-0 h-screen w-full sm:w-80 bg-surface-container-lowest border-r border-outline-variant shadow-2xl z-50 p-4 flex flex-col gap-4 overflow-y-auto animate-in fade-in slide-in-from-left-4 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant">
              <h2 className="text-base font-bold text-on-surface">Pesquisa no Espectro</h2>
              <button
                type="button"
                onClick={() => setShowSearch(false)}
                className="p-1 rounded-full text-on-surface-variant hover:bg-surface-container cursor-pointer"
                aria-label="Fechar pesquisa"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <RightSidebarSearch />
          </aside>
        </>
      )}
    </>
  );
};
