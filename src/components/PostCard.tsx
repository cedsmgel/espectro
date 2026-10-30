import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Post, Comment, api, authStorage } from '../lib/api';

interface PostCardProps {
  post: Post;
  onCitar?: (author: string) => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, onCitar }) => {
  const user = authStorage.getUser();

  const [upvotes, setUpvotes] = useState(post.upvotes || 0);
  const [downvotes, setDownvotes] = useState(post.downvotes || 0);
  const [voted, setVoted] = useState<'up' | 'down' | null>(null);
  const [voting, setVoting] = useState(false);

  // Threaded Comments
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyParentId, setReplyParentId] = useState<number | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);

  const handleVote = async (type: 'up' | 'down') => {
    if (!user) {
      alert('Faça login para votar nas postagens!');
      return;
    }
    if (voted === type || voting) return;

    try {
      setVoting(true);
      const res = await api.votePost(post.id, type);
      setUpvotes(res.upvotes);
      setDownvotes(res.downvotes);
      setVoted(type);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setVoting(false);
    }
  };

  const toggleComments = async () => {
    if (showComments) {
      setShowComments(false);
      return;
    }

    setShowComments(true);
    setReplyParentId(null);
    setNewComment('');

    try {
      setLoadingComments(true);
      const data = await api.getComments(post.id);
      setComments(data);
      setCommentsCount(data.length);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;

    try {
      setSubmittingComment(true);
      await api.createComment({
        post_id: post.id,
        content: newComment.trim(),
        parent_id: replyParentId,
      });

      setNewComment('');
      setReplyParentId(null);
      const updated = await api.getComments(post.id);
      setComments(updated);
      setCommentsCount(updated.length);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao enviar comentário');
    } finally {
      setSubmittingComment(false);
    }
  };

  const score = upvotes - downvotes;
  const comSlug = post.community_slug || post.community_id;

  return (
    <article className="bg-white rounded classic-bevel-border overflow-hidden p-space-md transition-shadow hover:shadow-sm">
      <div className="flex items-start gap-space-md">
        {/* Vote Pillar (Reddit style) */}
        <div className="flex flex-col items-center bg-surface-container rounded p-1 border border-outline-variant shrink-0">
          <button
            type="button"
            onClick={() => handleVote('up')}
            disabled={voting}
            title="Gostei / Upvote"
            className={`p-1 rounded hover:bg-surface-container-high transition-colors cursor-pointer ${
              voted === 'up' ? 'text-primary font-bold' : 'text-secondary'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">thumb_up</span>
          </button>
          <span className={`text-label-md font-bold my-0.5 ${score > 0 ? 'text-primary' : score < 0 ? 'text-error' : 'text-secondary'}`}>
            {score}
          </span>
          <button
            type="button"
            onClick={() => handleVote('down')}
            disabled={voting}
            title="Não gostei / Downvote"
            className={`p-1 rounded hover:bg-surface-container-high transition-colors cursor-pointer ${
              voted === 'down' ? 'text-error font-bold' : 'text-secondary'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">thumb_down</span>
          </button>
        </div>

        {/* Post Main Body */}
        <div className="flex-1 min-w-0">
          {/* Header Metadata */}
          <div className="flex flex-wrap items-baseline justify-between gap-1 border-b border-dashed border-outline-variant pb-1 mb-1.5 text-body-sm">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-primary">
                @{post.author_name || `usuario_${post.author_id}`}
              </span>

              {post.post_type === 'discussion' && (
                <span className="bg-primary text-white text-[10px] px-1.5 py-0.2 rounded font-bold uppercase">
                  discussão
                </span>
              )}

              {post.community_name && comSlug && (
                <span className="text-[11px] text-secondary">
                  em{' '}
                  <Link
                    to={`/e/${comSlug}`}
                    className="bg-surface-container-highest px-1.5 py-0.5 rounded text-primary font-semibold hover:underline"
                  >
                    e/{post.community_name}
                  </Link>
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 text-[11px] text-secondary">
              <span className="material-symbols-outlined text-[13px]">schedule</span>
              {new Date(post.created_at).toLocaleString('pt-BR')}
            </div>
          </div>

          {/* Title (for discussion posts) */}
          {post.title && (
            <h3 className="text-primary font-bold text-headline-sm mb-1">
              {post.title}
            </h3>
          )}

          {/* Post Text */}
          <p className="text-body-md font-body-md text-on-surface leading-relaxed whitespace-pre-wrap">
            {post.content}
          </p>

          {/* Media (Image / Video / GIF) */}
          {post.media_url && (
            <div className="mt-2 rounded overflow-hidden border border-outline-variant inline-block max-w-full">
              {post.media_type === 'video' ? (
                <video controls src={post.media_url} className="max-h-80 w-auto rounded" />
              ) : (
                <img
                  src={post.media_url}
                  alt="Mídia do post"
                  className="max-h-72 w-auto object-contain rounded bg-black/5"
                  loading="lazy"
                />
              )}
            </div>
          )}

          {/* Action Row */}
          <div className="mt-2.5 flex items-center justify-between pt-1 border-t border-dotted border-outline-variant text-label-sm">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleComments}
                className={`px-2 py-0.5 rounded border flex items-center gap-1 transition-colors cursor-pointer ${
                  showComments
                    ? 'bg-primary text-white border-primary font-bold'
                    : 'bg-surface-container text-primary border-outline-variant hover:bg-surface-container-high'
                }`}
              >
                <span className="material-symbols-outlined text-[13px]">chat_bubble</span>
                <span>{commentsCount} {commentsCount === 1 ? 'Comentário' : 'Comentários'}</span>
              </button>

              {user && onCitar && (
                <button
                  type="button"
                  onClick={() => onCitar(post.author_name)}
                  className="text-secondary hover:text-primary transition-colors cursor-pointer"
                >
                  [Citar]
                </button>
              )}
            </div>

            <span className="text-[10px] text-secondary">
              {post.post_type === 'discussion' ? 'Tópico de Comunidade' : 'Scrapbook'}
            </span>
          </div>

          {/* Threaded Comments Section */}
          {showComments && (
            <div className="mt-3 p-3 bg-surface-container-low rounded border border-[#b2ccf7] space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-outline-variant pb-1">
                <span className="font-bold text-primary text-label-md flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">forum</span>
                  Comentários ({comments.length})
                </span>
                <button
                  type="button"
                  onClick={() => setShowComments(false)}
                  className="text-[11px] text-secondary hover:underline cursor-pointer"
                >
                  Fechar
                </button>
              </div>

              {loadingComments && (
                <p className="text-center text-body-sm text-secondary py-2">
                  Carregando comentários...
                </p>
              )}

              {!loadingComments && comments.length === 0 && (
                <p className="text-body-sm text-secondary text-center py-2 italic">
                  Nenhum comentário por enquanto. Deixe a sua resposta!
                </p>
              )}

              <div className="space-y-2">
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className={`p-2 bg-white rounded border border-outline-variant text-body-sm ${
                      c.parent_id ? 'ml-6 border-l-4 border-l-primary-container' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-secondary mb-1">
                      <span className="font-bold text-primary">
                        @{c.author_name}
                        {c.parent_id && <span className="font-normal text-secondary ml-1">(em resposta)</span>}
                      </span>
                      <span>{new Date(c.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-on-surface whitespace-pre-wrap">{c.content}</p>

                    {user && (
                      <div className="mt-1 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setReplyParentId(c.id);
                            setNewComment(`@${c.author_name} `);
                          }}
                          className="text-[10px] text-primary hover:underline font-bold cursor-pointer"
                        >
                          Responder »
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Form to submit reply/comment */}
              {user ? (
                <form onSubmit={handleSendComment} className="space-y-1.5 pt-2 border-t border-outline-variant">
                  {replyParentId && (
                    <div className="flex items-center justify-between text-[11px] text-primary bg-surface-container px-2 py-0.5 rounded">
                      <span>Respondendo ao comentário #{replyParentId}</span>
                      <button
                        type="button"
                        onClick={() => setReplyParentId(null)}
                        className="text-error font-bold cursor-pointer"
                      >
                        ✕ Cancelar
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Escreva seu comentário..."
                      disabled={submittingComment}
                      className="flex-1 bg-white border border-outline-variant rounded px-2 py-1 text-body-sm outline-none focus:border-primary text-primary"
                    />
                    <button
                      type="submit"
                      disabled={submittingComment || !newComment.trim()}
                      className="retro-btn-primary text-white text-label-sm px-3 py-1 rounded font-bold disabled:opacity-50 cursor-pointer"
                    >
                      {submittingComment ? '...' : 'Enviar'}
                    </button>
                  </div>
                </form>
              ) : (
                <p className="text-body-sm text-secondary text-center pt-1">
                  <Link to="/login" className="text-primary font-bold underline">
                    Faça login
                  </Link>{' '}
                  para responder a este post.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
};
