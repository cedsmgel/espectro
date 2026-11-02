import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, isBlockedBetween, rateLimit, serverError } from "../../_shared/auth";
import { MAX_GROUP_MEMBERS } from "../../_shared/groups";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// GET: meus grupos com última mensagem e não lidas
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const { results } = await env.DB.prepare(
      `SELECT g.id, g.name, g.description, m.role, g.only_admins_send, m.pinned, m.archived,
         (SELECT COUNT(*) FROM chat_group_members x WHERE x.group_id = g.id) AS members_count,
         (SELECT COUNT(*) FROM chat_group_messages x WHERE x.group_id = g.id AND x.id > m.last_read_id AND (x.expires_at IS NULL OR x.expires_at > datetime('now'))) AS unread_count,
         lm.id AS last_message_id, CASE WHEN lm.deleted_at IS NULL THEN lm.content ELSE NULL END AS last_content, lu.username AS last_sender,
         strftime('%Y-%m-%dT%H:%M:%SZ', lm.created_at) AS last_created_at
       FROM chat_group_members m
       JOIN chat_groups g ON g.id = m.group_id
       LEFT JOIN chat_group_messages lm ON lm.id = (SELECT MAX(id) FROM chat_group_messages WHERE group_id = g.id AND (expires_at IS NULL OR expires_at > datetime('now')))
       LEFT JOIN users lu ON lu.id = lm.sender_id
       WHERE m.user_id = ?
       ORDER BY COALESCE(lm.id, 0) DESC, g.id DESC
       LIMIT 200`
    )
      .bind(user.id)
      .all<Record<string, unknown>>();

    return jsonResponse((results || []).map((row) => ({ ...row, pinned: Boolean(row.pinned), archived: Boolean(row.archived) })));
  } catch (err: unknown) {
    return serverError(err, "groups");
  }
};

// POST { name, description?, member_ids[] }: cria o grupo. Só entra quem é amigo (e não bloqueado).
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const limited = await rateLimit(env.DB, request, "group-create", 10, 3600, user.id);
    if (limited) return limited;

    const body = (await request.json().catch(() => null)) as {
      name?: string;
      description?: string;
      member_ids?: unknown;
    } | null;

    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (name.length < 2 || name.length > 50) return errorResponse("O nome do grupo deve ter de 2 a 50 caracteres.", 400);
    const description = typeof body?.description === "string" ? body.description.trim() : "";
    if (description.length > 300) return errorResponse("A descrição deve ter no máximo 300 caracteres.", 400);

    const ids = Array.isArray(body?.member_ids)
      ? [...new Set(body!.member_ids.map(Number).filter((n) => Number.isInteger(n) && n > 0 && n !== user.id))]
      : [];
    if (ids.length === 0) return errorResponse("Escolha pelo menos uma pessoa para o grupo.", 400);
    if (ids.length + 1 > MAX_GROUP_MEMBERS) return errorResponse("Grupo muito grande.", 400);

    const placeholders = ids.map(() => "?").join(",");
    const friends = await env.DB.prepare(
      `SELECT CASE WHEN user_id = ?1 THEN friend_id ELSE user_id END AS fid
       FROM friendships WHERE status = 'accepted' AND (user_id = ?1 OR friend_id = ?1)
         AND CASE WHEN user_id = ?1 THEN friend_id ELSE user_id END IN (${placeholders})`
    )
      .bind(user.id, ...ids)
      .all<{ fid: number }>();
    const friendIds: number[] = [];
    for (const row of friends.results || []) {
      if (!(await isBlockedBetween(env.DB, user.id, row.fid))) friendIds.push(row.fid);
    }
    if (friendIds.length === 0) return errorResponse("Só é possível criar grupos com seus amigos.", 400);

    const created = await env.DB.prepare(
      "INSERT INTO chat_groups (name, description, created_by) VALUES (?, ?, ?)"
    )
      .bind(name, description || null, user.id)
      .run();
    const groupId = Number(created.meta.last_row_id);

    const statements = [
      env.DB.prepare("INSERT INTO chat_group_members (group_id, user_id, role) VALUES (?, ?, 'admin')").bind(groupId, user.id),
      ...friendIds.map((id) =>
        env.DB.prepare("INSERT INTO chat_group_members (group_id, user_id, role) VALUES (?, ?, 'member')").bind(groupId, id)
      ),
      env.DB.prepare(
        "INSERT INTO chat_group_messages (group_id, sender_id, content, message_type) VALUES (?, ?, ?, 'system')"
      ).bind(groupId, user.id, `@${user.username} criou o grupo "${name}"`),
    ];
    await env.DB.batch(statements);

    return jsonResponse({ id: groupId, name, description: description || null }, 201);
  } catch (err: unknown) {
    return serverError(err, "groups");
  }
};
