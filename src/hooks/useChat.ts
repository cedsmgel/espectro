import { useState, useEffect, useRef, useCallback } from 'react';
import { authStorage, directMessagesApi, DirectMessage } from '../lib/api';
import { notifyUnreadChanged } from './useUnreadDms';

export type ChatMessageType =
  | 'audio'
  | 'text'
  | 'image'
  | 'video'
  | 'file'
  | 'location'
  | 'gif'
  | 'sticker';

export type MessageStatus = 'sending' | 'failed' | 'sent' | 'delivered' | 'read';

export interface ChatMessage {
  id?: number;
  client_id?: string | null;
  sender_id: number;
  sender_username?: string;
  content: string;
  message_type?: ChatMessageType;
  media_url?: string | null;
  reply_to_id?: number | null;
  reactions?: Array<{ user_id: number; emoji: string }>;
  status?: MessageStatus;
  created_at: string;
}

export interface SendMessageOptions {
  text?: string;
  type?: ChatMessageType;
  media_url?: string | null;
  reply_to_id?: number | null;
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface UseChatOptions {
  activeFriendId: number | null | undefined;
  activeFriendUsername?: string;
  onActivity?: () => void;
}

const PAGE_SIZE = 30;
const STATUS_RANK: Record<string, number> = { sending: 0, failed: 0, sent: 1, delivered: 2, read: 3 };

function newClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Junta uma mensagem recebida do servidor à lista: troca a otimista (mesmo client_id) ou atualiza a existente
function mergeMessage(list: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  const index = list.findIndex(
    (m) =>
      (incoming.id !== undefined && m.id === incoming.id) ||
      (!!incoming.client_id && m.client_id === incoming.client_id)
  );
  if (index === -1) return [...list, incoming];

  const current = list[index];
  const keepStatus =
    (STATUS_RANK[current.status || 'sent'] ?? 1) > (STATUS_RANK[incoming.status || 'sent'] ?? 1) &&
    current.status !== 'sending' &&
    current.status !== 'failed';
  const merged = { ...incoming, status: keepStatus ? current.status : incoming.status };
  const next = [...list];
  next[index] = merged;
  return next;
}

function toChatMessage(m: DirectMessage): ChatMessage {
  return {
    id: m.id,
    client_id: m.client_id,
    sender_id: m.sender_id,
    sender_username: m.sender_username,
    content: m.content,
    message_type: m.message_type,
    media_url: m.media_url,
    reply_to_id: m.reply_to_id,
    reactions: m.reactions || [],
    status: m.status,
    created_at: m.created_at,
  };
}

export function useChat({ activeFriendId, onActivity }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const isManuallyClosedRef = useRef(false);
  const activeFriendRef = useRef<number | null>(null);
  const outboxRef = useRef<Map<string, { friendId: number; draft: Omit<ChatMessage, 'status'> }>>(new Map());
  const tempIdRef = useRef(0);
  const onActivityRef = useRef(onActivity);
  onActivityRef.current = onActivity;

  const user = authStorage.getUser();
  const userId = user?.id;
  const username = user?.username || 'Usuário';
  const token = authStorage.getToken();

  const getWsUrl = useCallback((u1: number, u2: number, jwtToken?: string | null) => {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const isLocalhost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    // Em localhost aponta para o Cloudflare Pages de produção onde o DO está ativo
    const host = isLocalhost ? 'espectro.pages.dev' : window.location.host;
    const protocol = isLocalhost ? 'wss:' : isHttps ? 'wss:' : 'ws:';

    let url = `${protocol}//${host}/api/chat?user1=${u1}&user2=${u2}`;
    if (jwtToken) {
      url += `&token=${encodeURIComponent(jwtToken)}`;
    }
    return url;
  }, []);

  // Persiste a leitura no servidor (que avisa o outro lado em tempo real)
  const markAsRead = useCallback(() => {
    const friendId = activeFriendRef.current;
    if (!userId || !friendId) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    directMessagesApi
      .markRead(friendId)
      .then(() => {
        onActivityRef.current?.();
        notifyUnreadChanged();
      })
      .catch(() => {});
  }, [userId]);

  // Carrega (ou atualiza após reconexão) as mensagens mais recentes
  const syncLatest = useCallback(
    async (friendId: number, initial: boolean) => {
      try {
        const res = await directMessagesApi.list(friendId, { limit: PAGE_SIZE });
        if (activeFriendRef.current !== friendId) return;
        const fetched = res.messages.map(toChatMessage);
        setMessages((prev) => {
          let next = initial ? prev.filter((m) => m.status === 'sending' || m.status === 'failed') : prev;
          for (const m of fetched) next = mergeMessage(next, m);
          return next;
        });
        if (initial) setHasMore(res.has_more);
        if (fetched.some((m) => m.sender_id !== userId && m.status !== 'read')) markAsRead();
      } catch (err: any) {
        if (activeFriendRef.current === friendId) setError(err?.message || 'Falha ao carregar mensagens.');
      } finally {
        if (activeFriendRef.current === friendId) setLoadingHistory(false);
      }
    },
    [userId, markAsRead]
  );

  const connect = useCallback(() => {
    if (!userId || !activeFriendId || !token) {
      setConnectionStatus('idle');
      return;
    }

    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (socketRef.current) {
      isManuallyClosedRef.current = true;
      try {
        socketRef.current.close(1000, 'Trocando de sala');
      } catch {}
      socketRef.current = null;
    }

    isManuallyClosedRef.current = false;
    setConnectionStatus((prev) => (prev === 'connected' ? 'reconnecting' : 'connecting'));

    const wsUrl = getWsUrl(userId, activeFriendId, token);

    try {
      const ws = new WebSocket(wsUrl, token ? [token] : undefined);
      socketRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');
        setError(null);
        // Recupera o que chegou enquanto estávamos desconectados
        syncLatest(activeFriendId, false);

        if (pingIntervalRef.current) window.clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({ type: 'ping' }));
            } catch {}
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        // Ignora eventos de um socket que já foi substituído (troca de conversa)
        if (socketRef.current !== ws) return;
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'message' && data.message) {
            const incoming = toChatMessage(data.message as DirectMessage);
            setMessages((prev) => mergeMessage(prev, incoming));
            onActivityRef.current?.();
            notifyUnreadChanged();
            if (incoming.sender_id !== userId) {
              setIsOtherUserTyping(false);
              markAsRead();
            }
          } else if (data.type === 'read') {
            if (Number(data.reader_id) !== userId) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.sender_id === userId && m.status !== 'sending' && m.status !== 'failed'
                    ? { ...m, status: 'read' }
                    : m
                )
              );
            }
          } else if (data.type === 'reaction') {
            const messageId = Number(data.message_id);
            const reactorId = Number(data.user_id);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === messageId
                  ? {
                      ...m,
                      reactions: [
                        ...(m.reactions || []).filter((r) => r.user_id !== reactorId),
                        ...(data.emoji ? [{ user_id: reactorId, emoji: String(data.emoji) }] : []),
                      ],
                    }
                  : m
              )
            );
          } else if (data.type === 'status') {
            const messageId = Number(data.message_id);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === messageId && (STATUS_RANK[m.status || 'sent'] ?? 1) < (STATUS_RANK[data.status] ?? 1)
                  ? { ...m, status: data.status }
                  : m
              )
            );
          } else if (data.type === 'delete') {
            const deletedId = Number(data.message_id || data.messageId || data.id);
            if (deletedId) {
              setMessages((prev) => prev.filter((m) => m.id !== deletedId));
              onActivityRef.current?.();
            }
          } else if (data.type === 'typing') {
            if (data.sender_id === activeFriendId) {
              setIsOtherUserTyping(!!data.is_typing);

              if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
              if (data.is_typing) {
                typingTimeoutRef.current = window.setTimeout(() => {
                  setIsOtherUserTyping(false);
                }, 3000);
              }
            }
          } else if (data.type === 'error' && data.error) {
            setError(String(data.error));
          }
        } catch (err) {
          console.error('Erro ao processar mensagem do WebSocket:', err);
        }
      };

      ws.onerror = (err) => {
        console.warn('Alerta na conexão WebSocket do Chat:', err);
      };

      ws.onclose = () => {
        // Um socket antigo (já trocado ou fechado de propósito) não pode disparar reconexão:
        // isso fechava o socket novo e gerava um ciclo infinito de "Reconectando..."
        if (socketRef.current !== ws) return;
        socketRef.current = null;

        if (pingIntervalRef.current) {
          window.clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        if (!isManuallyClosedRef.current) {
          setConnectionStatus('reconnecting');
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect();
          }, 3000);
        } else {
          setConnectionStatus('disconnected');
        }
      };
    } catch (err: any) {
      console.error('Falha ao instanciar WebSocket:', err);
      setConnectionStatus('reconnecting');
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 3000);
    }
  }, [userId, activeFriendId, token, getWsUrl, syncLatest, markAsRead]);

  // Troca de conversa: histórico via HTTP (fonte da verdade) + tempo real via WebSocket
  useEffect(() => {
    activeFriendRef.current = activeFriendId ?? null;

    if (activeFriendId && userId) {
      setLoadingHistory(true);
      setMessages([]);
      setHasMore(false);
      setError(null);
      setIsOtherUserTyping(false);
      syncLatest(activeFriendId, true);
      connect();
    } else {
      setMessages([]);
      setHasMore(false);
      setConnectionStatus('idle');
      if (socketRef.current) {
        isManuallyClosedRef.current = true;
        try {
          socketRef.current.close(1000, 'Sem amigo ativo');
        } catch {}
        socketRef.current = null;
      }
    }

    return () => {
      isManuallyClosedRef.current = true;
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (pingIntervalRef.current) {
        window.clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (socketRef.current) {
        try {
          socketRef.current.close(1000, 'Desmontagem do hook');
        } catch {}
        socketRef.current = null;
      }
    };
  }, [activeFriendId, userId, connect, syncLatest]);

  const loadOlder = useCallback(async () => {
    const friendId = activeFriendRef.current;
    if (!friendId || loadingOlder || !hasMore) return;
    const oldest = messages.find((m) => typeof m.id === 'number' && m.id > 0);
    if (!oldest?.id) return;

    setLoadingOlder(true);
    try {
      const res = await directMessagesApi.list(friendId, { beforeId: oldest.id, limit: PAGE_SIZE });
      if (activeFriendRef.current !== friendId) return;
      const older = res.messages.map(toChatMessage);
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id));
        return [...older.filter((m) => !known.has(m.id)), ...prev];
      });
      setHasMore(res.has_more);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar mensagens anteriores.');
    } finally {
      setLoadingOlder(false);
    }
  }, [messages, hasMore, loadingOlder]);

  const reloadHistory = useCallback(() => {
    const friendId = activeFriendRef.current;
    if (!friendId) return;
    setMessages([]);
    setHasMore(false);
    setLoadingHistory(true);
    void syncLatest(friendId, true);
  }, [syncLatest]);

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!userId || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        return;
      }
      try {
        socketRef.current.send(JSON.stringify({ type: 'typing', is_typing: isTyping }));
      } catch {}
    },
    [userId]
  );

  // Envia ao servidor; em caso de falha a mensagem fica "failed" e pode ser reenviada
  const dispatchSend = useCallback(
    async (clientId: string) => {
      const entry = outboxRef.current.get(clientId);
      if (!entry) return;
      setMessages((prev) =>
        prev.map((m) => (m.client_id === clientId ? { ...m, status: 'sending' } : m))
      );
      try {
        const res = await directMessagesApi.send({
          receiver_id: entry.friendId,
          content: entry.draft.content,
          message_type: entry.draft.message_type,
          media_url: entry.draft.media_url,
          reply_to_id: entry.draft.reply_to_id,
          client_id: clientId,
        });
        outboxRef.current.delete(clientId);
        if (activeFriendRef.current === entry.friendId) {
          setMessages((prev) => mergeMessage(prev, toChatMessage(res.message)));
        }
        onActivityRef.current?.();
      } catch (err: any) {
        setError(err?.message || 'Não foi possível enviar a mensagem.');
        setMessages((prev) =>
          prev.map((m) => (m.client_id === clientId ? { ...m, status: 'failed' } : m))
        );
      }
    },
    []
  );

  const enqueue = useCallback(
    (content: string, type: ChatMessageType, mediaUrl: string | null, replyToId: number | null) => {
      const friendId = activeFriendRef.current;
      if (!userId || !friendId) return false;
      if (!content && !mediaUrl) return false;

      const clientId = newClientId();
      tempIdRef.current -= 1;
      const draft: Omit<ChatMessage, 'status'> = {
        id: tempIdRef.current,
        client_id: clientId,
        sender_id: userId,
        sender_username: username,
        content,
        message_type: type,
        media_url: mediaUrl,
        reply_to_id: replyToId && replyToId > 0 ? replyToId : null,
        created_at: new Date().toISOString(),
      };

      outboxRef.current.set(clientId, { friendId, draft });
      setMessages((prev) => [...prev, { ...draft, status: 'sending' }]);
      sendTyping(false);
      void dispatchSend(clientId);
      return true;
    },
    [userId, username, sendTyping, dispatchSend]
  );

  const sendMessage = useCallback(
    (
      textOrOptions: string | SendMessageOptions,
      extraOptions?: { type?: ChatMessageType; media_url?: string | null; reply_to_id?: number | null }
    ) => {
      const text = typeof textOrOptions === 'string' ? textOrOptions : textOrOptions.text || '';
      const msgType: ChatMessageType =
        typeof textOrOptions === 'object' && textOrOptions.type
          ? textOrOptions.type
          : extraOptions?.type || 'text';
      const mediaUrl =
        typeof textOrOptions === 'object' && textOrOptions.media_url
          ? textOrOptions.media_url
          : extraOptions?.media_url || null;
      const replyToId =
        typeof textOrOptions === 'object' && textOrOptions.reply_to_id !== undefined
          ? textOrOptions.reply_to_id
          : extraOptions?.reply_to_id || null;

      return enqueue(text.trim(), msgType, mediaUrl, replyToId ?? null);
    },
    [enqueue]
  );

  const sendMediaMessage = useCallback(
    (options: {
      media_url: string;
      message_type: 'image' | 'video' | 'file' | 'audio';
      filename?: string;
      reply_to_id?: number | null;
    }) => enqueue(options.filename || '', options.message_type, options.media_url, options.reply_to_id ?? null),
    [enqueue]
  );

  // Reage a uma mensagem (emoji = null remove a reação). Atualiza na hora e desfaz se falhar.
  const reactToMessage = useCallback(
    (messageId: number, emoji: string | null) => {
      if (!userId || messageId <= 0) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                reactions: [
                  ...(m.reactions || []).filter((r) => r.user_id !== userId),
                  ...(emoji ? [{ user_id: userId, emoji }] : []),
                ],
              }
            : m
        )
      );
      directMessagesApi.react(messageId, emoji).catch((err: any) => {
        setError(err?.message || 'Não foi possível reagir.');
        const friendId = activeFriendRef.current;
        if (friendId) void syncLatest(friendId, false);
      });
    },
    [userId, syncLatest]
  );

  const retrySend = useCallback(
    (clientId: string) => {
      void dispatchSend(clientId);
    },
    [dispatchSend]
  );

  // Reenvia automaticamente o que falhou quando a internet volta
  useEffect(() => {
    const retryAll = () => {
      for (const clientId of outboxRef.current.keys()) void dispatchSend(clientId);
    };
    window.addEventListener('online', retryAll);
    return () => window.removeEventListener('online', retryAll);
  }, [dispatchSend]);

  const deleteMessage = useCallback(
    (messageId: number) => {
      // Mensagem que nunca chegou ao servidor: só descarta localmente
      if (messageId < 0) {
        const entry = messages.find((m) => m.id === messageId);
        if (entry?.client_id) outboxRef.current.delete(entry.client_id);
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        return true;
      }

      const friendId = activeFriendRef.current;
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      directMessagesApi
        .remove(messageId)
        .then(() => onActivityRef.current?.())
        .catch((err: any) => {
          setError(err?.message || 'Não foi possível excluir a mensagem.');
          if (friendId) void syncLatest(friendId, false);
        });
      return true;
    },
    [messages, syncLatest]
  );

  return {
    messages,
    sendMessage,
    sendMediaMessage,
    deleteMessage,
    retrySend,
    reactToMessage,
    loadOlder,
    reloadHistory,
    hasMore,
    loadingOlder,
    sendTyping,
    markAsRead,
    isOtherUserTyping,
    connectionStatus,
    loadingHistory,
    error,
    reconnect: connect,
  };
}
