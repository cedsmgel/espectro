import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { hashtagsApi, Post, postsApi, searchApi, SearchResults } from '../lib/api';
import { tagKey } from '../lib/hashtags';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { MediaGrid } from '../components/MediaGrid';

const PAGE = 30;

const SectionTitle: React.FC<{ icon: string; children: React.ReactNode }> = ({ icon, children }) => (
  <div className="flex items-center gap-1.5 px-3 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
    <span className="material-symbols-outlined text-[16px]">{icon}</span>
    <span>{children}</span>
  </div>
);

// Pesquisa e descoberta: busca com resultados em seções (pessoas, comunidades, hashtags, publicações) e, abaixo, uma grade de fotos e vídeos
export const Explore: React.FC = () => {
  const navigate = useNavigate();
  const boxRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [tags, setTags] = useState<Array<{ tag: string; posts: number }>>([]);
  const [trending, setTrending] = useState<Array<{ tag: string; posts: number }>>([]);

  const [posts, setPosts] = useState<Post[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    hashtagsApi.trending(8).then(setTrending).catch(() => {});
    postsApi
      .list({ media: 'any', limit: PAGE })
      .then((list) => {
        setPosts(list);
        setHasMore(list.length === PAGE);
      })
      .catch(() => setPosts([]));
  }, []);

  const loadMore = async () => {
    if (!posts || posts.length === 0) return;
    setLoadingMore(true);
    try {
      const next = await postsApi.list({ media: 'any', limit: PAGE, before_id: posts[posts.length - 1].id });
      setPosts([...posts, ...next]);
      setHasMore(next.length === PAGE);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  // Busca com pequena espera enquanto a pessoa digita
  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults(null);
      setTags([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      const prefix = term.replace(/^#/, '');
      const [found, tagList] = await Promise.all([
        searchApi.search(term).catch(() => null),
        prefix ? hashtagsApi.suggest(prefix).catch(() => []) : Promise.resolve([]),
      ]);
      setResults(found);
      setTags(tagList);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = query.trim();
    if (!term) return;
    setOpen(false);
    navigate(/^#[\p{L}\p{N}_]{2,50}$/u.test(term) ? `/tag/${encodeURIComponent(tagKey(term.slice(1)))}` : `/?q=${encodeURIComponent(term)}`);
  };

  const close = () => setOpen(false);
  const hasResults = Boolean(results && (results.users.length || results.communities.length || results.posts.length)) || tags.length > 0;
  const rowCls = 'flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-surface-container transition-colors';

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <Header />
      <SidebarNav />
      <div className="pt-16 md:pt-0 md:pl-20">
        <main className="w-full max-w-4xl mx-auto px-4 pt-4 pb-24 md:pb-8 flex flex-col gap-4">
          <div ref={boxRef} className="relative">
            <form onSubmit={submit} className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[22px] pointer-events-none">search</span>
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                placeholder="Pesquisar pessoas, comunidades, hashtags e publicações"
                aria-label="Pesquisar no Espectro"
                autoComplete="off"
                className="w-full h-12 pl-12 pr-4 rounded-full bg-surface-container-low border border-outline-variant text-base text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-on-surface"
              />
            </form>

            {open && (
              <div className="absolute left-0 right-0 top-full mt-2 z-40 bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-2xl max-h-[70vh] overflow-y-auto pb-2">
                {!query.trim() ? (
                  trending.length > 0 ? (
                    <>
                      <SectionTitle icon="trending_up">Em alta</SectionTitle>
                      {trending.map((t) => (
                        <Link key={t.tag} to={`/tag/${encodeURIComponent(t.tag)}`} onClick={close} className={rowCls}>
                          <span className="font-semibold text-sm">#{t.tag}</span>
                          <span className="text-xs text-on-surface-variant">{t.posts} {t.posts === 1 ? 'publicação' : 'publicações'}</span>
                        </Link>
                      ))}
                    </>
                  ) : (
                    <p className="p-6 text-center text-xs text-on-surface-variant">Digite para pesquisar.</p>
                  )
                ) : loading && !results ? (
                  <p className="p-6 text-center text-xs text-on-surface-variant">Buscando...</p>
                ) : !hasResults ? (
                  <p className="p-6 text-center text-xs text-on-surface-variant">Nada encontrado para "{query.trim()}".</p>
                ) : (
                  <>
                    {results && results.communities.length > 0 && (
                      <>
                        <SectionTitle icon="groups">Comunidades</SectionTitle>
                        {results.communities.map((c) => (
                          <Link key={c.id} to={`/e/${c.slug || c.id}`} onClick={close} className={rowCls}>
                            <span className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shrink-0" style={{ backgroundColor: c.icon_color || '#404040' }}>
                              {c.name.charAt(0).toUpperCase()}
                            </span>
                            <span className="flex flex-col min-w-0">
                              <span className="text-sm font-semibold truncate">e/{c.name}</span>
                              <span className="text-xs text-on-surface-variant truncate">
                                {c.members_count ?? 0} {c.members_count === 1 ? 'membro' : 'membros'}
                                {c.description ? ` · ${c.description}` : ''}
                              </span>
                            </span>
                          </Link>
                        ))}
                      </>
                    )}
                    {results && results.users.length > 0 && (
                      <>
                        <SectionTitle icon="person">Pessoas</SectionTitle>
                        {results.users.map((u) => (
                          <Link key={u.id} to={`/perfil/${u.username}`} onClick={close} className={rowCls}>
                            {u.avatar_url ? (
                              <img src={u.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                            ) : (
                              <span className="w-9 h-9 rounded-full bg-primary-container text-on-primary font-bold flex items-center justify-center text-sm uppercase shrink-0">
                                {(u.name || u.username).charAt(0)}
                              </span>
                            )}
                            <span className="flex flex-col min-w-0">
                              <span className="text-sm font-semibold truncate">{u.name || `@${u.username}`}</span>
                              <span className="text-xs text-on-surface-variant truncate">@{u.username}</span>
                            </span>
                          </Link>
                        ))}
                      </>
                    )}
                    {tags.length > 0 && (
                      <>
                        <SectionTitle icon="tag">Hashtags</SectionTitle>
                        {tags.map((t) => (
                          <Link key={t.tag} to={`/tag/${encodeURIComponent(t.tag)}`} onClick={close} className={rowCls}>
                            <span className="font-semibold text-sm">#{t.tag}</span>
                            <span className="text-xs text-on-surface-variant">{t.posts} {t.posts === 1 ? 'publicação' : 'publicações'}</span>
                          </Link>
                        ))}
                      </>
                    )}
                    {results && results.posts.length > 0 && (
                      <>
                        <SectionTitle icon="article">Publicações</SectionTitle>
                        {results.posts.slice(0, 5).map((p) => (
                          <Link key={p.id} to={`/post/${p.id}`} onClick={close} className={rowCls}>
                            <span className="flex flex-col min-w-0">
                              <span className="text-sm font-semibold truncate">{p.title?.trim() || p.content.replace(/\s+/g, ' ').slice(0, 80)}</span>
                              <span className="text-xs text-on-surface-variant truncate">
                                @{p.author_name}
                                {p.community_name ? ` · e/${p.community_name}` : ''}
                              </span>
                            </span>
                          </Link>
                        ))}
                      </>
                    )}
                    <button type="button" onClick={(e) => submit(e as unknown as React.FormEvent)} className="mx-3 mt-2 text-xs font-semibold text-primary hover:underline cursor-pointer">
                      Ver todos os resultados de "{query.trim()}"
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {posts === null ? (
            <ul className="grid grid-cols-3 gap-px bg-outline-variant border border-outline-variant" aria-hidden="true">
              {Array.from({ length: 9 }).map((_, i) => (
                <li key={i} className="aspect-[3/4] bg-surface-container-low animate-pulse" />
              ))}
            </ul>
          ) : posts.length === 0 ? (
            <p className="py-16 text-center text-sm text-on-surface-variant">Ainda não há fotos ou vídeos para explorar.</p>
          ) : (
            <>
              <MediaGrid posts={posts} />
              {hasMore && (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="self-center px-5 py-2 rounded-full border border-outline-variant text-sm font-semibold hover:bg-surface-container cursor-pointer disabled:opacity-50"
                >
                  {loadingMore ? 'Carregando...' : 'Carregar mais'}
                </button>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};
