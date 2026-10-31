import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Post, Comment, commentsApi, postsApi, authStorage } from '../lib/api';
import { renderMarkdown } from '../lib/markdown';
import { VideoPlayer } from './VideoPlayer';

interface PostCardProps {
  post: Post;
  onVote?: (postId: number, voteType: 'up' | 'down') => void;
  onDelete?: (postId: number) => void;
  onUpdate?: (updatedPost: Post) => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, onVote, onDelete, onUpdate }) => {
  const user = authStorage.getUser();
  const [upvotes, setUpvotes] = useState(post.upvotes);
  const [downvotes, setDownvotes] = useState(post.downvotes);
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyToId, setReplyToId] = useState<number | null>(null);
  const [commentsCount, setCommentsCount] = useState(post.comments_count);

  // Estados de edição e exclusão
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title || '');
  const [editContent, setEditContent] = useState(post.content);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Conteúdo e título locais para atualização visual imediata
  const [title, setTitle] = useState(post.title || '');
  const [content, setContent] = useState(post.content);

  useEffect(() => {
    setTitle(post.title || '');
    setContent(post.content);
    setEditTitle(post.title || '');
    setEditContent(post.content);
  }, [post.title, post.content]);

  const isAuthor =
    user &&
    (user.id === post.author_id ||
      user.username.toLowerCase() === post.author_name.toLowerCase());

  const handleVoteClick = (type: 'up' | 'down') => {
    if (!user) {
      alert('Faça login para votar nas publicações.');
      return;
    }

    if (userVote === type) return;

    if (type === 'up') {
      setUpvotes((v) => v + 1);
      if (userVote === 'down') setDownvotes((v) => Math.max(0, v - 1));
      setUserVote('up');
    } else {
      setDownvotes((v) => v + 1);
      if (userVote === 'up') setUpvotes((v) => Math.max(0, v - 1));
      setUserVote('down');
    }

    if (onVote) {
      onVote(post.id, type);
    }
  };

  const loadComments = async () => {
    if (showComments) {
      setShowComments(false);
      return;
    }

    setShowComments(true);
    setLoadingComments(true);
    try {
      const data = await commentsApi.list(post.id);
      setComments(data);
    } catch (err) {
      console.error('Erro ao carregar comentários:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('Você precisa estar logado para comentar.');
      return;
    }

    if (!newComment.trim()) return;

    setSubmittingComment(true);
    try {
      const created = await commentsApi.create(post.id, newComment.trim(), replyToId || undefined);
      setComments((prev) => [...prev, created]);
      setCommentsCount((prev) => prev + 1);
      setNewComment('');
      setReplyToId(null);
    } catch (err: any) {
      alert(err.message || 'Erro ao enviar comentário.');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Exclusão do post chamando DELETE /api/posts/:id (com limpeza no Cloudflare R2)
  const handleDelete = async () => {
    if (!isAuthor) return;
    const hasMedia = Boolean(post.media_url);
    const confirmMessage = hasMedia
      ? 'Tem certeza que deseja excluir esta publicação? O arquivo de vídeo/imagem associado será removido permanentemente do Cloudflare R2.'
      : 'Tem certeza que deseja excluir esta publicação?';

    if (!window.confirm(confirmMessage)) return;

    setIsDeleting(true);
    try {
      await postsApi.delete(post.id);
      if (onDelete) {
        onDelete(post.id);
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir publicação.');
      setIsDeleting(false);
    }
  };

  // Edição do post chamando PUT /api/posts/:id
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editContent.trim()) {
      setEditError('O conteúdo da publicação não pode ser vazio.');
      return;
    }

    setIsSavingEdit(true);
    setEditError(null);
    try {
      const res = await postsApi.update(post.id, {
        title: editTitle.trim() || null,
        content: editContent.trim(),
      });

      setContent(editContent.trim());
      setTitle(editTitle.trim());
      setIsEditing(false);

      if (onUpdate && res.post) {
        onUpdate(res.post);
      }
    } catch (err: any) {
      console.error('Erro ao atualizar post:', err);
      setEditError(err.message || 'Erro ao salvar alterações da publicação.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const score = upvotes - downvotes;

  return (
    <>
      <article
        className={`bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/30 flex flex-col gap-4 transition-all hover:shadow-md ${
          isDeleting ? 'opacity-50 pointer-events-none' : ''
        }`}
      >
        {/* 1. Cabeçalho do Post */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary font-bold flex items-center justify-center text-sm uppercase shadow-xs">
              {post.author_name.charAt(0)}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-on-surface">
                  {post.author_name}
                </span>
                {post.community_name ? (
                  <Link
                    to={`/c/${post.community_slug || post.community_id}`}
                    className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-300/60 text-xs font-semibold flex items-center gap-1.5 hover:bg-purple-200 dark:hover:bg-purple-900 transition-colors shadow-xs"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: post.community_icon_color || '#712ae2' }}
                    />
                    <span>c/{post.community_name}</span>
                  </Link>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-[11px] font-medium">
                    c/geral
                  </span>
                )}
                <span className="text-on-surface-variant text-xs">
                  ·{' '}
                  {new Date(post.created_at).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <span className="text-xs text-on-surface-variant">
                @{post.author_name.toLowerCase().replace(/\s+/g, '_')}
              </span>
            </div>
          </div>

          {/* Menu Kebab (Três Pontinhos) - Só aparece se o usuário logado for o autor do post */}
          {isAuthor && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMenu((prev) => !prev)}
                aria-label="Ações da publicação"
                disabled={isDeleting}
                className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {isDeleting ? 'sync' : 'more_vert'}
                </span>
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 top-8 z-40 w-48 bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/30 py-1.5 flex flex-col animate-in fade-in duration-150">
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        setEditTitle(title);
                        setEditContent(content);
                        setEditError(null);
                        setIsEditing(true);
                      }}
                      className="px-3.5 py-2 text-xs text-on-surface hover:bg-surface-container flex items-center gap-2.5 cursor-pointer transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-[17px] text-primary">
                        edit
                      </span>
                      <span>Editar publicação</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        handleDelete();
                      }}
                      disabled={isDeleting}
                      className="px-3.5 py-2 text-xs text-error hover:bg-error-container/20 flex items-center gap-2.5 cursor-pointer transition-colors text-left border-t border-outline-variant/20 font-medium"
                    >
                      <span className="material-symbols-outlined text-[17px] text-error">
                        delete
                      </span>
                      <span>Excluir publicação</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* 2. Conteúdo do Post */}
        <div className="flex flex-col gap-2.5">
          {title && (
            <h3 className="text-base sm:text-lg font-bold text-on-surface leading-snug">
              {title}
            </h3>
          )}

          {post.post_type === 'scrap' ? (
            <div className="relative p-4 rounded-xl bg-surface-container-low border-l-4 border-secondary flex flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-secondary flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">auto_stories</span>
                Scrap Nostálgico
              </span>
              <div className="text-sm italic text-on-surface font-serif">
                "{renderMarkdown(content)}"
              </div>
            </div>
          ) : (
            <div className="text-sm text-on-surface leading-relaxed">
              {renderMarkdown(content)}
            </div>
          )}

          {/* Mídia Principal: Player de Vídeo Compacto ou Imagem */}
          {post.media_url &&
            (post.media_type === 'video' ||
            /\.(mp4|webm|mov|ogg|m4v)($|\?)/i.test(post.media_url) ||
            post.media_url.includes('/videos/') ? (
              <div className="mt-1 w-full flex justify-center">
                <VideoPlayer src={post.media_url} title={title || undefined} />
              </div>
            ) : (
              <div className="relative w-full max-w-[480px] mx-auto rounded-xl overflow-hidden shadow-xs bg-surface-container aspect-video max-h-72 mt-1">
                <img
                  src={post.media_url}
                  alt="Mídia da postagem"
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-[1.01]"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            ))}
        </div>

        {/* 3. BARRA DE AÇÕES: Votos e Comentários */}
        <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20">
          <div className="flex items-center gap-3">
            {/* Controle de Voto */}
            <div className="flex items-center bg-surface-container-low rounded-full px-1.5 py-0.5 border border-outline-variant/30">
              <button
                type="button"
                onClick={() => handleVoteClick('up')}
                aria-label="Upvote"
                className={`p-1 rounded-full transition-colors flex items-center justify-center cursor-pointer ${
                  userVote === 'up'
                    ? 'text-primary bg-primary-fixed shadow-xs'
                    : 'text-on-surface-variant hover:text-primary hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-[19px]">keyboard_arrow_up</span>
              </button>
              <span
                className={`px-2 text-xs font-bold ${
                  score > 0 ? 'text-primary' : score < 0 ? 'text-error' : 'text-on-surface'
                }`}
              >
                {score > 0 ? `+${score}` : score}
              </span>
              <button
                type="button"
                onClick={() => handleVoteClick('down')}
                aria-label="Downvote"
                className={`p-1 rounded-full transition-colors flex items-center justify-center cursor-pointer ${
                  userVote === 'down'
                    ? 'text-error bg-error-container shadow-xs'
                    : 'text-on-surface-variant hover:text-error hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-[19px]">keyboard_arrow_down</span>
              </button>
            </div>

            {/* Comentários */}
            <button
              type="button"
              onClick={loadComments}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors text-xs font-medium cursor-pointer"
            >
              <span className="material-symbols-outlined text-[19px]">chat_bubble_outline</span>
              <span>{commentsCount} comentários</span>
            </button>
          </div>

          {/* Lado Direito: Compartilhar / Salvar */}
          <div className="flex items-center gap-1 text-on-surface-variant">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(
                  window.location.origin + `/c/${post.community_slug || post.community_id || 'geral'}#post-${post.id}`
                );
                alert('Link copiado para a área de transferência!');
              }}
              className="p-1.5 rounded-full hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
              title="Copiar link da publicação"
            >
              <span className="material-symbols-outlined text-[19px]">share</span>
            </button>
          </div>
        </div>

        {/* Seção Expansível de Comentários */}
        {showComments && (
          <div className="pt-3 border-t border-outline-variant/20 flex flex-col gap-3">
            {user ? (
              <form onSubmit={handleAddComment} className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary-container text-on-primary font-bold flex items-center justify-center text-xs uppercase flex-shrink-0">
                  {user.username.charAt(0)}
                </div>
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={replyToId ? 'Respondendo comentário...' : 'Adicionar um comentário...'}
                  className="flex-1 bg-surface-container-low rounded-full px-4 py-2 text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container transition-all"
                />
                <button
                  type="submit"
                  disabled={submittingComment || !newComment.trim()}
                  className="px-3.5 py-1.5 rounded-full bg-primary-container text-on-primary text-xs font-semibold hover:bg-primary disabled:opacity-40 transition-all cursor-pointer"
                >
                  {submittingComment ? '...' : 'Enviar'}
                </button>
              </form>
            ) : (
              <p className="text-xs text-on-surface-variant">
                Faça login para participar da conversa.
              </p>
            )}

            {loadingComments ? (
              <div className="flex items-center justify-center py-4 text-xs text-on-surface-variant">
                Carregando comentários...
              </div>
            ) : comments.length === 0 ? (
              <div className="text-xs text-on-surface-variant text-center py-3">
                Nenhum comentário ainda. Seja o primeiro a comentar!
              </div>
            ) : (
              <div className="flex flex-col gap-2 pt-1">
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-xl bg-surface-container-low flex flex-col gap-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-on-surface">
                        @{c.author_name}
                      </span>
                      <span className="text-on-surface-variant text-[11px]">
                        {new Date(c.created_at).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-on-surface">{c.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </article>

      {/* MODAL DE EDIÇÃO DA PUBLICAÇÃO */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">
                  edit_note
                </span>
                <h3 className="font-bold text-base text-on-surface">Editar Publicação</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="p-1.5 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-error-container/20 border border-error/20 text-error text-xs font-medium flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
              {(post.post_type === 'discussion' || editTitle) && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-on-surface">
                    Título da discussão (opcional)
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Título da postagem..."
                    className="w-full px-4 py-2.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-on-surface text-xs placeholder:text-on-surface-variant focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container outline-none transition-all"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface">
                  Conteúdo da publicação
                </label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Escreva sua mensagem..."
                  rows={4}
                  required
                  className="w-full px-4 py-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-on-surface text-xs placeholder:text-on-surface-variant focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container outline-none transition-all resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-full bg-surface-container-low text-on-surface hover:bg-surface-container text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit || !editContent.trim()}
                  className="px-5 py-2 rounded-full bg-primary-container text-on-primary hover:bg-primary text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingEdit ? (
                    <>
                      <span className="material-symbols-outlined text-[16px] animate-spin">
                        progress_activity
                      </span>
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">save</span>
                      <span>Salvar Alterações</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
