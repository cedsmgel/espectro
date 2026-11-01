import { errorResponse, getAuthUser, getJwtSecret, jsonResponse, rateLimit, serverError } from "../../_shared/auth";
import { sha256Hex } from "../../_shared/google";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// POST /api/account/google-link { link_token }: conclui a ligação pedida pelo One Tap depois de a pessoa
// ter entrado na conta existente (senha e, se houver, 2FA). Quem chama já está autenticado.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const auth = await getAuthUser(request, getJwtSecret(env));
    if (!auth) return errorResponse("Não autorizado.", 401);

    const limited = await rateLimit(env.DB, request, "google-link", 10, 600, auth.id);
    if (limited) return limited;

    const body: any = await request.json().catch(() => null);
    if (typeof body?.link_token !== "string" || body.link_token.length < 20 || body.link_token.length > 100) return errorResponse("Pedido inválido.", 400);

    const pending = await env.DB.prepare("DELETE FROM oauth_states WHERE state_hash = ? AND mode = 'link_pending' AND expires_at > CURRENT_TIMESTAMP RETURNING code_verifier, nonce")
      .bind(await sha256Hex(body.link_token))
      .first<{ code_verifier: string; nonce: string }>();
    if (!pending) return errorResponse("O pedido para ligar o Google expirou. Use o botão Continuar com o Google.", 400);

    // code_verifier guarda o "sub" e nonce guarda o e-mail (ver onetap.ts)
    const taken = await env.DB.prepare("SELECT user_id FROM oauth_identities WHERE provider = 'google' AND subject = ?").bind(pending.code_verifier).first<{ user_id: number }>();
    if (taken && taken.user_id !== auth.id) return errorResponse("Essa conta do Google já está ligada a outra conta do Espectro.", 409);
    if (!taken) {
      await env.DB.prepare("INSERT INTO oauth_identities (user_id, provider, subject, email) VALUES (?, 'google', ?, ?)").bind(auth.id, pending.code_verifier, pending.nonce).run();
    }
    return jsonResponse({ linked: true });
  } catch (err: unknown) {
    return serverError(err, "account:google-link");
  }
};
