// Peças do "pulso": o app aberto faz uma única chamada periódica (POST /api/pulse) que marca presença
// e devolve os números dos selos. Antes eram 3 chamadas por componente de navegação.

export const ONLINE_WINDOW_SECONDS = 150; // "online agora" = pulso nos últimos 150 s (o app pulsa a cada 60 s)
const PRESENCE_WRITE_EVERY_SECONDS = 100; // grava no máximo a cada ~100 s por pessoa (menos escrita no D1)

export async function touchPresence(db: D1Database, userId: number): Promise<void> {
  await db
    .prepare(`UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ? AND (last_seen_at IS NULL OR last_seen_at < datetime('now', '-${PRESENCE_WRITE_EVERY_SECONDS} seconds'))`)
    .bind(userId)
    .run();
}

export async function notificationSummary(db: D1Database, userId: number) {
  const row = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM notifications WHERE user_id = ?1 AND read_at IS NULL) AS unread,
         (SELECT COUNT(*) FROM friendships WHERE friend_id = ?1 AND status = 'pending') AS pending_requests,
         (SELECT COUNT(*) FROM direct_messages WHERE receiver_id = ?1 AND read_at IS NULL) AS unread_messages`
    )
    .bind(userId)
    .first<{ unread: number; pending_requests: number; unread_messages: number }>();

  return {
    unread: Number(row?.unread || 0),
    pending_requests: Number(row?.pending_requests || 0),
    unread_messages: Number(row?.unread_messages || 0),
  };
}
