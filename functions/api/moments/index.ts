import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, rateLimit, sanitizeMediaUrl, serverError } from "../../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

const MOMENT_HOURS = 24;

interface MomentRow {
  id: number;
  user_id: number;
  username: string;
  avatar_url: string | null;
  media_url: string | null;
  media_type: string;
  text: string | null;
  bg: string | null;
  overlay: string | null;
  created_at: string;
  expires_at: string;
  viewed: number;
  views_count: number;
}

// GET /api/moments: Momentum ativos meus e dos meus amigos, agrupados por pessoa
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const { results } = await env.DB.prepare(
      `SELECT m.id, m.user_id, u.username, u.avatar_url, m.media_url, m.media_type, m.text, m.bg, m.overlay,
              strftime('%Y-%m-%dT%H:%M:%SZ', m.created_at) AS created_at,
              strftime('%Y-%m-%dT%H:%M:%SZ', m.expires_at) AS expires_at,
              EXISTS(SELECT 1 FROM moment_views v WHERE v.moment_id = m.id AND v.viewer_id = ?1) AS viewed,
              CASE WHEN m.user_id = ?1 THEN (SELECT COUNT(1) FROM moment_views v WHERE v.moment_id = m.id) ELSE 0 END AS views_count
       FROM moments m
       JOIN users u ON u.id = m.user_id
       WHERE m.expires_at > CURRENT_TIMESTAMP
         AND (m.user_id = ?1 OR EXISTS (
           SELECT 1 FROM friendships f
           WHERE f.status = 'accepted'
             AND ((f.user_id = ?1 AND f.friend_id = m.user_id) OR (f.user_id = m.user_id AND f.friend_id = ?1))
         ))
         AND NOT EXISTS (
           SELECT 1 FROM blocks b
           WHERE (b.blocker_id = ?1 AND b.blocked_id = m.user_id) OR (b.blocker_id = m.user_id AND b.blocked_id = ?1)
         )
       ORDER BY m.created_at ASC`
    )
      .bind(user.id)
      .all<MomentRow>();

    const groups = new Map<
      number,
      { user_id: number; username: string; avatar_url: string | null; items: unknown[]; all_viewed: boolean; latest_at: string }
    >();
    for (const row of results || []) {
      let group = groups.get(row.user_id);
      if (!group) {
        group = { user_id: row.user_id, username: row.username, avatar_url: row.avatar_url, items: [], all_viewed: true, latest_at: row.created_at };
        groups.set(row.user_id, group);
      }
      group.items.push({
        id: row.id,
        media_url: row.media_url,
        media_type: row.media_type,
        text: row.text,
        bg: row.bg,
        overlay: row.overlay,
        created_at: row.created_at,
        expires_at: row.expires_at,
        viewed: !!row.viewed,
        views_count: row.views_count,
      });
      if (!row.viewed && row.user_id !== user.id) group.all_viewed = false;
      group.latest_at = row.created_at;
    }

    // Meu grupo primeiro; depois quem tem Momentum novo; por fim os já vistos, do mais recente ao mais antigo
    const list = [...groups.values()].sort((a, b) => {
      if (a.user_id === user.id) return -1;
      if (b.user_id === user.id) return 1;
      if (a.all_viewed !== b.all_viewed) return a.all_viewed ? 1 : -1;
      return b.latest_at.localeCompare(a.latest_at);
    });
    return jsonResponse(list);
  } catch (err: unknown) {
    return serverError(err, "moments:list");
  }
};

// POST /api/moments: publica um Momentum (foto, vídeo ou texto)
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const limited = await rateLimit(env.DB, request, "moments", 30, 3600, user.id);
    if (limited) return limited;

    let body: { media_url?: string; media_type?: string; text?: string; bg?: string; overlay?: unknown };
    try {
      body = await request.json();
    } catch {
      return errorResponse("Corpo da requisição inválido.", 400);
    }

    const mediaType = body.media_type === "image" || body.media_type === "video" ? body.media_type : "text";
    const mediaUrl = sanitizeMediaUrl(body.media_url);
    if (mediaType !== "text" && !mediaUrl) return errorResponse("Mídia inválida.", 400);

    const text = typeof body.text === "string" ? body.text.trim().slice(0, 280) : "";
    if (mediaType === "text" && !text) return errorResponse("Escreva algo para o seu Momentum.", 400);

    const bg = typeof body.bg === "string" && /^#[0-9a-fA-F]{6}$/.test(body.bg) ? body.bg : null;

    let overlay: string | null = null;
    if (body.overlay != null) {
      overlay = typeof body.overlay === "string" ? body.overlay : JSON.stringify(body.overlay);
      if (overlay.length > 8000) return errorResponse("Edição grande demais.", 400);
      try {
        JSON.parse(overlay);
      } catch {
        return errorResponse("Edição inválida.", 400);
      }
    }

    const result = await env.DB.prepare(
      `INSERT INTO moments (user_id, media_url, media_type, text, bg, overlay, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+${MOMENT_HOURS} hours'))`
    )
      .bind(user.id, mediaType === "text" ? null : mediaUrl, mediaType, text || null, bg, overlay)
      .run();

    return jsonResponse({ id: result.meta.last_row_id }, 201);
  } catch (err: unknown) {
    return serverError(err, "moments:create");
  }
};
