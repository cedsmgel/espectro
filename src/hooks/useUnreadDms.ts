import { usePulseUnread } from '../lib/pulse';

const UNREAD_EVENT = 'espectro:unread-changed';

// Avisa os badges de navegação que o total de não lidas mudou (ex.: conversa aberta, mensagem recebida)
export function notifyUnreadChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(UNREAD_EVENT));
}

// Total de mensagens diretas não lidas: vem do pulso único do app (a cada 60 s, ao voltar para a aba e sob demanda)
export function useUnreadDms(userId?: number | null): number {
  return usePulseUnread(userId);
}
