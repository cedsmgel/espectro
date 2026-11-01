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
import { MomentumBar } from '../components/moments/MomentumBar';
import { FeedPreferences } from '../components/FeedPreferences';
import { TrendingHashtags } from '../components/TrendingHashtags';
import { useFeedPrefs } from '../hooks/useFeedPrefs';

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
  const { prefs, update: updatePrefs, reset: resetPrefs, isCustom } = useFeedPrefs();

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
      const postsPromise = fetch(`/api/posts${user ? (activeTab === 'following' ? '?feed=following' : '?feed=home') : ''}`, {
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

  // Aviso deixado pelo login (ex.: exclusão de conta cancelada)
  useEffect(() => {
    try {
      const notice = sessionStorage.getItem('espectro_notice');
      if (notice) {
        sessionStorage.removeItem('espectro_notice');
        showToast(notice);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadData();
    if (filterParam === 'trending') {
      setActiveTab('trending');
    }
  }, [filterParam, activeTab === 'following']);

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
  const baseFiltered = posts.filter((p) => {
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

  // Preferências do menu de personalização (salvas neste aparelho)
  const hasMedia = (p: Post) => Boolean(p.media_url && p.media_url.trim());
  const filteredPosts = baseFiltered
    .filter((p) => (prefs.show === 'media' ? hasMedia(p) : prefs.show === 'text' ? !hasMedia(p) : true))
    .filter((p) => (prefs.communities === 'hide' ? !p.community_id : true));
  if (prefs.sort === 'top') {
    filteredPosts.sort((a, b) => (b.upvotes || 0) - (b.downvotes || 0) - ((a.upvotes || 0) - (a.downvotes || 0)) || b.id - a.id);
  }

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
          {/* Momentum: avatares flutuando direto no fundo, sem caixa */}
          <div className="-mx-3 sm:mx-0">
            <MomentumBar />
          </div>

          {/* Abas do Feed fixas no topo da lista (Tarefa 5: dentro de max-w-2xl mx-auto) */}
          <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] md:top-0 z-20 -mx-4 px-4 bg-surface/85 backdrop-blur-md border-b border-outline-variant/40 flex items-center justify-between">
            <div className="flex-1 min-w-0 flex items-center gap-5 sm:gap-8 overflow-x-auto scrollbar-none">
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
                  className={`relative shrink-0 py-3 text-sm font-semibold transition-colors cursor-pointer ${
                    activeTab === tab.key ? 'text-on-surface' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.key && <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-primary-container rounded-full" />}
                </button>
              ))}
              {/* No celular não há menu lateral: Vídeos e Comunidades ficam ao lado das abas */}
              <Link to="/shorts" className="md:hidden relative shrink-0 py-3 text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-colors">
                Vídeos
              </Link>
              <Link to="/comunidades" className="md:hidden relative shrink-0 py-3 text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-colors">
                Comunidades
              </Link>
            </div>
            <FeedPreferences prefs={prefs} isCustom={isCustom} onChange={updatePrefs} onReset={resetPrefs} />
          </div>

          {activeTab === 'trending' && <TrendingHashtags />}

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
