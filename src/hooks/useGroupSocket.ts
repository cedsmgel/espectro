import { useCallback, useEffect, useRef, useState } from 'react';
import { authStorage, GroupMessage } from '../lib/api';

export interface GroupSocketHandlers {
  onMessage: (message: GroupMessage) => void;
  onEdit: (event: { message_id: number; content: string; edited_at: string | null }) => void;
  onDelete: (messageId: number) => void;
  // Mudança no grupo (membros, nome, regras) ou volta da conexão: recarregar tudo
  onRefresh: () => void;
  // Alguém começou ou parou de escrever/gravar áudio
  onTyping?: (event: { user_id: number; username: string; kind: 'typing' | 'recording'; active: boolean }) => void;
}

const PING_MS = 45000;

function buildUrl(groupId: number, token: string): string {
  const isHttps = window.location.protocol === 'https:';
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  // Em localhost aponta para o Cloudflare Pages de produção, onde o Durable Object está ativo
  const host = isLocalhost ? 'espectro.pages.dev' : window.location.host;
  const protocol = isLocalhost || isHttps ? 'wss:' : 'ws:';
  return `${protocol}//${host}/api/chat?group=${groupId}&token=${encodeURIComponent(token)}`;
}

// Recebe as mensagens do grupo em tempo real. Se a conexão cair, `connected` fica false
// e quem usa o hook volta a consultar o servidor em intervalos curtos.
export function useGroupSocket(
  groupId: number,
  handlers: GroupSocketHandlers
): { connected: boolean; sendTyping: (active: boolean, kind?: 'text' | 'audio') => void } {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const token = authStorage.getToken();
    if (!token || !groupId || typeof WebSocket === 'undefined') return;

    let socket: WebSocket | null = null;
    let retryTimer: number | undefined;
    let pingTimer: number | undefined;
    let attempts = 0;
    let hadDrop = false;
    let stopped = false;

    const connect = () => {
      const ws = new WebSocket(buildUrl(groupId, token));
      socket = ws;
      socketRef.current = ws;

      ws.onopen = () => {
        attempts = 0;
        setConnected(true);
        // Perdeu eventos enquanto estava fora do ar: busca o que faltou
        if (hadDrop) handlersRef.current.onRefresh();
        hadDrop = false;
        pingTimer = window.setInterval(() => {
          try {
            ws.send(JSON.stringify({ type: 'ping' }));
          } catch {}
        }, PING_MS);
      };

      ws.onmessage = (event) => {
        let data: any;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        const current = handlersRef.current;
        if (data.type === 'message' && data.message) current.onMessage(data.message as GroupMessage);
        else if (data.type === 'edit') {
          current.onEdit({ message_id: Number(data.message_id), content: String(data.content ?? ''), edited_at: data.edited_at ?? null });
        } else if (data.type === 'delete') current.onDelete(Number(data.message_id));
        else if (data.type === 'refresh') current.onRefresh();
        else if (data.type === 'typing' && data.sender_id) {
          current.onTyping?.({
            user_id: Number(data.sender_id),
            username: String(data.sender_username ?? ''),
            kind: data.kind === 'audio' ? 'recording' : 'typing',
            active: !!data.is_typing,
          });
        }
      };

      ws.onclose = () => {
        // Um socket antigo fechando não pode religar nem derrubar o atual
        if (socket !== ws) return;
        window.clearInterval(pingTimer);
        setConnected(false);
        hadDrop = true;
        if (stopped) return;
        attempts += 1;
        retryTimer = window.setTimeout(connect, Math.min(15000, 1000 * 2 ** Math.min(attempts, 4)));
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      window.clearInterval(pingTimer);
      const ws = socket;
      socket = null;
      ws?.close();
      setConnected(false);
    };
  }, [groupId]);

  const sendTyping = useCallback((active: boolean, kind: 'text' | 'audio' = 'text') => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify({ type: 'typing', is_typing: active, kind }));
    } catch {}
  }, []);

  return { connected, sendTyping };
}
