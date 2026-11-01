import { errorResponse, jsonResponse, rateLimit, serverError } from "../../../_shared/auth";
import { GoogleEnv, googleEnabled, profileFromClaims, sha256Hex, verifyGoogleSignature } from "../../../_shared/google";
import { createPendingLink, finishGoogleLogin, resolveGoogleAccount } from "../../../_shared/googleAccount";
import { MfaEnv } from "../../../_shared/mfa";

export interface Env extends GoogleEnv, MfaEnv {
  JWT_SECRET: string;
}

const invalid = () => errorResponse("Não foi possível validar o login com o Google.", 401);

// POST /api/auth/google/onetap { credential }
// A credencial vem do navegador, então tudo é conferido aqui: assinatura com as chaves públicas do Google,
// emissor, público, validade e o nonce de uso único emitido por este servidor. Só depois disso existe sessão.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!googleEnabled(env)) return errorResponse("Entrar com o Google ainda não está disponível.", 503);

    const limited = await rateLimit(env.DB, request, "onetap", 20, 600);
    if (limited) return limited;

    const body: any = await request.json().catch(() => null);
    const credential = body?.credential;
    if (typeof credential !== "string" || credential.length < 100 || credential.length > 4096) return invalid();

    const claims = await verifyGoogleSignature(env, credential);
    if (!claims) return invalid();

    // Nonce: precisa existir, ser nosso e ainda não ter sido usado (a leitura já o consome)
    if (typeof claims.nonce !== "string") return invalid();
    const issued = await env.DB.prepare("DELETE FROM oauth_states WHERE state_hash = ? AND mode = 'onetap' AND expires_at > CURRENT_TIMESTAMP RETURNING 1 AS ok")
      .bind(await sha256Hex(claims.nonce))
      .first();
    if (!issued) return invalid();

    const profile = profileFromClaims(env, claims, claims.nonce);
    if (!profile || !profile.emailVerified) return invalid();

    const account = await resolveGoogleAccount(env.DB, profile);

    // Já existe conta com este e-mail e sem vínculo com este Google: exige entrar na conta antes de ligar
    if (account.kind === "email_in_use") {
      return jsonResponse({ link_required: true, link_token: await createPendingLink(env.DB, profile), email: profile.email });
    }

    return finishGoogleLogin(env, request, account.userId);
  } catch (err: unknown) {
    return serverError(err, "google:onetap");
  }
};
