import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authStorage } from '../lib/api';
import { useSidebar } from '../context/SidebarContext';
import { ContactsDrawer } from './ContactsDrawer';
import { CreateCommunityModal } from './CreateCommunityModal';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const navigate = useNavigate();
  const { toggleSidebar } = useSidebar();
  const handleToggle = onToggleSidebar || toggleSidebar;
  const user = authStorage.getUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [showCommunityModal, setShowCommunityModal] = useState(false);

  const handleLogout = () => {
    authStorage.clear();
    setShowDropdown(false);
    navigate('/login');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <>
      {/* 1. HEADER GLOBAL FULL-WIDTH (Visible Spectrum Social) */}
      <header className="fixed top-0 left-0 right-0 w-full h-16 bg-surface-container-lowest border-b border-outline-variant/30 shadow-[0_1px_6px_rgba(0,0,0,0.03)] z-50 px-4 md:px-6">
        <div className="h-full w-full flex items-center justify-between gap-4 max-w-7xl mx-auto">
          {/* Canto Esquerdo: Botão Toggle Hamburger + Logo Oficial Espectro */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleToggle}
              aria-label="Abrir ou fechar menu de navegação"
              className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[24px]">menu</span>
            </button>
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[20px]">grain</span>
              </div>
              <span className="text-xl font-bold text-primary tracking-tight hidden sm:inline-block">
                Espectro
              </span>
            </Link>
          </div>

          {/* Barra de Pesquisa Centralizada */}
          <div className="flex items-center flex-1 max-w-xl mx-auto px-2">
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar no Espectro por posts, tags ou perfis..."
                className="w-full pl-10 pr-4 py-2 rounded-full bg-surface-container-low border border-outline-variant/40 text-on-surface text-sm placeholder:text-on-surface-variant focus:outline-none focus:border-primary-container focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container/20 transition-all"
              />
            </form>
          </div>

          {/* Canto Direito: Ações (+ Criar, Mensagens, Notificações, Perfil) */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {user ? (
              <>
                {/* Botão e Dropdown Criar */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowCreateDropdown((prev) => !prev)}
                    className="hidden md:flex items-center gap-1.5 py-1.5 px-4 rounded-full bg-primary-container text-on-primary font-medium text-sm shadow-xs hover:bg-primary transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    <span>Criar</span>
                    <span className="material-symbols-outlined text-[16px]">expand_more</span>
                  </button>

                  {showCreateDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setShowCreateDropdown(false)}
                      />
                      <div className="absolute right-0 top-10 z-40 w-52 bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/30 py-1.5 flex flex-col animate-in fade-in duration-150">
                        <button
                          type="button"
                          onClick={() => {
                            setShowCreateDropdown(false);
                            const composer = document.getElementById('composer-textarea');
                            if (composer) {
                              composer.focus();
                            } else {
                              navigate('/');
                            }
                          }}
                          className="px-4 py-2 text-xs text-on-surface hover:bg-surface-container flex items-center gap-2.5 cursor-pointer text-left transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px] text-primary">edit_note</span>
                          <div>
                            <p className="font-semibold">Nova Publicação</p>
                            <p className="text-[10px] text-on-surface-variant">Postar no feed ou scrap</p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setShowCreateDropdown(false);
                            setShowCommunityModal(true);
                          }}
                          className="px-4 py-2 text-xs text-on-surface hover:bg-surface-container flex items-center gap-2.5 cursor-pointer text-left transition-colors border-t border-outline-variant/20"
                        >
                          <span className="material-symbols-outlined text-[18px] text-secondary">group_add</span>
                          <div>
                            <p className="font-semibold">Criar Comunidade</p>
                            <p className="text-[10px] text-on-surface-variant">Fundar um novo espaço</p>
                          </div>
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Botão Mensagens com Badge */}
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  aria-label="Abrir mensagens rápidas"
                  className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors relative cursor-pointer"
                  title="Mensagens Diretas"
                >
                  <span className="material-symbols-outlined text-[22px]">chat_bubble</span>
                  <span className="absolute top-1 right-1 px-1.5 py-0.2 rounded-full bg-secondary-container text-on-secondary-container text-[10px] leading-tight font-bold">
                    4
                  </span>
                </button>

                {/* Botão Notificações */}
                <Link
                  to="/notificacoes"
                  aria-label="Ver notificações"
                  className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors relative cursor-pointer"
                  title="Notificações"
                >
                  <span className="material-symbols-outlined text-[22px]">notifications</span>
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-secondary" />
                </Link>

                <div className="h-6 w-px bg-outline-variant/40 mx-0.5 hidden sm:block" />

                {/* Avatar do Usuário com Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowDropdown(!showDropdown)}
                    aria-label={`Perfil de ${user.username}`}
                    className="flex items-center gap-2 p-1 rounded-full hover:bg-surface-container transition-colors cursor-pointer"
                  >
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary font-bold flex items-center justify-center text-sm uppercase shadow-xs">
                        {user.username.charAt(0)}
                      </div>
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-surface-container-lowest" />
                    </div>
                    <span className="hidden lg:inline-block text-sm font-semibold text-on-surface pr-1">
                      {user.username}
                    </span>
                  </button>

                  {/* Dropdown Menu */}
                  {showDropdown && (
                    <div className="absolute right-0 mt-2 w-52 bg-surface-container-lowest rounded-2xl p-2 shadow-lg border border-outline-variant/30 z-50 animate-in fade-in duration-150">
                      <div className="px-3 py-2 border-b border-outline-variant/20 mb-1">
                        <p className="text-xs font-bold text-on-surface">@{user.username}</p>
                        <p className="text-[11px] text-primary font-medium">Karma ▲ 4.892</p>
                      </div>
                      <Link
                        to="/mensagens"
                        onClick={() => setShowDropdown(false)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-on-surface hover:bg-surface-container transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px] text-primary">chat_bubble</span>
                        <span>Direct Mensagens</span>
                      </Link>
                      <Link
                        to="/videos"
                        onClick={() => setShowDropdown(false)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-on-surface hover:bg-surface-container transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px] text-secondary">play_circle</span>
                        <span>Espectro Play</span>
                      </Link>
                      <Link
                        to="/comunidades"
                        onClick={() => setShowDropdown(false)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-on-surface hover:bg-surface-container transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px] text-tertiary">groups</span>
                        <span>Comunidades</span>
                      </Link>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-error hover:bg-error-container/20 transition-colors mt-1 border-t border-outline-variant/20 cursor-pointer text-left"
                      >
                        <span className="material-symbols-outlined text-[18px]">logout</span>
                        <span>Sair</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Deslogado: Botões de Ação Limpos */
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="px-4 py-1.5 rounded-full text-on-surface hover:bg-surface-container font-semibold text-xs transition-colors cursor-pointer"
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/login?tab=cadastro')}
                  className="px-4 py-1.5 rounded-full bg-primary-container text-on-primary hover:bg-primary font-semibold text-xs shadow-xs transition-all cursor-pointer"
                >
                  Cadastrar
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Slide-in Contacts Drawer (Direct rápido) */}
      <ContactsDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Modal Global Criar Comunidade */}
      <CreateCommunityModal
        isOpen={showCommunityModal}
        onClose={() => setShowCommunityModal(false)}
      />
    </>
  );
};
