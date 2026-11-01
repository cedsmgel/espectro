// Exclusão definitiva de contas cujo prazo de arrependimento venceu.
// Apaga conteúdo, relações e arquivos; o questionário de saída já é anônimo e fica.

export const DELETION_GRACE_DAYS = 30;

interface PurgeEnv {
  DB: D1Database;
  MEDIA_BUCKET?: R2Bucket;
  BUCKET?: R2Bucket;
}

function mediaKey(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = /^\/api\/media\/(.+)$/.exec(url);
  return match ? decodeURIComponent(match[1]) : null;
}

async function collectMediaKeys(db: D1Database, userId: number): Promise<string[]> {
  const queries = [
    "SELECT avatar_url AS u FROM users WHERE id = ?1",
    "SELECT cover_url AS u FROM users WHERE id = ?1",
    "SELECT media_url AS u FROM posts WHERE author_id = ?1",
    "SELECT media_url AS u FROM moments WHERE user_id = ?1",
    "SELECT media_url AS u FROM direct_messages WHERE sender_id = ?1",
    "SELECT media_url AS u FROM group_messages WHERE sender_id = ?1",
  ];
  const keys = new Set<string>();
  for (const sql of queries) {
    try {
      const { results } = await db.prepare(sql).bind(userId).all<{ u: string | null }>();
      for (const row of results || []) {
        const key = mediaKey(row.u);
        if (key) {
          keys.add(key);
          // Fotos têm uma miniatura ao lado (apagar chave que não existe é inofensivo)
          if (key.startsWith("images/")) keys.add(key.replace(/\.[^./]+$/, "_t.jpg"));
        }
      }
    } catch {
      // Tabela ou coluna ausente neste ambiente: segue com o resto
    }
  }
  return [...keys];
}

export async function purgeAccount(env: PurgeEnv, userId: number): Promise<void> {
  const db = env.DB;
  const keys = await collectMediaKeys(db, userId);

  // Comunidades que a pessoa criou: passa para o membro mais antigo ou apaga se ficou vazia
  const owned = await db.prepare("SELECT id FROM communities WHERE owner_id = ?").bind(userId).all<{ id: number }>();
  for (const { id } of owned.results || []) {
    const heir = await db
      .prepare("SELECT user_id FROM community_members WHERE community_id = ? AND user_id != ? ORDER BY joined_at ASC LIMIT 1")
      .bind(id, userId)
      .first<{ user_id: number }>();
    if (heir) {
      await db.prepare("UPDATE communities SET owner_id = ? WHERE id = ?").bind(heir.user_id, id).run();
    } else {
      await db.batch([
        db.prepare("DELETE FROM posts WHERE community_id = ?").bind(id),
        db.prepare("DELETE FROM community_members WHERE community_id = ?").bind(id),
        db.prepare("DELETE FROM communities WHERE id = ?").bind(id),
      ]);
    }
  }

  // Tabelas sem exclusão em cascata saem primeiro; o resto cai junto com a conta
  await db.batch([
    db.prepare("DELETE FROM community_members WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM post_events WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM follows WHERE follower_id = ?1 OR following_id = ?1").bind(userId),
    db.prepare("DELETE FROM posts WHERE author_id = ?").bind(userId),
    db.prepare("DELETE FROM users WHERE id = ?").bind(userId),
  ]);

  const bucket = env.MEDIA_BUCKET || env.BUCKET;
  if (bucket) {
    for (const key of keys) {
      try {
        await bucket.delete(key);
      } catch {}
    }
  }
}

// No máximo uma vez por hora, apaga até 5 contas vencidas. O "UPDATE ... WHERE" garante que só uma requisição rode.
export async function purgeDueAccounts(env: PurgeEnv): Promise<number> {
  const claim = await env.DB.prepare(
    "UPDATE maintenance_runs SET ran_at = CURRENT_TIMESTAMP WHERE name = 'purge_accounts' AND ran_at < datetime('now', '-1 hour')"
  ).run();
  if (!claim.meta.changes) return 0;

  // Registros de sessão (IP e localização) ficam no máximo 6 meses
  await env.DB.prepare("DELETE FROM user_sessions WHERE created_at < datetime('now', '-6 months')").run();

  const due = await env.DB.prepare(
    "SELECT id FROM users WHERE deletion_scheduled_for IS NOT NULL AND deletion_scheduled_for <= CURRENT_TIMESTAMP AND is_admin = 0 LIMIT 5"
  ).all<{ id: number }>();

  let purged = 0;
  for (const { id } of due.results || []) {
    try {
      await purgeAccount(env, id);
      purged += 1;
    } catch (err) {
      console.error("Falha ao apagar conta vencida", id, err);
    }
  }
  return purged;
}
