import { escapeLike, jsonResponse, errorResponse, serverError } from "../../_shared/auth";
import { AdminEnv, logModeration, requireAdmin, suspendUser, unsuspendUser } from "../../_shared/admin";

// GET /api/admin/users?q=: contas mais recentes ou busca por nome de usuário
export const onRequestGet: PagesFunction<AdminEnv> = async (context) => {
  try {
    const { request, env } = context;
    const admin = await requireAdmin(request, env);
    if (admin instanceof Response) return admin;

    const q = (new URL(request.url).searchParams.get("q") || "").trim().slice(0, 50);
    const pattern = q ? `%${escapeLike(q)}%` : null;

    const { results } = await env.DB.prepare(
      `SELECT u.id, u.username, u.name, u.is_admin, u.suspended_reason,
         strftime('%Y-%m-%dT%H:%M:%SZ', u.created_at) AS created_at,
         strftime('%Y-%m-%dT%H:%M:%SZ', u.suspended_at) AS suspended_at,
         (SELECT COUNT(*) FROM reports r WHERE r.reported_id = u.id) AS reports_total,
         (SELECT COUNT(*) FROM reports r WHERE r.reported_id = u.id AND r.status = 'open') AS reports_open
       FROM users u
       WHERE (?1 IS NULL OR u.username LIKE ?1 ESCAPE '\\')
       ORDER BY u.id DESC LIMIT 30`
    )
      .bind(pattern)
      .all<Record<string, unknown>>();

    return jsonResponse({
      users: (results || []).map((row) => ({ ...row, is_admin: Boolean(row.is_admin) })),
    });
  } catch (err: unknown) {
    return serverError(err, "admin/users");
  }
};

// POST { user_id, action: 'suspend' | 'unsuspend', reason? }
export const onRequestPost: PagesFunction<AdminEnv> = async (context) => {
  try {
    const { request, env } = context;
    const admin = await requireAdmin(request, env);
    if (admin instanceof Response) return admin;

    const body = (await request.json().catch(() => null)) as { user_id?: number; action?: string; reason?: string } | null;
    const userId = Number(body?.user_id);
    if (!Number.isInteger(userId) || userId <= 0) return errorResponse("Usuário inválido.", 400);
    if (userId === admin.id) return errorResponse("Você não pode alterar a sua própria conta.", 400);

    const target = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(userId).first();
    if (!target) return errorResponse("Usuário não encontrado.", 404);

    const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 200) : "";

    if (body?.action === "suspend") {
      if (!(await suspendUser(env.DB, userId, reason || "Violação das regras da comunidade"))) {
        return errorResponse("Administradores não podem ser suspensos.", 400);
      }
      await logModeration(env.DB, admin.id, "suspend", { userId, type: "user", id: userId, note: reason || null });
      return jsonResponse({ suspended: true });
    }

    if (body?.action === "unsuspend") {
      await unsuspendUser(env.DB, userId);
      await logModeration(env.DB, admin.id, "unsuspend", { userId, type: "user", id: userId, note: reason || null });
      return jsonResponse({ suspended: false });
    }

    return errorResponse("Ação inválida.", 400);
  } catch (err: unknown) {
    return serverError(err, "admin/users");
  }
};
