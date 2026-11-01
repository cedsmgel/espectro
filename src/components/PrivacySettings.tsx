import React, { useEffect, useState } from 'react';
import { accountApi } from '../lib/api';

interface ToggleRowProps {
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ title, description, checked, disabled, onChange }) => (
  <div className="flex items-start justify-between gap-4 py-4 border-b border-outline-variant">
    <div className="min-w-0">
      <p className="text-base font-semibold text-on-surface">{title}</p>
      <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">{description}</p>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={title}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border border-outline-variant transition-colors disabled:opacity-50 ${
        checked ? 'bg-on-surface' : 'bg-transparent'
      }`}
    >
      <span
        className={`pointer-events-none absolute top-0.5 left-0.5 h-6 w-6 rounded-full transition-transform ${
          checked ? 'translate-x-5 bg-surface' : 'translate-x-0 bg-on-surface-variant'
        }`}
      />
    </button>
  </div>
);

// Quem vê suas publicações e quem pode escrever no seu mural. Cada chave salva na hora.
export const PrivacySettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [allowScraps, setAllowScraps] = useState(true);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    accountApi
      .getSettings()
      .then((s) => {
        setIsPrivate(s.is_private);
        setAllowScraps(s.allow_scraps);
      })
      .catch(() => setMessage({ kind: 'error', text: 'Não foi possível carregar suas preferências.' }))
      .finally(() => setLoading(false));
  }, []);

  const update = async (patch: { is_private?: boolean; allow_scraps?: boolean }) => {
    const previous = { isPrivate, allowScraps };
    if (patch.is_private !== undefined) setIsPrivate(patch.is_private);
    if (patch.allow_scraps !== undefined) setAllowScraps(patch.allow_scraps);
    setSaving(true);
    setMessage(null);
    try {
      const res = await accountApi.updateSettings(patch);
      setIsPrivate(res.settings.is_private);
      setAllowScraps(res.settings.allow_scraps);
      setMessage({ kind: 'ok', text: 'Preferência salva.' });
    } catch (err: any) {
      setIsPrivate(previous.isPrivate);
      setAllowScraps(previous.allowScraps);
      setMessage({ kind: 'error', text: err?.message || 'Não foi possível salvar.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex flex-col border-t border-outline-variant pt-6" aria-label="Privacidade do perfil">
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-primary">Privacidade do perfil</h2>
        <p className="text-sm text-on-surface-variant mt-1">Controle quem vê o que você publica. As mudanças valem na hora.</p>
      </div>

      {loading ? (
        <p className="text-sm text-on-surface-variant py-6">Carregando...</p>
      ) : (
        <>
          <ToggleRow
            title="Perfil privado"
            description="Só amigos aceitos veem suas publicações, scraps e mídias. Para os demais visitantes, o mural fica bloqueado."
            checked={isPrivate}
            disabled={saving}
            onChange={(value) => void update({ is_private: value })}
          />
          <ToggleRow
            title="Permitir scraps de estranhos"
            description="Qualquer pessoa pode deixar recados no seu mural, mesmo sem ser sua amiga."
            checked={allowScraps}
            disabled={saving}
            onChange={(value) => void update({ allow_scraps: value })}
          />
          {message && (
            <p role="status" className={`text-sm pt-3 ${message.kind === 'ok' ? 'text-on-surface-variant' : 'text-error'}`}>
              {message.text}
            </p>
          )}
        </>
      )}
    </section>
  );
};
