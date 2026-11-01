import { areFriends, getAuthUser, jsonResponse, errorResponse, getJwtSecret, isBlockedBetween, rateLimit, serverError } from "../_shared/auth";
import { normalizeField, PROFILE_FIELD_KEYS, VISIBILITIES, Visibility } from "../_shared/profileFields";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

interface DetailRow {
  field: string;
  value: string;
  visibility: Visibility;
}

// GET /api/profile_details?username=x: informações do perfil que o visitante pode ver.
// Sem username: as minhas, todas, com a visibilidade de cada uma.
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const viewer = await getAuthUser(request, getJwtSecret(env));
    const username = new URL(request.url).searchParams.get("username")?.trim();

    let targetId: number;
    let allowed: Visibility[];

    if (!username || (viewer && viewer.username.toLowerCase() === username.toLowerCase())) {
      if (!viewer) return errorResponse("Não autorizado.", 401);
      targetId = viewer.id;
      allowed = [...VISIBILITIES];
    } else {
      const target = await env.DB.prepare("SELECT id, is_private FROM users WHERE username = ? COLLATE NOCASE")
        .bind(username)
        .first<{ id: number; is_private: number }>();
      if (!target) return errorResponse("Usuário não encontrado.", 404);
      targetId = target.id;

      const friend = viewer ? await areFriends(env.DB, viewer.id, target.id) : false;
      if (viewer && (await isBlockedBetween(env.DB, viewer.id, target.id))) return jsonResponse({ details: {} });
      if (target.is_private && !friend) return jsonResponse({ details: {} });
      allowed = friend ? ["public", "friends"] : ["public"];
    }

    const { results } = await env.DB.prepare("SELECT field, value, visibility FROM user_profile_details WHERE user_id = ?")
      .bind(targetId)
      .all<DetailRow>();

    const details: Record<string, { value: string; visibility: Visibility }> = {};
    for (const row of results || []) {
      if (allowed.includes(row.visibility)) details[row.field] = { value: row.value, visibility: row.visibility };
    }
    return jsonResponse({ details });
  } catch (err: unknown) {
    return serverError(err, "profile_details:get");
  }
};

// PUT /api/profile_details: { details: { campo: { value, visibility } } }
// Valor vazio apaga o campo; campos ausentes ficam como estão.
export const onRequestPut: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const limited = await rateLimit(env.DB, request, "profile-details", 30, 3600, user.id);
    if (limited) return limited;

    const body: any = await request.json().catch(() => null);
    const incoming = body?.details;
    if (!incoming || typeof incoming !== "object") return errorResponse("Corpo da requisição inválido.", 400);

    const statements: D1PreparedStatement[] = [];
    for (const field of Object.keys(incoming)) {
      if (!PROFILE_FIELD_KEYS.includes(field)) return errorResponse("Campo desconhecido.", 400);
      const entry = incoming[field] ?? {};
      const value = normalizeField(field, entry.value);
      if (typeof value === "object") return errorResponse(value.error, 400);

      if (!value) {
        statements.push(env.DB.prepare("DELETE FROM user_profile_details WHERE user_id = ? AND field = ?").bind(user.id, field));
        continue;
      }
      const visibility: Visibility = VISIBILITIES.includes(entry.visibility) ? entry.visibility : "private";
      statements.push(
        env.DB.prepare(
          `INSERT INTO user_profile_details (user_id, field, value, visibility) VALUES (?, ?, ?, ?)
           ON CONFLICT(user_id, field) DO UPDATE SET value = excluded.value, visibility = excluded.visibility, updated_at = CURRENT_TIMESTAMP`
        ).bind(user.id, field, value, visibility)
      );
    }

    if (statements.length) await env.DB.batch(statements);
    return jsonResponse({ saved: true });
  } catch (err: unknown) {
    return serverError(err, "profile_details:put");
  }
};
