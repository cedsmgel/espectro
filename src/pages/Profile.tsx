import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { authStorage, Post, postsApi, profileApi, UserProfile } from '../lib/api';
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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Carrega informações públicas reais do perfil no D1
  const loadProfile = async () => {
    if (!targetUsername) {
      setLoadingProfile(false);
      return;
    }
    setLoadingProfile(true);
    try {
      const data = await profileApi.get(targetUsername);
      setUserProfile(data);
    } catch (err) {
      console.warn('Erro ao carregar dados do perfil:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  // Carrega as publicações do usuário
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
    loadProfile();
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

  const handleUpdatePost = (updatedPost: Post) => {
    setPosts((prev) => prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
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

  const usernameHandle = userProfile?.username || targetUsername || 'usuario';
  const fullName = userProfile?.name || null;
  const initialLetter = (fullName || usernameHandle).charAt(0).toUpperCase();
  const totalUpvotes = posts.reduce((acc, p) => acc + (p.upvotes || 0), 0);
  const isLockedPrivate = Boolean(userProfile?.is_private && !isSelf && !userProfile?.is_friend);

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
            {/* 1. Header do Perfil (Totalmente Conectado aos Dados Reais do D1) */}
            <div className="bg-surface-container-lowest rounded-3xl p-6 sm:p-8 shadow-sm border border-outline-variant/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="flex items-center gap-5 min-w-0">
                <div className="relative shrink-0">
                  {userProfile?.avatar_url ? (
                    <img
                      src={userProfile.avatar_url}
                      alt={usernameHandle}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover shadow-md ring-4 ring-surface-container-low"
                    />
                  ) : (
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-primary to-secondary text-on-primary flex items-center justify-center font-bold text-3xl sm:text-4xl uppercase shadow-md ring-4 ring-surface-container-low">
                      {initialLetter}
                    </div>
                  )}
                  <span className="absolute bottom-1 right-1 w-4 h-4 bg-olive rounded-full ring-4 ring-surface-container-lowest" />
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {fullName ? (
                      <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-on-surface truncate">
                          {fullName}
                        </h1>
                        <span className="text-xs text-primary font-medium">
                          @{usernameHandle}
                        </span>
                      </div>
                    ) : (
                      <h1 className="text-xl sm:text-2xl font-bold text-on-surface truncate">
                        @{usernameHandle}
                      </h1>
                    )}

                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                      Membro do Espectro
                    </span>

                    {userProfile?.is_private && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-semibold flex items-center gap-1 border border-amber-500/20">
                        <span className="material-symbols-outlined text-[13px]">lock</span>
                        <span>Perfil Privado</span>
                      </span>
                    )}
                  </div>

                  {/* Biografia Real */}
                  {userProfile?.bio ? (
                    <p className="text-xs text-on-surface mt-2 max-w-xl whitespace-pre-line leading-relaxed">
                      {userProfile.bio}
                    </p>
                  ) : isSelf ? (
                    <Link
                      to="/settings/profile"
                      className="text-xs text-primary hover:underline mt-1.5 flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">add_circle</span>
                      <span>Adicionar uma biografia ao seu perfil</span>
                    </Link>
                  ) : (
                    <p className="text-xs text-on-surface-variant mt-1 italic">
                      Nenhuma biografia informada ainda.
                    </p>
                  )}

                  {!isLockedPrivate && (
                    <div className="flex items-center gap-4 mt-3 text-xs text-on-surface-variant">
                      <div>
                        <strong className="text-on-surface font-bold">{posts.length}</strong>{' '}
                        {posts.length === 1 ? 'publicação' : 'publicações'}
                      </div>
                      <div>
                        <strong className="text-primary font-bold">▲ {totalUpvotes}</strong> upvotes recebidos
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Ações do Perfil */}
              {isSelf ? (
                <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                  <Link
                    to="/settings/profile"
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-full bg-surface-container-low text-on-surface hover:bg-surface-container font-semibold text-xs transition-colors border border-outline-variant/30 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
                    <span>Editar Perfil</span>
                  </Link>

                  <Link
                    to="/settings/account"
                    className="p-2.5 rounded-full bg-surface-container-low text-on-surface hover:bg-surface-container font-semibold text-xs transition-colors border border-outline-variant/30 flex items-center justify-center cursor-pointer"
                    title="Configurações de Privacidade da Conta"
                  >
                    <span className="material-symbols-outlined text-[18px]">shield</span>
                  </Link>

                  <Link
                    to="/"
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-full bg-primary-container text-on-primary font-semibold text-xs hover:bg-primary transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
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
                    className="px-3.5 py-2.5 rounded-full bg-surface-container-high text-on-surface hover:text-error hover:bg-error-container/20 font-semibold text-xs transition-colors cursor-pointer"
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

            {/* 2. Mural de Publicações / Bloqueio de Perfil Privado */}
            {isLockedPrivate ? (
              <div className="bg-surface-container-lowest rounded-3xl p-8 sm:p-12 border border-outline-variant/30 shadow-xs flex flex-col items-center justify-center text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center text-primary border border-outline-variant/30">
                  <span className="material-symbols-outlined text-[36px]">lock</span>
                </div>
                <div className="max-w-md">
                  <h2 className="text-lg font-bold text-on-surface">Este perfil é privado</h2>
                  <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
                    As publicações, fotos e scraps de @{usernameHandle} são visíveis apenas para amigos confirmados.
                    Envie uma mensagem direta para adicionar como amigo e desbloquear o mural.
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <Link
                    to="/mensagens"
                    className="px-5 py-2.5 rounded-full bg-primary-container text-on-primary font-semibold text-xs hover:bg-primary transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">chat_bubble</span>
                    <span>Enviar Mensagem Direta</span>
                  </Link>
                </div>
              </div>
            ) : (
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
                        onUpdate={handleUpdatePost}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
