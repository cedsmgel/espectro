import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, serverError } from "../_shared/auth";
import { CONVERSATION_THEMES, CONVERSATION_WALLPAPERS } from "../_shared/chat";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

interface SettingsRow {
  muted: number;
  theme: string;
  wallpaper: string;
  nickname: string | null;
  cleared_before_id: number;
  pinned: number;
  manual_unread: number;
  archived: number;
}

const SELECT_COLUMNS = "muted, theme, wallpaper, nickname, cleared_before_id, pinned, manual_unread, archived";
const DEFAULTS: SettingsRow = {
  muted: 0,
  theme: "default",
  wallpaper: "none",
  nickname: null,
  cleared_before_id: 0,
  pinned: 0,
  manual_unread: 0,
  archived: 0,
};

function present(friendId: number, row: SettingsRow | null) {
  const s = row || DEFAULTS;
  return {
    friend_id: friendId,
    muted: Boolean(s.muted),
    theme: s.theme,
    wallpaper: s.wallpaper,
    nickname: s.nickname,
    cleared_before_id: s.cleared_before_id,
    pinned: Boolean(s.pinned),
    manual_unread: Boolean(s.manual_unread),
    archived: Boolean(s.archived),
  };
}

// GET ?friend_id=N -> preferências da conversa (padrões se nunca configurada)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const friendId = Number(new URL(request.url).searchParams.get("friend_id"));
    if (!Number.isInteger(friendId) || friendId <= 0) {
      return errorResponse("friend_id é obrigatório.", 400);
    }

    const row = await env.DB.prepare(
      `SELECT ${SELECT_COLUMNS} FROM conversation_settings WHERE user_id = ? AND friend_id = ?`
    )
      .bind(user.id, friendId)
      .first<SettingsRow>();

    return jsonResponse(present(friendId, row));
  } catch (err: unknown) {
    return serverError(err, "conversation_settings");
  }
};

// PUT { friend_id, muted?, theme?, wallpaper?, nickname?, pinned?, manual_unread?, clear? } -> atualiza só o que foi enviado
export const onRequestPut: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const body = (await request.json().catch(() => null)) as {
      friend_id?: number;
      muted?: boolean;
      theme?: string;
      wallpaper?: string;
      nickname?: string | null;
      pinned?: boolean;
      manual_unread?: boolean;
      archived?: boolean;
      clear?: boolean;
    } | null;

    const friendId = Number(body?.friend_id);
    if (!body || !Number.isInteger(friendId) || friendId <= 0 || friendId === user.id) {
      return errorResponse("friend_id inválido.", 400);
    }

    const target = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(friendId).first();
    if (!target) return errorResponse("Usuário não encontrado.", 404);

    const current =
      (await env.DB.prepare(
        `SELECT ${SELECT_COLUMNS} FROM conversation_settings WHERE user_id = ? AND friend_id = ?`
      )
        .bind(user.id, friendId)
        .first<SettingsRow>()) || { ...DEFAULTS };

    const next = { ...current };

    if (body.muted !== undefined) next.muted = body.muted ? 1 : 0;
    if (body.pinned !== undefined) next.pinned = body.pinned ? 1 : 0;
    if (body.manual_unread !== undefined) next.manual_unread = body.manual_unread ? 1 : 0;
    if (body.archived !== undefined) next.archived = body.archived ? 1 : 0;

    if (body.theme !== undefined) {
      if (!CONVERSATION_THEMES.includes(body.theme)) return errorResponse("Tema inválido.", 400);
      next.theme = body.theme;
    }

    if (body.wallpaper !== undefined) {
      if (!CONVERSATION_WALLPAPERS.includes(body.wallpaper)) return errorResponse("Papel de parede inválido.", 400);
      next.wallpaper = body.wallpaper;
    }

    if (body.nickname !== undefined) {
      const nickname = body.nickname === null ? "" : String(body.nickname).trim();
      if (nickname.length > 30) return errorResponse("O apelido deve ter no máximo 30 caracteres.", 400);
      next.nickname = nickname || null;
    }

    if (body.clear) {
      const last = await env.DB.prepare(
        `SELECT COALESCE(MAX(id), 0) AS last_id FROM direct_messages
         WHERE (sender_id = ?1 AND receiver_id = ?2) OR (sender_id = ?2 AND receiver_id = ?1)`
      )
        .bind(user.id, friendId)
        .first<{ last_id: number }>();
      next.cleared_before_id = Number(last?.last_id || 0);
      next.manual_unread = 0;

      await env.DB.prepare(
        "UPDATE direct_messages SET read_at = CURRENT_TIMESTAMP WHERE sender_id = ? AND receiver_id = ? AND read_at IS NULL"
      )
        .bind(friendId, user.id)
        .run();
    }

    await env.DB.prepare(
      `INSERT INTO conversation_settings (user_id, friend_id, muted, theme, wallpaper, nickname, cleared_before_id, pinned, manual_unread, archived, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id, friend_id) DO UPDATE SET
         muted = excluded.muted,
         theme = excluded.theme,
         wallpaper = excluded.wallpaper,
         nickname = excluded.nickname,
         cleared_before_id = excluded.cleared_before_id,
         pinned = excluded.pinned,
         manual_unread = excluded.manual_unread,
         archived = excluded.archived,
         updated_at = CURRENT_TIMESTAMP`
    )
      .bind(
        user.id,
        friendId,
        next.muted,
        next.theme,
        next.wallpaper,
        next.nickname,
        next.cleared_before_id,
        next.pinned,
        next.manual_unread,
        next.archived
      )
      .run();

    return jsonResponse(present(friendId, next));
  } catch (err: unknown) {
    return serverError(err, "conversation_settings");
  }
};
