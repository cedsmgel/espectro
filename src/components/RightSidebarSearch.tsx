import React, { useState, useEffect, useRef } from 'react';
import { tagKey } from '../lib/hashtags';
import { Link, useNavigate } from 'react-router-dom';
import { searchApi, SearchResults } from '../lib/api';
import { parseScrap } from '../lib/scrapStyle';

export const RightSidebarSearch: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

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
        console.error('Erro na pesquisa:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

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
      if (e.key === 'Escape') setShowSearchResults(false);
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
      const query = searchQuery.trim();
      // Busca que começa com # leva direto à página da hashtag
      navigate(/^#[\p{L}\p{N}_]{2,50}$/u.test(query) ? `/tag/${encodeURIComponent(tagKey(query.slice(1)))}` : `/?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <div ref={searchContainerRef} className="relative w-full">
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
          placeholder="Pesquisar no Espectro..."
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

      {/* Dropdown com Resultados */}
      {showSearchResults && searchQuery.trim().length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant overflow-hidden z-50 max-h-[70vh] overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
          {isSearching && !searchResults && (
            <div className="p-6 text-center text-xs text-on-surface-variant flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Buscando no Espectro...</span>
            </div>
          )}

          {searchResults && (
            <>
              {searchResults.users.length > 0 && (
                <div className="p-2 border-b border-outline-variant">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                    <span className="material-symbols-outlined text-[16px]">person</span>
                    <span>Pessoas ({searchResults.users.length})</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {searchResults.users.slice(0, 3).map((u) => (
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

              {searchResults.communities.length > 0 && (
                <div className="p-2 border-b border-outline-variant">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-secondary">
                    <span className="material-symbols-outlined text-[16px]">groups</span>
                    <span>Comunidades ({searchResults.communities.length})</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {searchResults.communities.slice(0, 3).map((c) => (
                      <Link
                        key={c.id}
                        to={`/e/${c.slug || c.id}`}
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
                            e/{c.name}
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

              {searchResults.posts.length > 0 && (
                <div className="p-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-tertiary">
                    <span className="material-symbols-outlined text-[16px]">article</span>
                    <span>Posts ({searchResults.posts.length})</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {searchResults.posts.slice(0, 3).map((p) => (
                      <Link
                        key={p.id}
                        to={`/post/${p.id}`}
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
                            por @{p.author_name}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.users.length === 0 &&
                searchResults.communities.length === 0 &&
                searchResults.posts.length === 0 && (
                  <div className="p-6 text-center text-xs text-on-surface-variant flex flex-col items-center gap-2">
                    <span className="material-symbols-outlined text-[28px] text-on-surface-variant/60">
                      search_off
                    </span>
                    <span>Nenhum resultado para "{searchQuery}"</span>
                  </div>
                )}

              <div className="bg-surface-container-low px-4 py-2 border-t border-outline-variant flex items-center justify-between text-[11px] text-on-surface-variant">
                <span>Pressione <strong className="font-semibold text-on-surface">Enter</strong> para ver mais</span>
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
  );
};
