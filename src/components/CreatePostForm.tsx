import React, { useState, useRef, useEffect } from 'react';
import { hashtagsApi } from '../lib/api';
import { hashtagAtCursor } from '../lib/hashtags';
import { useDropzone } from 'react-dropzone';
import { ImageCropperModal } from './ImageCropperModal';
import { authStorage, Community, CreatePostData, uploadApi } from '../lib/api';
import { useIsPhone } from '../hooks/useIsPhone';
import {
  DEFAULT_SCRAP_STYLE,
  SCRAP_FONTS,
  SCRAP_INK_COLORS,
  SCRAP_PAPERS,
  SCRAP_SIZES,
  ScrapFont,
  ScrapPaper,
  ScrapSize,
  ScrapStyle,
  encodeScrap,
  scrapPaperStyle,
} from '../lib/scrapStyle';

interface CreatePostFormProps {
  onPostCreated: (data: CreatePostData) => Promise<void>;
  communities?: Community[];
  defaultCommunityId?: number | null;
  onClose?: () => void;
  isModal?: boolean;
}

const DRAFT_STORAGE_KEY = 'espectro_composer_draft';
// Mesmo limite que a API aceita para publicações
const POST_CONTENT_MAX = 2000;

export const CreatePostForm: React.FC<CreatePostFormProps> = ({
  onPostCreated,
  communities = [],
  defaultCommunityId = null,
  onClose,
  isModal = false,
}) => {
  const user = authStorage.getUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const isPhone = useIsPhone();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [postType, setPostType] = useState<'discussion' | 'scrap'>('discussion');
  const [title, setTitle] = useState('');
  const [scrapStyle, setScrapStyle] = useState<ScrapStyle>(DEFAULT_SCRAP_STYLE);
  const [content, setContent] = useState('');
  // Sugestões de hashtag enquanto a pessoa digita #palavra
  const [tagSuggestions, setTagSuggestions] = useState<Array<{ tag: string; posts: number }>>([]);
  const tagTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleContentChange = (value: string, cursor: number) => {
    setContent(value);
    if (tagTimerRef.current) clearTimeout(tagTimerRef.current);
    const word = hashtagAtCursor(value, cursor);
    if (!word) {
      setTagSuggestions([]);
      return;
    }
    tagTimerRef.current = setTimeout(() => {
      hashtagsApi.suggest(word).then(setTagSuggestions).catch(() => setTagSuggestions([]));
    }, 200);
  };
  const applyTag = (tag: string) => {
    const ta = textareaRef.current;
    const cursor = ta?.selectionStart ?? content.length;
    const replaced = content.slice(0, cursor).replace(/#([\p{L}\p{N}_]{1,50})$/u, `#${tag} `);
    setContent(replaced + content.slice(cursor));
    setTagSuggestions([]);
    setTimeout(() => {
      ta?.focus();
      ta?.setSelectionRange(replaced.length, replaced.length);
    }, 0);
  };
  const [communityId, setCommunityId] = useState<number | ''>(defaultCommunityId || '');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [fileAccept, setFileAccept] = useState('image/*,video/*');

  // Estados para Drag & Drop e Recorte Profissional (Tarefas 1, 2, 3 e 4)
  const [pendingCropImage, setPendingCropImage] = useState<{ src: string; fileName: string } | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [videoFileName, setVideoFileName] = useState<string | null>(null);

  // Estados de submissão e upload
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isDraftRestored, setIsDraftRestored] = useState(false);

  // 1. Carrega Rascunho salvo do localStorage ao montar o componente
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.title) setTitle(data.title);
        if (data.content) setContent(data.content);
        if (data.postType) setPostType(data.postType);
        if (data.communityId !== undefined && data.communityId !== '') {
          setCommunityId(data.communityId);
        }
        if (data.mediaUrl) setMediaUrl(data.mediaUrl);
        if (data.mediaType) setMediaType(data.mediaType);
        if (data.scrapStyle) setScrapStyle(data.scrapStyle);

        if (data.title || data.content || data.mediaUrl) {
          setIsDraftRestored(true);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // 2. Salva o rascunho automaticamente sempre que houver alteração
  useEffect(() => {
    if (title.trim() || content.trim() || mediaUrl.trim()) {
      try {
        localStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({
            title,
            content,
            postType,
            communityId,
            mediaUrl,
            mediaType,
            scrapStyle,
            updatedAt: new Date().toISOString(),
          })
        );
      } catch {
        // ignore
      }
    }
  }, [title, content, postType, communityId, mediaUrl, mediaType, scrapStyle]);

  // Descartar rascunho
  const handleDiscardDraft = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
    setTitle('');
    setContent('');
    setMediaUrl('');
    setMediaType(null);
    setLocalPreviewUrl(null);
    setVideoFileName(null);
    setIsDraftRestored(false);
  };

  // Tratar fechamento do modal salvando o rascunho
  const handleClose = () => {
    if (uploading && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (onClose) {
      onClose();
    }
  };

  // Inserção de Markdown simples (Negrito, Itálico, Link)
  const insertMarkdown = (prefix: string, suffix: string = prefix, placeholder: string = 'texto') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = textarea.value;
    const selected = currentVal.substring(start, end);

    const textToInsert = selected || placeholder;
    const newContent =
      currentVal.substring(0, start) +
      prefix +
      textToInsert +
      suffix +
      currentVal.substring(end);

    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      const newStart = start + prefix.length;
      const newEnd = newStart + textToInsert.length;
      textarea.setSelectionRange(newStart, newEnd);
    }, 15);
  };

  const handleTriggerUpload = (type: 'image' | 'video') => {
    if (type === 'video') {
      setFileAccept('video/mp4,video/webm,video/quicktime,video/ogg,video/m4v');
    } else {
      setFileAccept('image/jpeg,image/png,image/gif,image/webp,image/svg+xml');
    }
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 50);
  };

  // Cancelar upload de vídeo/mídia em andamento
  const handleCancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setUploading(false);
    setUploadProgress(0);
    setUploadMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setError('Envio cancelado.');
  };

  // Upload direto para o Cloudflare R2 (/api/upload)
  const uploadFileDirectly = async (file: File, type: 'image' | 'video') => {
    setUploading(true);
    setUploadProgress(0);
    setUploadMessage(type === 'video' ? 'Enviando seu vídeo para o R2...' : 'Enviando foto otimizada para o R2...');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await uploadApi.upload(file, {
        signal: controller.signal,
        onProgress: (percent) => {
          setUploadProgress(percent);
        },
      });

      setMediaUrl(response.url);
      setMediaType(response.media_type || type);
      setUploadProgress(100);
    } catch (err: any) {
      if (err.message?.includes('cancelado')) {
        setError('Envio cancelado.');
      } else {
        setError(err.message || 'Falha ao enviar arquivo para o R2.');
      }
      setLocalPreviewUrl(null);
      setVideoFileName(null);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadMessage('');
      abortControllerRef.current = null;
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Processa arquivo selecionado (seja por clique ou drag-and-drop)
  const processSelectedFile = (file: File) => {
    setError(null);

    // Validação de limite máximo de 10MB (Tarefa 1)
    if (file.size > 10 * 1024 * 1024) {
      setError('O arquivo excede o limite máximo permitido de 10MB.');
      return;
    }

    const isVid = file.type.startsWith('video/') || /\.(mp4|webm|mov|ogg|m4v)$/i.test(file.name);

    if (isVid) {
      // Tarefa 4: Para vídeos, não faz recorte. Mostra miniatura com play e envia direto
      setVideoFileName(file.name);
      setMediaType('video');
      uploadFileDirectly(file, 'video');
    } else {
      // Tarefa 2: Para imagens, abre o modal de recorte com react-easy-crop
      const objectUrl = URL.createObjectURL(file);
      setPendingCropImage({
        src: objectUrl,
        fileName: file.name,
      });
    }
  };

  // Confirmação do recorte: recebe imagem recortada e comprimida (Tarefas 2 e 3)
  const handleConfirmCrop = async (croppedFile: File, previewUrl: string) => {
    setPendingCropImage(null);
    setLocalPreviewUrl(previewUrl);
    setVideoFileName(null);
    await uploadFileDirectly(croppedFile, 'image');
  };

  // Seletor nativo de arquivos
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processSelectedFile(file);
  };

  // Configuração do react-dropzone para arrastar e soltar (Tarefa 1)
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    noClick: true,
    noKeyboard: true,
    maxSize: 10 * 1024 * 1024, // 10MB
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif', '.svg'],
      'video/*': ['.mp4', '.webm', '.mov', '.ogg', '.m4v'],
    },
    onDropAccepted: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        processSelectedFile(acceptedFiles[0]);
      }
    },
    onDropRejected: (fileRejections) => {
      const first = fileRejections[0];
      const isTooLarge = first?.errors?.some((e) => e.code === 'file-too-large');
      if (isTooLarge) {
        setError('O arquivo excede o limite máximo permitido de 10MB.');
      } else {
        setError('Formato não suportado. Envie imagens ou vídeos até 10MB.');
      }
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!user) {
      setError('Você precisa estar conectado para publicar.');
      return;
    }

    const hasMedia = Boolean(mediaUrl && mediaUrl.trim());

    if (postType === 'discussion' && !hasMedia && !title.trim()) {
      setError('Discussões sem mídia precisam ter um título.');
      return;
    }

    const finalContent = content.trim();

    if (!finalContent.trim() && !hasMedia) {
      setError('Escreva algo ou anexe uma foto/vídeo para publicar.');
      return;
    }

    setSubmitting(true);
    try {
      let resolvedMediaType = mediaType;
      if (mediaUrl.trim() && !resolvedMediaType) {
        const isVid = /\.(mp4|webm|mov|ogg|m4v)($|\?)/i.test(mediaUrl) || mediaUrl.includes('/videos/');
        resolvedMediaType = isVid ? 'video' : 'image';
      }

      await onPostCreated({
        title: (postType === 'discussion' && title.trim()) ? title.trim() : undefined,
        content: postType === 'scrap' ? encodeScrap(scrapStyle, finalContent) : finalContent,
        post_type: postType,
        community_id: communityId === '' ? undefined : Number(communityId),
        media_url: mediaUrl.trim() || undefined,
        media_type: mediaUrl.trim() ? resolvedMediaType : undefined,
      });

      // Limpa rascunho após publicar com sucesso
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // ignore
      }

      setTitle('');
      setContent('');
      setMediaUrl('');
      setMediaType(null);
      setIsDraftRestored(false);
      setSuccess(true);

      if (isModal && onClose) {
        setTimeout(() => onClose(), 500);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao criar publicação.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center gap-3">
        <span className="material-symbols-outlined text-4xl text-on-surface-variant">lock</span>
        <p className="text-sm font-semibold">Faça login para criar publicações no Espectro.</p>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className="w-full h-full flex flex-col justify-between overflow-hidden bg-surface-container-lowest relative"
    >
      {/* react-dropzone input invisível */}
      <input {...getInputProps()} />

      {/* Câmera do celular: abre direto a câmera traseira e passa pelo mesmo recorte das fotos */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Input de arquivo nativo invisível para os botões Foto/Vídeo */}
      <input
        type="file"
        ref={fileInputRef}
        accept={fileAccept}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Overlay de Drag and Drop (Tarefa 1) */}
      {isDragActive && (
        <div className="absolute inset-0 z-50 rounded-2xl bg-black/85 backdrop-blur-sm border-2 border-dashed border-primary flex flex-col items-center justify-center gap-3 text-white pointer-events-none animate-in fade-in duration-150">
          <div className="w-16 h-16 rounded-full bg-primary-container/30 flex items-center justify-center text-primary animate-bounce">
            <span className="material-symbols-outlined text-4xl">cloud_upload</span>
          </div>
          <div className="text-center">
            <p className="font-bold text-base sm:text-lg">Solte a mídia aqui</p>
            <p className="text-xs text-zinc-300 mt-0.5">Fotos ou vídeos até 10MB</p>
          </div>
        </div>
      )}

      {/* Modal de Recorte de Imagem (Tarefa 2 & 3) */}
      {pendingCropImage && (
        <ImageCropperModal
          imageSrc={pendingCropImage.src}
          originalFileName={pendingCropImage.fileName}
          onConfirmCrop={handleConfirmCrop}
          onCancel={() => {
            URL.revokeObjectURL(pendingCropImage.src);
            setPendingCropImage(null);
          }}
        />
      )}

      {/* 1. TOPO FIXO (Header do Modal): Botão X à esquerda e título "Criar Publicação" */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] border-b border-zinc-800/80 bg-surface-container-lowest shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
            title="Fechar"
            aria-label="Fechar"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
          <h1 className="text-base sm:text-lg font-bold text-on-surface tracking-tight">
            Criar Publicação
          </h1>
        </div>

        {/* Descartar Rascunho (se houver rascunho recuperado) */}
        {isDraftRestored && (
          <button
            type="button"
            onClick={handleDiscardDraft}
            className="text-xs text-error hover:underline flex items-center gap-1 cursor-pointer font-medium"
            title="Descartar rascunho salvo"
          >
            <span className="material-symbols-outlined text-[15px]">delete</span>
            <span className="hidden sm:inline">Descartar rascunho</span>
          </button>
        )}
      </header>

      {/* 2. ABAS DE TIPO (Logo abaixo do Header): Botões Pílula (Discussão vs Scrap Nostálgico) */}
      <div className="flex items-center gap-2 px-4 sm:px-6 py-2.5 border-b border-zinc-800/60 bg-surface-container-lowest shrink-0">
        <button
          type="button"
          onClick={() => setPostType('discussion')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            postType === 'discussion'
              ? 'bg-primary-container text-on-primary shadow-xs'
              : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">forum</span>
          <span>Discussão</span>
        </button>
        <button
          type="button"
          onClick={() => setPostType('scrap')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            postType === 'scrap'
              ? 'bg-primary-container text-on-primary shadow-xs'
              : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">auto_stories</span>
          <span>Scrap Nostálgico</span>
        </button>
      </div>

      {/* 3. CORPO CENTRAL INTEGRADO (Scroll Interno) */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 flex flex-col gap-3 min-h-0">
        {/* Alertas de Erro ou Sucesso */}
        {error && (
          <div className="p-3 rounded-2xl bg-error-container text-error text-xs font-medium flex items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-error hover:opacity-80"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        {success && (
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 text-xs font-semibold flex items-center gap-2 border border-emerald-500/20 animate-in fade-in">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>Publicado com sucesso no Espectro!</span>
          </div>
        )}

        {/* Upload Progress com visual limpo */}
        {uploading && (
          <div className="p-3.5 rounded-2xl bg-surface-container border border-outline-variant flex flex-col gap-2 shadow-sm animate-in fade-in">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                <span className="text-xs font-semibold text-on-surface truncate">
                  {uploadMessage}
                </span>
                <span className="text-xs font-bold text-primary font-mono shrink-0">
                  {uploadProgress}%
                </span>
              </div>
              <button
                type="button"
                onClick={handleCancelUpload}
                className="px-2.5 py-1 rounded-xl bg-error-container/30 text-error hover:bg-error-container text-xs font-semibold transition-colors cursor-pointer shrink-0"
              >
                Cancelar
              </button>
            </div>
            <div className="w-full h-1.5 rounded-full bg-surface-container-high overflow-hidden">
              <div
                className="h-full bg-primary-container transition-all duration-150 ease-out rounded-full"
                style={{ width: `${Math.max(5, uploadProgress)}%` }}
              />
            </div>
          </div>
        )}

        {/* Autor + Campo de Título (Se Discussão) */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary font-bold flex items-center justify-center text-sm uppercase shrink-0 shadow-xs">
            {user.username.charAt(0)}
          </div>

          <div className="flex-1 flex flex-col gap-2 min-w-0">
            {/* Input de Título: visível apenas na aba "Discussão" */}
            {postType === 'discussion' && (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={mediaUrl.trim() ? "Título da sua discussão (opcional)..." : "Título da sua discussão..."}
                className="w-full bg-transparent text-on-surface font-bold text-base sm:text-lg placeholder:text-on-surface-variant/50 focus:outline-none border-b border-outline-variant pb-2 transition-all"
                autoFocus={!mediaUrl.trim()}
              />
            )}

            {/* Barra de Formatação Básica (apenas para Discussão) */}
            {postType === 'discussion' && (
              <div className="flex items-center justify-between py-1 text-xs text-on-surface-variant">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => insertMarkdown('**', '**', 'negrito')}
                    className="p-1.5 rounded hover:bg-surface-container font-bold text-on-surface transition-colors cursor-pointer"
                    title="Negrito"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('*', '*', 'itálico')}
                    className="p-1.5 rounded hover:bg-surface-container italic font-serif text-on-surface transition-colors cursor-pointer"
                    title="Itálico"
                  >
                    I
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('`', '`', 'código')}
                    className="p-1.5 rounded hover:bg-surface-container font-mono text-xs transition-colors cursor-pointer"
                    title="Código"
                  >
                    &lt;/&gt;
                  </button>
                </div>
                <span className="text-[11px] font-mono text-on-surface-variant/70">
                  {content.length}/{POST_CONTENT_MAX} caracteres
                </span>
              </div>
            )}

            {/* PERSONALIZAÇÃO DE GRAFIA PARA O SCRAP (Nostalgia Orkut: Fontes, Cores, Tamanho e Papel) */}
            {postType === 'scrap' && (
              <div className="flex flex-col gap-2.5 p-3 rounded-2xl bg-surface-container-low border border-outline-variant animate-in fade-in">
                {/* Seletor de Fontes Nostálgicas */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider w-12">
                    Fonte
                  </span>
                  {(Object.keys(SCRAP_FONTS) as ScrapFont[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setScrapStyle((s) => ({ ...s, f: k }))}
                      style={{ fontFamily: SCRAP_FONTS[k].family }}
                      className={`px-3 py-1 rounded-full text-xs transition-all cursor-pointer border ${
                        scrapStyle.f === k
                          ? 'border-primary bg-primary-container/15 text-primary font-bold shadow-xs'
                          : 'border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                      }`}
                    >
                      {SCRAP_FONTS[k].label}
                    </button>
                  ))}
                </div>

                {/* Linha de Tamanho, Tinta e Papel */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 border-t border-outline-variant">
                  {/* Tamanho da Letra */}
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider w-12">
                      Tam.
                    </span>
                    {(Object.keys(SCRAP_SIZES) as ScrapSize[]).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setScrapStyle((s) => ({ ...s, s: k }))}
                        className={`w-8 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                          scrapStyle.s === k
                            ? 'border-primary bg-primary-container/15 text-primary'
                            : 'border-outline-variant text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        {SCRAP_SIZES[k].label}
                      </button>
                    ))}
                  </div>

                  {/* Cor da Tinta / Texto */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                      Cor
                    </span>
                    {SCRAP_INK_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={`Tinta ${color}`}
                        onClick={() => setScrapStyle((s) => ({ ...s, c: color }))}
                        style={{ backgroundColor: color }}
                        className={`w-5 h-5 rounded-full cursor-pointer transition-transform ${
                          scrapStyle.c === color
                            ? 'ring-2 ring-offset-2 ring-offset-surface-container-low ring-blue-500 scale-110'
                            : 'hover:scale-110'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Textura do Papel */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                      Papel
                    </span>
                    {(Object.keys(SCRAP_PAPERS) as ScrapPaper[]).map((k) => (
                      <button
                        key={k}
                        type="button"
                        title={SCRAP_PAPERS[k].label}
                        aria-label={`Papel ${SCRAP_PAPERS[k].label}`}
                        onClick={() => setScrapStyle((s) => ({ ...s, p: k }))}
                        style={{ backgroundColor: SCRAP_PAPERS[k].bg }}
                        className={`w-5 h-5 rounded-md cursor-pointer transition-transform ${
                          scrapStyle.p === k
                            ? 'ring-2 ring-offset-2 ring-offset-surface-container-low ring-blue-500 scale-110'
                            : 'hover:scale-110'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ÁREA DE TEXTO INTEGRADA (min-h-[150px]) */}
            {postType === 'scrap' ? (
              /* Estilo Scrap: O textarea se transforma no recado estilizado */
              <div className="relative mt-2 -rotate-[0.5deg]">
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-20 h-5 bg-white/50 backdrop-blur-xs rotate-[-3deg] shadow-sm z-10 pointer-events-none" />
                <textarea
                  id="composer-textarea"
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value, e.target.selectionStart)}
                maxLength={POST_CONTENT_MAX}
                  placeholder="Escreva seu scrap nostálgico aqui..."
                  rows={6}
                  style={scrapPaperStyle(scrapStyle)}
                  className="w-full min-h-[170px] rounded-sm px-5 pt-7 pb-5 shadow-lg focus:outline-none resize-none placeholder:opacity-50 placeholder:text-current"
                  autoFocus
                />
              </div>
            ) : (
              /* Estilo Discussão: Textarea integrado estilo Twitter/Reddit */
              <textarea
                id="composer-textarea"
                ref={textareaRef}
                value={content}
                onChange={(e) => handleContentChange(e.target.value, e.target.selectionStart)}
                maxLength={POST_CONTENT_MAX}
                placeholder="O que você gostaria de discutir ou compartilhar hoje?"
                rows={6}
                className="w-full min-h-[160px] bg-transparent text-on-surface text-sm sm:text-base placeholder:text-on-surface-variant/40 focus:outline-none resize-none leading-relaxed"
              />
            )}

            {tagSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2" role="listbox" aria-label="Sugestões de hashtag">
                {tagSuggestions.map((t) => (
                  <button
                    key={t.tag}
                    type="button"
                    role="option"
                    aria-selected="false"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyTag(t.tag)}
                    className="h-8 px-3 rounded-full border border-outline-variant text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:border-on-surface cursor-pointer"
                  >
                    #{t.tag}
                    {t.posts > 0 && <span className="ml-1.5 font-normal">{t.posts}</span>}
                  </button>
                ))}
              </div>
            )}

          </div>
        </div>

        {/* MINIATURA DA MÍDIA (Imagem recortada ou Vídeo) (Tarefas 3 & 4) */}
        {(mediaUrl || localPreviewUrl) && (
          <div className="relative mt-2 max-w-md w-full rounded-2xl overflow-hidden border border-zinc-800 bg-black/60 shadow-md group">
            {/* Botão X para remover a miniatura */}
            <button
              type="button"
              onClick={() => {
                setMediaUrl('');
                setMediaType(null);
                setLocalPreviewUrl(null);
                setVideoFileName(null);
              }}
              className="absolute top-2.5 right-2.5 z-20 w-7 h-7 rounded-full bg-black/80 hover:bg-black text-white flex items-center justify-center transition-colors cursor-pointer shadow-lg"
              title="Remover mídia"
              aria-label="Remover mídia"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>

            {mediaType === 'video' || (videoFileName && !localPreviewUrl) ? (
              /* Tarefa 4: Miniatura de vídeo com ícone de play e nome do arquivo */
              <div className="p-4 flex items-center gap-3.5 bg-zinc-950/90">
                <div className="w-12 h-12 rounded-xl bg-primary-container/20 border border-primary flex items-center justify-center text-primary shrink-0 shadow-inner">
                  <span className="material-symbols-outlined text-[30px]">play_circle</span>
                </div>
                <div className="flex flex-col min-w-0 pr-8">
                  <span className="text-xs font-semibold text-white truncate">
                    {videoFileName || 'Vídeo anexado'}
                  </span>
                  <span className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    Vídeo pronto para publicação
                  </span>
                </div>
              </div>
            ) : (
              /* Tarefa 3: Miniatura da imagem já recortada e comprimida */
              <div className="relative w-full max-h-64 bg-zinc-950 flex items-center justify-center overflow-hidden">
                <img
                  src={localPreviewUrl || mediaUrl}
                  alt="Miniatura recortada"
                  className="w-full h-auto max-h-64 object-cover"
                />
              </div>
            )}
          </div>
        )}

      </div>

      {/* 4. A BARRA INFERIOR (O "Footer" do Modal): sticky bottom-0 com Safe Area e alinhamento em linha única */}
      <footer className="sticky bottom-0 bg-surface-container-lowest px-3 sm:px-5 py-2.5 sm:py-3.5 pb-[max(0.75rem,calc(env(safe-area-inset-bottom)+0.6rem))] border-t border-outline-variant shrink-0 z-20 flex items-center justify-between gap-1.5 sm:gap-3">
        {/* Lado Esquerdo: Ícones Foto, Vídeo, Emoji, GIF e Localização */}
        <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
          {/* Foto */}
          <button
            type="button"
            onClick={() => handleTriggerUpload('image')}
            disabled={uploading}
            className="p-1.5 sm:p-2 rounded-full hover:bg-surface-container text-primary hover:text-on-surface-variant transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center"
            aria-label="Adicionar Foto"
          >
            <span className="material-symbols-outlined text-[20px] sm:text-[21px]">image</span>
          </button>

          {/* Vídeo (sem R2) */}
          <button
            type="button"
            onClick={() => handleTriggerUpload('video')}
            disabled={uploading}
            className="p-1.5 sm:p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-on-surface-variant transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center"
            aria-label="Adicionar Vídeo"
          >
            <span className="material-symbols-outlined text-[20px] sm:text-[21px]">videocam</span>
          </button>

          {/* Câmera: só aparece em celular */}
          {isPhone && (
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={uploading}
              className="p-1.5 sm:p-2 rounded-full hover:bg-surface-container text-primary hover:text-on-surface-variant transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center"
              aria-label="Tirar foto com a câmera"
            >
              <span className="material-symbols-outlined text-[20px] sm:text-[21px]">photo_camera</span>
            </button>
          )}
        </div>

        {/* Lado Direito: Seletor de Destino e Botão Publicar */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 min-w-0">
          {/* Seletor de Destino */}
          <div className="flex items-center gap-1 bg-surface-container-low px-2 sm:px-3 py-1.5 rounded-full border border-outline-variant text-xs shrink-0 max-w-[130px] sm:max-w-[200px]">
            <span className="material-symbols-outlined text-on-surface-variant text-[15px] sm:text-[16px] shrink-0">groups</span>
            <select
              value={communityId}
              onChange={(e) => setCommunityId(e.target.value ? Number(e.target.value) : '')}
              className="bg-transparent text-xs text-on-surface font-medium focus:outline-none cursor-pointer truncate w-full"
            >
              <option value="" className="bg-surface text-on-surface">Feed Geral</option>
              {communities.map((c) => (
                <option key={c.id} value={c.id} className="bg-surface text-on-surface">
                  e/{c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Botão Publicar */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || uploading}
            className="px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-full bg-primary-container hover:bg-primary text-on-primary font-bold text-xs shadow-xs hover:shadow-md transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            {submitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Publicando...</span>
              </>
            ) : (
              <span>Publicar</span>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
};
