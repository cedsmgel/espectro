import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, rateLimit, serverError } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

export const REPORT_REASONS = ["spam", "assedio", "conteudo_improprio", "golpe", "outro"];

// POST { user_id, reason, details?, message_id? }: registra uma denúncia para moderação
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const limited = await rateLimit(env.DB, request, "report", 10, 3600, user.id);
    if (limited) return limited;

    const body = (await request.json().catch(() => null)) as {
      user_id?: number;
      reason?: string;
      details?: string;
      message_id?: number;
    } | null;

    const reportedId = Number(body?.user_id);
    if (!Number.isInteger(reportedId) || reportedId <= 0 || reportedId === user.id) {
      return errorResponse("user_id inválido.", 400);
    }
    if (!body?.reason || !REPORT_REASONS.includes(body.reason)) {
      return errorResponse("Motivo inválido.", 400);
    }

    const details = typeof body.details === "string" ? body.details.trim() : "";
    if (details.length > 500) return errorResponse("Os detalhes devem ter no máximo 500 caracteres.", 400);

    const target = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(reportedId).first();
    if (!target) return errorResponse("Usuário não encontrado.", 404);

    // A mensagem denunciada precisa ser da conversa entre os dois
    let messageId: number | null = null;
    if (body.message_id !== undefined && body.message_id !== null) {
      const id = Number(body.message_id);
      const message = Number.isInteger(id)
        ? await env.DB.prepare(
            `SELECT id FROM direct_messages
             WHERE id = ?1 AND ((sender_id = ?2 AND receiver_id = ?3) OR (sender_id = ?3 AND receiver_id = ?2))`
          )
            .bind(id, user.id, reportedId)
            .first()
        : null;
      if (!message) return errorResponse("Mensagem não encontrada nesta conversa.", 404);
      messageId = id;
    }

    // Evita denúncias repetidas idênticas em aberto
    const duplicate = await env.DB.prepare(
      `SELECT id FROM reports
       WHERE reporter_id = ? AND reported_id = ? AND reason = ? AND status = 'open'
         AND COALESCE(message_id, 0) = COALESCE(?, 0)`
    )
      .bind(user.id, reportedId, body.reason, messageId)
      .first();

    if (!duplicate) {
      await env.DB.prepare(
        "INSERT INTO reports (reporter_id, reported_id, message_id, reason, details) VALUES (?, ?, ?, ?, ?)"
      )
        .bind(user.id, reportedId, messageId, body.reason, details || null)
        .run();
    }

    return jsonResponse({ reported: true }, 201);
  } catch (err: unknown) {
    return serverError(err, "reports");
  }
};
