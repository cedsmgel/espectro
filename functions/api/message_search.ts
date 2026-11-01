import { getAuthUser, getJwtSecret, jsonResponse, errorResponse, escapeLike, rateLimit, serverError } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// GET /api/message_search?q=: procura o texto em todas as conversas privadas e grupos da pessoa logada
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const q = (new URL(request.url).searchParams.get("q") || "").trim().slice(0, 60);
    if (q.length < 2) return jsonResponse({ messages: [], groups: [] });

    const limited = await rateLimit(env.DB, request, "msg-search", 30, 60, user.id);
    if (limited) return limited;

    const pattern = `%${escapeLike(q)}%`;

    const direct = await env.DB.prepare(
      `SELECT dm.id, dm.content, dm.sender_id,
         strftime('%Y-%m-%dT%H:%M:%SZ', dm.created_at) AS created_at,
         f.id AS friend_id, f.username AS friend_username
       FROM direct_messages dm
       JOIN users f ON f.id = CASE WHEN dm.sender_id = ?1 THEN dm.receiver_id ELSE dm.sender_id END
       WHERE (dm.sender_id = ?1 OR dm.receiver_id = ?1)
         AND COALESCE(dm.message_type, 'text') = 'text'
         AND dm.content LIKE ?2 ESCAPE '\\'
       ORDER BY dm.id DESC LIMIT 20`
    )
      .bind(user.id, pattern)
      .all<Record<string, unknown>>();

    // Em grupo, só aparecem mensagens de depois da entrada da pessoa
    const groups = await env.DB.prepare(
      `SELECT x.id, x.content, x.group_id, g.name AS group_name, u.username AS sender_username,
         strftime('%Y-%m-%dT%H:%M:%SZ', x.created_at) AS created_at
       FROM chat_group_messages x
       JOIN chat_group_members m ON m.group_id = x.group_id AND m.user_id = ?1
       JOIN chat_groups g ON g.id = x.group_id
       LEFT JOIN users u ON u.id = x.sender_id
       WHERE x.message_type = 'text' AND x.deleted_at IS NULL AND x.created_at >= m.joined_at
         AND x.content LIKE ?2 ESCAPE '\\'
       ORDER BY x.id DESC LIMIT 20`
    )
      .bind(user.id, pattern)
      .all<Record<string, unknown>>();

    return jsonResponse({ messages: direct.results || [], groups: groups.results || [] });
  } catch (err: unknown) {
    return serverError(err, "message_search");
  }
};
