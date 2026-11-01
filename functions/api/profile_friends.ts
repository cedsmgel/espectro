import { areFriends, getAuthUser, jsonResponse, errorResponse, getJwtSecret, isBlockedBetween, serverError } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// GET /api/profile_friends?username=x[&q=busca]: amigos de uma pessoa, com marca de amigo em comum.
// Perfil privado só mostra a lista para o dono e para amigos; bloqueio esconde tudo.
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const viewer = await getAuthUser(request, getJwtSecret(env));
    const url = new URL(request.url);
    const username = url.searchParams.get("username")?.trim();
    if (!username) return errorResponse("username é obrigatório.", 400);

    const target = await env.DB.prepare("SELECT id, is_private FROM users WHERE username = ? COLLATE NOCASE")
      .bind(username)
      .first<{ id: number; is_private: number }>();
    if (!target) return errorResponse("Usuário não encontrado.", 404);

    const isSelf = viewer?.id === target.id;
    if (!isSelf) {
      if (viewer && (await isBlockedBetween(env.DB, viewer.id, target.id))) return jsonResponse({ locked: false, friends: [] });
      const friend = viewer ? await areFriends(env.DB, viewer.id, target.id) : false;
      if (target.is_private && !friend) return jsonResponse({ locked: true, friends: [] });
    }

    const viewerId = viewer?.id ?? -1;
    const q = url.searchParams.get("q")?.trim().toLowerCase();
    const like = q ? `%${q.replace(/[%_]/g, "")}%` : null;

    const { results } = await env.DB.prepare(
      `SELECT u.id, u.username, u.name, u.avatar_url,
              EXISTS(
                SELECT 1 FROM friendships v
                WHERE v.status = 'accepted'
                  AND ((v.user_id = ?2 AND v.friend_id = u.id) OR (v.user_id = u.id AND v.friend_id = ?2))
              ) AS mutual
       FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.user_id = ?1 THEN f.friend_id ELSE f.user_id END
       WHERE f.status = 'accepted' AND (f.user_id = ?1 OR f.friend_id = ?1)
         AND (?3 IS NULL OR LOWER(u.username) LIKE ?3 OR LOWER(COALESCE(u.name, '')) LIKE ?3)
         AND NOT EXISTS (
           SELECT 1 FROM blocks b
           WHERE (b.blocker_id = ?2 AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = ?2)
         )
       ORDER BY mutual DESC, u.username COLLATE NOCASE
       LIMIT 200`
    )
      .bind(target.id, viewerId, like)
      .all();

    return jsonResponse({ locked: false, friends: results || [] });
  } catch (err: unknown) {
    return serverError(err, "profile_friends");
  }
};
