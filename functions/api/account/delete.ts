import { getAuthUser, getJwtSecret, jsonResponse, errorResponse, rateLimit, serverError, verifyPassword } from "../../_shared/auth";
import { DELETION_GRACE_DAYS } from "../../_shared/accountPurge";
import { MfaEnv, requireRecentMfa } from "../../_shared/mfa";
import { forgetSuspension } from "../../_shared/suspension";

export interface Env extends MfaEnv {
  DB: D1Database;
  JWT_SECRET: string;
}

export const DELETION_REASONS = [
  "privacidade",
  "nao_uso_mais",
  "muito_tempo",
  "outra_plataforma",
  "problemas_tecnicos",
  "moderacao",
  "assedio",
  "faltam_recursos",
  "outro",
];

// POST /api/account/delete { password, reasons, details, would_return }
// Registra o questionário (anônimo), desativa a conta e agenda a exclusão definitiva.
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const auth = await getAuthUser(request, getJwtSecret(env));
    if (!auth) return errorResponse("Não autorizado.", 401);

    const stepUp = await requireRecentMfa(env, auth);
    if (stepUp) return stepUp;

    const limited = await rateLimit(env.DB, request, "account-delete", 5, 3600, auth.id);
    if (limited) return limited;

    const body: any = await request.json().catch(() => null);
    if (!body || typeof body.password !== "string") return errorResponse("Confirme sua senha.", 400);

    const reasons: string[] = Array.isArray(body.reasons)
      ? [...new Set<string>(body.reasons.filter((r: unknown): r is string => typeof r === "string" && DELETION_REASONS.includes(r)))]
      : [];
    if (reasons.length === 0) return errorResponse("Escolha pelo menos um motivo.", 400);

    const details = typeof body.details === "string" ? body.details.trim().slice(0, 1000) : "";
    const wouldReturn = ["sim", "talvez", "nao"].includes(body.would_return) ? body.would_return : null;

    const user = await env.DB.prepare(
      "SELECT password_hash, is_admin, CAST(julianday('now') - julianday(created_at) AS INTEGER) AS age_days FROM users WHERE id = ?"
    )
      .bind(auth.id)
      .first<{ password_hash: string; is_admin: number; age_days: number | null }>();
    if (!user) return errorResponse("Conta não encontrada.", 404);
    if (user.is_admin) return errorResponse("Contas de administração não podem ser excluídas por aqui.", 403);

    if (!(await verifyPassword(body.password, user.password_hash))) return errorResponse("Senha incorreta.", 403);

    await env.DB.batch([
      env.DB.prepare("INSERT INTO account_deletion_feedback (reasons, details, would_return, account_age_days) VALUES (?, ?, ?, ?)").bind(
        reasons.join(","),
        details || null,
        wouldReturn,
        user.age_days ?? null
      ),
      env.DB.prepare(
        `UPDATE users SET deletion_requested_at = CURRENT_TIMESTAMP,
                deletion_scheduled_for = datetime('now', '+${DELETION_GRACE_DAYS} days'),
                sessions_valid_after = CAST(strftime('%s', 'now') AS INTEGER)
         WHERE id = ?`
      ).bind(auth.id),
    ]);
    forgetSuspension(auth.id);

    return jsonResponse({ scheduled: true, grace_days: DELETION_GRACE_DAYS });
  } catch (err: unknown) {
    return serverError(err, "account:delete");
  }
};
