import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, rateLimit, serverError } from "../../../_shared/auth";
import { membership } from "../../../_shared/groups";
import { attachViewed, notifyGroup, notExpired, type ChatEnv } from "../../../_shared/chat";
import { sanitizeMediaUrl } from "../../../_shared/auth";

const MESSAGE_TYPES = ["text", "gif", "sticker", "image", "video", "audio", "file"];
const DEFAULT_LABEL: Record<string, string> = {
  gif: "GIF",
  sticker: "Figurinha",
  image: "Imagem",
  video: "Vídeo",
  audio: "Mensagem de voz",
  file: "Arquivo",
};

export interface Env extends ChatEnv {
  DB: D1Database;
  JWT_SECRET: string;
}

// Mensagem apagada não expõe conteúdo nem mídia, nem quando é citada em outra resposta
function publicMessage(row: Record<string, unknown>): Record<string, unknown> {
  const { deleted, reply_deleted, reply_content, content, media_url, ...rest } = row;
  return {
    ...rest,
    content: deleted ? "" : content,
    media_url: deleted ? null : media_url,
    deleted: Boolean(deleted),
    reply_content: reply_deleted ? null : reply_content ?? null,
    reply_deleted: Boolean(reply_deleted),
  };
}

// Anexa as reações (uma por pessoa) a cada mensagem da página
async function withReactions<T extends { id: number }>(db: D1Database, messages: T[]): Promise<Array<T & { reactions: Array<{ user_id: number; emoji: string }> }>> {
  if (messages.length === 0) return [];
  const { results } = await db
    .prepare(`SELECT message_id, user_id, emoji FROM group_message_reactions WHERE message_id IN (${messages.map(() => "?").join(",")})`)
    .bind(...messages.map((m) => m.id))
    .all<{ message_id: number; user_id: number; emoji: string }>();
  const byMessage = new Map<number, Array<{ user_id: number; emoji: string }>>();
  for (const r of results || []) byMessage.set(r.message_id, [...(byMessage.get(r.message_id) || []), { user_id: r.user_id, emoji: r.emoji }]);
  return messages.map((m) => ({ ...m, reactions: byMessage.get(m.id) || [] }));
}

// GET /api/groups/:id/messages?before_id=: mensagens desde a minha entrada no grupo
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env, params } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const groupId = Number(params.id);
    const me = await membership(env.DB, groupId, user.id);
    if (!me) return errorResponse("Grupo não encontrado.", 404);

    const url = new URL(request.url);
    const beforeParam = Number(url.searchParams.get("before_id"));
    const beforeId = Number.isInteger(beforeParam) && beforeParam > 0 ? beforeParam : null;
    const limit = 30;

    const { results } = await env.DB.prepare(
      `SELECT x.id, x.content, x.message_type, CASE WHEN x.view_once = 1 THEN NULL ELSE x.media_url END AS media_url,
         x.view_once, strftime('%Y-%m-%dT%H:%M:%SZ', x.expires_at) AS expires_at, x.sender_id, u.username AS sender_username,
         u.avatar_url AS sender_avatar,
         strftime('%Y-%m-%dT%H:%M:%SZ', x.created_at) AS created_at,
         x.deleted_at IS NOT NULL AS deleted, x.reply_to_id,
         strftime('%Y-%m-%dT%H:%M:%SZ', x.edited_at) AS edited_at,
         r.content AS reply_content, r.deleted_at IS NOT NULL AS reply_deleted, ru.username AS reply_sender
       FROM chat_group_messages x
       LEFT JOIN users u ON u.id = x.sender_id
       LEFT JOIN chat_group_messages r ON r.id = x.reply_to_id
       LEFT JOIN users ru ON ru.id = r.sender_id
       WHERE x.group_id = ?1 AND x.created_at >= ?2 AND (?3 IS NULL OR x.id < ?3) AND ${notExpired("x")}
       ORDER BY x.id DESC LIMIT ?4`
    )
      .bind(groupId, me.joined_at, beforeId, limit + 1)
      .all<Record<string, unknown>>();

    const rows = (results || []) as Record<string, unknown>[];
    const page = rows.slice(0, limit).reverse().map(publicMessage) as Array<Record<string, unknown> & { id: number }>;
    const messages = await withReactions(env.DB, await attachViewed(env.DB, "group", user.id, page));

    // Marca como lidas até a mensagem mais recente (só na primeira página)
    if (beforeId === null && messages.length > 0) {
      await env.DB.prepare(
        "UPDATE chat_group_members SET last_read_id = ?1 WHERE group_id = ?2 AND user_id = ?3 AND last_read_id < ?1"
      )
        .bind(Number(messages[messages.length - 1].id), groupId, user.id)
        .run();
    }

    return jsonResponse({ messages, has_more: rows.length > limit });
  } catch (err: unknown) {
    return serverError(err, "groups/messages");
  }
};

