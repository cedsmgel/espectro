// Conta suspensa perde o acesso em toda a API, mesmo com o login ainda válido.
// O resultado fica em memória por 15 segundos para não consultar o banco a cada chamada.
const CACHE_MS = 15000;
const cache = new Map<number, { suspended: boolean; reason: string | null; validAfter: number; at: number }>();

export async function suspensionOf(db: D1Database, userId: number) {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit;

  const row = await db
    .prepare("SELECT suspended_at, suspended_reason, sessions_valid_after FROM users WHERE id = ?")
    .bind(userId)
    .first<{ suspended_at: string | null; suspended_reason: string | null; sessions_valid_after: number | null }>();
  const entry = {
    suspended: Boolean(row?.suspended_at),
    reason: row?.suspended_reason ?? null,
    validAfter: row?.sessions_valid_after ?? 0,
    at: Date.now(),
  };
  if (cache.size > 500) cache.clear();
  cache.set(userId, entry);
  return entry;
}

// Chamado ao suspender ou reativar: vale na hora neste servidor e em até 15 segundos nos demais
export function forgetSuspension(userId: number): void {
  cache.delete(userId);
}
