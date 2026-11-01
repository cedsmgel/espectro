import { areFriends, getAuthUser, jsonResponse, errorResponse, getJwtSecret, isBlockedBetween, serverError } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// GET /api/profile_follows?username=x&type=followers|following[&q=busca]
// Quem segue a pessoa ou quem ela segue. Perfil privado só mostra a lista para o dono e para amigos; bloqueio esconde tudo.
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const viewer = await getAuthUser(request, getJwtSecret(env));
    const url = new URL(request.url);
    const username = url.searchParams.get("username")?.trim();
    const type = url.searchParams.get("type");
    if (!username) return errorResponse("username é obrigatório.", 400);
    if (type !== "followers" && type !== "following") return errorResponse("type deve ser followers ou following.", 400);

    const target = await env.DB.prepare("SELECT id, is_private FROM users WHERE username = ? COLLATE NOCASE AND deletion_requested_at IS NULL AND suspended_at IS NULL")
      .bind(username)
      .first<{ id: number; is_private: number }>();
    if (!target) return errorResponse("Usuário não encontrado.", 404);

    const isSelf = viewer?.id === target.id;
    if (!isSelf) {
      if (viewer && (await isBlockedBetween(env.DB, viewer.id, target.id))) return jsonResponse({ locked: false, users: [] });
      const friend = viewer ? await areFriends(env.DB, viewer.id, target.id) : false;
      if (target.is_private && !friend) return jsonResponse({ locked: true, users: [] });
    }

    const viewerId = viewer?.id ?? -1;
    const q = url.searchParams.get("q")?.trim().toLowerCase();
    const like = q ? `%${q.replace(/[%_]/g, "")}%` : null;
    // followers: quem tem a pessoa em "following_id"; following: quem a pessoa tem em "follower_id"
    const [self, other] = type === "followers" ? ["following_id", "follower_id"] : ["follower_id", "following_id"];

    const { results } = await env.DB.prepare(
      `SELECT u.id, u.username, u.name, u.avatar_url,
              EXISTS(SELECT 1 FROM follows v WHERE v.follower_id = ?2 AND v.following_id = u.id) AS i_follow
       FROM follows f
       JOIN users u ON u.id = f.${other}
       WHERE f.${self} = ?1
         AND u.deletion_requested_at IS NULL AND u.suspended_at IS NULL
         AND (?3 IS NULL OR LOWER(u.username) LIKE ?3 OR LOWER(COALESCE(u.name, '')) LIKE ?3)
         AND NOT EXISTS (
           SELECT 1 FROM blocks b
           WHERE (b.blocker_id = ?2 AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = ?2)
         )
       ORDER BY f.created_at DESC
       LIMIT 200`
    )
      .bind(target.id, viewerId, like)
      .all();

    return jsonResponse({ locked: false, users: (results || []).map((r: any) => ({ ...r, i_follow: Boolean(r.i_follow) })) });
  } catch (err: unknown) {
    return serverError(err, "profile_follows");
  }
};
