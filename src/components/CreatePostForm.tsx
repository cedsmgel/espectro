import React, { useState, useRef } from 'react';
import { authStorage, Community, CreatePostData, uploadApi } from '../lib/api';
import { VideoPlayer } from './VideoPlayer';

interface CreatePostFormProps {
  onPostCreated: (data: CreatePostData) => Promise<void>;
  communities?: Community[];
  defaultCommunityId?: number | null;
}

export const CreatePostForm: React.FC<CreatePostFormProps> = ({
  onPostCreated,
  communities = [],
  defaultCommunityId = null,
}) => {
  const user = authStorage.getUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [postType, setPostType] = useState<'discussion' | 'scrap'>('discussion');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [communityId, setCommunityId] = useState<number | ''>(defaultCommunityId || '');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [fileAccept, setFileAccept] = useState('image/*,video/*');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [showCommunitySelect, setShowCommunitySelect] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    const isVid = file.type.startsWith('video/') || /\.(mp4|webm|mov|ogg|m4v)$/i.test(file.name);
    setUploadMessage(
      isVid
        ? 'Enviando vídeo para o Cloudflare R2...'
        : 'Enviando imagem para o Cloudflare R2...'
    );

    try {
      const response = await uploadApi.upload(file);
      setMediaUrl(response.url);
      setMediaType(response.media_type);
    } catch (err: any) {
      setError(err.message || 'Falha ao realizar upload.');
    } finally {
      setUploading(false);
      setUploadMessage('');
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
      // Determina media_type automático se URL foi inserida manualmente
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

      // Reset após publicar
      setTitle('');
      setContent('');
      setMediaUrl('');
      setMediaType(null);
      setShowUrlInput(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
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
    <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/30 flex flex-col gap-4">
      {/* Hidden File Input para Cloudflare R2 */}
      <input
        type="file"
        ref={fileInputRef}
        accept={fileAccept}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Selector: Post Regular vs Scrap */}
      <div className="flex items-center gap-2 border-b border-outline-variant/20 pb-2">
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

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {error && (
          <div className="p-3 rounded-xl bg-error-container text-error text-xs font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-2 border border-emerald-300 animate-in fade-in">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>Publicado com sucesso! Salvo no banco D1.</span>
          </div>
        )}

        {/* Upload Progress Banner */}
        {uploading && (
          <div className="p-3 rounded-xl bg-primary-fixed text-on-primary-fixed-variant text-xs font-semibold flex items-center gap-2.5 border border-primary/20 animate-pulse">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
            <span>{uploadMessage}</span>
          </div>
        )}

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary font-bold flex items-center justify-center text-sm uppercase flex-shrink-0 shadow-xs">
            {user.username.charAt(0)}
          </div>
          <div className="flex-1 flex flex-col gap-2">
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
            <textarea
              id="composer-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="O que está acontecendo no seu espectro hoje?"
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
              <VideoPlayer src={mediaUrl} title="Prévia da publicação" />
            ) : (
              <div className="relative rounded-xl overflow-hidden bg-surface-container aspect-video max-h-60 border border-outline-variant/30">
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

        {/* Seletor de Comunidade */}
        {showCommunitySelect && communities.length > 0 && (
          <div className="pl-13 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[20px]">groups</span>
            <select
              value={communityId}
              onChange={(e) => setCommunityId(e.target.value ? Number(e.target.value) : '')}
              className="bg-surface-container-low rounded-xl px-3 py-1.5 text-xs text-on-surface border border-outline-variant/30 focus:outline-none"
            >
              <option value="">Publicar no Feed Geral</option>
              {communities.map((c) => (
                <option key={c.id} value={c.id}>
                  e/{c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Barra de Ações: Imagem, Vídeo, Link, Comunidade e Botão Publicar */}
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

            {/* Upload de Vídeo para o R2 */}
            <button
              type="button"
              onClick={() => handleTriggerUpload('video')}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-surface-container text-secondary text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              title="Fazer upload de vídeo para o R2"
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

            {/* Alternar Comunidade */}
            <button
              type="button"
              onClick={() => setShowCommunitySelect(!showCommunitySelect)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-surface-container text-on-surface-variant text-xs font-semibold transition-colors hidden sm:inline-flex cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">tag</span>
              <span>Comunidade</span>
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
