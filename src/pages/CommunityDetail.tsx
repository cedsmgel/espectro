import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { requestAuth } from '../lib/authEvents';
import { communitiesApi, communityModApi, postsApi, Community, Post, CreatePostData, authStorage } from '../lib/api';
import { useSidebar } from '../context/SidebarContext';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { CreatePostModal } from '../components/CreatePostModal';
import { PostCard } from '../components/PostCard';
import { PostSkeleton } from '../components/PostSkeleton';
import { EmptyState } from '../components/EmptyState';
import { CommunityModPanel } from '../components/CommunityModPanel';
import { ErrorState } from '../components/ErrorState';

interface CommunityMember {
  id: number;
  user_id: number;
  username: string;
  avatar_url?: string | null;
  joined_at: string;
}

export const CommunityDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { isExpanded } = useSidebar();
  const user = authStorage.getUser();

  const [community, setCommunity] = useState<Community | null>(null);
  const [allCommunities, setAllCommunities] = useState<Community[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [pinned, setPinned] = useState<Post[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [sort, setSort] = useState<'new' | 'hot' | 'top'>('new');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [postsLoading, setPostsLoading] = useState(false);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [activeTab, setActiveTab] = useState<'discussions' | 'members' | 'moderation'>('discussions');
  const [isMember, setIsMember] = useState(false);
  const [myStatus, setMyStatus] = useState<'active' | 'pending' | 'banned' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchData = async (silent = false) => {
    if (!slug) return;
    if (!silent) setLoading(true);
    setHasError(false);
    const token = authStorage.getToken();
    const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      // 1. Carrega dados da comunidade via endpoint real /api/communities/:slug
      let current: Community | null = null;
      try {
        const res = await fetch(`/api/communities/${encodeURIComponent(slug)}`, {
          headers: authHeaders,
        });
        if (res.ok) {
          current = await res.json();
        } else if (res.status === 404) {
          // Fallback query param se a rota com slug falhar
          const fallbackRes = await fetch(`/api/communities?slug=${encodeURIComponent(slug)}`, {
            headers: authHeaders,
          });
          if (fallbackRes.ok) {
            current = await fallbackRes.json();
          }
        } else {
          console.error(`Erro da API D1 [${res.status}]:`, await res.text());
          setHasError(true);
          showToast('Falha ao comunicar com o servidor.');
        }
      } catch (networkErr) {
        console.error('Erro de conexão ao buscar comunidade:', networkErr);
        setHasError(true);
        showToast('Erro de conexão. Verifique sua rede.');
      }

      // 2. Carrega catálogo geral para dropdown do composer
      try {
        const allComms = await communitiesApi.list();
        setAllCommunities(allComms);
        if (!current && allComms.length > 0) {
          current = allComms.find((c) => c.slug === slug || String(c.id) === slug) || null;
        }
      } catch (listErr) {
        console.error('Erro ao listar catálogo de comunidades:', listErr);
      }

      if (current) {
        setCommunity(current);
        setIsMember(Boolean(current.is_member));
        setMyStatus(current.my_status ?? (current.is_member ? 'active' : null));
        setHasError(false);

        // 3. Puxa posts reais da comunidade via /api/posts?community_id=...
        try {
          const postsRes = await fetch(`/api/posts?community_id=${current.id}`, {
            headers: authHeaders,
          });
          if (postsRes.ok) {
            const commPosts: Post[] = await postsRes.json();
            // Filtragem estrita pelo ID da comunidade
            setPosts(commPosts.filter((p) => p.community_id === current!.id));
          } else {
            console.error(`Erro ao buscar posts da comunidade [${postsRes.status}]`);
            setPosts([]);
          }
        } catch (postsErr) {
          console.error('Erro ao buscar posts:', postsErr);
          setPosts([]);
          showToast('Não foi possível carregar os posts desta comunidade.');
        }
      } else {
        setCommunity(null);
        setPosts([]);
      }
    } catch (err) {
      console.error('Erro geral ao carregar detalhes da comunidade:', err);
      setHasError(true);
      showToast('Ocorreu um erro ao carregar a comunidade.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [slug]);

  // Recarrega a lista quando muda a ordenação ou o filtro de hashtag
  const communityId = community?.id;
  const communityLocked = community?.locked;
  useEffect(() => {
    if (!communityId || communityLocked) return;
    let cancelled = false;
    setPostsLoading(true);
    const filters = { community_id: communityId, sort, tag: tagFilter || undefined };
    Promise.all([
      postsApi.list(filters),
      sort === 'new' && !tagFilter ? postsApi.list({ community_id: communityId, pinned: true }) : Promise.resolve([] as Post[]),
    ])
      .then(([list, pins]) => {
        if (cancelled) return;
        setPinned(pins.filter((p) => p.community_id === communityId));
        setPosts(list.filter((p) => p.community_id === communityId));
      })
      .catch(() => {})
      .finally(() => !cancelled && setPostsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [communityId, communityLocked, sort, tagFilter]);

  // Carrega membros quando a aba "Membros" é selecionada
  useEffect(() => {
    if (activeTab === 'members' && community) {
      const loadMembers = async () => {
        setLoadingMembers(true);
        try {
          const res = await fetch(`/api/community_members?community_id=${community.id}`);
          if (res.ok) {
            const data: any = await res.json();
            setMembers(data.members || []);
          }
        } catch (err) {
          console.error('Erro ao carregar membros:', err);
        } finally {
          setLoadingMembers(false);
        }
      };
      loadMembers();
    }
  }, [activeTab, community]);

  // Função: Entrar na Comunidade (Insere na tabela community_members do D1)
  const handleToggleJoin = async () => {
    if (!user) {
      requestAuth({ mode: 'login', reason: 'Para participar de comunidades, entre ou crie uma conta.' });
      return;
    }

    if (!community) return;

    if (myStatus === 'banned') return;
    if (community.my_role === 'owner') {
      showToast('Quem criou a comunidade não pode sair dela.');
      return;
    }

    setActionLoading(true);
    try {
      if (isMember || myStatus === 'pending') {
        // Sair da comunidade (ou cancelar o pedido de entrada)
        const wasPending = myStatus === 'pending';
        const res = await communitiesApi.leave(community.id);
        setIsMember(false);
        setMyStatus(null);
        setCommunity((prev) =>
          prev
            ? {
                ...prev,
                is_member: false,
                my_status: null,
                my_role: null,
                i_am_mod: false,
                can_post_here: false,
                members_count: res.members_count ?? Math.max(0, (prev.members_count || 1) - 1),
              }
            : null
        );
        showToast(wasPending ? 'Pedido cancelado.' : `Você saiu da comunidade e/${community.name}.`);
        if (community.type === 'private') fetchData();
      } else {
        const res = await communitiesApi.join(community.id);
        if (res.status === 'pending') {
          setMyStatus('pending');
          setCommunity((prev) => (prev ? { ...prev, my_status: 'pending' } : null));
          showToast(res.message);
        } else {
          setIsMember(true);
          setMyStatus('active');
          showToast(`Bem-vindo à comunidade e/${community.name}!`);
          fetchData();
        }
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao processar filiação à comunidade.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePostCreated = (newPost: Post) => {
    if (!community) return;
    // Garante propriedades completas e atualiza a lista imediatamente
    const postWithComm: Post = {
      ...newPost,
      community_id: community.id,
      community_name: newPost.community_name || community.name,
      community_slug: newPost.community_slug || community.slug,
    };
    setPosts((prev) => [postWithComm, ...prev.filter((p) => p.id !== postWithComm.id)]);
    setActiveTab('discussions');
    showToast('Post publicado com sucesso no Espectro!');
  };

  // Moderação: remove a publicação de outra pessoa da comunidade
  const handleModRemove = async (postId: number) => {
    if (!community) return;
    const reason = window.prompt('Motivo da remoção (opcional, fica no registro):');
    if (reason === null) return;
    try {
      await communityModApi.act(community.id, 'remove_post', { post_id: postId, reason });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setPinned((prev) => prev.filter((p) => p.id !== postId));
      showToast('Publicação removida pela moderação.');
    } catch (err: any) {
      alert(err.message || 'Não foi possível remover.');
    }
  };

  const handlePin = async (post: Post, pin: boolean) => {
    if (!community) return;
    try {
      await communityModApi.act(community.id, pin ? 'pin' : 'unpin', { post_id: post.id });
      setPinned((prev) => (pin ? [...prev, post] : prev.filter((p) => p.id !== post.id)));
      showToast(pin ? 'Publicação fixada no topo.' : 'Publicação desafixada.');
    } catch (err: any) {
      alert(err.message || 'Não foi possível fixar.');
    }
  };

  const handleDeletePost = (deletedId: number) => {
    setPosts((prev) => prev.filter((p) => p.id !== deletedId));
    setPinned((prev) => prev.filter((p) => p.id !== deletedId));
    showToast('Publicação excluída com sucesso.');
  };

  const handleUpdatePost = (updatedPost: Post) => {
    setPosts((prev) => prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
    showToast('Publicação atualizada com sucesso.');
  };

  // Garante que apenas posts daquela comunidade (ID estrito) sejam exibidos
  const pinnedIds = new Set(pinned.map((p) => p.id));
  const communityFilteredPosts = [...pinned, ...posts.filter((p) => !pinnedIds.has(p.id))].filter((p) => p.community_id === community?.id);

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <Header />
      <SidebarNav />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-on-surface text-surface px-4 py-2.5 rounded-2xl shadow-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      <div
        className={`pt-16 md:pt-0 flex-1 flex flex-col transition-all duration-300 ease-in-out ${
          isExpanded ? 'pl-0 md:pl-20' : 'pl-0 md:pl-20'
        }`}
      >
        <main className="w-full max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-24 md:pb-8 flex-1">
          <section className="flex flex-col gap-6 mx-auto min-w-0">
            {loading ? (
              <div className="flex flex-col gap-6">
                {/* Header Skeleton */}
                <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant flex flex-col gap-4 animate-pulse">
                  <div className="h-36 sm:h-44 rounded-2xl bg-surface-container-high" />
                  <div className="flex items-end gap-4 -mt-12 px-2">
                    <div className="w-20 h-20 rounded-2xl bg-surface-container border-4 border-surface-container-lowest shadow-sm" />
                    <div className="space-y-2 pb-1">
                      <div className="h-6 w-44 rounded-md bg-surface-container-high" />
                      <div className="h-3 w-24 rounded-md bg-surface-container" />
                    </div>
                  </div>
                </div>
                {/* Posts Skeletons */}
                <PostSkeleton />
                <PostSkeleton />
              </div>
            ) : hasError ? (
              <ErrorState
                title="Erro ao sintonizar com a comunidade"
                message="Não foi possível carregar as informações desta comunidade. Verifique sua conexão e tente novamente."
                onRetry={fetchData}
              />
            ) : !community ? (
              <div className="bg-surface-container-lowest rounded-2xl p-10 text-center space-y-3 border border-outline-variant shadow-sm">
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
                <div className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm border border-outline-variant">
                  {/* Subtle Gradient Cover */}
                  <div
                    className="h-36 sm:h-44 w-full relative p-4 flex items-end justify-between transition-all"
                    style={{
                      background: community.banner_url
                        ? `center / cover no-repeat url("${community.banner_url}")`
                        : community.icon_color
                        ? `linear-gradient(135deg, ${community.icon_color}dd 0%, #1e1b4b 100%)`
                        : 'linear-gradient(135deg, #404040 0%, #18181b 50%, #09090b 100%)',
                    }}
                  >
                    <span className="text-[11px] font-semibold text-white/90 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                      <span className="material-symbols-outlined text-[14px]">tag</span>
                      <span>Espaço Oficial e/{community.slug || community.id}</span>
                    </span>
                  </div>

                  {/* Profile & Info Bar */}
                  <div className="px-6 pb-6 pt-0 relative flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12">
                      <div className="flex items-end gap-4">
                        <div className="w-24 h-24 rounded-2xl p-1 bg-surface-container-lowest shadow-md">
                          {community.icon_url ? (
                            <img loading="lazy" decoding="async" src={community.icon_url} alt="" className="w-full h-full rounded-xl object-cover" />
                          ) : (
                            <div
                              className="w-full h-full rounded-xl flex items-center justify-center font-bold text-3xl text-white shadow-xs"
                              style={{ backgroundColor: community.icon_color || '#404040' }}
                            >
                              {community.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col pb-1">
                          <h1 className="text-xl sm:text-2xl font-bold text-on-surface flex items-center gap-2">
                            <span>e/{community.name}</span>
                            <span className="material-symbols-outlined text-primary text-[20px]">
                              verified
                            </span>
                          </h1>
                          <span className="text-xs text-on-surface-variant flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">
                                {community.type === 'private' ? 'lock' : community.type === 'restricted' ? 'visibility' : 'public'}
                              </span>
                              {community.type === 'private' ? 'Privada' : community.type === 'restricted' ? 'Restrita' : 'Pública'}
                            </span>
                            <span>·</span>
                            <span>
                              {community.members_count || 1} {community.members_count === 1 ? 'membro' : 'membros'}
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Join / Participar da Comunidade Button */}
                      <div className="flex items-center gap-2">
                        {myStatus === 'banned' ? (
                          <span className="px-4 py-2.5 rounded-full bg-error-container text-error text-xs font-semibold flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px]">block</span>
                            <span>Você foi banido</span>
                          </span>
                        ) : community.my_role === 'owner' ? (
                          <span className="px-4 py-2.5 rounded-full bg-surface-container-high text-on-surface text-xs font-semibold flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px]">shield_person</span>
                            <span>Você é o fundador</span>
                          </span>
                        ) : (
                        <button
                          type="button"
                          onClick={handleToggleJoin}
                          disabled={actionLoading}
                          className={`px-6 py-2.5 rounded-full font-semibold text-xs transition-all shadow-xs cursor-pointer flex items-center gap-1.5 ${
                            isMember || myStatus === 'pending'
                              ? 'bg-surface-container-high text-on-surface hover:bg-error-container hover:text-error'
                              : 'bg-primary-container text-on-primary hover:bg-primary'
                          }`}
                        >
                          {actionLoading ? (
                            <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                          ) : isMember ? (
                            <>
                              <span className="material-symbols-outlined text-[16px] text-emerald-500">check</span>
                              <span>Participando (Sair)</span>
                            </>
                          ) : myStatus === 'pending' ? (
                            <>
                              <span className="material-symbols-outlined text-[16px]">schedule</span>
                              <span>Pedido enviado (cancelar)</span>
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-[16px]">{community.type === 'private' ? 'lock_open' : 'group_add'}</span>
                              <span>{community.type === 'private' ? 'Pedir para entrar' : 'Participar'}</span>
                            </>
                          )}
                        </button>
                        )}
                      </div>
                    </div>

                    {/* Community Description */}
                    {community.description && (
                      <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed max-w-3xl pt-2">
                        {community.description}
                      </p>
                    )}

                    {/* Sub-tabs inside community */}
                    <div className={`${community.locked ? 'hidden' : 'flex'} items-center gap-4 pt-4 border-t border-outline-variant text-xs font-semibold`}>
                      <button
                        type="button"
                        onClick={() => setActiveTab('discussions')}
                        className={`pb-2 relative cursor-pointer flex items-center gap-1.5 ${
                          activeTab === 'discussions' ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">forum</span>
                        <span>Discussões ({communityFilteredPosts.length})</span>
                        {activeTab === 'discussions' && (
                          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('members')}
                        className={`pb-2 relative cursor-pointer flex items-center gap-1.5 ${
                          activeTab === 'members' ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">group</span>
                        <span>Membros ({community.members_count || 1})</span>
                        {activeTab === 'members' && (
                          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                        )}
                      </button>
                      {community.i_am_mod && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('moderation')}
                          className={`pb-2 relative cursor-pointer flex items-center gap-1.5 ${
                            activeTab === 'moderation' ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">shield_person</span>
                          <span>Moderação{community.pending_count ? ` (${community.pending_count})` : ''}</span>
                          {activeTab === 'moderation' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {community.locked && (
                  <div className="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant flex flex-col items-center gap-2 text-center">
                    <span className="material-symbols-outlined text-[36px] text-on-surface-variant">lock</span>
                    <h2 className="text-sm font-bold text-on-surface">Esta comunidade é privada</h2>
                    <p className="text-xs text-on-surface-variant max-w-sm">
                      {myStatus === 'pending'
                        ? 'Seu pedido está com a moderação. Você vai ver as publicações assim que for aprovado.'
                        : myStatus === 'banned'
                        ? `Você não pode entrar nesta comunidade${community.ban_reason ? `: ${community.ban_reason}` : '.'}`
                        : 'Só membros veem as publicações e a lista de membros. Peça para entrar e aguarde a aprovação.'}
                    </p>
                  </div>
                )}

                {!community.locked && myStatus === 'banned' && (
                  <div className="p-3 rounded-xl bg-error-container text-error text-xs font-medium">
                    Você foi banido desta comunidade{community.ban_reason ? `: ${community.ban_reason}` : '.'}
                    {community.banned_until ? ` Até ${new Date(community.banned_until).toLocaleDateString('pt-BR')}.` : ''}
                  </div>
                )}

                {!community.locked && (community.welcome_message || (community.rules && community.rules.length > 0) || (community.tags && community.tags.length > 0)) && (
                  <section className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant flex flex-col gap-4">
                    {community.welcome_message && (
                      <p className="text-xs sm:text-sm text-on-surface leading-relaxed whitespace-pre-line">{community.welcome_message}</p>
                    )}
                    {community.tags && community.tags.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <h3 className="text-xs font-bold text-on-surface">Hashtags da comunidade{community.require_tag ? ' (uma é obrigatória)' : ''}</h3>
                        <div className="flex flex-wrap gap-1.5">
                          {community.tags.map((tag) => (
                            <Link
                              key={tag}
                              to={`/hashtag/${encodeURIComponent(tag)}`}
                              className="px-2.5 py-1 rounded-full bg-surface-container text-xs font-semibold text-primary hover:bg-surface-container-high"
                            >
                              #{tag}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                    {community.rules && community.rules.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <h3 className="text-xs font-bold text-on-surface">Regras de e/{community.name}</h3>
                        <ol className="flex flex-col gap-2 list-decimal pl-5">
                          {community.rules.map((rule, i) => (
                            <li key={i} className="text-xs text-on-surface">
                              <span className="font-semibold">{rule.title}</span>
                              {rule.description && <span className="block text-on-surface-variant">{rule.description}</span>}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </section>
                )}

                {/* ABA DE DISCUSSÕES: Composer & Posts filtrados estritamente por ID */}
                {!community.locked && activeTab === 'discussions' && (
                  <>
                    {/* Composer com communityId pré-selecionado */}
                    {community.can_post_here ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setComposerOpen(true)}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low text-left cursor-pointer"
                        >
                          <span className="w-9 h-9 rounded-full bg-primary-container text-on-primary font-bold flex items-center justify-center text-sm uppercase shrink-0">
                            {(user?.username || '?').charAt(0)}
                          </span>
                          <span className="flex-1 text-sm text-on-surface-variant">Criar publicação em e/{community.name}</span>
                          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">edit_square</span>
                        </button>
                        <CreatePostModal
                          isOpen={composerOpen}
                          onClose={() => setComposerOpen(false)}
                          onPostCreated={handlePostCreated}
                          defaultCommunityId={community.id}
                          communityTags={community.tags}
                          requireTag={community.require_tag}
                        />
                      </>
                    ) : (
                      myStatus !== 'banned' && (
                        <div className="p-3 rounded-xl bg-surface-container text-on-surface-variant text-xs">
                          {community.type === 'restricted'
                            ? 'Nesta comunidade só pessoas aprovadas pela moderação publicam. Você pode ler tudo.'
                            : 'Entre na comunidade para publicar.'}
                        </div>
                      )
                    )}

                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 overflow-x-auto">
                        {([['new', 'Novos'], ['hot', 'Em alta'], ['top', 'Mais votados']] as const).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setSort(value)}
                            aria-pressed={sort === value}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer ${
                              sort === value ? 'bg-primary-container text-on-primary' : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {community.tags && community.tags.length > 0 && (
                        <div className="flex items-center gap-2 overflow-x-auto">
                          <button
                            type="button"
                            onClick={() => setTagFilter(null)}
                            aria-pressed={tagFilter === null}
                            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer border ${
                              tagFilter === null ? 'border-on-surface text-on-surface' : 'border-outline-variant text-on-surface-variant hover:text-on-surface'
                            }`}
                          >
                            Todas
                          </button>
                          {community.tags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                              aria-pressed={tagFilter === tag}
                              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer border ${
                                tagFilter === tag ? 'border-on-surface text-on-surface' : 'border-outline-variant text-on-surface-variant hover:text-on-surface'
                              }`}
                            >
                              #{tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Posts exclusivos da comunidade (filtrados por community_id) */}
                    {communityFilteredPosts.length === 0 ? (
                      <EmptyState
                        icon="eco"
                        title="Só tem mato por aqui! 🌿"
                        description="Esta comunidade está esperando pela primeira discussão. Que tal quebrar o gelo e começar?"
                        actionLabel="Escrever discussão"
                        onAction={() => {
                          const composer = document.querySelector('textarea');
                          if (composer) {
                            composer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            composer.focus();
                          }
                        }}
                      />
                    ) : (
                      <div className="flex flex-col gap-4">
                        {communityFilteredPosts.map((post) => (
                          <div key={post.id} className="flex flex-col gap-1">
                            <PostCard post={post} onDelete={handleDeletePost} onUpdate={handleUpdatePost} />
                            {pinnedIds.has(post.id) && (
                              <span className="self-start px-2 py-0.5 rounded-full bg-surface-container text-[10px] font-semibold text-on-surface-variant flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px]">push_pin</span>
                                Fixada
                              </span>
                            )}
                            {community.i_am_mod && sort === 'new' && !tagFilter && (
                              <button
                                type="button"
                                onClick={() => handlePin(post, !pinnedIds.has(post.id))}
                                className="self-end px-3 py-1 rounded-full bg-surface-container text-on-surface text-[11px] font-semibold cursor-pointer flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-[14px]">push_pin</span>
                                {pinnedIds.has(post.id) ? 'Desafixar' : 'Fixar'}
                              </button>
                            )}
                            {community.i_am_mod && post.author_id !== user?.id && (
                              <button
                                type="button"
                                onClick={() => handleModRemove(post.id)}
                                className="self-end px-3 py-1 rounded-full bg-error-container text-error text-[11px] font-semibold cursor-pointer flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-[14px]">shield_person</span>
                                Remover (moderação)
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* ABA DE MEMBROS: Lista da tabela community_members */}
                {!community.locked && activeTab === 'moderation' && community.i_am_mod && (
                  <CommunityModPanel key={community.id} community={community} onChanged={() => fetchData(true)} />
                )}

                {!community.locked && activeTab === 'members' && (
                  <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant shadow-sm flex flex-col gap-4">
                    <div className="flex items-center justify-between pb-2 border-b border-outline-variant">
                      <h3 className="font-bold text-sm text-on-surface flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[18px]">group</span>
                        <span>Membros Inscritos na Comunidade</span>
                      </h3>
                      <span className="text-xs text-on-surface-variant font-medium">
                        {community.members_count || 1} membros
                      </span>
                    </div>

                    {loadingMembers ? (
                      <div className="text-center py-8 text-xs text-on-surface-variant">
                        <span className="material-symbols-outlined text-[24px] text-primary animate-spin">
                          progress_activity
                        </span>
                        <p className="mt-1">Carregando lista de membros...</p>
                      </div>
                    ) : members.length === 0 ? (
                      <div className="text-center py-6 text-xs text-on-surface-variant">
                        {community.owner_name ? (
                          <p>Fundador: <strong className="text-on-surface">@{community.owner_name}</strong></p>
                        ) : (
                          <p>Nenhum membro registrado além do fundador.</p>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {members.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low border border-outline-variant"
                          >
                            <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary font-bold flex items-center justify-center text-sm uppercase">
                              {member.username.charAt(0)}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-semibold text-on-surface truncate">
                                @{member.username}
                              </span>
                              <span className="text-[10px] text-on-surface-variant">
                                Ingressou em {new Date(member.joined_at).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
