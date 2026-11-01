import { getAuthUser, getJwtSecret, jsonResponse } from "../_shared/auth";
import { suspensionOf } from "../_shared/suspension";

interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

export const onRequest: PagesFunction<Env> = async ({ request, env, next }) => {
  if (request.headers.has("Authorization")) {
    try {
      const user = await getAuthUser(request, getJwtSecret(env));
      if (user) {
        const state = await suspensionOf(env.DB, user.id);
        // "Sair de todos os dispositivos": token emitido antes do corte (ou sem data) deixa de valer
        if (state.validAfter && (user.iat ?? 0) < state.validAfter) {
          return jsonResponse({ error: "Sessão encerrada. Entre novamente.", session_expired: true }, 401);
        }
        if (state.suspended) {
          return jsonResponse(
            { error: `Sua conta foi suspensa.${state.reason ? ` Motivo: ${state.reason}` : ""}`, suspended: true },
            403
          );
        }
      }
    } catch {
      // Se a checagem falhar, o serviço continua no ar
    }
  }
  return next();
};
