import { useState, useEffect, useRef, useCallback } from 'react';
import { authStorage } from '../lib/api';

export type ChatMessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'file'
  | 'location'
  | 'gif'
  | 'sticker';

export interface ChatMessage {
  id?: number;
  sender_id: number;
  sender_username?: string;
  content: string;
  message_type?: ChatMessageType;
  media_url?: string | null;
  created_at: string;
}

export interface SendMessageOptions {
  text?: string;
  type?: ChatMessageType;
  media_url?: string | null;
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface UseChatOptions {
  activeFriendId: number | null | undefined;
  activeFriendUsername?: string;
}

export function useChat({ activeFriendId, activeFriendUsername }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const isManuallyClosedRef = useRef(false);

  const user = authStorage.getUser();
  const userId = user?.id;
  const username = user?.username || 'Usuário';
  const token = authStorage.getToken();

  // Função para montar a URL do WebSocket
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

  const connect = useCallback(() => {
    if (!userId || !activeFriendId || !token) {
      setConnectionStatus('idle');
      return;
    }

    // Limpa timeouts anteriores
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Fecha socket existente se houver
    if (socketRef.current) {
      isManuallyClosedRef.current = true;
      try {
        socketRef.current.close(1000, 'Trocando de sala');
      } catch {}
      socketRef.current = null;
    }

    isManuallyClosedRef.current = false;
    setConnectionStatus((prev) => (prev === 'connected' ? 'reconnecting' : 'connecting'));
    setError(null);

    const wsUrl = getWsUrl(userId, activeFriendId, token);

    try {
      // Abre a conexão WebSocket passando o token tanto na query string quanto no Sec-WebSocket-Protocol
      const ws = new WebSocket(wsUrl, token ? [token] : undefined);
      socketRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');
        setError(null);

        // Ping periódico a cada 25 segundos para manter a conexão ativa
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
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'history') {
            // Histórico das últimas 50 mensagens salvas no SQLite interno
            setMessages(Array.isArray(data.messages) ? data.messages : []);
            setLoadingHistory(false);
          } else if (data.type === 'message' && data.message) {
            // Nova mensagem recebida em tempo real
            setMessages((prev) => {
              // Evita duplicatas se já existir por ID
              if (data.message.id && prev.some((m) => m.id === data.message.id)) {
                return prev;
              }
              return [...prev, data.message];
            });
            // Quando uma mensagem chega, o amigo para de digitar
            setIsOtherUserTyping(false);
          } else if (data.type === 'typing') {
            // Indicador de digitação do outro usuário
            if (data.sender_id === activeFriendId) {
              setIsOtherUserTyping(!!data.is_typing);

              // Auto-reseta após 3 segundos caso não receba atualização
              if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
              if (data.is_typing) {
                typingTimeoutRef.current = window.setTimeout(() => {
                  setIsOtherUserTyping(false);
                }, 3000);
              }
            }
          }
        } catch (err) {
          console.error('Erro ao processar mensagem do WebSocket:', err);
        }
      };

      ws.onerror = (err) => {
        console.warn('Alerta na conexão WebSocket do Chat:', err);
      };

      ws.onclose = () => {
        if (pingIntervalRef.current) {
          window.clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Se o fechamento não foi manual (ex: troca de conversa ou logout), tenta reconectar em 3s
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
  }, [userId, activeFriendId, token, getWsUrl]);

  // Efeito para conectar quando o amigo ativo muda
  useEffect(() => {
    if (activeFriendId && userId) {
      setLoadingHistory(true);
      setMessages([]);
      setIsOtherUserTyping(false);
      connect();
    } else {
      setMessages([]);
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
  }, [activeFriendId, userId, connect]);

  // Função para avisar status de digitação
  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!userId || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        return;
      }
      try {
        socketRef.current.send(
          JSON.stringify({
            type: 'typing',
            sender_id: userId,
            is_typing: isTyping,
          })
        );
      } catch {}
    },
    [userId]
  );

  // Função para enviar nova mensagem (suporta texto puro ou mídias/arquivos)
  const sendMessage = useCallback(
    (
      textOrOptions: string | SendMessageOptions,
      extraOptions?: { type?: ChatMessageType; media_url?: string | null }
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

      const trimmed = text.trim();
      if (!trimmed && !mediaUrl) {
        return false;
      }
      if (!userId || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        return false;
      }

      const payload = {
        type: 'message',
        message_type: msgType,
        sender_id: userId,
        sender_username: username,
        content: trimmed,
        text: trimmed,
        media_url: mediaUrl,
        created_at: new Date().toISOString(),
      };

      try {
        socketRef.current.send(JSON.stringify(payload));
        // Notifica que parou de digitar
        sendTyping(false);
        return true;
      } catch (err) {
        console.error('Erro ao enviar mensagem pelo WebSocket:', err);
        return false;
      }
    },
    [userId, username, sendTyping]
  );

  return {
    messages,
    sendMessage,
    sendTyping,
    isOtherUserTyping,
    connectionStatus,
    loadingHistory,
    error,
    reconnect: connect,
  };
}
