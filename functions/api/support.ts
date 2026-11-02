import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, rateLimit, serverError } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

const TOPICS = ["duvida", "problema", "dados", "direitos_autorais", "outro"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST { topic, message, contact_email? }: mensagem para o suporte (pode ser enviada sem conta)
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const user = await getAuthUser(request, getJwtSecret(env));

    const limited = await rateLimit(env.DB, request, "support", 5, 3600, user?.id);
    if (limited) return limited;

    const body = (await request.json().catch(() => null)) as { topic?: string; message?: string; contact_email?: string } | null;
    const topic = TOPICS.includes(body?.topic || "") ? (body!.topic as string) : "outro";
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const email = typeof body?.contact_email === "string" ? body.contact_email.trim().slice(0, 200) : "";

    if (message.length < 10) return errorResponse("Conte um pouco mais para podermos ajudar (mínimo de 10 caracteres).", 400);
    if (message.length > 3000) return errorResponse("A mensagem deve ter no máximo 3000 caracteres.", 400);
    if (email && !EMAIL.test(email)) return errorResponse("O e-mail de contato parece inválido.", 400);
    // Sem conta, só dá para responder por e-mail
    if (!user && !email) return errorResponse("Informe um e-mail para recebermos sua resposta.", 400);

    await env.DB.prepare("INSERT INTO support_messages (user_id, contact_email, topic, message) VALUES (?, ?, ?, ?)")
      .bind(user?.id ?? null, email || null, topic, message)
      .run();

    return jsonResponse({ sent: true }, 201);
  } catch (err: unknown) {
    return serverError(err, "support");
  }
};
