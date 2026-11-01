// Prazo para editar uma mensagem depois de enviada (o servidor aplica a mesma regra)
export const EDIT_WINDOW_MS = 15 * 60 * 1000;

export function canEditMessage(createdAt: string): boolean {
  const sentAt = new Date(createdAt).getTime();
  return Number.isFinite(sentAt) && Date.now() - sentAt <= EDIT_WINDOW_MS;
}
