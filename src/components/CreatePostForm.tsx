import React, { useState } from 'react';
import { authStorage, Community, CreatePostData } from '../lib/api';

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
  const [postType, setPostType] = useState<'discussion' | 'scrap'>('discussion');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [communityId, setCommunityId] = useState<number | ''>(defaultCommunityId || '');
  const [mediaUrl, setMediaUrl] = useState('');
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [showCommunitySelect, setShowCommunitySelect] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
      await onPostCreated({
        title: postType === 'discussion' ? title.trim() : undefined,
        content: content.trim(),
        post_type: postType,
        community_id: communityId === '' ? undefined : Number(communityId),
        media_url: mediaUrl.trim() || undefined,
        media_type: mediaUrl.trim() ? 'image' : undefined,
      });

      // Reset
      setTitle('');
      setContent('');
      setMediaUrl('');
      setShowMediaInput(false);
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
      {/* Selector: Post Regular vs Scrap */}
      <div className="flex items-center gap-2 border-b border-outline-variant/20 pb-2">
        <button
          type="button"
          onClick={() => setPostType('discussion')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
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
          <div className="p-3 rounded-xl bg-error-container text-error text-xs font-medium">
            {error}
          </div>
        )}

        {success && (
          <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-2 border border-emerald-300 animate-in fade-in">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>Publicado com sucesso! Salvo no banco D1.</span>
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

        {/* Inputs de Mídia e Comunidade quando ativados */}
        {showMediaInput && (
          <div className="pl-13 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">link</span>
            <input
              type="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="Cole a URL de uma imagem (https://...)"
              className="flex-1 bg-surface-container-low rounded-xl px-3 py-1.5 text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary-container"
            />
          </div>
        )}

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

        {/* Barra de Ações: Imagem, Vídeo, Enquete, Comunidade e Botão Publicar */}
        <div className="flex flex-wrap items-center justify-between pt-2 border-t border-outline-variant/20 gap-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowMediaInput(!showMediaInput)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-surface-container text-primary text-xs font-semibold transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">image</span>
              <span>Imagem</span>
            </button>
            <button
              type="button"
              onClick={() => setShowMediaInput(!showMediaInput)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-surface-container text-secondary text-xs font-semibold transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">play_circle</span>
              <span>Vídeo</span>
            </button>
            <button
              type="button"
              onClick={() => setPostType(postType === 'scrap' ? 'discussion' : 'scrap')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-surface-container text-tertiary-container text-xs font-semibold transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">poll</span>
              <span>Scrap / Enquete</span>
            </button>
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
              disabled={submitting}
              className="px-5 py-2 rounded-full bg-primary-container text-on-primary font-semibold text-xs hover:bg-primary shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Publicando...' : 'Publicar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
