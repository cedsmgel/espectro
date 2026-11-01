import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  authStorage,
  friendsApi,
  Friend,
  GroupMember,
  GroupMessage,
  groupsApi,
  uploadApi,
} from '../lib/api';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { ChatMenu } from '../components/chat/ChatMenu';
import { ModalShell } from '../components/chat/ModalShell';
import { MediaPicker } from '../components/chat/MediaPicker';
import { VoiceRecordingBar } from '../components/chat/VoiceRecordingBar';
import { useTypingHeartbeat } from '../hooks/useTypingHeartbeat';
import { scrollToEnd } from '../lib/scrollToEnd';
import { TypingBubble, ChatActivity } from '../components/chat/TypingBubble';
import { AudioMessage } from '../components/chat/AudioMessage';
import { useTheme } from '../context/ThemeContext';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { useGroupSocket } from '../hooks/useGroupSocket';
import { canEditMessage } from '../lib/chatEdit';

type Detail = {
  group: { id: number; name: string; description: string | null; only_admins_send: boolean };
  members: GroupMember[];
  my_role: 'admin' | 'member';
};

type SendPayload = {
  content?: string;
  message_type?: 'gif' | 'sticker' | 'image' | 'video' | 'audio' | 'file';
  media_url?: string;
  reply_to_id?: number | null;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
// Mensagens que aparecem sem balão, como no chat privado
const BARE_TYPES = new Set(['gif', 'sticker', 'image', 'video']);
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|\s){1,12}$/u;
const isEmojiOnly = (m: GroupMessage) => m.message_type === 'text' && !m.media_url && EMOJI_ONLY.test(m.content || '');

function mediaTypeOf(file: File): 'image' | 'video' | 'audio' | 'file' {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'file';
}

