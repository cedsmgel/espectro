import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { useSidebar } from '../context/SidebarContext';
import {
  authStorage,
  friendsApi,
  Friend,
  uploadApi,
  conversationsApi,
  Conversation,
  conversationSettingsApi,
  ConversationSettings,
  GroupSummary,
  groupsApi,
  directMessagesApi,
  blocksApi,
  chatExtrasApi,
  DirectMessage,
} from '../lib/api';
import { ChatPrefsModal } from '../components/chat/ChatPrefsModal';
import { ConversationCustomizer } from '../components/chat/ConversationCustomizer';
import { PeopleSearchResults } from '../components/chat/PeopleSearchResults';
import { MessageSearchResults } from '../components/chat/MessageSearchResults';
import { canEditMessage } from '../lib/chatEdit';
import { ReportModal } from '../components/chat/ReportModal';
import { useChatPrefs } from '../hooks/useChatPrefs';
import { usePush } from '../hooks/usePush';
import { GroupChatPanel } from './GroupChat';
import { AudioMessage } from '../components/chat/AudioMessage';
import { useIsPhone } from '../hooks/useIsPhone';
import { lastSeenLabel, useFriendPresence } from '../hooks/usePresence';
import { themeColor, wallpaperStyle } from '../lib/chatThemes';
import { REACTION_EMOJIS, groupReactions } from '../lib/chatReactions';
import { useTheme } from '../context/ThemeContext';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { VoiceRecordingBar } from '../components/chat/VoiceRecordingBar';
import { useTypingHeartbeat } from '../hooks/useTypingHeartbeat';
import { scrollToEnd } from '../lib/scrollToEnd';
import { TypingBubble, activityLabel } from '../components/chat/TypingBubble';
import { ChatMenu } from '../components/chat/ChatMenu';
import { CreateGroupModal } from '../components/chat/CreateGroupModal';
import { MediaPicker } from '../components/chat/MediaPicker';
import { notifyUnreadChanged } from '../hooks/useUnreadDms';
import { EmptyState } from '../components/EmptyState';
import { useChat, ChatMessage, ChatMessageType } from '../hooks/useChat';
import { useVisualViewport } from '../hooks/useVisualViewport';
import { ChatLibraryModal } from '../components/chat/ChatLibraryModal';
import { StarredModal } from '../components/chat/StarredModal';
import { DisappearingModal, disappearLabel } from '../components/chat/DisappearingModal';
import { InviteJoinModal } from '../components/chat/GroupModals';
import { ViewOnceMedia } from '../components/chat/ViewOnceMedia';
import { ThumbImg } from '../components/ThumbImg';
import { describeMessage, downloadConversation } from '../lib/exportChat';

// Emojis populares pré-selecionados para o seletor rápido
const QUICK_EMOJIS = [
  '😀', '😂', '🥰', '😎', '🤩', '🥳', '🤔', '🤫', '😴', '😷',
  '🔥', '✨', '💜', '❤️', '💯', '🚀', '⭐', '⚡', '🎉', '👏',
  '👍', '👎', '✌️', '🙌', '🤝', '🐱', '🐶', '🍕', '🎮', '🎧',
];

// GIFs de backup pré-configurados caso a API do Giphy esteja sem rede/chave
const FALLBACK_GIFS = [
  { id: '1', title: 'Hello Retro', url: 'https://media.giphy.com/media/3o7TKMt1VVNkHV2PaE/giphy.gif' },
  { id: '2', title: 'Celebration Dance', url: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif' },
  { id: '3', title: 'Cat Vibe', url: 'https://media.giphy.com/media/jpbnoe3UIa8TU8LM13/giphy.gif' },
  { id: '4', title: 'Mind Blown', url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif' },
  { id: '5', title: 'Thumbs Up Cool', url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif' },
  { id: '6', title: 'Retro Synthwave', url: 'https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.gif' },
  { id: '7', title: 'Party Time', url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif' },
  { id: '8', title: 'Love React', url: 'https://media.giphy.com/media/26FLdm964upN2ZYPA/giphy.gif' },
];

// Helper para obter a duração do vídeo no navegador antes do upload
const getVideoDuration = (file: File): Promise<number> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(file);
    video.src = url;

    const timer = setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(0); // Em caso de timeout/codec não suportado, não trava o usuário
    }, 4000);

    video.onloadedmetadata = () => {
      clearTimeout(timer);
      const duration = video.duration || 0;
      URL.revokeObjectURL(url);
      resolve(duration);
    };

    video.onerror = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(0);
    };
  });
};

// Formatação amigável de datas para separadores de chat (Hoje, Ontem, 12 de Outubro) - Tarefa 2
const formatMessageDateSeparator = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isToday) return 'Hoje';
  if (isYesterday) return 'Ontem';

  const isSameYear = date.getFullYear() === now.getFullYear();
  if (isSameYear) {
    return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
  }
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
};

const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|\s){1,12}$/u;

const isBareMessage = (m: ChatMessage): boolean => {
  const type = m.message_type || 'text';
  if (m.media_url && ['image', 'video', 'gif', 'sticker'].includes(type)) return true;
  return !m.media_url && type === 'text' && EMOJI_ONLY.test(m.content || '');
};

