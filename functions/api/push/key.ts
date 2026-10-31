import { jsonResponse, errorResponse } from "../../_shared/auth";

export interface Env {
  VAPID_PUBLIC_KEY?: string;
}

// GET: chave pública VAPID (necessária para o navegador criar a assinatura)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const key = context.env.VAPID_PUBLIC_KEY;
  if (!key) return errorResponse("Notificações push não configuradas.", 503);
  return jsonResponse({ public_key: key });
};
