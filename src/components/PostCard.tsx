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
    <article className="glass-panel rounded-2xl p-5 transition-all duration-200 hover:border-white/15">
      <div className="flex items-start gap-4">
        {/* Upvote / Downvote Pillar with Neon Green Highlights */}
        <div className="flex flex-col items-center bg-white/[0.04] rounded-2xl p-1.5 border border-white/[0.08] shrink-0">
          <button
            type="button"
            onClick={() => handleVote('up')}
            disabled={voting}
            title="Upvote"
            className={`p-1.5 rounded-xl transition-all cursor-pointer ${
              voted === 'up'
                ? 'bg-neon-green/20 text-neon-green shadow-glow-green font-bold'
                : 'text-neutral-400 hover:text-neon-green hover:bg-neon-green/10'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">arrow_upward</span>
          </button>

          <span
            className={`text-xs font-bold font-display my-1 ${
              score > 0
                ? 'text-neon-green'
                : score < 0
                ? 'text-rose-400'
                : 'text-neutral-400'
            }`}
          >
            {score}
          </span>

          <button
            type="button"
            onClick={() => handleVote('down')}
            disabled={voting}
            title="Downvote"
            className={`p-1.5 rounded-xl transition-all cursor-pointer ${
              voted === 'down'
                ? 'bg-rose-500/20 text-rose-400 font-bold'
                : 'text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">arrow_downward</span>
          </button>
        </div>

        {/* Post Main Body */}
        <div className="flex-1 min-w-0">
          {/* Header Metadata */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-white/[0.06] text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-display font-bold text-white text-sm">
                @{post.author_name || `usuario_${post.author_id}`}
              </span>

              {post.community_name && comSlug && (
                <Link
                  to={`/e/${comSlug}`}
                  className="px-2 py-0.5 rounded-lg bg-brand-blue/15 border border-brand-blue/30 text-blue-400 font-medium hover:bg-brand-blue/25 transition-colors"
                >
                  e/{post.community_name}
                </Link>
              )}

              {post.post_type === 'discussion' && (
                <span className="px-2 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-mono text-[10px] uppercase font-bold">
                  discussão
                </span>
              )}
            </div>

            <span className="text-neutral-500 text-xs">
              {new Date(post.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Title (for discussions) */}
          {post.title && (
            <h3 className="text-white font-display font-bold text-lg leading-snug mb-2">
              {post.title}
            </h3>
          )}

          {/* Content */}
          <p className="text-neutral-200 text-sm leading-relaxed whitespace-pre-wrap font-sans">
            {post.content}
          </p>

          {/* Media (Image / Video / GIF) */}
          {post.media_url && (
            <div className="mt-3.5 rounded-2xl overflow-hidden border border-white/10 bg-black/30 inline-block max-w-full">
              {post.media_type === 'video' ? (
                <video controls src={post.media_url} className="max-h-96 w-auto rounded-2xl" />
              ) : (
                <img
                  src={post.media_url}
                  alt="Mídia da postagem"
                  className="max-h-80 w-auto object-contain rounded-2xl"
                  loading="lazy"
                />
              )}
            </div>
          )}

          {/* Action Row */}
          <div className="mt-4 flex items-center justify-between pt-2 border-t border-white/[0.06] text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleComments}
                className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer text-xs font-medium ${
                  showComments
                    ? 'bg-brand-blue text-white border-brand-blue shadow-glow-blue'
                    : 'bg-white/[0.04] text-neutral-300 border-white/10 hover:bg-white/[0.08] hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">chat_bubble</span>
                <span>{commentsCount} {commentsCount === 1 ? 'Comentário' : 'Comentários'}</span>
              </button>

              {user && onCitar && (
                <button
                  type="button"
                  onClick={() => onCitar(post.author_name)}
                  className="px-2.5 py-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
                >
                  Citar
                </button>
              )}
            </div>

            <span className="text-[11px] text-neutral-500 font-mono">
              #{post.id}
            </span>
          </div>

          {/* Threaded Comments Section */}
          {showComments && (
            <div className="mt-4 p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                <span className="font-display font-bold text-xs text-neutral-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-brand-blue">forum</span>
                  Respostas da Comunidade ({comments.length})
                </span>
                <button
                  type="button"
                  onClick={() => setShowComments(false)}
                  className="text-xs text-neutral-400 hover:text-white cursor-pointer"
                >
                  Fechar
                </button>
              </div>

              {loadingComments && (
                <p className="text-center text-xs text-neutral-400 py-3">
                  Carregando respostas...
                </p>
              )}

              {!loadingComments && comments.length === 0 && (
                <p className="text-xs text-neutral-400 text-center py-3 italic">
                  Nenhum comentário por enquanto. Seja o primeiro a responder!
                </p>
              )}

              <div className="space-y-2.5">
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className={`p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs space-y-1.5 ${
                      c.parent_id ? 'ml-6 border-l-2 border-l-brand-blue' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between text-neutral-400 text-[11px]">
                      <span className="font-display font-bold text-white">
                        @{c.author_name}
                        {c.parent_id && <span className="text-neutral-500 font-normal ml-1.5 font-sans">(respondendo)</span>}
                      </span>
                      <span>{new Date(c.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <p className="text-neutral-200 leading-relaxed font-sans">{c.content}</p>

                    {user && (
                      <div className="text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setReplyParentId(c.id);
                            setNewComment(`@${c.author_name} `);
                          }}
                          className="text-[11px] text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
                        >
                          Responder »
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Form to submit reply */}
              {user ? (
                <form onSubmit={handleSendComment} className="space-y-2 pt-2 border-t border-white/[0.06]">
                  {replyParentId && (
                    <div className="flex items-center justify-between text-xs text-blue-400 bg-brand-blue/10 px-3 py-1 rounded-xl border border-brand-blue/20">
                      <span>Respondendo ao comentário #{replyParentId}</span>
                      <button
                        type="button"
                        onClick={() => setReplyParentId(null)}
                        className="text-rose-400 hover:underline cursor-pointer"
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
                      placeholder="Adicione um comentário construtivo..."
                      disabled={submittingComment}
                      className="flex-1 glass-input px-3 py-2 text-xs rounded-xl text-white outline-none"
                    />
                    <button
                      type="submit"
                      disabled={submittingComment || !newComment.trim()}
                      className="btn-primary-blue text-xs font-medium px-4 py-2 rounded-xl disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      {submittingComment ? '...' : 'Publicar'}
                    </button>
                  </div>
                </form>
              ) : (
                <p className="text-xs text-neutral-400 text-center pt-2">
                  <Link to="/login" className="text-brand-blue font-bold hover:underline">
                    Conecte-se
                  </Link>{' '}
                  para participar da discussão.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
};
