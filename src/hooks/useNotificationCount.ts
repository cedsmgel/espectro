import { useEffect, useState } from 'react';
import { notificationsApi } from '../lib/api';

const CHANGED_EVENT = 'espectro:notifications-changed';

// Avisa os selos de navegação que notificações ou pedidos de amizade mudaram
export function notifyNotificationsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGED_EVENT));
}

// Selo do sino: notificações não lidas + pedidos de amizade pendentes
export function useNotificationCount(userId?: number | null): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      setCount(0);
      return;
    }

    let cancelled = false;
    const refresh = () => {
      notificationsApi
        .counts()
        .then((res) => {
          if (!cancelled) setCount(res.total_badge || 0);
        })
        .catch(() => {});
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener(CHANGED_EVENT, refresh);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener(CHANGED_EVENT, refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId]);

  return count;
}
