import { usePulseBadge } from '../lib/pulse';

const CHANGED_EVENT = 'espectro:notifications-changed';

// Avisa os selos de navegação que notificações ou pedidos de amizade mudaram
export function notifyNotificationsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGED_EVENT));
}

// Selo do sino: notificações não lidas + pedidos de amizade pendentes (vem do pulso único do app)
export function useNotificationCount(userId?: number | null): number {
  return usePulseBadge(userId);
}
