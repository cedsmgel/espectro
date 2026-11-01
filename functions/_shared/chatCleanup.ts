import { releaseMedia } from "./mediaCleanup";

interface CleanupEnv {
  DB: D1Database;
  MEDIA_BUCKET?: R2Bucket;
  BUCKET?: R2Bucket;
}

const BATCH = 200;

// Mensagens temporárias vencidas saem de vez do banco (até 200 por tabela a cada hora) e levam junto
// favoritas, aberturas de mídia e arquivos que ninguém mais usa.
export async function purgeExpiredMessages(env: CleanupEnv): Promise<{ messages: number; files: number }> {
  const db = env.DB;
  let messages = 0;
  const urls: Array<string | null> = [];

  for (const [table, kind] of [
    ["direct_messages", "dm"],
    ["chat_group_messages", "group"],
  ] as const) {
    const { results } = await db
      .prepare(`SELECT id, media_url FROM ${table} WHERE expires_at IS NOT NULL AND expires_at <= datetime('now') LIMIT ?`)
      .bind(BATCH)
      .all<{ id: number; media_url: string | null }>();
    const rows = results || [];
    if (rows.length === 0) continue;

    const ids = rows.map((r) => r.id);
    const marks = ids.map(() => "?").join(",");
    await db.batch([
      db.prepare(`DELETE FROM starred_messages WHERE kind = ? AND message_id IN (${marks})`).bind(kind, ...ids),
      db.prepare(`DELETE FROM view_once_views WHERE kind = ? AND message_id IN (${marks})`).bind(kind, ...ids),
      db.prepare(`DELETE FROM ${table} WHERE id IN (${marks})`).bind(...ids),
    ]);
    messages += ids.length;
    urls.push(...rows.map((r) => r.media_url));
  }

  // Só depois de apagar as linhas: o arquivo some se nada mais o referencia
  const files = await releaseMedia(env, urls);
  return { messages, files };
}
