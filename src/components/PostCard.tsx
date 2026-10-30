import React from "react";
import { Post } from "../lib/api";

interface PostCardProps {
  post: Post;
}

export const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const formattedDate = new Date(post.created_at).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <article className="bg-white border border-[#bfd4f2] rounded-lg p-4 shadow-sm hover:border-[#85a9df] transition-all">
      <div className="flex items-start space-x-3">
        {/* Avatar Nostálgico com inicial */}
        <div className="w-10 h-10 rounded-md bg-[#e8eef7] border border-[#a2bfeb] flex items-center justify-center font-bold text-[#3b5998] text-lg flex-shrink-0 shadow-inner">
          {post.author_name ? post.author_name.charAt(0).toUpperCase() : "?"}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#2d4373] text-sm hover:underline cursor-pointer">
                {post.author_name}
              </span>
              {post.community_name && (
                <span className="text-xs bg-[#e8eef7] text-[#3b5998] px-2 py-0.5 rounded-full font-semibold border border-[#c9daf3]">
                  em {post.community_name}
                </span>
              )}
            </div>
            <time className="text-xs text-gray-500">{formattedDate}</time>
          </div>

          <p className="text-gray-800 text-sm whitespace-pre-wrap leading-relaxed mt-1">
            {post.content}
          </p>
        </div>
      </div>
    </article>
  );
};