export const DirectMessages: React.FC = () => {
  const navigate = useNavigate();
  const { isExpanded, setHideBottomNav } = useSidebar();
  const { id: groupParam } = useParams<{ id: string }>();
  const activeGroupId = groupParam ? Number(groupParam) : null;
  const user = authStorage.getUser();
  const userId = user?.id;

  const [friends, setFriends] = useState<Friend[]>([]);
  const [activeFriend, setActiveFriend] = useState<Friend | null>(null);
  const [searchConv, setSearchConv] = useState('');
  const [inputText, setInputText] = useState('');
  const [loadingFriends, setLoadingFriends] = useState(true);

  // Estados de ações de mensagem (Responder, Encaminhar, Dados, Toast) - Tarefa 3
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [forwardModalMessage, setForwardModalMessage] = useState<ChatMessage | null>(null);
  const { height: viewportHeight, isMobile, isKeyboardOpen } = useVisualViewport();
  const isPhone = useIsPhone();
  const { isDark: isDarkTheme } = useTheme();
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 60000);
    return () => window.clearInterval(t);
  }, []);

  // Rolagem automática quando o teclado virtual abre no mobile
  useEffect(() => {
    if (isKeyboardOpen && activeFriend) {
      const timer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isKeyboardOpen, activeFriend]);
  const [forwardSearchQuery, setForwardSearchQuery] = useState('');
  const [infoModalMessage, setInfoModalMessage] = useState<ChatMessage | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Estado para o Menu Kebab (três pontinhos) com overlay de foco
  const [activeKebabMessage, setActiveKebabMessage] = useState<ChatMessage | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = (m: ChatMessage) => {
    longPressTimerRef.current = setTimeout(() => {
      setActiveKebabMessage(m);
    }, 450);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Fecha o menu de foco ao pressionar Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveKebabMessage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-limpeza do toast
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  // Conversas: última mensagem e não lidas vêm do servidor (D1)
  const [conversations, setConversations] = useState<Record<number, Conversation>>({});
  const [showPrefs, setShowPrefs] = useState(false);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ messageId: number | null } | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [convSearchOpen, setConvSearchOpen] = useState(false);
  const [convSearch, setConvSearch] = useState('');
  const [activeSettings, setActiveSettings] = useState<ConversationSettings | null>(null);
  const [extraModal, setExtraModal] = useState<null | 'library' | 'starred' | 'disappear'>(null);
  const [disappearSeconds, setDisappearSeconds] = useState(0);
  const [starredIds, setStarredIds] = useState<Set<number>>(new Set());
  const [openedOnce, setOpenedOnce] = useState<Set<number>>(new Set());
  const viewOnceNextRef = useRef(false);
  const [inviteCode] = useState<string | null>(() => {
    try {
      const code = new URLSearchParams(window.location.search).get('convite');
      return code && /^[a-f0-9]{16}$/.test(code) ? code : null;
    } catch {
      return null;
    }
  });
  const [showInvite, setShowInvite] = useState(Boolean(inviteCode));
  const { prefs, update: updatePrefs } = useChatPrefs();
  const push = usePush();
  const presence = useFriendPresence(activeFriend?.friend_id);

  useEffect(() => {
    const friendId = activeFriend?.friend_id;
    setDisappearSeconds(0);
    if (!friendId) return;
    chatExtrasApi.dmDisappear(friendId).then((r) => setDisappearSeconds(r.disappear_seconds)).catch(() => {});
    chatExtrasApi
      .starred()
      .then((list) => setStarredIds(new Set(list.filter((i) => i.kind === 'dm' && i.chat_id === friendId).map((i) => i.message_id))))
      .catch(() => {});
  }, [activeFriend?.friend_id, extraModal === 'starred']);

  useEffect(() => {
    if (push.error) setToastMessage(push.error);
  }, [push.error]);

  const refreshConversations = useCallback(async () => {
    if (!userId) return;
    try {
      groupsApi.list().then(setGroups).catch(() => {});
      const list = await conversationsApi.list();
      setConversations(Object.fromEntries(list.map((c) => [c.friend_id, c])));
    } catch {}
  }, [userId]);

  useEffect(() => {
    refreshConversations();
    const timer = window.setInterval(refreshConversations, 15000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshConversations();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshConversations]);

  useEffect(() => {
    setConvSearch('');
    setConvSearchOpen(false);
    setActiveSettings(null);
    if (!activeFriend) return;
    let cancelled = false;
    conversationSettingsApi
      .get(activeFriend.friend_id)
      .then((settings) => {
        if (!cancelled) setActiveSettings(settings);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeFriend?.friend_id]);

  // Hook customizado: histórico via HTTP (D1) e tempo real via Durable Objects
  const {
    messages,
    sendMessage,
    sendMediaMessage,
    deleteMessage,
    editMessage,
    sendTyping,
    isOtherUserTyping,
    otherUserActivity,
    connectionStatus,
    loadingHistory,
    reconnect,
    markAsRead,
    retrySend,
    reactToMessage,
    loadOlder,
    hasMore,
    loadingOlder,
    reloadHistory,
  } = useChat({
    activeFriendId: activeFriend?.friend_id,
    activeFriendUsername: activeFriend?.username,
    onActivity: refreshConversations,
  });

  // Marca como lido quando o usuário foca na janela/aba
  useEffect(() => {
    const onFocus = () => {
      markAsRead();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [markAsRead]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Referências para inputs de arquivos ocultos e popovers
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const abortUploadControllerRef = useRef<AbortController | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Estados de Menus e Popovers
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const voice = useVoiceRecorder();
  // Enquanto grava um áudio, avisa a outra pessoa a cada 2 segundos
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

  // Fechar popover de emoji ao clicar fora
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest('[title="Inserir Emojis"]')
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  // Estados de Upload com Progresso Real
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Modal Amigável para Avisos de Limite de Arquivo / Vídeo
  const [fileLimitWarning, setFileLimitWarning] = useState<{
    title: string;
    message: string;
    details?: string;
  } | null>(null);

  // Auto-limpeza da mensagem de erro após 10 segundos
  useEffect(() => {
    if (!uploadError) return;
    const timer = setTimeout(() => {
      setUploadError(null);
    }, 10000);
    return () => clearTimeout(timer);
  }, [uploadError]);

  // Estados do Giphy
  const [gifSearchQuery, setGifSearchQuery] = useState('');
  const [gifResults, setGifResults] = useState<Array<{ id: string; url: string; title: string; preview?: string }>>(FALLBACK_GIFS);
  const [loadingGifs, setLoadingGifs] = useState(false);

  // Visualizador de Imagem Ampliada (Lightbox)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);


  // Auto-scroll para a mensagem mais recente
  useEffect(() => {
    if (!activeKebabMessage) return;
    const timer = window.setTimeout(() => {
      document.querySelector('[data-kebab-menu]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [activeKebabMessage]);

  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const lastMessageKey = lastMessage ? lastMessage.client_id || String(lastMessage.id) : '';
  const searchTerm = convSearch.trim().toLowerCase();
  const visibleMessages = searchTerm
    ? messages.filter((m) => (m.content || '').toLowerCase().includes(searchTerm))
    : messages;
  const myBubbleColor = themeColor(activeSettings?.theme);
  useEffect(() => {
    scrollToEnd(messagesEndRef.current);
  }, [lastMessageKey, isOtherUserTyping]);

  // Controle de visibilidade da BottomNav no chat mobile (tela cheia)
  useEffect(() => {
    if ((activeFriend || activeGroupId) && window.innerWidth < 768) {
      setHideBottomNav(true);
    } else {
      setHideBottomNav(false);
    }

    return () => {
      setHideBottomNav(false);
    };
  }, [activeFriend, activeGroupId, setHideBottomNav]);

  // Carrega amigos reais do D1
  const loadFriends = async () => {
    if (!userId) {
      setLoadingFriends(false);
      return;
    }
    setLoadingFriends(true);
    try {
      const data = await friendsApi.list();
      if (data && data.length > 0) {
        setFriends(data);
        const searchParams = new URLSearchParams(window.location.search);
        const targetUsername = searchParams.get('u');
        const found = targetUsername
          ? data.find((f: any) => f.username.toLowerCase() === targetUsername.toLowerCase())
          : null;

        if (found) {
          setActiveFriend(found);
        } else if (window.innerWidth >= 768 && !window.location.pathname.startsWith('/grupos/')) {
          setActiveFriend(data[0]);
        } else {
          setActiveFriend(null);
        }
      } else {
        setFriends([]);
        setActiveFriend(null);
      }
    } catch (err) {
      console.error('Erro ao carregar amigos:', err);
      setFriends([]);
    } finally {
      setLoadingFriends(false);
    }
  };

  useEffect(() => {
    loadFriends();
  }, [userId]);

  // Digitação do usuário com debounce para avisar que parou de digitar
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
  };
  // O indicador fica ligado enquanto houver texto na caixa, mesmo sem digitar
  useTypingHeartbeat(!!inputText.trim() && !editingMessage, (typing) => sendTyping(typing));

  // Envio de mensagem de texto normal pelo WebSocket (com suporte a resposta - Tarefa 4)
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeFriend || !user) return;

    const content = inputText.trim();

    if (editingMessage?.id) {
      const editedId = editingMessage.id;
      setEditingMessage(null);
      setInputText('');
      void editMessage(editedId, content);
      return;
    }

    const replyToId = replyingTo?.id || null;
    setInputText('');
    setReplyingTo(null);

    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
    }
    sendTyping(false);

    sendMessage({ text: content, type: 'text', reply_to_id: replyToId });
    inputRef.current?.focus();
  };

  // Inserir Emoji no campo de texto (adiciona ao final sem substituir o que já foi digitado - Tarefa 5)
  const handleSelectEmoji = (emoji: any) => {
    const char = emoji?.native || (typeof emoji === 'string' ? emoji : '');
    if (!char) return;

    setInputText((prev) => prev + char);

    // Salva os recentes no localStorage para persistência ao recarregar a página (Tarefa 3)
    try {
      const stored = JSON.parse(localStorage.getItem('espectro_recent_emojis') || '[]');
      const updated = [char, ...stored.filter((e: string) => e !== char)].slice(0, 32);
      localStorage.setItem('espectro_recent_emojis', JSON.stringify(updated));
    } catch {}

    inputRef.current?.focus();
  };

  // Upload de arquivo com validações de tamanho (máx 10MB) e duração de vídeo (máx 1min)
  const handleUploadFile = async (file: File, forcedType?: 'image' | 'video' | 'file') => {
    if (!file || !activeFriend || !user) return;

    setShowAttachMenu(false);
    setUploadError(null);

    // 1. Limite de tamanho: máximo 10MB por arquivo no chat
    const MAX_CHAT_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_CHAT_FILE_SIZE && !file.type.startsWith('image/')) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      const friendlyMsg = `O arquivo "${file.name}" possui ${sizeMB} MB. O limite máximo permitido para envio no chat é de 10 MB por arquivo.`;

      setUploadError(friendlyMsg);
      setFileLimitWarning({
        title: 'Arquivo muito grande (Limite: 10 MB)',
        message: `O arquivo "${file.name}" tem ${sizeMB} MB e ultrapassa o limite de envio.`,
        details: 'Para manter o chat ágil e veloz para todos os usuários, o tamanho máximo permitido por arquivo é de 10 MB. Por favor, envie um arquivo menor.',
      });

      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (docInputRef.current) docInputRef.current.value = '';
      return;
    }

    // 2. Limite de duração para vídeos: máximo 1 minuto (60 segundos)
    const isVideo =
      forcedType === 'video' ||
      file.type.startsWith('video/') ||
      /\.(mp4|webm|mov|ogg|m4v|mkv)$/i.test(file.name);

    if (isVideo) {
      try {
        const duration = await getVideoDuration(file);
        // Tolerância de 1 segundo para codecs com imprecisão de timestamp
        if (duration > 61) {
          const totalSec = Math.round(duration);
          const min = Math.floor(totalSec / 60);
          const sec = totalSec % 60;
          const durationStr = min > 0 ? `${min} min ${sec > 0 ? `${sec} s` : ''}` : `${totalSec} segundos`;
          const friendlyMsg = `O vídeo "${file.name}" possui ${durationStr} de duração. No chat, são permitidos vídeos de no máximo 1 minuto (60 segundos).`;

          setUploadError(friendlyMsg);
          setFileLimitWarning({
            title: 'Vídeo muito longo (Limite: 1 minuto)',
            message: `O vídeo selecionado tem ${durationStr} de duração.`,
            details: 'Para garantir reprodução instantânea sem travamentos nas conversas, vídeos no chat são limitados a no máximo 1 minuto (60 segundos). Por favor, recorte o vídeo ou selecione um arquivo mais curto.',
          });

          if (fileInputRef.current) fileInputRef.current.value = '';
          if (cameraInputRef.current) cameraInputRef.current.value = '';
          if (docInputRef.current) docInputRef.current.value = '';
          return;
        }
      } catch (err) {
        console.warn('Não foi possível verificar a duração do vídeo antecipadamente:', err);
      }
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadFileName(file.name);

    const controller = new AbortController();
    abortUploadControllerRef.current = controller;

    try {
      const res = await uploadApi.upload(file, {
        signal: controller.signal,
        context: 'chat',
        onProgress: (pct) => {
          setUploadProgress(pct);
        },
      });

      // Determina o tipo de mensagem: image, video ou file
      let msgType: 'image' | 'video' | 'file' = 'file';
      if (file.type.startsWith('image/')) msgType = 'image';
      else if (isVideo) msgType = 'video';
      else msgType = 'file';

      // Envia apenas o payload de mídia exigido pelo WebSocket (com suporte a resposta - Tarefa 4):
      sendMediaMessage({
        media_url: res.url,
        message_type: msgType,
        filename: file.name,
        reply_to_id: replyingTo?.id || null,
        view_once: viewOnceNextRef.current && (msgType === 'image' || msgType === 'video') ? true : undefined,
      });
      viewOnceNextRef.current = false;
      setReplyingTo(null);
    } catch (err: any) {
      if (err.message?.includes('cancelado')) {
        setUploadError('Upload cancelado.');
      } else {
        setUploadError(err.message || 'Falha ao enviar arquivo.');
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      abortUploadControllerRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };

  const handleCancelUpload = () => {
    if (abortUploadControllerRef.current) {
      abortUploadControllerRef.current.abort();
      abortUploadControllerRef.current = null;
    }
    setIsUploading(false);
    setUploadProgress(0);
    setUploadError('Upload cancelado pelo usuário.');
  };

  // Ações de Mensagens (Hover Menu - Tarefa 3)
  // Editar: o texto volta para o campo de envio e o próximo envio troca a mensagem
  const handleStartEdit = (m: ChatMessage) => {
    if (!m.id || m.id < 0) return;
    setReplyingTo(null);
    setEditingMessage(m);
    setInputText(m.content);
    inputRef.current?.focus();
  };

  const handleStartReply = (m: ChatMessage) => {
    if (!m.id || m.id < 0) return;
    setReplyingTo(m);
    inputRef.current?.focus();
  };

  const toggleStar = (m: ChatMessage) => {
    if (!m.id || m.id <= 0) return;
    const starred = !starredIds.has(m.id);
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (starred) next.add(m.id!);
      else next.delete(m.id!);
      return next;
    });
    chatExtrasApi.setStarred('dm', m.id, starred).catch(() => setToastMessage('Não foi possível favoritar.'));
  };

  const saveDisappear = async (seconds: number) => {
    if (!activeFriend) return;
    try {
      await chatExtrasApi.setDmDisappear(activeFriend.friend_id, seconds);
      setDisappearSeconds(seconds);
    } catch (err: any) {
      setToastMessage(err?.message || 'Não foi possível salvar.');
      throw err;
    }
  };

  const exportConversation = async () => {
    if (!activeFriend || !user) return;
    try {
      let all: DirectMessage[] = [];
      let before: number | undefined;
      for (let page = 0; page < 200; page++) {
        const res = await directMessagesApi.list(activeFriend.friend_id, { beforeId: before, limit: 100 });
        all = [...res.messages, ...all];
        if (!res.has_more || res.messages.length === 0) break;
        before = res.messages[0].id;
      }
      downloadConversation(
        `@${activeFriend.username}`,
        all.map((m) => ({
          created_at: m.created_at,
          sender: `@${m.sender_username}`,
          text: describeMessage(m.message_type, m.content, m.media_url, m.view_once),
        }))
      );
    } catch {
      setToastMessage('Não foi possível exportar a conversa.');
    }
  };

  const handleCopyMessage = async (m: ChatMessage) => {
    const textToCopy = m.content || m.media_url || '';
    try {
      await navigator.clipboard.writeText(textToCopy);
      setToastMessage('Mensagem copiada para a área de transferência!');
    } catch {
      setToastMessage('Não foi possível copiar o texto.');
    }
  };

  const handleDeleteMessage = (messageId: number) => {
    if (window.confirm('Deseja excluir esta mensagem para todos na conversa?')) {
      deleteMessage(messageId);
      setToastMessage('Mensagem excluída com sucesso.');
    }
  };

  const handleForwardToFriend = (targetFriend: Friend) => {
    if (!forwardModalMessage) return;

    if (activeFriend?.friend_id === targetFriend.friend_id) {
      if (forwardModalMessage.media_url) {
        sendMediaMessage({
          media_url: forwardModalMessage.media_url,
          message_type: (forwardModalMessage.message_type as any) || 'image',
          filename: forwardModalMessage.content,
        });
      } else {
        sendMessage({
          text: forwardModalMessage.content,
          type: 'text',
        });
      }
    } else {
      setActiveFriend(targetFriend);
      setTimeout(() => {
        if (forwardModalMessage.media_url) {
          sendMediaMessage({
            media_url: forwardModalMessage.media_url,
            message_type: (forwardModalMessage.message_type as any) || 'image',
            filename: forwardModalMessage.content,
          });
        } else {
          sendMessage({
            text: forwardModalMessage.content,
            type: 'text',
          });
        }
      }, 400);
    }

    setForwardModalMessage(null);
    setToastMessage(`Mensagem encaminhada para @${targetFriend.username}!`);
  };

  // Enviar Localização Geográfica Atual
  const handleSendLocation = () => {
    setShowAttachMenu(false);
    if (!navigator.geolocation) {
      alert('Geolocalização não é suportada pelo seu navegador.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
        sendMessage({
          type: 'location',
          media_url: mapUrl,
          text: `Localização: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        });
      },
      (err) => {
        alert(`Não foi possível obter sua localização: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSelectMedia = (choice: { type: "gif" | "sticker"; url: string }) => {
    if (choice.type === "gif") {
      handleSelectGif(choice.url);
      return;
    }
    sendMessage({ type: "sticker", media_url: choice.url, text: "Figurinha" });
    setShowGifPicker(false);
  };

  const handleSelectGif = (gifUrl: string) => {
    sendMessage({
      type: 'gif',
      media_url: gifUrl,
      text: 'GIF',
    });
    setShowGifPicker(false);
    setGifSearchQuery('');
  };

  // Abre a conversa com alguém que já é amigo mas ainda não estava na lista
  const handleOpenChatWithPerson = (person: { id: number; username: string }) => {
    const friend: Friend = { friend_id: person.id, username: person.username, status: 'accepted' };
    setFriends((prev) => (prev.some((f) => f.friend_id === person.id) ? prev : [friend, ...prev]));
    setActiveFriend(friend);
    setSearchConv('');
  };

  const handleMarkAllRead = async () => {
    try {
      await directMessagesApi.markAllRead();
      refreshConversations();
      notifyUnreadChanged();
      setToastMessage('Todas as conversas foram marcadas como lidas.');
    } catch {
      setToastMessage('Não foi possível marcar como lidas.');
    }
  };

  const handleToggleMute = async () => {
    if (!activeFriend) return;
    const next = !(activeSettings?.muted ?? false);
    try {
      const saved = await conversationSettingsApi.update(activeFriend.friend_id, { muted: next });
      setActiveSettings(saved);
      refreshConversations();
      setToastMessage(next ? 'Conversa silenciada.' : 'Notificações reativadas.');
    } catch {
      setToastMessage('Não foi possível alterar as notificações.');
    }
  };

  const handleClearConversation = async () => {
    if (!activeFriend) return;
    if (!window.confirm('Limpar esta conversa apenas para você? A outra pessoa continua vendo as mensagens.')) return;
    try {
      const saved = await conversationSettingsApi.update(activeFriend.friend_id, { clear: true });
      setActiveSettings(saved);
      refreshConversations();
      notifyUnreadChanged();
      reloadHistory();
      setToastMessage('Conversa limpa.');
    } catch {
      setToastMessage('Não foi possível limpar a conversa.');
    }
  };

  const toggleListFlag = async (c: Friend, flag: 'pinned' | 'muted' | 'manual_unread') => {
    const current = conversations[c.friend_id];
    const value =
      flag === 'pinned' ? !current?.pinned : flag === 'muted' ? !current?.muted : !current?.manual_unread;
    try {
      await conversationSettingsApi.update(c.friend_id, { [flag]: value } as any);
      if (flag === 'manual_unread') notifyUnreadChanged();
      refreshConversations();
    } catch {
      setToastMessage('Não foi possível atualizar a conversa.');
    }
  };

  const deleteListConversation = async (c: Friend) => {
    if (!window.confirm(`Excluir a conversa com @${c.username} apenas para você? A outra pessoa continua vendo as mensagens.`)) {
      return;
    }
    try {
      await conversationSettingsApi.update(c.friend_id, { clear: true });
      if (activeFriend?.friend_id === c.friend_id) setActiveFriend(null);
      refreshConversations();
      notifyUnreadChanged();
      setToastMessage('Conversa excluída para você.');
    } catch {
      setToastMessage('Não foi possível excluir a conversa.');
    }
  };

  const toggleArchive = async (c: Friend) => {
    const archived = !conversations[c.friend_id]?.archived;
    try {
      await conversationSettingsApi.update(c.friend_id, { archived } as any);
      refreshConversations();
      setToastMessage(archived ? 'Conversa arquivada.' : 'Conversa desarquivada.');
    } catch {
      setToastMessage('Não foi possível arquivar a conversa.');
    }
  };

  const handleSendVoice = async () => {
    const blob = await voice.stop();
    if (!activeFriend) return;
    if (!blob) {
      setUploadError('Não foi possível capturar o áudio gravado.');
      return;
    }
    try {
      const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
      const file = new File([blob], `voz-${Date.now()}.${ext}`, { type: blob.type || 'audio/webm' });
      const res = await uploadApi.upload(file, { context: 'audio' });
      sendMediaMessage({ media_url: res.url, message_type: 'audio', filename: 'Mensagem de voz' });
    } catch (err: any) {
      console.error('Falha ao enviar áudio:', err);
      setUploadError(err?.message || 'Não foi possível enviar o áudio. Tente de novo.');
    }
  };

  const handleStartVoice = async () => {
    const error = await voice.start();
    if (error) setUploadError(error);
  };

  const handleBlockUser = async () => {
    if (!activeFriend) return;
    if (
      !window.confirm(
        `Bloquear @${activeFriend.username}? Vocês deixam de ser amigos e nenhum dos dois consegue enviar mensagens ou pedidos. Você pode desbloquear depois.`
      )
    ) {
      return;
    }
    try {
      await blocksApi.block(activeFriend.friend_id);
      setFriends((prev) => prev.filter((f) => f.friend_id !== activeFriend.friend_id));
      setActiveFriend(null);
      refreshConversations();
      setToastMessage(`@${activeFriend.username} foi bloqueado.`);
    } catch {
      setToastMessage('Não foi possível bloquear.');
    }
  };

  const handleRemoveFriend = async () => {
    if (!activeFriend) return;
    if (!window.confirm(`Remover @${activeFriend.username} dos seus amigos? Vocês não poderão mais trocar mensagens.`)) return;
    try {
      await friendsApi.remove(activeFriend.friend_id);
      setFriends((prev) => prev.filter((f) => f.friend_id !== activeFriend.friend_id));
      setActiveFriend(null);
      refreshConversations();
      setToastMessage('Amizade removida.');
    } catch {
      setToastMessage('Não foi possível remover a amizade.');
    }
  };

  const filteredConversations = friends
    .filter((c) => {
      const nickname = conversations[c.friend_id]?.nickname || '';
      const term = searchConv.trim().toLowerCase();
      return !term || c.username.toLowerCase().includes(term) || nickname.toLowerCase().includes(term);
    })
    .filter((c) => !!conversations[c.friend_id]?.archived === showArchived)
    .filter((c) => !unreadOnly || (conversations[c.friend_id]?.unread_count ?? 0) > 0)
    .sort((a, b) => {
      const pa = conversations[a.friend_id]?.pinned ? 1 : 0;
      const pb = conversations[b.friend_id]?.pinned ? 1 : 0;
      if (pa !== pb) return pb - pa;
      const ca = conversations[a.friend_id]?.last_message_id ?? 0;
      const cb = conversations[b.friend_id]?.last_message_id ?? 0;
      if (ca !== cb) return cb - ca;
      return a.username.localeCompare(b.username);
    });

  // Grupos entram na lista como qualquer conversa: ordem pela última atividade, sem fixar no topo
  const visibleGroups = showArchived
    ? []
    : groups.filter((g) => !searchConv.trim() || g.name.toLowerCase().includes(searchConv.trim().toLowerCase()));
  const activityTime = (value?: string | null) => {
    if (!value) return 0;
    const t = Date.parse(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
    return Number.isNaN(t) ? 0 : t;
  };
  const listOrder = new Map<string, number>();
  [
    ...filteredConversations.map((c) => ({
      key: `c-${c.friend_id}`,
      pinned: conversations[c.friend_id]?.pinned ? 1 : 0,
      time: activityTime(conversations[c.friend_id]?.last_created_at),
    })),
    ...visibleGroups.map((g) => ({ key: `g-${g.id}`, pinned: 0, time: activityTime(g.last_created_at) })),
  ]
    .sort((a, b) => b.pinned - a.pinned || b.time - a.time)
    .forEach((item, index) => listOrder.set(item.key, index + 1));

  const conversationPreview = (c: Conversation, myId: number): string => {
    const prefix = c.last_sender_id === myId ? 'Você: ' : '';
    switch (c.last_message_type) {
      case 'image':
        return `${prefix}📷 Foto`;
      case 'video':
        return `${prefix}🎥 Vídeo`;
      case 'file':
        return `${prefix}📎 ${c.last_content || 'Arquivo'}`;
      case 'location':
        return `${prefix}📍 Localização`;
      case 'gif':
        return `${prefix}GIF`;
      case 'audio':
        return `${prefix}🎤 Áudio`;
      case 'sticker':
        return `${prefix}Figurinha`;
      default:
        return `${prefix}${c.last_content}`;
    }
  };

  const presenceLabel = (iso: string): string => {
    const date = new Date(iso.replace(' ', 'T') + (iso.endsWith('Z') ? '' : 'Z'));
    const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMin < 2) return 'online';
    const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const startOfToday = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
    if (date.getTime() >= startOfToday) return `visto por último hoje às ${time}`;
    if (date.getTime() >= startOfToday - 86400000) return `visto por último ontem às ${time}`;
    const day = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `visto por último em ${day} às ${time}`;
  };

  const formatConversationTime = (iso: string): string => {
    const date = new Date(iso);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
    if (diffDays < 7) return date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  // Renderizador rico de mensagens por tipo (Tarefa 3)
  // Renderizador rico de mensagens por tipo e verificação de media_url (Tarefa 2)
  const renderMessageContent = (m: ChatMessage, isMe: boolean) => {
    if (m.view_once && (m.message_type === 'image' || m.message_type === 'video')) {
      return (
        <ViewOnceMedia
          kind="dm"
          messageId={m.id || 0}
          type={m.message_type}
          mine={isMe}
          viewed={Boolean(m.viewed) || (m.id !== undefined && openedOnce.has(m.id))}
          onOpened={() => m.id && setOpenedOnce((prev) => new Set(prev).add(m.id!))}
        />
      );
    }
    // Se a mensagem possuir media_url (Tarefa 2)
    if (m.media_url) {
      let msgType: ChatMessageType = m.message_type || 'image';
      // Auto-detecção de tipo caso não venha explícito ou venha 'text'
      if (msgType === 'text') {
        const lower = m.media_url.toLowerCase();
        if (/\.(mp4|webm|mov|ogg|m4v)($|\?)/.test(lower) || lower.includes('/videos/')) {
          msgType = 'video';
        } else if (/\.(jpg|jpeg|png|gif|webp|svg)($|\?)/.test(lower) || lower.includes('/images/')) {
          msgType = 'image';
        } else if (lower.includes('/documents/')) {
          msgType = 'file';
        } else if (m.media_url.includes('google.com/maps')) {
          msgType = 'location';
        }
      }

      if (msgType === 'image') {
        return (
          <div className="flex flex-col gap-1.5">
            <ThumbImg
              src={m.media_url}
              alt={m.content || 'Foto'}
              onClick={() => setPreviewImageUrl(m.media_url || null)}
              className="max-w-[200px] w-auto h-auto rounded-lg shadow-xs cursor-pointer hover:opacity-95 transition-opacity"
            />
            {m.content &&
              m.content !== 'Foto' &&
              m.content !== 'Imagem' &&
              !m.content.endsWith('.jpg') &&
              !m.content.endsWith('.jpeg') &&
              !m.content.endsWith('.png') &&
              !m.content.endsWith('.webp') && (
                <p className="text-xs break-words">{m.content}</p>
              )}
          </div>
        );
      }

      if (msgType === 'video') {
        return (
          <div className="flex flex-col gap-1.5">
            <video
              src={m.media_url}
              controls
              playsInline
              preload="metadata"
              className="max-w-[200px] w-full rounded-lg shadow-xs bg-black"
            />
            {m.content &&
              m.content !== 'Vídeo' &&
              !m.content.endsWith('.mp4') &&
              !m.content.endsWith('.webm') &&
              !m.content.endsWith('.mov') && (
                <p className="text-xs break-words">{m.content}</p>
              )}
          </div>
        );
      }

      if (msgType === 'file') {
        return (
          <div className="flex items-center gap-2.5 p-2 rounded-lg bg-surface-container-high/60 border border-outline-variant min-w-[180px] max-w-[240px]">
            <div className="w-8 h-8 rounded-md bg-primary-container text-on-primary flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-[18px]">description</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate text-on-surface" title={m.content}>
                {m.content || 'Documento'}
              </p>
              <span className="text-[10px] text-on-surface-variant uppercase font-mono">
                Arquivo
              </span>
            </div>
            <a
              href={m.media_url}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="p-1.5 rounded-lg text-primary hover:bg-surface-container transition-colors shrink-0 cursor-pointer"
              title="Baixar arquivo"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
            </a>
          </div>
        );
      }

      if (msgType === 'audio') {
        return <AudioMessage src={m.media_url} />;
      }

      if (msgType === 'gif' || msgType === 'sticker') {
        return (
          <div className="max-w-[240px] rounded-lg overflow-hidden">
            <img
              src={m.media_url}
              alt="GIF Animado"
              className="w-full h-auto object-cover rounded-lg"
            />
          </div>
        );
      }

      if (msgType === 'location') {
        const coords = m.content.replace('Localização: ', '').trim();
        return (
          <div className="flex flex-col gap-2 min-w-[200px]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">pin_drop</span>
              <span className="text-xs font-bold text-on-surface">Localização Compartilhada</span>
            </div>
            <a
              href={m.media_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 rounded-xl bg-surface-container-high/70 hover:bg-surface-container transition-all flex items-center justify-between gap-2 border border-outline-variant cursor-pointer group"
            >
              <div className="flex flex-col text-left">
                <span className="text-[11px] font-mono text-on-surface truncate">{coords || 'Abrir Mapa'}</span>
                <span className="text-[10px] text-primary group-hover:underline">Ver no Google Maps</span>
              </div>
              <span className="material-symbols-outlined text-[16px] text-primary">open_in_new</span>
            </a>
          </div>
        );
      }
    }

    // Mensagem de texto normal
    if (isBareMessage(m)) {
      return <p className="text-4xl leading-tight whitespace-pre-wrap">{m.content}</p>;
    }
    return <p className="chat-text text-xs leading-relaxed whitespace-pre-wrap">{m.content}</p>;
  };

  return (
    <div
      style={{
        height: isMobile && isKeyboardOpen && viewportHeight ? `${viewportHeight}px` : undefined,
      }}
      className="w-full h-dvh md:h-screen overflow-hidden bg-surface text-on-surface flex flex-col md:flex-row fixed inset-x-0 top-0 md:static"
    >
      {!activeFriend && !activeGroupId && <Header />}
      <SidebarNav />

      {/* Hidden File Inputs para Fotos, Câmera e Documentos */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*,video/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUploadFile(file);
        }}
        className="hidden"
      />
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUploadFile(file, 'image');
        }}
        className="hidden"
      />
      <input
        type="file"
        ref={docInputRef}
        accept="*/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUploadFile(file, 'file');
        }}
        className="hidden"
      />

      {/* Lightbox / Visualizador de Foto em Tamanho Completo */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl bg-surface-container-lowest border border-outline-variant p-2">
            <button
              type="button"
              onClick={() => setPreviewImageUrl(null)}
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/90 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
            <img
              src={previewImageUrl}
              alt="Visualização"
              className="w-full h-auto max-h-[85vh] object-contain rounded-2xl"
            />
          </div>
        </div>
      )}

      {extraModal === 'library' && (
        <ChatLibraryModal
          onClose={() => setExtraModal(null)}
          scope={activeFriend ? { kind: 'dm', id: activeFriend.friend_id, name: `@${activeFriend.username}` } : undefined}
        />
      )}
      {extraModal === 'starred' && (
        <StarredModal
          onClose={() => setExtraModal(null)}
          onOpenDirect={(friendId) => {
            const found = friends.find((f) => f.friend_id === friendId);
            if (found) {
              setActiveFriend(found);
              if (activeGroupId) navigate('/mensagens');
            }
          }}
        />
      )}
      {extraModal === 'disappear' && <DisappearingModal current={disappearSeconds} onSave={saveDisappear} onClose={() => setExtraModal(null)} />}
      {showInvite && inviteCode && (
        <InviteJoinModal
          code={inviteCode}
          onClose={() => {
            setShowInvite(false);
            window.history.replaceState(null, '', window.location.pathname);
          }}
        />
      )}

      <div
        className={`flex-1 flex flex-col h-full overflow-hidden transition-all duration-300 ease-in-out ${
          !activeFriend && !activeGroupId ? 'pt-[calc(3.5rem+env(safe-area-inset-top))] md:pt-0' : 'pt-0'
        }`}
      >
        <main className="w-full flex-1 flex h-full overflow-hidden">
          {/* Se o usuário não estiver logado */}
          {!user ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <EmptyState
                icon="lock"
                title="Acesse o Direct do Espectro"
                description="Faça login com sua conta para conversar em tempo real com seus amigos e gerenciar conversas privadas."
                actionLabel="Entrar ou Cadastrar"
                actionLink="/login"
                className="max-w-md w-full"
              />
            </div>
          ) : loadingFriends ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-on-surface-variant gap-3">
              <span className="material-symbols-outlined text-[36px] text-primary animate-spin">
                progress_activity
              </span>
              <p className="text-sm font-medium">Sintonizando suas conversas privadas...</p>
            </div>
          ) : (
            <div className="flex flex-1 w-full h-full overflow-hidden bg-surface">
              {/* COLUNA 1: Diretório Direct (No mobile: tela cheia quando activeFriend é null) */}
              <aside
                className={`w-full md:w-80 lg:w-96 flex-shrink-0 flex-col bg-surface-container-lowest border-r border-outline-variant shadow-xs z-10 ${
                  activeFriend || activeGroupId ? 'hidden md:flex' : 'flex'
                }`}
              >
                <div className="p-4 pb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-bold text-base text-on-surface truncate">
                      @{user.username}
                    </span>
                  </div>
                  <ChatMenu
                    title="Configurações das conversas"
                    items={[
                      {
                        key: 'unread',
                        label: unreadOnly ? 'Mostrar todas as conversas' : 'Mostrar só não lidas',
                        icon: 'mark_chat_unread',
                        active: unreadOnly,
                        onSelect: () => setUnreadOnly((v) => !v),
                      },
                      {
                        key: 'read-all',
                        label: 'Marcar todas como lidas',
                        icon: 'done_all',
                        onSelect: handleMarkAllRead,
                      },
                      {
                        key: 'new-group',
                        label: 'Novo grupo',
                        icon: 'group_add',
                        onSelect: () => setShowCreateGroup(true),
                      },
                      {
                        key: 'push',
                        label: push.subscribed ? 'Desativar notificações push' : 'Ativar notificações push',
                        icon: push.subscribed ? 'notifications_off' : 'notifications_active',
                        hidden: !push.supported || push.permission === 'denied',
                        onSelect: () => (push.subscribed ? push.disable() : push.enable()),
                      },
                      {
                        key: 'library-all',
                        label: 'Mídias, links e docs',
                        icon: 'perm_media',
                        onSelect: () => setExtraModal('library'),
                      },
                      {
                        key: 'starred-all',
                        label: 'Mensagens favoritas',
                        icon: 'star',
                        onSelect: () => setExtraModal('starred'),
                      },
                      {
                        key: 'prefs',
                        label: 'Preferências do chat',
                        icon: 'tune',
                        onSelect: () => setShowPrefs(true),
                      },
                      {
                        key: 'account',
                        label: 'Configurações da conta',
                        icon: 'settings',
                        onSelect: () => navigate('/settings/account'),
                      },
                    ]}
                  />
                </div>

                <div className="px-4 pb-2">
                  <div className="relative flex items-center w-full">
                    <span className="material-symbols-outlined absolute left-3 text-on-surface-variant text-[18px] pointer-events-none">
                      search
                    </span>
                    <input
                      type="text"
                      value={searchConv}
                      onChange={(e) => setSearchConv(e.target.value)}
                      placeholder="Pesquisar conversas ou pessoas..."
                      className="w-full h-9 pl-9 pr-3 bg-surface-container-low text-on-surface placeholder:text-on-surface-variant rounded-full text-xs focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary-container outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Lista de Conversas / Amigos */}
                <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-2">
                  {(showArchived || Object.values(conversations).some((c) => c.archived)) && (
                    <button
                      type="button"
                      onClick={() => setShowArchived((v) => !v)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container-low/60 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[20px] text-on-surface-variant">{showArchived ? 'arrow_back' : 'archive'}</span>
                      <span>{showArchived ? 'Voltar às conversas' : 'Arquivadas'}</span>
                    </button>
                  )}
                  {visibleGroups
                    .map((g) => (
                      <Link key={`g-${g.id}`} to={`/grupos/${g.id}`} style={{ order: listOrder.get(`g-${g.id}`) }} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-container-low/60">
                        <div className="w-11 h-11 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-sm flex-shrink-0">
                          {g.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold truncate">{g.name}</span>
                            {g.last_created_at && (
                              <span className="text-[11px] text-on-surface-variant flex-shrink-0">{formatConversationTime(g.last_created_at)}</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <p className="text-xs text-on-surface-variant truncate">
                              {g.last_content ? `${g.last_sender ? '@' + g.last_sender + ': ' : ''}${g.last_content}` : `${g.members_count} membros`}
                            </p>
                            {g.unread_count > 0 && (
                              <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-primary-container text-on-primary text-[10px] font-bold flex items-center justify-center">
                                {g.unread_count > 99 ? '99+' : g.unread_count}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  {filteredConversations.length === 0 && visibleGroups.length === 0 ? (
                    <div className="text-center py-8 px-4 text-xs text-on-surface-variant">
                      <span className="material-symbols-outlined text-[28px] text-on-surface-variant/40 mb-1">
                        search_off
                      </span>
                      <p className="font-semibold text-on-surface">
                        {searchConv.trim() ? 'Nenhuma conversa encontrada' : unreadOnly ? 'Nada não lido' : 'Sem conversas ainda'}
                      </p>
                      <p className="mt-1 text-[11px]">
                        {searchConv.trim()
                          ? 'Veja os resultados em Pessoas, logo abaixo.'
                          : unreadOnly
                          ? 'Você está em dia com suas mensagens.'
                          : 'Pesquise o nome de alguém na barra acima para começar.'}
                      </p>
                    </div>
                  ) : (
                    filteredConversations.map((c) => (
                      <div
                        key={c.friend_id}
                        style={{ order: listOrder.get(`c-${c.friend_id}`) }}
                        onClick={() => {
                          setActiveFriend(c);
                          if (activeGroupId) navigate('/mensagens');
                        }}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                          activeFriend?.friend_id === c.friend_id
                            ? 'bg-surface-container-low border border-outline-variant shadow-xs'
                            : 'hover:bg-surface-container-low/60'
                        }`}
                      >
                        <div className="relative flex-shrink-0">
                          <div className="w-11 h-11 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-sm uppercase">
                            {c.username.charAt(0)}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-xs truncate ${
                                (conversations[c.friend_id]?.unread_count ?? 0) > 0 && activeFriend?.friend_id !== c.friend_id
                                  ? 'font-bold text-on-surface'
                                  : 'font-semibold text-on-surface'
                              }`}
                            >
                              {conversations[c.friend_id]?.pinned && (
                                <span
                                  className="material-symbols-outlined text-[13px] text-on-surface-variant align-middle mr-1"
                                  title="Fixada"
                                >
                                  push_pin
                                </span>
                              )}
                              {conversations[c.friend_id]?.nickname || `@${c.username}`}
                              {conversations[c.friend_id]?.muted && (
                                <span
                                  className="material-symbols-outlined text-[13px] text-on-surface-variant align-middle ml-1"
                                  title="Silenciada"
                                >
                                  notifications_off
                                </span>
                              )}
                            </span>
                            {conversations[c.friend_id] && (
                              <span className="text-[11px] text-on-surface-variant flex-shrink-0">
                                {formatConversationTime(conversations[c.friend_id].last_created_at)}
                              </span>
                            )}
                          </div>
                          {conversations[c.friend_id]?.peer_last_seen_at && (
                            <p className="text-[10px] text-on-surface-variant truncate mt-0.5">
                              {presenceLabel(conversations[c.friend_id].peer_last_seen_at as string)}
                            </p>
                          )}
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <p
                              className={`text-xs truncate ${
                                (conversations[c.friend_id]?.unread_count ?? 0) > 0 && activeFriend?.friend_id !== c.friend_id
                                  ? 'text-on-surface font-semibold'
                                  : 'text-on-surface-variant'
                              }`}
                            >
                              {conversations[c.friend_id]
                                ? prefs.showPreviews
                                  ? conversationPreview(conversations[c.friend_id], user.id)
                                  : 'Mensagem'
                                : 'Diga um oi!'}
                            </p>
                            {((conversations[c.friend_id]?.unread_count ?? 0) > 0 || conversations[c.friend_id]?.manual_unread) &&
                              activeFriend?.friend_id !== c.friend_id && (
                                <span
                                  className="flex-shrink-0 min-w-[18px] h-[18px] px-1.5 rounded-full bg-primary-container text-on-primary text-[10px] font-bold flex items-center justify-center"
                                  aria-label={`${conversations[c.friend_id]?.unread_count || 1} mensagens não lidas`}
                                >
                                  {(conversations[c.friend_id]?.unread_count ?? 0) > 99
                                    ? '99+'
                                    : conversations[c.friend_id]?.unread_count || ''}
                                </span>
                              )}
                          </div>
                        </div>
                        <div
                          className="flex-shrink-0 -mr-1"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <ChatMenu
                            title="Opções da conversa"
                            buttonClassName="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container cursor-pointer"
                            items={[
                              {
                                key: 'unread',
                                label: conversations[c.friend_id]?.manual_unread ? 'Marcar como lida' : 'Marcar como não lida',
                                icon: 'mark_chat_unread',
                                onSelect: () => toggleListFlag(c, 'manual_unread'),
                              },
                              {
                                key: 'pin',
                                label: conversations[c.friend_id]?.pinned ? 'Desafixar' : 'Fixar',
                                icon: 'push_pin',
                                onSelect: () => toggleListFlag(c, 'pinned'),
                              },
                              {
                                key: 'mute',
                                label: conversations[c.friend_id]?.muted ? 'Reativar notificações' : 'Silenciar',
                                icon: conversations[c.friend_id]?.muted ? 'notifications_active' : 'notifications_off',
                                onSelect: () => toggleListFlag(c, 'muted'),
                              },
                              {
                                key: 'archive',
                                label: conversations[c.friend_id]?.archived ? 'Desarquivar' : 'Arquivar',
                                icon: 'archive',
                                onSelect: () => toggleArchive(c),
                              },
                              {
                                key: 'delete',
                                label: 'Excluir conversa',
                                icon: 'delete',
                                danger: true,
                                onSelect: () => deleteListConversation(c),
                              },
                            ]}
                          />
                        </div>
                      </div>
                    ))
                  )}
                  <MessageSearchResults
                    query={searchConv}
                    onOpenDirect={(friendId) => {
                      const found = friends.find((f) => f.friend_id === friendId);
                      if (!found) return;
                      setActiveFriend(found);
                      if (activeGroupId) navigate('/mensagens');
                    }}
                    onOpenGroup={(groupId) => navigate(`/grupos/${groupId}`)}
                  />
                  <PeopleSearchResults
                    query={searchConv}
                    myId={user.id}
                    knownFriendIds={new Set(friends.map((f) => f.friend_id))}
                    onOpenChat={handleOpenChatWithPerson}
                  />
                </div>
              </aside>

              {activeGroupId && (
                <section className="flex-1 flex flex-col bg-surface min-w-0 relative">
                  <GroupChatPanel key={activeGroupId} groupId={activeGroupId} />
                </section>
              )}

              {/* COLUNA 2: Conversa Ativa (No mobile: tela cheia quando activeFriend existe) */}
              {!activeGroupId && (
              <section
                className={`flex-1 flex-col bg-surface min-w-0 relative ${
                  !activeFriend ? 'hidden md:flex' : 'flex'
                }`}
              >
                {!activeFriend ? (
                  <div className="flex-1 flex items-center justify-center p-8">
                    <EmptyState
                      icon="forum"
                      title="Nenhum sussurro por aqui."
                      description="Selecione um contato na lista à esquerda para iniciar o bate-papo."
                      className="max-w-md w-full"
                    />
                  </div>
                ) : (
                  <>
                    {/* Header da Conversa Ativa */}
                    <div className="min-h-14 sm:min-h-16 pt-[env(safe-area-inset-top)] px-3 sm:px-6 bg-surface-container-lowest border-b border-outline-variant flex items-center justify-between shadow-xs z-10 flex-shrink-0">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        {/* Botão Voltar para Lista no Mobile (Tela Cheia) */}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveFriend(null);
                            setHideBottomNav(false);
                          }}
                          className="md:hidden p-1.5 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer mr-0.5"
                          title="Voltar para a lista de conversas"
                        >
                          <span className="material-symbols-outlined text-[24px]">arrow_back</span>
                        </button>

                        <div className="relative flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-sm uppercase">
                            {activeFriend.username.charAt(0)}
                          </div>
                          <span
                            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-surface-container-lowest ${
                              presence?.online ? 'bg-gray-400' : 'hidden'
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Link
                              to={`/perfil/${encodeURIComponent(activeFriend.username)}`}
                              className="font-semibold text-sm text-on-surface hover:text-primary hover:underline transition-colors truncate"
                            >
                              {activeSettings?.nickname || `@${activeFriend.username}`}
                            </Link>
                          </div>
                          <div className="flex items-center gap-2 text-[11px]">
                            {isOtherUserTyping ? (
                              <span className="text-primary font-semibold">{activityLabel(otherUserActivity)}</span>
                            ) : presence?.visible ? (
                              presence.online ? (
                                <span className="text-on-surface-variant font-medium">Online</span>
                              ) : presence.last_seen_at ? (
                                <span className="text-on-surface-variant">{lastSeenLabel(presence.last_seen_at)}</span>
                              ) : null
                            ) : connectionStatus === 'connecting' ? (
                              <span className="text-on-surface-variant font-medium">Conectando...</span>
                            ) : null}
                            {activeSettings?.nickname && (
                              <span className="text-on-surface-variant truncate">@{activeFriend.username}</span>
                            )}
                            {activeSettings?.muted && (
                              <span
                                className="material-symbols-outlined text-[13px] text-on-surface-variant"
                                title="Silenciada"
                              >
                                notifications_off
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setConvSearchOpen((open) => !open);
                            setConvSearch('');
                          }}
                          title="Buscar na conversa"
                          aria-label="Buscar na conversa"
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                            convSearchOpen
                              ? 'bg-primary-container text-on-primary'
                              : 'text-on-surface-variant hover:bg-surface-container'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[20px]">search</span>
                        </button>
                        <ChatMenu
                          title="Configurações da conversa"
                          buttonClassName="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
                          items={[
                            {
                              key: 'profile',
                              label: 'Ver perfil',
                              icon: 'person',
                              onSelect: () => navigate(`/perfil/${encodeURIComponent(activeFriend.username)}`),
                            },
                            {
                              key: 'search',
                              label: 'Buscar na conversa',
                              icon: 'search',
                              onSelect: () => setConvSearchOpen(true),
                            },
                            {
                              key: 'library',
                              label: 'Mídias, links e docs',
                              icon: 'perm_media',
                              onSelect: () => setExtraModal('library'),
                            },
                            {
                              key: 'starred',
                              label: 'Mensagens favoritas',
                              icon: 'star',
                              onSelect: () => setExtraModal('starred'),
                            },
                            {
                              key: 'disappear',
                              label: `Mensagens temporárias · ${disappearLabel(disappearSeconds)}`,
                              icon: 'timer',
                              onSelect: () => setExtraModal('disappear'),
                            },
                            {
                              key: 'export',
                              label: 'Exportar conversa',
                              icon: 'download',
                              onSelect: () => void exportConversation(),
                            },
                            {
                              key: 'customize',
                              label: 'Personalizar conversa',
                              icon: 'palette',
                              onSelect: () => setShowCustomizer(true),
                            },
                            {
                              key: 'mute',
                              label: activeSettings?.muted ? 'Reativar notificações' : 'Silenciar notificações',
                              icon: activeSettings?.muted ? 'notifications_active' : 'notifications_off',
                              onSelect: handleToggleMute,
                            },
                            {
                              key: 'clear',
                              label: 'Limpar conversa para mim',
                              icon: 'cleaning_services',
                              onSelect: handleClearConversation,
                            },
                            {
                              key: 'report',
                              label: 'Denunciar',
                              icon: 'flag',
                              danger: true,
                              onSelect: () => setReportTarget({ messageId: null }),
                            },
                            {
                              key: 'block',
                              label: 'Bloquear',
                              icon: 'block',
                              danger: true,
                              onSelect: handleBlockUser,
                            },
                            {
                              key: 'remove',
                              label: 'Remover amigo',
                              icon: 'person_remove',
                              danger: true,
                              onSelect: handleRemoveFriend,
                            },
                          ]}
                        />
                      </div>
                    </div>

                    {convSearchOpen && (
                      <div className="px-3 sm:px-6 py-2 bg-surface-container-lowest border-b border-outline-variant flex items-center gap-2 flex-shrink-0">
                        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">search</span>
                        <input
                          autoFocus
                          type="text"
                          value={convSearch}
                          onChange={(e) => setConvSearch(e.target.value)}
                          placeholder="Buscar nas mensagens carregadas..."
                          className="flex-1 h-8 bg-transparent text-xs text-on-surface placeholder:text-on-surface-variant outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setConvSearch('');
                            setConvSearchOpen(false);
                          }}
                          aria-label="Fechar busca"
                          className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                      </div>
                    )}

                    {connectionStatus === 'reconnecting' && (
                      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                        <span className="px-3 py-1 rounded-full bg-surface-container-high text-[11px] font-medium text-on-surface-variant border border-outline-variant/40 shadow-md">
                          Reconectando
                        </span>
                      </div>
                    )}

                    {/* Overlay de Foco no Menu Kebab da Mensagem */}
                    {activeKebabMessage && (
                      <div
                        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200 cursor-pointer"
                        onClick={() => setActiveKebabMessage(null)}
                      />
                    )}

                    {/* Histórico de Mensagens */}
                    <div
                      className={`flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 min-h-0 overscroll-contain chat-font-${prefs.fontSize}`}
                      style={wallpaperStyle(activeSettings?.wallpaper)}
                    >
                      <div className="flex items-center justify-center">
                        <span className="text-[11px] text-on-surface-variant bg-surface-container-low px-3 py-1 rounded-full uppercase tracking-wider font-medium">
                          Conversa privada
                        </span>
                      </div>

                      {hasMore && !loadingHistory && (
                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={loadOlder}
                            disabled={loadingOlder}
                            className="text-[11px] font-semibold text-primary px-4 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-60"
                          >
                            {loadingOlder ? 'Carregando...' : 'Carregar mensagens anteriores'}
                          </button>
                        </div>
                      )}

                      {loadingHistory ? (
                        <div className="text-center py-8 text-xs text-on-surface-variant">
                          <span className="material-symbols-outlined text-[24px] text-primary animate-spin">
                            progress_activity
                          </span>
                          <p className="mt-1">Carregando histórico do chat...</p>
                        </div>
                      ) : visibleMessages.length === 0 ? (
                        <div className="py-8">
                          <EmptyState
                            icon="waving_hand"
                            title={searchTerm ? 'Nada encontrado.' : 'Nenhuma mensagem ainda. Diga um oi!'}
                            description={`Inicie a conversa em tempo real com @${activeFriend.username}. Envie fotos, vídeos, localização ou emojis.`}
                            className="max-w-md mx-auto"
                          />
                        </div>
                      ) : (
                        visibleMessages.map((m, idx) => {
                          const isMe = m.sender_id === user.id;

                          // Separador de datas (Tarefa 2)
                          const currentDateLabel = formatMessageDateSeparator(m.created_at);
                          const prevDateLabel =
                            idx > 0 ? formatMessageDateSeparator(visibleMessages[idx - 1].created_at) : null;
                          const showDateSeparator = currentDateLabel !== prevDateLabel;

                          // Agrupamento de mensagens consecutivas do mesmo remetente (Tarefa 2)
                          const prevMsg = idx > 0 ? visibleMessages[idx - 1] : null;
                          const nextMsg = idx < visibleMessages.length - 1 ? visibleMessages[idx + 1] : null;
                          const isSameSenderAsPrev = !showDateSeparator && prevMsg && prevMsg.sender_id === m.sender_id;
                          const isSameSenderAsNext =
                            nextMsg &&
                            nextMsg.sender_id === m.sender_id &&
                            formatMessageDateSeparator(nextMsg.created_at) === currentDateLabel;

                          const isFirstInBlock = !isSameSenderAsPrev;
                          const isLastInBlock = !isSameSenderAsNext;
                          const marginTopClass = showDateSeparator ? 'mt-4' : isFirstInBlock ? 'mt-3' : 'mt-1';

                          // Se a mensagem citou outra (Responder - Tarefa 3 & 4)
                          const repliedMsg = m.reply_to_id
                            ? messages.find((item) => item.id === m.reply_to_id)
                            : null;

                          const isKebabOpen = activeKebabMessage?.id === m.id;
                          const bare = isBareMessage(m);

                          return (
                            <React.Fragment key={m.id || `${m.created_at}-${idx}`}>
                              {/* Separador de Data Visual */}
                              {showDateSeparator && (
                                <div className="flex justify-center my-3 select-none">
                                  <span className="text-[11px] font-semibold text-on-surface-variant bg-surface-container-high/90 px-3.5 py-1 rounded-full shadow-xs border border-outline-variant">
                                    {currentDateLabel}
                                  </span>
                                </div>
                              )}

                              <div
                                id={`msg-${m.id}`}
                                className={`group relative flex items-end gap-2 max-w-xl ${marginTopClass} ${
                                  isMe ? 'ml-auto justify-end' : 'mr-auto justify-start'
                                } ${isKebabOpen ? 'z-50' : 'z-10'}`}
                              >
                                {/* Avatar do contato apenas na última mensagem do bloco consecutivo */}
                                {!isMe && (
                                  isLastInBlock ? (
                                    <div className="w-7 h-7 rounded-full bg-primary-container text-on-primary font-bold flex items-center justify-center text-xs flex-shrink-0 mb-1 uppercase">
                                      {activeFriend.username.charAt(0)}
                                    </div>
                                  ) : (
                                    <div className="w-7 h-7 flex-shrink-0" />
                                  )
                                )}

                                <div
                                  className="relative flex flex-col max-w-[85%] sm:max-w-md select-text"
                                  onTouchStart={() => handleTouchStart(m)}
                                  onTouchEnd={handleTouchEnd}
                                  onTouchCancel={handleTouchEnd}
                                >
                                  {/* Botão de Três Pontos (Kebab) visível no hover ou com o menu aberto */}
                                  <div
                                    className={`absolute top-1 z-30 ${
                                      isMe ? '-left-8' : '-right-8'
                                    } transition-all duration-150 ${
                                      isKebabOpen
                                        ? 'opacity-100 scale-100'
                                        : 'opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100'
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveKebabMessage(isKebabOpen ? null : m);
                                      }}
                                      className="w-7 h-7 rounded-full bg-surface-container-high/90 dark:bg-zinc-900 border border-outline-variant text-on-surface-variant hover:text-on-surface hover:border-outline-variant flex items-center justify-center shadow-md transition-all cursor-pointer"
                                      title="Opções da mensagem"
                                    >
                                      <span className="material-symbols-outlined text-[16px]">more_vert</span>
                                    </button>
                                  </div>

                                  {/* Submenu Dropdown com Efeito de Foco */}
                                  {isKebabOpen && (
                                    <div
                                      data-kebab-menu
                                      className={`absolute z-50 ${
                                        isMe ? 'right-0 top-full mt-1.5' : 'left-0 top-full mt-1.5'
                                      } min-w-[200px] rounded-2xl bg-surface-container-high dark:bg-[#18181b] border border-outline-variant/40 dark:border-zinc-800 shadow-2xl py-1.5 animate-in fade-in zoom-in-95 duration-150`}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {m.id && m.id > 0 && (
                                        <div className="flex items-center justify-between gap-1 px-3 pb-2 mb-1 border-b border-outline-variant dark:border-zinc-800">
                                          {REACTION_EMOJIS.map((emoji) => {
                                            const mine = (m.reactions || []).some((r) => r.user_id === user.id && r.emoji === emoji);
                                            return (
                                              <button
                                                key={emoji}
                                                type="button"
                                                aria-label={`Reagir com ${emoji}`}
                                                aria-pressed={mine}
                                                onClick={() => {
                                                  reactToMessage(m.id!, mine ? null : emoji);
                                                  setActiveKebabMessage(null);
                                                }}
                                                className={`w-8 h-8 rounded-full flex items-center justify-center text-lg transition-transform hover:scale-125 cursor-pointer ${
                                                  mine ? 'bg-primary/20' : ''
                                                }`}
                                              >
                                                {emoji}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleStartReply(m);
                                          setActiveKebabMessage(null);
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-on-surface hover:bg-surface-container dark:hover:bg-zinc-800 transition-colors text-left cursor-pointer"
                                      >
                                        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">reply</span>
                                        <span className="font-medium">Responder</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setForwardModalMessage(m);
                                          setActiveKebabMessage(null);
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-on-surface hover:bg-surface-container dark:hover:bg-zinc-800 transition-colors text-left cursor-pointer"
                                      >
                                        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">forward</span>
                                        <span className="font-medium">Encaminhar</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleCopyMessage(m);
                                          setActiveKebabMessage(null);
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-on-surface hover:bg-surface-container dark:hover:bg-zinc-800 transition-colors text-left cursor-pointer"
                                      >
                                        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">content_copy</span>
                                        <span className="font-medium">Copiar</span>
                                      </button>

                                      {isMe && m.id && m.id > 0 && (m.message_type || 'text') === 'text' && canEditMessage(m.created_at) && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleStartEdit(m);
                                            setActiveKebabMessage(null);
                                          }}
                                          className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-on-surface hover:bg-surface-container dark:hover:bg-zinc-800 transition-colors text-left cursor-pointer"
                                        >
                                          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">edit</span>
                                          <span className="font-medium">Editar</span>
                                        </button>
                                      )}

                                      {m.id && m.id > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            toggleStar(m);
                                            setActiveKebabMessage(null);
                                          }}
                                          className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-on-surface hover:bg-surface-container dark:hover:bg-zinc-800 transition-colors text-left cursor-pointer"
                                        >
                                          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">star</span>
                                          <span className="font-medium">{starredIds.has(m.id) ? 'Desfavoritar' : 'Favoritar'}</span>
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setInfoModalMessage(m);
                                          setActiveKebabMessage(null);
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-on-surface hover:bg-surface-container dark:hover:bg-zinc-800 transition-colors text-left cursor-pointer"
                                      >
                                        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">info</span>
                                        <span className="font-medium">Dados da Mensagem</span>
                                      </button>

                                      {!isMe && m.id && m.id > 0 && (
                                        <>
                                          <div className="my-1 border-t border-outline-variant dark:border-zinc-800" />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setReportTarget({ messageId: m.id! });
                                              setActiveKebabMessage(null);
                                            }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-error hover:bg-error/15 transition-colors text-left cursor-pointer"
                                          >
                                            <span className="material-symbols-outlined text-[18px]">flag</span>
                                            <span className="font-medium">Denunciar mensagem</span>
                                          </button>
                                        </>
                                      )}

                                      {isMe && m.id && (
                                        <>
                                          <div className="my-1 border-t border-outline-variant dark:border-zinc-800" />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              handleDeleteMessage(m.id!);
                                              setActiveKebabMessage(null);
                                            }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-error hover:bg-error/15 transition-colors text-left cursor-pointer"
                                          >
                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                            <span className="font-medium">Excluir</span>
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  )}

                                  {/* Balão de Mensagem */}
                                  <div
                                    className={`p-3 text-xs leading-relaxed shadow-xs transition-all ${bare ? '!bg-transparent !shadow-none !p-0 !border-0 ' : ''}${
                                      isMe
                                        ? `bg-primary-container text-on-primary rounded-2xl ${
                                            isFirstInBlock ? 'rounded-tr-2xl' : 'rounded-tr-md'
                                          } ${isLastInBlock ? 'rounded-br-xs' : 'rounded-br-md'} rounded-l-2xl`
                                        : `bg-surface-container-low text-on-surface rounded-2xl border border-outline-variant ${
                                            isFirstInBlock ? 'rounded-tl-2xl' : 'rounded-tl-md'
                                          } ${isLastInBlock ? 'rounded-bl-xs' : 'rounded-bl-md'} rounded-r-2xl`
                                    }`}
                                    style={isMe && myBubbleColor ? { backgroundColor: myBubbleColor, color: '#ffffff' } : undefined}
                                  >
                                    {/* Citação se for resposta (Tarefa 3) */}
                                    {m.reply_to_id && (
                                      <div
                                        onClick={() => {
                                          const el = document.getElementById(`msg-${m.reply_to_id}`);
                                          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        }}
                                        className={`mb-2 p-2 rounded-xl text-left border-l-2 text-xs cursor-pointer transition-opacity hover:opacity-90 ${
                                          isMe
                                            ? 'bg-black/20 border-on-primary/70 text-on-primary'
                                            : 'bg-surface-container border-primary text-on-surface'
                                        }`}
                                      >
                                        <span className="font-bold text-[11px] block truncate">
                                          @{repliedMsg?.sender_username || 'Mensagem anterior'}
                                        </span>
                                        <span className="text-[11px] opacity-80 block truncate">
                                          {repliedMsg?.content ||
                                            (repliedMsg?.message_type === 'image'
                                              ? '📷 Foto'
                                              : repliedMsg?.message_type === 'video'
                                              ? '🎥 Vídeo'
                                              : 'Mensagem original')}
                                        </span>
                                      </div>
                                    )}

                                    {renderMessageContent(m, isMe)}
                                  </div>

                                  {groupReactions(m.reactions, user.id).length > 0 && (
                                    <div className={`flex flex-wrap gap-1 -mt-1.5 ${isMe ? 'justify-end mr-2' : 'ml-2'}`}>
                                      {groupReactions(m.reactions, user.id).map((group) => (
                                        <button
                                          key={group.emoji}
                                          type="button"
                                          onClick={() => m.id && reactToMessage(m.id, group.mine ? null : group.emoji)}
                                          title={group.mine ? 'Remover sua reação' : 'Reagir igual'}
                                          className={`h-6 px-1.5 rounded-full text-xs flex items-center gap-1 border shadow-xs cursor-pointer transition-colors ${
                                            group.mine
                                              ? 'bg-primary/15 border-primary/40'
                                              : 'bg-surface-container-high border-outline-variant/40 hover:bg-surface-container-highest'
                                          }`}
                                        >
                                          <span>{group.emoji}</span>
                                          {group.count > 1 && (
                                            <span className="text-[10px] font-semibold text-on-surface-variant">{group.count}</span>
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  )}

                                  {/* Horário e Ticks de Confirmação (Tarefa 3) */}
                                  <div
                                    className={`text-[10px] text-on-surface-variant mt-0.5 flex items-center gap-1 ${
                                      isMe ? 'justify-end mr-1' : 'ml-1'
                                    }`}
                                  >
                                    {m.id !== undefined && starredIds.has(m.id) && (
                                      <span className="material-symbols-outlined text-[12px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }} title="Favorita">
                                        star
                                      </span>
                                    )}
                                    {m.expires_at && <span className="material-symbols-outlined text-[12px]" title="Mensagem temporária">timer</span>}
                                    <span>
                                      {new Date(m.created_at).toLocaleTimeString('pt-BR', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                    {m.edited_at && <span>· editada</span>}
                                    {isMe && (
                                      m.status === 'failed' ? (
                                        <button
                                          type="button"
                                          onClick={() => m.client_id && retrySend(m.client_id)}
                                          className="inline-flex items-center gap-0.5 text-error font-semibold cursor-pointer"
                                          title="Falha ao enviar. Toque para reenviar"
                                        >
                                          <span className="material-symbols-outlined text-[14px]">error</span>
                                          <span>Reenviar</span>
                                        </button>
                                      ) : m.status === 'sending' ? (
                                        <span
                                          className="material-symbols-outlined text-[14px] text-zinc-400 select-none inline-flex items-center"
                                          title="Enviando"
                                        >
                                          schedule
                                        </span>
                                      ) : m.status === 'read' ? (
                                        <span
                                          className="material-symbols-outlined text-[15px] text-primary font-bold select-none inline-flex items-center"
                                          title="Lida"
                                        >
                                          done_all
                                        </span>
                                      ) : m.status === 'delivered' ? (
                                        <span
                                          className="material-symbols-outlined text-[15px] text-zinc-400 select-none inline-flex items-center"
                                          title="Entregue"
                                        >
                                          done_all
                                        </span>
                                      ) : (
                                        <span
                                          className="material-symbols-outlined text-[14px] text-zinc-400 select-none inline-flex items-center"
                                          title="Enviada"
                                        >
                                          check
                                        </span>
                                      )
                                    )}
                                  </div>
                                </div>
                              </div>
                            </React.Fragment>
                          );
                        })
                      )}

                      {/* Estado: Usuário Digitando... */}
                      {isOtherUserTyping && (
                        <TypingBubble kind={otherUserActivity} className="mt-2 ml-9" />
                      )}

                      <div ref={messagesEndRef} />
                    </div>

                    {/* Barra de Progresso Real de Upload */}
                    {isUploading && (
                      <div className="px-6 py-2.5 bg-surface-container-low border-t border-outline-variant flex flex-col gap-1.5 animate-in fade-in">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 truncate">
                            <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                            <span className="text-on-surface truncate font-medium">
                              Enviando {uploadFileName}...
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-primary font-bold">{uploadProgress}%</span>
                            <button
                              type="button"
                              onClick={handleCancelUpload}
                              className="text-error hover:underline text-[11px] font-semibold cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                        <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-150 rounded-full"
                            style={{ width: `${Math.max(5, uploadProgress)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {uploadError && (
                      <div className="px-6 py-2.5 bg-error-container/90 text-error text-xs flex items-center justify-between border-t border-error/20 animate-in fade-in">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] shrink-0">info</span>
                          <span className="font-medium leading-tight">{uploadError}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setUploadError(null)}
                          className="font-bold cursor-pointer hover:opacity-80 p-1 text-sm ml-2 shrink-0"
                          title="Fechar aviso"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {/* Popover Profissional de Emojis (Emoji-Mart) */}
                    {showEmojiPicker && (
                      <div
                        ref={emojiPickerRef}
                        className="absolute bottom-20 left-4 sm:left-12 z-30 rounded-2xl overflow-hidden shadow-xl animate-in fade-in slide-in-from-bottom-2"
                      >
                        <div>
                          <Picker
                            data={data}
                            onEmojiSelect={handleSelectEmoji}
                            theme={isDarkTheme ? 'dark' : 'light'}
                            perLine={8}
                            emojiSize={22}
                            emojiButtonSize={34}
                            locale="pt"
                            previewPosition="none"
                            skinTonePosition="none"
                            navPosition="top"
                            maxFrequentRows={2}
                            autoFocus={false}
                            categories={[
                              'frequent',
                              'people',
                              'nature',
                              'foods',
                              'activity',
                              'places',
                              'objects',
                              'symbols',
                              'flags',
                            ]}
                          />
                        </div>
                      </div>
                    )}

                    {showGifPicker && (
                      <div className="absolute bottom-20 left-3 sm:left-12 z-30">
                        <MediaPicker onSelect={handleSelectMedia} onClose={() => setShowGifPicker(false)} />
                      </div>
                    )}

                    {/* Popover do Menu de Anexos (Clipe) */}
                    {showAttachMenu && (
                      <div className="absolute bottom-20 left-4 z-30 bg-surface-container-lowest rounded-2xl p-2 shadow-2xl border border-outline-variant flex flex-col gap-1 w-52 animate-in fade-in slide-in-from-bottom-2">
                        {/* Foto ou Vídeo */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowAttachMenu(false);
                            viewOnceNextRef.current = false;
                            fileInputRef.current?.click();
                          }}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-on-surface hover:bg-surface-container transition-colors cursor-pointer text-left"
                        >
                          <span className="material-symbols-outlined text-[20px] text-primary">photo_library</span>
                          <span>Foto ou Vídeo</span>
                        </button>

                        {/* Foto ou vídeo que some depois de aberto */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowAttachMenu(false);
                            viewOnceNextRef.current = true;
                            fileInputRef.current?.click();
                          }}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-on-surface hover:bg-surface-container transition-colors cursor-pointer text-left"
                        >
                          <span className="material-symbols-outlined text-[20px] text-primary">timer</span>
                          <span>Foto temporária</span>
                        </button>

                        {/* Câmera (somente celular) */}
                        {isPhone && <button
                          type="button"
                          onClick={() => {
                            setShowAttachMenu(false);
                            cameraInputRef.current?.click();
                          }}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-on-surface hover:bg-surface-container transition-colors cursor-pointer text-left"
                        >
                          <span className="material-symbols-outlined text-[20px] text-secondary">photo_camera</span>
                          <span>Câmera</span>
                        </button>}

                        {/* Documento genérico */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowAttachMenu(false);
                            docInputRef.current?.click();
                          }}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-on-surface hover:bg-surface-container transition-colors cursor-pointer text-left"
                        >
                          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">description</span>
                          <span>Documento</span>
                        </button>

                        {/* Localização (somente celular) */}
                        {isMobile && <button
                          type="button"
                          onClick={handleSendLocation}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-on-surface hover:bg-surface-container transition-colors cursor-pointer text-left"
                        >
                          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">location_on</span>
                          <span>Localização</span>
                        </button>}
                      </div>
                    )}

                    {/* Input do Chat com Botões de Anexo, Emojis, GIFs e Enviar */}
                    <div className="p-2.5 sm:p-4 pb-[max(0.75rem,calc(env(safe-area-inset-bottom)+0.6rem))] bg-surface-container-lowest border-t border-outline-variant flex-shrink-0 z-20">
                      {editingMessage && (
                        <div className="mb-2.5 p-2.5 px-3.5 rounded-2xl bg-surface-container-low border-l-4 border-primary flex items-center justify-between text-xs">
                          <div className="min-w-0">
                            <span className="font-semibold text-primary block text-[11px]">Editando mensagem</span>
                            <span className="text-on-surface-variant text-[11px] block truncate">{editingMessage.content}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMessage(null);
                              setInputText('');
                            }}
                            aria-label="Cancelar edição"
                            className="p-1 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer shrink-0 ml-2"
                          >
                            <span className="material-symbols-outlined text-[16px]">close</span>
                          </button>
                        </div>
                      )}

                      {/* Barra de Citação ao Responder (Tarefa 3) */}
                      {replyingTo && (
                        <div className="mb-2.5 p-2.5 px-3.5 rounded-2xl bg-surface-container-low border-l-4 border-primary flex items-center justify-between text-xs animate-in fade-in slide-in-from-bottom-1 shadow-2xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="material-symbols-outlined text-primary text-[18px] shrink-0">reply</span>
                            <div className="min-w-0">
                              <span className="font-semibold text-primary block truncate text-[11px]">
                                Respondendo a @{replyingTo.sender_username}
                              </span>
                              <span className="text-on-surface-variant text-[11px] block truncate">
                                {replyingTo.content ||
                                  (replyingTo.message_type === 'image'
                                    ? '📷 Foto'
                                    : replyingTo.message_type === 'video'
                                    ? '🎥 Vídeo'
                                    : replyingTo.media_url
                                    ? '📎 Mídia'
                                    : 'Mensagem')}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setReplyingTo(null)}
                            className="p-1 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer shrink-0 ml-2"
                            title="Cancelar resposta"
                          >
                            <span className="material-symbols-outlined text-[16px]">close</span>
                          </button>
                        </div>
                      )}

                      {voice.recording ? (
                        <VoiceRecordingBar seconds={voice.seconds} onCancel={voice.cancel} onSend={() => void handleSendVoice()} />
                      ) : (
                      <form
                        onSubmit={handleSendMessage}
                        className="flex items-center gap-1.5 bg-surface-container-low rounded-full px-3 py-1.5 border border-outline-variant relative"
                      >
                        {/* Botão de Anexo (Clipe) */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowAttachMenu(!showAttachMenu);
                            setShowEmojiPicker(false);
                            setShowGifPicker(false);
                          }}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                            showAttachMenu
                              ? 'bg-primary-container text-on-primary'
                              : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                          }`}
                          title="Anexar arquivos, fotos ou localização"
                        >
                          <span className="material-symbols-outlined text-[20px]">attach_file</span>
                        </button>

                        {/* Botão de GIF / Stickers */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowGifPicker(!showGifPicker);
                            setShowAttachMenu(false);
                            setShowEmojiPicker(false);
                          }}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                            showGifPicker
                              ? 'bg-primary-container text-on-primary'
                              : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                          }`}
                          title="Buscar GIFs e Stickers"
                        >
                          <span className="material-symbols-outlined text-[20px]">gif_box</span>
                        </button>

                        {/* Botão de Emoji */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowEmojiPicker(!showEmojiPicker);
                            setShowAttachMenu(false);
                            setShowGifPicker(false);
                          }}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                            showEmojiPicker
                              ? 'bg-primary-container text-on-primary'
                              : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                          }`}
                          title="Inserir Emojis"
                        >
                          <span className="material-symbols-outlined text-[20px]">sentiment_satisfied</span>
                        </button>

                        {/* Campo de Texto Principal */}
                        <input
                          ref={inputRef}
                          type="text"
                          value={inputText}
                          onChange={handleInputChange}
                          aria-label={`Mensagem para @${activeFriend.username}`}
                          className="flex-1 bg-transparent border-0 outline-none text-xs text-on-surface placeholder:text-on-surface-variant px-2"
                        />

                        {!inputText.trim() && (
                          <button
                            type="button"
                            onClick={handleStartVoice}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
                            title="Gravar mensagem de voz"
                            aria-label="Gravar mensagem de voz"
                          >
                            <span className="material-symbols-outlined text-[20px]">mic</span>
                          </button>
                        )}

                        {/* Botão Enviar Mensagem */}
                        <button
                          type="submit"
                          disabled={!inputText.trim()}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-primary disabled:opacity-40 hover:bg-surface-container transition-all cursor-pointer"
                          title="Enviar mensagem"
                        >
                          <span className="material-symbols-outlined text-[20px]">send</span>
                        </button>
                      </form>
                      )}
                    </div>
                  </>
                )}
              </section>
              )}
            </div>
          )}
        </main>
      </div>

      {/* MODAL AMIGÁVEL: Limite de Tamanho / Duração Excedido */}
      {fileLimitWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant shadow-2xl flex flex-col gap-4 animate-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[28px]">warning</span>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-base text-on-surface">{fileLimitWarning.title}</h3>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                  {fileLimitWarning.message}
                </p>
              </div>
            </div>

            {fileLimitWarning.details && (
              <div className="p-3.5 rounded-2xl bg-surface-container-low text-xs text-on-surface-variant leading-relaxed border border-outline-variant">
                {fileLimitWarning.details}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setFileLimitWarning(null)}
                className="px-5 py-2.5 rounded-full bg-primary text-on-primary font-semibold text-xs hover:bg-primary/90 transition-all cursor-pointer shadow-sm shadow-primary/20"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Encaminhar Mensagem (Tarefa 3) */}
      {forwardModalMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant shadow-2xl flex flex-col gap-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">forward</span>
                <h3 className="font-bold text-base text-on-surface">Encaminhar Mensagem</h3>
              </div>
              <button
                type="button"
                onClick={() => setForwardModalMessage(null)}
                className="p-1.5 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Prévia da Mensagem a Encaminhar */}
            <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant text-xs">
              <span className="font-semibold text-primary block text-[11px] mb-0.5">
                @{forwardModalMessage.sender_username}
              </span>
              <p className="text-on-surface line-clamp-3">
                {forwardModalMessage.content ||
                  (forwardModalMessage.message_type === 'image'
                    ? '📷 Foto anexada'
                    : forwardModalMessage.message_type === 'video'
                    ? '🎥 Vídeo anexado'
                    : forwardModalMessage.media_url
                    ? '📎 Arquivo de mídia'
                    : 'Mensagem')}
              </p>
            </div>

            {/* Busca de Contatos para Encaminhar */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">
                search
              </span>
              <input
                type="text"
                value={forwardSearchQuery}
                onChange={(e) => setForwardSearchQuery(e.target.value)}
                placeholder="Buscar amigo para encaminhar..."
                className="w-full pl-9 pr-4 py-2 rounded-full bg-surface-container-low border border-outline-variant/40 text-on-surface text-xs focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container outline-none transition-all"
              />
            </div>

            {/* Lista de Amigos para Encaminhar */}
            <div className="max-h-60 overflow-y-auto space-y-1.5">
              {friends.filter((f) =>
                f.username.toLowerCase().includes(forwardSearchQuery.toLowerCase())
              ).length === 0 ? (
                <div className="text-center py-6 text-xs text-on-surface-variant">
                  Nenhum contato encontrado.
                </div>
              ) : (
                friends
                  .filter((f) =>
                    f.username.toLowerCase().includes(forwardSearchQuery.toLowerCase())
                  )
                  .map((friend) => (
                    <div
                      key={friend.friend_id}
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-surface-container-low hover:bg-surface-container transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary font-bold flex items-center justify-center text-xs uppercase shrink-0">
                          {friend.username.charAt(0)}
                        </div>
                        <span className="text-xs font-semibold text-on-surface truncate">
                          @{friend.username}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleForwardToFriend(friend)}
                        className="px-3.5 py-1.5 rounded-full bg-primary-container text-on-primary font-medium text-xs hover:bg-primary transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                      >
                        <span className="material-symbols-outlined text-[15px]">send</span>
                        <span>Encaminhar</span>
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Dados da Mensagem (Tarefa 3) */}
      {infoModalMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant shadow-2xl flex flex-col gap-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">info</span>
                <h3 className="font-bold text-base text-on-surface">Dados da Mensagem</h3>
              </div>
              <button
                type="button"
                onClick={() => setInfoModalMessage(null)}
                className="p-1.5 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-outline-variant/10">
                <span className="text-on-surface-variant">Remetente:</span>
                <span className="font-semibold text-on-surface">
                  {infoModalMessage.sender_id === user?.id ? 'Você' : `@${infoModalMessage.sender_username}`}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-outline-variant/10">
                <span className="text-on-surface-variant">Data e Hora:</span>
                <span className="font-semibold text-on-surface text-right">
                  {new Date(infoModalMessage.created_at).toLocaleString('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'medium',
                  })}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-outline-variant/10">
                <span className="text-on-surface-variant">Status de Entrega:</span>
                {infoModalMessage.status === 'read' ? (
                  <span className="text-primary font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px] font-bold">done_all</span>
                    Lido pelo destinatário
                  </span>
                ) : infoModalMessage.status === 'delivered' ? (
                  <span className="text-zinc-400 font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px]">done_all</span>
                    Entregue ao dispositivo
                  </span>
                ) : (
                  <span className="text-zinc-400 font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">check</span>
                    Enviado ao servidor
                  </span>
                )}
              </div>

              <div className="flex justify-between items-center py-1 border-b border-outline-variant/10">
                <span className="text-on-surface-variant">Tipo de Mensagem:</span>
                <span className="font-medium uppercase text-[11px] bg-surface-container-high px-2 py-0.5 rounded-full">
                  {infoModalMessage.message_type || 'texto'}
                </span>
              </div>

              {infoModalMessage.media_url && (
                <div className="pt-1 flex flex-col gap-1.5">
                  <span className="text-on-surface-variant">Link direto da mídia:</span>
                  <a
                    href={infoModalMessage.media_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline break-all text-[11px] p-2 rounded-xl bg-surface-container-low border border-outline-variant block"
                  >
                    {infoModalMessage.media_url}
                  </a>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setInfoModalMessage(null)}
                className="px-5 py-2 rounded-full bg-surface-container-high text-on-surface font-semibold text-xs hover:bg-surface-container transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onCreated={(gid) => {
            setShowCreateGroup(false);
            navigate(`/grupos/${gid}`);
          }}
        />
      )}

      {reportTarget && activeFriend && (
        <ReportModal
          userId={activeFriend.friend_id}
          username={activeFriend.username}
          messageId={reportTarget.messageId}
          onClose={() => setReportTarget(null)}
          onDone={({ blocked }) => {
            setReportTarget(null);
            if (blocked) {
              setFriends((prev) => prev.filter((f) => f.friend_id !== activeFriend.friend_id));
              setActiveFriend(null);
              refreshConversations();
            }
            setToastMessage(blocked ? 'Denúncia enviada e usuário bloqueado.' : 'Denúncia enviada. Obrigado por avisar.');
          }}
        />
      )}

      {showPrefs && <ChatPrefsModal prefs={prefs} onChange={updatePrefs} push={push} onClose={() => setShowPrefs(false)} />}

      {showCustomizer && activeFriend && (
        <ConversationCustomizer
          friendId={activeFriend.friend_id}
          username={activeFriend.username}
          settings={{
            theme: activeSettings?.theme || 'default',
            wallpaper: activeSettings?.wallpaper || 'none',
            nickname: activeSettings?.nickname || null,
          }}
          onSaved={(saved) => {
            setActiveSettings(saved);
            refreshConversations();
            setToastMessage('Conversa personalizada.');
          }}
          onClose={() => setShowCustomizer(false)}
        />
      )}

      {/* TOAST FLUTUANTE DE NOTIFICAÇÃO (Tarefa 3) */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-surface-container-highest text-on-surface px-4 py-2.5 rounded-full shadow-2xl border border-outline-variant/40 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2">
          <span className="material-symbols-outlined text-[18px] text-emerald-500">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
