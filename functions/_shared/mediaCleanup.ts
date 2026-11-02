// Limpeza de arquivos do R2 que deixaram de ser usados (mensagens apagadas ou vencidas).
// Um arquivo só sai do bucket se nenhum outro registro ainda aponta para ele (ex.: mensagem encaminhada).

interface CleanupEnv {
  DB: D1Database;
  MEDIA_BUCKET?: R2Bucket;
  BUCKET?: R2Bucket;
}

const KEY_FROM_URL = /\/api\/media\/((?:images|videos|documents|audio)\/[\w.-]+)$/;

export function mediaKeyOf(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = KEY_FROM_URL.exec(url.split("?")[0]);
  return match ? match[1] : null;
}

// Colunas que guardam endereço de mídia (tabela, coluna)
const MEDIA_COLUMNS: Array<[string, string]> = [
  ["users", "avatar_url"],
  ["users", "cover_url"],
  ["posts", "media_url"],
  ["moments", "media_url"],
  ["direct_messages", "media_url"],
  ["chat_group_messages", "media_url"],
  ["communities", "icon_url"],
  ["communities", "banner_url"],
];

async function stillReferenced(db: D1Database, key: string): Promise<boolean> {
  const suffix = `%/api/media/${key}`;
  for (const [table, column] of MEDIA_COLUMNS) {
    try {
      const row = await db
        .prepare(`SELECT 1 AS ok FROM ${table} WHERE ${column} LIKE ?1 LIMIT 1`)
        .bind(suffix)
        .first();
      if (row) return true;
    } catch {
      // Tabela ou coluna ausente neste ambiente: ignora
    }
  }
  return false;
}

// Apaga do R2 (com a miniatura ao lado) os arquivos que ninguém mais usa. Devolve quantos saíram.
export async function releaseMedia(env: CleanupEnv, urls: Array<string | null | undefined>, maxFiles = 50): Promise<number> {
  const bucket = env.MEDIA_BUCKET || env.BUCKET;
  if (!bucket) return 0;
  const keys = [...new Set(urls.map(mediaKeyOf).filter((k): k is string => Boolean(k)))].slice(0, maxFiles);
  let removed = 0;
  for (const key of keys) {
    try {
      if (await stillReferenced(env.DB, key)) continue;
      await bucket.delete(key);
      if (key.startsWith("images/") || key.startsWith("videos/")) await bucket.delete(key.replace(/\.[^./]+$/, "_t.jpg"));
      removed += 1;
    } catch (err) {
      console.error("Falha ao limpar arquivo", key, err);
    }
  }
  return removed;
}
