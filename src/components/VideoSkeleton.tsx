import React from 'react';

export const VideoSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col gap-3 w-full max-w-[360px] mx-auto animate-pulse">
      {/* 16:9 Thumbnail Block */}
      <div className="relative w-full aspect-video rounded-2xl bg-surface-container-high border border-outline-variant/20 shadow-xs flex items-center justify-center overflow-hidden">
        <span className="material-symbols-outlined text-outline-variant/30 text-[48px]">
          movie
        </span>
        <div className="absolute bottom-2.5 right-2.5 h-4 w-12 rounded bg-surface-container/80" />
      </div>

      {/* Info Block */}
      <div className="flex gap-3 items-start">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-surface-container-high shrink-0 mt-0.5" />
        {/* Texts */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <div className="h-4 w-full rounded-md bg-surface-container-high" />
          <div className="h-3 w-3/4 rounded-md bg-surface-container" />
          <div className="h-3 w-1/3 rounded-md bg-surface-container-low mt-0.5" />
        </div>
      </div>
    </div>
  );
};
