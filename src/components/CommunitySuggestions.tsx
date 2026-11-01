import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authStorage, communitySuggestionsApi, CommunitySuggestion } from '../lib/api';

function reasonOf(c: CommunitySuggestion): string {
  if (c.friends_in > 0) return `${c.friends_in} ${c.friends_in === 1 ? 'amigo participa' : 'amigos participam'}`;
  if (c.recent_posts > 0) return `${c.recent_posts} ${c.recent_posts === 1 ? 'publicação recente' : 'publicações recentes'}`;
  return `${c.members_count} ${c.members_count === 1 ? 'membro' : 'membros'}`;
}

interface CommunitySuggestionsProps {
  // Chamado depois de entrar em uma comunidade (para a tela recarregar a lista dela)
  onJoined?: () => void;
}

// Comunidades recomendadas para a pessoa: entrar com um toque ou dispensar
export const CommunitySuggestions: React.FC<CommunitySuggestionsProps> = ({ onJoined }) => {
  const [items, setItems] = useState<CommunitySuggestion[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loggedIn = Boolean(authStorage.getToken());

  useEffect(() => {
    if (!loggedIn) return;
    communitySuggestionsApi.list().then(setItems).catch(() => {});
  }, [loggedIn]);

  if (!loggedIn || items.length === 0) return null;

  const join = async (item: CommunitySuggestion) => {
    setBusyId(item.id);
    setError(null);
    try {
      await communitySuggestionsApi.join(item.id);
      setItems((prev) => prev.filter((c) => c.id !== item.id));
      onJoined?.();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível entrar na comunidade.');
    } finally {
      setBusyId(null);
    }
  };

  const dismiss = async (item: CommunitySuggestion) => {
    setItems((prev) => prev.filter((c) => c.id !== item.id));
    await communitySuggestionsApi.dismiss(item.id).catch(() => {});
  };

  return (
    <section
      aria-label="Comunidades para você"
      className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant flex flex-col gap-3"
    >
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-[20px]">travel_explore</span>
        <h2 className="font-bold text-sm text-on-surface">Comunidades para você</h2>
      </div>

      <ul className="flex flex-col gap-1">
        {items.map((c) => (
          <li key={c.id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-surface-container transition-colors">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white text-xs flex-shrink-0 shadow-xs"
              style={{ backgroundColor: c.icon_color || '#404040' }}
            >
              {c.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <Link to={`/c/${c.slug || c.id}`} className="block text-xs font-semibold text-on-surface truncate hover:text-primary">
                c/{c.name}
              </Link>
              <span className="block text-[11px] text-on-surface-variant truncate">{reasonOf(c)}</span>
            </div>
            <button
              type="button"
              disabled={busyId === c.id}
              onClick={() => join(c)}
              className="h-8 px-3.5 rounded-full bg-primary-container text-on-primary text-[11px] font-semibold hover:bg-primary disabled:opacity-50 cursor-pointer shrink-0"
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => dismiss(c)}
              title="Dispensar recomendação"
              aria-label={`Dispensar c/${c.name}`}
              className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </li>
        ))}
      </ul>

      {error && <p className="text-[11px] text-error">{error}</p>}
    </section>
  );
};
