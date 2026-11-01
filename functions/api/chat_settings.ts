import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, areFriends, serverError } from "../_shared/auth";
import { DISAPPEAR_OPTIONS, userPair } from "../_shared/chat";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// GET ?friend_id=: prazo das mensagens temporárias da conversa privada (0 = desligado)
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);
    const friendId = Number(new URL(request.url).searchParams.get("friend_id"));
    if (!Number.isInteger(friendId) || friendId <= 0) return errorResponse("friend_id é obrigatório.", 400);
    const [lo, hi] = userPair(user.id, friendId);
    const row = await env.DB.prepare("SELECT seconds FROM dm_disappearing WHERE user_lo = ? AND user_hi = ?")
      .bind(lo, hi)
      .first<{ seconds: number }>();
    return jsonResponse({ disappear_seconds: Number(row?.seconds || 0) });
  } catch (err: unknown) {
    return serverError(err, "chat_settings");
  }
};

// PUT { friend_id, disappear_seconds }: liga ou desliga as mensagens temporárias (vale para os dois)
export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);
    const body = (await request.json().catch(() => null)) as { friend_id?: number; disappear_seconds?: number } | null;
    const friendId = Number(body?.friend_id);
    const seconds = Number(body?.disappear_seconds);
    if (!Number.isInteger(friendId) || friendId <= 0) return errorResponse("friend_id é obrigatório.", 400);
    if (!DISAPPEAR_OPTIONS.includes(seconds)) return errorResponse("Prazo inválido.", 400);
    if (!(await areFriends(env.DB, user.id, friendId))) return errorResponse("Conversa não encontrada.", 404);
    const [lo, hi] = userPair(user.id, friendId);
    await env.DB.prepare(
      `INSERT INTO dm_disappearing (user_lo, user_hi, seconds) VALUES (?, ?, ?)
       ON CONFLICT(user_lo, user_hi) DO UPDATE SET seconds = excluded.seconds`
    )
      .bind(lo, hi, seconds)
      .run();
    return jsonResponse({ disappear_seconds: seconds });
  } catch (err: unknown) {
    return serverError(err, "chat_settings");
  }
};
