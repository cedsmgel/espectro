import React, { useEffect, useState } from 'react';
import { friendsApi, Friend, groupsApi } from '../../lib/api';
import { ModalShell } from './ModalShell';

interface CreateGroupModalProps {
  onClose: () => void;
  onCreated: (id: number) => void;
}

// Criação de grupo: nome, descrição e amigos (regras do WhatsApp: quem cria vira admin)
export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ onClose, onCreated }) => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [picked, setPicked] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    friendsApi
      .list()
      .then((list) => setFriends(list.filter((f: any) => f.status === 'accepted')))
      .catch(() => {});
  }, []);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await groupsApi.create({ name: name.trim(), description: description.trim() || undefined, member_ids: picked });
      onCreated(res.id);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível criar o grupo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title="Novo grupo"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-full text-xs font-semibold bg-surface-container text-on-surface">Cancelar</button>
          <button type="button" disabled={busy || name.trim().length < 2 || picked.length === 0} onClick={create} className="px-4 py-2 rounded-full text-xs font-semibold bg-primary-container text-on-primary disabled:opacity-50">
            {busy ? 'Criando...' : 'Criar grupo'}
          </button>
        </div>
      }
    >
      <label className="block text-xs font-semibold mb-3">
        Nome do grupo
        <input value={name} maxLength={50} onChange={(e) => setName(e.target.value)} className="mt-1 w-full h-9 px-3 rounded-xl bg-surface-container-low text-xs outline-none" />
      </label>
      <label className="block text-xs font-semibold mb-4">
        Descrição (opcional)
        <textarea value={description} maxLength={300} rows={2} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full p-3 rounded-xl bg-surface-container-low text-xs outline-none resize-none" />
      </label>

      <h3 className="text-xs font-semibold mb-2">Escolha os participantes ({picked.length})</h3>
      {friends.length === 0 ? (
        <p className="text-xs text-on-surface-variant">Você precisa de amigos para criar um grupo.</p>
      ) : (
        <ul className="space-y-1 max-h-56 overflow-y-auto">
          {friends.map((f) => (
            <li key={f.friend_id}>
              <label className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-container-low cursor-pointer text-xs">
                <input type="checkbox" checked={picked.includes(f.friend_id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, f.friend_id] : p.filter((x) => x !== f.friend_id)))} className="accent-[var(--color-primary,#2563eb)]" />
                @{f.username}
              </label>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-3 text-xs text-error">{error}</p>}
    </ModalShell>
  );
};
