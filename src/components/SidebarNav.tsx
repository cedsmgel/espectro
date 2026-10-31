import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authStorage, directMessagesApi } from '../lib/api';
import { useSidebar } from '../context/SidebarContext';
import { useTheme } from '../context/ThemeContext';

interface SidebarNavProps {
  onOpenCreateModal?: () => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({ onOpenCreateModal }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = authStorage.getUser();
  const { isExpanded, toggleSidebar, openCreatePostModal } = useSidebar();
  const { isDark, toggleTheme } = useTheme();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [unreadDms, setUnreadDms] = useState(0);

  useEffect(() => {
    if (user?.id) {
      directMessagesApi
        .getUnreadCount()
        .then((res) => setUnreadDms(res.unread_count || 0))
        .catch(() => setUnreadDms(0));
    }
  }, [user?.id]);

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
      to: '/',
      title: 'Início',
      icon: 'home',
      active: isActive('/'),
    },
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

      {/* Sidebar Principal (Tarefa 2: sticky top-0 h-screen, largura fixa w-20 ou w-64, fluxo real) */}
      <aside
        className={`fixed md:sticky top-0 h-screen z-50 md:z-30 flex flex-col justify-between py-4 border-r border-outline-variant/30 shadow-[0_1px_6px_rgba(0,0,0,0.02)] bg-surface-container-lowest transition-all duration-300 ease-in-out shrink-0 ${
          isExpanded
            ? 'translate-x-0 w-64 px-3.5'
            : '-translate-x-full md:translate-x-0 w-20 px-2'
        }`}
      >
        <div className="flex flex-col items-center gap-3 w-full">
          {/* Logo Espectro + Botão de Colapsar/Expandir */}
          <div className={`flex items-center w-full mb-1 ${isExpanded ? 'justify-between px-1' : 'justify-center'}`}>
            <Link
              to="/"
              className="flex items-center gap-2.5 group"
              title="Espectro Início"
            >
              <div className="w-9 h-9 rounded-xl bg-olive flex items-center justify-center text-white font-bold text-base shadow-xs group-hover:scale-105 transition-transform shrink-0">
                E
              </div>
              {isExpanded && (
                <span className="text-xl font-bold text-on-surface tracking-tight animate-in fade-in duration-200">
                  Espectro
                </span>
              )}
            </Link>

            {/* Botão de Toggle da Barra Lateral no Desktop */}
            <button
              type="button"
              onClick={toggleSidebar}
              className={`p-1.5 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer hidden md:flex ${
                !isExpanded && 'hidden'
              }`}
              title="Recolher menu lateral"
              aria-label="Recolher menu lateral"
            >
              <span className="material-symbols-outlined text-[20px]">first_page</span>
            </button>
          </div>

          {/* Botão de Expandir quando colapsado */}
          {!isExpanded && (
            <button
              type="button"
              onClick={toggleSidebar}
              className="hidden md:flex p-1.5 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
              title="Expandir menu lateral"
              aria-label="Expandir menu lateral"
            >
              <span className="material-symbols-outlined text-[20px]">last_page</span>
            </button>
          )}

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
            className={`flex items-center rounded-2xl bg-primary-container text-on-primary shadow-sm hover:bg-primary transition-all duration-200 group relative cursor-pointer my-1 ${
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

          {/* Itens de Navegação */}
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

        {/* Rodapé: Perfil / Menu do Usuário */}
        <div className="relative flex flex-col items-center gap-2 pt-3 border-t border-outline-variant/30 w-full">
          {user ? (
            <>
              <button
                type="button"
                onClick={() => setShowUserMenu((prev) => !prev)}
                aria-label={`Menu de ${user.username}`}
                title={`@${user.username}`}
                className={`flex items-center rounded-xl p-1.5 transition-all duration-200 group cursor-pointer ${
                  isExpanded
                    ? 'w-full px-3 py-2 justify-between hover:bg-surface-container'
                    : 'w-11 h-11 justify-center hover:ring-2 hover:ring-primary'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-xs uppercase shadow-xs shrink-0">
                    {user.username.charAt(0)}
                  </div>
                  {isExpanded && (
                    <div className="flex flex-col min-w-0 text-left animate-in fade-in duration-200">
                      <span className="text-xs font-bold text-on-surface truncate">
                        @{user.username}
                      </span>
                      <span className="text-[10px] text-on-surface-variant truncate">
                        Minha Conta
                      </span>
                    </div>
                  )}
                </div>

                {isExpanded ? (
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                    {showUserMenu ? 'expand_more' : 'unfold_more'}
                  </span>
                ) : (
                  <span className="absolute left-full ml-3 px-2.5 py-1 bg-on-surface text-surface text-xs rounded-md shadow-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                    @{user.username}
                  </span>
                )}
              </button>

              {/* Dropdown do Sub Menu */}
              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div
                    className={`absolute bottom-16 z-50 w-56 bg-surface-container-lowest rounded-2xl p-2 shadow-2xl border border-outline-variant/30 flex flex-col animate-in fade-in slide-in-from-bottom-2 ${
                      isExpanded ? 'left-2' : 'left-3'
                    }`}
                  >
                    <div className="px-3 py-2 border-b border-outline-variant/20 mb-1">
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
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-error hover:bg-error-container/20 transition-colors mt-1 border-t border-outline-variant/20 cursor-pointer text-left"
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
    </>
  );
};
