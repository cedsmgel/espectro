import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authStorage, directMessagesApi, searchApi, SearchResults } from '../lib/api';
import { useSidebar } from '../context/SidebarContext';
import { parseScrap } from '../lib/scrapStyle';
import { useTheme } from '../context/ThemeContext';
import { ContactsDrawer } from './ContactsDrawer';
import { CreateCommunityModal } from './CreateCommunityModal';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const navigate = useNavigate();
  const { toggleSidebar, openCreatePostModal } = useSidebar();
  const { isDark, toggleTheme } = useTheme();
  const handleToggle = onToggleSidebar || toggleSidebar;
  const user = authStorage.getUser();
  const userId = user?.id;
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [showCommunityModal, setShowCommunityModal] = useState(false);
  const [unreadDms, setUnreadDms] = useState(0);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  useEffect(() => {
    if (userId) {
      directMessagesApi
        .getUnreadCount()
        .then((res) => setUnreadDms(res.unread_count || 0))
        .catch(() => setUnreadDms(0));
    }
  }, [userId]);

  // Debounce de 300ms na pesquisa global para não sobrecarregar o D1
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchApi.search(trimmed);
        setSearchResults(results);
        setShowSearchResults(true);
      } catch (err) {
        console.error('Erro na pesquisa global:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fecha dropdown ao clicar fora ou apertar Esc
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowSearchResults(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowSearchResults(false);
      navigate(`/?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <>
      {/* 1. HEADER GLOBAL FULL-WIDTH (Visible Spectrum Social) */}
      <header className="fixed top-0 left-0 right-0 w-full h-16 bg-surface-container-lowest border-b border-outline-variant/30 shadow-[0_1px_6px_rgba(0,0,0,0.03)] z-50 px-3 sm:px-6">
        <div className="h-full w-full flex items-center justify-between gap-2 sm:gap-4 max-w-7xl mx-auto">
          {/* Canto Esquerdo: Botão Toggle Hamburger (Desktop) + Logo Oficial Espectro */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={handleToggle}
              aria-label="Abrir ou fechar menu de navegação"
              className="hidden md:flex p-2 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[24px]">menu</span>
            </button>
            <Link to="/" className="flex items-center gap-2 sm:gap-2.5 group">
              <div className="w-8 h-8 rounded-xl bg-olive flex items-center justify-center text-white font-bold text-sm shadow-xs group-hover:scale-105 transition-transform">
                E
              </div>
              <span className="text-lg sm:text-xl font-bold text-on-surface tracking-tight">
                Espectro
              </span>
            </Link>
          </div>

          {/* Barra de Pesquisa Centralizada com Dropdown de Resultados Globais (Desktop: md:flex) */}
          <div ref={searchContainerRef} className="hidden md:flex relative items-center flex-1 max-w-xl mx-auto px-2">
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onFocus={() => {
                  if (searchQuery.trim()) setShowSearchResults(true);
                }}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar no Espectro por posts, tags ou perfis..."
                className="w-full pl-10 pr-9 py-2 rounded-full bg-surface-container-low border border-outline-variant/40 text-on-surface text-sm placeholder:text-on-surface-variant focus:outline-none focus:border-primary-container focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container/20 transition-all"
              />
              {isSearching ? (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults(null);
                    setShowSearchResults(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface cursor-pointer p-0.5 rounded-full"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              ) : null}
            </form>

            {/* Dropdown com Resultados Agrupados: Pessoas, Comunidades e Posts */}
            {showSearchResults && searchQuery.trim().length > 0 && (
              <div className="absolute top-full left-2 right-2 mt-2 bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/30 overflow-hidden z-50 max-h-[75vh] overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
                {isSearching && !searchResults && (
                  <div className="p-6 text-center text-xs text-on-surface-variant flex flex-col items-center gap-2">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span>Buscando no Espectro...</span>
                  </div>
                )}

                {searchResults && (
                  <>
                    {/* 1. Grupo: Pessoas */}
                    {searchResults.users.length > 0 && (
                      <div className="p-2 border-b border-outline-variant/20">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                          <span className="material-symbols-outlined text-[16px]">person</span>
                          <span>Pessoas ({searchResults.users.length})</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          {searchResults.users.map((u) => (
                            <Link
                              key={u.id}
                              to={`/perfil/${u.username}`}
                              onClick={() => setShowSearchResults(false)}
                              className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-surface-container transition-colors group cursor-pointer"
                            >
                              {u.avatar_url ? (
                                <img
                                  src={u.avatar_url}
                                  alt={u.username}
                                  className="w-8 h-8 rounded-full object-cover shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary font-bold flex items-center justify-center text-xs uppercase shrink-0">
                                  {(u.name || u.username).charAt(0)}
                                </div>
                              )}
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-bold text-on-surface group-hover:text-primary transition-colors truncate">
                                  {u.name || `@${u.username}`}
                                </span>
                                <span className="text-[11px] text-on-surface-variant truncate">
                                  @{u.username}
                                </span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 2. Grupo: Comunidades */}
                    {searchResults.communities.length > 0 && (
                      <div className="p-2 border-b border-outline-variant/20">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-secondary">
                          <span className="material-symbols-outlined text-[16px]">groups</span>
                          <span>Comunidades ({searchResults.communities.length})</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          {searchResults.communities.map((c) => (
                            <Link
                              key={c.id}
                              to={`/c/${c.slug || c.id}`}
                              onClick={() => setShowSearchResults(false)}
                              className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-surface-container transition-colors group cursor-pointer"
                            >
                              <div
                                className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-xs shrink-0"
                                style={{ backgroundColor: c.icon_color || '#712ae2' }}
                              >
                                {c.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-bold text-on-surface group-hover:text-secondary transition-colors truncate">
                                  c/{c.name}
                                </span>
                                <span className="text-[11px] text-on-surface-variant truncate">
                                  {c.description || `${c.members_count || 1} membros`}
                                </span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 3. Grupo: Posts */}
                    {searchResults.posts.length > 0 && (
                      <div className="p-2">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-tertiary">
                          <span className="material-symbols-outlined text-[16px]">article</span>
                          <span>Posts ({searchResults.posts.length})</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          {searchResults.posts.map((p) => (
                            <Link
                              key={p.id}
                              to={`/?q=${encodeURIComponent(p.title || parseScrap(p.content).body.slice(0, 30))}`}
                              onClick={() => setShowSearchResults(false)}
                              className="flex items-start gap-2.5 px-3 py-2 rounded-xl hover:bg-surface-container transition-colors group cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[18px] text-on-surface-variant mt-0.5 shrink-0">
                                {p.post_type === 'scrap' ? 'auto_stories' : 'edit_note'}
                              </span>
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-xs font-semibold text-on-surface group-hover:text-primary transition-colors line-clamp-1">
                                  {p.title || parseScrap(p.content).body}
                                </span>
                                <span className="text-[10px] text-on-surface-variant truncate">
                                  por @{p.author_name} {p.community_name ? `em c/${p.community_name}` : ''}
                                </span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Nenhum resultado */}
                    {searchResults.users.length === 0 &&
                      searchResults.communities.length === 0 &&
                      searchResults.posts.length === 0 && (
                        <div className="p-6 text-center text-xs text-on-surface-variant flex flex-col items-center gap-2">
                          <span className="material-symbols-outlined text-[28px] text-on-surface-variant/60">
                            search_off
                          </span>
                          <span>Nenhum resultado encontrado para "{searchQuery}"</span>
                        </div>
                      )}

                    {/* Rodapé: Pressione enter */}
                    <div className="bg-surface-container-low px-4 py-2 border-t border-outline-variant/20 flex items-center justify-between text-[11px] text-on-surface-variant">
                      <span>Pressione <strong className="font-semibold text-on-surface">Enter</strong> para ver mais no Feed</span>
                      <button
                        type="button"
                        onClick={handleSearchSubmit}
                        className="text-primary hover:underline font-semibold cursor-pointer"
                      >
                        Ver tudo
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Canto Direito: Ações (+ Criar, Mensagens, Notificações, Tema, Perfil) */}
          <div className="flex items-center gap-1 sm:gap-2.5 flex-shrink-0">
            {/* Botão de Busca Mobile (abre o campo em tela cheia no mobile) */}
            <button
              type="button"
              onClick={() => setMobileSearchOpen(true)}
              aria-label="Abrir pesquisa"
              className="md:hidden p-2 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
              title="Pesquisar"
            >
              <span className="material-symbols-outlined text-[22px]">search</span>
            </button>
            {user ? (
              <>
                {/* Botão e Dropdown Criar */}
                <div className="relative">
                  <div className="hidden md:flex items-center shadow-xs">
                    <button
                      type="button"
                      onClick={openCreatePostModal}
                      className="flex items-center gap-1.5 py-1.5 px-3.5 rounded-l-full bg-primary-container text-on-primary font-medium text-sm hover:bg-primary transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">add</span>
                      <span>Criar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateDropdown((prev) => !prev)}
                      aria-label="Mais opções de criação"
                      className="py-1.5 pr-2.5 pl-1 rounded-r-full bg-primary-container text-on-primary hover:bg-primary border-l border-white/20 transition-all cursor-pointer flex items-center"
                    >
                      <span className="material-symbols-outlined text-[16px]">expand_more</span>
                    </button>
                  </div>

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
                            openCreatePostModal();
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

                {/* Botão Mensagens com link para /mensagens e Badge real (Desktop: md:flex) */}
                <Link
                  to="/mensagens"
                  aria-label="Abrir mensagens privadas"
                  className="hidden md:flex p-2 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors relative cursor-pointer"
                  title="Mensagens Diretas"
                >
                  <span className="material-symbols-outlined text-[22px]">chat_bubble</span>
                  {unreadDms > 0 && (
                    <span className="absolute top-1 right-1 px-1.5 py-0.2 rounded-full bg-secondary-container text-on-secondary-container text-[10px] leading-tight font-bold">
                      {unreadDms}
                    </span>
                  )}
                </Link>

                {/* Botão Notificações */}
                <Link
                  to="/notificacoes"
                  aria-label="Ver notificações"
                  className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors relative cursor-pointer"
                  title="Notificações"
                >
                  <span className="material-symbols-outlined text-[22px]">notifications</span>
                </Link>
              </>
            ) : (
              /* Deslogado: Botões de Ação Limpos */
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="px-3 sm:px-4 py-1.5 rounded-full text-on-surface hover:bg-surface-container font-semibold text-xs transition-colors cursor-pointer"
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/login?tab=cadastro')}
                  className="px-3 sm:px-4 py-1.5 rounded-full bg-primary-container text-on-primary hover:bg-primary font-semibold text-xs shadow-xs transition-all cursor-pointer"
                >
                  Cadastrar
                </button>
              </div>
            )}

            {/* Botão de Alternância de Tema (Light / Dark Mode) */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
              title={isDark ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
              className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all duration-200 cursor-pointer flex items-center justify-center relative group"
            >
              <span className="material-symbols-outlined text-[22px] transition-transform duration-300 group-hover:rotate-45">
                {isDark ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            {/* Avatar Mobile do Usuário (Stitch Mobile Header) */}
            {user && (
              <Link
                to="/perfil"
                className="w-8 h-8 rounded-full bg-primary-container text-on-primary font-bold flex items-center justify-center text-xs uppercase shadow-xs shrink-0 ml-0.5 hover:ring-2 hover:ring-primary transition-all cursor-pointer"
                title={`Meu perfil (@${user.username})`}
              >
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.username}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  user.username.charAt(0)
                )}
              </Link>
            )}
          </div>
        </div>

        {/* Barra de Pesquisa Mobile Expandida (Overlay Stitch) */}
        {mobileSearchOpen && (
          <div className="md:hidden absolute inset-0 bg-surface-container-lowest z-50 flex items-center px-3 gap-2 animate-in fade-in duration-150">
            <form onSubmit={handleSearchSubmit} className="flex-1 relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                search
              </span>
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar pessoas, comunidades, posts..."
                className="w-full pl-9 pr-8 py-2 rounded-full bg-surface-container-low border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary-container"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-1"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </form>
            <button
              type="button"
              onClick={() => {
                setMobileSearchOpen(false);
                setShowSearchResults(false);
              }}
              className="px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-surface-container rounded-lg cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        )}
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
