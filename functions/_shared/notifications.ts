import { sendPushToUser, type PushEnv } from "./push";

export type NotificationType = "friend_accepted" | "post_comment" | "comment_reply" | "post_upvote";

interface NotifyInput {
  userId: number;
  actor: { id: number; username: string };
  type: NotificationType;
  postId?: number | null;
  commentId?: number | null;
  content?: string | null;
  dedupeKey?: string | null;
}

const COPY: Record<NotificationType, (actor: string) => { title: string; url: (i: NotifyInput) => string }> = {
  friend_accepted: (actor) => ({
    title: `@${actor} aceitou seu pedido de amizade`,
    url: () => `/perfil/${encodeURIComponent(actor)}`,
  }),
  post_comment: (actor) => ({
    title: `@${actor} comentou na sua publicação`,
    url: (i) => `/post/${i.postId}`,
  }),
  comment_reply: (actor) => ({
    title: `@${actor} respondeu ao seu comentário`,
    url: (i) => `/post/${i.postId}`,
  }),
  post_upvote: (actor) => ({
    title: `@${actor} curtiu sua publicação`,
    url: (i) => `/post/${i.postId}`,
  }),
};

// Registra a notificação na central e avisa por push. Nunca lança: é um efeito colateral da ação principal.
export async function notify(env: PushEnv, input: NotifyInput): Promise<void> {
  try {
    if (input.userId === input.actor.id) return;

    const snippet = input.content ? input.content.slice(0, 160) : null;
    const result = await env.DB.prepare(
      `INSERT OR IGNORE INTO notifications (user_id, actor_id, type, post_id, comment_id, content, dedupe_key)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        input.userId,
        input.actor.id,
        input.type,
        input.postId ?? null,
        input.commentId ?? null,
        snippet,
        input.dedupeKey ?? null
      )
      .run();

    // Já existia (mesma chave): não notifica de novo
    if (!result.meta.changes) return;

    const copy = COPY[input.type](input.actor.username);
    await sendPushToUser(env, input.userId, {
      title: copy.title,
      body: snippet || "Toque para ver",
      url: copy.url(input),
      tag: `n-${input.type}-${input.postId ?? input.actor.id}`,
    });
  } catch (err) {
    console.error("notify falhou:", err);
  }
}
