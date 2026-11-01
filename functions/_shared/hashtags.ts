// Hashtags: #palavra com 2 a 50 letras, números ou _, com pelo menos uma letra.
// A regra é a mesma do cliente (src/lib/hashtags.ts). Sem lookbehind, para funcionar em navegadores mais antigos.

export const MAX_HASHTAGS_PER_POST = 10;

// Prefixo: início do texto ou um caractere que não faz parte de palavra, link, entidade (&) ou outro # (evita ##tag e url#trecho)
const HASHTAG_RE = /(^|[^\p{L}\p{N}_&/#])#([\p{L}\p{N}_]{2,50})/gu;

// Forma normalizada: minúscula e sem acentos
export function normalizeTag(raw: string): string {
  return raw.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function extractHashtags(...texts: (string | null | undefined)[]): string[] {
  const found: string[] = [];
  for (const text of texts) {
    if (!text) continue;
    // Texto entre crases (código) não conta como hashtag
    const clean = text.replace(/`[^`]*`/g, " ");
    for (const match of clean.matchAll(HASHTAG_RE)) {
      const word = match[2];
      if (!/\p{L}/u.test(word)) continue; // só números não é hashtag (#2024 fica de fora)
      const tag = normalizeTag(word);
      if (!found.includes(tag)) found.push(tag);
      if (found.length >= MAX_HASHTAGS_PER_POST) return found;
    }
  }
  return found;
}

// Reescreve os vínculos da publicação com as hashtags do texto atual
export async function syncPostHashtags(db: D1Database, postId: number, ...texts: (string | null | undefined)[]): Promise<void> {
  const tags = extractHashtags(...texts);
  const statements = [db.prepare("DELETE FROM post_hashtags WHERE post_id = ?").bind(postId)];
  for (const tag of tags) {
    statements.push(db.prepare("INSERT OR IGNORE INTO hashtags (tag) VALUES (?)").bind(tag));
    statements.push(
      db.prepare("INSERT OR IGNORE INTO post_hashtags (post_id, hashtag_id) SELECT ?, id FROM hashtags WHERE tag = ?").bind(postId, tag)
    );
  }
  await db.batch(statements);
}
