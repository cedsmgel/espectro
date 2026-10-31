import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { communitiesApi, postsApi, Community, Post, CreatePostData, authStorage } from '../lib/api';
import { useSidebar } from '../context/SidebarContext';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { CreatePostForm } from '../components/CreatePostForm';
import { PostCard } from '../components/PostCard';
import { PostSkeleton } from '../components/PostSkeleton';
import { EmptyState } from '../components/EmptyState';
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
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [activeTab, setActiveTab] = useState<'discussions' | 'members'>('discussions');
  const [isMember, setIsMember] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchData = async () => {
    if (!slug) return;
    setLoading(true);
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
      alert('Você precisa estar logado para entrar na comunidade.');
      return;
    }

    if (!community) return;

    setActionLoading(true);
    try {
      if (isMember) {
        // Sair da comunidade
        const res = await communitiesApi.leave(community.id);
        setIsMember(false);
        setCommunity((prev) =>
          prev
            ? {
                ...prev,
                is_member: false,
                members_count: Math.max(0, (res.members_count ?? (prev.members_count || 1) - 1)),
              }
            : null
        );
        showToast(`Você saiu da comunidade e/${community.name}.`);
      } else {
        // Entrar na comunidade (insere em community_members)
        const res = await communitiesApi.join(community.id);
        setIsMember(true);
        setCommunity((prev) =>
          prev
            ? {
                ...prev,
                is_member: true,
                members_count: res.members_count ?? ((prev.members_count || 0) + 1),
              }
            : null
        );
        showToast(`Bem-vindo à comunidade e/${community.name}!`);
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao processar filiação à comunidade.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePostCreated = async (data: CreatePostData) => {
    if (!community) return;
    const newPost = await postsApi.create({
      ...data,
      community_id: community.id,
    });
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

  const handleDeletePost = (deletedId: number) => {
    setPosts((prev) => prev.filter((p) => p.id !== deletedId));
    showToast('Publicação excluída com sucesso.');
  };

  const handleUpdatePost = (updatedPost: Post) => {
    setPosts((prev) => prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
    showToast('Publicação atualizada com sucesso.');
  };

  // Garante que apenas posts daquela comunidade (ID estrito) sejam exibidos
  const communityFilteredPosts = posts.filter((p) => p.community_id === community?.id);

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
        className={`pt-16 flex-1 flex flex-col transition-all duration-300 ease-in-out ${
          isExpanded ? 'pl-0 md:pl-64' : 'pl-0 md:pl-[72px]'
        }`}
      >
        <main className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 pb-24 md:pb-8 flex-1">
          <section className="flex flex-col gap-6 max-w-4xl mx-auto min-w-0">
            {loading ? (
              <div className="flex flex-col gap-6">
                {/* Header Skeleton */}
                <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-4 animate-pulse">
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
                  <div
                    className="h-36 sm:h-44 w-full relative p-4 flex items-end justify-between transition-all"
                    style={{
                      background: community.icon_color
                        ? `linear-gradient(135deg, ${community.icon_color}dd 0%, #1e1b4b 100%)`
                        : 'linear-gradient(135deg, #712ae2 0%, #4f46e5 50%, #312e81 100%)',
                    }}
                  >
                    <span className="text-[11px] font-semibold text-white/90 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                      <span className="material-symbols-outlined text-[14px]">tag</span>
                      <span>Espaço Oficial c/{community.slug || community.id}</span>
                    </span>
                  </div>

                  {/* Profile & Info Bar */}
                  <div className="px-6 pb-6 pt-0 relative flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12">
                      <div className="flex items-end gap-4">
                        <div className="w-24 h-24 rounded-2xl p-1 bg-surface-container-lowest shadow-md">
                          <div
                            className="w-full h-full rounded-xl flex items-center justify-center font-bold text-3xl text-white shadow-xs"
                            style={{ backgroundColor: community.icon_color || '#712ae2' }}
                          >
                            {community.name.charAt(0).toUpperCase()}
                          </div>
                        </div>
                        <div className="flex flex-col pb-1">
                          <h1 className="text-xl sm:text-2xl font-bold text-on-surface flex items-center gap-2">
                            <span>c/{community.name}</span>
                            <span className="material-symbols-outlined text-primary text-[20px]">
                              verified
                            </span>
                          </h1>
                          <span className="text-xs text-on-surface-variant">
                            {community.members_count || 1} {community.members_count === 1 ? 'membro' : 'membros'} no Espectro
                          </span>
                        </div>
                      </div>

                      {/* Join / Participar da Comunidade Button */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleToggleJoin}
                          disabled={actionLoading}
                          className={`px-6 py-2.5 rounded-full font-semibold text-xs transition-all shadow-xs cursor-pointer flex items-center gap-1.5 ${
                            isMember
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
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-[16px]">group_add</span>
                              <span>Participar</span>
                            </>
                          )}
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
                    </div>
                  </div>
                </div>

                {/* ABA DE DISCUSSÕES: Composer & Posts filtrados estritamente por ID */}
                {activeTab === 'discussions' && (
                  <>
                    {/* Composer com communityId pré-selecionado */}
                    <CreatePostForm
                      onPostCreated={handlePostCreated}
                      defaultCommunityId={community.id}
                      communities={allCommunities}
                    />

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
                          <PostCard
                            key={post.id}
                            post={post}
                            onDelete={handleDeletePost}
                            onUpdate={handleUpdatePost}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* ABA DE MEMBROS: Lista da tabela community_members */}
                {activeTab === 'members' && (
                  <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/30 shadow-sm flex flex-col gap-4">
                    <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
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
                            className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low border border-outline-variant/20"
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
