import { jsonResponse } from "../_shared/auth";
import { emailEnabled, EmailEnv } from "../_shared/email";
import { googleEnabled } from "../_shared/google";
import { mfaAvailable } from "../_shared/mfa";

export interface Env extends EmailEnv {
  EMAIL_DEV_LOG?: string;
  DB?: D1Database;
  TOTP_ENC_KEY?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

// GET /api/config: o que está disponível neste ambiente (a interface esconde o que ainda não funciona)
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  return jsonResponse({ email_enabled: emailEnabled(env) || env.EMAIL_DEV_LOG === "1", mfa_enabled: mfaAvailable({ DB: env.DB as D1Database, TOTP_ENC_KEY: env.TOTP_ENC_KEY }), google_enabled: googleEnabled(env) });
};
