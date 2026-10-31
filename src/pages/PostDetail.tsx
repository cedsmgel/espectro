import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { PostCard } from '../components/PostCard';
import { EmptyState } from '../components/EmptyState';
import { useSidebar } from '../context/SidebarContext';
import {
  Post,
  Comment,
  Community,
  postsApi,
  commentsApi,
  communitiesApi,
  authStorage,
} from '../lib/api';
import { CreateCommunityModal } from '../components/CreateCommunityModal';
import { RightSidebarSearch } from '../components/RightSidebarSearch';

export const PostDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isExpanded } = useSidebar();
  const user = authStorage.getUser();

  const postId = Number(id);

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingComments, setLoadingComments] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formulário de novo comentário
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showCommunityModal, setShowCommunityModal] = useState(false);

  // Carrega o post e comunidades
  useEffect(() => {
    if (!postId || isNaN(postId)) {
      setError('ID de publicação inválido.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    postsApi
      .getById(postId)
      .then((data) => {
        setPost(data);
      })
      .catch((err: any) => {
        console.error('Erro ao carregar publicação:', err);
        setError(err.message || 'Publicação não encontrada ou removida.');
      })
      .finally(() => {
        setLoading(false);
      });

    // Carrega comunidades para a sidebar
    communitiesApi
      .list()
      .then(setCommunities)
      .catch(() => {});
  }, [postId]);

  // Carrega comentários
  useEffect(() => {
    if (!postId || isNaN(postId)) return;

    setLoadingComments(true);
    commentsApi
      .list(postId)
      .then((data) => {
        setComments(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error('Erro ao carregar comentários:', err);
        setComments([]);
      })
      .finally(() => {
        setLoadingComments(false);
      });
  }, [postId]);

  // Envio de novo comentário
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('Você precisa estar conectado para comentar.');
      return;
    }

    if (!newComment.trim()) return;

    setSubmittingComment(true);
    try {
      const created = await commentsApi.create(postId, newComment.trim());
      setComments((prev) => [created, ...prev]);
      setNewComment('');
      // Atualiza contador de comentários local no post
      if (post) {
        setPost({
          ...post,
          comments_count: (post.comments_count || 0) + 1,
        });
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao enviar comentário.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleVote = (pId: number, type: 'up' | 'down') => {
    postsApi.vote(pId, type).catch(console.error);
  };

  return (
    <div className="flex min-h-screen w-full bg-background text-on-surface">
      {/* 1. Header Mobile (< md) */}
      <Header />

      {/* 2. Coluna Esquerda: Navegação fixa */}
      <SidebarNav />

      {/* 3. Coluna Central: Post e Thread (flex-1 max-w-2xl mx-auto) */}
      <main className="flex-1 min-w-0 min-h-screen flex flex-col pt-[calc(3.5rem+env(safe-area-inset-top))] md:pt-0 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8">
        <div className="w-full max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">
          {/* Barra de Topo com Botão Voltar */}
          <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] md:top-0 z-20 -mx-4 px-4 py-3 bg-surface/85 backdrop-blur-md border-b border-outline-variant/30 flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 rounded-full hover:bg-surface-container text-on-surface transition-colors cursor-pointer"
              title="Voltar"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <div className="flex flex-col">
              <h1 className="text-base sm:text-lg font-bold text-on-surface leading-tight">
                Publicação
              </h1>
              {post && (
                <span className="text-[11px] text-on-surface-variant">
                  por @{post.author_name} {post.community_name ? `em c/${post.community_name}` : ''}
                </span>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col gap-4">
              <div className="w-full h-48 bg-surface-container-low rounded-2xl animate-pulse" />
              <div className="w-full h-32 bg-surface-container-low rounded-2xl animate-pulse" />
            </div>
          ) : error || !post ? (
            <div className="p-8 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/30">
              <span className="material-symbols-outlined text-4xl text-error mb-2">error</span>
              <p className="font-semibold text-sm">{error || 'Publicação não encontrada.'}</p>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="mt-4 px-4 py-2 rounded-full bg-primary-container text-on-primary text-xs font-bold hover:bg-primary transition-all cursor-pointer"
              >
                Voltar ao Feed
              </button>
            </div>
          ) : (
            <>
              {/* O Post Principal */}
              <PostCard
                post={post}
                onVote={handleVote}
                isDetail={true}
              />

              {/* Caixa de Criação de Comentário */}
              <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 shadow-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-primary">add_comment</span>
                  Deixe seu comentário
                </h3>
                <form onSubmit={handleAddComment} className="flex flex-col gap-3">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={user ? "O que você achou dessa publicação? Escreva seu comentário..." : "Faça login para comentar nesta discussão..."}
                    disabled={!user || submittingComment}
                    rows={3}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary-container focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container/20 transition-all resize-none disabled:opacity-60"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-on-surface-variant">
                      {newComment.length} caracteres
                    </span>
                    <button
                      type="submit"
                      disabled={!user || !newComment.trim() || submittingComment}
                      className="px-4 py-1.5 rounded-full bg-primary-container text-on-primary font-bold text-xs hover:bg-primary transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs flex items-center gap-1.5"
                    >
                      {submittingComment ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[15px]">send</span>
                          <span>Comentar</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Lista / Thread de Comentários */}
              <div className="flex flex-col gap-3 mt-2">
                <div className="flex items-center justify-between px-1">
                  <h2 className="font-bold text-sm text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary">chat</span>
                    Comentários ({comments.length})
                  </h2>
                </div>

                {loadingComments ? (
                  <div className="flex flex-col gap-2">
                    <div className="w-full h-16 bg-surface-container-low rounded-xl animate-pulse" />
                    <div className="w-full h-16 bg-surface-container-low rounded-xl animate-pulse" />
                  </div>
                ) : comments.length === 0 ? (
                  <div className="p-8 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/20">
                    <span className="material-symbols-outlined text-3xl text-on-surface-variant/40 mb-1">
                      forum
                    </span>
                    <p className="font-medium text-xs text-on-surface">Nenhum comentário ainda.</p>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                      Seja a primeira pessoa a participar da discussão!
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {comments.map((c) => (
                      <div
                        key={c.id}
                        className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20 shadow-xs flex flex-col gap-2 transition-colors hover:border-outline-variant/40"
                      >
                        <div className="flex items-center justify-between">
                          <Link
                            to={`/perfil/${c.author_name}`}
                            className="flex items-center gap-2 group"
                          >
                            <div className="w-7 h-7 rounded-full bg-primary-container text-on-primary font-bold text-xs flex items-center justify-center uppercase shrink-0">
                              {c.author_name?.charAt(0) || 'U'}
                            </div>
                            <span className="text-xs font-bold text-on-surface group-hover:text-primary transition-colors">
                              @{c.author_name}
                            </span>
                          </Link>
                          <span className="text-[10px] text-on-surface-variant">
                            {new Date(c.created_at).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-on-surface whitespace-pre-wrap leading-relaxed pl-9">
                          {c.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* 4. Coluna Direita: Widgets (w-80, sticky top-0 h-screen, pt-4, hidden lg:flex) */}
      <aside className="w-72 hidden xl:flex flex-col fixed right-0 top-0 h-screen pt-4 px-4 overflow-y-auto border-l border-outline-variant/15 gap-4">
        {/* Barra de Pesquisa */}
        <RightSidebarSearch />

        {/* Card Comunidades em Alta */}
        <div className="bg-surface-container-lowest/80 dark:bg-[#121212] rounded-2xl p-3.5 sm:p-4 border border-outline-variant/15 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[18px]">
                local_fire_department
              </span>
              <h2 className="font-bold text-xs sm:text-sm text-on-surface">
                Comunidades em Alta
              </h2>
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
              <p className="font-medium text-on-surface text-[11px]">
                Nenhuma comunidade ainda
              </p>
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
        </div>

        {/* Rodapé sutil de links estilo Twitter */}
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
