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
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <Header />
      <SidebarNav />

      <div className="pl-0 md:pl-[72px] pt-16 flex-1 flex flex-col">
        <main className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 flex-1">
          <section className="flex flex-col gap-6 max-w-4xl mx-auto min-w-0">
            {loading ? (
              <div className="bg-surface-container-lowest rounded-2xl p-12 text-center text-on-surface-variant border border-outline-variant/30 shadow-sm">
                <span className="material-symbols-outlined text-[36px] text-primary animate-spin">
                  progress_activity
                </span>
                <p className="mt-2 text-xs">Carregando detalhes de e/{slug}...</p>
              </div>
            ) : !community ? (
              <div className="bg-surface-container-lowest rounded-2xl p-10 text-center space-y-3 border border-outline-variant/30 shadow-sm">
                <h2 className="text-xl font-bold text-on-surface">
                  Comunidade não encontrada
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Esta comunidade não existe ou o endereço digitado está incorreto.
                </p>
                <Link
                  to="/comunidades"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary-container text-on-primary text-xs font-semibold hover:bg-primary shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                  <span>Ver todas as comunidades</span>
                </Link>
              </div>
            ) : (
              <>
                {/* Community Header Banner */}
                <div className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm border border-outline-variant/30">
                  {/* Subtle Gradient Cover */}
                  <div className="h-36 sm:h-44 w-full bg-gradient-to-r from-primary via-secondary to-primary-container relative p-4 flex items-end justify-between">
                    <span className="text-[11px] font-semibold text-white/80 bg-black/30 backdrop-blur-md px-3 py-1 rounded-full">
                      Espaço Oficial e/{community.slug || community.id}
                    </span>
                  </div>

                  {/* Profile & Info Bar */}
                  <div className="px-6 pb-6 pt-0 relative flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12">
                      <div className="flex items-end gap-4">
                        <div className="w-24 h-24 rounded-2xl p-1 bg-surface-container-lowest shadow-md">
                          <div className="w-full h-full rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center font-bold text-3xl text-white">
                            {community.name.charAt(0).toUpperCase()}
                          </div>
                        </div>
                        <div className="flex flex-col pb-1">
                          <h1 className="text-xl sm:text-2xl font-bold text-on-surface flex items-center gap-2">
                            <span>e/{community.name}</span>
                            <span className="material-symbols-outlined text-primary text-[20px]">
                              verified
                            </span>
                          </h1>
                          <span className="text-xs text-on-surface-variant">
                            {community.members_count || 1} membros ativos no Espectro
                          </span>
                        </div>
                      </div>

                      {/* Join / Participar Button */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleJoin}
                          disabled={joining}
                          className={`px-5 py-2 rounded-full font-semibold text-xs transition-all shadow-xs cursor-pointer ${
                            isMember
                              ? 'bg-surface-container-high text-on-surface'
                              : 'bg-primary-container text-on-primary hover:bg-primary'
                          }`}
                        >
                          {joining ? 'Processando...' : isMember ? 'Membro Ativo' : '+ Entrar na Comunidade'}
                        </button>
                      </div>
                    </div>

                    {/* Community Description */}
                    {community.description && (
                      <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed max-w-3xl pt-2">
                        {community.description}
                      </p>
                    )}

                    {/* Sub-tabs inside community */}
                    <div className="flex items-center gap-4 pt-4 border-t border-outline-variant/20 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setActiveTab('discussions')}
                        className={`pb-2 relative cursor-pointer ${
                          activeTab === 'discussions' ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        Discussões ({posts.length})
                        {activeTab === 'discussions' && (
                          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('members')}
                        className={`pb-2 relative cursor-pointer ${
                          activeTab === 'members' ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        Membros
                        {activeTab === 'members' && (
                          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Composer for this specific community */}
                <CreatePostForm
                  onPostCreated={handlePostCreated}
                  defaultCommunityId={community.id}
                  communities={allCommunities}
                />

                {/* Community Posts */}
                {posts.length === 0 ? (
                  <div className="bg-surface-container-lowest rounded-2xl p-12 text-center text-on-surface-variant border border-outline-variant/30 shadow-sm">
                    <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40 mb-2">
                      forum
                    </span>
                    <h3 className="font-semibold text-sm text-on-surface">
                      Nenhum tópico criado nesta comunidade ainda
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-1">
                      Inicie uma discussão preenchendo o formulário acima!
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {posts.map((post) => (
                      <PostCard key={post.id} post={post} />
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </main>
      </div>
    </div>
  );
};
