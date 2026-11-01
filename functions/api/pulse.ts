import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, serverError } from "../_shared/auth";
import { notificationSummary, touchPresence } from "../_shared/pulse";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  MEDIA_BUCKET?: R2Bucket;
  BUCKET?: R2Bucket;
}

// POST /api/pulse: batimento do app aberto. Marca presença e devolve os selos (mensagens, notificações, pedidos).
// Sem limite de taxa em D1: a escrita de presença já é espaçada e o resto é leitura.
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const [, counts] = await Promise.all([touchPresence(env.DB, user.id), notificationSummary(env.DB, user.id)]);

    return jsonResponse({
      unread_count: counts.unread_messages,
      notifications: counts.unread,
      pending_requests: counts.pending_requests,
      total_badge: counts.unread + counts.pending_requests,
    });
  } catch (err: unknown) {
    return serverError(err, "pulse");
  }
};
