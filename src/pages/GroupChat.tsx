import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  authStorage,
  friendsApi,
  chatExtrasApi,
  Friend,
  GroupInfo,
  GroupMember,
  GroupMessage,
  groupsApi,
  uploadApi,
} from '../lib/api';
import { EmojiPicker } from '../components/chat/EmojiPicker';
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
import { REACTION_EMOJIS, groupReactions } from '../lib/chatReactions';
import { visibleInterval } from '../lib/visibleInterval';
import { ChatLibraryModal } from '../components/chat/ChatLibraryModal';
import { StarredModal } from '../components/chat/StarredModal';
import { DisappearingModal, disappearLabel } from '../components/chat/DisappearingModal';
import { ShareGroupModal, GroupPermissionsModal } from '../components/chat/GroupModals';
import { ViewOnceMedia } from '../components/chat/ViewOnceMedia';
import { ThumbImg } from '../components/ThumbImg';
import { describeMessage, downloadConversation } from '../lib/exportChat';

type Detail = {
  group: GroupInfo;
  members: GroupMember[];
  my_role: 'admin' | 'member';
};

type SendPayload = {
  content?: string;
  message_type?: 'gif' | 'sticker' | 'image' | 'video' | 'audio' | 'file';
  media_url?: string;
  reply_to_id?: number | null;
  view_once?: boolean;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
// Mensagens que aparecem sem balão, como no chat privado
const BARE_TYPES = new Set(['gif', 'sticker', 'image', 'video']);
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|\s){1,12}$/u;
const isEmojiOnly = (m: GroupMessage) => m.message_type === 'text' && !m.media_url && EMOJI_ONLY.test(m.content || '');

