import React from 'react';

export const PostSkeleton: React.FC = () => {
  return (
    <article className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/30 flex flex-col gap-4 animate-pulse">
      {/* 1. Header Skeleton */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar redondo */}
          <div className="w-10 h-10 rounded-full bg-surface-container-high shrink-0" />
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              {/* Nome do autor */}
              <div className="h-4 w-28 rounded-md bg-surface-container-high" />
              {/* Badge comunidade */}
              <div className="h-4 w-20 rounded-full bg-surface-container" />
            </div>
            {/* Timestamp */}
            <div className="h-3 w-16 rounded-md bg-surface-container" />
          </div>
        </div>
        {/* Menu 3-dots */}
        <div className="w-6 h-6 rounded-md bg-surface-container" />
      </div>

      {/* 2. Text lines skeleton */}
      <div className="space-y-2 py-1">
        <div className="h-4 w-full rounded-md bg-surface-container-high" />
        <div className="h-4 w-5/6 rounded-md bg-surface-container-high" />
        <div className="h-4 w-3/5 rounded-md bg-surface-container" />
      </div>

      {/* 3. Media block skeleton (16:9) */}
      <div className="w-full aspect-video rounded-xl bg-surface-container-high border border-outline-variant/20 flex items-center justify-center">
        <span className="material-symbols-outlined text-outline-variant/40 text-[40px]">
          image
        </span>
      </div>

      {/* 4. Action buttons skeleton */}
      <div className="flex items-center justify-between pt-2 border-t border-outline-variant/15">
        <div className="flex items-center gap-2">
          {/* Vote pill */}
          <div className="h-8 w-24 rounded-full bg-surface-container" />
          {/* Comments button */}
          <div className="h-8 w-20 rounded-full bg-surface-container" />
        </div>
        {/* Share button */}
        <div className="h-8 w-8 rounded-full bg-surface-container" />
      </div>
    </article>
  );
};
