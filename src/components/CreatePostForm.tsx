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

  const [postType, setPostType] = useState<'discussion' | 'scrap'>('scrap');
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
      setError('Você precisa estar conectado para postar!');
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
      setSuccessMsg(postType === 'discussion' ? 'Tópico de discussão criado com sucesso!' : 'Recado postado com sucesso!');
      onPostCreated();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao publicar');
    } finally {
      setPosting(false);
    }
  };

  const addEmoticon = (emo: string) => {
    setContent((prev) => prev + (prev.length > 0 && !prev.endsWith(' ') ? ' ' : '') + emo + ' ');
  };

  return (
    <div className="bg-surface-container-lowest rounded classic-bevel-border overflow-hidden">
      {/* Header com Abas: Discussão vs Scrap */}
      <div className="retro-header-strip px-space-md py-space-sm flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px] text-primary">edit_note</span>
          <span className="text-label-md font-bold text-primary">Criar Nova Publicação</span>
        </div>

        {/* Post Type Selector: Discussão (Título + Texto + Mídia) vs Scrap (Texto curto) */}
        <div className="flex items-center bg-white p-0.5 rounded border border-outline-variant text-label-sm font-label-sm">
          <button
            type="button"
            onClick={() => setPostType('scrap')}
            className={`px-3 py-1 rounded transition-all cursor-pointer flex items-center gap-1 ${
              postType === 'scrap'
                ? 'bg-primary text-white font-bold shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[13px]">chat</span>
            Scrap (Recado)
          </button>
          <button
            type="button"
            onClick={() => setPostType('discussion')}
            className={`px-3 py-1 rounded transition-all cursor-pointer flex items-center gap-1 ${
              postType === 'discussion'
                ? 'bg-primary text-white font-bold shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[13px]">forum</span>
            Discussão
          </button>
        </div>
      </div>

      <div className="p-space-md bg-surface-container-low">
        {successMsg && (
          <div className="mb-2 p-2 rounded bg-[#e7f7ed] text-[#1e6f3b] text-body-sm border border-[#a3dfb4] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            {successMsg}
          </div>
        )}

        {error && (
          <div className="mb-2 p-2 rounded bg-error-container text-on-error-container text-body-sm border border-error flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">error</span>
            {error}
          </div>
        )}

        {user ? (
          <form onSubmit={handleSubmit} className="space-y-2">
            {/* Campos exclusivos de Discussão (Título + Mídia + Comunidade) */}
            {postType === 'discussion' && (
              <div className="space-y-2 bg-white p-2.5 rounded border border-outline-variant shadow-inner">
                <div>
                  <label className="block text-[11px] font-bold text-primary uppercase mb-0.5" htmlFor="post-title">
                    Título da Discussão:
                  </label>
                  <input
                    id="post-title"
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Qual foi o melhor jogo dos anos 2000?"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded px-2.5 py-1.5 text-body-md font-bold text-primary focus:border-primary outline-none"
                  />
                </div>

                {!defaultCommunityId && communities.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-bold text-primary uppercase mb-0.5">
                      Vincular à Comunidade:
                    </label>
                    <select
                      value={selectedCommunity}
                      onChange={(e) => setSelectedCommunity(e.target.value ? Number(e.target.value) : '')}
                      className="w-full bg-white border border-outline-variant rounded px-2 py-1 text-body-sm text-primary outline-none"
                    >
                      <option value="">Feed Geral (Sem comunidade)</option>
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

            {/* Toolbar Retrô */}
            <div className="flex items-center flex-wrap gap-1 p-1 bg-surface-container-highest border border-outline-variant rounded-t text-body-sm">
              <button
                type="button"
                onClick={() => addEmoticon(':-)')}
                className="px-1.5 py-0.5 retro-btn-secondary text-[11px] rounded cursor-pointer"
                title="Sorriso"
              >
                :-)
              </button>
              <button
                type="button"
                onClick={() => addEmoticon(';-)')}
                className="px-1.5 py-0.5 retro-btn-secondary text-[11px] rounded cursor-pointer"
                title="Piscadela"
              >
                ;-)
              </button>
              <button
                type="button"
                onClick={() => addEmoticon('s2')}
                className="px-1.5 py-0.5 retro-btn-secondary text-[11px] text-error font-bold rounded cursor-pointer"
                title="Coração"
              >
                s2
              </button>
              <button
                type="button"
                onClick={() => addEmoticon(':-P')}
                className="px-1.5 py-0.5 retro-btn-secondary text-[11px] rounded cursor-pointer"
                title="Língua"
              >
                :-P
              </button>
              <div className="h-4 w-px bg-outline-variant mx-1"></div>
              <button
                type="button"
                onClick={() => setShowMediaInput(!showMediaInput)}
                className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 border cursor-pointer ${
                  showMediaInput
                    ? 'bg-primary text-white border-primary font-bold'
                    : 'retro-btn-secondary text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-[13px]">add_photo_alternate</span>
                {postType === 'discussion' ? 'Anexar Mídia (GIF / Foto / Vídeo)' : 'Anexar Imagem'}
              </button>
            </div>

            {/* Inputs de Mídia */}
            {showMediaInput && (
              <div className="p-2 bg-surface-container rounded border border-outline-variant flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="Link direto da imagem, GIF ou vídeo (ex: https://...)"
                  className="flex-1 bg-white border border-outline-variant rounded px-2 py-1 text-body-sm outline-none font-mono text-primary"
                />
                <select
                  value={mediaType}
                  onChange={(e) => setMediaType(e.target.value as any)}
                  className="bg-white border border-outline-variant rounded px-2 py-1 text-body-sm outline-none text-primary"
                >
                  <option value="">Tipo: Imagem/GIF</option>
                  <option value="image">Imagem</option>
                  <option value="gif">GIF</option>
                  <option value="video">Vídeo</option>
                </select>
              </div>
            )}

            {/* Textarea */}
            <textarea
              rows={postType === 'discussion' ? 4 : 3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                postType === 'discussion'
                  ? 'Escreva os detalhes, perguntas ou argumentos da sua discussão...'
                  : 'Escreva seu recado ou novidade aqui... (lembre-se: recado não é chat!)'
              }
              disabled={posting}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-b p-space-sm text-body-sm focus:border-primary-container focus:ring-1 focus:ring-secondary-container outline-none transition-all resize-y shadow-inner text-on-surface"
            />

            {/* Action Bar */}
            <div className="mt-space-sm flex items-center justify-between">
              <span className="text-[11px] text-secondary italic">
                {postType === 'discussion' ? 'Discuta com respeito e cordialidade' : 'Visível para todos os amigos'}
              </span>

              <button
                type="submit"
                disabled={posting || !content.trim()}
                className="px-4 py-1.5 retro-btn-primary text-on-primary rounded text-label-md font-label-md font-bold tracking-wide flex items-center gap-1 shadow active:translate-y-px disabled:opacity-50 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">send</span>
                {posting ? 'Enviando...' : postType === 'discussion' ? 'Publicar Discussão' : 'Enviar Recado'}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-space-md bg-surface-container rounded border border-outline-variant flex flex-col sm:flex-row items-center justify-between gap-space-sm">
            <div className="flex items-center gap-2 text-secondary">
              <span className="material-symbols-outlined text-primary text-[20px]">lock</span>
              <span className="text-body-sm">
                Faça login para criar discussões, enviar recados e votar.
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="retro-btn-primary text-white text-label-md px-space-md py-1 rounded font-bold whitespace-nowrap cursor-pointer shadow"
            >
              Entrar no Espectro
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
