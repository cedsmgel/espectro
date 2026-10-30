import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { ContactsWidget } from '../components/ContactsWidget';
import { PostCard } from '../components/PostCard';
import { CreatePostForm } from '../components/CreatePostForm';
import { api, authStorage, Community, Post } from '../lib/api';

export const CommunityDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const user = authStorage.getUser();

  const [community, setCommunity] = useState<Community | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);

  const fetchCommunityAndPosts = async () => {
    if (!slug) return;
    try {
      setLoading(true);
      const com = await api.getCommunityBySlug(slug);
      setCommunity(com);

      setLoadingPosts(true);
      const postList = await api.getPosts({ community_slug: slug });
      setPosts(postList);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingPosts(false);
    }
  };

  const fetchAllCommunities = async () => {
    try {
      const data = await api.getCommunities();
      setCommunities(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCommunityAndPosts();
    fetchAllCommunities();
  }, [slug]);

  const handleJoin = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!slug) return;

    try {
      setJoining(true);
      const res = await api.joinCommunity({ community_slug: slug });
      setJoinSuccess(res.message || 'Você agora é membro desta comunidade!');
      fetchCommunityAndPosts();
      setTimeout(() => setJoinSuccess(null), 4000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao entrar na comunidade');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-brand-blue/30 selection:text-blue-300">
      <Header />

      <main className="flex-1 w-full max-w-[1240px] mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left Column */}
          <aside className="md:col-span-3 lg:col-span-3 sticky top-20">
            <SidebarNav communities={communities} />
          </aside>

          {/* Center Column */}
          <section className="md:col-span-9 lg:col-span-6 space-y-5">
            {/* Community Liquid Glass Banner */}
            {loading ? (
              <div className="glass-panel rounded-2xl p-8 text-center text-neutral-400">
                Carregando detalhes da comunidade...
              </div>
            ) : community ? (
              <div className="glass-panel rounded-2xl overflow-hidden p-6 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-blue to-neon-cyan flex items-center justify-center font-display font-bold text-2xl text-white shadow-glow-blue uppercase">
                      {community.name.charAt(0)}
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight">
                        e/{community.name}
                      </h1>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-400 font-mono">
                        <span>/e/{community.slug || community.id}</span>
                        <span>•</span>
                        <span className="text-neon-green font-semibold">{community.members_count} membros</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleJoin}
                    disabled={joining}
                    className="btn-primary-blue text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    {joining ? 'Entrando...' : 'Entrar na Comunidade'}
                  </button>
                </div>

                <p className="text-sm text-neutral-300 leading-relaxed font-sans">
                  {community.description || 'Comunidade oficial no Espectro. Participe dos debates e compartilhe suas ideias.'}
                </p>

                {joinSuccess && (
                  <div className="p-3 rounded-xl bg-neon-green/10 border border-neon-green/30 text-neon-green text-xs flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    {joinSuccess}
                  </div>
                )}
              </div>
            ) : (
              <div className="glass-panel rounded-2xl p-8 text-center text-rose-400">
                Comunidade não encontrada.
              </div>
            )}

            {/* Post Creator Pre-Linked to this community */}
            {community && (
              <CreatePostForm
                communities={communities}
                defaultCommunityId={community.id}
                defaultCommunitySlug={community.slug}
                onPostCreated={fetchCommunityAndPosts}
              />
            )}

            {/* Posts Stream */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="font-display font-bold text-sm text-neutral-300">
                  Discussões em e/{community?.name || slug} ({posts.length})
                </h3>
                <button
                  type="button"
                  onClick={fetchCommunityAndPosts}
                  disabled={loadingPosts}
                  className="text-xs text-brand-blue hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                >
                  <span className={`material-symbols-outlined text-[15px] ${loadingPosts ? 'animate-spin' : ''}`}>
                    refresh
                  </span>
                  Atualizar
                </button>
              </div>

              {loadingPosts && (
                <div className="glass-panel rounded-2xl p-8 text-center text-neutral-400 flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined animate-spin text-brand-blue">sync</span>
                  Carregando tópicos...
                </div>
              )}

              {!loadingPosts && posts.length === 0 && (
                <div className="glass-panel rounded-2xl p-10 text-center space-y-2">
                  <p className="font-display font-bold text-base text-white">Nenhum tópico ainda</p>
                  <p className="text-xs text-neutral-400">
                    Seja o primeiro a inaugurar uma conversa nesta comunidade.
                  </p>
                </div>
              )}

              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          </section>

          {/* Right Column */}
          <aside className="md:col-span-12 lg:col-span-3 sticky top-20">
            <ContactsWidget />
          </aside>
        </div>
      </main>
    </div>
  );
};
