import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Community, FriendSuggestion, friendsApi, suggestionsApi } from '../lib/api';

interface ProfileDiscoverProps {
  isSelf: boolean;
  username: string;
  communities: Community[];
}

type Mode = 'sugestoes' | 'comunidades';

const initialOf = (name: string) => name.charAt(0).toUpperCase();

// Faixa do perfil com seletor ao lado do título: sugestões de amigos (no próprio perfil) e comunidades
export const ProfileDiscover: React.FC<ProfileDiscoverProps> = ({ isSelf, username, communities }) => {
  const [mode, setMode] = useState<Mode>(isSelf ? 'sugestoes' : 'comunidades');
  const [suggestions, setSuggestions] = useState<FriendSuggestion[] | null>(null);
  const [sent, setSent] = useState<Set<number>>(new Set());
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (!isSelf) return;
    suggestionsApi.list().then(setSuggestions).catch(() => setSuggestions([]));
  }, [isSelf]);

  const add = async (person: FriendSuggestion) => {
    setBusyId(person.id);
    try {
      await friendsApi.add(person.id, person.username);
      setSent((prev) => new Set(prev).add(person.id));
    } catch {
    } finally {
      setBusyId(null);
    }
  };

  const dismiss = async (person: FriendSuggestion) => {
    setSuggestions((prev) => (prev ? prev.filter((p) => p.id !== person.id) : prev));
    try {
      await suggestionsApi.dismiss(person.id);
    } catch {}
  };

  const showSuggestions = isSelf && mode === 'sugestoes';
  if (!isSelf && communities.length === 0) return null;
  if (isSelf && communities.length === 0 && (suggestions === null || suggestions.length === 0)) return null;

  const tabs: { id: Mode; label: string }[] = [
    { id: 'sugestoes', label: 'Sugestões' },
    { id: 'comunidades', label: 'Comunidades' },
  ];

  return (
    <section className="flex flex-col gap-3 border-b border-outline-variant pb-5" aria-label={showSuggestions ? 'Sugestões de amigos' : 'Comunidades'}>
      <div className="flex items-center justify-between gap-3 min-w-0">
        <h2 className={isSelf ? 'sr-only' : 'font-bold text-sm text-on-surface truncate'}>
          {showSuggestions ? 'Sugestões para você' : isSelf ? 'Suas comunidades' : `Comunidades de @${username}`}
        </h2>
        <div className={`flex items-center gap-3 ${isSelf ? 'w-full justify-between' : 'shrink-0'}`}>
          {isSelf && (
            <div role="tablist" aria-label="Tipo de sugestão" className="flex border border-outline-variant rounded-full overflow-hidden">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={mode === t.id}
                  onClick={() => setMode(t.id)}
                  className={`h-8 px-3 text-[11px] font-semibold cursor-pointer transition-colors ${
                    mode === t.id ? 'bg-on-surface text-surface' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
          <Link to={showSuggestions ? '/amigos' : '/comunidades'} className="text-xs font-semibold text-primary hover:underline">
            Ver todos
          </Link>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
        {showSuggestions
          ? (suggestions ?? []).map((person) => (
              <div key={person.id} className="relative w-36 shrink-0 border border-outline-variant rounded-2xl p-3 flex flex-col items-center text-center gap-2">
                <button
                  type="button"
                  onClick={() => void dismiss(person)}
                  aria-label={`Dispensar @${person.username}`}
                  className="absolute top-1 right-1 w-7 h-7 rounded-full text-on-surface-variant hover:text-on-surface flex items-center justify-center cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
                <Link to={`/perfil/${encodeURIComponent(person.username)}`} className="flex flex-col items-center gap-1.5 min-w-0 w-full">
                  <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center overflow-hidden text-lg font-bold text-on-surface">
                    {person.avatar_url ? <img loading="lazy" decoding="async" src={person.avatar_url} alt="" className="w-full h-full object-cover" /> : initialOf(person.username)}
                  </div>
                  <span className="text-xs font-semibold text-on-surface truncate w-full">{person.name || `@${person.username}`}</span>
                  <span className="text-[11px] text-on-surface-variant truncate w-full">
                    {person.mutual_friends > 0
                      ? `${person.mutual_friends} ${person.mutual_friends === 1 ? 'amigo' : 'amigos'} em comum`
                      : person.shared_communities > 0
                      ? 'Comunidade em comum'
                      : 'Sugestão para você'}
                  </span>
                </Link>
                <button
                  type="button"
                  disabled={sent.has(person.id) || busyId === person.id}
                  onClick={() => void add(person)}
                  className={`w-full h-8 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                    sent.has(person.id) ? 'border border-outline-variant text-on-surface-variant' : 'bg-primary-container text-on-primary hover:bg-primary'
                  }`}
                >
                  {sent.has(person.id) ? 'Pedido enviado' : 'Adicionar'}
                </button>
              </div>
            ))
          : communities.map((c) => (
              <Link
                key={c.id}
                to={`/e/${c.slug || c.id}`}
                className="w-36 shrink-0 border border-outline-variant rounded-2xl p-3 flex flex-col items-center text-center gap-2 hover:bg-surface-container-low/60 transition-colors"
              >
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl" style={{ backgroundColor: c.icon_color || '#404040' }}>
                  {initialOf(c.name)}
                </div>
                <span className="text-xs font-semibold text-on-surface truncate w-full">e/{c.name}</span>
                <span className="text-[11px] text-on-surface-variant">
                  {c.members_count || 1} {(c.members_count || 1) === 1 ? 'membro' : 'membros'}
                </span>
              </Link>
            ))}
      </div>
    </section>
  );
};
