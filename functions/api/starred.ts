import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, serverError } from "../_shared/auth";
import { membership } from "../_shared/groups";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// GET: minhas mensagens favoritas (conversas privadas e grupos), da mais recente para a mais antiga
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const dms = await env.DB.prepare(
      `SELECT 'dm' AS kind, dm.id AS message_id, dm.content, COALESCE(dm.message_type, 'text') AS message_type,
         CASE WHEN dm.view_once = 1 THEN NULL ELSE dm.media_url END AS media_url, su.username AS sender_username,
         CASE WHEN dm.sender_id = ?1 THEN dm.receiver_id ELSE dm.sender_id END AS chat_id,
         ou.username AS chat_name, strftime('%Y-%m-%dT%H:%M:%SZ', dm.created_at) AS created_at
       FROM starred_messages s
       JOIN direct_messages dm ON dm.id = s.message_id
       JOIN users su ON su.id = dm.sender_id
       JOIN users ou ON ou.id = CASE WHEN dm.sender_id = ?1 THEN dm.receiver_id ELSE dm.sender_id END
       WHERE s.user_id = ?1 AND s.kind = 'dm' AND (dm.sender_id = ?1 OR dm.receiver_id = ?1)
         AND (dm.expires_at IS NULL OR dm.expires_at > datetime('now'))
       ORDER BY s.created_at DESC LIMIT 100`
    )
      .bind(user.id)
      .all<Record<string, unknown>>();

    const groups = await env.DB.prepare(
      `SELECT 'group' AS kind, x.id AS message_id, x.content, x.message_type,
         CASE WHEN x.view_once = 1 THEN NULL ELSE x.media_url END AS media_url, su.username AS sender_username,
         x.group_id AS chat_id, g.name AS chat_name, strftime('%Y-%m-%dT%H:%M:%SZ', x.created_at) AS created_at
       FROM starred_messages s
       JOIN chat_group_messages x ON x.id = s.message_id
       JOIN chat_groups g ON g.id = x.group_id
       JOIN chat_group_members m ON m.group_id = x.group_id AND m.user_id = ?1
       LEFT JOIN users su ON su.id = x.sender_id
       WHERE s.user_id = ?1 AND s.kind = 'group' AND x.deleted_at IS NULL
         AND (x.expires_at IS NULL OR x.expires_at > datetime('now'))
       ORDER BY s.created_at DESC LIMIT 100`
    )
      .bind(user.id)
      .all<Record<string, unknown>>();

    const items = [...(dms.results || []), ...(groups.results || [])].sort((a, b) =>
      String(b.created_at).localeCompare(String(a.created_at))
    );
    return jsonResponse(items);
  } catch (err: unknown) {
    return serverError(err, "starred");
  }
};

// PUT { kind, message_id, starred }: favorita ou desfavorita uma mensagem de uma conversa em que estou
export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);
    const body = (await request.json().catch(() => null)) as { kind?: string; message_id?: number; starred?: boolean } | null;
    const messageId = Number(body?.message_id);
    if (!Number.isInteger(messageId) || messageId <= 0 || (body?.kind !== "dm" && body?.kind !== "group")) {
      return errorResponse("Pedido inválido.", 400);
    }

    if (body.kind === "dm") {
      const row = await env.DB.prepare("SELECT 1 AS ok FROM direct_messages WHERE id = ?1 AND (sender_id = ?2 OR receiver_id = ?2)")
        .bind(messageId, user.id)
        .first();
      if (!row) return errorResponse("Mensagem não encontrada.", 404);
    } else {
      const row = await env.DB.prepare("SELECT group_id FROM chat_group_messages WHERE id = ?").bind(messageId).first<{ group_id: number }>();
      if (!row || !(await membership(env.DB, row.group_id, user.id))) return errorResponse("Mensagem não encontrada.", 404);
    }

    if (body.starred === false) {
      await env.DB.prepare("DELETE FROM starred_messages WHERE user_id = ? AND kind = ? AND message_id = ?")
        .bind(user.id, body.kind, messageId)
        .run();
    } else {
      await env.DB.prepare("INSERT OR IGNORE INTO starred_messages (user_id, kind, message_id) VALUES (?, ?, ?)")
        .bind(user.id, body.kind, messageId)
        .run();
    }
    return jsonResponse({ kind: body.kind, message_id: messageId, starred: body.starred !== false });
  } catch (err: unknown) {
    return serverError(err, "starred");
  }
};
