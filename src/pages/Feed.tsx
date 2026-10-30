import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { postsApi, communitiesApi, Post, Community, CreatePostData } from '../lib/api';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { CreatePostForm } from '../components/CreatePostForm';
import { PostCard } from '../components/PostCard';

export const Feed: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState<Post[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'foryou' | 'following' | 'trending'>('foryou');

  const queryParam = searchParams.get('q');
  const typeParam = searchParams.get('type');
  const filterParam = searchParams.get('filter');

  const loadData = async () => {
    try {
      const [fetchedPosts, fetchedCommunities] = await Promise.all([
        postsApi.list(),
        communitiesApi.list(),
      ]);
      setPosts(fetchedPosts);
      setCommunities(fetchedCommunities);
    } catch (err) {
      console.error('Erro ao carregar dados do feed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    if (filterParam === 'trending') {
      setActiveTab('trending');
    }
  }, [filterParam]);

  const handlePostCreated = async (data: CreatePostData) => {
    const newPost = await postsApi.create(data);
    // Insere no início da lista para aparecer imediatamente
    setPosts((prev) => [newPost, ...prev.filter((p) => p.id !== newPost.id)]);
    // Garante que o usuário veja a nova publicação no topo sem filtros ativos
    setActiveTab('foryou');
    if (queryParam) {
      setSearchParams({});
    }
  };

  const handleVote = async (postId: number, voteType: 'up' | 'down') => {
    try {
      await postsApi.vote(postId, voteType);
    } catch (err) {
      console.error('Erro ao registrar voto:', err);
    }
  };

  // Filter posts
  const filteredPosts = posts.filter((p) => {
    if (queryParam) {
      const q = queryParam.toLowerCase();
      const matchTitle = p.title?.toLowerCase().includes(q);
      const matchContent = p.content.toLowerCase().includes(q);
      const matchAuthor = p.author_name.toLowerCase().includes(q);
      const matchCommunity = p.community_name?.toLowerCase().includes(q);
      return matchTitle || matchContent || matchAuthor || matchCommunity;
    }

    if (typeParam === 'scrap') {
      return p.post_type === 'scrap';
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      {/* 1. Header Global */}
      <Header />

      {/* 2. Barra Lateral Compacta (72px) */}
      <SidebarNav />

      {/* 3. Container Principal Expandido */}
      <div className="pl-0 md:pl-[72px] pt-16 min-h-screen flex flex-col justify-between">
        <main className="w-full bg-surface py-6">
          <div className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* FEED CENTRAL (Colunas 1 a 8) */}
              <section className="lg:col-span-8 flex flex-col gap-6 min-w-0">
                {/* Momentos do Espectro (Stories) */}
                <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/30 overflow-hidden">
                  <div className="flex items-center justify-between pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-secondary-container animate-pulse" />
                      <h2 className="font-semibold text-sm text-on-surface">
                        Momentos do Espectro
                      </h2>
                    </div>
                    <span className="text-on-surface-variant text-xs cursor-pointer hover:text-primary">
                      Ver todos
                    </span>
                  </div>
                  <div className="flex items-center gap-4 overflow-x-auto pb-1 scrollbar-none">
                    {/* Criar Story */}
                    <div className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group">
                      <div className="relative w-14 h-14 rounded-full bg-surface-container flex items-center justify-center group-hover:scale-105 transition-transform">
                        <span className="material-symbols-outlined text-[24px] text-primary">account_circle</span>
                        <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-primary-container text-on-primary flex items-center justify-center text-xs shadow-md">
                          +
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-on-surface text-center max-w-[64px] truncate">
                        Criar Story
                      </span>
                    </div>

                    {/* Stories Mockados Inspirados em Stitch */}
                    {[
                      { user: '@marina_art', color: 'from-secondary via-primary-container to-tertiary-fixed-dim' },
                      { user: '@tech_radar', color: 'from-primary via-tertiary to-secondary-container' },
                      { user: '@cinefilos', color: 'from-secondary via-secondary-container to-primary' },
                      { user: '@dev_daily', color: 'from-tertiary-container via-primary-container to-secondary' },
                      { user: '@urban_vibes', color: 'from-primary to-secondary-container' },
                    ].map((story, idx) => (
                      <div key={idx} className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group">
                        <div className={`p-0.5 rounded-full bg-gradient-to-tr ${story.color} group-hover:scale-105 transition-transform`}>
                          <div className="w-13 h-13 rounded-full bg-surface-container-lowest p-0.5 flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center font-bold text-xs text-primary">
                              {story.user.charAt(1).toUpperCase()}
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] text-on-surface-variant text-center max-w-[68px] truncate">
                          {story.user}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Feed Tabs Switcher (Para Você, Seguindo, Em Alta) */}
                <div className="flex items-center justify-between bg-surface-container-lowest rounded-2xl px-6 py-1.5 shadow-sm border border-outline-variant/30">
                  <div className="flex items-center gap-8">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('foryou');
                        setSearchParams({});
                      }}
                      className={`relative py-3 text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                        activeTab === 'foryou' ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      <span>Para Você</span>
                      {activeTab === 'foryou' && (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-primary-container" />
                          <span className="absolute bottom-0 left-0 right-0 h-1 bg-primary-container rounded-full" />
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('following');
                        setSearchParams({});
                      }}
                      className={`relative py-3 text-sm font-semibold transition-colors cursor-pointer ${
                        activeTab === 'following' ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      <span>Seguindo</span>
                      {activeTab === 'following' && (
                        <span className="absolute bottom-0 left-0 right-0 h-1 bg-primary-container rounded-full" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('trending');
                        setSearchParams({ filter: 'trending' });
                      }}
                      className={`relative py-3 text-sm font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                        activeTab === 'trending' ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      <span>Em Alta</span>
                      <span>🔥</span>
                      {activeTab === 'trending' && (
                        <span className="absolute bottom-0 left-0 right-0 h-1 bg-primary-container rounded-full" />
                      )}
                    </button>
                  </div>

                  <button
                    type="button"
                    aria-label="Preferências do feed"
                    className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]">tune</span>
                  </button>
                </div>

                {/* Composer Card */}
                <CreatePostForm
                  onPostCreated={handlePostCreated}
                  communities={communities}
                />

                {/* Feed de Publicações */}
                {loading ? (
                  <div className="bg-surface-container-lowest rounded-2xl p-12 text-center text-on-surface-variant shadow-sm border border-outline-variant/30">
                    <span className="material-symbols-outlined text-[36px] text-primary animate-spin">
                      progress_activity
                    </span>
                    <p className="mt-2 text-sm">Carregando feed do Espectro...</p>
                  </div>
                ) : filteredPosts.length === 0 ? (
                  <div className="bg-surface-container-lowest rounded-2xl p-12 text-center text-on-surface-variant shadow-sm border border-outline-variant/30">
                    <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40 mb-2">
                      dynamic_feed
                    </span>
                    <h3 className="font-semibold text-base text-on-surface">
                      Nenhuma publicação encontrada
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-1">
                      Seja o primeiro a compartilhar uma ideia ou recado!
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-5">
                    {filteredPosts.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        onVote={handleVote}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* COLUNA LATERAL DIREITA (Colunas 9 a 12) */}
              <aside className="lg:col-span-4 flex flex-col gap-6 sticky top-20 hidden lg:flex">
                {/* Card: Em Alta no Brasil */}
                <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/30 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[20px]">trending_up</span>
                      <h2 className="font-bold text-sm text-on-surface">Em Alta no Brasil</h2>
                    </div>
                    <button type="button" className="text-on-surface-variant hover:text-primary transition-colors">
                      <span className="material-symbols-outlined text-[18px]">settings</span>
                    </button>
                  </div>

                  <div className="flex flex-col gap-3.5">
                    {[
                      { category: 'Design & UI · Em Alta', tag: '#DesignTokens', count: '24,5 mil publicações' },
                      { category: 'Inteligência Artificial · Tendência', tag: 'IA Generativa', count: '148,2 mil publicações' },
                      { category: 'Ciência & Espaço', tag: 'Lançamento Espacial', count: '18,9 mil publicações' },
                      { category: 'Esports · Ao Vivo', tag: 'Copa do Mundo de Esports', count: '72,4 mil publicações' },
                    ].map((topic, idx) => (
                      <div key={idx} className="flex items-start justify-between cursor-pointer group">
                        <div className="flex flex-col">
                          <span className="text-[11px] text-on-surface-variant">{topic.category}</span>
                          <span className="text-xs font-semibold text-on-surface group-hover:text-primary transition-colors">
                            {topic.tag}
                          </span>
                          <span className="text-[11px] text-on-surface-variant">{topic.count}</span>
                        </div>
                        <button type="button" aria-label="Opções" className="p-1 text-on-surface-variant hover:text-on-surface">
                          <span className="material-symbols-outlined text-[16px]">more_horiz</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card: Comunidades Ativas */}
                <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/30 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-sm text-on-surface">Comunidades Ativas</h2>
                    <Link to="/comunidades" className="text-xs font-semibold text-primary hover:underline">
                      Explorar
                    </Link>
                  </div>

                  <div className="flex flex-col gap-3">
                    {communities.slice(0, 3).map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-secondary-fixed flex items-center justify-center text-secondary font-bold text-xs flex-shrink-0">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <Link to={`/e/${c.slug || c.id}`} className="text-xs font-semibold text-on-surface truncate hover:text-primary">
                              e/{c.name}
                            </Link>
                            <span className="text-[11px] text-on-surface-variant truncate">
                              {c.members_count} membros
                            </span>
                          </div>
                        </div>
                        <Link
                          to={`/e/${c.slug || c.id}`}
                          className="px-3 py-1 rounded-full bg-surface-container-low text-primary text-xs font-semibold hover:bg-surface-container transition-colors flex-shrink-0"
                        >
                          + Entrar
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card: Quem Seguir */}
                <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/30 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-sm text-on-surface">Sugestões de Perfis</h2>
                    <button type="button" aria-label="Atualizar" className="text-on-surface-variant hover:text-primary transition-colors">
                      <span className="material-symbols-outlined text-[18px]">refresh</span>
                    </button>
                  </div>

                  <div className="flex flex-col gap-3">
                    {[
                      { name: 'Beatriz Rocha', user: '@biarocha' },
                      { name: 'Thiago Silveira', user: '@thiago_dev' },
                    ].map((prof, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary font-bold text-xs flex items-center justify-center flex-shrink-0">
                            {prof.name.charAt(0)}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-semibold text-on-surface truncate">{prof.name}</span>
                            <span className="text-[11px] text-on-surface-variant truncate">{prof.user}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="px-3.5 py-1 rounded-full bg-primary-container text-on-primary font-semibold text-xs hover:bg-primary transition-colors flex-shrink-0 cursor-pointer"
                        >
                          Seguir
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mini Rodapé */}
                <div className="px-2 flex flex-col gap-1 text-[11px] text-on-surface-variant">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <a href="#" className="hover:underline">Termos</a>
                    <a href="#" className="hover:underline">Privacidade</a>
                    <a href="#" className="hover:underline">Diretrizes</a>
                    <a href="#" className="hover:underline">Cookies</a>
                  </div>
                  <p>© 2026 Espectro Inc.</p>
                </div>
              </aside>
            </div>
          </div>
        </main>

        {/* Global Footer */}
        <footer className="w-full bg-surface-container-lowest border-t border-outline-variant/30 py-6 px-6 mt-12">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-lg bg-primary-container text-on-primary flex items-center justify-center text-xs">
                <span className="material-symbols-outlined text-[16px]">grain</span>
              </div>
              <span className="font-semibold text-sm text-on-surface">Espectro</span>
              <span className="text-on-surface-variant text-xs hidden sm:inline">
                · A nova geração das redes sociais conectadas
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-on-surface-variant">
              <a href="#" className="hover:text-primary transition-colors">Termos</a>
              <a href="#" className="hover:text-primary transition-colors">Privacidade</a>
              <a href="#" className="hover:text-primary transition-colors">Diretrizes</a>
              <a href="#" className="hover:text-primary transition-colors">Ajuda & Suporte</a>
            </div>
            <div className="text-xs text-on-surface-variant">
              © 2026 Espectro Inc. Todos os direitos reservados.
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
