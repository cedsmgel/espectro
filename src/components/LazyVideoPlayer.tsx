import React, { Suspense, useEffect, useRef, useState } from 'react';
import { lazyNamed } from '../lib/lazy';
import type { VideoPlayerProps } from './VideoPlayer';

const VideoPlayer = lazyNamed(() => import('./VideoPlayer'), 'VideoPlayer');

const PLACEHOLDER_CLASS = 'w-full aspect-video max-h-[min(72vh,560px)] mx-auto rounded-xl bg-black';

// O código e os metadados do vídeo só são pedidos quando ele se aproxima da tela
export const LazyVideoPlayer: React.FC<VideoPlayerProps> = (props) => {
  const placeholderRef = useRef<HTMLDivElement>(null);
  const [isNear, setIsNear] = useState(typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const element = placeholderRef.current;
    if (isNear || !element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setIsNear(true);
      },
      { rootMargin: '300px 0px' }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [isNear]);

  if (!isNear) {
    return <div ref={placeholderRef} className={`${PLACEHOLDER_CLASS} ${props.className || ''}`} />;
  }

  return (
    <Suspense fallback={<div className={`${PLACEHOLDER_CLASS} ${props.className || ''}`} />}>
      <VideoPlayer {...props} />
    </Suspense>
  );
};
