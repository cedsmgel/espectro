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
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      {/* 1. Header Global */}
      <Header />

      {/* 2. Barra Lateral de Navegação */}
      <SidebarNav />

      {/* 3. Container Principal centralizado */}
      <div
        className={`pt-16 min-h-screen flex flex-col justify-between transition-all duration-300 ease-in-out ${
          isExpanded ? 'pl-0 md:pl-64' : 'pl-0 md:pl-[72px]'
        }`}
      >
        <main className="w-full bg-surface pt-4 pb-24 md:pb-8">
          <div className="flex justify-center gap-8 w-full max-w-[1100px] mx-auto px-4 items-start">
            {/* COLUNA CENTRAL (Post + Thread de Comentários) */}
            <section className="w-full max-w-2xl flex flex-col gap-4 min-w-0">
              {/* Barra de Topo com Botão Voltar */}
              <div className="sticky top-16 z-20 -mx-3 sm:mx-0 px-3 sm:px-1 py-3 bg-surface/85 backdrop-blur-md border-b border-outline-variant/30 flex items-center gap-4">
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
                      De @{post.author_name}
                    </span>
                  )}
                </div>
              </div>

              {/* Conteúdo Principal */}
              {loading ? (
                <div className="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/30 flex flex-col items-center justify-center gap-3 text-center animate-pulse">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-on-surface-variant font-medium">
                    Carregando publicação...
                  </span>
                </div>
              ) : error || !post ? (
                <div className="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/30 flex flex-col items-center justify-center gap-4 text-center">
                  <span className="material-symbols-outlined text-4xl text-error">
                    error_outline
                  </span>
                  <div>
                    <h3 className="font-bold text-base text-on-surface">
                      Não foi possível encontrar a publicação
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-1">
                      {error || 'Esta publicação pode ter sido removida pelo autor.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="px-4 py-2 rounded-full bg-primary-container text-on-primary text-xs font-semibold hover:bg-primary transition-all cursor-pointer"
                  >
                    Voltar ao Feed Principal
                  </button>
                </div>
              ) : (
                <>
                  {/* Card do Post Principal (sem o menu de opções) */}
                  <PostCard
                    post={post}
                    isDetail={true}
                    onVote={handleVote}
                    onUpdate={(updated) => setPost(updated)}
                    onDelete={() => navigate('/')}
                  />

                  {/* Seção de Resposta / Novo Comentário */}
                  <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 shadow-xs flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                        Responder a @{post.author_name}
                      </span>
                      <span className="text-[11px] text-on-surface-variant">
                        {comments.length} {comments.length === 1 ? 'resposta' : 'respostas'}
                      </span>
                    </div>

                    {user ? (
                      <form onSubmit={handleAddComment} className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary font-bold flex items-center justify-center text-xs uppercase shrink-0">
                          {user.username.charAt(0)}
                        </div>
                        <div className="flex-1 flex flex-col gap-2">
                          <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Adicionar um comentário..."
                            rows={3}
                            className="w-full bg-surface-container-low rounded-xl px-3.5 py-2.5 text-xs text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/20 resize-none transition-all"
                          />
                          <div className="flex justify-end">
                            <button
                              type="submit"
                              disabled={submittingComment || !newComment.trim()}
                              className="px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1.5 shadow-xs"
                            >
                              {submittingComment ? (
                                <>
                                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  <span>Enviando...</span>
                                </>
                              ) : (
                                <>
                                  <span className="material-symbols-outlined text-[15px]">send</span>
                                  <span>Responder</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </form>
                    ) : (
                      <div className="p-3 bg-surface-container-low rounded-xl text-xs text-on-surface-variant flex items-center justify-between">
                        <span>Faça login para participar da discussão.</span>
                        <Link
                          to="/login"
                          className="px-3 py-1 rounded-full bg-primary-container text-on-primary text-xs font-semibold hover:bg-primary transition-all"
                        >
                          Entrar
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Lista de Comentários */}
                  <div className="flex flex-col gap-3 pt-2">
                    {loadingComments ? (
                      <div className="p-6 text-center text-xs text-on-surface-variant flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span>Carregando respostas...</span>
                      </div>
                    ) : comments.length === 0 ? (
                      <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/30">
                        <EmptyState
                          icon="chat_bubble_outline"
                          title="Nenhum comentário ainda"
                          description="Seja a primeira pessoa a responder esta publicação e iniciar a discussão!"
                          className="py-4"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {comments.map((c) => (
                          <div
                            key={c.id}
                            className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20 shadow-xs flex flex-col gap-2 transition-all hover:border-outline-variant/40"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <Link
                                  to={`/perfil/${encodeURIComponent(c.author_name)}`}
                                  className="w-7 h-7 rounded-full bg-primary-container text-on-primary font-bold flex items-center justify-center text-xs uppercase shrink-0 hover:ring-2 hover:ring-primary transition-all"
                                >
                                  {c.author_avatar ? (
                                    <img
                                      src={c.author_avatar}
                                      alt={c.author_name}
                                      className="w-full h-full rounded-full object-cover"
                                    />
                                  ) : (
                                    c.author_name.charAt(0)
                                  )}
                                </Link>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <Link
                                    to={`/perfil/${encodeURIComponent(c.author_name)}`}
                                    className="font-semibold text-xs text-on-surface hover:text-primary hover:underline transition-colors"
                                  >
                                    {c.author_name}
                                  </Link>
                                  <span className="text-[11px] text-on-surface-variant">
                                    @{c.author_name.toLowerCase().replace(/\s+/g, '_')}
                                  </span>
                                  <span className="text-[11px] text-on-surface-variant">
                                    ·{' '}
                                    {new Date(c.created_at).toLocaleTimeString('pt-BR', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <p className="text-xs text-on-surface leading-relaxed pl-9 whitespace-pre-wrap break-words">
                              {c.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>

            {/* BARRA LATERAL DIREITA (Comunidades em Alta) */}
            <aside className="w-72 shrink-0 hidden lg:flex flex-col gap-4 sticky top-20">
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

                <Link
                  to="/comunidades"
                  className="pt-2 border-t border-outline-variant/15 text-[11px] font-semibold text-primary hover:underline text-center block"
                >
                  Explorar todas as comunidades →
                </Link>
              </div>
            </aside>
          </div>
        </main>
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