const dateLabel = (iso: string): string => {
  const date = new Date(iso);
  const now = new Date();
  const same = (a: Date, b: Date) => a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (same(date, now)) return 'Hoje';
  if (same(date, yesterday)) return 'Ontem';
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
};

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [modal, setModal] = useState<null | 'library' | 'starred' | 'disappear' | 'share' | 'permissions'>(null);
  const [starredIds, setStarredIds] = useState<Set<number>>(new Set());
  // Próxima foto/vídeo vai como visualização única
  const [viewOnceNext, setViewOnceNext] = useState(false);
  const [exporting, setExporting] = useState(false);
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
    onReaction: ({ message_id, user_id, emoji }) =>
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message_id
            ? { ...m, reactions: [...(m.reactions || []).filter((r) => r.user_id !== user_id), ...(emoji ? [{ user_id, emoji }] : [])] }
            : m
        )
      ),
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
    return visibleInterval(() => void loadDetail(), 60000);
  }, [loadDetail, loadLatest]);

  useEffect(() => {
    return visibleInterval(() => void loadLatest(), connected ? 45000 : 5000);
  }, [loadLatest, connected]);

  useEffect(() => {
    chatExtrasApi
      .starred()
      .then((list) => setStarredIds(new Set(list.filter((i) => i.kind === 'group' && i.chat_id === groupId).map((i) => i.message_id))))
      .catch(() => {});
  }, [groupId, modal === 'starred']);

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
    if (file.size > MAX_FILE_SIZE && !file.type.startsWith('image/')) {
      setError('O arquivo passa de 10 MB.');
      return;
    }
    const replied = takeReply();
    setUploading(true);
    try {
      const type = mediaTypeOf(file);
      const res = await uploadApi.upload(file, type === 'audio' ? { context: 'audio' } : undefined);
      const once = viewOnceNext && (type === 'image' || type === 'video');
      await sendPayload(
        { message_type: type, media_url: res.url, content: type === 'file' ? file.name : undefined, reply_to_id: replied?.id ?? null, view_once: once || undefined },
        replied
      );
      if (once) setViewOnceNext(false);
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

  const reactTo = (m: GroupMessage, emoji: string | null) => {
    const myId = user?.id;
    if (!myId) return;
    setMessages((prev) =>
      prev.map((x) =>
        x.id === m.id ? { ...x, reactions: [...(x.reactions || []).filter((r) => r.user_id !== myId), ...(emoji ? [{ user_id: myId, emoji }] : [])] } : x
      )
    );
    groupsApi.react(groupId, m.id, emoji).catch((err: any) => {
      setError(err?.message || 'Não foi possível reagir.');
      void loadLatest();
    });
  };

  const toggleStar = (m: GroupMessage) => {
    const starred = !starredIds.has(m.id);
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (starred) next.add(m.id);
      else next.delete(m.id);
      return next;
    });
    chatExtrasApi.setStarred('group', m.id, starred).catch(() => setError('Não foi possível favoritar.'));
  };

  // Baixa todo o histórico visível para você, página a página
  const exportConversation = async () => {
    if (!detail || exporting) return;
    setExporting(true);
    try {
      let all: GroupMessage[] = [];
      let before: number | undefined;
      for (let page = 0; page < 200; page++) {
        const res = await groupsApi.messages(groupId, before);
        all = [...res.messages, ...all];
        if (!res.has_more || res.messages.length === 0) break;
        before = res.messages[0].id;
      }
      downloadConversation(
        detail.group.name,
        all.map((m) => ({
          created_at: m.created_at,
          sender: m.message_type === 'system' ? 'Aviso' : `@${m.sender_username ?? 'usuário'}`,
          text: m.deleted ? '<mensagem apagada>' : describeMessage(m.message_type, m.content, m.media_url, m.view_once),
        }))
      );
    } catch {
      setError('Não foi possível exportar a conversa.');
    } finally {
      setExporting(false);
    }
  };

  const saveDisappear = async (seconds: number) => {
    try {
      await groupsApi.manage(groupId, { action: 'update', disappear_seconds: seconds });
      void loadDetail();
      void loadLatest();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível salvar.');
      throw err;
    }
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

  // Lista de bolhas memorizada: digitar no campo não recria as mensagens.
  const latestActions = useRef<Record<string, (...args: any[]) => any>>({});
  latestActions.current = { handleStartEdit, handleCopy, handleDelete, reactTo, toggleStar, startLongPress, cancelLongPress };
  const listNodes = useMemo(() => {
    if (!detail) return null;
    const isAdmin = detail.my_role === 'admin';
    const roleOf = new Map(detail.members.map((m) => [m.id, m]));
    const term = searchTerm.trim().toLowerCase();
    const shown = term ? messages.filter((m) => m.message_type !== 'system' && !m.deleted && (m.content || '').toLowerCase().includes(term)) : messages;
    const handleStartEdit = (...args: any[]) => latestActions.current.handleStartEdit(...args);
    const handleCopy = (...args: any[]) => latestActions.current.handleCopy(...args);
    const handleDelete = (...args: any[]) => latestActions.current.handleDelete(...args);
    const reactTo = (...args: any[]) => latestActions.current.reactTo(...args);
    const toggleStar = (...args: any[]) => latestActions.current.toggleStar(...args);
    const startLongPress = (...args: any[]) => latestActions.current.startLongPress(...args);
    const cancelLongPress = (...args: any[]) => latestActions.current.cancelLongPress(...args);
  const renderBody = (m: GroupMessage) => {
    if (m.deleted) return <span className="italic opacity-70">Mensagem apagada</span>;
    if (m.view_once && (m.message_type === 'image' || m.message_type === 'video')) {
      return (
        <ViewOnceMedia
          kind="group"
          messageId={m.id}
          type={m.message_type}
          mine={m.sender_id === user?.id}
          viewed={Boolean(m.viewed)}
          onOpened={() => setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, viewed: true } : x)))}
        />
      );
    }
    switch (m.message_type) {
      case 'gif':
        return m.media_url ? <img loading="lazy" decoding="async" src={m.media_url} alt="GIF" className="max-w-[240px] rounded-xl" /> : null;
      case 'sticker':
        return m.media_url ? <img loading="lazy" decoding="async" src={m.media_url} alt="Figurinha" className="max-w-[160px]" /> : null;
      case 'image':
        return m.media_url ? (
          <a href={m.media_url} target="_blank" rel="noopener noreferrer">
            <ThumbImg src={m.media_url} alt="Imagem" className="max-w-[240px] rounded-xl" />
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
      <>
        {term && shown.length === 0 && <p className="text-center text-xs text-on-surface-variant py-10">Nada encontrado.</p>}

        {shown.map((m, idx) => {
          const dayLabel = dateLabel(m.created_at);
          const prev = shown[idx - 1];
          const next = shown[idx + 1];
          const showDate = !prev || dateLabel(prev.created_at) !== dayLabel;
          const dateBadge = showDate ? (
            <div className="flex justify-center my-3 select-none">
              <span className="text-[11px] font-semibold text-on-surface-variant bg-surface-container-high/90 px-3.5 py-1 rounded-full shadow-xs border border-outline-variant">
                {dayLabel}
              </span>
            </div>
          ) : null;

          if (m.message_type === 'system') {
            return (
              <React.Fragment key={m.id}>
                {dateBadge}
                <div className="flex justify-center my-2">
                  <span className="text-[11px] text-on-surface-variant bg-surface-container-low px-3 py-1 rounded-full">{m.content}</span>
                </div>
              </React.Fragment>
            );
          }

          const mine = m.sender_id === user?.id;
          const sameAsPrev = !showDate && prev && prev.sender_id === m.sender_id && prev.message_type !== 'system';
          const nextShowsDate = next && dateLabel(next.created_at) !== dayLabel;
          const sameAsNext = next && !nextShowsDate && next.sender_id === m.sender_id && next.message_type !== 'system';
          const isFirstInBlock = !sameAsPrev;
          const isLastInBlock = !sameAsNext;
          const sender = m.sender_id ? roleOf.get(m.sender_id) : undefined;
          const bare = !m.deleted && !m.view_once && (BARE_TYPES.has(m.message_type) || isEmojiOnly(m));
          const starred = starredIds.has(m.id);
          const myReaction = (m.reactions || []).find((r) => r.user_id === user?.id)?.emoji;
          const menuItemsFor = (m: GroupMessage) => [
            { key: 'reply', label: 'Responder', icon: 'reply', onSelect: () => { setReplyingTo(m); inputRef.current?.focus(); }, hidden: m.deleted },
            { key: 'star', label: starredIds.has(m.id) ? 'Desfavoritar' : 'Favoritar', icon: 'star', onSelect: () => toggleStar(m), hidden: m.deleted },
            { key: 'edit', label: 'Editar', icon: 'edit', onSelect: () => handleStartEdit(m), hidden: m.deleted || !mine || m.message_type !== 'text' || !canEditMessage(m.created_at) },
            { key: 'copy', label: 'Copiar', icon: 'content_copy', onSelect: () => handleCopy(m), hidden: m.deleted || m.message_type !== 'text' },
            { key: 'delete', label: 'Apagar', icon: 'delete', danger: true, onSelect: () => void handleDelete(m), hidden: m.deleted || !(mine || isAdmin) },
          ];
          const visibleItems = menuItemsFor(m).filter((item) => !item.hidden);
          const kebabOpen = kebabId === m.id;
          const reactionChips = groupReactions(m.reactions, user?.id);

          return (
            <React.Fragment key={m.id}>
              {dateBadge}
              <div
                id={`msg-${m.id}`}
                className={`group relative flex items-end gap-2 max-w-xl ${isFirstInBlock ? 'mt-3' : 'mt-1'} ${
                  mine ? 'ml-auto justify-end' : 'mr-auto justify-start'
                } ${kebabOpen ? 'z-50' : 'z-10'}`}
              >
                {/* Foto de quem enviou, só na última mensagem do bloco */}
                {!mine &&
                  (isLastInBlock ? (
                    <div className="w-7 h-7 rounded-full bg-primary-container text-on-primary font-bold flex items-center justify-center text-xs flex-shrink-0 mb-1 uppercase overflow-hidden">
                      {sender?.avatar_url || m.sender_avatar ? (
                        <img loading="lazy" decoding="async" src={(sender?.avatar_url || m.sender_avatar) as string} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (m.sender_username || '?').charAt(0)
                      )}
                    </div>
                  ) : (
                    <div className="w-7 h-7 flex-shrink-0" />
                  ))}

                <div
                  className="relative flex flex-col max-w-[85%] sm:max-w-md select-text"
                  onTouchStart={() => startLongPress(m.id)}
                  onTouchEnd={cancelLongPress}
                  onTouchCancel={cancelLongPress}
                >
                  {!mine && isFirstInBlock && (
                    <span className="flex items-center gap-1.5 text-[11px] font-bold mb-0.5 ml-1" style={{ color: nameColor(m.sender_id) }}>
                      @{m.sender_username}
                      {sender?.role === 'admin' && <span className="text-[9px] px-1.5 rounded-full bg-primary/15 text-primary font-semibold">admin</span>}
                    </span>
                  )}

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
                      {!m.deleted && (
                        <div className="flex items-center justify-between gap-1 px-3 pb-2 mb-1 border-b border-outline-variant dark:border-zinc-800">
                          {REACTION_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              aria-label={`Reagir com ${emoji}`}
                              aria-pressed={myReaction === emoji}
                              onClick={() => {
                                reactTo(m, myReaction === emoji ? null : emoji);
                                setKebabId(null);
                              }}
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-lg transition-transform hover:scale-125 cursor-pointer ${
                                myReaction === emoji ? 'bg-primary/20' : ''
                              }`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
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

                  {/* Balão: mesmo formato do chat privado */}
                  <div
                    className={`p-3 text-xs leading-relaxed shadow-xs transition-all ${bare ? '!bg-transparent !shadow-none !p-0 !border-0 ' : ''}${
                      mine
                        ? `bg-primary-container text-on-primary rounded-2xl ${isFirstInBlock ? 'rounded-tr-2xl' : 'rounded-tr-md'} ${
                            isLastInBlock ? 'rounded-br-xs' : 'rounded-br-md'
                          } rounded-l-2xl`
                        : `bg-surface-container-low text-on-surface rounded-2xl border border-outline-variant ${
                            isFirstInBlock ? 'rounded-tl-2xl' : 'rounded-tl-md'
                          } ${isLastInBlock ? 'rounded-bl-xs' : 'rounded-bl-md'} rounded-r-2xl`
                    }`}
                  >
                    {m.reply_to_id && !m.deleted && (
                      <div
                        onClick={() => document.getElementById(`msg-${m.reply_to_id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                        className={`mb-2 p-2 rounded-xl text-left border-l-2 text-xs cursor-pointer transition-opacity hover:opacity-90 ${
                          mine ? 'bg-black/20 border-on-primary/70 text-on-primary' : 'bg-surface-container border-primary text-on-surface'
                        }`}
                      >
                        <span className="font-bold text-[11px] block truncate">@{m.reply_sender || 'usuário'}</span>
                        <span className="text-[11px] opacity-80 block truncate">{m.reply_content ?? 'Mensagem apagada'}</span>
                      </div>
                    )}
                    {renderBody(m)}
                  </div>

                  {reactionChips.length > 0 && (
                    <div className={`flex flex-wrap gap-1 -mt-1.5 ${mine ? 'justify-end mr-2' : 'ml-2'}`}>
                      {reactionChips.map((chip) => (
                        <button
                          key={chip.emoji}
                          type="button"
                          onClick={() => reactTo(m, chip.mine ? null : chip.emoji)}
                          title={chip.mine ? 'Remover sua reação' : 'Reagir igual'}
                          className={`h-6 px-1.5 rounded-full text-xs flex items-center gap-1 border shadow-xs cursor-pointer transition-colors ${
                            chip.mine ? 'bg-primary/15 border-primary/40' : 'bg-surface-container-high border-outline-variant/40 hover:bg-surface-container-highest'
                          }`}
                        >
                          <span>{chip.emoji}</span>
                          {chip.count > 1 && <span className="text-[10px] font-semibold text-on-surface-variant">{chip.count}</span>}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className={`text-[10px] text-on-surface-variant mt-0.5 flex items-center gap-1 ${mine ? 'justify-end mr-1' : 'ml-1'}`}>
                    {starred && (
                      <span className="material-symbols-outlined text-[12px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }} title="Favorita">
                        star
                      </span>
                    )}
                    {m.expires_at && <span className="material-symbols-outlined text-[12px]" title="Mensagem temporária">timer</span>}
                    <span>{new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    {m.edited_at && !m.deleted && <span>· editada</span>}
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </>
    );
  }, [detail, messages, searchTerm, kebabId, starredIds, user?.id]);

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
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              setSearchOpen((open) => !open);
              setSearchTerm('');
            }}
            title="Pesquisar na conversa"
            aria-label="Pesquisar na conversa"
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              searchOpen ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">search</span>
          </button>
          <ChatMenu
            title="Opções do grupo"
            buttonClassName="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
            items={[
              { key: 'manage', label: 'Dados do grupo', icon: 'info', onSelect: () => setShowManage(true) },
              { key: 'search', label: 'Pesquisar na conversa', icon: 'search', onSelect: () => setSearchOpen(true) },
              { key: 'share', label: 'Compartilhar grupo', icon: 'share', onSelect: () => setModal('share'), hidden: !isAdmin && !detail.group.members_can_invite },
              { key: 'library', label: 'Mídias, links e docs', icon: 'perm_media', onSelect: () => setModal('library') },
              { key: 'starred', label: 'Mensagens favoritas', icon: 'star', onSelect: () => setModal('starred') },
              {
                key: 'disappear',
                label: `Mensagens temporárias · ${disappearLabel(detail.group.disappear_seconds)}`,
                icon: 'timer',
                onSelect: () => setModal('disappear'),
                hidden: !isAdmin,
              },
              { key: 'permissions', label: 'Permissões do grupo', icon: 'admin_panel_settings', onSelect: () => setModal('permissions'), hidden: !isAdmin },
              { key: 'export', label: exporting ? 'Exportando...' : 'Exportar conversa', icon: 'download', onSelect: () => void exportConversation() },
              { key: 'leave', label: 'Sair do grupo', icon: 'logout', danger: true, onSelect: leave },
            ]}
          />
        </div>
      </div>

      {searchOpen && (
        <div className="px-3 sm:px-6 py-2 bg-surface-container-lowest border-b border-outline-variant flex items-center gap-2 flex-shrink-0">
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">search</span>
          <input
            autoFocus
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar nas mensagens carregadas..."
            className="flex-1 h-8 bg-transparent text-xs text-on-surface placeholder:text-on-surface-variant outline-none"
          />
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setSearchOpen(false);
            }}
            aria-label="Fechar busca"
            className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

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

        {listNodes}
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
            <EmojiPicker
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
            <button
              type="button"
              onClick={() => setViewOnceNext((v) => !v)}
              className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer shrink-0 ${
                viewOnceNext ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'
              }`}
              title={viewOnceNext ? 'A próxima foto ou vídeo será temporário (toque para desligar)' : 'Enviar a próxima foto ou vídeo como temporário'}
              aria-pressed={viewOnceNext}
              aria-label="Foto temporária"
            >
              <span className="material-symbols-outlined text-[20px]">timer</span>
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

      {modal === 'library' && <ChatLibraryModal onClose={() => setModal(null)} scope={{ kind: 'group', id: groupId, name: detail.group.name }} />}
      {modal === 'starred' && <StarredModal onClose={() => setModal(null)} onOpenDirect={(_id, username) => navigate(`/mensagens?u=${encodeURIComponent(username)}`)} />}
      {modal === 'disappear' && <DisappearingModal current={detail.group.disappear_seconds} onSave={saveDisappear} onClose={() => setModal(null)} />}
      {modal === 'share' && <ShareGroupModal groupId={groupId} groupName={detail.group.name} isAdmin={isAdmin} onClose={() => setModal(null)} />}
      {modal === 'permissions' && (
        <GroupPermissionsModal
          groupId={groupId}
          group={detail.group}
          onClose={() => setModal(null)}
          onChanged={() => {
            void loadDetail();
          }}
        />
      )}

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
  const canEditInfo = isAdmin || detail.group.members_can_edit_info;
  const canAdd = isAdmin || detail.group.members_can_add;
  const [name, setName] = useState(detail.group.name);
  const [description, setDescription] = useState(detail.group.description || '');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canAdd) return;
    friendsApi
      .list()
      .then((list) => {
        const inGroup = new Set(detail.members.map((m) => m.id));
        setFriends(list.filter((f: any) => !inGroup.has(f.friend_id)).map((f: any) => ({ ...f, friend_id: f.friend_id })));
      })
      .catch(() => {});
  }, [canAdd, detail.members]);

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
      {canEditInfo && (
        <section className="mb-5 space-y-3">
          <label className="block text-xs font-semibold">
            Nome
            <input value={name} maxLength={50} onChange={(e) => setName(e.target.value)} className="mt-1 w-full h-9 px-3 rounded-xl bg-surface-container-low text-xs outline-none" />
          </label>
          <label className="block text-xs font-semibold">
            Descrição
            <textarea value={description} maxLength={300} rows={2} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full p-3 rounded-xl bg-surface-container-low text-xs outline-none resize-none" />
          </label>
          <button type="button" onClick={() => run({ action: 'update', name, description })} className="px-4 py-2 rounded-full text-xs font-semibold bg-primary-container text-on-primary">
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

      {canAdd && friends.length > 0 && (
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
