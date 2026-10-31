import React, { useEffect, useState } from 'react';
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
  onRequestChanged: () => void;
}

// Resultados de pessoas na busca da lista: abrir conversa (amigo), pedir, aceitar ou ver pedido enviado
export const PeopleSearchResults: React.FC<PeopleSearchResultsProps> = ({
  query,
  myId,
  knownFriendIds,
  onOpenChat,
  onRequestChanged,
}) => {
  const [results, setResults] = useState<PersonResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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

  const request = async (person: PersonResult) => {
    setBusyId(person.id);
    try {
      const res = await friendsApi.add(person.id, person.username);
      const status = res.friend?.status || 'pending';
      setResults((prev) =>
        prev.map((p) =>
          p.id === person.id ? { ...p, friendship_status: status, friendship_from: myId } : p
        )
      );
      setMessage(res.message);
      onRequestChanged();
    } catch (err: any) {
      setMessage(err?.message || 'Não foi possível enviar o pedido.');
    } finally {
      setBusyId(null);
    }
  };

  if (query.trim().length < 2) return null;
  if (!loading && results.length === 0 && !message) return null;

  return (
    <div className="mt-2 pt-2 border-t border-outline-variant/30">
      <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Pessoas</p>
      {loading && results.length === 0 && (
        <p className="px-3 py-2 text-xs text-on-surface-variant">Buscando...</p>
      )}
      {results.map((person) => {
        const status = person.friendship_status;
        const incoming = status === 'pending' && person.friendship_from !== myId;
        return (
          <div key={person.id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-surface-container-low/60">
            <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
              {person.username.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
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
            </div>
            {status === 'accepted' ? (
              <button
                type="button"
                onClick={() => onOpenChat({ id: person.id, username: person.username })}
                className="px-3 py-1.5 rounded-full bg-primary-container text-on-primary text-[11px] font-semibold hover:bg-primary cursor-pointer"
              >
                Conversar
              </button>
            ) : status === 'pending' && !incoming ? (
              <span className="text-[11px] text-on-surface-variant px-2">Aguardando</span>
            ) : (
              <button
                type="button"
                disabled={busyId === person.id}
                onClick={() => request(person)}
                className="px-3 py-1.5 rounded-full bg-primary-container text-on-primary text-[11px] font-semibold hover:bg-primary disabled:opacity-60 cursor-pointer"
              >
                {incoming ? 'Aceitar' : 'Adicionar'}
              </button>
            )}
          </div>
        );
      })}
      {message && <p className="px-3 py-2 text-[11px] text-on-surface-variant">{message}</p>}
    </div>
  );
};
