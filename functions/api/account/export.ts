import { getAuthUser, getJwtSecret, errorResponse, rateLimit, serverError } from "../../_shared/auth";
import { MfaEnv, requireRecentMfa } from "../../_shared/mfa";

export interface Env extends MfaEnv {
  DB: D1Database;
  JWT_SECRET: string;
}

// GET /api/account/export: cópia dos meus dados em JSON (portabilidade e acesso, LGPD art. 18)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const auth = await getAuthUser(request, getJwtSecret(env));
    if (!auth) return errorResponse("Não autorizado.", 401);

    const stepUp = await requireRecentMfa(env, auth);
    if (stepUp) return stepUp;

    const limited = await rateLimit(env.DB, request, "account-export", 3, 3600, auth.id);
    if (limited) return limited;

    const id = auth.id;
    const all = async (sql: string) => {
      try {
        return (await env.DB.prepare(sql).bind(id).all()).results || [];
      } catch {
        return [];
      }
    };

    const [profile, details, posts, comments, votes, saved, friends, directMessages, groupMessages, moments, blocks] = await Promise.all([
      env.DB.prepare(
        "SELECT id, username, email, name, bio, avatar_url, cover_url, music, is_private, allow_scraps, show_last_seen, created_at FROM users WHERE id = ?"
      )
        .bind(id)
        .first(),
      all("SELECT field, value, visibility FROM user_profile_details WHERE user_id = ?1"),
      all("SELECT id, title, content, media_url, media_type, post_type, community_id, created_at FROM posts WHERE author_id = ?1 ORDER BY id"),
      all("SELECT id, post_id, content, created_at FROM comments WHERE author_id = ?1 ORDER BY id"),
      all("SELECT post_id, vote FROM post_votes WHERE user_id = ?1"),
      all("SELECT post_id, created_at FROM saved_posts WHERE user_id = ?1"),
      all(
        `SELECT u.username, f.status, f.created_at FROM friendships f
         JOIN users u ON u.id = CASE WHEN f.user_id = ?1 THEN f.friend_id ELSE f.user_id END
         WHERE f.user_id = ?1 OR f.friend_id = ?1`
      ),
      all(
        `SELECT m.id, s.username AS sender, r.username AS receiver, m.content, m.message_type, m.media_url, m.created_at
         FROM direct_messages m JOIN users s ON s.id = m.sender_id JOIN users r ON r.id = m.receiver_id
         WHERE m.sender_id = ?1 OR m.receiver_id = ?1 ORDER BY m.id`
      ),
      all("SELECT id, group_id, content, message_type, media_url, created_at FROM group_messages WHERE sender_id = ?1 ORDER BY id"),
      all("SELECT id, media_url, media_type, text, created_at, expires_at FROM moments WHERE user_id = ?1 ORDER BY id"),
      all("SELECT u.username, b.created_at FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.blocker_id = ?1"),
    ]);

    const payload = {
      exported_at: new Date().toISOString(),
      notice: "Cópia dos seus dados pessoais no Espectro. Guarde em local seguro: contém mensagens e e-mail.",
      profile,
      profile_details: details,
      posts,
      comments,
      votes,
      saved_posts: saved,
      friends,
      direct_messages: directMessages,
      group_messages: groupMessages,
      moments,
      blocked_users: blocks,
    };

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="espectro-meus-dados-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    return serverError(err, "account:export");
  }
};
