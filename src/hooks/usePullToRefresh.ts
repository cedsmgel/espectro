import { useEffect, useRef, useState } from 'react';

const THRESHOLD = 70;
const MAX_PULL = 120;

// Puxar para baixo no topo da página (celular) chama onRefresh
export function usePullToRefresh(onRefresh: () => Promise<void> | void, enabled = true) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef<number | null>(null);
  const pullRef = useRef(0);
  const busy = useRef(false);
  const cb = useRef(onRefresh);
  cb.current = onRefresh;

  useEffect(() => {
    if (!enabled) return;

    const onStart = (e: TouchEvent) => {
      if (busy.current || window.scrollY > 0 || e.touches.length !== 1) return;
      start.current = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (start.current === null) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0 || window.scrollY > 0) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      // resistência: quanto mais puxa, mais pesado fica
      pullRef.current = Math.min(MAX_PULL, dy * 0.5);
      setPull(pullRef.current);
    };
    const onEnd = async () => {
      if (start.current === null) return;
      start.current = null;
      if (pullRef.current >= THRESHOLD && !busy.current) {
        busy.current = true;
        setRefreshing(true);
        setPull(THRESHOLD * 0.7);
        try {
          await cb.current();
        } finally {
          busy.current = false;
          setRefreshing(false);
          pullRef.current = 0;
          setPull(0);
        }
      } else {
        pullRef.current = 0;
        setPull(0);
      }
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [enabled]);

  return { pull, refreshing, ready: pull >= THRESHOLD };
}
