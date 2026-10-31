import { buildPushPayload, type PushSubscription, type VapidKeys } from "@block65/webcrypto-web-push";

export interface PushEnv {
  DB: D1Database;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  ALLOW_LOCAL_PUSH?: string;
}

export interface PushNotification {
  title: string;
  body: string;
  url: string;
  tag: string;
}

// O endpoint vem do cliente: aceitar qualquer URL permitiria que o servidor fizesse requisições
// para onde o atacante quisesse (SSRF). Só serviços de push conhecidos, sempre em https.
const ALLOWED_PUSH_HOST_SUFFIXES = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "push.services.mozilla.com",
  "push.apple.com",
  "notify.windows.com",
];

export function isAllowedPushEndpoint(endpoint: unknown, env: Pick<PushEnv, "ALLOW_LOCAL_PUSH">): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > 1024) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (env.ALLOW_LOCAL_PUSH === "1" && url.protocol === "http:" && url.hostname === "127.0.0.1") return true;
  if (url.protocol !== "https:" || url.username || url.password) return false;
  return ALLOWED_PUSH_HOST_SUFFIXES.some((suffix) => url.hostname === suffix || url.hostname.endsWith(`.${suffix}`));
}

function vapidKeys(env: PushEnv): VapidKeys | null {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return null;
  return {
    subject: env.VAPID_SUBJECT || "mailto:contato@espectro.pages.dev",
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
}

interface SubscriptionRow {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  show_preview: number;
}

// Envia a notificação a todos os aparelhos do usuário. Nunca lança: push é um extra, não pode quebrar a ação principal.
export async function sendPushToUser(env: PushEnv, userId: number, notification: PushNotification): Promise<void> {
  try {
    const keys = vapidKeys(env);
    if (!keys) return;

    const { results } = await env.DB.prepare(
      "SELECT id, endpoint, p256dh, auth, show_preview FROM push_subscriptions WHERE user_id = ?"
    )
      .bind(userId)
      .all<SubscriptionRow>();

    await Promise.all(
      (results || []).map(async (row) => {
        try {
          // A biblioteca exige https; só em dev local (ALLOW_LOCAL_PUSH=1) o endpoint http://127.0.0.1 é reescrito
          // para montar o payload e a requisição real continua indo ao endpoint original.
          const isLocal = env.ALLOW_LOCAL_PUSH === "1" && row.endpoint.startsWith("http://127.0.0.1");
          const subscription: PushSubscription = {
            endpoint: isLocal ? row.endpoint.replace("http://", "https://") : row.endpoint,
            expirationTime: null,
            keys: { p256dh: row.p256dh, auth: row.auth },
          };
          const data = JSON.stringify({
            title: notification.title,
            body: row.show_preview ? notification.body : "Nova mensagem",
            url: notification.url,
            tag: notification.tag,
          });
          const payload = await buildPushPayload({ data, options: { ttl: 3600, urgency: "high" } }, subscription, keys);
          const res = await fetch(row.endpoint, payload);

          if (res.status === 404 || res.status === 410) {
            await env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?").bind(row.id).run();
          } else if (res.ok) {
            await env.DB.prepare("UPDATE push_subscriptions SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?")
              .bind(row.id)
              .run();
          } else {
            console.error("push recusado:", res.status, new URL(row.endpoint).hostname);
          }
        } catch (err) {
          console.error("falha ao enviar push:", err);
        }
      })
    );
  } catch (err) {
    console.error("sendPushToUser falhou:", err);
  }
}

// Texto curto para a notificação a partir do tipo da mensagem
export function previewForMessage(type: string, content: string): string {
  switch (type) {
    case "image":
      return "📷 Foto";
    case "video":
      return "🎥 Vídeo";
    case "file":
      return `📎 ${content || "Arquivo"}`.slice(0, 120);
    case "location":
      return "📍 Localização";
    case "gif":
      return "GIF";
    case "sticker":
      return "Figurinha";
    default:
      return content.length > 120 ? `${content.slice(0, 117)}...` : content;
  }
}

// Nova mensagem para alguém que não está com a conversa aberta (respeita "silenciar" e apelido)
export async function pushNewMessage(
  env: PushEnv,
  sender: { id: number; username: string },
  receiverId: number,
  message: { message_type: string; content: string }
): Promise<void> {
  try {
    const settings = await env.DB.prepare(
      "SELECT muted, nickname FROM conversation_settings WHERE user_id = ? AND friend_id = ?"
    )
      .bind(receiverId, sender.id)
      .first<{ muted: number; nickname: string | null }>();
    if (settings?.muted) return;

    await sendPushToUser(env, receiverId, {
      title: settings?.nickname || `@${sender.username}`,
      body: previewForMessage(message.message_type, message.content),
      url: `/mensagens?u=${encodeURIComponent(sender.username)}`,
      tag: `dm-${sender.id}`,
    });
  } catch (err) {
    console.error("pushNewMessage falhou:", err);
  }
}

export async function pushFriendRequest(
  env: PushEnv,
  sender: { id: number; username: string },
  receiverId: number
): Promise<void> {
  await sendPushToUser(env, receiverId, {
    title: "Novo pedido de amizade",
    body: `@${sender.username} quer ser seu amigo`,
    url: "/notificacoes?tab=amigos",
    tag: `fr-${sender.id}`,
  });
}
