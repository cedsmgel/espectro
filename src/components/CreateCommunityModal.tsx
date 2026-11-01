import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { communitiesApi, Community, CommunityType, authStorage } from '../lib/api';

interface CreateCommunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCommunityCreated?: (community: Community) => void;
}

const PRESET_COLORS = [
  { name: 'Roxo Espectro', hex: '#404040' },
  { name: 'Índigo Profundo', hex: '#4f46e5' },
  { name: 'Azul Elétrico', hex: '#0284c7' },
  { name: 'Esmeralda', hex: '#059669' },
  { name: 'Rosa Vibrante', hex: '#db2777' },
  { name: 'Âmbar Solar', hex: '#d97706' },
  { name: 'Coral Quente', hex: '#ea580c' },
  { name: 'Ardósia Escura', hex: '#334155' },
];

const TYPES: Array<{ value: CommunityType; icon: string; title: string; text: string }> = [
  { value: 'public', icon: 'public', title: 'Pública', text: 'Qualquer pessoa vê, entra e publica.' },
  { value: 'restricted', icon: 'visibility', title: 'Restrita', text: 'Qualquer pessoa vê, mas só quem você aprovar publica.' },
  { value: 'private', icon: 'lock', title: 'Privada', text: 'Só membros veem. Quem quiser entrar pede e você aprova.' },
];

// Nome: 3 a 21 caracteres, só letras, números e _ (como no Reddit); vira o endereço e não muda depois
const NAME_RE = /^[A-Za-z0-9_]{3,21}$/;

function parseTags(text: string): string[] {
  const seen = new Set<string>();
  for (const raw of text.split(/[\s,]+/)) {
    const tag = raw.replace(/^#+/, '').toLowerCase();
    if (tag) seen.add(tag);
  }
  return [...seen];
}

export const CreateCommunityModal: React.FC<CreateCommunityModalProps> = ({
  isOpen,
  onClose,
  onCommunityCreated,
}) => {
  const navigate = useNavigate();
  const user = authStorage.getUser();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState('#404040');
  const [type, setType] = useState<CommunityType>('public');
  const [tagsText, setTagsText] = useState('');
  const [requireTag, setRequireTag] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const slugPreview = (name || 'nova_comunidade').toLowerCase();
  const tags = parseTags(tagsText);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError('Você precisa estar logado para criar uma comunidade.');
      return;
    }

    if (!NAME_RE.test(name.trim())) {
      setError('O nome deve ter de 3 a 21 caracteres, só letras, números e _ (sem espaços). Ele não pode ser mudado depois.');
      return;
    }
    if (tags.length > 8) {
      setError('Use no máximo 8 hashtags.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await communitiesApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        icon_color: selectedColor,
        type,
        tags,
        require_tag: requireTag,
      });

      if (onCommunityCreated) {
        onCommunityCreated(created);
      }

      setName('');
      setDescription('');
      setSelectedColor('#404040');
      setType('public');
      setTagsText('');
      setRequireTag(false);
      onClose();

      // Abre a página da nova comunidade (e/nome)
      navigate(`/e/${created.slug || created.id}`);
    } catch (err: any) {
      setError(err.message || 'Erro ao criar comunidade.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-3xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] w-full max-w-lg shadow-2xl flex flex-col gap-5 max-h-[90dvh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-outline-variant pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs transition-colors"
              style={{ backgroundColor: selectedColor }}
            >
              <span className="material-symbols-outlined text-[20px]">groups</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">Criar Nova Comunidade</h2>
              <p className="text-xs text-on-surface-variant">
                Fundar um espaço oficial no Espectro Social
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-error-container text-error text-xs font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Nome & Slug Preview */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface">
              Nome da Comunidade <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9_]/g, ''))}
              placeholder="ex: Cinema_Cult"
              maxLength={21}
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant text-base sm:text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
            />
            <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant px-1">
              <span className="material-symbols-outlined text-[14px] text-primary">link</span>
              <span>3 a 21 caracteres, sem espaços; não muda depois. Endereço:</span>
              <span className="font-mono font-semibold text-primary">
                /e/{slugPreview}
              </span>
            </div>
          </div>

          {/* Descrição */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface">
              Descrição do Espaço
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Qual o propósito deste grupo, diretrizes ou tópicos debatidos?"
              rows={3}
              maxLength={500}
              className="w-full p-3 rounded-xl bg-surface-container-low border border-outline-variant text-base sm:text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container transition-all resize-none"
            />
            <div className="text-right text-[10px] text-on-surface-variant">
              {description.length}/500
            </div>
          </div>

          {/* Tipo da comunidade */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-on-surface">Tipo de comunidade</label>
            <div className="flex flex-col gap-1.5">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  aria-pressed={type === t.value}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                    type === t.value ? 'border-primary bg-surface-container' : 'border-outline-variant hover:bg-surface-container-low'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px] text-on-surface-variant">{t.icon}</span>
                  <span className="flex flex-col">
                    <span className="text-xs font-semibold text-on-surface">{t.title}</span>
                    <span className="text-[11px] text-on-surface-variant">{t.text}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Hashtags da comunidade (no lugar dos flairs) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface">Hashtags da comunidade</label>
            <input
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="#dica #duvida #discussao"
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant text-base sm:text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <span className="text-[11px] text-on-surface-variant px-1">
              Até 8, separadas por espaço. Organizam as publicações e quem posta pode usá-las.
            </span>
            <label className="flex items-center gap-2 px-1 pt-1 text-xs text-on-surface cursor-pointer">
              <input type="checkbox" checked={requireTag} onChange={(e) => setRequireTag(e.target.checked)} className="w-4 h-4" />
              <span>Exigir ao menos uma hashtag em cada publicação</span>
            </label>
          </div>

          {/* Seletor de Cor do Ícone */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-on-surface">
              Cor do Ícone & Destaque
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color.hex}
                  type="button"
                  onClick={() => setSelectedColor(color.hex)}
                  title={color.name}
                  className={`w-7 h-7 rounded-full transition-transform cursor-pointer flex items-center justify-center shadow-xs ${
                    selectedColor.toLowerCase() === color.hex.toLowerCase()
                      ? 'scale-125 ring-2 ring-primary ring-offset-2'
                      : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: color.hex }}
                >
                  {selectedColor.toLowerCase() === color.hex.toLowerCase() && (
                    <span className="material-symbols-outlined text-white text-[14px]">check</span>
                  )}
                </button>
              ))}

              {/* Seletor de cor livre customizada */}
              <div className="flex items-center gap-1.5 pl-2">
                <input
                  type="color"
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="w-7 h-7 rounded-lg border-0 cursor-pointer p-0 bg-transparent"
                  title="Escolher cor personalizada"
                />
                <span className="text-[11px] font-mono text-on-surface-variant">
                  {selectedColor}
                </span>
              </div>
            </div>
          </div>

          {/* Live Badge Preview */}
          <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-base shadow-xs"
                style={{ backgroundColor: selectedColor }}
              >
                {(name.trim() || 'C').charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xs text-on-surface">
                  {name.trim() || 'Nome da Comunidade'}
                </span>
                <span className="text-[11px] text-on-surface-variant">
                  1 membro • Fundador @{user?.username || 'você'}
                </span>
              </div>
            </div>
            <span
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold text-white shadow-xs"
              style={{ backgroundColor: selectedColor }}
            >
              e/{slugPreview}
            </span>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-outline-variant">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-full text-on-surface-variant hover:bg-surface-container text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-full bg-primary-container text-on-primary font-semibold text-xs hover:bg-primary shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Criando espaço...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  <span>Fundar Comunidade</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
