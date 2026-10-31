import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, rateLimit, serverError } from "../../_shared/auth";
import { isAllowedPushEndpoint, type PushEnv } from "../../_shared/push";

export interface Env extends PushEnv {
  JWT_SECRET: string;
}

const MAX_SUBSCRIPTIONS_PER_USER = 10;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

// POST { subscription: { endpoint, keys: { p256dh, auth } }, show_preview? } -> registra este aparelho
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const limited = await rateLimit(env.DB, request, "push-subscribe", 20, 3600, user.id);
    if (limited) return limited;

    const body = (await request.json().catch(() => null)) as {
      subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      show_preview?: boolean;
    } | null;

    const endpoint = body?.subscription?.endpoint;
    const p256dh = body?.subscription?.keys?.p256dh;
    const auth = body?.subscription?.keys?.auth;

    if (!isAllowedPushEndpoint(endpoint, env)) {
      return errorResponse("Endpoint de notificação não suportado.", 400);
    }
    if (
      typeof p256dh !== "string" ||
      typeof auth !== "string" ||
      !BASE64URL.test(p256dh) ||
      !BASE64URL.test(auth) ||
      p256dh.length > 200 ||
      auth.length > 64
    ) {
      return errorResponse("Chaves da assinatura inválidas.", 400);
    }

    const showPreview = body?.show_preview === false ? 0 : 1;
    const userAgent = (request.headers.get("User-Agent") || "").slice(0, 200);

    await env.DB.prepare(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, show_preview, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
         user_id = excluded.user_id,
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         show_preview = excluded.show_preview,
         user_agent = excluded.user_agent`
    )
      .bind(user.id, endpoint, p256dh, auth, showPreview, userAgent)
      .run();

    // Mantém só os aparelhos mais recentes
    await env.DB.prepare(
      `DELETE FROM push_subscriptions WHERE user_id = ? AND id NOT IN (
         SELECT id FROM push_subscriptions WHERE user_id = ? ORDER BY id DESC LIMIT ?)`
    )
      .bind(user.id, user.id, MAX_SUBSCRIPTIONS_PER_USER)
      .run();

    return jsonResponse({ subscribed: true, show_preview: Boolean(showPreview) }, 201);
  } catch (err: unknown) {
    return serverError(err, "push/subscribe");
  }
};

// PUT { endpoint, show_preview } -> mostrar ou esconder o texto nas notificações deste aparelho
export const onRequestPut: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const body = (await request.json().catch(() => null)) as { endpoint?: string; show_preview?: boolean } | null;
    if (!body || typeof body.endpoint !== "string" || typeof body.show_preview !== "boolean") {
      return errorResponse("Dados inválidos.", 400);
    }

    await env.DB.prepare("UPDATE push_subscriptions SET show_preview = ? WHERE user_id = ? AND endpoint = ?")
      .bind(body.show_preview ? 1 : 0, user.id, body.endpoint)
      .run();

    return jsonResponse({ show_preview: body.show_preview });
  } catch (err: unknown) {
    return serverError(err, "push/subscribe");
  }
};

// DELETE { endpoint } -> remove este aparelho
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;
    if (!body || typeof body.endpoint !== "string") {
      return errorResponse("endpoint é obrigatório.", 400);
    }

    await env.DB.prepare("DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?")
      .bind(user.id, body.endpoint)
      .run();

    return jsonResponse({ subscribed: false });
  } catch (err: unknown) {
    return serverError(err, "push/subscribe");
  }
};
