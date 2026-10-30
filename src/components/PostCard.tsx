import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Post, Comment, commentsApi, postsApi, authStorage } from '../lib/api';
import { VideoPlayer } from './VideoPlayer';

interface PostCardProps {
  post: Post;
  onVote?: (postId: number, voteType: 'up' | 'down') => void;
  onDelete?: (postId: number) => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, onVote, onDelete }) => {
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
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const score = upvotes - downvotes;

  return (
    <article className={`bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/30 flex flex-col gap-4 transition-all hover:shadow-md ${
      isDeleting ? 'opacity-50 pointer-events-none' : ''
    }`}>
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
                  to={`/e/${post.community_slug || post.community_id}`}
                  className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant text-xs font-medium flex items-center gap-1 hover:bg-secondary-fixed-dim transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                  e/{post.community_name}
                </Link>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface text-xs font-medium">
                  e/geral
                </span>
              )}
              <span className="text-on-surface-variant text-xs">
                · {new Date(post.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <span className="text-xs text-on-surface-variant">@{post.author_name.toLowerCase().replace(/\s+/g, '_')}</span>
          </div>
        </div>

        {/* Menu de Ações (Copiar Link e Deletar Post com remoção no R2) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMenu((prev) => !prev)}
            aria-label="Ações do post"
            disabled={isDeleting}
            className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px]">
              {isDeleting ? 'sync' : 'more_horiz'}
            </span>
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-8 z-40 w-52 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/30 py-1 flex flex-col animate-in fade-in duration-150">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      window.location.origin + `/e/${post.community_slug || post.community_id || 'geral'}#post-${post.id}`
                    );
                    setShowMenu(false);
                    alert('Link copiado para a área de transferência!');
                  }}
                  className="px-3.5 py-2 text-xs text-on-surface hover:bg-surface-container flex items-center gap-2 cursor-pointer transition-colors text-left"
                >
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant">content_copy</span>
                  <span>Copiar link</span>
                </button>

                {isAuthor && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      handleDelete();
                    }}
                    disabled={isDeleting}
                    className="px-3.5 py-2 text-xs text-error hover:bg-error-container/20 flex items-center gap-2 cursor-pointer transition-colors text-left border-t border-outline-variant/20 font-medium"
                  >
                    <span className="material-symbols-outlined text-[16px] text-error">delete</span>
                    <span>Excluir publicação</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 2. Conteúdo do Post */}
      <div className="flex flex-col gap-2.5">
        {post.title && (
          <h3 className="text-base sm:text-lg font-bold text-on-surface leading-snug">
            {post.title}
          </h3>
        )}

        {post.post_type === 'scrap' ? (
          <div className="relative p-4 rounded-xl bg-surface-container-low border-l-4 border-secondary flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-secondary flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">auto_stories</span>
              Scrap Nostálgico
            </span>
            <p className="text-sm italic text-on-surface font-serif">
              "{post.content}"
            </p>
          </div>
        ) : (
          <p className="text-sm text-on-surface leading-relaxed whitespace-pre-line">
            {post.content}
          </p>
        )}

        {/* Mídia Principal: Player de Vídeo Compacto (padrão X/Reddit max-w-[480px]) ou Imagem */}
        {post.media_url && (
          post.media_type === 'video' ||
          /\.(mp4|webm|mov|ogg|m4v)($|\?)/i.test(post.media_url) ||
          post.media_url.includes('/videos/') ? (
            <div className="mt-1 w-full flex justify-center">
              <VideoPlayer src={post.media_url} title={post.title || undefined} />
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
          )
        )}
      </div>

      {/* 3. BARRA DE AÇÕES: Votos reposicionados ao lado dos comentários (Stitch Design DNA) */}
      <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20">
        <div className="flex items-center gap-3">
          {/* Controle de Voto: Upvote + Número + Downvote separado */}
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

          {/* Comentários imediatamente ao lado dos votos */}
          <button
            type="button"
            onClick={loadComments}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors text-xs font-medium cursor-pointer"
          >
            <span className="material-symbols-outlined text-[19px]">chat_bubble_outline</span>
            <span>{commentsCount} comentários</span>
          </button>
        </div>

        {/* Lado Direito: Repostar, Salvar e Compartilhar */}
        <div className="flex items-center gap-1 text-on-surface-variant">
          <button
            type="button"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full hover:bg-surface-container hover:text-on-surface transition-colors text-xs cursor-pointer"
            title="Compartilhar"
          >
            <span className="material-symbols-outlined text-[19px]">repeat</span>
            <span className="hidden sm:inline">12</span>
          </button>
          <button
            type="button"
            aria-label="Salvar post"
            className="p-1.5 rounded-full hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[19px]">bookmark_border</span>
          </button>
          <button
            type="button"
            aria-label="Compartilhar post"
            className="p-1.5 rounded-full hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[19px]">share</span>
          </button>
        </div>
      </div>

      {/* Seção Expansível de Comentários */}
      {showComments && (
        <div className="pt-3 border-t border-outline-variant/20 flex flex-col gap-3">
          {/* Formulário de Novo Comentário */}
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

          {/* Lista de Comentários */}
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
  );
};