// Painel do grupo: fica ao lado da lista de conversas, como o chat privado
export const GroupChatPanel: React.FC<{ groupId: number }> = ({ groupId }) => {
  const navigate = useNavigate();
  const user = authStorage.getUser();
  const { isDark: isDarkTheme } = useTheme();
  const voice = useVoiceRecorder();

  const [detail, setDetail] = useState<Detail | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<GroupMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<GroupMessage | null>(null);
  const [showManage, setShowManage] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  // Menu da mensagem: mesmo padrão do chat privado (⋮ no hover ou toque longo)
  const [kebabId, setKebabId] = useState<number | null>(null);
  // Quem está escrevendo ou gravando áudio agora
  const [typers, setTypers] = useState<Record<number, { username: string; kind: ChatActivity }>>({});
  const typerTimers = useRef<Record<number, number>>({});
  const typerList = Object.values(typers);
  const typerLabel =
    typerList.length === 0
      ? ''
      : typerList.length === 1
      ? `@${typerList[0].username} ${typerList[0].kind === 'recording' ? 'gravando áudio...' : 'escrevendo...'}`
      : `${typerList.length} pessoas escrevendo...`;
  const handleTextChange = (value: string) => {
    setText(value);
  };
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startLongPress = (id: number) => {
    longPressRef.current = setTimeout(() => setKebabId(id), 450);
  };
  const cancelLongPress = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
    longPressRef.current = null;
  };
  useEffect(() => {
    if (kebabId === null) return;
    const close = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-kebab-menu], [data-kebab-button]')) return;
      setKebabId(null);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [kebabId]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { cancel: cancelVoice } = voice;

  // Sair da conversa com gravação em andamento libera o microfone
  useEffect(() => () => cancelVoice(), [cancelVoice]);
  useEffect(() => {
    const timers = typerTimers.current;
    return () => Object.values(timers).forEach((t) => window.clearTimeout(t));
  }, []);
  // Enquanto grava um áudio, avisa o grupo a cada 2 segundos
  useEffect(() => {
    if (!voice.recording) return;
    sendTyping(true, 'audio');
    const timer = window.setInterval(() => sendTyping(true, 'audio'), 2000);
    return () => {
      window.clearInterval(timer);
      sendTyping(false, 'audio');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.recording]);

  const loadDetail = useCallback(async () => {
    try {
      setDetail(await groupsApi.detail(groupId));
    } catch (err: any) {
      setError(err?.message || 'Grupo não encontrado.');
    }
  }, [groupId]);

  // Primeira página e novas mensagens a cada 4 segundos
  const loadLatest = useCallback(async () => {
    try {
      const res = await groupsApi.messages(groupId);
      setMessages((prev) => {
        const known = new Map(prev.map((m) => [m.id, m]));
        res.messages.forEach((m) => known.set(m.id, m));
        return [...known.values()].sort((a, b) => a.id - b.id);
      });
      setHasMore((prev) => prev || res.has_more);
    } catch {}
  }, [groupId]);

  // Tempo real pelo WebSocket; enquanto a conexão estiver fora, volta a consultar o servidor a cada 4 segundos
  const { connected, sendTyping } = useGroupSocket(groupId, {
    onTyping: ({ user_id, username, kind, active }) => {
      if (user_id === user?.id) return;
      window.clearTimeout(typerTimers.current[user_id]);
      if (!active) {
        setTypers((prev) => {
          const { [user_id]: _gone, ...rest } = prev;
          return rest;
        });
        return;
      }
      setTypers((prev) => ({ ...prev, [user_id]: { username, kind } }));
      // Sem novo sinal em 3 segundos, considera que parou
      typerTimers.current[user_id] = window.setTimeout(() => {
        setTypers((prev) => {
          const { [user_id]: _gone, ...rest } = prev;
          return rest;
        });
      }, 3000);
    },
    onMessage: (message) => {
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message].sort((a, b) => a.id - b.id)));
      // Marca como lida e confirma a ordem com o servidor
      if (message.sender_id !== user?.id) void loadLatest();
    },
    onEdit: ({ message_id, content, edited_at }) =>
      setMessages((prev) => prev.map((m) => (m.id === message_id ? { ...m, content, edited_at } : m))),
    onDelete: (messageId) =>
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, deleted: true, content: '', media_url: null } : m))),
    onRefresh: () => {
      void loadDetail();
      void loadLatest();
    },
  });

  // O indicador fica ligado enquanto houver texto na caixa, mesmo sem digitar
  useTypingHeartbeat(!!text.trim() && !editingMessage, (typing) => sendTyping(typing));

  useEffect(() => {
    setDetail(null);
    setMessages([]);
    setReplyingTo(null);
    setEditingMessage(null);
    void loadDetail();
    void loadLatest();
    const detailTimer = window.setInterval(() => void loadDetail(), 30000);
    return () => window.clearInterval(detailTimer);
  }, [loadDetail, loadLatest]);

  useEffect(() => {
    const timer = window.setInterval(() => void loadLatest(), connected ? 30000 : 4000);
    return () => window.clearInterval(timer);
  }, [loadLatest, connected]);

  useEffect(() => {
    scrollToEnd(bottomRef.current);
  }, [messages.length, typerList.length]);

  const loadOlder = async () => {
    const oldest = messages[0];
    if (!oldest) return;
    try {
      const res = await groupsApi.messages(groupId, oldest.id);
      setMessages((prev) => [...res.messages, ...prev]);
      setHasMore(res.has_more);
    } catch {}
  };

  // Pega a resposta pendente e a limpa da barra de resposta
  const takeReply = () => {
    const replied = replyingTo;
    setReplyingTo(null);
    return replied;
  };

  const sendPayload = async (payload: SendPayload, replied: GroupMessage | null = null) => {
    try {
      const res = await groupsApi.send(groupId, payload);
      const message: GroupMessage = replied
        ? { ...res.message, reply_content: replied.content, reply_sender: replied.sender_username, reply_deleted: false }
        : res.message;
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    } catch (err: any) {
      setError(err?.message || 'Não foi possível enviar.');
    }
  };

  const sendText = async () => {
    const content = text.trim();
    if (!content) return;

    // Edição: troca o texto da mensagem em vez de enviar outra
    if (editingMessage) {
      const target = editingMessage;
      setEditingMessage(null);
      setText('');
      setShowEmoji(false);
      try {
        const res = await groupsApi.edit(groupId, target.id, content);
        if (res.edited) {
          setMessages((prev) =>
            prev.map((m) => (m.id === target.id ? { ...m, content: res.content, edited_at: res.edited_at ?? new Date().toISOString() } : m))
          );
        }
      } catch (err: any) {
        setError(err?.message || 'Não foi possível editar a mensagem.');
      }
      return;
    }

    const replied = takeReply();
    setText('');
    setShowEmoji(false);
    await sendPayload({ content, reply_to_id: replied?.id ?? null }, replied);
    inputRef.current?.focus();
  };

  const handleFile = async (file: File) => {
    setError(null);
    if (file.size > MAX_FILE_SIZE) {
      setError('O arquivo passa de 10 MB.');
      return;
    }
    const replied = takeReply();
    setUploading(true);
    try {
      const type = mediaTypeOf(file);
      const res = await uploadApi.upload(file, type === 'audio' ? { context: 'audio' } : undefined);
      await sendPayload(
        { message_type: type, media_url: res.url, content: type === 'file' ? file.name : undefined, reply_to_id: replied?.id ?? null },
        replied
      );
    } catch (err: any) {
      setError(err?.message || 'Não foi possível enviar o arquivo.');
    } finally {
      setUploading(false);
    }
  };

  const handleStartVoice = async () => {
    setError(null);
    const message = await voice.start();
    if (message) setError(message);
  };

  const handleSendVoice = async () => {
    const blob = await voice.stop();
    if (!blob) {
      setError('Não foi possível capturar o áudio gravado.');
      return;
    }
    const replied = takeReply();
    setUploading(true);
    try {
      const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
      const file = new File([blob], `voz-${Date.now()}.${ext}`, { type: blob.type || 'audio/webm' });
      const res = await uploadApi.upload(file, { context: 'audio' });
      await sendPayload(
        { message_type: 'audio', media_url: res.url, content: 'Mensagem de voz', reply_to_id: replied?.id ?? null },
        replied
      );
    } catch (err: any) {
      setError(err?.message || 'Não foi possível enviar o áudio. Tente de novo.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (m: GroupMessage) => {
    if (!window.confirm('Apagar esta mensagem para todo o grupo?')) return;
    try {
      await groupsApi.remove(groupId, m.id);
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, deleted: true, content: '', media_url: null } : x)));
    } catch (err: any) {
      setError(err?.message || 'Não foi possível apagar a mensagem.');
    }
  };

  // Editar: o texto volta para o campo de envio e o próximo envio troca a mensagem
  const handleStartEdit = (m: GroupMessage) => {
    setReplyingTo(null);
    setEditingMessage(m);
    setText(m.content);
    inputRef.current?.focus();
  };

  const handleCopy = (m: GroupMessage) => {
    navigator.clipboard?.writeText(m.content).catch(() => setError('Não foi possível copiar.'));
  };

  const leave = async () => {
    if (!window.confirm('Sair deste grupo? Você deixará de ver as mensagens novas.')) return;
    try {
      await groupsApi.manage(groupId, { action: 'leave' });
      navigate('/mensagens');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível sair.');
    }
  };

  if (error && !detail) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center text-sm text-on-surface-variant">
        <div>
          <p className="font-semibold text-on-surface">{error}</p>
          <Link to="/mensagens" className="text-primary text-xs hover:underline">Voltar às mensagens</Link>
        </div>
      </div>
    );
  }
  if (!detail) {
    return <div className="flex-1 flex items-center justify-center text-xs text-on-surface-variant">Carregando...</div>;
  }

  const isAdmin = detail.my_role === 'admin';
  const canSend = isAdmin || !detail.group.only_admins_send;
  const roleOf = new Map(detail.members.map((m) => [m.id, m]));

  const renderBody = (m: GroupMessage) => {
    if (m.deleted) return <span className="italic opacity-70">Mensagem apagada</span>;
    switch (m.message_type) {
      case 'gif':
        return m.media_url ? <img src={m.media_url} alt="GIF" className="max-w-[240px] rounded-xl" /> : null;
      case 'sticker':
        return m.media_url ? <img src={m.media_url} alt="Figurinha" className="max-w-[160px]" /> : null;
      case 'image':
        return m.media_url ? (
          <a href={m.media_url} target="_blank" rel="noopener noreferrer">
            <img src={m.media_url} alt="Imagem" className="max-w-[240px] rounded-xl" />
          </a>
        ) : null;
      case 'video':
        return m.media_url ? (
          <video src={m.media_url} controls playsInline preload="metadata" className="max-w-[240px] w-full rounded-xl bg-black" />
        ) : null;
      case 'audio':
        return m.media_url ? <AudioMessage src={m.media_url} /> : null;
      case 'file':
        return m.media_url ? (
          <a href={m.media_url} target="_blank" rel="noopener noreferrer" download className="flex items-center gap-2 min-w-[160px] underline-offset-2 hover:underline">
            <span className="material-symbols-outlined text-[20px] shrink-0">description</span>
            <span className="truncate">{m.content || 'Arquivo'}</span>
          </a>
        ) : null;
      default:
        if (isEmojiOnly(m)) return <p className="text-4xl leading-tight whitespace-pre-wrap">{m.content}</p>;
        return <span className="whitespace-pre-wrap break-words">{m.content}</span>;
    }
  };

  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-surface text-on-surface">
      {/* Cabeçalho: mesmo padrão do chat privado */}
      <div className="min-h-14 sm:min-h-16 pt-[env(safe-area-inset-top)] px-3 sm:px-6 bg-surface-container-lowest border-b border-outline-variant flex items-center justify-between shadow-xs z-10 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link to="/mensagens" className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container md:hidden" aria-label="Voltar">
            <span className="material-symbols-outlined text-[24px]">arrow_back</span>
          </Link>
          <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-sm uppercase flex-shrink-0">
            {detail.group.name.charAt(0)}
          </div>
          <button type="button" onClick={() => setShowManage(true)} className="min-w-0 text-left cursor-pointer">
            <span className="block font-semibold text-sm truncate">{detail.group.name}</span>
            <span className="block text-[11px] text-on-surface-variant truncate">
              {typerLabel ? (
                <span className="text-primary font-semibold">{typerLabel}</span>
              ) : (
                detail.members.map((m) => `@${m.username}`).join(', ')
              )}
            </span>
          </button>
        </div>
        <ChatMenu
          title="Opções do grupo"
          items={[
            { key: 'manage', label: 'Dados do grupo', icon: 'info', onSelect: () => setShowManage(true) },
            { key: 'leave', label: 'Sair do grupo', icon: 'logout', danger: true, onSelect: leave },
          ]}
        />
      </div>

      {/* Histórico */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-1 min-h-0 overscroll-contain">
        {hasMore && (
          <div className="flex justify-center mb-2">
            <button type="button" onClick={loadOlder} className="text-[11px] font-semibold text-primary px-4 py-1.5 rounded-full bg-surface-container-low">
              Carregar mensagens anteriores
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <div className="text-center text-xs text-on-surface-variant py-10">
            <p className="font-semibold text-on-surface">Nenhuma mensagem ainda</p>
            <p>Diga um oi para o grupo.</p>
          </div>
        )}

        {messages.map((m, idx) => {
          if (m.message_type === 'system') {
            return (
              <div key={m.id} className="flex justify-center my-2">
                <span className="text-[11px] text-on-surface-variant bg-surface-container-low px-3 py-1 rounded-full">{m.content}</span>
              </div>
            );
          }

          const mine = m.sender_id === user?.id;
          const prev = messages[idx - 1];
          const sameAsPrev = prev && prev.sender_id === m.sender_id && prev.message_type !== 'system';
          const sender = m.sender_id ? roleOf.get(m.sender_id) : undefined;
          const bare = !m.deleted && (BARE_TYPES.has(m.message_type) || isEmojiOnly(m));
          const menuItemsFor = (m: GroupMessage) => [
            { key: 'reply', label: 'Responder', icon: 'reply', onSelect: () => { setReplyingTo(m); inputRef.current?.focus(); }, hidden: m.deleted },
            { key: 'edit', label: 'Editar', icon: 'edit', onSelect: () => handleStartEdit(m), hidden: m.deleted || !mine || m.message_type !== 'text' || !canEditMessage(m.created_at) },
            { key: 'copy', label: 'Copiar', icon: 'content_copy', onSelect: () => handleCopy(m), hidden: m.deleted || m.message_type !== 'text' },
            { key: 'delete', label: 'Apagar', icon: 'delete', danger: true, onSelect: () => void handleDelete(m), hidden: m.deleted || !(mine || isAdmin) },
          ];
          const visibleItems = menuItemsFor(m).filter((item) => !item.hidden);
          const kebabOpen = kebabId === m.id;

          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} ${sameAsPrev ? 'mt-0.5' : 'mt-3'}`}>
              <div className={`flex flex-col max-w-[85%] sm:max-w-md ${mine ? 'items-end' : 'items-start'}`}>
                {!mine && !sameAsPrev && (
                  <span className="flex items-center gap-1.5 text-[11px] font-bold mb-0.5 ml-1" style={{ color: nameColor(m.sender_id) }}>
                    @{m.sender_username}
                    {sender?.role === 'admin' && (
                      <span className="text-[9px] px-1.5 rounded-full bg-primary/15 text-primary font-semibold">admin</span>
                    )}
                  </span>
                )}
                <div
                  className={`relative group ${kebabOpen ? 'z-50' : 'z-10'}`}
                  onTouchStart={() => startLongPress(m.id)}
                  onTouchEnd={cancelLongPress}
                  onTouchCancel={cancelLongPress}
                >
                  {visibleItems.length > 0 && (
                    <div
                      className={`absolute top-1 z-30 ${mine ? '-left-8' : '-right-8'} transition-all duration-150 ${
                        kebabOpen ? 'opacity-100 scale-100' : 'opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100'
                      }`}
                    >
                      <button
                        type="button"
                        data-kebab-button
                        onClick={(e) => {
                          e.stopPropagation();
                          setKebabId(kebabOpen ? null : m.id);
                        }}
                        className="w-7 h-7 rounded-full bg-surface-container-high/90 dark:bg-zinc-900 border border-outline-variant text-on-surface-variant hover:text-on-surface flex items-center justify-center shadow-md transition-all cursor-pointer"
                        title="Opções da mensagem"
                      >
                        <span className="material-symbols-outlined text-[16px]">more_vert</span>
                      </button>
                    </div>
                  )}

                  {kebabOpen && (
                    <div
                      data-kebab-menu
                      className={`absolute z-50 ${mine ? 'right-0' : 'left-0'} top-full mt-1.5 min-w-[200px] rounded-2xl bg-surface-container-high dark:bg-[#18181b] border border-outline-variant/40 dark:border-zinc-800 shadow-2xl py-1.5 animate-in fade-in zoom-in-95 duration-150`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {visibleItems.map((item) => (
                        <React.Fragment key={item.key}>
                          {item.danger && <div className="my-1 border-t border-outline-variant dark:border-zinc-800" />}
                          <button
                            type="button"
                            onClick={() => {
                              setKebabId(null);
                              item.onSelect();
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs transition-colors text-left cursor-pointer ${
                              item.danger ? 'text-error hover:bg-error/15' : 'text-on-surface hover:bg-surface-container dark:hover:bg-zinc-800'
                            }`}
                          >
                            <span className={`material-symbols-outlined text-[18px] ${item.danger ? '' : 'text-on-surface-variant'}`}>{item.icon}</span>
                            <span className="font-medium">{item.danger ? 'Excluir' : item.label}</span>
                          </button>
                        </React.Fragment>
                      ))}
                    </div>
                  )}

                <div
                  className={
                    bare
                      ? ''
                      : `p-3 text-xs leading-relaxed shadow-xs rounded-2xl ${
                          mine
                            ? 'bg-primary-container text-on-primary rounded-br-xs'
                            : 'bg-surface-container-low text-on-surface border border-outline-variant rounded-bl-xs'
                        }`
                  }
                >
                  {m.reply_to_id && !m.deleted && (
                    <div
                      className={`mb-1.5 px-2 py-1 rounded-lg border-l-2 text-[11px] max-w-[260px] ${
                        mine ? 'bg-black/10 border-on-primary' : 'bg-surface-container border-primary'
                      }`}
                    >
                      <span className="block font-semibold truncate">@{m.reply_sender || 'usuário'}</span>
                      <span className="block truncate opacity-80">{m.reply_content ?? 'Mensagem apagada'}</span>
                    </div>
                  )}
                  {renderBody(m)}
                </div>
                </div>
                <div className="flex items-center gap-1 mt-0.5 mx-1">
                  <span className="text-[10px] text-on-surface-variant">
                    {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {m.edited_at && !m.deleted && <span className="text-[10px] text-on-surface-variant">· editada</span>}
                </div>
              </div>
            </div>
          );
        })}
        {typerList.map((t) => (
          <TypingBubble key={t.username} kind={t.kind} name={`@${t.username}`} className="mt-2" />
        ))}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-error bg-error-container/60 cursor-pointer" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      {/* Entrada: emojis, GIFs e figurinhas, anexo, áudio, texto e enviar */}
      <div className="p-2.5 sm:p-4 pb-[max(0.75rem,calc(env(safe-area-inset-bottom)+0.6rem))] bg-surface-container-lowest border-t border-outline-variant flex-shrink-0 relative">
        {showEmoji && (
          <div className="absolute bottom-20 left-3 sm:left-12 z-30 rounded-2xl overflow-hidden shadow-xl">
            <Picker
              data={data}
              onEmojiSelect={(e: any) => setText((t) => t + e.native)}
              theme={isDarkTheme ? 'dark' : 'light'}
              locale="pt"
              previewPosition="none"
              skinTonePosition="none"
              navPosition="top"
              maxFrequentRows={2}
              perLine={8}
            />
          </div>
        )}
        {showMedia && (
          <div className="absolute bottom-20 left-3 sm:left-12 z-30">
            <MediaPicker
              onClose={() => setShowMedia(false)}
              onSelect={(c) => {
                setShowMedia(false);
                const replied = takeReply();
                void sendPayload({ message_type: c.type, media_url: c.url, reply_to_id: replied?.id ?? null }, replied);
              }}
            />
          </div>
        )}

        {editingMessage && canSend && !voice.recording && (
          <div className="mb-2 px-3 py-2 rounded-xl bg-surface-container-low border-l-4 border-primary flex items-center justify-between gap-2 text-xs">
            <div className="min-w-0">
              <span className="block font-semibold text-primary truncate text-[11px]">Editando mensagem</span>
              <span className="block truncate text-[11px] text-on-surface-variant">{editingMessage.content}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingMessage(null);
                setText('');
              }}
              aria-label="Cancelar edição"
              className="p-1 rounded-full text-on-surface-variant hover:bg-surface-container shrink-0 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        {replyingTo && canSend && !voice.recording && (
          <div className="mb-2 px-3 py-2 rounded-xl bg-surface-container-low border-l-4 border-primary flex items-center justify-between gap-2 text-xs">
            <div className="min-w-0">
              <span className="block font-semibold text-primary truncate text-[11px]">Respondendo a @{replyingTo.sender_username}</span>
              <span className="block truncate text-[11px] text-on-surface-variant">{replyingTo.content || 'Mensagem'}</span>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              aria-label="Cancelar resposta"
              className="p-1 rounded-full text-on-surface-variant hover:bg-surface-container shrink-0 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        {uploading && <p className="text-[11px] text-on-surface-variant px-3 pb-1.5">Enviando...</p>}

        {!canSend ? (
          <p className="text-center text-xs text-on-surface-variant py-2">Só os administradores podem enviar mensagens neste grupo.</p>
        ) : voice.recording ? (
          <VoiceRecordingBar seconds={voice.seconds} onCancel={voice.cancel} onSend={() => void handleSendVoice()} />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendText();
            }}
            className="flex items-center gap-1 sm:gap-2 bg-surface-container-low rounded-full px-2 py-1.5 border border-outline-variant"
          >
            <button
              type="button"
              onClick={() => {
                setShowEmoji((v) => !v);
                setShowMedia(false);
              }}
              className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer shrink-0 ${
                showEmoji ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'
              }`}
              title="Emojis"
            >
              <span className="material-symbols-outlined text-[20px]">sentiment_satisfied</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowMedia((v) => !v);
                setShowEmoji(false);
              }}
              className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer text-[11px] font-bold shrink-0 ${
                showMedia ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'
              }`}
              title="GIFs e figurinhas"
            >
              GIF
            </button>
            <button
              type="button"
              onClick={() => {
                setShowEmoji(false);
                setShowMedia(false);
                fileInputRef.current?.click();
              }}
              disabled={uploading}
              className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container cursor-pointer disabled:opacity-40 shrink-0"
              title="Anexar foto, vídeo ou arquivo"
              aria-label="Anexar"
            >
              <span className="material-symbols-outlined text-[20px]">attach_file</span>
            </button>
            <input
              ref={inputRef}
              type="text"
              value={text}
              maxLength={2000}
              onChange={(e) => handleTextChange(e.target.value)}
              aria-label={`Mensagem para ${detail.group.name}`}
              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-xs text-on-surface placeholder:text-on-surface-variant px-2"
            />
            {!text.trim() && (
              <button
                type="button"
                onClick={() => void handleStartVoice()}
                disabled={uploading}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container cursor-pointer disabled:opacity-40 shrink-0"
                title="Gravar mensagem de voz"
                aria-label="Gravar mensagem de voz"
              >
                <span className="material-symbols-outlined text-[20px]">mic</span>
              </button>
            )}
            <button
              type="submit"
              disabled={!text.trim() || uploading}
              className="w-8 h-8 rounded-full flex items-center justify-center text-primary disabled:opacity-40 hover:bg-surface-container cursor-pointer shrink-0"
              title="Enviar"
            >
              <span className="material-symbols-outlined text-[20px]">send</span>
            </button>
          </form>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void handleFile(file);
          }}
        />
      </div>

      {showManage && (
        <ManageGroupModal
          groupId={groupId}
          detail={detail}
          onClose={() => setShowManage(false)}
          onChanged={() => {
            void loadDetail();
            void loadLatest();
          }}
        />
      )}
    </div>
  );
};

const NAME_COLORS = ['#f97316', '#22c55e', '#06b6d4', '#a855f7', '#ec4899', '#eab308', '#3b82f6', '#ef4444'];
function nameColor(senderId: number | null): string {
  return NAME_COLORS[Math.abs(senderId || 0) % NAME_COLORS.length];
}

interface ManageProps {
  groupId: number;
  detail: Detail;
  onClose: () => void;
  onChanged: () => void;
}

const ManageGroupModal: React.FC<ManageProps> = ({ groupId, detail, onClose, onChanged }) => {
  const isAdmin = detail.my_role === 'admin';
  const [name, setName] = useState(detail.group.name);
  const [description, setDescription] = useState(detail.group.description || '');
  const [onlyAdmins, setOnlyAdmins] = useState(detail.group.only_admins_send);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    friendsApi
      .list()
      .then((list) => {
        const inGroup = new Set(detail.members.map((m) => m.id));
        setFriends(list.filter((f: any) => !inGroup.has(f.friend_id)).map((f: any) => ({ ...f, friend_id: f.friend_id })));
      })
      .catch(() => {});
  }, [isAdmin, detail.members]);

  const run = async (body: Record<string, unknown>) => {
    setError(null);
    try {
      await groupsApi.manage(groupId, body);
      onChanged();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível concluir.');
    }
  };

  return (
    <ModalShell title="Dados do grupo" onClose={onClose}>
      {isAdmin && (
        <section className="mb-5 space-y-3">
          <label className="block text-xs font-semibold">
            Nome
            <input value={name} maxLength={50} onChange={(e) => setName(e.target.value)} className="mt-1 w-full h-9 px-3 rounded-xl bg-surface-container-low text-xs outline-none" />
          </label>
          <label className="block text-xs font-semibold">
            Descrição
            <textarea value={description} maxLength={300} rows={2} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full p-3 rounded-xl bg-surface-container-low text-xs outline-none resize-none" />
          </label>
          <label className="flex items-center justify-between gap-3 text-xs">
            <span>
              <span className="block font-semibold">Só admins enviam mensagens</span>
              <span className="block text-[11px] text-on-surface-variant">Os outros membros só leem.</span>
            </span>
            <input type="checkbox" checked={onlyAdmins} onChange={(e) => setOnlyAdmins(e.target.checked)} className="w-5 h-5 accent-[var(--color-primary,#2563eb)]" />
          </label>
          <button type="button" onClick={() => run({ action: 'update', name, description, only_admins_send: onlyAdmins })} className="px-4 py-2 rounded-full text-xs font-semibold bg-primary-container text-on-primary">
            Salvar alterações
          </button>
        </section>
      )}

      <section className="mb-5">
        <h3 className="text-xs font-semibold mb-2">{detail.members.length} membros</h3>
        <ul className="space-y-2">
          {detail.members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 p-2 rounded-xl bg-surface-container-low">
              <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center text-xs font-bold uppercase">{m.username.charAt(0)}</div>
              <div className="flex-1 min-w-0">
                <span className="block text-xs font-semibold truncate">@{m.username}{m.id === authStorage.getUser()?.id ? ' (você)' : ''}</span>
                {m.role === 'admin' && <span className="text-[10px] text-primary font-semibold">Administrador</span>}
              </div>
              {isAdmin && m.id !== authStorage.getUser()?.id && (
                <ChatMenu
                  title="Ações do membro"
                  items={[
                    m.role === 'admin'
                      ? { key: 'demote', label: 'Remover dos admins', icon: 'remove_moderator', onSelect: () => run({ action: 'demote', user_id: m.id }) }
                      : { key: 'promote', label: 'Tornar admin', icon: 'shield_person', onSelect: () => run({ action: 'promote', user_id: m.id }) },
                    { key: 'remove', label: 'Remover do grupo', icon: 'person_remove', danger: true, onSelect: () => run({ action: 'remove', user_id: m.id }), hidden: m.role === 'admin' },
                  ]}
                />
              )}
            </li>
          ))}
        </ul>
      </section>

      {isAdmin && friends.length > 0 && (
        <section className="mb-4">
          <h3 className="text-xs font-semibold mb-2">Adicionar amigos</h3>
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {friends.map((f) => (
              <li key={f.friend_id}>
                <label className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-container-low cursor-pointer text-xs">
                  <input type="checkbox" checked={picked.includes(f.friend_id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, f.friend_id] : p.filter((x) => x !== f.friend_id)))} className="accent-[var(--color-primary,#2563eb)]" />
                  @{f.username}
                </label>
              </li>
            ))}
          </ul>
          <button type="button" disabled={picked.length === 0} onClick={() => { run({ action: 'add', user_ids: picked }); setPicked([]); }} className="mt-2 px-4 py-2 rounded-full text-xs font-semibold bg-primary-container text-on-primary disabled:opacity-50">
            Adicionar {picked.length > 0 ? `(${picked.length})` : ''}
          </button>
        </section>
      )}

      <button type="button" onClick={() => { void groupsApi.manage(groupId, { action: 'leave' }).then(() => { window.location.href = '/mensagens'; }); }} className="w-full py-2.5 rounded-full text-xs font-semibold text-error bg-surface-container hover:bg-surface-container-high">
        Sair do grupo
      </button>

      {error && <p className="mt-3 text-xs text-error">{error}</p>}
    </ModalShell>
  );
};
