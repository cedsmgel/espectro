import { useEffect, useState } from 'react';
import { authStorage, FriendPresence, presenceApi } from '../lib/api';
import { usePulseOwner } from '../lib/pulse';

// Mantém o pulso do app ligado: ele marca presença ("visto por último") e atualiza os selos
export function usePresenceHeartbeat() {
  usePulseOwner(authStorage.getUser()?.id);
}

// Status de um amigo (online agora ou visto por último); atualiza a cada 60s
export function useFriendPresence(friendId: number | null | undefined): FriendPresence | null {
  const [presence, setPresence] = useState<FriendPresence | null>(null);

  useEffect(() => {
    setPresence(null);
    if (!friendId) return;

    let cancelled = false;
    const load = () => {
      presenceApi
        .get(friendId)
        .then((res) => {
          if (!cancelled) setPresence(res);
        })
        .catch(() => {});
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };

    load();
    const timer = window.setInterval(load, 60000);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [friendId]);

  return presence;
}

// "visto por último hoje às 14:32", "ontem às 09:10" ou "em 28/10 às 18:00"
export function lastSeenLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (date.getTime() >= startOfToday) return `visto por último hoje às ${time}`;
  if (date.getTime() >= startOfToday - 86400000) return `visto por último ontem às ${time}`;
  const day = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `visto por último em ${day} às ${time}`;
}
