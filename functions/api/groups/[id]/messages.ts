import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, rateLimit, serverError } from "../../../_shared/auth";
import { membership } from "../../../_shared/groups";
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

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
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
      `SELECT x.id, x.content, x.message_type, x.media_url, x.sender_id, u.username AS sender_username,
         strftime('%Y-%m-%dT%H:%M:%SZ', x.created_at) AS created_at
       FROM chat_group_messages x LEFT JOIN users u ON u.id = x.sender_id
       WHERE x.group_id = ?1 AND x.created_at >= ?2 AND (?3 IS NULL OR x.id < ?3)
       ORDER BY x.id DESC LIMIT ?4`
    )
      .bind(groupId, me.joined_at, beforeId, limit + 1)
      .all<Record<string, unknown>>();

    const rows = results || [];
    const messages = rows.slice(0, limit).reverse();

    // Marca como lidas até a mensagem mais recente (só na primeira página)
    if (beforeId === null && messages.length > 0) {
      await env.DB.prepare(
        "UPDATE chat_group_members SET last_read_id = MAX(last_read_id, ?) WHERE group_id = ? AND user_id = ?"
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

    const group = await env.DB.prepare("SELECT only_admins_send FROM chat_groups WHERE id = ?")
      .bind(groupId)
      .first<{ only_admins_send: number }>();
    if (group?.only_admins_send && me.role !== "admin") {
      return errorResponse("Só os administradores podem enviar mensagens neste grupo.", 403);
    }

    const body = (await request.json().catch(() => null)) as { content?: string; message_type?: string; media_url?: string } | null;
    const messageType = MESSAGE_TYPES.includes(body?.message_type || "") ? (body!.message_type as string) : "text";
    const mediaUrl = sanitizeMediaUrl(body?.media_url);
    if (messageType !== "text" && !mediaUrl) return errorResponse("Arquivo inválido.", 400);
    if (body?.media_url && !mediaUrl) return errorResponse("URL de mídia inválida.", 400);
    let content = typeof body?.content === "string" ? body.content.trim() : "";
    if (messageType !== "text") content = content || DEFAULT_LABEL[messageType];
    if (!content && !mediaUrl) return errorResponse("A mensagem não pode ser vazia.", 400);
    if (content.length > 2000) return errorResponse("A mensagem deve ter no máximo 2000 caracteres.", 400);

    const inserted = await env.DB.prepare(
      "INSERT INTO chat_group_messages (group_id, sender_id, content, message_type, media_url) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(groupId, user.id, content, messageType, mediaUrl)
      .run();

    return jsonResponse(
      {
        message: {
          id: Number(inserted.meta.last_row_id),
          content,
          message_type: messageType,
          media_url: mediaUrl,
          sender_id: user.id,
          sender_username: user.username,
          created_at: new Date().toISOString(),
        },
      },
      201
    );
  } catch (err: unknown) {
    return serverError(err, "groups/messages");
  }
};
