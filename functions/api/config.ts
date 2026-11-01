import { jsonResponse } from "../_shared/auth";
import { emailEnabled, EmailEnv } from "../_shared/email";

export interface Env extends EmailEnv {
  EMAIL_DEV_LOG?: string;
}

// GET /api/config: o que está disponível neste ambiente (a interface esconde o que ainda não funciona)
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  return jsonResponse({ email_enabled: emailEnabled(env) || env.EMAIL_DEV_LOG === "1" });
};
