import React, { useState } from "react";
import { Post } from "../lib/api";

interface PostCardProps {
  post: Post;
  isHero?: boolean;
}

export const PostCard: React.FC<PostCardProps> = ({ post, isHero = false }) => {
  const [likes, setLikes] = useState(12);
  const [hasLiked, setHasLiked] = useState(false);

  const formattedDate = new Date(post.created_at).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleLike = () => {
    setLikes(hasLiked ? likes - 1 : likes + 1);
    setHasLiked(!hasLiked);
  };

  if (isHero) {
    return (
      <article className="relative overflow-hidden rounded-xl bg-surface-container-lowest/90 backdrop-blur-xl border border-outline-variant/30 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col group">
        <div className="relative w-full h-56 sm:h-64 overflow-hidden bg-primary-container">
          <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/40 to-transparent"></div>
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            <span className="px-3 py-1 rounded-full bg-surface-container-lowest/90 backdrop-blur-md text-primary text-[11px] shadow-sm font-semibold tracking-wide uppercase">
              {post.community_name ? `Comunidade: ${post.community_name}` : "Destaque da Rede"}
            </span>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/80 backdrop-blur-md text-on-primary text-[11px]">
              <span className="material-symbols-outlined text-[13px]">schedule</span>
              <span>{formattedDate}</span>
            </div>
          </div>
          <div className="absolute bottom-4 left-4 right-4">
            <span className="text-[11px] text-primary-fixed uppercase tracking-wider mb-1 block font-semibold">
              Publicação em Foco
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-on-primary tracking-tight leading-snug drop-shadow-sm line-clamp-2">
              {post.content.slice(0, 100)}...
            </h2>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-3">
          <p className="text-sm text-on-surface-variant leading-relaxed">
            {post.content}
          </p>

          <div className="flex items-center justify-between pt-3 border-t border-outline-variant/20 bg-surface-container-low/40 rounded-lg p-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-xs">
                {post.author_name ? post.author_name.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-on-surface">
                  {post.author_name}
                </span>
                <span className="text-[10px] text-outline">
                  {formattedDate}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-on-surface-variant">
              <button
                onClick={handleLike}
                className={`flex items-center gap-1 text-xs hover:text-primary transition-colors ${
                  hasLiked ? "text-error font-bold" : ""
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {hasLiked ? "favorite" : "favorite_border"}
                </span>
                <span>{likes}</span>
              </button>
              <button className="flex items-center gap-1 text-xs hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-[18px]">chat_bubble_outline</span>
                <span>4</span>
              </button>
              <button className="flex items-center gap-1 text-xs hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-[18px]">bookmark_border</span>
              </button>
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-xl p-5 bg-surface-container-lowest/80 backdrop-blur-xl border border-outline-variant/30 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary-container/20 text-primary flex items-center justify-center font-bold text-[10px]">
              {post.author_name ? post.author_name.charAt(0).toUpperCase() : "U"}
            </div>
            <span className="text-xs font-semibold text-on-surface">
              {post.author_name}
            </span>
            {post.community_name && (
              <span className="px-2 py-0.5 rounded-full bg-tertiary-fixed text-tertiary text-[10px] font-semibold">
                #{post.community_name}
              </span>
            )}
          </div>
          <span className="text-[11px] text-outline">{formattedDate}</span>
        </div>

        <p className="text-sm text-on-surface leading-relaxed whitespace-pre-wrap">
          {post.content}
        </p>
      </div>

      <div className="flex items-center justify-between pt-3 mt-3 border-t border-outline-variant/15 text-outline text-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1 hover:text-primary transition-colors ${
              hasLiked ? "text-error font-semibold" : ""
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {hasLiked ? "favorite" : "favorite_border"}
            </span>
            <span>{likes}</span>
          </button>
          <button className="flex items-center gap-1 hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-[16px]">chat_bubble_outline</span>
            <span>Comentar</span>
          </button>
        </div>
        <button className="flex items-center gap-1 hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-[16px]">share</span>
        </button>
      </div>
    </article>
  );
};
