import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { postsApi, communitiesApi, Post, Community, CreatePostData, authStorage } from '../lib/api';
import { useSidebar } from '../context/SidebarContext';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { PostCard } from '../components/PostCard';
import { PostSkeleton } from '../components/PostSkeleton';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { CreateCommunityModal } from '../components/CreateCommunityModal';
import { RightSidebarSearch } from '../components/RightSidebarSearch';

export const Feed: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { openCreatePostModal } = useSidebar();
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
    <div className="flex min-h-screen w-full bg-background text-on-surface">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-on-surface text-surface px-4 py-2.5 rounded-2xl shadow-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <span className="material-symbols-outlined text-amber-400 text-[18px]">warning</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Header Mobile (Visível apenas em telas pequenas < md) */}
      <Header />

      {/* 2. Coluna Esquerda: Navegação fixa (Tarefa 2: w-20 ou w-64, sticky top-0 h-screen, fluxo real) */}
      <SidebarNav onOpenCreateModal={openCreatePostModal} />

      {/* 3. Coluna Central: Feed (Tarefa 3: flex-1 com div max-w-2xl mx-auto perfeitamente centralizada) */}
      <main className="flex-1 min-w-0 min-h-screen flex flex-col pt-[calc(3.5rem+env(safe-area-inset-top))] md:pt-0 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8">
        <div className="w-full max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">
          {/* Momentos & Canais: avatares flutuando direto no fundo, sem caixa */}
          <div className="-mx-3 sm:mx-0">
            <div className="flex items-start gap-4 overflow-x-auto px-3 sm:px-0 py-1 scrollbar-none">
              {/* Seu Momento: abre o modal de criação */}
              <button
                type="button"
                onClick={openCreatePostModal}
                className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group"
              >
                <div className="relative w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center group-hover:scale-105 transition-transform">
                  <span className="text-lg font-bold text-on-surface uppercase">
                    {user ? user.username.charAt(0) : '?'}
                  </span>
                  <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-primary-container text-on-primary flex items-center justify-center text-xs font-bold ring-2 ring-surface">
                    +
                  </span>
                </div>
                <span className="text-[11px] font-medium text-on-surface text-center max-w-[68px] truncate">
                  Seu momento
                </span>
              </button>

              {/* Comunidades reais do D1 como canais */}
              {communities.slice(0, 12).map((c) => (
                <Link
                  key={c.id}
                  to={`/c/${c.slug || c.id}`}
                  className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group"
                >
                  <div
                    className="p-[2px] rounded-full group-hover:scale-105 transition-transform"
                    style={{
                      background: `linear-gradient(135deg, ${c.icon_color || '#6B8E23'}, #2563EB)`,
                    }}
                  >
                    <div className="rounded-full bg-surface p-[2px]">
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-sm text-white"
                        style={{ backgroundColor: c.icon_color || '#6B8E23' }}
                      >
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] text-on-surface-variant text-center max-w-[68px] truncate">
                    {c.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Abas do Feed fixas no topo da lista (Tarefa 5: dentro de max-w-2xl mx-auto) */}
          <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] md:top-0 z-20 -mx-4 px-4 bg-surface/85 backdrop-blur-md border-b border-outline-variant/40 flex items-center justify-between">
            <div className="flex items-center gap-6 sm:gap-8">
              {(
                [
                  { key: 'foryou', label: 'Para Você', params: {} },
                  { key: 'following', label: 'Seguindo', params: {} },
                  { key: 'trending', label: 'Em Alta 🔥', params: { filter: 'trending' } },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.key);
                    setSearchParams(tab.params as Record<string, string>);
                  }}
                  className={`relative py-3 text-sm font-semibold transition-colors cursor-pointer ${
                    activeTab === tab.key ? 'text-on-surface' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.key && (
                    <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-primary-container rounded-full" />
                  )}
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-label="Preferências do feed"
              className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">tune</span>
            </button>
          </div>

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
              message="Não conseguimos carregar as publicações neste momento. Verifique sua conexão e tente novamente."
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
        </div>
      </main>

      {/* 4. Coluna Direita: Widgets (Tarefa 4: w-80, sticky top-0 h-screen, pt-4, hidden lg:flex) */}
      <aside className="w-72 hidden xl:flex flex-col fixed right-0 top-0 h-screen pt-4 px-4 overflow-y-auto border-l border-outline-variant/15 gap-4">
        {/* Barra de Pesquisa Global */}
        <RightSidebarSearch />

        {/* Card 1: Comunidades em Alta (D1) */}
        <div className="bg-surface-container-lowest/80 dark:bg-[#121212] rounded-2xl p-3.5 sm:p-4 border border-outline-variant/15 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[18px]">local_fire_department</span>
              <h2 className="font-bold text-xs sm:text-sm text-on-surface">Comunidades em Alta</h2>
            </div>
            <button
              type="button"
              onClick={() => setShowCommunityModal(true)}
              className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[13px]">add</span>
              <span>Criar</span>
            </button>
          </div>

          {communities.length === 0 ? (
            <div className="p-3 text-center text-on-surface-variant text-xs bg-surface-container-low rounded-xl">
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant/40 mb-1">
                group_off
              </span>
              <p className="font-medium text-on-surface text-[11px]">Nenhuma comunidade ainda</p>
              <p className="mt-0.5 text-[10px]">Seja o primeiro a fundar uma comunidade no Espectro!</p>
              <button
                type="button"
                onClick={() => setShowCommunityModal(true)}
                className="mt-2 px-2.5 py-1 rounded-full bg-primary-container text-on-primary font-semibold text-[10px] hover:bg-primary cursor-pointer shadow-xs"
              >
                + Criar Comunidade
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {communities.slice(0, 5).map((c, idx) => (
                <div key={c.id} className="flex items-center justify-between gap-1.5 group">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold text-on-surface-variant w-3.5 text-center">
                      #{idx + 1}
                    </span>
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs flex-shrink-0 shadow-xs"
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
                      <span className="text-[10px] text-on-surface-variant truncate">
                        {c.members_count} {c.members_count === 1 ? 'membro' : 'membros'}
                      </span>
                    </div>
                  </div>
                  <Link
                    to={`/c/${c.slug || c.id}`}
                    className="px-2.5 py-0.5 rounded-full bg-surface-container text-primary text-[11px] font-semibold hover:bg-primary hover:text-on-primary transition-all flex-shrink-0 shadow-xs"
                  >
                    Ver
                  </Link>
                </div>
              ))}
            </div>
          )}

          <Link
            to="/comunidades"
            className="pt-2 border-t border-outline-variant/15 text-[11px] font-semibold text-primary hover:underline text-center block"
          >
            Explorar todas as comunidades →
          </Link>
        </div>

        {/* Card 2: Comunidades Ativas (D1) */}
        <div className="bg-surface-container-lowest/80 dark:bg-[#121212] rounded-2xl p-3.5 sm:p-4 border border-outline-variant/15 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">groups</span>
              <h2 className="font-bold text-xs sm:text-sm text-on-surface">Comunidades Ativas</h2>
            </div>
            <span className="text-[10px] font-medium text-on-surface-variant">
              {communities.length} {communities.length === 1 ? 'comunidade' : 'comunidades'}
            </span>
          </div>

          {communities.length <= 5 ? (
            <div className="text-xs text-on-surface-variant bg-surface-container-low p-3 rounded-xl text-center space-y-0.5">
              <p className="font-medium text-on-surface text-[11px]">Conecte-se com interesses mútuos</p>
              <p className="text-[10px]">Entre nas comunidades acima ou crie uma nova para seu grupo.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {communities.slice(5, 10).map((c) => (
                <Link
                  key={c.id}
                  to={`/c/${c.slug || c.id}`}
                  className="flex items-center justify-between p-1.5 rounded-xl hover:bg-surface-container transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center font-bold text-white text-[9px] flex-shrink-0"
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

        {/* Rodapé sutil estilo Twitter */}
        <div className="px-2 py-3 text-[11px] text-on-surface-variant/70 flex flex-wrap gap-x-3 gap-y-1">
          <a href="#" className="hover:underline">Termos</a>
          <a href="#" className="hover:underline">Privacidade</a>
          <a href="#" className="hover:underline">Diretrizes</a>
          <span>© 2026 Espectro Inc.</span>
        </div>
      </aside>

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
