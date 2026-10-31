import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { postsApi, communitiesApi, Post, Community, CreatePostData, authStorage } from '../lib/api';
import { useSidebar } from '../context/SidebarContext';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { CreatePostForm } from '../components/CreatePostForm';
import { PostCard } from '../components/PostCard';
import { PostSkeleton } from '../components/PostSkeleton';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { CreateCommunityModal } from '../components/CreateCommunityModal';

export const Feed: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isExpanded } = useSidebar();
  const user = authStorage.getUser();
  const [posts, setPosts] = useState<Post[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [activeTab, setActiveTab] = useState<'foryou' | 'following' | 'trending'>('foryou');
  const [showCommunityModal, setShowCommunityModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const queryParam = searchParams.get('q');
  const typeParam = searchParams.get('type');
  const filterParam = searchParams.get('filter');

  const loadData = async () => {
    setLoading(true);
    setHasError(false);
    try {
      const token = authStorage.getToken();
      const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      // 1. Busca posts reais via fetch('/api/posts')
      const postsPromise = fetch(`/api/posts${user ? '?feed=home' : ''}`, {
        headers: authHeaders,
      }).then(async (res) => {
        if (!res.ok) {
          throw new Error(`Erro ao buscar posts [status: ${res.status}]`);
        }
        return res.json() as Promise<Post[]>;
      });

      // 2. Busca catálogo de comunidades reais do D1 via fetch('/api/communities')
      const commsPromise = fetch('/api/communities', {
        headers: authHeaders,
      }).then(async (res) => {
        if (!res.ok) {
          throw new Error(`Erro ao buscar comunidades [status: ${res.status}]`);
        }
        return res.json() as Promise<Community[]>;
      });

      const [fetchedPosts, fetchedCommunities] = await Promise.all([postsPromise, commsPromise]);
      setPosts(fetchedPosts || []);
      setCommunities(fetchedCommunities || []);
      setHasError(false);
    } catch (err: any) {
      console.error('Erro ao conectar com API do D1 no feed:', err);
      setHasError(true);
      showToast('Erro ao sincronizar com o banco de dados. Tente recarregar.');
      setPosts([]);
      setCommunities([]);
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

  useEffect(() => {
    const handleGlobalPostCreated = (e: Event) => {
      const customEvent = e as CustomEvent<Post>;
      if (customEvent.detail) {
        const newPost = customEvent.detail;
        setPosts((prev) => [newPost, ...prev.filter((p) => p.id !== newPost.id)]);
      }
    };
    window.addEventListener('espectro:post-created', handleGlobalPostCreated);
    return () => window.removeEventListener('espectro:post-created', handleGlobalPostCreated);
  }, []);

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

  const handleDeletePost = (deletedId: number) => {
    setPosts((prev) => prev.filter((p) => p.id !== deletedId));
  };

  const handleUpdatePost = (updatedPost: Post) => {
    setPosts((prev) => prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
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
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-on-surface text-surface px-4 py-2.5 rounded-2xl shadow-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <span className="material-symbols-outlined text-amber-400 text-[18px]">warning</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Header Global */}
      <Header />

      {/* 2. Barra Lateral Compacta (72px) */}
      <SidebarNav />

      {/* 3. Container Principal Expandido com transição suave */}
      <div
        className={`pt-16 min-h-screen flex flex-col justify-between transition-all duration-300 ease-in-out ${
          isExpanded ? 'pl-0 md:pl-64' : 'pl-0 md:pl-[72px]'
        }`}
      >
        <main className="w-full bg-surface py-6">
          <div className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* FEED CENTRAL (Colunas 1 a 8) */}
              <section className="lg:col-span-8 flex flex-col gap-6 min-w-0">
                {/* Momentos do Espectro (Stories / Canais Vivos) */}
                <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/30 overflow-hidden">
                  <div className="flex items-center justify-between pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-secondary-container animate-pulse" />
                      <h2 className="font-semibold text-sm text-on-surface">
                        Momentos & Canais
                      </h2>
                    </div>
                    <Link to="/comunidades" className="text-on-surface-variant text-xs hover:text-primary">
                      Ver catálogo
                    </Link>
                  </div>
                  <div className="flex items-center gap-4 overflow-x-auto pb-1 scrollbar-none">
                    {/* Criar Story / Seu Momento */}
                    <div className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group">
                      <div className="relative w-14 h-14 rounded-full bg-surface-container flex items-center justify-center group-hover:scale-105 transition-transform border border-outline-variant/20">
                        <span className="material-symbols-outlined text-[24px] text-primary">account_circle</span>
                        <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-primary-container text-on-primary flex items-center justify-center text-xs shadow-md font-bold">
                          +
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-on-surface text-center max-w-[64px] truncate">
                        {user ? `@${user.username}` : 'Seu Momento'}
                      </span>
                    </div>

                    {/* Comunidades Reais do D1 como Canais */}
                    {communities.slice(0, 8).map((c) => (
                      <Link
                        key={c.id}
                        to={`/c/${c.slug || c.id}`}
                        className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group"
                      >
                        <div
                          className="p-0.5 rounded-full group-hover:scale-105 transition-transform"
                          style={{
                            background: `linear-gradient(135deg, ${c.icon_color || '#712ae2'}, #4f46e5)`,
                          }}
                        >
                          <div className="w-13 h-13 rounded-full bg-surface-container-lowest p-0.5 flex items-center justify-center">
                            <div
                              className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs"
                              style={{ backgroundColor: c.icon_color || '#712ae2' }}
                            >
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] text-on-surface-variant text-center max-w-[68px] truncate">
                          c/{c.name}
                        </span>
                      </Link>
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

                {/* Feed de Publicações com Skeletons, ErrorState e EmptyState */}
                {loading ? (
                  <div className="flex flex-col gap-5">
                    <PostSkeleton />
                    <PostSkeleton />
                    <PostSkeleton />
                  </div>
                ) : hasError ? (
                  <ErrorState
                    title="O Espectro perdeu o sinal com o banco de dados"
                    message="Não conseguimos carregar as publicações do D1 neste momento. Verifique sua conexão e tente novamente."
                    onRetry={loadData}
                  />
                ) : filteredPosts.length === 0 ? (
                  typeParam === 'scrap' ? (
                    <EmptyState
                      icon="mail_lock"
                      title="Mural vazio."
                      description="Ninguém deixou um recadinho ainda. Mande um scrap para um amigo para começar."
                      actionLabel="Criar primeiro post"
                      onAction={() => window.scrollTo({ top: 120, behavior: 'smooth' })}
                    />
                  ) : (
                    <EmptyState
                      icon="forum"
                      title="O Espectro está silencioso..."
                      description="Parece que ninguém postou nada ainda. Seja a primeira voz a ecoar por aqui ou explore as comunidades."
                      actionLabel="Criar primeiro post"
                      onAction={() => window.scrollTo({ top: 120, behavior: 'smooth' })}
                      secondaryActionLabel="Explorar comunidades"
                      secondaryActionLink="/comunidades"
                    />
                  )
                ) : (
                  <div className="flex flex-col gap-5">
                    {filteredPosts.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        onVote={handleVote}
                        onDelete={handleDeletePost}
                        onUpdate={handleUpdatePost}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* COLUNA LATERAL DIREITA (Colunas 9 a 12) */}
              <aside className="lg:col-span-4 flex flex-col gap-6 sticky top-20 hidden lg:flex">
                {/* Card 1: Comunidades em Alta (D1) */}
                <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/30 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary text-[20px]">local_fire_department</span>
                      <h2 className="font-bold text-sm text-on-surface">Comunidades em Alta</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCommunityModal(true)}
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                      <span>Criar</span>
                    </button>
                  </div>

                  {communities.length === 0 ? (
                    <div className="p-4 text-center text-on-surface-variant text-xs bg-surface-container-low rounded-xl">
                      <span className="material-symbols-outlined text-[24px] text-on-surface-variant/40 mb-1">
                        group_off
                      </span>
                      <p className="font-medium text-on-surface">Nenhuma comunidade ainda</p>
                      <p className="mt-1 text-[11px]">Seja o primeiro a fundar uma comunidade no Espectro!</p>
                      <button
                        type="button"
                        onClick={() => setShowCommunityModal(true)}
                        className="mt-2.5 px-3 py-1 rounded-full bg-primary-container text-on-primary font-semibold text-[11px] hover:bg-primary cursor-pointer shadow-xs"
                      >
                        + Criar Comunidade
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {communities.slice(0, 5).map((c, idx) => (
                        <div key={c.id} className="flex items-center justify-between gap-2 group">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-[11px] font-bold text-on-surface-variant w-4 text-center">
                              #{idx + 1}
                            </span>
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-xs flex-shrink-0 shadow-xs"
                              style={{ backgroundColor: c.icon_color || '#712ae2' }}
                            >
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <Link
                                to={`/c/${c.slug || c.id}`}
                                className="text-xs font-semibold text-on-surface truncate group-hover:text-primary transition-colors"
                              >
                                c/{c.name}
                              </Link>
                              <span className="text-[11px] text-on-surface-variant truncate">
                                {c.members_count} {c.members_count === 1 ? 'membro' : 'membros'}
                              </span>
                            </div>
                          </div>
                          <Link
                            to={`/c/${c.slug || c.id}`}
                            className="px-3 py-1 rounded-full bg-surface-container text-primary text-xs font-semibold hover:bg-primary hover:text-on-primary transition-all flex-shrink-0 shadow-xs"
                          >
                            Ver
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}

                  <Link
                    to="/comunidades"
                    className="pt-2 border-t border-outline-variant/20 text-xs font-semibold text-primary hover:underline text-center block"
                  >
                    Explorar todas as comunidades →
                  </Link>
                </div>

                {/* Card 2: Comunidades Ativas (D1) */}
                <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/30 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[20px]">groups</span>
                      <h2 className="font-bold text-sm text-on-surface">Comunidades Ativas</h2>
                    </div>
                    <span className="text-[11px] font-medium text-on-surface-variant">
                      {communities.length} {communities.length === 1 ? 'comunidade' : 'comunidades'}
                    </span>
                  </div>

                  {communities.length <= 5 ? (
                    <div className="text-xs text-on-surface-variant bg-surface-container-low p-3.5 rounded-xl text-center space-y-1">
                      <p className="font-medium text-on-surface">Conecte-se com interesses mútuos</p>
                      <p className="text-[11px]">Entre nas comunidades acima ou crie uma nova para seu grupo.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {communities.slice(5, 10).map((c) => (
                        <Link
                          key={c.id}
                          to={`/c/${c.slug || c.id}`}
                          className="flex items-center justify-between p-2 rounded-xl hover:bg-surface-container transition-colors group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-[10px] flex-shrink-0"
                              style={{ backgroundColor: c.icon_color || '#712ae2' }}
                            >
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-semibold text-on-surface truncate group-hover:text-primary">
                              c/{c.name}
                            </span>
                          </div>
                          <span className="text-[10px] text-on-surface-variant flex-shrink-0">
                            {c.members_count} mem.
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card 3: Visão Geral da Rede (Métricas Reais D1) */}
                <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/30 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">hub</span>
                    <h2 className="font-bold text-sm text-on-surface">Rede Espectro</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="bg-surface-container-low p-3 rounded-xl flex flex-col">
                      <span className="text-lg font-bold text-on-surface">{posts.length}</span>
                      <span className="text-[11px] text-on-surface-variant">Posts Carregados</span>
                    </div>
                    <div className="bg-surface-container-low p-3 rounded-xl flex flex-col">
                      <span className="text-lg font-bold text-on-surface">{communities.length}</span>
                      <span className="text-[11px] text-on-surface-variant">Comunidades</span>
                    </div>
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

      {/* Modal Criar Comunidade */}
      <CreateCommunityModal
        isOpen={showCommunityModal}
        onClose={() => setShowCommunityModal(false)}
        onCommunityCreated={(newComm) => {
          setCommunities((prev) => [newComm, ...prev]);
        }}
      />
    </div>
  );
};
