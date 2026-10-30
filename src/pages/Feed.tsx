import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  const [filterType, setFilterType] = useState<'trending' | 'recent' | 'scraps' | 'all'>('all');

  const queryParam = searchParams.get('q');
  const typeParam = searchParams.get('type');

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
  }, []);

  const handlePostCreated = async (data: CreatePostData) => {
    const newPost = await postsApi.create(data);
    setPosts((prev) => [newPost, ...prev]);
  };

  const handleVote = async (postId: number, voteType: 'up' | 'down') => {
    try {
      await postsApi.vote(postId, voteType);
    } catch (err) {
      console.error('Erro ao registrar voto:', err);
    }
  };

  // Filter posts based on active tab or URL parameters
  const filteredPosts = posts.filter((p) => {
    if (queryParam) {
      const q = queryParam.toLowerCase();
      const matchTitle = p.title?.toLowerCase().includes(q);
      const matchContent = p.content.toLowerCase().includes(q);
      const matchAuthor = p.author_name.toLowerCase().includes(q);
      const matchCommunity = p.community_name?.toLowerCase().includes(q);
      return matchTitle || matchContent || matchAuthor || matchCommunity;
    }

    if (typeParam === 'scrap' || filterType === 'scraps') {
      return p.post_type === 'scrap';
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-[#0d0f14] text-neutral-100 flex flex-col relative overflow-x-hidden">
      {/* Ambient Spectral Glow Orbs from Stitch */}
      <div className="orb-glow-1" />
      <div className="orb-glow-2" />

      {/* Main Header with Messages Direct Drawer button */}
      <Header />

      {/* Main Layout: Left Sidebar + Centered Expanded Feed */}
      <main className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-6 relative z-10 flex-1">
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-8 items-start">
          {/* Column 1: Left Navigation Rail */}
          <SidebarNav communities={communities} />

          {/* Column 2: Center Social Feed (Expanded max-w-4xl mx-auto) */}
          <section className="flex flex-col gap-6 w-full max-w-4xl mx-auto min-w-0">
            {/* Feed Header Filter Pills Bar */}
            <div className="glass-surface rounded-2xl p-2 flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setFilterType('trending');
                    setSearchParams({});
                  }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    filterType === 'trending' || (!typeParam && !queryParam && filterType === 'all')
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white border border-white/20 shadow-[0_0_14px_rgba(59,130,246,0.35)]'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>Em Alta</span>
                  <span>🔥</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFilterType('recent');
                    setSearchParams({});
                  }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    filterType === 'recent'
                      ? 'bg-white/10 text-white border border-white/20'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>Recentes</span>
                  <span>⚡</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFilterType('scraps');
                    setSearchParams({ type: 'scrap' });
                  }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    typeParam === 'scrap' || filterType === 'scraps'
                      ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>Meus Scraps</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                </button>
              </div>

              <button
                type="button"
                onClick={loadData}
                className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                title="Atualizar Feed"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
              </button>
            </div>

            {/* Create Post Composer */}
            <CreatePostForm onPostCreated={handlePostCreated} communities={communities} />

            {/* Active Query Filter Alert */}
            {queryParam && (
              <div className="flex items-center justify-between glass-surface px-4 py-2.5 rounded-xl border border-cyan-500/30 text-xs">
                <span className="text-neutral-300">
                  Filtrando resultados por: <strong className="text-cyan-300">{queryParam}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setSearchParams({})}
                  className="text-neutral-400 hover:text-white cursor-pointer"
                >
                  Limpar filtro ✕
                </button>
              </div>
            )}

            {/* Feed List */}
            {loading ? (
              <div className="glass-surface rounded-2xl p-8 text-center text-neutral-400 text-sm animate-pulse">
                Carregando publicações do Espectro...
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="glass-surface rounded-2xl p-10 text-center space-y-3 border border-white/10">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 mx-auto">
                  <span className="material-symbols-outlined text-2xl">dynamic_feed</span>
                </div>
                <h3 className="text-base font-display font-semibold text-white">
                  Nenhuma publicação encontrada
                </h3>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  Seja o primeiro a abrir uma discussão ou enviar um scrap nostálgico no feed!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPosts.map((post) => (
                  <PostCard key={post.id} post={post} onVote={handleVote} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};
