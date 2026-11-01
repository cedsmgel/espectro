// Ponte entre as Functions (D1 é a fonte da verdade) e o Durable Object (relay em tempo real)

export interface ChatEnv {
  CHAT_ROOMS?: DurableObjectNamespace;
}

export interface DirectMessageRow {
  id: number;
  sender_id: number;
  receiver_id: number;
  sender_username: string;
  content: string;
  message_type: string;
  media_url: string | null;
  reply_to_id: number | null;
  edited_at?: string | null;
  client_id: string | null;
  reactions?: Array<{ user_id: number; emoji: string }>;
  status: "sent" | "delivered" | "read";
  created_at: string;
}

// Colunas padrão (created_at sempre em ISO 8601 UTC, status derivado de delivered_at/read_at)
export const MESSAGE_COLUMNS = `
  dm.id,
  dm.sender_id,
  dm.receiver_id,
  u.username AS sender_username,
  dm.content,
  COALESCE(dm.message_type, 'text') AS message_type,
  dm.media_url,
  dm.reply_to_id,
  dm.client_id,
  CASE WHEN dm.read_at IS NOT NULL THEN 'read' WHEN dm.delivered_at IS NOT NULL THEN 'delivered' ELSE 'sent' END AS status,
  strftime('%Y-%m-%dT%H:%M:%SZ', dm.created_at) AS created_at,
  strftime('%Y-%m-%dT%H:%M:%SZ', dm.edited_at) AS edited_at
`;

// Prazo para editar uma mensagem depois de enviada (15 minutos)
export const EDIT_WINDOW_SECONDS = 15 * 60;

export const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

// Anexa as reações (no máximo uma por participante) às mensagens
export async function attachReactions<T extends { id: number; reactions?: Array<{ user_id: number; emoji: string }> }>(
  db: D1Database,
  messages: T[]
): Promise<T[]> {
  if (messages.length === 0) return messages;
  const ids = messages.map((m) => m.id);
  const placeholders = ids.map(() => "?").join(",");
  const { results } = await db
    .prepare(`SELECT message_id, user_id, emoji FROM message_reactions WHERE message_id IN (${placeholders})`)
    .bind(...ids)
    .all<{ message_id: number; user_id: number; emoji: string }>();

  const byMessage = new Map<number, Array<{ user_id: number; emoji: string }>>();
  for (const row of results || []) {
    byMessage.set(row.message_id, [...(byMessage.get(row.message_id) || []), { user_id: row.user_id, emoji: row.emoji }]);
  }
  return messages.map((m) => ({ ...m, reactions: byMessage.get(m.id) || [] }));
}

export const CONVERSATION_THEMES = ["default", "violet", "rose", "amber", "emerald", "sky", "slate", "orange"];
export const CONVERSATION_WALLPAPERS = ["none", "dots", "grid", "aurora", "sunset", "ocean", "forest"];

export function conversationRoomName(a: number, b: number): string {
  const [min, max] = a < b ? [a, b] : [b, a];
  return `chat_${min}_${max}`;
}

// Envia um evento para quem está conectado na sala. Nunca lança: o envio já está salvo no D1.
// `deliveredTo` informa para qual usuário a entrega deve ser verificada.
export async function notifyRoom(
  env: ChatEnv,
  a: number,
  b: number,
  event: Record<string, unknown>,
  deliveredTo?: number
): Promise<{ delivered: boolean }> {
  try {
    if (!env.CHAT_ROOMS) return { delivered: false };
    const stub = env.CHAT_ROOMS.get(env.CHAT_ROOMS.idFromName(conversationRoomName(a, b)));
    const res = await stub.fetch("https://chatroom.internal/broadcast", {
      method: "POST",
      headers: { "X-Internal-Broadcast": "1", "Content-Type": "application/json" },
      body: JSON.stringify({ event, deliveredTo: deliveredTo ?? null }),
    });
    if (!res.ok) return { delivered: false };
    const data = (await res.json()) as { delivered?: boolean };
    return { delivered: Boolean(data.delivered) };
  } catch (err) {
    console.error("notifyRoom falhou:", err);
    return { delivered: false };
  }
}

export function groupRoomName(groupId: number): string {
  return `group_${groupId}`;
}

// Envia um evento a quem está com o grupo aberto. Nunca lança: a mensagem já está salva no D1.
export async function notifyGroup(env: ChatEnv, groupId: number, event: Record<string, unknown>): Promise<void> {
  try {
    if (!env.CHAT_ROOMS) return;
    const stub = env.CHAT_ROOMS.get(env.CHAT_ROOMS.idFromName(groupRoomName(groupId)));
    await stub.fetch("https://chatroom.internal/broadcast", {
      method: "POST",
      headers: { "X-Internal-Broadcast": "1", "Content-Type": "application/json" },
      body: JSON.stringify({ event }),
    });
  } catch (err) {
    console.error("notifyGroup falhou:", err);
  }
}

// Fecha as conexões abertas de quem saiu ou foi removido, para parar de receber o grupo
export async function kickFromGroup(env: ChatEnv, groupId: number, userId: number): Promise<void> {
  try {
    if (!env.CHAT_ROOMS) return;
    const stub = env.CHAT_ROOMS.get(env.CHAT_ROOMS.idFromName(groupRoomName(groupId)));
    await stub.fetch("https://chatroom.internal/broadcast", {
      method: "POST",
      headers: { "X-Internal-Broadcast": "1", "Content-Type": "application/json" },
      body: JSON.stringify({ kick: userId }),
    });
  } catch (err) {
    console.error("kickFromGroup falhou:", err);
  }
}
