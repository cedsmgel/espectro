import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, serverError } from "../../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
}

// GET /api/users/settings - Retorna as configurações de conta do usuário autenticado
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const secret = getJwtSecret(env);

    const user = await getAuthUser(request, secret);
    if (!user) {
      return errorResponse("Não autenticado. Forneça um token válido.", 401);
    }

    const row = await env.DB.prepare(
      "SELECT id, username, is_private, allow_scraps, show_last_seen, personalization FROM users WHERE id = ?"
    )
      .bind(user.id)
      .first<any>();

    if (!row) {
      return errorResponse("Usuário não encontrado.", 404);
    }

    return jsonResponse({
      settings: {
        is_private: Boolean(row.is_private),
        allow_scraps: Boolean(row.allow_scraps ?? 1),
        show_last_seen: Boolean(row.show_last_seen ?? 1),
        personalization: Boolean(row.personalization ?? 1),
      },
    });
  } catch (err: any) {
    return serverError(err, "users/settings");
  }
};

// PUT /api/users/settings - Atualiza as preferências de privacidade e conta
export const onRequestPut: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const secret = getJwtSecret(env);

    // 1. Validação do JWT
    const user = await getAuthUser(request, secret);
    if (!user) {
      return errorResponse("Não autorizado. Faça login para alterar suas configurações.", 401);
    }

    // 2. Extração dos campos do corpo da requisição
    const body: any = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return errorResponse("Corpo da requisição inválido. Esperado JSON.", 400);
    }

    const isPrivateVal =
      body.is_private !== undefined ? (body.is_private ? 1 : 0) : null;
    const allowScrapsVal =
      body.allow_scraps !== undefined ? (body.allow_scraps ? 1 : 0) : null;
    const showLastSeenVal =
      body.show_last_seen !== undefined ? (body.show_last_seen ? 1 : 0) : null;

    const personalizationVal =
      body.personalization !== undefined ? (body.personalization ? 1 : 0) : null;

    if (isPrivateVal === null && allowScrapsVal === null && showLastSeenVal === null && personalizationVal === null) {
      return errorResponse("Nenhuma preferência fornecida para atualização.", 400);
    }

    // 3. Atualização no Cloudflare D1
    await env.DB.prepare(
      `UPDATE users 
       SET is_private = COALESCE(?, is_private), 
           allow_scraps = COALESCE(?, allow_scraps),
           show_last_seen = COALESCE(?, show_last_seen),
           personalization = COALESCE(?, personalization)
       WHERE id = ?`
    )
      .bind(isPrivateVal, allowScrapsVal, showLastSeenVal, personalizationVal, user.id)
      .run();

    // Quem desliga a personalização também apaga o histórico já guardado
    if (personalizationVal === 0) {
      await env.DB.prepare("DELETE FROM post_events WHERE user_id = ?").bind(user.id).run();
    }

    // 4. Busca os dados atualizados no banco
    const updated = await env.DB.prepare(
      "SELECT id, username, is_private, allow_scraps, show_last_seen, personalization FROM users WHERE id = ?"
    )
      .bind(user.id)
      .first<any>();

    return jsonResponse({
      success: true,
      message: "Configurações da conta atualizadas com sucesso!",
      settings: {
        is_private: Boolean(updated?.is_private),
        allow_scraps: Boolean(updated?.allow_scraps ?? 1),
        show_last_seen: Boolean(updated?.show_last_seen ?? 1),
        personalization: Boolean(updated?.personalization ?? 1),
      },
    });
  } catch (err: any) {
    return serverError(err, "users/settings");
  }
};

