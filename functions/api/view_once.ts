import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, serverError } from "../_shared/auth";
import { membership } from "../_shared/groups";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// POST { kind: 'dm' | 'group', message_id }: abre uma foto/vídeo de visualização única.
// Entrega o endereço da mídia uma única vez por pessoa; quem enviou nunca abre a própria.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);
    const body = (await request.json().catch(() => null)) as { kind?: string; message_id?: number } | null;
    const messageId = Number(body?.message_id);
    if (!Number.isInteger(messageId) || messageId <= 0 || (body?.kind !== "dm" && body?.kind !== "group")) {
      return errorResponse("Pedido inválido.", 400);
    }

    let row: { media_url: string | null; sender_id: number | null } | null = null;
    if (body.kind === "dm") {
      row = await env.DB.prepare(
        `SELECT media_url, sender_id FROM direct_messages
         WHERE id = ? AND view_once = 1 AND receiver_id = ? AND (expires_at IS NULL OR expires_at > datetime('now'))`
      )
        .bind(messageId, user.id)
        .first();
    } else {
      const msg = await env.DB.prepare(
        `SELECT group_id, media_url, sender_id FROM chat_group_messages
         WHERE id = ? AND view_once = 1 AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at > datetime('now'))`
      )
        .bind(messageId)
        .first<{ group_id: number; media_url: string | null; sender_id: number | null }>();
      if (msg && msg.sender_id !== user.id && (await membership(env.DB, msg.group_id, user.id))) row = msg;
    }
    if (!row || !row.media_url) return errorResponse("Mídia não disponível.", 404);

    const claim = await env.DB.prepare("INSERT OR IGNORE INTO view_once_views (kind, message_id, user_id) VALUES (?, ?, ?)")
      .bind(body.kind, messageId, user.id)
      .run();
    if (!claim.meta.changes) return errorResponse("Essa mídia já foi aberta.", 410);

    return jsonResponse({ media_url: row.media_url });
  } catch (err: unknown) {
    return serverError(err, "view_once");
  }
};
