import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, authStorage, Community } from '../lib/api';

interface CreatePostFormProps {
  communities?: Community[];
  defaultCommunityId?: number | null;
  defaultCommunitySlug?: string | null;
  onPostCreated: () => void;
}

export const CreatePostForm: React.FC<CreatePostFormProps> = ({
  communities = [],
  defaultCommunityId,
  defaultCommunitySlug,
  onPostCreated,
}) => {
  const navigate = useNavigate();
  const user = authStorage.getUser();

  const [postType, setPostType] = useState<'discussion' | 'scrap'>('discussion');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedCommunity, setSelectedCommunity] = useState<number | ''>(defaultCommunityId || '');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'gif' | ''>('');
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    if (!user) {
      setError('Você precisa estar autenticado para postar!');
      return;
    }

    try {
      setPosting(true);
      setError(null);
      setSuccessMsg(null);

      await api.createPost({
        content: content.trim(),
        title: postType === 'discussion' && title.trim() ? title.trim() : undefined,
        community_id: selectedCommunity ? Number(selectedCommunity) : (defaultCommunityId || null),
        community_slug: defaultCommunitySlug || null,
        media_url: mediaUrl.trim() || undefined,
        media_type: mediaType ? mediaType : undefined,
        post_type: postType,
      });

      setContent('');
      setTitle('');
      setMediaUrl('');
      setMediaType('');
      setShowMediaInput(false);
      setSuccessMsg(postType === 'discussion' ? 'Discussão iniciada com sucesso!' : 'Scrap publicado com sucesso!');
      onPostCreated();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao publicar');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl overflow-hidden p-5 transition-all">
      {/* Top Switcher */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-brand-blue text-[20px]">edit_square</span>
          <span className="font-display font-bold text-sm text-white">Criar Publicação</span>
        </div>

        <div className="flex items-center bg-white/[0.04] p-1 rounded-xl border border-white/10 text-xs">
          <button
            type="button"
            onClick={() => setPostType('discussion')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-medium flex items-center gap-1.5 ${
              postType === 'discussion'
                ? 'bg-brand-blue text-white shadow-glow-blue'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">forum</span>
            Discussão
          </button>
          <button
            type="button"
            onClick={() => setPostType('scrap')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-medium flex items-center gap-1.5 ${
              postType === 'scrap'
                ? 'bg-brand-blue text-white shadow-glow-blue'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">chat</span>
            Scrap
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="mb-3 p-3 rounded-xl bg-neon-green/10 border border-neon-green/30 text-neon-green text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">check_circle</span>
          {successMsg}
        </div>
      )}

      {error && (
        <div className="mb-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error</span>
          {error}
        </div>
      )}

      {user ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Discussion Title & Community Picker */}
          {postType === 'discussion' && (
            <div className="space-y-2.5">
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título da discussão..."
                className="w-full glass-input px-3.5 py-2 text-sm font-display font-semibold rounded-xl text-white outline-none"
              />

              {!defaultCommunityId && communities.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-400 font-medium">Comunidade:</span>
                  <select
                    value={selectedCommunity}
                    onChange={(e) => setSelectedCommunity(e.target.value ? Number(e.target.value) : '')}
                    className="glass-input px-3 py-1.5 rounded-xl text-xs text-white outline-none bg-[#141822]"
                  >
                    <option value="">Feed Geral</option>
                    {communities.map((c) => (
                      <option key={c.id} value={c.id}>
                        e/{c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Text Area */}
          <textarea
            rows={postType === 'discussion' ? 3 : 2}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              postType === 'discussion'
                ? 'Compartilhe seus pensamentos, ideias ou questionamentos...'
                : 'Deixe um recado rápido para a rede...'
            }
            disabled={posting}
            className="w-full glass-input p-3 text-sm rounded-xl text-neutral-200 outline-none resize-y"
          />

          {/* Media input toggle */}
          {showMediaInput && (
            <div className="p-3 bg-white/[0.03] border border-white/10 rounded-xl flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="Cole o link da imagem, GIF ou vídeo (https://...)"
                className="flex-1 glass-input px-3 py-1.5 text-xs rounded-lg text-white font-mono"
              />
              <select
                value={mediaType}
                onChange={(e) => setMediaType(e.target.value as any)}
                className="glass-input px-3 py-1.5 rounded-lg text-xs text-white bg-[#141822]"
              >
                <option value="">Tipo de Mídia</option>
                <option value="image">Imagem</option>
                <option value="gif">GIF</option>
                <option value="video">Vídeo</option>
              </select>
            </div>
          )}

          {/* Bottom Actions */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setShowMediaInput(!showMediaInput)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                showMediaInput
                  ? 'bg-white/15 text-white border border-white/20'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">add_photo_alternate</span>
              <span>Anexar Mídia</span>
            </button>

            <button
              type="submit"
              disabled={posting || !content.trim()}
              className="btn-primary-blue text-xs font-semibold px-5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">send</span>
              <span>{posting ? 'Publicando...' : postType === 'discussion' ? 'Publicar' : 'Enviar'}</span>
            </button>
          </div>
        </form>
      ) : (
        <div className="text-center py-4 space-y-2">
          <p className="text-sm text-neutral-300 font-medium">
            Junte-se ao Espectro para criar tópicos e interagir.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="btn-primary-blue text-xs font-semibold px-5 py-2 rounded-xl cursor-pointer"
          >
            Fazer Login ou Criar Conta
          </button>
        </div>
      )}
    </div>
  );
};
