import { useEffect, useState } from 'react';
import { directMessagesApi } from '../lib/api';

const UNREAD_EVENT = 'espectro:unread-changed';

// Avisa os badges de navegação que o total de não lidas mudou (ex.: conversa aberta, mensagem recebida)
export function notifyUnreadChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(UNREAD_EVENT));
}

// Total de mensagens diretas não lidas: atualiza ao montar, a cada 30s, ao voltar para a aba e sob demanda
export function useUnreadDms(userId?: number | null): number {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!userId) {
      setUnread(0);
      return;
    }

    let cancelled = false;
    const refresh = () => {
      directMessagesApi
        .getUnreadCount()
        .then((res) => {
          if (!cancelled) setUnread(res.unread_count || 0);
        })
        .catch(() => {});
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener(UNREAD_EVENT, refresh);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener(UNREAD_EVENT, refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId]);

  return unread;
}
