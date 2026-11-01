import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, serverError } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

const PAGE = 30;
const iso = (col: string) => `strftime('%Y-%m-%dT%H:%M:%SZ', ${col})`;

// GET /api/activity: tudo que eu fiz no Espectro, só para mim.
//   (sem parâmetros)   comentários e votos recentes (formato antigo)
//   ?view=summary      contadores do painel "Sua atividade"
//   ?view=votes        publicações em que votei (?before=rowid)
//   ?view=comments     meus comentários (?before=id)
//   ?view=archived     meus Momentum que já expiraram (?before=id)
//   ?view=reads        resumo do histórico de leitura (publicações vistas)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const url = new URL(request.url);
    const view = url.searchParams.get("view");
    const beforeRaw = Number(url.searchParams.get("before"));
    const before = Number.isInteger(beforeRaw) && beforeRaw > 0 ? beforeRaw : null;

    if (view === "summary") {
      const row = await env.DB.prepare(
        `SELECT
           (SELECT COUNT(1) FROM post_votes WHERE user_id = ?1) AS votes,
           (SELECT COUNT(1) FROM comments WHERE author_id = ?1) AS comments,
           (SELECT COUNT(1) FROM saved_posts WHERE user_id = ?1) AS saved,
           (SELECT COUNT(1) FROM posts WHERE author_id = ?1) AS posts,
           (SELECT COUNT(1) FROM moments WHERE user_id = ?1 AND expires_at <= CURRENT_TIMESTAMP) AS archived,
           (SELECT COUNT(1) FROM moments WHERE user_id = ?1 AND expires_at > CURRENT_TIMESTAMP) AS moments_active,
           (SELECT COUNT(1) FROM follows WHERE follower_id = ?1) AS following,
           (SELECT COUNT(1) FROM follows WHERE following_id = ?1) AS followers,
           (SELECT COUNT(1) FROM friendships WHERE status = 'accepted' AND (user_id = ?1 OR friend_id = ?1)) AS friends,
           (SELECT COUNT(1) FROM close_friends WHERE user_id = ?1) AS close_friends,
           (SELECT COUNT(1) FROM blocks WHERE blocker_id = ?1) AS blocked,
           (SELECT COUNT(1) FROM community_members WHERE user_id = ?1 AND status = 'active') AS communities,
           (SELECT COUNT(1) FROM post_events WHERE user_id = ?1 AND type = 'view' AND created_at >= datetime('now', '-30 days')) AS reads_30d,
           (SELECT personalization FROM users WHERE id = ?1) AS personalization`
      )
        .bind(user.id)
        .first<Record<string, number>>();
      return jsonResponse({ ...row, personalization: Boolean(row?.personalization ?? 1) });
    }

    if (view === "votes") {
      const { results } = await env.DB.prepare(
        `SELECT v.rowid AS cursor, v.post_id, v.vote, ${iso("v.created_at")} AS voted_at,
                p.title AS post_title, p.content AS post_content, u.username AS author_name
         FROM post_votes v JOIN posts p ON p.id = v.post_id JOIN users u ON u.id = p.author_id
         WHERE v.user_id = ?1 AND (?2 IS NULL OR v.rowid < ?2)
         ORDER BY v.rowid DESC LIMIT ${PAGE}`
      )
        .bind(user.id, before)
        .all();
      return jsonResponse({ items: results || [], has_more: (results || []).length === PAGE });
    }

    if (view === "comments") {
      const { results } = await env.DB.prepare(
        `SELECT c.id, c.post_id, c.content, ${iso("c.created_at")} AS created_at, p.title AS post_title, p.content AS post_content
         FROM comments c JOIN posts p ON p.id = c.post_id
         WHERE c.author_id = ?1 AND (?2 IS NULL OR c.id < ?2)
         ORDER BY c.id DESC LIMIT ${PAGE}`
      )
        .bind(user.id, before)
        .all();
      return jsonResponse({ items: results || [], has_more: (results || []).length === PAGE });
    }

    if (view === "archived") {
      const { results } = await env.DB.prepare(
        `SELECT m.id, m.media_url, m.media_type, m.text, m.bg, m.audience, ${iso("m.created_at")} AS created_at,
                (SELECT COUNT(1) FROM moment_views v WHERE v.moment_id = m.id) AS views_count
         FROM moments m
         WHERE m.user_id = ?1 AND m.expires_at <= CURRENT_TIMESTAMP AND (?2 IS NULL OR m.id < ?2)
         ORDER BY m.id DESC LIMIT ${PAGE}`
      )
        .bind(user.id, before)
        .all();
      return jsonResponse({ items: results || [], has_more: (results || []).length === PAGE });
    }

    if (view === "reads") {
      const row = await env.DB.prepare(
        `SELECT
           (SELECT COUNT(1) FROM post_events WHERE user_id = ?1 AND type = 'view' AND created_at >= datetime('now', '-7 days')) AS views_7d,
           (SELECT COUNT(1) FROM post_events WHERE user_id = ?1 AND type = 'view' AND created_at >= datetime('now', '-30 days')) AS views_30d,
           (SELECT COUNT(1) FROM post_events WHERE user_id = ?1 AND type = 'open') AS opens,
           (SELECT COUNT(1) FROM post_events WHERE user_id = ?1) AS events,
           (SELECT COALESCE(SUM(value), 0) FROM post_events WHERE user_id = ?1 AND type = 'view' AND created_at >= datetime('now', '-7 days')) AS ms_7d,
           (SELECT personalization FROM users WHERE id = ?1) AS personalization`
      )
        .bind(user.id)
        .first<Record<string, number>>();
      return jsonResponse({ ...row, personalization: Boolean(row?.personalization ?? 1) });
    }

    // Formato antigo (aba "Atividade" do perfil)
    const [comments, votes] = await Promise.all([
      env.DB.prepare(
        `SELECT c.id, c.post_id, c.content, ${iso("c.created_at")} AS created_at,
                p.title AS post_title, p.content AS post_content
         FROM comments c JOIN posts p ON p.id = c.post_id
         WHERE c.author_id = ? ORDER BY c.id DESC LIMIT 50`
      )
        .bind(user.id)
        .all(),
      env.DB.prepare(
        `SELECT v.post_id, v.vote, p.title AS post_title, p.content AS post_content
         FROM post_votes v JOIN posts p ON p.id = v.post_id
         WHERE v.user_id = ? ORDER BY v.rowid DESC LIMIT 50`
      )
        .bind(user.id)
        .all(),
    ]);

    return jsonResponse({ comments: comments.results || [], votes: votes.results || [] });
  } catch (err: unknown) {
    return serverError(err, "activity");
  }
};

// DELETE /api/activity?what=reads: apaga o meu histórico de leitura (sem desligar a personalização)
export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);
    if (new URL(request.url).searchParams.get("what") !== "reads") return errorResponse("Informe what=reads.", 400);
    const res = await env.DB.prepare("DELETE FROM post_events WHERE user_id = ?").bind(user.id).run();
    return jsonResponse({ deleted: res.meta.changes ?? 0 });
  } catch (err: unknown) {
    return serverError(err, "activity");
  }
};
