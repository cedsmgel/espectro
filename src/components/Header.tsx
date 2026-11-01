import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authStorage, searchApi, SearchResults } from '../lib/api';
import { useUnreadDms } from '../hooks/useUnreadDms';
import { useNotificationCount } from '../hooks/useNotificationCount';
import { useSidebar } from '../context/SidebarContext';
import { parseScrap } from '../lib/scrapStyle';
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
  const userId = user?.id;
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [showCommunityModal, setShowCommunityModal] = useState(false);
  const unreadDms = useUnreadDms(userId);
  const notificationCount = useNotificationCount(userId);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  // Botão Pesquisa da barra inferior abre esta mesma busca
  useEffect(() => {
    const open = () => setMobileSearchOpen(true);
    window.addEventListener('espectro:open-mobile-search', open);
    return () => window.removeEventListener('espectro:open-mobile-search', open);
  }, []);

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
      const target = e.target as Node;
      // O overlay de pesquisa do mobile fica fora do container desktop: tocar nele não é "clicar fora"
      if (mobileSearchRef.current?.contains(target)) return;
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
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

  const mobileSearchRef = useRef<HTMLDivElement>(null);

  const handleSelectResult = (path: string) => {
    mobileInputRef.current?.blur();
    setShowSearchResults(false);
    setMobileSearchOpen(false);
    navigate(path);
  };

  const handleMobileSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      mobileInputRef.current?.blur();
      setShowSearchResults(false);
      setMobileSearchOpen(false);
      navigate('/?q=' + encodeURIComponent(searchQuery.trim()));
    }
  };

  const handleCancelMobileSearch = () => {
    mobileInputRef.current?.blur();
    setMobileSearchOpen(false);
    setShowSearchResults(false);
  };

  return (
    <>
      {/* 1. HEADER GLOBAL FULL-WIDTH (Visible Spectrum Social) */}
      <header className="fixed top-0 left-0 right-0 w-full h-[calc(3.5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] bg-surface-container-lowest border-b border-outline-variant z-40 px-3 sm:px-6 flex md:hidden items-center justify-between">
        <div className="h-full w-full flex items-center justify-between gap-2 sm:gap-4 max-w-7xl mx-auto">
          {/* Canto Esquerdo: Botão Toggle Hamburger (Desktop) + Logo Oficial Espectro */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={handleToggle}
              aria-label="Abrir ou fechar menu de navegação"
              className="hidden md:flex md:w-auto md:h-auto md:p-2 items-center justify-center shrink-0 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[24px]">menu</span>
            </button>
            <Link to="/" className="flex items-center gap-2 sm:gap-2.5 group">
              <div className="w-8 h-8 rounded-xl bg-olive flex items-center justify-center text-on-primary font-bold text-sm shadow-xs group-hover:scale-105 transition-transform">
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
              <div className="absolute top-full left-2 right-2 mt-2 bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant overflow-hidden z-50 max-h-[75vh] overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
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
                      <div className="p-2 border-b border-outline-variant">
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
                      <div className="p-2 border-b border-outline-variant">
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
                                style={{ backgroundColor: c.icon_color || '#404040' }}
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
                    <div className="bg-surface-container-low px-4 py-2 border-t border-outline-variant flex items-center justify-between text-[11px] text-on-surface-variant">
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
              className="md:hidden w-12 h-12 flex items-center justify-center shrink-0 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
              title="Pesquisar"
            >
              <span className="material-symbols-outlined text-[22px]">search</span>
            </button>
            {user ? (
              <>


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
                  className="w-12 h-12 md:w-auto md:h-auto md:p-2 flex items-center justify-center shrink-0 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors relative cursor-pointer"
                  title="Notificações"
                >
                  <span className="material-symbols-outlined text-[22px]">notifications</span>
                  {notificationCount > 0 && (
                    <span className="absolute top-1 right-1 px-1.5 py-0.2 rounded-full bg-error text-white text-[10px] leading-tight font-bold">
                      {notificationCount > 99 ? '99+' : notificationCount}
                    </span>
                  )}
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


          </div>
        </div>

              </header>

      {/* 2. Barra e Dropdown de Pesquisa Mobile (Totalmente integrado com resultados) */}
      {mobileSearchOpen && (
        <>
          {/* Backdrop escuro para fechar ao tocar fora */}
          <div
            className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-xs z-50 animate-in fade-in duration-150"
            onClick={handleCancelMobileSearch}
          />

          {/* Container Superior Fixo da Pesquisa no Mobile (w-full) */}
          <div
            ref={mobileSearchRef}
            className="md:hidden fixed inset-x-0 top-0 z-50 bg-surface-container-lowest border-b border-outline-variant shadow-md pt-[env(safe-area-inset-top)] animate-in slide-in-from-top-2 duration-150"
          >
            {/* Barra de Input com largura total */}
            <div className="relative w-full px-3 py-2.5 flex items-center gap-2">
              <form onSubmit={handleMobileSearchSubmit} className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none">
                  search
                </span>
                <input
                  ref={mobileInputRef}
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSearchResults(true);
                  }}
                  onFocus={() => {
                    if (searchQuery.trim()) setShowSearchResults(true);
                  }}
                  placeholder="Pesquisar pessoas, comunidades, posts..."
                  className="w-full pl-9 pr-8 py-2 rounded-full bg-surface-container-low border border-outline-variant/40 text-on-surface text-sm placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary-container/20 focus:border-primary-container"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults(null);
                      if (mobileInputRef.current) mobileInputRef.current.focus();
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-1 cursor-pointer"
                    aria-label="Limpar texto"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                ) : null}
              </form>

              <button
                type="button"
                onClick={handleCancelMobileSearch}
                className="px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-surface-container rounded-lg shrink-0 cursor-pointer"
              >
                Cancelar
              </button>

              {/* Dropdown de Resultados no Mobile: absolute top-full left-0 w-full z-50 max-h-[60vh] overflow-y-auto */}
              {showSearchResults && searchQuery.trim().length > 0 && (
                <div className="absolute top-full left-0 w-full z-50 max-h-[60vh] overflow-y-auto bg-surface-container-lowest border-b border-outline-variant shadow-2xl animate-in fade-in slide-in-from-top-1 duration-150">
                  {/* Carregando */}
                  {isSearching && !searchResults && (
                    <div className="p-6 text-center text-xs text-on-surface-variant flex flex-col items-center gap-2">
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span>Buscando no Espectro...</span>
                    </div>
                  )}

                  {searchResults && (
                    <div className="flex flex-col gap-2 p-3 w-full">
                      {/* Grupo: Usuários / Pessoas */}
                      {searchResults.users.map((u) => (
                        <button
                          key={`user-${u.id}`}
                          type="button"
                          onClick={() => handleSelectResult(`/perfil/${encodeURIComponent(u.username)}`)}
                          className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-surface-container active:bg-surface-container-high transition-colors text-left cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {u.avatar_url ? (
                              <img
                                src={u.avatar_url}
                                alt={u.username}
                                className="w-10 h-10 rounded-full object-cover shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-sm shrink-0">
                                {u.username.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-semibold text-on-surface truncate">
                                {u.name || u.username}
                              </span>
                              <span className="text-xs text-on-surface-variant truncate">
                                @{u.username}
                              </span>
                            </div>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0">
                            Pessoa
                          </span>
                        </button>
                      ))}

                      {/* Grupo: Comunidades */}
                      {searchResults.communities.map((c) => (
                        <button
                          key={`comm-${c.id}`}
                          type="button"
                          onClick={() => handleSelectResult(`/c/${encodeURIComponent(c.slug || c.name || c.id)}`)}
                          className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-surface-container active:bg-surface-container-high transition-colors text-left cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0 shadow-xs"
                              style={{ backgroundColor: c.icon_color || '#404040' }}
                            >
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-semibold text-on-surface truncate">
                                c/{c.name}
                              </span>
                              <span className="text-xs text-on-surface-variant truncate">
                                {c.description || `${c.members_count || 1} membros`}
                              </span>
                            </div>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-secondary/10 text-secondary text-[10px] font-bold shrink-0">
                            Comunidade
                          </span>
                        </button>
                      ))}

                      {/* Grupo: Posts */}
                      {searchResults.posts.map((p) => (
                        <button
                          key={`post-${p.id}`}
                          type="button"
                          onClick={() => handleSelectResult(`/post/${p.id}`)}
                          className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-surface-container active:bg-surface-container-high transition-colors text-left cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {p.media_url && p.media_type === 'image' ? (
                              <img
                                src={p.media_url}
                                alt=""
                                className="w-10 h-10 rounded-lg object-cover shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface shrink-0">
                                <span className="material-symbols-outlined text-[20px]">
                                  {p.post_type === 'scrap' ? 'auto_stories' : 'article'}
                                </span>
                              </div>
                            )}
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-semibold text-on-surface truncate">
                                {p.title || parseScrap(p.content).body}
                              </span>
                              <span className="text-xs text-on-surface-variant truncate">
                                por @{p.author_name} {p.community_name ? `em c/${p.community_name}` : ''}
                              </span>
                            </div>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary text-[10px] font-bold shrink-0">
                            Post
                          </span>
                        </button>
                      ))}

                      {/* Sem resultados */}
                      {searchResults.users.length === 0 &&
                        searchResults.communities.length === 0 &&
                        searchResults.posts.length === 0 && (
                          <div className="p-6 text-center text-xs text-on-surface-variant flex flex-col items-center gap-2">
                            <span className="material-symbols-outlined text-[28px] text-on-surface-variant/60">
                              search_off
                            </span>
                            <span>Nenhum resultado encontrado para "${searchQuery}"</span>
                          </div>
                        )}

                      {/* Rodapé: Ver todos no feed */}
                      {(searchResults.users.length > 0 ||
                        searchResults.communities.length > 0 ||
                        searchResults.posts.length > 0) && (
                        <div className="pt-2 mt-1 border-t border-outline-variant flex items-center justify-between text-xs text-on-surface-variant">
                          <span>Ver resultados completos</span>
                          <button
                            type="button"
                            onClick={handleMobileSearchSubmit}
                            className="text-primary hover:underline font-semibold cursor-pointer"
                          >
                            Ir para o Feed →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

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
