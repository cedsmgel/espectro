import { useCallback, useState } from 'react';

export interface FeedPrefs {
  sort: 'recent' | 'top';
  show: 'all' | 'media' | 'text';
  communities: 'all' | 'hide';
  autoplay: boolean;
}

export const DEFAULT_FEED_PREFS: FeedPrefs = { sort: 'recent', show: 'all', communities: 'all', autoplay: true };

const KEY = 'espectro_feed_prefs';

// Lê as preferências guardadas neste aparelho (também usada pelo player de vídeo para o autoplay)
export function readFeedPrefs(): FeedPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || typeof raw !== 'object') return DEFAULT_FEED_PREFS;
    return {
      sort: raw.sort === 'top' ? 'top' : 'recent',
      show: raw.show === 'media' || raw.show === 'text' ? raw.show : 'all',
      communities: raw.communities === 'hide' ? 'hide' : 'all',
      autoplay: raw.autoplay !== false,
    };
  } catch {
    return DEFAULT_FEED_PREFS;
  }
}

export function useFeedPrefs() {
  const [prefs, setPrefs] = useState<FeedPrefs>(readFeedPrefs);

  const update = useCallback((patch: Partial<FeedPrefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const reset = useCallback(() => update(DEFAULT_FEED_PREFS), [update]);

  const isCustom = JSON.stringify(prefs) !== JSON.stringify(DEFAULT_FEED_PREFS);
  return { prefs, update, reset, isCustom };
}
