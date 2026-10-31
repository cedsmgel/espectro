import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { friendsApi, FriendRequest } from '../../lib/api';
import { ModalShell } from './ModalShell';

interface FriendRequestsModalProps {
  onClose: () => void;
  onChanged: () => void;
}

export const FriendRequestsModal: React.FC<FriendRequestsModalProps> = ({ onClose, onChanged }) => {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRequests(await friendsApi.pending());
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar os pedidos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (request: FriendRequest, action: 'accept' | 'decline') => {
    setBusyId(request.friend_id);
    try {
      if (action === 'accept') await friendsApi.add(request.friend_id, request.username);
      else await friendsApi.remove(request.friend_id);
      setRequests((prev) => prev.filter((r) => r.friend_id !== request.friend_id));
      onChanged();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível concluir a ação.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ModalShell title="Solicitações de amizade" onClose={onClose}>
      {loading ? (
        <p className="text-xs text-on-surface-variant text-center py-6">Carregando...</p>
      ) : requests.length === 0 ? (
        <div className="text-center py-8">
          <span className="material-symbols-outlined text-[36px] text-on-surface-variant/40">group_add</span>
          <p className="mt-2 text-sm font-semibold text-on-surface">Nenhuma solicitação pendente</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            Quando alguém pedir para ser seu amigo, o pedido aparece aqui.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {requests.map((r) => (
            <li key={r.friendship_id} className="flex items-center gap-3 p-3 rounded-2xl bg-surface-container-low">
              <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-sm uppercase flex-shrink-0">
                {r.username.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <Link
                  to={`/perfil/${encodeURIComponent(r.username)}`}
                  onClick={onClose}
                  className="block text-xs font-semibold text-on-surface truncate hover:underline"
                >
                  @{r.username}
                </Link>
                <span className="text-[11px] text-on-surface-variant">quer ser seu amigo</span>
              </div>
              <button
                type="button"
                disabled={busyId === r.friend_id}
                onClick={() => act(r, 'accept')}
                className="px-3 py-1.5 rounded-full bg-primary-container text-on-primary text-[11px] font-semibold hover:bg-primary disabled:opacity-60 cursor-pointer"
              >
                Aceitar
              </button>
              <button
                type="button"
                disabled={busyId === r.friend_id}
                onClick={() => act(r, 'decline')}
                className="px-3 py-1.5 rounded-full bg-surface-container text-on-surface text-[11px] font-semibold hover:bg-surface-container-high disabled:opacity-60 cursor-pointer"
              >
                Recusar
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-3 text-xs text-error">{error}</p>}
    </ModalShell>
  );
};
