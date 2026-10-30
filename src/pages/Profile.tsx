import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { authStorage, Post, postsApi } from '../lib/api';
import { useSidebar } from '../context/SidebarContext';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { PostCard } from '../components/PostCard';
import { PostSkeleton } from '../components/PostSkeleton';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { username: paramUsername } = useParams<{ username?: string }>();
  const { isExpanded } = useSidebar();
  const loggedUser = authStorage.getUser();

  const isSelf = !paramUsername || (loggedUser && loggedUser.username.toLowerCase() === paramUsername.toLowerCase());
  const targetUsername = paramUsername || (loggedUser ? loggedUser.username : null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const loadUserPosts = async () => {
    if (!targetUsername) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setHasError(false);
    try {
      const token = authStorage.getToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/posts?author_name=${encodeURIComponent(targetUsername)}`, {
        headers,
      });
      if (!res.ok) {
        throw new Error(`Erro ao buscar publicações [status: ${res.status}]`);
      }
      const data: Post[] = await res.json();
      setPosts(data || []);
      setHasError(false);
    } catch (err) {
      console.error('Erro ao carregar publicações do perfil:', err);
      setHasError(true);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserPosts();
  }, [targetUsername]);

  const handleVote = async (postId: number, voteType: 'up' | 'down') => {
    try {
      await postsApi.vote(postId, voteType);
    } catch (err) {
      console.error('Erro ao votar:', err);
    }
  };

  const handleDeletePost = (deletedId: number) => {
    setPosts((prev) => prev.filter((p) => p.id !== deletedId));
  };

  if (!loggedUser && !paramUsername) {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex flex-col">
        <Header />
        <SidebarNav />
        <div
          className={`pt-16 flex-1 flex items-center justify-center p-6 transition-all duration-300 ease-in-out ${
            isExpanded ? 'pl-0 md:pl-64' : 'pl-0 md:pl-[72px]'
          }`}
        >
          <EmptyState
            icon="account_circle"
            title="Acesse seu perfil"
            description="Faça login com sua conta para gerenciar seu mural, seus scraps e suas publicações no Espectro."
            actionLabel="Entrar ou Cadastrar"
            actionLink="/login"
            className="max-w-md w-full"
          />
        </div>
      </div>
    );
  }

  const displayName = targetUsername || 'Usuário';
  const totalUpvotes = posts.reduce((acc, p) => acc + (p.upvotes || 0), 0);

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <Header />
      <SidebarNav />

      <div
        className={`pt-16 min-h-screen flex flex-col justify-between transition-all duration-300 ease-in-out ${
          isExpanded ? 'pl-0 md:pl-64' : 'pl-0 md:pl-[72px]'
        }`}
      >
        <main className="w-full bg-surface py-6">
          <div className="w-full max-w-5xl mx-auto px-4 md:px-6 lg:px-8 flex flex-col gap-8">
            {/* 1. Header do Perfil (Totalmente Conectado ao D1) */}
            <div className="bg-surface-container-lowest rounded-3xl p-6 sm:p-8 shadow-sm border border-outline-variant/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="flex items-center gap-5 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-primary to-secondary text-on-primary flex items-center justify-center font-bold text-3xl sm:text-4xl uppercase shadow-md">
                    {displayName.charAt(0)}
                  </div>
                  <span className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 rounded-full ring-4 ring-surface-container-lowest" />
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-bold text-on-surface truncate">
                      @{displayName}
                    </h1>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                      Membro do Espectro
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Espaço pessoal no Visible Spectrum Social
                  </p>

                  <div className="flex items-center gap-4 mt-3 text-xs text-on-surface-variant">
                    <div>
                      <strong className="text-on-surface font-bold">{posts.length}</strong>{' '}
                      {posts.length === 1 ? 'publicação' : 'publicações'}
                    </div>
                    <div>
                      <strong className="text-primary font-bold">▲ {totalUpvotes}</strong> upvotes recebidos
                    </div>
                  </div>
                </div>
              </div>

              {isSelf ? (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Link
                    to="/"
                    className="flex-1 sm:flex-none px-5 py-2.5 rounded-full bg-primary-container text-on-primary font-semibold text-xs hover:bg-primary transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit_note</span>
                    <span>Novo Post</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      authStorage.clear();
                      navigate('/login');
                    }}
                    className="px-4 py-2.5 rounded-full bg-surface-container-high text-on-surface hover:text-error hover:bg-error-container/20 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Sair
                  </button>
                </div>
              ) : (
                <Link
                  to="/mensagens"
                  className="px-5 py-2.5 rounded-full bg-primary-container text-on-primary font-semibold text-xs hover:bg-primary transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">chat_bubble</span>
                  <span>Enviar Mensagem</span>
                </Link>
              )}
            </div>

            {/* 2. Mural de Publicações do Usuário */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[22px]">auto_stories</span>
                  <h2 className="font-bold text-base text-on-surface">Mural de Publicações</h2>
                </div>
                <span className="text-xs text-on-surface-variant">
                  {posts.length} {posts.length === 1 ? 'post' : 'posts'}
                </span>
              </div>

              {loading ? (
                <div className="flex flex-col gap-4">
                  <PostSkeleton />
                  <PostSkeleton />
                </div>
              ) : hasError ? (
                <ErrorState
                  title="Erro ao sincronizar com o banco D1"
                  message="Não foi possível recuperar as postagens deste usuário neste momento."
                  onRetry={loadUserPosts}
                />
              ) : posts.length === 0 ? (
                /* EMPTY STATE EXCLUSIVO */
                <EmptyState
                  icon="auto_stories"
                  title="Mural vazio."
                  description="Ninguém deixou um recadinho ainda. Mande um scrap para um amigo para começar."
                  actionLabel={isSelf ? "Criar primeiro post" : "Explorar o Feed"}
                  onAction={() => navigate('/')}
                  className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-8"
                />
              ) : (
                <div className="flex flex-col gap-5">
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onVote={handleVote}
                      onDelete={handleDeletePost}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
