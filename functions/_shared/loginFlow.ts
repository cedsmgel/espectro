import { getJwtSecret, jsonResponse, signJWT } from "./auth";
import { createSession, describeLocation } from "./session";

interface LoginEnv {
  DB: D1Database;
  JWT_SECRET: string;
}

export interface LoginUser {
  id: number;
  username: string;
  deletion_requested_at: string | null;
}

// Parte final do login, igual com ou sem segundo fator: cancela exclusão pendente, registra a sessão do aparelho,
// avisa se o acesso for novo e devolve o token. `mfa` marca que o segundo fator acabou de ser verificado.
export async function completeLogin(env: LoginEnv, request: Request, user: LoginUser, options: { mfa: boolean }): Promise<Response> {
  const deletionCanceled = Boolean(user.deletion_requested_at);
  if (deletionCanceled) {
    await env.DB.prepare("UPDATE users SET deletion_requested_at = NULL, deletion_scheduled_for = NULL WHERE id = ?").bind(user.id).run();
  }

  const session = await createSession(env.DB, request, user.id);
  if (session.unfamiliar) {
    let country = session.info.country || undefined;
    try {
      if (country) country = new Intl.DisplayNames(["pt-BR"], { type: "region" }).of(country) || country;
    } catch {}
    const where = describeLocation(session.info, country);
    await env.DB.prepare("INSERT OR IGNORE INTO notifications (user_id, actor_id, type, content, dedupe_key) VALUES (?, NULL, 'security_login', ?, ?)")
      .bind(
        user.id,
        `${session.info.browser} em ${session.info.os} · ${where}. Se não foi você, troque a senha e saia de todos os dispositivos.`,
        `login:${session.sid}`
      )
      .run();
  }

  const token = await signJWT(
    { id: user.id, username: user.username, sid: session.sid, ...(options.mfa ? { mfa_at: Math.floor(Date.now() / 1000) } : {}) },
    getJwtSecret(env)
  );

  return jsonResponse({ token, deletion_canceled: deletionCanceled, user: { id: user.id, username: user.username } });
}
