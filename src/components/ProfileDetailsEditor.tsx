import React, { useEffect, useRef, useState } from 'react';
import { profileApi, profileDetailsApi, uploadApi } from '../lib/api';
import { PROFILE_FIELDS, ProfileLink, RELATIONSHIP_LABELS, VISIBILITY_OPTIONS, Visibility, parseLinks, parseTags } from '../lib/profileFields';

interface FieldState {
  value: string;
  visibility: Visibility;
}

const inputClass =
  'w-full px-4 py-2.5 rounded-2xl bg-surface-container-low border border-outline-variant text-on-surface text-xs focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container outline-none transition-all';

interface ProfileDetailsEditorProps {
  coverUrl: string | null;
  onCoverChange: (url: string | null) => void;
}

// Capa e informações pessoais, cada uma com a sua privacidade (nasce "Só eu")
export const ProfileDetailsEditor: React.FC<ProfileDetailsEditorProps> = ({ coverUrl, onCoverChange }) => {
  const [fields, setFields] = useState<Record<string, FieldState>>({});
  const [links, setLinks] = useState<ProfileLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    profileDetailsApi
      .getMine()
      .then((details) => {
        setFields(Object.fromEntries(Object.entries(details).map(([key, d]) => [key, { value: d.value, visibility: d.visibility }])));
        setLinks(parseLinks(details.links?.value));
      })
      .catch(() => setMessage({ kind: 'error', text: 'Não foi possível carregar suas informações.' }))
      .finally(() => setLoading(false));
  }, []);

  const setValue = (key: string, value: string) =>
    setFields((prev) => ({ ...prev, [key]: { value, visibility: prev[key]?.visibility ?? 'private' } }));
  const setVisibility = (key: string, visibility: Visibility) =>
    setFields((prev) => ({ ...prev, [key]: { value: prev[key]?.value ?? '', visibility } }));

  const handleCover = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    setUploading(true);
    try {
      const uploaded = await uploadApi.upload(file, { context: 'cover' });
      await profileApi.update({ cover_url: uploaded.url });
      onCoverChange(uploaded.url);
    } catch (err: any) {
      setMessage({ kind: 'error', text: err?.message || 'Não foi possível enviar a capa.' });
    } finally {
      setUploading(false);
    }
  };

  const removeCover = async () => {
    try {
      await profileApi.update({ cover_url: null });
      onCoverChange(null);
    } catch {
      setMessage({ kind: 'error', text: 'Não foi possível remover a capa.' });
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const payload: Record<string, { value: unknown; visibility: Visibility }> = {};
      for (const def of PROFILE_FIELDS) {
        const state = fields[def.key];
        const visibility = state?.visibility ?? 'private';
        payload[def.key] = def.kind === 'links' ? { value: links, visibility } : { value: state?.value ?? '', visibility };
      }
      await profileDetailsApi.save(payload);
      setMessage({ kind: 'ok', text: 'Informações salvas.' });
    } catch (err: any) {
      setMessage({ kind: 'error', text: err?.message || 'Não foi possível salvar.' });
    } finally {
      setSaving(false);
    }
  };

  const visibilitySelect = (key: string, label: string) => (
    <select
      value={fields[key]?.visibility ?? 'private'}
      onChange={(e) => setVisibility(key, e.target.value as Visibility)}
      aria-label={`Quem vê: ${label}`}
      className="h-10 px-3 rounded-full bg-surface-container-low border border-outline-variant text-xs text-on-surface cursor-pointer shrink-0"
    >
      {VISIBILITY_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );

  const groupTitle: Record<string, string> = { sobre: 'Sobre você', trabalho: 'Trabalho e estudo', links: 'Links' };

  return (
    <section className="bg-surface-container-lowest rounded-3xl p-4 sm:p-8 border border-outline-variant flex flex-col gap-6" aria-label="Informações do perfil">
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-primary">Informações do perfil</h2>
        <p className="text-xs text-on-surface-variant mt-1">Tudo é opcional e começa visível só para você. Escolha quem vê cada informação.</p>
      </div>

      {/* Capa */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-on-surface">Capa</h3>
        <div className="relative h-28 sm:h-36 rounded-2xl overflow-hidden bg-surface-container-low border border-outline-variant">
          {coverUrl && <img src={coverUrl} alt="Capa do perfil" className="w-full h-full object-cover" />}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => coverInputRef.current?.click()} disabled={uploading} className="px-4 py-2 rounded-full bg-primary-container text-on-primary font-semibold text-xs cursor-pointer disabled:opacity-50">
            {uploading ? 'Enviando...' : coverUrl ? 'Trocar capa' : 'Adicionar capa'}
          </button>
          {coverUrl && (
            <button type="button" onClick={() => void removeCover()} className="px-4 py-2 rounded-full bg-surface-container-low text-on-surface-variant hover:text-error font-semibold text-xs cursor-pointer">
              Remover
            </button>
          )}
          <input ref={coverInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { void handleCover(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-on-surface-variant">Carregando...</p>
      ) : (
        <form onSubmit={save} className="flex flex-col gap-6">
          {(['sobre', 'trabalho', 'links'] as const).map((group) => (
            <div key={group} className="flex flex-col gap-4">
              <h3 className="text-xs font-bold text-on-surface">{groupTitle[group]}</h3>
              {PROFILE_FIELDS.filter((f) => f.group === group).map((def) => (
                <div key={def.key} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor={`pd-${def.key}`} className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant">{def.icon}</span>
                      {def.label}
                    </label>
                    {visibilitySelect(def.key, def.label)}
                  </div>

                  {def.kind === 'select' ? (
                    <select id={`pd-${def.key}`} value={fields[def.key]?.value ?? ''} onChange={(e) => setValue(def.key, e.target.value)} className={inputClass}>
                      <option value="">Não informar</option>
                      {Object.entries(RELATIONSHIP_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  ) : def.kind === 'date' ? (
                    <input id={`pd-${def.key}`} type="date" max={new Date().toISOString().slice(0, 10)} value={fields[def.key]?.value ?? ''} onChange={(e) => setValue(def.key, e.target.value)} className={inputClass} />
                  ) : def.kind === 'tags' ? (
                    <input
                      id={`pd-${def.key}`}
                      type="text"
                      value={parseTags(fields[def.key]?.value).join(', ')}
                      onChange={(e) => setValue(def.key, e.target.value.split(',').map((t) => t.trim()).filter(Boolean).join(','))}
                      className={inputClass}
                    />
                  ) : def.kind === 'links' ? (
                    <div className="flex flex-col gap-2">
                      {links.map((link, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={link.label}
                            maxLength={30}
                            onChange={(e) => setLinks((prev) => prev.map((l, i) => (i === index ? { ...l, label: e.target.value } : l)))}
                            aria-label={`Título do link ${index + 1}`}
                            className={`${inputClass} w-1/3`}
                          />
                          <input
                            type="url"
                            value={link.url}
                            maxLength={200}
                            onChange={(e) => setLinks((prev) => prev.map((l, i) => (i === index ? { ...l, url: e.target.value } : l)))}
                            aria-label={`Endereço do link ${index + 1}`}
                            className={`${inputClass} flex-1 min-w-0`}
                          />
                          <button type="button" onClick={() => setLinks((prev) => prev.filter((_, i) => i !== index))} className="w-10 h-10 shrink-0 rounded-full text-on-surface-variant hover:text-error cursor-pointer" aria-label={`Remover link ${index + 1}`}>
                            <span className="material-symbols-outlined text-[20px]">close</span>
                          </button>
                        </div>
                      ))}
                      {links.length < 5 && (
                        <button type="button" onClick={() => setLinks((prev) => [...prev, { label: '', url: 'https://' }])} className="self-start px-4 py-2 rounded-full border border-outline-variant text-xs font-semibold text-on-surface cursor-pointer hover:bg-surface-container-low">
                          Adicionar link
                        </button>
                      )}
                    </div>
                  ) : (
                    <input id={`pd-${def.key}`} type="text" value={fields[def.key]?.value ?? ''} maxLength={def.maxLength} onChange={(e) => setValue(def.key, e.target.value)} className={inputClass} />
                  )}
                  {def.hint && <p className="text-[11px] text-on-surface-variant">{def.hint}</p>}
                </div>
              ))}
            </div>
          ))}

          <div className="flex items-center gap-3 justify-end">
            {message && (
              <p className={`text-xs ${message.kind === 'ok' ? 'text-on-surface-variant' : 'text-error'}`} role="status">
                {message.text}
              </p>
            )}
            <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-full bg-primary-container text-on-primary text-xs font-semibold cursor-pointer disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar informações'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
};
