import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { friendsApi } from '../../lib/api';

interface PersonResult {
  id: number;
  username: string;
  friendship_status: string | null;
  friendship_from: number | null;
}

interface PeopleSearchResultsProps {
  query: string;
  myId: number;
  knownFriendIds: Set<number>;
  onOpenChat: (person: { id: number; username: string }) => void;
}

// Pessoas na busca da lista: conversar com amigos ou abrir o perfil.
// Pedidos de amizade (enviar, aceitar, recusar) ficam nas Notificações e no perfil.
export const PeopleSearchResults: React.FC<PeopleSearchResultsProps> = ({
  query,
  myId,
  knownFriendIds,
  onOpenChat,
}) => {
  const [results, setResults] = useState<PersonResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const found = await friendsApi.search(trimmed);
        setResults(found.filter((p) => !knownFriendIds.has(p.id)));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, knownFriendIds]);

  if (query.trim().length < 2) return null;
  if (!loading && results.length === 0) return null;

  return (
    <div className="mt-2 pt-2 border-t border-outline-variant">
      <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Pessoas</p>
      {loading && results.length === 0 && <p className="px-3 py-2 text-xs text-on-surface-variant">Buscando...</p>}
      {results.map((person) => {
        const status = person.friendship_status;
        const incoming = status === 'pending' && person.friendship_from !== myId;
        const profilePath = `/perfil/${encodeURIComponent(person.username)}`;
        return (
          <div key={person.id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-surface-container-low/60">
            <Link
              to={profilePath}
              className="w-9 h-9 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-xs uppercase flex-shrink-0"
            >
              {person.username.charAt(0)}
            </Link>
            <Link to={profilePath} className="flex-1 min-w-0">
              <span className="block text-xs font-semibold text-on-surface truncate">@{person.username}</span>
              <span className="block text-[11px] text-on-surface-variant">
                {status === 'accepted'
                  ? 'Amigo'
                  : status === 'pending'
                  ? incoming
                    ? 'Quer ser seu amigo'
                    : 'Pedido enviado'
                  : 'Não é seu amigo'}
              </span>
            </Link>
            {status === 'accepted' ? (
              <button
                type="button"
                onClick={() => onOpenChat({ id: person.id, username: person.username })}
                className="px-3 py-1.5 rounded-full bg-primary-container text-on-primary text-[11px] font-semibold hover:bg-primary cursor-pointer"
              >
                Conversar
              </button>
            ) : incoming ? (
              <Link
                to="/notificacoes?tab=amigos"
                className="px-3 py-1.5 rounded-full bg-primary-container text-on-primary text-[11px] font-semibold hover:bg-primary"
              >
                Responder
              </Link>
            ) : (
              <Link
                to={profilePath}
                className="px-3 py-1.5 rounded-full bg-surface-container text-on-surface text-[11px] font-semibold hover:bg-surface-container-high"
              >
                Ver perfil
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
};
