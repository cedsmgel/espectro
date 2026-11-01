import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ThumbImg } from './ThumbImg';
import type { Post } from '../lib/api';

function isVideo(post: Post): boolean {
  return post.media_type === 'video' || /\.(mp4|webm|mov|ogg|m4v)($|\?)/i.test(post.media_url || '');
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Miniatura de vídeo: só pede o arquivo quando chega perto da tela e mostra o primeiro quadro
const VideoThumb: React.FC<{ src: string }> = ({ src }) => {
  const holderRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(typeof IntersectionObserver === 'undefined');
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const element = holderRef.current;
    if (near || !element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true);
      },
      { rootMargin: '300px' }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [near]);

  return (
    <div ref={holderRef} className="absolute inset-0 bg-surface-container-low">
      {near && (
        <video
          src={`${src}#t=0.1`}
          muted
          playsInline
          preload="metadata"
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          className="w-full h-full object-cover"
        />
      )}
      {duration > 0 && (
        <span className="absolute bottom-1.5 left-1.5 text-[11px] font-semibold text-white tabular-nums drop-shadow">
          {formatDuration(duration)}
        </span>
      )}
    </div>
  );
};

// Grade de fotos e vídeos do perfil: 3 colunas, miniaturas em pé e só uma linha fina entre elas
export const MediaGrid: React.FC<{ posts: Post[] }> = ({ posts }) => (
  <ul className="grid grid-cols-3 gap-px bg-outline-variant border border-outline-variant">
    {posts.map((post) => {
      const video = isVideo(post);
      return (
        <li key={post.id} className="bg-surface">
          <Link
            to={video ? `/shorts?id=${post.id}` : `/post/${post.id}`}
            aria-label={post.title?.trim() || (video ? 'Abrir vídeo' : 'Abrir foto')}
            className="group relative block aspect-[3/4] overflow-hidden bg-surface-container-low"
          >
            {video ? (
              <VideoThumb src={post.media_url as string} />
            ) : (
              <ThumbImg
                src={post.media_url as string}
                alt={post.title?.trim() || ''}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}

            {video && (
              <span
                className="absolute top-1.5 right-1.5 text-white drop-shadow flex items-center"
                aria-hidden="true"
              >
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  play_arrow
                </span>
              </span>
            )}

            {/* No computador, ao passar o mouse: curtidas e comentários */}
            <span className="hidden md:flex absolute inset-0 items-center justify-center gap-5 bg-black/45 text-white text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px]">favorite</span>
                {post.upvotes}
              </span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px]">chat_bubble</span>
                {post.comments_count}
              </span>
            </span>
          </Link>
        </li>
      );
    })}
  </ul>
);
