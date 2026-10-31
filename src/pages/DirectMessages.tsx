import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { useSidebar } from '../context/SidebarContext';
import { authStorage, friendsApi, Friend, uploadApi } from '../lib/api';
import { EmptyState } from '../components/EmptyState';
import { useChat, ChatMessage, ChatMessageType } from '../hooks/useChat';

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

export const DirectMessages: React.FC = () => {
  const navigate = useNavigate();
  const { isExpanded } = useSidebar();
  const user = authStorage.getUser();
  const userId = user?.id;

  const [friends, setFriends] = useState<Friend[]>([]);
  const [activeFriend, setActiveFriend] = useState<Friend | null>(null);
  const [searchConv, setSearchConv] = useState('');
  const [inputText, setInputText] = useState('');
  const [loadingFriends, setLoadingFriends] = useState(true);

  // Estados de ações de mensagem (Responder, Encaminhar, Dados, Toast) - Tarefa 3
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [forwardModalMessage, setForwardModalMessage] = useState<ChatMessage | null>(null);
  const [forwardSearchQuery, setForwardSearchQuery] = useState('');
  const [infoModalMessage, setInfoModalMessage] = useState<ChatMessage | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auto-limpeza do toast
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  // Hook customizado de WebSocket para Chat em tempo real via Durable Objects
  const {
    messages,
    sendMessage,
    sendMediaMessage,
    deleteMessage,
    sendTyping,
    isOtherUserTyping,
    connectionStatus,
    loadingHistory,
    reconnect,
  } = useChat({
    activeFriendId: activeFriend?.friend_id,
    activeFriendUsername: activeFriend?.username,
  });

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
  const [gifResults, setGifResults] = useState<Array<{ id: string; url: string; title: string }>>(FALLBACK_GIFS);
  const [loadingGifs, setLoadingGifs] = useState(false);

  // Visualizador de Imagem Ampliada (Lightbox)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Modal para iniciar nova conversa / buscar pessoas
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: number; username: string; friendship_status: string | null }>>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  // Auto-scroll para a mensagem mais recente
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOtherUserTyping]);

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
        setActiveFriend(data[0]);
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
    sendTyping(true);

    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
    }
    typingTimerRef.current = window.setTimeout(() => {
      sendTyping(false);
    }, 2000);
  };

  // Envio de mensagem de texto normal pelo WebSocket (com suporte a resposta - Tarefa 4)
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeFriend || !user) return;

    const content = inputText.trim();
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
    if (file.size > MAX_CHAT_FILE_SIZE) {
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
      });
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
  const handleStartReply = (m: ChatMessage) => {
    setReplyingTo(m);
    inputRef.current?.focus();
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

  // Busca de GIFs na API do Giphy com fallback elegante
  useEffect(() => {
    if (!showGifPicker) return;

    const fetchGifs = async () => {
      setLoadingGifs(true);
      const query = gifSearchQuery.trim();
      const apiKey = 'sXpGFDGZs0Dv1mmNFvYaGUvYwKX0P4W3'; // Chave pública de teste do Giphy

      try {
        const endpoint = query
          ? `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=16&rating=g`
          : `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=16&rating=g`;

        const res = await fetch(endpoint);
        if (res.ok) {
          const data: any = await res.json();
          if (data && data.data && Array.isArray(data.data) && data.data.length > 0) {
            const formatted = data.data.map((g: any) => ({
              id: g.id,
              title: g.title || 'GIF',
              url: g.images?.fixed_height?.url || g.images?.downsized_medium?.url || g.images?.original?.url,
            }));
            setGifResults(formatted);
            setLoadingGifs(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Erro ao conectar na API do Giphy, usando fallback:', err);
      }

      // Fallback
      if (query) {
        setGifResults(
          FALLBACK_GIFS.filter((g) => g.title.toLowerCase().includes(query.toLowerCase()))
        );
      } else {
        setGifResults(FALLBACK_GIFS);
      }
      setLoadingGifs(false);
    };

    const timer = setTimeout(fetchGifs, 350);
    return () => clearTimeout(timer);
  }, [gifSearchQuery, showGifPicker]);

  const handleSelectGif = (gifUrl: string) => {
    sendMessage({
      type: 'gif',
      media_url: gifUrl,
      text: 'GIF',
    });
    setShowGifPicker(false);
    setGifSearchQuery('');
  };

  // Busca de usuários no modal de nova conversa
  useEffect(() => {
    if (!userSearchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const results = await friendsApi.search(userSearchQuery.trim());
        setSearchResults(results || []);
      } catch (err) {
        console.error('Erro ao buscar usuários:', err);
      } finally {
        setSearchingUsers(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [userSearchQuery]);

  const handleStartChatWithUser = async (targetUser: { id: number; username: string }) => {
    try {
      await friendsApi.add(targetUser.id, targetUser.username);
    } catch {}

    const newFriend: Friend = {
      friend_id: targetUser.id,
      username: targetUser.username,
      status: 'accepted',
      online: true,
    };
    setFriends((prev) => {
      const exists = prev.some((f) => f.friend_id === targetUser.id);
      return exists ? prev : [newFriend, ...prev];
    });
    setActiveFriend(newFriend);
    setShowNewChatModal(false);
    setUserSearchQuery('');
  };

  const filteredConversations = friends.filter((c) =>
    c.username.toLowerCase().includes(searchConv.toLowerCase())
  );

  // Renderizador rico de mensagens por tipo (Tarefa 3)
  // Renderizador rico de mensagens por tipo e verificação de media_url (Tarefa 2)
  const renderMessageContent = (m: ChatMessage, isMe: boolean) => {
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
            <img
              src={m.media_url}
              alt={m.content || 'Foto'}
              onClick={() => setPreviewImageUrl(m.media_url || null)}
              className="max-w-[200px] w-auto h-auto rounded-lg shadow-xs cursor-pointer hover:opacity-95 transition-opacity"
              loading="lazy"
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
          <div className="flex items-center gap-2.5 p-2 rounded-lg bg-surface-container-high/60 border border-outline-variant/30 min-w-[180px] max-w-[240px]">
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

      if (msgType === 'gif' || msgType === 'sticker') {
        return (
          <div className="max-w-[200px] rounded-lg overflow-hidden shadow-xs border border-outline-variant/30 bg-surface-container">
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
              <span className="material-symbols-outlined text-[18px] text-rose-500">pin_drop</span>
              <span className="text-xs font-bold text-on-surface">Localização Compartilhada</span>
            </div>
            <a
              href={m.media_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 rounded-xl bg-surface-container-high/70 hover:bg-surface-container transition-all flex items-center justify-between gap-2 border border-outline-variant/30 cursor-pointer group"
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
    return <p className="text-xs leading-relaxed whitespace-pre-wrap">{m.content}</p>;
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-surface text-on-surface flex flex-col fixed inset-0">
      <Header />
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
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl bg-surface-container-lowest border border-outline-variant/30 p-2">
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

      <div
        className={`pt-16 flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'pl-0 md:pl-64' : 'pl-0 md:pl-[72px]'
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
          ) : friends.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface">
              <div className="flex flex-col items-center gap-2.5 max-w-sm">
                <span className="material-symbols-outlined text-[48px] text-on-surface-variant/30 mb-1">
                  chat_bubble_outline
                </span>
                <h1 className="text-xl font-bold text-on-surface">Não há conversas</h1>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Suas mensagens diretas aparecerão aqui quando você iniciar uma nova conversa.
                </p>
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(true)}
                  className="mt-3 px-5 py-2.5 rounded-full bg-primary-container text-on-primary font-semibold text-xs hover:bg-primary shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  <span>Nova Conversa</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 w-full h-full overflow-hidden bg-surface">
              {/* COLUNA 1: Diretório Direct */}
              <aside className="w-80 lg:w-96 flex-shrink-0 flex flex-col bg-surface-container-lowest border-r border-outline-variant/30 shadow-xs z-10">
                <div className="p-4 pb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-bold text-base text-on-surface truncate">
                      @{user.username}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNewChatModal(true)}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-container-low text-on-surface hover:bg-primary-container hover:text-on-primary transition-colors cursor-pointer"
                    title="Nova Conversa"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit_square</span>
                  </button>
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
                      placeholder="Pesquisar conversas..."
                      className="w-full h-9 pl-9 pr-3 bg-surface-container-low text-on-surface placeholder:text-on-surface-variant rounded-full text-xs focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary-container outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Lista de Conversas / Amigos */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {filteredConversations.length === 0 ? (
                    <div className="text-center py-8 px-4 text-xs text-on-surface-variant">
                      <span className="material-symbols-outlined text-[28px] text-on-surface-variant/40 mb-1">
                        search_off
                      </span>
                      <p className="font-semibold text-on-surface">Nenhum resultado</p>
                      <p className="mt-1 text-[11px]">Nenhum amigo encontrado com essa busca.</p>
                    </div>
                  ) : (
                    filteredConversations.map((c) => (
                      <div
                        key={c.friend_id}
                        onClick={() => setActiveFriend(c)}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                          activeFriend?.friend_id === c.friend_id
                            ? 'bg-surface-container-low border border-outline-variant/30 shadow-xs'
                            : 'hover:bg-surface-container-low/60'
                        }`}
                      >
                        <div className="relative flex-shrink-0">
                          <div className="w-11 h-11 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-sm uppercase">
                            {c.username.charAt(0)}
                          </div>
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-surface-container-lowest" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-on-surface truncate">
                              @{c.username}
                            </span>
                            <span className="text-[11px] text-emerald-600 font-medium">
                              online
                            </span>
                          </div>
                          <p className="text-xs text-on-surface-variant truncate mt-0.5">
                            {c.mood || 'Disponível no Direct'}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </aside>

              {/* COLUNA 2: Conversa Ativa */}
              <section className="flex-1 flex flex-col bg-surface min-w-0 relative">
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
                    <div className="h-16 px-6 bg-surface-container-lowest border-b border-outline-variant/30 flex items-center justify-between shadow-xs z-10 flex-shrink-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-sm uppercase">
                            {activeFriend.username.charAt(0)}
                          </div>
                          <span
                            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-surface-container-lowest ${
                              connectionStatus === 'connected'
                                ? 'bg-emerald-500'
                                : connectionStatus === 'reconnecting'
                                ? 'bg-amber-500 animate-pulse'
                                : 'bg-gray-400'
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Link
                              to={`/perfil/${encodeURIComponent(activeFriend.username)}`}
                              className="font-semibold text-sm text-on-surface hover:text-primary hover:underline transition-colors truncate"
                            >
                              @{activeFriend.username}
                            </Link>
                          </div>
                          <div className="flex items-center gap-2 text-[11px]">
                            {connectionStatus === 'connected' ? (
                              <span className="text-emerald-600 font-medium flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Em tempo real
                              </span>
                            ) : connectionStatus === 'reconnecting' ? (
                              <span className="text-amber-500 font-medium flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px] animate-spin">sync</span>
                                Reconectando...
                              </span>
                            ) : (
                              <span className="text-on-surface-variant font-medium">
                                Conectando...
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Aviso de Reconexão */}
                    {connectionStatus === 'reconnecting' && (
                      <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 flex items-center justify-between text-xs text-amber-500 z-10 flex-shrink-0 animate-in fade-in">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                          <span>Reconectando... tentando restabelecer o WebSocket a cada 3s</span>
                        </div>
                        <button
                          type="button"
                          onClick={reconnect}
                          className="underline hover:text-amber-400 font-semibold cursor-pointer text-[11px]"
                        >
                          Tentar agora
                        </button>
                      </div>
                    )}

                    {/* Histórico de Mensagens */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      <div className="flex items-center justify-center">
                        <span className="text-[11px] text-on-surface-variant bg-surface-container-low px-3 py-1 rounded-full uppercase tracking-wider font-medium">
                          Conversa privada criptografada
                        </span>
                      </div>

                      {loadingHistory ? (
                        <div className="text-center py-8 text-xs text-on-surface-variant">
                          <span className="material-symbols-outlined text-[24px] text-primary animate-spin">
                            progress_activity
                          </span>
                          <p className="mt-1">Carregando histórico do chat...</p>
                        </div>
                      ) : messages.length === 0 ? (
                        <div className="py-8">
                          <EmptyState
                            icon="waving_hand"
                            title="Nenhuma mensagem ainda. Diga um oi!"
                            description={`Inicie a conversa em tempo real com @${activeFriend.username}. Envie fotos, vídeos, localização ou emojis.`}
                            className="max-w-md mx-auto"
                          />
                        </div>
                      ) : (
                        messages.map((m, idx) => {
                          const isMe = m.sender_id === user.id;

                          // Separador de datas (Tarefa 2)
                          const currentDateLabel = formatMessageDateSeparator(m.created_at);
                          const prevDateLabel =
                            idx > 0 ? formatMessageDateSeparator(messages[idx - 1].created_at) : null;
                          const showDateSeparator = currentDateLabel !== prevDateLabel;

                          // Agrupamento de mensagens consecutivas do mesmo remetente (Tarefa 2)
                          const prevMsg = idx > 0 ? messages[idx - 1] : null;
                          const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null;
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

                          return (
                            <React.Fragment key={m.id || `${m.created_at}-${idx}`}>
                              {/* Separador de Data Visual */}
                              {showDateSeparator && (
                                <div className="flex justify-center my-3 select-none">
                                  <span className="text-[11px] font-semibold text-on-surface-variant bg-surface-container-high/90 px-3.5 py-1 rounded-full shadow-xs border border-outline-variant/20">
                                    {currentDateLabel}
                                  </span>
                                </div>
                              )}

                              <div
                                id={`msg-${m.id}`}
                                className={`group relative flex items-end gap-2 max-w-xl ${marginTopClass} ${
                                  isMe ? 'ml-auto justify-end' : 'mr-auto justify-start'
                                }`}
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

                                <div className="relative flex flex-col max-w-[85%] sm:max-w-md">
                                  {/* Menu Flutuante de Ações no Hover (Tarefa 3) */}
                                  <div
                                    className={`absolute -top-3.5 z-20 opacity-0 group-hover:opacity-100 transition-all duration-150 bg-surface-container-high/95 backdrop-blur-md border border-outline-variant/40 rounded-full shadow-lg px-1 py-0.5 flex items-center gap-0.5 scale-95 group-hover:scale-100 ${
                                      isMe ? 'right-2' : 'left-2'
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => handleStartReply(m)}
                                      className="p-1 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                                      title="Responder"
                                    >
                                      <span className="material-symbols-outlined text-[15px]">reply</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setForwardModalMessage(m)}
                                      className="p-1 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                                      title="Encaminhar"
                                    >
                                      <span className="material-symbols-outlined text-[15px]">forward</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleCopyMessage(m)}
                                      className="p-1 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                                      title="Copiar texto"
                                    >
                                      <span className="material-symbols-outlined text-[15px]">content_copy</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setInfoModalMessage(m)}
                                      className="p-1 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                                      title="Dados da Mensagem"
                                    >
                                      <span className="material-symbols-outlined text-[15px]">info</span>
                                    </button>

                                    {isMe && m.id && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteMessage(m.id!)}
                                        className="p-1 rounded-full hover:bg-error/15 text-error transition-colors cursor-pointer"
                                        title="Excluir Mensagem"
                                      >
                                        <span className="material-symbols-outlined text-[15px]">delete</span>
                                      </button>
                                    )}
                                  </div>

                                  {/* Balão de Mensagem */}
                                  <div
                                    className={`p-3 text-xs leading-relaxed shadow-xs transition-all ${
                                      isMe
                                        ? `bg-primary-container text-on-primary rounded-2xl ${
                                            isFirstInBlock ? 'rounded-tr-2xl' : 'rounded-tr-md'
                                          } ${isLastInBlock ? 'rounded-br-xs' : 'rounded-br-md'} rounded-l-2xl`
                                        : `bg-surface-container-low text-on-surface rounded-2xl border border-outline-variant/30 ${
                                            isFirstInBlock ? 'rounded-tl-2xl' : 'rounded-tl-md'
                                          } ${isLastInBlock ? 'rounded-bl-xs' : 'rounded-bl-md'} rounded-r-2xl`
                                    }`}
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

                                  {/* Timestamp visível na última mensagem do grupo */}
                                  {isLastInBlock && (
                                    <span
                                      className={`text-[10px] text-on-surface-variant mt-0.5 ${
                                        isMe ? 'text-right mr-1' : 'ml-1'
                                      }`}
                                    >
                                      {new Date(m.created_at).toLocaleTimeString('pt-BR', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </React.Fragment>
                          );
                        })
                      )}

                      {/* Estado: Usuário Digitando... */}
                      {isOtherUserTyping && (
                        <div className="flex items-center gap-2 text-xs text-on-surface-variant italic pl-2 py-1 animate-pulse">
                          <div className="flex gap-1 items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.2s]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.4s]" />
                          </div>
                          <span>@{activeFriend.username} está digitando...</span>
                        </div>
                      )}

                      <div ref={messagesEndRef} />
                    </div>

                    {/* Barra de Progresso Real de Upload */}
                    {isUploading && (
                      <div className="px-6 py-2.5 bg-surface-container-low border-t border-outline-variant/20 flex flex-col gap-1.5 animate-in fade-in">
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
                        className="absolute bottom-20 left-4 sm:left-12 z-30 shadow-2xl rounded-3xl overflow-hidden border border-outline-variant/30 animate-in fade-in slide-in-from-bottom-2 max-h-[300px] flex flex-col bg-surface-container-lowest"
                        style={{
                          ['--rgb-background' as any]: '18, 18, 18',
                          ['--rgb-input' as any]: '24, 24, 27',
                          ['--rgb-accent' as any]: '168, 85, 247',
                          ['--rgb-color' as any]: '244, 244, 245',
                        }}
                      >
                        <div className="flex items-center justify-between px-3.5 py-1.5 bg-surface-container-lowest border-b border-outline-variant/20">
                          <span className="text-[11px] font-semibold text-on-surface-variant flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-primary" />
                            Emojis
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowEmojiPicker(false)}
                            className="p-1 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                            title="Fechar seletor"
                          >
                            <span className="material-symbols-outlined text-[16px]">close</span>
                          </button>
                        </div>
                        <div className="overflow-y-auto max-h-[260px]">
                          <Picker
                            data={data}
                            onEmojiSelect={handleSelectEmoji}
                            theme="dark"
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

                    {/* Popover de GIFs / Stickers */}
                    {showGifPicker && (
                      <div className="absolute bottom-20 left-16 z-30 bg-surface-container-lowest rounded-2xl p-4 shadow-2xl border border-outline-variant/30 w-80 sm:w-96 animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-3">
                        <div className="flex items-center justify-between pb-1 border-b border-outline-variant/20">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[18px] text-primary">gif_box</span>
                            <span className="text-xs font-bold text-on-surface">Buscar GIFs & Stickers</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowGifPicker(false)}
                            className="text-on-surface-variant hover:text-on-surface cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">close</span>
                          </button>
                        </div>

                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">
                            search
                          </span>
                          <input
                            type="text"
                            value={gifSearchQuery}
                            onChange={(e) => setGifSearchQuery(e.target.value)}
                            placeholder="Pesquisar no Giphy..."
                            className="w-full pl-8 pr-3 py-1.5 rounded-full bg-surface-container-low text-xs text-on-surface placeholder:text-on-surface-variant outline-none focus:ring-1 focus:ring-primary-container"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto p-0.5">
                          {loadingGifs ? (
                            <div className="col-span-2 text-center py-8 text-xs text-on-surface-variant">
                              <span className="material-symbols-outlined text-[20px] text-primary animate-spin">
                                progress_activity
                              </span>
                              <p className="mt-1">Carregando GIFs...</p>
                            </div>
                          ) : gifResults.length === 0 ? (
                            <div className="col-span-2 text-center py-6 text-xs text-on-surface-variant">
                              Nenhum GIF encontrado.
                            </div>
                          ) : (
                            gifResults.map((gif) => (
                              <div
                                key={gif.id}
                                onClick={() => handleSelectGif(gif.url)}
                                className="relative rounded-xl overflow-hidden aspect-video bg-surface-container cursor-pointer hover:opacity-80 transition-opacity border border-outline-variant/20 shadow-2xs group"
                              >
                                <img
                                  src={gif.url}
                                  alt={gif.title}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* Popover do Menu de Anexos (Clipe) */}
                    {showAttachMenu && (
                      <div className="absolute bottom-20 left-4 z-30 bg-surface-container-lowest rounded-2xl p-2 shadow-2xl border border-outline-variant/30 flex flex-col gap-1 w-52 animate-in fade-in slide-in-from-bottom-2">
                        {/* Foto ou Vídeo */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowAttachMenu(false);
                            fileInputRef.current?.click();
                          }}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-on-surface hover:bg-surface-container transition-colors cursor-pointer text-left"
                        >
                          <span className="material-symbols-outlined text-[20px] text-primary">photo_library</span>
                          <span>Foto ou Vídeo</span>
                        </button>

                        {/* Câmera */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowAttachMenu(false);
                            cameraInputRef.current?.click();
                          }}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-on-surface hover:bg-surface-container transition-colors cursor-pointer text-left"
                        >
                          <span className="material-symbols-outlined text-[20px] text-secondary">photo_camera</span>
                          <span>Câmera</span>
                        </button>

                        {/* Documento genérico */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowAttachMenu(false);
                            docInputRef.current?.click();
                          }}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-on-surface hover:bg-surface-container transition-colors cursor-pointer text-left"
                        >
                          <span className="material-symbols-outlined text-[20px] text-indigo-500">description</span>
                          <span>Documento</span>
                        </button>

                        {/* Localização */}
                        <button
                          type="button"
                          onClick={handleSendLocation}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-on-surface hover:bg-surface-container transition-colors cursor-pointer text-left"
                        >
                          <span className="material-symbols-outlined text-[20px] text-rose-500">location_on</span>
                          <span>Localização</span>
                        </button>
                      </div>
                    )}

                    {/* Input do Chat com Botões de Anexo, Emojis, GIFs e Enviar */}
                    <div className="p-4 bg-surface-container-lowest border-t border-outline-variant/30 flex-shrink-0">
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

                      <form
                        onSubmit={handleSendMessage}
                        className="flex items-center gap-1.5 bg-surface-container-low rounded-full px-3 py-1.5 border border-outline-variant/30 relative"
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
                          placeholder={`Mensagem para @${activeFriend.username}...`}
                          className="flex-1 bg-transparent border-0 outline-none text-xs text-on-surface placeholder:text-on-surface-variant px-2"
                        />

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
                    </div>
                  </>
                )}
              </section>
            </div>
          )}
        </main>
      </div>

      {/* MODAL: Nova Conversa / Buscar Amigos */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">person_search</span>
                <h3 className="font-bold text-base text-on-surface">Buscar Amigos no Espectro</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewChatModal(false)}
                className="p-1.5 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none">
                search
              </span>
              <input
                type="text"
                autoFocus
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Digitar nome de usuário..."
                className="w-full pl-10 pr-4 py-2.5 rounded-full bg-surface-container-low border border-outline-variant/40 text-on-surface text-xs focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container outline-none transition-all"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {searchingUsers ? (
                <div className="text-center py-6 text-xs text-on-surface-variant">
                  <span className="material-symbols-outlined text-[22px] text-primary animate-spin">
                    progress_activity
                  </span>
                  <p className="mt-1">Procurando usuários...</p>
                </div>
              ) : userSearchQuery.trim() && searchResults.length === 0 ? (
                <div className="text-center py-6 text-xs text-on-surface-variant">
                  <p className="font-medium">Nenhum usuário encontrado com "{userSearchQuery}".</p>
                </div>
              ) : (
                searchResults.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-surface-container-low hover:bg-surface-container transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary font-bold flex items-center justify-center text-xs uppercase">
                        {u.username.charAt(0)}
                      </div>
                      <span className="text-xs font-semibold text-on-surface">@{u.username}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleStartChatWithUser(u)}
                      className="px-3.5 py-1.5 rounded-full bg-primary-container text-on-primary font-medium text-xs hover:bg-primary transition-all cursor-pointer"
                    >
                      Conversar
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {/* MODAL AMIGÁVEL: Limite de Tamanho / Duração Excedido */}
      {fileLimitWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95">
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
              <div className="p-3.5 rounded-2xl bg-surface-container-low text-xs text-on-surface-variant leading-relaxed border border-outline-variant/20">
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
          <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
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
            <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-xs">
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
          <div className="w-full max-w-sm bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
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
                <span className="text-emerald-500 font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px]">done_all</span>
                  Entregue em tempo real
                </span>
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
                    className="text-primary hover:underline break-all text-[11px] p-2 rounded-xl bg-surface-container-low border border-outline-variant/20 block"
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
