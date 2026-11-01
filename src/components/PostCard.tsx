import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Post, postsApi, authStorage, adminApi, savedApi } from '../lib/api';
import { requestAuth } from '../lib/authEvents';
import { ReportModal } from './chat/ReportModal';
import { ShareButton } from './ShareButton';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { usePostTracking } from '../hooks/usePostTracking';
import { trackPost } from '../lib/events';
import { renderMarkdown } from '../lib/markdown';
import { LazyVideoPlayer } from './LazyVideoPlayer';
import { encodeScrap, parseScrap, scrapPaperStyle, DEFAULT_SCRAP_STYLE } from '../lib/scrapStyle';

// Recorte do texto no feed: acima disso o card mostra "Ler mais" e leva ao post
const FEED_CLAMP_CHARS = 320;

// Horário relativo, como no X e no Instagram ("agora", "12 min", "3 h", "2 d", depois a data)
function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(minutes) || minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

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
  const cardRef = useRef<HTMLElement>(null);
  usePostTracking(cardRef, post.id, !isDetail && Boolean(user) && post.author_id !== user?.id);
  const [upvotes, setUpvotes] = useState(post.upvotes);
  const [downvotes, setDownvotes] = useState(post.downvotes);
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null);
  const [isSaved, setIsSaved] = useState(Boolean(post.saved));
  const toggleSaved = () => {
    if (!authStorage.isAuthenticated()) {
      requestAuth({ mode: 'login', reason: 'Para salvar publicações, entre ou crie uma conta.' });
      return;
    }
    const next = !isSaved;
    setIsSaved(next);
    (next ? savedApi.add(post.id) : savedApi.remove(post.id)).catch(() => setIsSaved(!next));
  };
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
      requestAuth({ mode: 'login', reason: 'Para votar, entre ou crie uma conta.' });
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
    if (user && post.author_id !== user.id) trackPost({ post_id: post.id, type: 'open' });
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
  const hasMedia = Boolean(post.media_url);
  // Legenda embaixo (como no Instagram): o texto da publicação; sem texto, o título vira legenda. Mídia nunca mostra título.
  const captionBody = parseScrap(content || '').body.trim();
  const caption = captionBody || title.trim();
  const likers = post.liked_by || [];
  const likedByMe = userVote === 'up';
  const otherLikes = Math.max(0, upvotes - likers.length - (likedByMe ? 1 : 0));
  const previews = !isDetail ? post.comment_preview || [] : [];
  const handle = post.author_name.toLowerCase().replace(/\s+/g, '_');
  const clampFeed = !isDetail && Boolean(content && content.trim().length > FEED_CLAMP_CHARS) && post.post_type !== 'scrap';

  return (
    <>
      <article
        ref={cardRef}
        onClick={handleCardClick}
        className={`bg-surface-container-lowest sm:rounded-2xl overflow-hidden sm:shadow-sm border-0 border-b sm:border border-outline-variant flex flex-col transition-all sm:hover:shadow-md ${
          !isDetail ? 'cursor-pointer sm:hover:border-outline-variant/60' : ''
        } ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
      >
        {/* Para Você: motivo de a publicação aparecer */}
        {post.why && !isDetail && (
          <p className="px-3 sm:px-5 pt-2 text-[11px] font-semibold text-on-surface-variant flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">info</span>
            {post.why}
          </p>
        )}

        {/* 1. Cabeçalho: avatar e só o nome de usuário (o horário vai para baixo da publicação) */}
        <div className="px-3 sm:px-5 pt-2.5 sm:pt-4 pb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              to={`/perfil/${encodeURIComponent(post.author_name)}`}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary-container text-on-primary font-bold flex items-center justify-center text-sm uppercase shrink-0 hover:ring-2 hover:ring-primary transition-all cursor-pointer overflow-hidden"
              title={`Ver perfil de @${post.author_name}`}
            >
              {post.author_avatar ? (
                <img src={post.author_avatar} alt={post.author_name} className="w-full h-full object-cover" />
              ) : (
                post.author_name.charAt(0)
              )}
            </Link>

            <div className="flex flex-col min-w-0 leading-tight">
              <Link
                to={`/perfil/${encodeURIComponent(post.author_name)}`}
                className="text-sm font-semibold text-on-surface hover:underline truncate cursor-pointer"
              >
                {post.author_name}
              </Link>
              {post.community_name && (
                <Link
                  to={`/e/${post.community_slug || post.community_id}`}
                  className="text-xs font-semibold text-primary hover:underline truncate"
                >
                  e/{post.community_name}
                </Link>
              )}
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
                className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-50"
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
                  <div className="absolute right-0 top-8 z-40 w-48 bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant py-1.5 flex flex-col animate-in fade-in duration-150">
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
                      className="px-3.5 py-2 text-xs text-error hover:bg-error-container/20 flex items-center gap-2.5 cursor-pointer transition-colors text-left border-t border-outline-variant font-medium"
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
                          className="px-3.5 py-2 text-xs text-error hover:bg-error-container/20 flex items-center gap-2.5 cursor-pointer transition-colors text-left border-t border-outline-variant"
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

        {/* 2. Conteúdo: título e texto; no feed o texto longo é recortado com "Ler mais" */}
        {!hasMedia && (Boolean(title && title.trim()) || Boolean(content && content.trim())) && (
          <div className="px-3 sm:px-5 pb-3 flex flex-col gap-2 min-w-0">
            {Boolean(title && title.trim()) && (
              <h3 className="text-[15px] sm:text-lg font-bold text-on-surface leading-snug break-words">
                {title.trim()}
              </h3>
            )}

            {Boolean(content && content.trim()) && (
              post.post_type === 'scrap' ? (
                (() => {
                  const { style, body } = parseScrap(content);
                  const s = style || DEFAULT_SCRAP_STYLE;
                  return (
                    <div className="relative mx-1 my-2 px-5 pt-7 pb-5 rounded-sm -rotate-[0.6deg]" style={scrapPaperStyle(s)}>
                      {/* Fita adesiva do recado */}
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-20 h-5 bg-white/50 rotate-[-3deg] shadow-sm" />
                      <div className="whitespace-pre-wrap break-words">{renderMarkdown(body)}</div>
                      <p className="mt-3 text-right text-[0.6em] opacity-70">— @{post.author_name}</p>
                    </div>
                  );
                })()
              ) : (
                <div className="min-w-0">
                  <div
                    className={`text-sm text-on-surface leading-relaxed whitespace-pre-wrap break-words ${
                      clampFeed ? 'line-clamp-6' : ''
                    }`}
                  >
                    {renderMarkdown(content)}
                  </div>
                  {clampFeed && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/post/${post.id}`);
                      }}
                      className="mt-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
                    >
                      Ler mais
                    </button>
                  )}
                </div>
              )
            )}
          </div>
        )}

        {/* 3. Mídia: vai até as bordas do card; a altura é limitada para o feed não ficar gigante */}
        {post.media_url && (
          post.media_type === 'video' ||
          /\.(mp4|webm|mov|ogg|m4v)($|\?)/i.test(post.media_url) ||
          post.media_url.includes('/videos/') ? (
            <div className="w-full bg-black flex justify-center">
              <LazyVideoPlayer
                src={post.media_url}
                title={title || undefined}
                caption={(title.trim() || parseScrap(content || '').body.trim()).slice(0, 140) || undefined}
              />
            </div>
          ) : (
            <div className="w-full bg-surface-container-high dark:bg-black flex justify-center overflow-hidden">
              <img
                src={post.media_url}
                alt={title || 'Mídia da publicação'}
                className="w-full h-auto max-h-[min(72vh,560px)] object-cover block cursor-pointer"
                loading="lazy"
                decoding="async"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isDetail) {
                    if (post.media_url) window.open(post.media_url, '_blank');
                  } else {
                    navigate(`/post/${post.id}`);
                  }
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          )
        )}

        {/* 4. Ações no estilo de rede social: curtir, comentar, compartilhar e salvar, com ícones grandes */}
        <div className="px-2 sm:px-3 pt-1.5 flex items-center justify-between gap-1">
          <div className="flex items-center">
            <div className="flex items-center h-10 mr-1 rounded-full border border-outline-variant bg-surface-container-low overflow-hidden" role="group" aria-label="Votos">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleVoteClick('up');
                }}
                aria-label={`Upvote (${upvotes})`}
                aria-pressed={userVote === 'up'}
                className={`h-full pl-3 pr-2.5 flex items-center gap-1 transition-colors cursor-pointer ${userVote === 'up' ? 'text-primary' : 'text-on-surface hover:text-primary'}`}
              >
                <span className="material-symbols-outlined text-[24px]" style={userVote === 'up' ? { fontVariationSettings: "'FILL' 1, 'wght' 600" } : undefined}>arrow_upward</span>
                <span className="text-sm font-semibold tabular-nums">{upvotes}</span>
              </button>
              <span className="w-px h-5 bg-outline-variant" aria-hidden="true" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleVoteClick('down');
                }}
                aria-label={`Downvote (${downvotes})`}
                aria-pressed={userVote === 'down'}
                className={`h-full pl-2.5 pr-3 flex items-center gap-1 transition-colors cursor-pointer ${userVote === 'down' ? 'text-error' : 'text-on-surface hover:text-error'}`}
              >
                <span className="material-symbols-outlined text-[24px]" style={userVote === 'down' ? { fontVariationSettings: "'FILL' 1, 'wght' 600" } : undefined}>arrow_downward</span>
                <span className="text-sm font-semibold tabular-nums">{downvotes}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!isDetail) navigate(`/post/${post.id}`);
              }}
              className="h-10 px-2 rounded-full flex items-center gap-1.5 text-on-surface hover:text-on-surface-variant transition-colors cursor-pointer"
              title="Ver discussão e comentários"
              aria-label="Comentários"
            >
              <span className="material-symbols-outlined text-[28px]">chat_bubble_outline</span>
              <span className="text-sm font-semibold tabular-nums">{commentsCount}</span>
            </button>

            <ShareButton
              large
              url={`${window.location.origin}/post/${post.id}`}
              title={post.title?.trim() || `Publicação de @${post.author_name}`}
              text={post.content ? parseScrap(post.content).body.slice(0, 120) : undefined}
            />

          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleSaved();
            }}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer ${isSaved ? 'text-primary' : 'text-on-surface hover:text-on-surface-variant'}`}
            title={isSaved ? 'Salvo' : 'Salvar publicação'}
            aria-label={isSaved ? 'Remover dos salvos' : 'Salvar publicação'}
            aria-pressed={isSaved}
          >
            <span className="material-symbols-outlined text-[28px]" style={isSaved ? { fontVariationSettings: "'FILL' 1" } : undefined}>{isSaved ? 'bookmark' : 'bookmark_border'}</span>
          </button>
        </div>

        {/* Quem curtiu (amigos primeiro), legenda, comentários em destaque e horário */}
        <div className="px-3 sm:px-4 pt-0.5 pb-3 flex flex-col gap-1 text-sm text-on-surface min-w-0">
          {likers.length > 0 ? (
            <p>
              Curtido por{' '}
              <Link to={`/perfil/${encodeURIComponent(likers[0])}`} onClick={(e) => e.stopPropagation()} className="font-semibold hover:underline">{likers[0]}</Link>
              {likers.length > 1 && otherLikes === 0 && (
                <>
                  {' '}e{' '}
                  <Link to={`/perfil/${encodeURIComponent(likers[1])}`} onClick={(e) => e.stopPropagation()} className="font-semibold hover:underline">{likers[1]}</Link>
                </>
              )}
              {likers.length > 1 && otherLikes > 0 && (
                <>
                  ,{' '}
                  <Link to={`/perfil/${encodeURIComponent(likers[1])}`} onClick={(e) => e.stopPropagation()} className="font-semibold hover:underline">{likers[1]}</Link>
                </>
              )}
              {otherLikes > 0 && (
                <>
                  {' '}e <span className="font-semibold">outras {otherLikes} {otherLikes === 1 ? 'pessoa' : 'pessoas'}</span>
                </>
              )}
            </p>
          ) : upvotes > 0 ? (
            <p className="font-semibold">{upvotes} {upvotes === 1 ? 'curtida' : 'curtidas'}</p>
          ) : null}

          {hasMedia && caption && (
            <p className={`break-words ${isDetail ? '' : 'line-clamp-2'}`}>
              <Link to={`/perfil/${encodeURIComponent(post.author_name)}`} onClick={(e) => e.stopPropagation()} className="font-semibold hover:underline mr-1.5">{post.author_name}</Link>
              <span className="whitespace-pre-wrap [&_p]:inline [&_div]:inline">{captionBody ? renderMarkdown(captionBody) : caption}</span>
            </p>
          )}

          {!isDetail && commentsCount > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/post/${post.id}`);
              }}
              className="self-start text-on-surface-variant hover:text-on-surface cursor-pointer"
            >
              {commentsCount === 1 ? 'Ver 1 comentário' : `Ver todos os ${commentsCount} comentários`}
            </button>
          )}
          {previews.map((c) => (
            <p key={c.username + c.content} className="break-words line-clamp-2">
              <Link to={`/perfil/${encodeURIComponent(c.username)}`} onClick={(e) => e.stopPropagation()} className="font-semibold hover:underline mr-1.5">{c.username}</Link>
              {c.content}
            </p>
          ))}

          <time dateTime={post.created_at} title={new Date(post.created_at).toLocaleString('pt-BR')} className="text-[11px] uppercase tracking-wide text-on-surface-variant pt-0.5">
            {timeAgo(post.created_at)}
          </time>
        </div>
      </article>

      {/* MODAL DE EDIÇÃO DA PUBLICAÇÃO */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant shadow-2xl flex flex-col gap-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant">
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
                    className="w-full px-4 py-2.5 rounded-2xl bg-surface-container-low border border-outline-variant text-on-surface text-xs placeholder:text-on-surface-variant focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container outline-none transition-all"
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
                  className="w-full px-4 py-3 rounded-2xl bg-surface-container-low border border-outline-variant text-on-surface text-xs placeholder:text-on-surface-variant focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container outline-none transition-all resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-outline-variant">
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
