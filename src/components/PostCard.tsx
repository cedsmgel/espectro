import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Post, postsApi, authStorage, adminApi } from '../lib/api';
import { ReportModal } from './chat/ReportModal';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { renderMarkdown } from '../lib/markdown';
import { LazyVideoPlayer } from './LazyVideoPlayer';
import { encodeScrap, parseScrap, scrapPaperStyle, DEFAULT_SCRAP_STYLE } from '../lib/scrapStyle';

interface PostCardProps {
  post: Post;
  onVote?: (postId: number, voteType: 'up' | 'down') => void;
  onDelete?: (postId: number) => void;
  onUpdate?: (updatedPost: Post) => void;
  isDetail?: boolean;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  onVote,
  onDelete,
  onUpdate,
  isDetail = false,
}) => {
  const navigate = useNavigate();
  const user = authStorage.getUser();
  const [upvotes, setUpvotes] = useState(post.upvotes);
  const [downvotes, setDownvotes] = useState(post.downvotes);
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.comments_count);

  // Estados de edição e exclusão
  const [showMenu, setShowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const isAdmin = useIsAdmin();
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

  const handleCardClick = (e: React.MouseEvent) => {
    if (isDetail) return;
    const target = e.target as HTMLElement;
    if (
      target.closest('a') ||
      target.closest('button') ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('[role="button"]')
    ) {
      return;
    }
    navigate(`/post/${post.id}`);
  };

  // Exclusão do post chamando DELETE /api/posts/:id (com limpeza no Cloudflare R2)
  const handleDelete = async () => {
    if (!isAuthor) return;
    const hasMedia = Boolean(post.media_url);
    const confirmMessage = hasMedia
      ? 'Tem certeza que deseja excluir esta publicação? As mídias associadas serão removidas permanentemente.'
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

  // Remoção de qualquer publicação por um administrador
  const handleAdminRemove = async () => {
    if (!window.confirm('Remover esta publicação como administrador? Isso apaga também os comentários e a mídia.')) return;
    setIsDeleting(true);
    try {
      await adminApi.removeContent('post', post.id);
      onDelete?.(post.id);
    } catch (err: any) {
      alert(err.message || 'Erro ao remover publicação.');
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
    // Preserva a personalização do Scrap ao editar
    const existingStyle = parseScrap(content).style;
    const finalContent = existingStyle ? encodeScrap(existingStyle, editContent.trim()) : editContent.trim();
    try {
      const res = await postsApi.update(post.id, {
        title: editTitle.trim() || null,
        content: finalContent,
      });

      setContent(finalContent);
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
        onClick={handleCardClick}
        className={`bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm border border-outline-variant/30 flex flex-col transition-all hover:shadow-md ${
          !isDetail ? 'cursor-pointer hover:border-outline-variant/60' : ''
        } ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
      >
        {/* 1. Cabeçalho do Post */}
        <div className="p-4 sm:p-5 pb-2 sm:pb-3 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Link
              to={`/perfil/${encodeURIComponent(post.author_name)}`}
              className="w-10 h-10 rounded-full bg-primary-container text-on-primary font-bold flex items-center justify-center text-sm uppercase shadow-xs shrink-0 hover:ring-2 hover:ring-primary transition-all cursor-pointer"
              title={`Ver perfil de @${post.author_name}`}
            >
              {post.author_avatar ? (
                <img
                  src={post.author_avatar}
                  alt={post.author_name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                post.author_name.charAt(0)
              )}
            </Link>

            <div className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  to={`/perfil/${encodeURIComponent(post.author_name)}`}
                  className="font-semibold text-sm text-on-surface hover:text-primary hover:underline transition-colors cursor-pointer"
                >
                  {post.author_name}
                </Link>

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
              <Link
                to={`/perfil/${encodeURIComponent(post.author_name)}`}
                className="text-xs text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
              >
                @{post.author_name.toLowerCase().replace(/\s+/g, '_')}
              </Link>
            </div>
          </div>

          {/* Menu Kebab (Três Pontinhos) - Só aparece se o usuário logado for o autor do post e não estiver em detalhe */}
          {((isAuthor && !isDetail) || (!isAuthor && Boolean(user))) && (
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
                    {isAuthor ? (
                    <>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        setEditTitle(title);
                        setEditContent(parseScrap(content).body);
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
                    </>
                    ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setShowMenu(false);
                          setShowReport(true);
                        }}
                        className="px-3.5 py-2 text-xs text-on-surface hover:bg-surface-container flex items-center gap-2.5 cursor-pointer transition-colors text-left"
                      >
                        <span className="material-symbols-outlined text-[17px] text-error">flag</span>
                        <span>Denunciar publicação</span>
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowMenu(false);
                            void handleAdminRemove();
                          }}
                          className="px-3.5 py-2 text-xs text-error hover:bg-error-container/20 flex items-center gap-2.5 cursor-pointer transition-colors text-left border-t border-outline-variant/30"
                        >
                          <span className="material-symbols-outlined text-[17px]">gavel</span>
                          <span>Remover (administrador)</span>
                        </button>
                      )}
                    </>
                    )}
                  </div>
                </>
              )}
              {showReport && (
                <ReportModal
                  userId={post.author_id}
                  username={post.author_name}
                  postId={post.id}
                  onDone={() => {
                    setShowReport(false);
                    alert('Denúncia enviada. Obrigado por ajudar a manter o Espectro seguro.');
                  }}
                  onClose={() => setShowReport(false)}
                />
              )}
            </div>
          )}
        </div>

        {/* 2. Conteúdo do Post (Título e Legenda com padding) */}
        {(Boolean(title && title.trim()) || Boolean(content && content.trim())) && (
          <div className="px-4 sm:px-5 pb-3 flex flex-col gap-2">
            {Boolean(title && title.trim()) && (
              <h3 className="text-base sm:text-lg font-bold text-on-surface leading-snug">
                {title.trim()}
              </h3>
            )}

            {Boolean(content && content.trim()) && (
              post.post_type === 'scrap' ? (
                (() => {
                  const { style, body } = parseScrap(content);
                  const s = style || DEFAULT_SCRAP_STYLE;
                  return (
                    <div className="relative mx-1 my-2 px-5 pt-7 pb-5 rounded-sm shadow-[0_8px_20px_rgba(0,0,0,0.35)] -rotate-[0.6deg]" style={scrapPaperStyle(s)}>
                      {/* Fita adesiva do recado */}
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-20 h-5 bg-white/50 rotate-[-3deg] shadow-sm" />
                      <div className="whitespace-pre-wrap break-words">{renderMarkdown(body)}</div>
                      <p className="mt-3 text-right text-[0.6em] opacity-70">— @{post.author_name}</p>
                    </div>
                  );
                })()
              ) : (
                <div className="text-sm text-on-surface leading-relaxed whitespace-pre-wrap break-words">
                  {renderMarkdown(content)}
                </div>
              )
            )}
          </div>
        )}

        {/* 3. Mídia Principal: Colada nas bordas laterais do card (sem padding lateral) */}
        {post.media_url && (
          post.media_type === 'video' ||
          /\.(mp4|webm|mov|ogg|m4v)($|\?)/i.test(post.media_url) ||
          post.media_url.includes('/videos/') ? (
            <div className="w-full bg-black flex justify-center">
              <LazyVideoPlayer src={post.media_url} title={title || undefined} />
            </div>
          ) : (
            <div className="w-full bg-black/10 dark:bg-black/40 flex justify-center overflow-hidden">
              <img
                src={post.media_url}
                alt={title || "Mídia da postagem"}
                className="w-full h-auto max-h-[500px] object-cover block cursor-pointer transition-transform duration-300 hover:scale-[1.005]"
                loading="lazy"
                onClick={() => {
                  if (post.media_url) window.open(post.media_url, '_blank');
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          )
        )}

        {/* 4. Barra de Ações: Votos, Comentários, Salvar e Compartilhar */}
        <div className="p-4 sm:p-5 pt-3 border-t border-outline-variant/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Controle de Voto */}
            <div className="flex items-center bg-surface-container-low rounded-full px-1.5 py-0.5 border border-outline-variant/30">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleVoteClick('up');
                }}
                aria-label="Upvote"
                className={`p-1 rounded-full transition-colors flex items-center justify-center cursor-pointer ${
                  userVote === 'up'
                    ? 'text-olive bg-olive/15 shadow-xs'
                    : 'text-on-surface-variant hover:text-primary hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-[19px]">keyboard_arrow_up</span>
              </button>
              <span
                className={`px-2 text-xs font-bold ${
                  score > 0 ? (userVote === 'up' ? 'text-olive' : 'text-primary') : score < 0 ? 'text-error' : 'text-on-surface'
                }`}
              >
                {score > 0 ? `+${score}` : score}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleVoteClick('down');
                }}
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

            {/* Balão de Comentário -> Navega para /post/:id */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!isDetail) {
                  navigate(`/post/${post.id}`);
                }
              }}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors text-xs font-medium cursor-pointer"
              title="Ver discussão e comentários"
            >
              <span className="material-symbols-outlined text-[19px]">chat_bubble_outline</span>
              <span>{commentsCount}</span>
            </button>
          </div>

          {/* Lado Direito: Salvar e Compartilhar */}
          <div className="flex items-center gap-1 text-on-surface-variant">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsSaved((v) => !v);
              }}
              className={`p-1.5 rounded-full hover:bg-surface-container transition-colors cursor-pointer ${
                isSaved ? 'text-primary' : 'hover:text-on-surface'
              }`}
              title={isSaved ? 'Salvo' : 'Salvar publicação'}
            >
              <span className="material-symbols-outlined text-[19px]">
                {isSaved ? 'bookmark' : 'bookmark_border'}
              </span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(
                  window.location.origin + `/post/${post.id}`
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
