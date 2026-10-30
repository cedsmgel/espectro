import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Post, Comment, commentsApi, authStorage } from '../lib/api';

interface PostCardProps {
  post: Post;
  onVote?: (postId: number, voteType: 'up' | 'down') => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, onVote }) => {
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

  const score = upvotes - downvotes;

  return (
    <article className="glass-surface rounded-2xl p-5 flex gap-4 transition-all duration-200 hover:border-white/20 hover:shadow-[0_12px_32px_-4px_rgba(0,0,0,0.6)]">
      {/* Left Upvote Column from Stitch */}
      <div className="flex flex-col items-center justify-start gap-1 pt-1 shrink-0">
        <button
          type="button"
          onClick={() => handleVoteClick('up')}
          className={`p-1.5 rounded-xl transition-all cursor-pointer ${
            userVote === 'up'
              ? 'text-cyan-300 bg-cyan-400/20 shadow-[0_0_12px_rgba(76,215,246,0.3)]'
              : 'text-neutral-400 hover:text-cyan-300 hover:bg-white/5'
          }`}
          title="Upvote"
        >
          <span className="material-symbols-outlined text-[22px]">keyboard_arrow_up</span>
        </button>

        <span
          className={`text-xs font-bold font-mono tracking-tight ${
            score > 0
              ? 'text-cyan-300'
              : score < 0
              ? 'text-rose-400'
              : 'text-neutral-400'
          }`}
        >
          {score > 0 ? `+${score}` : score}
        </span>

        <button
          type="button"
          onClick={() => handleVoteClick('down')}
          className={`p-1.5 rounded-xl transition-all cursor-pointer ${
            userVote === 'down'
              ? 'text-rose-400 bg-rose-500/20 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
              : 'text-neutral-400 hover:text-white hover:bg-white/5'
          }`}
          title="Downvote"
        >
          <span className="material-symbols-outlined text-[22px]">keyboard_arrow_down</span>
        </button>
      </div>

      {/* Main Post Content */}
      <div className="flex flex-col gap-3 flex-1 min-w-0">
        {/* Meta Header from Stitch */}
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            {post.community_name ? (
              <Link
                to={`/e/${post.community_slug || post.community_id}`}
                className="px-2.5 py-0.5 rounded-full bg-blue-500/15 text-cyan-300 border border-blue-400/30 font-semibold hover:bg-blue-500/25 transition-colors"
              >
                e/{post.community_name}
              </Link>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-white/5 text-neutral-300 border border-white/10 font-medium">
                e/geral
              </span>
            )}
            <span className="text-neutral-500">•</span>
            <div className="flex items-center gap-1.5 text-neutral-400">
              <span className="text-white font-medium hover:underline cursor-pointer">
                @{post.author_name}
              </span>
              <span className="text-neutral-500">
                há{' '}
                {new Date(post.created_at).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Original
            </span>
          </div>

          <button type="button" className="text-neutral-400 hover:text-white p-1 rounded-lg">
            <span className="material-symbols-outlined text-[18px]">more_horiz</span>
          </button>
        </div>

        {/* Title if discussion */}
        {post.title && (
          <h3 className="text-base sm:text-lg font-display font-semibold text-white leading-snug hover:text-cyan-300 transition-colors cursor-pointer">
            {post.title}
          </h3>
        )}

        {/* Scrap Nostalgic Highlight Box from Stitch */}
        {post.post_type === 'scrap' ? (
          <div className="relative p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-purple-500/10 border border-amber-400/30 shadow-[0_0_20px_rgba(245,158,11,0.1)] backdrop-blur-md">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-300 text-[18px]">
                  history_edu
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  Scrap Nostálgico
                </span>
              </div>
              <span className="text-[10px] text-neutral-400">Não apaga!</span>
            </div>
            <p className="text-sm italic text-amber-100/90 font-serif pl-3 border-l-2 border-amber-400/40">
              “{post.content}”
            </p>
            <div className="mt-2.5 flex items-center justify-between text-xs">
              <span className="text-neutral-400 font-medium">— @{post.author_name}</span>
              <button
                type="button"
                onClick={loadComments}
                className="text-amber-300 hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>Responder Scrap</span>
                <span className="material-symbols-outlined text-[14px]">reply</span>
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-200 leading-relaxed font-sans whitespace-pre-line">
            {post.content}
          </p>
        )}

        {/* Media Preview Container from Stitch */}
        {post.media_url && (
          <div className="relative rounded-xl overflow-hidden border border-white/10 glass-recessed group cursor-pointer my-1 w-full max-h-80 aspect-video">
            <img
              src={post.media_url}
              alt="Mídia da postagem"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              style={{ objectFit: 'cover' }}
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0c0e13]/90 via-transparent to-transparent flex items-end p-4">
              <div className="flex items-center justify-between w-full">
                <span className="text-[10px] font-semibold text-cyan-300 flex items-center gap-1 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10">
                  <span className="material-symbols-outlined text-[14px]">view_in_ar</span>
                  espectro_media.fig
                </span>
                <span className="text-[10px] text-white/70">Clique para inspecionar</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Toolbar Footer from Stitch */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-neutral-400">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={loadComments}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                showComments ? 'bg-white/10 text-white' : 'hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">chat_bubble</span>
              <span>{commentsCount} Comentários</span>
            </button>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                alert('Link da publicação copiado!');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-white/5 hover:text-white transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">share</span>
              <span>Compartilhar</span>
            </button>

            <button
              type="button"
              onClick={loadComments}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-amber-400/10 hover:text-amber-300 transition-all text-amber-300/80 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">history_edu</span>
              <span>Enviar Scrap</span>
            </button>
          </div>

          <button
            type="button"
            className="p-2 rounded-xl hover:bg-white/5 hover:text-white transition-all cursor-pointer"
            title="Salvar Post"
          >
            <span className="material-symbols-outlined text-[18px]">bookmark_border</span>
          </button>
        </div>

        {/* Threaded Comments Section */}
        {showComments && (
          <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
            {/* New Comment Input */}
            {user ? (
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={
                    replyToId ? 'Respondendo comentário...' : 'Deixe uma resposta nessa thread...'
                  }
                  className="flex-1 glass-recessed rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-400 transition-all"
                />
                <button
                  type="submit"
                  disabled={submittingComment || !newComment.trim()}
                  className="btn-primary-blue text-xs font-semibold px-4 py-2 rounded-xl disabled:opacity-50 cursor-pointer"
                >
                  {submittingComment ? '...' : 'Enviar'}
                </button>
              </form>
            ) : (
              <p className="text-xs text-neutral-400 italic">
                <Link to="/login" className="text-cyan-400 hover:underline">
                  Faça login
                </Link>{' '}
                para comentar nesta conversa.
              </p>
            )}

            {/* Comments List */}
            {loadingComments ? (
              <div className="text-xs text-neutral-400 animate-pulse py-2">
                Carregando comentários...
              </div>
            ) : comments.length === 0 ? (
              <div className="text-xs text-neutral-400 italic py-2">
                Nenhum comentário ainda. Seja o primeiro a responder!
              </div>
            ) : (
              <div className="space-y-2.5">
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className={`p-3 rounded-xl glass-recessed text-xs space-y-1 ${
                      c.parent_id ? 'ml-6 border-l-2 border-cyan-500/40' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between text-neutral-400">
                      <span className="font-semibold text-white">@{c.author_name}</span>
                      <span className="text-[10px]">
                        {new Date(c.created_at).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-neutral-200">{c.content}</p>
                    {user && (
                      <button
                        type="button"
                        onClick={() => {
                          setReplyToId(c.id);
                          setNewComment(`@${c.author_name} `);
                        }}
                        className="text-[10px] text-cyan-400 hover:underline pt-1 cursor-pointer"
                      >
                        Responder
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
};
