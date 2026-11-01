import { RefObject, useEffect } from 'react';
import { trackPost } from '../lib/events';

// Conta a publicação como "vista" depois de 1 s com metade dela na tela, e registra por quanto tempo ficou
export function usePostTracking(ref: RefObject<HTMLElement | null>, postId: number, enabled: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el || typeof IntersectionObserver === 'undefined') return;
    let visibleSince: number | null = null;
    let impressionTimer: ReturnType<typeof setTimeout> | null = null;

    const stop = () => {
      if (impressionTimer) {
        clearTimeout(impressionTimer);
        impressionTimer = null;
      }
      if (visibleSince !== null) {
        const ms = Date.now() - visibleSince;
        visibleSince = null;
        if (ms >= 1000) trackPost({ post_id: postId, type: 'dwell', value: ms });
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5);
        if (visible && visibleSince === null) {
          visibleSince = Date.now();
          impressionTimer = setTimeout(() => trackPost({ post_id: postId, type: 'impression' }), 1000);
        } else if (!visible) {
          stop();
        }
      },
      { threshold: [0, 0.5] }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      stop();
    };
  }, [ref, postId, enabled]);
}
