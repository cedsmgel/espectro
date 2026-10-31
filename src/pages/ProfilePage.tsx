import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  authStorage,
  Community,
  friendshipsApi,
  Post,
  postsApi,
  UserProfile,
  usersApi,
} from '../lib/api';
import { useSidebar } from '../context/SidebarContext';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { PostCard } from '../components/PostCard';
import { PostSkeleton } from '../components/PostSkeleton';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { username } = useParams<{ username?: string }>();
  const { isExpanded } = useSidebar();
  const loggedUser = authStorage.getUser();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [addingFriend, setAddingFriend] = useState(false);
  const [friendActionSuccess, setFriendActionSuccess] = useState<string | null>(null);

  const targetUsername = username || (loggedUser ? loggedUser.username : null);

  // Carrega perfil via GET /api/users/:username (ou /api/profile para si mesmo)
  const loadUserData = async () => {
    if (!targetUsername) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setHasError(false);

    try {
      const data = await usersApi.getByUsername(targetUsername);
      setUserProfile(data.user);
      setCommunities(data.communities || []);
    } catch (err: any) {
      console.error('Erro ao carregar usuário:', err);
      setHasError(true);
    } finally {
      setLoading(false);
    }
  };

  // Carrega publicações públicas do usuário
  const loadUserPosts = async () => {
    if (!targetUsername) {
      setLoadingPosts(false);
      return;
    }

    setLoadingPosts(true);
    try {
      const token = authStorage.getToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/posts?author_name=${encodeURIComponent(targetUsername)}`, {
        headers,
      });

      if (!res.ok) {
        throw new Error(`Erro ao buscar publicações (${res.status})`);
      }

      const data: Post[] = await res.json();
      setPosts(data || []);
    } catch (err) {
      console.error('Erro ao buscar posts:', err);
      setPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  };

  useEffect(() => {
    loadUserData();
    loadUserPosts();
  }, [targetUsername]);

  const handleAddFriend = async () => {
    if (!loggedUser) {
      navigate('/login');
      return;
    }
    if (!userProfile) return;

    setAddingFriend(true);
    try {
      const res = await friendshipsApi.addFriend(userProfile.username);
      setFriendActionSuccess(res.message || 'Solicitação de amizade processada!');
      setUserProfile((prev) =>
        prev
          ? {
              ...prev,
              is_friend: true,
              friendship_status: 'accepted',
            }
          : null
      );
      setTimeout(() => setFriendActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Erro ao adicionar amigo.');
    } finally {
      setAddingFriend(false);
    }
  };

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

  if (!loggedUser && !username) {
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
            title="Acesse um perfil público"
            description="Faça login com sua conta do Espectro para explorar e interagir com perfis e murais de amigos."
            actionLabel="Entrar ou Cadastrar"
            actionLink="/login"
            className="max-w-md w-full"
          />
        </div>
      </div>
    );
  }

  if (hasError && !loading) {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex flex-col">
        <Header />
        <SidebarNav />
        <div
          className={`pt-16 flex-1 flex items-center justify-center p-6 transition-all duration-300 ease-in-out ${
            isExpanded ? 'pl-0 md:pl-64' : 'pl-0 md:pl-[72px]'
          }`}
        >
          <ErrorState
            title="Usuário não encontrado"
            message={`Não encontramos nenhuma conta com o nome de usuário @${targetUsername} no banco do Espectro.`}
            onRetry={loadUserData}
          />
        </div>
      </div>
    );
  }

  const isSelf = userProfile?.is_self ?? (loggedUser && userProfile ? loggedUser.id === userProfile.id : false);
  const usernameHandle = userProfile?.username || targetUsername || 'usuario';
  const fullName = userProfile?.name || null;
  const initialLetter = (fullName || usernameHandle).charAt(0).toUpperCase();
  const totalUpvotes = posts.reduce((acc, p) => acc + (p.upvotes || 0), 0);
  const isLockedPrivate = Boolean(userProfile?.is_private && !isSelf && !userProfile?.is_friend);

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <Header />
      <SidebarNav />

      {/* Toast Feedback */}
      {friendActionSuccess && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
          <span>{friendActionSuccess}</span>
        </div>
      )}

      <div
        className={`pt-16 min-h-screen flex flex-col justify-between transition-all duration-300 ease-in-out ${
          isExpanded ? 'pl-0 md:pl-64' : 'pl-0 md:pl-[72px]'
        }`}
      >
        <main className="w-full bg-surface pt-4 pb-24 md:pb-8">
          <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 flex flex-col gap-6 sm:gap-8">
            {/* 1. Header do Perfil Público com Dados Reais */}
            <div className="bg-surface-container-lowest rounded-3xl p-4 sm:p-8 shadow-sm border border-outline-variant/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 sm:gap-6">
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

                    {userProfile?.is_friend && !isSelf && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold flex items-center gap-1 border border-emerald-500/20">
                        <span className="material-symbols-outlined text-[13px]">how_to_reg</span>
                        <span>Amigos</span>
                      </span>
                    )}

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
                      {communities.length > 0 && (
                        <div>
                          <strong className="text-secondary font-bold">{communities.length}</strong>{' '}
                          {communities.length === 1 ? 'comunidade' : 'comunidades'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Botões de Ação do Perfil: Amizade, Mensagem ou Edição */}
              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                {isSelf ? (
                  <>
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
                  </>
                ) : userProfile?.is_friend ? (
                  /* Usuários Já São Amigos: Botão Enviar Mensagem Direta */
                  <Link
                    to={`/mensagens?u=${encodeURIComponent(username || '')}`}
                    className="flex-1 sm:flex-none px-5 py-2.5 rounded-full bg-primary-container text-on-primary font-semibold text-xs hover:bg-primary transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">chat_bubble</span>
                    <span>Enviar Mensagem</span>
                  </Link>
                ) : (
                  /* Usuários NÃO São Amigos: Botão Adicionar Amigo */
                  <button
                    type="button"
                    onClick={handleAddFriend}
                    disabled={addingFriend}
                    className="flex-1 sm:flex-none px-5 py-2.5 rounded-full bg-primary-container text-on-primary font-semibold text-xs hover:bg-primary transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {addingFriend ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="material-symbols-outlined text-[18px]">person_add</span>
                    )}
                    <span>{addingFriend ? 'Adicionando...' : 'Adicionar Amigo'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* 2. Música do Perfil (se houver cadastrada) */}
            {userProfile?.music && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900/30 via-indigo-900/20 to-surface-container-low border border-primary/20 flex items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shadow-xs shrink-0 animate-pulse">
                    <span className="material-symbols-outlined text-[20px]">headphones</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      Música do Perfil
                    </span>
                    <span className="text-xs font-semibold text-on-surface truncate">
                      {userProfile.music}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-xs text-primary font-mono shrink-0">
                  <span className="material-symbols-outlined text-[15px] animate-spin">graphic_eq</span>
                  <span className="text-[11px] font-semibold">Espectro Player</span>
                </div>
              </div>
            )}

            {/* 3. Comunidades que ele participa */}
            {communities.length > 0 && !isLockedPrivate && (
              <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-[22px]">groups</span>
                    <h2 className="font-bold text-base text-on-surface">Comunidades de @{usernameHandle}</h2>
                  </div>
                  <span className="text-xs text-on-surface-variant font-medium">
                    {communities.length} {communities.length === 1 ? 'comunidade' : 'comunidades'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {communities.map((c) => (
                    <Link
                      key={c.id}
                      to={`/c/${c.slug || c.id}`}
                      className="p-3 rounded-2xl bg-surface-container-low hover:bg-surface-container transition-all border border-outline-variant/20 flex items-center gap-3 group cursor-pointer"
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0 group-hover:scale-105 transition-transform"
                        style={{ backgroundColor: c.icon_color || '#712ae2' }}
                      >
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-on-surface group-hover:text-primary transition-colors truncate">
                          c/{c.name}
                        </span>
                        <span className="text-[10px] text-on-surface-variant truncate">
                          {c.description || `${c.members_count || 1} membros`}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Mural de Publicações / Scraps Públicos */}
            {isLockedPrivate ? (
              <div className="p-12 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 flex flex-col items-center text-center gap-4 shadow-sm animate-in fade-in">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[32px]">lock</span>
                </div>
                <div className="max-w-md">
                  <h2 className="text-lg font-bold text-on-surface">Este perfil é privado</h2>
                  <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
                    As publicações, fotos e scraps de @{usernameHandle} são visíveis apenas para amigos confirmados.
                    Adicione @{usernameHandle} como amigo para desbloquear o mural.
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    onClick={handleAddFriend}
                    disabled={addingFriend}
                    className="px-5 py-2.5 rounded-full bg-primary-container text-on-primary font-semibold text-xs hover:bg-primary transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">person_add</span>
                    <span>Adicionar Amigo</span>
                  </button>
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

                {loadingPosts ? (
                  <div className="flex flex-col gap-4">
                    <PostSkeleton />
                    <PostSkeleton />
                  </div>
                ) : posts.length === 0 ? (
                  <EmptyState
                    icon="auto_stories"
                    title="Mural vazio."
                    description="Nenhum scrap ou publicação foi deixada aqui ainda."
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
