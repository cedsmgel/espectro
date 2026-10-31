import React, { useState, useRef, useEffect } from 'react';
import { authStorage, Community, CreatePostData, uploadApi } from '../lib/api';
import { VideoPlayer } from './VideoPlayer';

interface CreatePostFormProps {
  onPostCreated: (data: CreatePostData) => Promise<void>;
  communities?: Community[];
  defaultCommunityId?: number | null;
  onClose?: () => void;
  isModal?: boolean;
}

const DRAFT_STORAGE_KEY = 'espectro_composer_draft';

export const CreatePostForm: React.FC<CreatePostFormProps> = ({
  onPostCreated,
  communities = [],
  defaultCommunityId = null,
  onClose,
  isModal = false,
}) => {
  const user = authStorage.getUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [postType, setPostType] = useState<'discussion' | 'scrap'>('discussion');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [communityId, setCommunityId] = useState<number | ''>(defaultCommunityId || '');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [fileAccept, setFileAccept] = useState('image/*,video/*');
  const [showUrlInput, setShowUrlInput] = useState(false);
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
            updatedAt: new Date().toISOString(),
          })
        );
      } catch {
        // ignore
      }
    }
  }, [title, content, postType, communityId, mediaUrl, mediaType]);

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

  // Inserção de Markdown simples (Negrito, Itálico, Código, Citação)
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

  // Inserção de Link no formato [texto](url)
  const insertLink = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = textarea.value;
    const selected = currentVal.substring(start, end);

    const url = window.prompt('Digite a URL do link:', 'https://');
    if (url === null) return; // cancelou

    const cleanUrl = url.trim() || 'https://';
    const linkText = selected.trim() || 'link';
    const formatted = `[${linkText}](${cleanUrl})`;

    const newContent =
      currentVal.substring(0, start) + formatted + currentVal.substring(end);

    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      const newPos = start + formatted.length;
      textarea.setSelectionRange(newPos, newPos);
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
    setError('Upload cancelado pelo usuário.');
  };

  // Manipulação de Upload com Axios e barra de progresso real
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    setUploadProgress(0);

    const isVid = file.type.startsWith('video/') || /\.(mp4|webm|mov|ogg|m4v)$/i.test(file.name);
    setUploadMessage(
      isVid
        ? 'Enviando vídeo para o Cloudflare R2...'
        : 'Enviando imagem para o Cloudflare R2...'
    );

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
      setMediaType(response.media_type);
      setUploadProgress(100);
    } catch (err: any) {
      if (err.message?.includes('cancelado')) {
        setError('Upload cancelado pelo usuário.');
      } else {
        setError(err.message || 'Falha ao realizar upload.');
      }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!user) {
      setError('Você precisa estar logado para publicar.');
      return;
    }

    if (postType === 'discussion' && !title.trim()) {
      setError('Discussões precisam ter um título.');
      return;
    }

    if (!content.trim()) {
      setError('Escreva algo na sua publicação.');
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
        title: postType === 'discussion' ? title.trim() : undefined,
        content: content.trim(),
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
      setShowUrlInput(false);
      setIsDraftRestored(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

      if (isModal && onClose) {
        setTimeout(() => onClose(), 600);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao criar publicação.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className={`bg-surface-container-lowest rounded-3xl p-5 shadow-sm border border-outline-variant/30 flex flex-col gap-4 ${isModal ? 'w-full' : ''}`}>
      {/* Hidden File Input para Cloudflare R2 */}
      <input
        type="file"
        ref={fileInputRef}
        accept={fileAccept}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Modal Header (se aberto como modal) */}
      {isModal && (
        <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">edit_square</span>
            <h2 className="text-base font-bold text-on-surface">Nova Publicação</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
            title="Fechar (salva como rascunho)"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
      )}

      {/* Selector: Post Regular vs Scrap e Dropdown de Comunidade Permanente */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/20 pb-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPostType('discussion')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              postType === 'discussion'
                ? 'bg-primary-container text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">edit_note</span>
            <span>Discussão</span>
          </button>
          <button
            type="button"
            onClick={() => setPostType('scrap')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              postType === 'scrap'
                ? 'bg-secondary-container text-on-secondary-container shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">auto_stories</span>
            <span>Scrap Nostálgico</span>
          </button>
        </div>

        {/* Seletor de Comunidade Destino (ou Feed Geral) */}
        <div className="flex items-center gap-1.5 bg-surface-container-low px-2.5 py-1 rounded-full border border-outline-variant/30">
          <span className="material-symbols-outlined text-secondary text-[16px]">groups</span>
          <select
            value={communityId}
            onChange={(e) => setCommunityId(e.target.value ? Number(e.target.value) : '')}
            className="bg-transparent text-xs text-on-surface font-semibold focus:outline-none cursor-pointer"
          >
            <option value="" className="bg-surface-container-lowest text-on-surface">Publicar no Feed Geral</option>
            {communities.map((c) => (
              <option key={c.id} value={c.id} className="bg-surface-container-lowest text-on-surface">
                c/{c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Banner de Rascunho Recuperado */}
      {isDraftRestored && (
        <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-on-surface text-xs flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500 text-[18px]">drafts</span>
            <span>Rascunho recuperado automaticamente.</span>
          </div>
          <button
            type="button"
            onClick={handleDiscardDraft}
            className="text-error font-semibold hover:underline cursor-pointer flex items-center gap-1 text-[11px]"
          >
            <span className="material-symbols-outlined text-[14px]">delete</span>
            Descartar rascunho
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {error && (
          <div className="p-3 rounded-2xl bg-error-container text-error text-xs font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-2 border border-emerald-300 animate-in fade-in">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>Publicado com sucesso! Salvo no banco D1.</span>
          </div>
        )}

        {/* Upload Progress Real com Botão Cancelar */}
        {uploading && (
          <div className="p-3.5 rounded-2xl bg-surface-container border border-outline-variant/30 flex flex-col gap-2.5 shadow-sm animate-in fade-in">
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
                className="px-2.5 py-1 rounded-xl bg-error-container/30 text-error hover:bg-error-container text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                title="Cancelar upload em andamento"
              >
                <span className="material-symbols-outlined text-[15px]">close</span>
                <span>Cancelar upload</span>
              </button>
            </div>

            {/* Barra de Progresso Real */}
            <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-150 ease-out rounded-full"
                style={{ width: `${Math.max(5, uploadProgress)}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary font-bold flex items-center justify-center text-sm uppercase flex-shrink-0 shadow-xs">
            {user.username.charAt(0)}
          </div>
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            {postType === 'discussion' && (
              <input
                id="composer-title-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título da sua discussão..."
                className="w-full bg-surface-container-low rounded-xl px-4 py-2 text-on-surface text-sm font-semibold placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container transition-all"
              />
            )}

            {/* Barra de Formatação de Texto Básica (Negrito, Itálico, Link) e Contador */}
            <div className="flex items-center justify-between border border-outline-variant/20 py-1 px-2 bg-surface-container-low rounded-xl">
              <div className="flex items-center gap-1">
                {/* Negrito */}
                <button
                  type="button"
                  onClick={() => insertMarkdown('**', '**', 'negrito')}
                  className="px-2 py-1 rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container transition-colors flex items-center gap-1 cursor-pointer"
                  title="Negrito (**texto**)"
                >
                  <span className="font-extrabold text-[13px]">B</span>
                  <span className="text-[11px] hidden sm:inline">Negrito</span>
                </button>

                {/* Itálico */}
                <button
                  type="button"
                  onClick={() => insertMarkdown('*', '*', 'itálico')}
                  className="px-2 py-1 rounded-lg text-xs italic text-on-surface hover:bg-surface-container transition-colors flex items-center gap-1 cursor-pointer"
                  title="Itálico (*texto*)"
                >
                  <span className="italic font-serif text-[14px]">I</span>
                  <span className="text-[11px] hidden sm:inline">Itálico</span>
                </button>

                {/* Link */}
                <button
                  type="button"
                  onClick={insertLink}
                  className="px-2 py-1 rounded-lg text-xs text-on-surface hover:bg-surface-container transition-colors flex items-center gap-1 cursor-pointer"
                  title="Inserir Link [texto](url)"
                >
                  <span className="material-symbols-outlined text-[16px]">link</span>
                  <span className="text-[11px] hidden sm:inline">Link</span>
                </button>

                <div className="h-4 w-px bg-outline-variant/30 mx-1" />

                {/* Código inline */}
                <button
                  type="button"
                  onClick={() => insertMarkdown('`', '`', 'código')}
                  className="px-2 py-1 rounded-lg text-xs font-mono text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
                  title="Código inline (`código`)"
                >
                  &lt;/&gt;
                </button>

                {/* Citação */}
                <button
                  type="button"
                  onClick={() => insertMarkdown('> ', '', 'citação')}
                  className="px-2 py-1 rounded-lg text-xs text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
                  title="Citação (> citação)"
                >
                  <span className="material-symbols-outlined text-[15px]">format_quote</span>
                </button>
              </div>

              {/* Contador de Caracteres no Canto do Input */}
              <div className="flex items-center gap-1 pr-1">
                <span
                  className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-medium transition-colors ${
                    content.length > 2000
                      ? 'bg-error-container text-error font-bold'
                      : content.length > 1500
                      ? 'bg-amber-100 text-amber-800'
                      : 'text-on-surface-variant'
                  }`}
                  title={`${content.length} caracteres digitados`}
                >
                  {content.length} caracteres
                </span>
              </div>
            </div>

            <textarea
              id="composer-textarea"
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="O que está acontecendo no seu espectro hoje? (Suporta **negrito**, *itálico* e [links](url))"
              rows={3}
              className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-on-surface text-sm placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container transition-all resize-none"
            />
          </div>
        </div>

        {/* Prévia de Mídia Carregada (Vídeo Player ou Imagem) */}
        {mediaUrl && (
          <div className="pl-13 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">
                  {mediaType === 'video' || mediaUrl.includes('/videos/') ? 'videocam' : 'image'}
                </span>
                {mediaType === 'video' || mediaUrl.includes('/videos/')
                  ? 'Vídeo pronto no Cloudflare R2'
                  : 'Imagem pronta no Cloudflare R2'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setMediaUrl('');
                  setMediaType(null);
                }}
                className="text-xs text-error hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">delete</span>
                Remover
              </button>
            </div>

            {mediaType === 'video' || /\.(mp4|webm|mov|ogg|m4v)($|\?)/i.test(mediaUrl) || mediaUrl.includes('/videos/') ? (
              <div className="w-full max-w-[600px] mx-auto">
                <VideoPlayer src={mediaUrl} title="Prévia da publicação" />
              </div>
            ) : (
              <div className="relative w-full max-w-[600px] mx-auto rounded-xl overflow-hidden bg-surface-container aspect-video max-h-60 border border-outline-variant/30">
                <img
                  src={mediaUrl}
                  alt="Prévia de imagem"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
        )}

        {/* Input Manual de URL (caso prefira colar link externo) */}
        {showUrlInput && (
          <div className="pl-13 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">link</span>
            <input
              type="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="Ou cole a URL de um vídeo ou imagem (https://...)"
              className="flex-1 bg-surface-container-low rounded-xl px-3 py-1.5 text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary-container"
            />
          </div>
        )}

        {/* Barra de Ações: Imagem, Vídeo, Link e Botão Publicar */}
        <div className="flex flex-wrap items-center justify-between pt-2 border-t border-outline-variant/20 gap-3">
          <div className="flex items-center gap-1">
            {/* Upload de Imagem para o R2 */}
            <button
              type="button"
              onClick={() => handleTriggerUpload('image')}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-surface-container text-primary text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              title="Fazer upload de foto para o R2"
            >
              <span className="material-symbols-outlined text-[18px]">photo_camera</span>
              <span>Foto</span>
            </button>

            {/* Upload de Vídeo para o R2 com barra de progresso */}
            <button
              type="button"
              onClick={() => handleTriggerUpload('video')}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-surface-container text-secondary text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              title="Fazer upload de vídeo para o R2 com acompanhamento de progresso"
            >
              <span className="material-symbols-outlined text-[18px]">videocam</span>
              <span>Vídeo (R2)</span>
            </button>

            {/* Alternar Link URL manual */}
            <button
              type="button"
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-surface-container text-tertiary-container text-xs font-semibold transition-colors cursor-pointer"
              title="Inserir link direto de mídia"
            >
              <span className="material-symbols-outlined text-[18px]">link</span>
              <span>Link</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant text-xs">
              <span className="material-symbols-outlined text-[14px]">public</span>
              <span>Público</span>
            </span>
            <button
              type="submit"
              disabled={submitting || uploading}
              className="px-5 py-2 rounded-full bg-primary-container text-on-primary font-semibold text-xs hover:bg-primary shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Publicando...</span>
                </>
              ) : (
                'Publicar'
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