// POST /api/groups/:id/messages { content }: envia (regra: "somente admins enviam")
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env, params } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const limited = await rateLimit(env.DB, request, "group-send", 60, 60, user.id);
    if (limited) return limited;

    const groupId = Number(params.id);
    const me = await membership(env.DB, groupId, user.id);
    if (!me) return errorResponse("Grupo não encontrado.", 404);

    const group = await env.DB.prepare("SELECT only_admins_send, disappear_seconds FROM chat_groups WHERE id = ?")
      .bind(groupId)
      .first<{ only_admins_send: number; disappear_seconds: number }>();
    if (group?.only_admins_send && me.role !== "admin") {
      return errorResponse("Só os administradores podem enviar mensagens neste grupo.", 403);
    }

    const body = (await request.json().catch(() => null)) as { content?: string; message_type?: string; media_url?: string; reply_to_id?: number; view_once?: boolean } | null;
    const messageType = MESSAGE_TYPES.includes(body?.message_type || "") ? (body!.message_type as string) : "text";
    const mediaUrl = sanitizeMediaUrl(body?.media_url);
    if (messageType !== "text" && !mediaUrl) return errorResponse("Arquivo inválido.", 400);
    if (body?.media_url && !mediaUrl) return errorResponse("URL de mídia inválida.", 400);
    let content = typeof body?.content === "string" ? body.content.trim() : "";
    if (messageType !== "text") content = content || DEFAULT_LABEL[messageType];
    if (!content && !mediaUrl) return errorResponse("A mensagem não pode ser vazia.", 400);
    if (content.length > 2000) return errorResponse("A mensagem deve ter no máximo 2000 caracteres.", 400);

    const replyParam = Number(body?.reply_to_id);
    let replyToId: number | null = null;
    if (Number.isInteger(replyParam) && replyParam > 0) {
      const target = await env.DB.prepare(
        "SELECT id FROM chat_group_messages WHERE id = ? AND group_id = ? AND deleted_at IS NULL"
      )
        .bind(replyParam, groupId)
        .first();
      if (!target) return errorResponse("A mensagem respondida não existe mais.", 400);
      replyToId = replyParam;
    }

    const seconds = Number(group?.disappear_seconds || 0);
    const viewOnce = body?.view_once === true && (messageType === "image" || messageType === "video") ? 1 : 0;
    const inserted = await env.DB.prepare(
      `INSERT INTO chat_group_messages (group_id, sender_id, content, message_type, media_url, reply_to_id, view_once, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CASE WHEN ?8 > 0 THEN datetime('now', '+' || ?8 || ' seconds') ELSE NULL END)`
    )
      .bind(groupId, user.id, content, messageType, mediaUrl, replyToId, viewOnce, seconds)
      .run();

    // Dados da mensagem citada, para quem recebe em tempo real
    const quoted = replyToId
      ? await env.DB.prepare(
          `SELECT m.content, u.username FROM chat_group_messages m LEFT JOIN users u ON u.id = m.sender_id WHERE m.id = ?`
        )
          .bind(replyToId)
          .first<{ content: string; username: string | null }>()
      : null;

    const message = {
      id: Number(inserted.meta.last_row_id),
      content,
      message_type: messageType,
      media_url: viewOnce ? null : mediaUrl,
      view_once: viewOnce === 1,
      viewed: false,
      reactions: [],
      sender_id: user.id,
      sender_username: user.username,
      sender_avatar: null,
      created_at: new Date().toISOString(),
      deleted: false,
      edited_at: null,
      reply_to_id: replyToId,
      reply_content: quoted?.content ?? null,
      reply_sender: quoted?.username ?? null,
      reply_deleted: false,
    };

    await notifyGroup(env, groupId, { type: "message", message });
    return jsonResponse({ message }, 201);
  } catch (err: unknown) {
    return serverError(err, "groups/messages");
  }
};
