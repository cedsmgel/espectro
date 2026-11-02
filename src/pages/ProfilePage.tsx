import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  authStorage,
  Community,
  blocksApi,
  friendsApi,
  followsApi,
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
import { ChatMenu, type ChatMenuItem } from '../components/chat/ChatMenu';
import { MomentCreator } from '../components/moments/MomentCreator';
import { ReportModal } from '../components/chat/ReportModal';
import { ShareButton } from '../components/ShareButton';
import { MediaGrid } from '../components/MediaGrid';
import { ProfileDiscover } from '../components/ProfileDiscover';
import { requestAuth } from '../lib/authEvents';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { username } = useParams<{ username?: string }>();
  const { isExpanded } = useSidebar();
  const loggedUser = authStorage.getUser();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  // Aba do mural: fotos e vídeos ficam na grade; o resto (texto e recados) em Publicações
  const [profileTab, setProfileTab] = useState<'midia' | 'posts' | null>(null);
  const mediaPosts = posts.filter((p) => Boolean(p.media_url && p.media_url.trim()));
  const textPosts = posts.filter((p) => !(p.media_url && p.media_url.trim()));
  const activeTab = profileTab ?? (mediaPosts.length > 0 ? 'midia' : 'posts');
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [addingFriend, setAddingFriend] = useState(false);
  const [friendActionSuccess, setFriendActionSuccess] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

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

  const [followBusy, setFollowBusy] = useState(false);
  const [creatingMoment, setCreatingMoment] = useState(false);
  const handleToggleFollow = async () => {
    if (!loggedUser) {
      requestAuth({ mode: 'login', reason: 'Para seguir pessoas, entre ou crie uma conta.' });
      return;
    }
    if (!userProfile) return;
    setFollowBusy(true);
    try {
      const res = userProfile.i_follow ? await followsApi.unfollow(userProfile.id) : await followsApi.follow(userProfile.id);
      setUserProfile((prev) => (prev ? { ...prev, i_follow: res.following, followers_count: res.followers_count } : null));
    } catch (err: any) {
      setFriendActionSuccess(err.message || 'Não foi possível seguir.');
      setTimeout(() => setFriendActionSuccess(null), 4000);
    } finally {
      setFollowBusy(false);
    }
  };

  const handleAddFriend = async () => {
    if (!loggedUser) {
      requestAuth({ mode: 'login', reason: 'Para adicionar amigos, entre ou crie uma conta.' });
      return;
    }
    if (!userProfile) return;

    setAddingFriend(true);
    try {
      const res = await friendsApi.add(userProfile.id, userProfile.username);
      const accepted = res.friend?.status === 'accepted';
      setFriendActionSuccess(res.message || 'Solicitação de amizade processada!');
      setUserProfile((prev) =>
        prev
          ? {
              ...prev,
              is_friend: accepted,
              friendship_status: accepted ? 'accepted' : 'pending',
              friendship_direction: accepted ? prev.friendship_direction : 'outgoing',
              friends_count: accepted ? (prev.friends_count || 0) + 1 : prev.friends_count,
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

  const handleBlock = async () => {
    if (!userProfile) return;
    if (!window.confirm(`Bloquear @${userProfile.username}? Vocês deixam de ser amigos e não poderão se enviar mensagens ou pedidos.`)) {
      return;
    }
    try {
      await blocksApi.block(userProfile.id);
      setUserProfile((prev) =>
        prev
          ? { ...prev, blocked_by_me: true, is_friend: false, friendship_status: null, friendship_direction: null }
          : null
      );
      setFriendActionSuccess(`@${userProfile.username} foi bloqueado.`);
      setTimeout(() => setFriendActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Não foi possível bloquear.');
    }
  };

  const handleUnblock = async () => {
    if (!userProfile) return;
    try {
      await blocksApi.unblock(userProfile.id);
      setUserProfile((prev) => (prev ? { ...prev, blocked_by_me: false } : null));
      setFriendActionSuccess(`@${userProfile.username} foi desbloqueado.`);
      setTimeout(() => setFriendActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Não foi possível desbloquear.');
    }
  };

  // Cancelar pedido enviado, recusar pedido recebido ou desfazer amizade
  const handleRemoveFriendship = async (message: string, confirmText?: string) => {
    if (!userProfile) return;
    if (confirmText && !window.confirm(confirmText)) return;
    setAddingFriend(true);
    try {
      await friendsApi.remove(userProfile.id);
      const wasFriend = userProfile.is_friend;
      setUserProfile((prev) =>
        prev
          ? {
              ...prev,
              is_friend: false,
              friendship_status: null,
              friendship_direction: null,
              friends_count: wasFriend ? Math.max(0, (prev.friends_count || 1) - 1) : prev.friends_count,
            }
          : null
      );
      setFriendActionSuccess(message);
      setTimeout(() => setFriendActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Não foi possível concluir a ação.');
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
          className={`pt-16 md:pt-0 flex-1 flex items-center justify-center p-6 transition-all duration-300 ease-in-out ${
            isExpanded ? 'pl-0 md:pl-20' : 'pl-0 md:pl-20'
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
          className={`pt-16 md:pt-0 flex-1 flex items-center justify-center p-6 transition-all duration-300 ease-in-out ${
            isExpanded ? 'pl-0 md:pl-20' : 'pl-0 md:pl-20'
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
  const memberSince = userProfile?.created_at
    ? new Date(userProfile.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
      })
    : null;
  const friendshipPending = userProfile?.friendship_status === 'pending';
  const isLockedPrivate = Boolean(userProfile?.is_private && !isSelf && !userProfile?.is_friend);

  const showFollowMenu = Boolean(!isSelf && userProfile && !userProfile.blocked_by_me && userProfile.i_follow);

  // Menu do perfil: no perfil de outra pessoa que já é seguida, fica dentro do botão "Seguindo"
  const profileMenuItems: ChatMenuItem[] = userProfile
    ? [
        { key: 'sobre', label: 'Sobre', icon: 'info', onSelect: () => navigate(`/perfil/${encodeURIComponent(userProfile.username)}/sobre`) },
        { key: 'amigos', label: 'Amigos', icon: 'group', onSelect: () => navigate(isSelf ? '/amigos' : `/perfil/${encodeURIComponent(userProfile.username)}/amigos`) },
        { key: 'comunidades', label: 'Comunidades', icon: 'forum', onSelect: () => navigate(`/perfil/${encodeURIComponent(userProfile.username)}/comunidades`) },
        { key: 'melhores', label: 'Melhores amigos', icon: 'star', hidden: !isSelf, onSelect: () => navigate('/melhores-amigos') },
        { key: 'salvos', label: 'Salvos', icon: 'bookmark', hidden: !isSelf, onSelect: () => navigate(`/perfil/${encodeURIComponent(userProfile.username)}/salvos`) },
        { key: 'atividade', label: 'Sua atividade', icon: 'history', hidden: !isSelf, onSelect: () => navigate('/atividade') },
        { key: 'report', label: 'Denunciar', icon: 'flag', danger: true, hidden: isSelf || !loggedUser, onSelect: () => setShowReport(true) },
        userProfile.blocked_by_me
          ? { key: 'unblock', label: 'Desbloquear', icon: 'lock_open', hidden: isSelf || !loggedUser, onSelect: handleUnblock }
          : { key: 'block', label: 'Bloquear', icon: 'block', danger: true, hidden: isSelf || !loggedUser, onSelect: handleBlock },
      ]
    : [];

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <Header />
      <SidebarNav />

      {showReport && userProfile && (
        <ReportModal
          userId={userProfile.id}
          username={userProfile.username}
          alreadyBlocked={Boolean(userProfile.blocked_by_me)}
          onClose={() => setShowReport(false)}
          onDone={({ blocked }) => {
            setShowReport(false);
            if (blocked) {
              setUserProfile((prev) =>
                prev
                  ? { ...prev, blocked_by_me: true, is_friend: false, friendship_status: null, friendship_direction: null }
                  : null
              );
            }
            setFriendActionSuccess(blocked ? 'Denúncia enviada e usuário bloqueado.' : 'Denúncia enviada. Obrigado por avisar.');
            setTimeout(() => setFriendActionSuccess(null), 4000);
          }}
        />
      )}

      {creatingMoment && (
        <MomentCreator
          onClose={() => setCreatingMoment(false)}
          onPublished={() => {
            setCreatingMoment(false);
            setFriendActionSuccess('Momentum publicado.');
            setTimeout(() => setFriendActionSuccess(null), 4000);
          }}
        />
      )}

      {/* Toast Feedback */}
      {friendActionSuccess && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
          <span>{friendActionSuccess}</span>
        </div>
      )}

      <div
        className={`pt-16 md:pt-0 min-h-screen flex flex-col justify-between transition-all duration-300 ease-in-out ${
          isExpanded ? 'pl-0 md:pl-20' : 'pl-0 md:pl-20'
        }`}
      >
        <main className="w-full bg-surface pt-4 pb-24 md:pb-8">
          <div className="w-full max-w-2xl mx-auto px-3 sm:px-4 flex flex-col gap-6 sm:gap-8">
            {/* 1. Header do Perfil Público com Dados Reais */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-5 sm:gap-6 pb-5 border-b border-outline-variant">
              <div className="flex flex-row items-start sm:items-center gap-4 sm:gap-6 min-w-0">
                <div className="relative shrink-0">
                  {userProfile?.avatar_url ? (
                    <img loading="lazy" decoding="async"
                      src={userProfile.avatar_url}
                      alt={usernameHandle}
                      className="w-[84px] h-[84px] sm:w-24 sm:h-24 rounded-full object-cover shadow-md ring-4 ring-surface-container-low"
                    />
                  ) : (
                    <div className="w-[84px] h-[84px] sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-primary to-secondary text-on-primary flex items-center justify-center font-bold text-3xl sm:text-4xl uppercase shadow-md ring-4 ring-surface-container-low">
                      {initialLetter}
                    </div>
                  )}
                  {/* No próprio perfil, o + na foto cria um Momentum */}
                  {isSelf && (
                    <button
                      type="button"
                      onClick={() => setCreatingMoment(true)}
                      aria-label="Criar Momentum"
                      title="Criar Momentum"
                      className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-primary-container text-on-primary flex items-center justify-center text-base font-bold ring-2 ring-surface cursor-pointer hover:bg-primary transition-colors"
                    >
                      +
                    </button>
                  )}
                </div>

                <div className="flex flex-col min-w-0 flex-1">
                  <div className="order-1 flex items-center gap-2 flex-wrap">
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

                    <span className="hidden sm:inline text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                      {memberSince ? `Membro desde ${memberSince}` : 'Membro do Espectro'}
                    </span>

                    {userProfile?.is_friend && !isSelf && (
                      <span className="hidden sm:flex text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold items-center gap-1 border border-emerald-500/20">
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

                  {/* Biografia Real (computador: ao lado da foto; no celular ela vem embaixo, a partir da borda esquerda) */}
                  <div className="order-3 hidden sm:block">
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

                  </div>

                  {!isLockedPrivate && (
                    <div className="order-2 grid grid-cols-3 sm:flex sm:flex-wrap sm:gap-x-10 gap-y-2 mt-2 sm:mt-4 sm:py-4 sm:border-y sm:border-outline-variant text-xs sm:text-sm text-on-surface-variant text-center sm:text-left [&>*]:flex [&>*]:flex-col [&>*]:items-center sm:[&>*]:items-start [&_strong]:text-xl sm:[&_strong]:text-2xl [&_strong]:leading-tight [&_strong]:font-bold">
                      <div>
                        <strong className="text-on-surface">{posts.length}</strong>
                        <span>{posts.length === 1 ? 'post' : 'posts'}</span>
                      </div>
                      <Link
                        to={`/perfil/${encodeURIComponent(usernameHandle)}/seguidores`}
                        className="hover:opacity-70 transition-opacity"
                        aria-label={`Ver seguidores: ${userProfile?.followers_count ?? 0}`}
                      >
                        <strong className="text-on-surface">{userProfile?.followers_count ?? 0}</strong>
                        <span>{userProfile?.followers_count === 1 ? 'seguidor' : 'seguidores'}</span>
                      </Link>
                      <Link
                        to={`/perfil/${encodeURIComponent(usernameHandle)}/seguindo`}
                        className="hover:opacity-70 transition-opacity"
                        aria-label={`Ver quem segue: ${userProfile?.following_count ?? 0}`}
                      >
                        <strong className="text-on-surface">{userProfile?.following_count ?? 0}</strong>
                        <span>seguindo</span>
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {/* Biografia no celular: abaixo da foto, alinhada à esquerda */}
              <div className="sm:hidden -mt-2 text-left">
                {userProfile?.bio ? (
                  <p className="text-xs text-on-surface whitespace-pre-line leading-relaxed text-left">{userProfile.bio}</p>
                ) : isSelf ? (
                  <Link to="/settings/profile" className="text-xs text-primary hover:underline flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">add_circle</span>
                    <span>Adicionar uma biografia ao seu perfil</span>
                  </Link>
                ) : (
                  <p className="text-xs text-on-surface-variant italic">Nenhuma biografia informada ainda.</p>
                )}
              </div>

              {/* Botões de Ação do Perfil: Amizade, Mensagem ou Edição */}
              <div className="flex items-center gap-2 w-full sm:w-auto sm:flex-wrap">
                {!isSelf && userProfile?.blocked_by_me ? (
                  <button
                    type="button"
                    onClick={handleUnblock}
                    className="flex-1 sm:flex-none h-10 px-4 sm:px-5 rounded-full whitespace-nowrap bg-surface-container-low text-on-surface font-semibold text-xs border border-outline-variant hover:bg-surface-container flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">lock_open</span>
                    <span>Desbloquear</span>
                  </button>
                ) : isSelf ? (
                  <>
                    <Link
                      to="/settings/profile"
                      className="flex-1 sm:flex-none h-10 px-4 rounded-full whitespace-nowrap bg-surface-container-low text-on-surface hover:bg-surface-container font-semibold text-xs transition-colors border border-outline-variant flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
                      <span>Editar Perfil</span>
                    </Link>

                  </>
                ) : userProfile?.is_friend ? (
                  /* Já são amigos: mensagem direta e opção de desfazer */
                  <>
                    <Link
                      to={`/mensagens?u=${encodeURIComponent(usernameHandle)}`}
                      className="flex-1 sm:flex-none h-10 px-4 sm:px-5 rounded-full whitespace-nowrap bg-primary-container text-on-primary font-semibold text-xs hover:bg-primary transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">chat_bubble</span>
                      <span>Enviar Mensagem</span>
                    </Link>
                    <button
                      type="button"
                      disabled={addingFriend}
                      onClick={() =>
                        handleRemoveFriendship(
                          'Amizade desfeita.',
                          `Desfazer a amizade com @${usernameHandle}? Vocês não poderão mais trocar mensagens.`
                        )
                      }
                      title="Desfazer amizade"
                      aria-label="Desfazer amizade"
                      className="hidden sm:flex w-10 h-10 shrink-0 rounded-full bg-surface-container-low text-on-surface-variant hover:text-error hover:bg-surface-container border border-outline-variant items-center justify-center cursor-pointer disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[18px]">person_remove</span>
                    </button>
                  </>
                ) : friendshipPending && userProfile?.friendship_direction === 'outgoing' ? (
                  /* Pedido enviado: aguardando aceite */
                  <>
                    <span className="flex-1 sm:flex-none h-10 px-4 sm:px-5 rounded-full whitespace-nowrap bg-surface-container-low text-on-surface-variant font-semibold text-xs border border-outline-variant flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">schedule</span>
                      <span>Pedido enviado</span>
                    </span>
                    <button
                      type="button"
                      disabled={addingFriend}
                      onClick={() => handleRemoveFriendship('Pedido de amizade cancelado.')}
                      className="h-10 px-4 rounded-full whitespace-nowrap bg-surface-container text-on-surface font-semibold text-xs hover:bg-surface-container-high cursor-pointer disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </>
                ) : friendshipPending && userProfile?.friendship_direction === 'incoming' ? (
                  /* Pedido recebido: aceitar ou recusar */
                  <>
                    <button
                      type="button"
                      onClick={handleAddFriend}
                      disabled={addingFriend}
                      className="flex-1 sm:flex-none h-10 px-4 sm:px-5 rounded-full whitespace-nowrap bg-primary-container text-on-primary font-semibold text-xs hover:bg-primary transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
                      <span>Aceitar pedido</span>
                    </button>
                    <button
                      type="button"
                      disabled={addingFriend}
                      onClick={() => handleRemoveFriendship('Pedido recusado.')}
                      className="h-10 px-4 rounded-full whitespace-nowrap bg-surface-container text-on-surface font-semibold text-xs hover:bg-surface-container-high cursor-pointer disabled:opacity-50"
                    >
                      Recusar
                    </button>
                  </>
                ) : (
                  /* Usuários NÃO São Amigos: Botão Adicionar Amigo */
                  <button
                    type="button"
                    onClick={handleAddFriend}
                    disabled={addingFriend}
                    className="flex-1 sm:flex-none h-10 px-4 sm:px-5 rounded-full whitespace-nowrap bg-primary-container text-on-primary font-semibold text-xs hover:bg-primary transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {addingFriend ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="material-symbols-outlined text-[18px]">person_add</span>
                    )}
                    <span>{addingFriend ? 'Adicionando...' : 'Adicionar Amigo'}</span>
                  </button>
                )}

                {showFollowMenu ? (
                  <ChatMenu
                    title="Opções de quem você segue"
                    buttonClassName={`flex-1 sm:flex-none h-10 px-4 rounded-full font-semibold text-xs border flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 bg-surface-container-low text-on-surface border-outline-variant hover:bg-surface-container ${followBusy ? 'opacity-50 pointer-events-none' : ''}`}
                    trigger={
                      <>
                        <span>Seguindo</span>
                        <span className="material-symbols-outlined text-[18px]">expand_more</span>
                      </>
                    }
                    items={[
                      { key: 'unfollow', label: 'Deixar de seguir', icon: 'person_remove', onSelect: handleToggleFollow },
                      ...profileMenuItems,
                    ]}
                  />
                ) : (
                  !isSelf && userProfile && !userProfile.blocked_by_me && (!userProfile.is_private || userProfile.i_follow) && (
                    <button
                      type="button"
                      onClick={handleToggleFollow}
                      disabled={followBusy}
                      className="flex-1 sm:flex-none h-10 px-4 sm:px-5 rounded-full font-semibold text-xs border flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 bg-on-surface text-surface border-on-surface hover:opacity-90"
                    >
                      Seguir
                    </button>
                  )
                )}

                {userProfile && !isLockedPrivate && (
                  <ShareButton
                    variant="icon"
                    half={isSelf}
                    bordered
                    url={`${window.location.origin}/u/${encodeURIComponent(userProfile.username)}`}
                    title={`@${userProfile.username} no Espectro`}
                    text={userProfile.bio || undefined}
                  />
                )}

                {userProfile && !showFollowMenu && (
                  <ChatMenu
                    title="Mais opções"
                    buttonClassName="h-10 w-10 rounded-full bg-surface-container-low text-on-surface hover:bg-surface-container border border-outline-variant flex items-center justify-center cursor-pointer"
                    items={profileMenuItems}
                  />
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

            {/* 3. Sugestões de amigos (no próprio perfil) e comunidades */}
            {userProfile && !isLockedPrivate && <ProfileDiscover isSelf={isSelf} username={usernameHandle} communities={communities} />}

            {/* 4. Mural de Publicações / Scraps Públicos */}

            {isLockedPrivate ? (
              <div className="p-12 rounded-3xl bg-surface-container-lowest border border-outline-variant flex flex-col items-center text-center gap-4 shadow-sm animate-in fade-in">
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
                <div role="tablist" aria-label="Conteúdo do perfil" className="flex border-b border-outline-variant">
                  {(
                    [
                      { id: 'midia', label: 'Mídia', icon: 'grid_on', count: mediaPosts.length },
                      { id: 'posts', label: 'Publicações', icon: 'article', count: textPosts.length },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab.id}
                      onClick={() => setProfileTab(tab.id)}
                      className={`flex-1 h-12 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider border-b-2 -mb-px cursor-pointer transition-colors ${
                        activeTab === tab.id
                          ? 'border-on-surface text-on-surface'
                          : 'border-transparent text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
                      <span>{tab.label}</span>
                      <span className="text-on-surface-variant font-medium tabular-nums">{tab.count}</span>
                    </button>
                  ))}
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
                    className="bg-surface-container-lowest border border-outline-variant rounded-3xl p-8"
                  />
                ) : (
                  activeTab === 'midia' ? (
                    mediaPosts.length === 0 ? (
                      <p className="text-sm text-on-surface-variant text-center py-12">
                        {isSelf ? 'Você ainda não publicou fotos nem vídeos.' : 'Sem fotos nem vídeos por enquanto.'}
                      </p>
                    ) : (
                      <MediaGrid posts={mediaPosts} />
                    )
                  ) : textPosts.length === 0 ? (
                    <p className="text-sm text-on-surface-variant text-center py-12">
                      {isSelf ? 'Você ainda não publicou textos.' : 'Sem publicações de texto por enquanto.'}
                    </p>
                  ) : (
                    <div className="flex flex-col gap-5">
                      {textPosts.map((post) => (
                        <PostCard
                          key={post.id}
                          post={post}
                          onVote={handleVote}
                          onDelete={handleDeletePost}
                          onUpdate={handleUpdatePost}
                        />
                      ))}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
