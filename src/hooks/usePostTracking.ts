import { RefObject, useEffect } from 'react';
import { trackPost } from '../lib/events';

// Registra UMA visualização por vez que a publicação fica na tela: com metade dela visível por pelo menos 1 s,
// no momento em que sai da tela (ou a aba é escondida), com o tempo que ficou. Uma linha só no banco por visualização.
export function usePostTracking(ref: RefObject<HTMLElement | null>, postId: number, enabled: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el || typeof IntersectionObserver === 'undefined') return;
    let visibleSince: number | null = null;

    const stop = () => {
      if (visibleSince === null) return;
      const ms = Date.now() - visibleSince;
      visibleSince = null;
      if (ms >= 1000) trackPost({ post_id: postId, type: 'view', value: ms });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5);
        if (visible && visibleSince === null) visibleSince = Date.now();
        else if (!visible) stop();
      },
      { threshold: [0, 0.5] }
    );
    observer.observe(el);

    const onHidden = () => {
      if (document.visibilityState === 'hidden') stop();
    };
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      observer.disconnect();
      stop();
    };
  }, [ref, postId, enabled]);
}
