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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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

      // Reset form
      setTitle('');
      setContent('');
      setMediaUrl('');
      setShowMediaInput(false);
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
    <article className="glass-surface rounded-2xl p-5 flex flex-col gap-4 relative shadow-[0_4px_20px_-2px_rgba(0,0,0,0.4)]">
      {/* Mode Tabs from Stitch: Discussão vs Scrap */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPostType('discussion')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              postType === 'discussion'
                ? 'bg-white/10 text-cyan-300 border border-cyan-400/30 shadow-[0_0_10px_rgba(76,215,246,0.15)]'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">edit_note</span>
            <span>Discussão</span>
          </button>

          <button
            type="button"
            onClick={() => setPostType('scrap')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              postType === 'scrap'
                ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30 shadow-[0_0_10px_rgba(251,191,36,0.2)]'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">auto_stories</span>
            <span>Scrap (Nostalgia)</span>
          </button>
        </div>

        <span className="text-[10px] font-semibold text-neutral-400 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Modo Conectado
        </span>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs px-3.5 py-2 rounded-xl flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Title Input (Discussão) */}
        {postType === 'discussion' && (
          <input
            id="composer-title-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título da sua publicação..."
            className="w-full bg-transparent px-3 py-2 text-base font-display font-semibold text-white placeholder:text-neutral-500 border-b border-white/5 focus:border-cyan-400 focus:outline-none transition-colors"
          />
        )}

        {/* Content Area with Avatar */}
        <div className="flex gap-3 items-start pt-1">
          <div className="w-10 h-10 rounded-full p-[1.5px] bg-gradient-to-tr from-cyan-400 to-blue-600 shrink-0 mt-1">
            <div className="w-full h-full bg-[#111318] rounded-full flex items-center justify-center text-white text-xs font-bold font-display uppercase">
              {user.username.charAt(0)}
            </div>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              postType === 'discussion'
                ? 'O que está ecoando na sua mente?'
                : 'Deixe aquele scrap maroto pro feed ou comunidade... (não apaga!!)'
            }
            rows={3}
            className="w-full bg-transparent resize-none text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none p-1 font-sans"
          />
        </div>

        {/* Media URL Input Drawer */}
        {showMediaInput && (
          <div className="flex items-center gap-2 px-3 py-2 glass-recessed rounded-xl border border-white/10">
            <span className="material-symbols-outlined text-[16px] text-cyan-400">link</span>
            <input
              type="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="Cole o link de uma imagem (https://...)"
              className="w-full bg-transparent text-xs text-white placeholder:text-neutral-500 focus:outline-none"
            />
            {mediaUrl && (
              <button
                type="button"
                onClick={() => setMediaUrl('')}
                className="text-neutral-400 hover:text-white text-xs"
              >
                Limpar
              </button>
            )}
          </div>
        )}

        {/* Media Preview Box */}
        {mediaUrl && (
          <div className="relative rounded-xl overflow-hidden max-h-48 border border-white/10 w-full aspect-video">
            <img
              src={mediaUrl}
              alt="Preview"
              className="w-full h-full object-cover"
              style={{ objectFit: 'cover' }}
              onError={() => setError('Não foi possível carregar a prévia da imagem.')}
            />
          </div>
        )}

        {/* Composer Toolbar & Action Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
          {/* Media & Formatting Buttons */}
          <div className="flex items-center gap-1 text-neutral-400">
            <button
              type="button"
              onClick={() => setShowMediaInput(!showMediaInput)}
              className={`p-2 rounded-xl transition-all ${
                showMediaInput ? 'bg-cyan-500/20 text-cyan-300' : 'hover:bg-white/5 hover:text-white'
              }`}
              title="Adicionar Imagem/Mídia"
            >
              <span className="material-symbols-outlined text-[20px]">image</span>
            </button>

            <button
              type="button"
              onClick={() => setContent((prev) => prev + '\n```\n// seu código aqui\n```\n')}
              className="p-2 rounded-xl hover:bg-white/5 hover:text-white transition-all"
              title="Trecho de Código"
            >
              <span className="material-symbols-outlined text-[20px]">code</span>
            </button>

            <button
              type="button"
              onClick={() => setContent((prev) => prev + ' ✌️✨')}
              className="p-2 rounded-xl hover:bg-white/5 hover:text-white transition-all"
              title="Emoji Nostálgico"
            >
              <span className="material-symbols-outlined text-[20px]">mood</span>
            </button>

            <div className="h-4 w-px bg-white/10 mx-1" />

            {/* Community Selector Tag */}
            {communities.length > 0 && !defaultCommunityId && (
              <select
                value={communityId}
                onChange={(e) => setCommunityId(e.target.value === '' ? '' : Number(e.target.value))}
                className="bg-white/5 text-neutral-300 hover:text-white text-xs rounded-lg px-2.5 py-1.5 border border-white/10 focus:outline-none focus:border-cyan-400 transition-all cursor-pointer"
              >
                <option value="" className="bg-[#121620] text-neutral-300">
                  Geral / Sem comunidade
                </option>
                {communities.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#121620] text-neutral-200">
                    e/{c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Primary Publish Button */}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-500 text-white font-semibold text-xs sm:text-sm border border-white/20 shadow-[0_0_20px_rgba(59,130,246,0.45)] hover:shadow-[0_0_28px_rgba(59,130,246,0.65)] active:scale-95 transition-all duration-150 disabled:opacity-50 cursor-pointer"
          >
            <span>{submitting ? 'Publicando...' : 'Publicar'}</span>
            <span className="material-symbols-outlined text-[18px]">send</span>
          </button>
        </div>
      </form>
    </article>
  );
};
