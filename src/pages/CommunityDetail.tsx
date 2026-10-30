import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { communitiesApi, postsApi, Community, Post, CreatePostData, authStorage } from '../lib/api';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { CreatePostForm } from '../components/CreatePostForm';
import { PostCard } from '../components/PostCard';

export const CommunityDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const user = authStorage.getUser();

  const [community, setCommunity] = useState<Community | null>(null);
  const [allCommunities, setAllCommunities] = useState<Community[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'discussions' | 'pinned' | 'media' | 'members'>('discussions');
  const [isMember, setIsMember] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [allComms, commPosts] = await Promise.all([
          communitiesApi.list(),
          slug ? postsApi.list({ community_slug: slug }) : Promise.resolve([]),
        ]);

        setAllCommunities(allComms);
        const current = allComms.find((c) => c.slug === slug || String(c.id) === slug);
        setCommunity(current || null);
        setPosts(commPosts);
      } catch (err) {
        console.error('Erro ao carregar detalhes da comunidade:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [slug]);

  const handleJoin = async () => {
    if (!user) {
      alert('Você precisa estar logado para entrar na comunidade.');
      return;
    }

    if (!community) return;

    setJoining(true);
    try {
      await communitiesApi.join(community.id);
      setIsMember(true);
      setCommunity((prev) =>
        prev ? { ...prev, members_count: (prev.members_count || 0) + 1 } : null
      );
    } catch (err: any) {
      alert(err.message || 'Erro ao entrar na comunidade.');
    } finally {
      setJoining(false);
    }
  };

  const handlePostCreated = async (data: CreatePostData) => {
    if (!community) return;
    const newPost = await postsApi.create({
      ...data,
      community_id: community.id,
    });
    setPosts((prev) => [newPost, ...prev]);
  };

  return (
    <div className="min-h-screen bg-[#0d0f14] text-neutral-100 flex flex-col relative overflow-x-hidden">
      {/* Ambient Spectral Glow Orbs from Stitch */}
      <div className="orb-glow-1" />
      <div className="orb-glow-2" />

      <Header />

      <main className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-6 relative z-10 flex-1">
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] xl:grid-cols-[260px_1fr_320px] gap-6 items-start">
          {/* Left Navigation Rail */}
          <SidebarNav communities={allCommunities} />

          {/* Center Column: Community Banner & Feed */}
          <section className="flex flex-col gap-6 w-full min-w-0">
            {loading ? (
              <div className="glass-surface rounded-2xl p-8 text-center text-neutral-400 text-sm animate-pulse">
                Carregando comunidade...
              </div>
            ) : !community ? (
              <div className="glass-surface rounded-2xl p-10 text-center space-y-3">
                <h2 className="text-xl font-display font-bold text-white">
                  Comunidade não encontrada
                </h2>
                <p className="text-xs text-neutral-400">
                  Esta comunidade não existe ou o endereço digitado está incorreto.
                </p>
                <Link to="/comunidades" className="inline-block btn-primary-blue text-xs font-semibold px-4 py-2 rounded-xl mt-2">
                  Explorar Comunidades
                </Link>
              </div>
            ) : (
              <>
                {/* Top Community Hero Banner (Stitch Specification) */}
                <div className="glass-surface rounded-2xl overflow-hidden relative shadow-[0_12px_32px_-4px_rgba(0,0,0,0.6)]">
                  {/* Cover Background with Glass Blur & Gradient */}
                  <div className="h-44 w-full bg-gradient-to-r from-blue-900/60 via-cyan-900/40 to-indigo-950/80 relative">
                    <div className="absolute inset-0 bg-radial-gradient from-transparent to-[#0d0f14]/80 pointer-events-none" />
                  </div>

                  {/* Community Header Content */}
                  <div className="p-6 relative -mt-16 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
                    <div className="flex items-end gap-4">
                      {/* Avatar */}
                      <div className="w-20 h-20 rounded-2xl bg-[#111318] p-1 border border-white/20 shadow-[0_0_20px_rgba(76,215,246,0.3)]">
                        <div className="w-full h-full rounded-xl bg-gradient-to-tr from-cyan-400 via-blue-600 to-indigo-600 flex items-center justify-center text-white font-display font-bold text-3xl">
                          {community.name.charAt(0).toUpperCase()}
                        </div>
                      </div>

                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <h1 className="text-xl sm:text-2xl font-display font-bold text-white truncate">
                            e/{community.name}
                          </h1>
                          <span className="material-symbols-outlined text-[20px] text-cyan-300" title="Comunidade Verificada">
                            verified
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 font-mono mt-0.5">
                          {community.members_count || 1} membros • 1.2k tópicos ativos • 42 online
                        </p>
                      </div>
                    </div>

                    {/* Join / Action Buttons */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={handleJoin}
                        disabled={joining || isMember}
                        className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all cursor-pointer shadow-[0_0_16px_rgba(59,130,246,0.35)] ${
                          isMember
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                            : 'btn-primary-blue'
                        }`}
                      >
                        {isMember ? '✓ Membro' : joining ? 'Entrando...' : 'Entrar na Comunidade'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.href);
                          alert('Link da comunidade copiado!');
                        }}
                        className="btn-glass p-2.5 rounded-xl text-neutral-300 hover:text-white"
                        title="Compartilhar Comunidade"
                      >
                        <span className="material-symbols-outlined text-[18px]">share</span>
                      </button>
                    </div>
                  </div>

                  {/* Description Box */}
                  <div className="px-6 pb-4">
                    <p className="text-xs sm:text-sm text-neutral-300 font-sans leading-relaxed">
                      {community.description || 'Comunidade do Espectro. Conecte-se e compartilhe suas ideias com outros membros.'}
                    </p>
                  </div>

                  {/* Tab Navigation from Stitch */}
                  <div className="px-6 border-t border-white/10 flex items-center gap-2 overflow-x-auto scrollbar-none">
                    <button
                      type="button"
                      onClick={() => setActiveTab('discussions')}
                      className={`px-4 py-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                        activeTab === 'discussions'
                          ? 'border-cyan-400 text-cyan-300'
                          : 'border-transparent text-neutral-400 hover:text-white'
                      }`}
                    >
                      Discussões
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('pinned')}
                      className={`px-4 py-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                        activeTab === 'pinned'
                          ? 'border-cyan-400 text-cyan-300'
                          : 'border-transparent text-neutral-400 hover:text-white'
                      }`}
                    >
                      Tópicos Fixados 📌
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('media')}
                      className={`px-4 py-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                        activeTab === 'media'
                          ? 'border-cyan-400 text-cyan-300'
                          : 'border-transparent text-neutral-400 hover:text-white'
                      }`}
                    >
                      Fotos &amp; Mídia
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('members')}
                      className={`px-4 py-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                        activeTab === 'members'
                          ? 'border-cyan-400 text-cyan-300'
                          : 'border-transparent text-neutral-400 hover:text-white'
                      }`}
                    >
                      Membros ({community.members_count || 1})
                    </button>
                  </div>
                </div>

                {/* Scoped Composer for this Community */}
                <CreatePostForm
                  onPostCreated={handlePostCreated}
                  defaultCommunityId={community.id}
                />

                {/* Scoped Posts Feed */}
                {posts.length === 0 ? (
                  <div className="glass-surface rounded-2xl p-10 text-center space-y-2 border border-white/10">
                    <h3 className="text-sm font-semibold text-white">Nenhum tópico ainda</h3>
                    <p className="text-xs text-neutral-400">
                      Inicie a primeira discussão em e/{community.name}!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {posts.map((post) => (
                      <PostCard key={post.id} post={post} />
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          {/* Right Sidebar: Contexto da Comunidade (Stitch Specification) */}
          <aside className="hidden xl:flex flex-col gap-6 sticky top-20">
            {/* Sobre a Comunidade */}
            <section className="glass-surface rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between pb-1 border-b border-white/10">
                <h3 className="text-sm font-display font-bold text-white">Regras da Casa</h3>
                <span className="material-symbols-outlined text-neutral-400 text-[18px]">gavel</span>
              </div>
              <ul className="text-xs text-neutral-300 space-y-2 font-sans">
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">1.</span>
                  <span>Seja gentil e respeite as memórias alheias.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">2.</span>
                  <span>Sem correntes ou mensagens falsas de spam.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">3.</span>
                  <span>Scraps nostálgicos são sempre bem-vindos!</span>
                </li>
              </ul>
            </section>

            {/* Moderadores */}
            <section className="glass-surface rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between pb-1 border-b border-white/10">
                <h3 className="text-sm font-display font-bold text-white">Moderadores</h3>
                <span className="text-[10px] text-cyan-300 font-semibold bg-cyan-400/10 px-2 py-0.5 rounded-full">
                  Equipe
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold uppercase">
                    {community?.owner_name ? community.owner_name.charAt(0) : 'M'}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">
                      @{community?.owner_name || 'criador'}
                    </p>
                    <p className="text-[10px] text-neutral-400">Criador da comunidade</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Outras Comunidades */}
            <section className="glass-surface rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between pb-1 border-b border-white/10">
                <h3 className="text-sm font-display font-bold text-white">Descobrir Mais</h3>
                <Link to="/comunidades" className="text-xs text-cyan-300 hover:underline">
                  Ver todas
                </Link>
              </div>
              <div className="flex flex-col gap-2">
                {allCommunities
                  .filter((c) => c.slug !== slug && String(c.id) !== slug)
                  .slice(0, 3)
                  .map((c) => (
                    <Link
                      key={c.id}
                      to={`/e/${c.slug || c.id}`}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-colors group"
                    >
                      <span className="text-xs font-semibold text-neutral-300 group-hover:text-cyan-300 truncate">
                        e/{c.name}
                      </span>
                      <span className="text-[10px] text-neutral-500">
                        {c.members_count} membros
                      </span>
                    </Link>
                  ))}
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
};
