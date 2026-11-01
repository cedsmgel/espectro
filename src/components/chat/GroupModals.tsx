import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatExtrasApi, GroupInfo, groupsApi } from '../../lib/api';
import { ModalShell } from './ModalShell';

const inviteUrl = (code: string) => `${window.location.origin}/mensagens?convite=${code}`;

// Compartilhar o grupo: link de convite para copiar ou enviar pelo aparelho
export const ShareGroupModal: React.FC<{ groupId: number; groupName: string; isAdmin: boolean; onClose: () => void }> = ({
  groupId,
  groupName,
  isAdmin,
  onClose,
}) => {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    groupsApi
      .manage(groupId, { action: 'invite' })
      .then((res) => setCode(String(res.code)))
      .catch((err) => setError(err?.message || 'Não foi possível gerar o convite.'));
  }, [groupId]);

  const link = code ? inviteUrl(code) : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Não foi possível copiar.');
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: groupName, text: `Entre no grupo "${groupName}" no Espectro`, url: link });
    } catch {}
  };
  const reset = async () => {
    if (!window.confirm('Gerar um novo link? O link atual deixará de funcionar.')) return;
    try {
      const res = await groupsApi.manage(groupId, { action: 'reset_invite' });
      setCode(String(res.code));
    } catch (err: any) {
      setError(err?.message || 'Não foi possível gerar outro link.');
    }
  };

  return (
    <ModalShell title="Compartilhar grupo" onClose={onClose}>
      <p className="text-xs text-on-surface-variant mb-3">Quem abrir o link poderá entrar em “{groupName}”. As mensagens de antes da entrada não aparecem.</p>
      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-container-low">
        <span className="flex-1 min-w-0 text-[11px] font-mono truncate select-all">{code ? link : 'Gerando link...'}</span>
        <button type="button" onClick={() => void copy()} disabled={!code} className="px-3 h-8 rounded-full text-xs font-semibold bg-primary-container text-on-primary disabled:opacity-50 cursor-pointer shrink-0">
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      {typeof navigator.share === 'function' && (
        <button type="button" onClick={() => void share()} disabled={!code} className="mt-2 w-full h-10 rounded-full text-xs font-semibold bg-surface-container hover:bg-surface-container-high flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
          <span className="material-symbols-outlined text-[18px]">share</span>
          Enviar pelo aparelho
        </button>
      )}
      {isAdmin && (
        <button type="button" onClick={() => void reset()} className="mt-2 w-full h-10 rounded-full text-xs font-semibold text-error hover:bg-error/10 cursor-pointer">
          Redefinir link
        </button>
      )}
      {error && <p className="mt-3 text-xs text-error">{error}</p>}
    </ModalShell>
  );
};

type Perm = 'only_admins_send' | 'members_can_edit_info' | 'members_can_add' | 'members_can_invite';

const PERMS: { key: Perm; label: string; hint: string }[] = [
  { key: 'only_admins_send', label: 'Só admins enviam mensagens', hint: 'Os outros membros apenas leem.' },
  { key: 'members_can_edit_info', label: 'Membros editam nome e descrição', hint: 'Se desligado, só admins alteram os dados do grupo.' },
  { key: 'members_can_add', label: 'Membros adicionam pessoas', hint: 'Se desligado, só admins adicionam amigos.' },
  { key: 'members_can_invite', label: 'Membros compartilham o link de convite', hint: 'Se desligado, só admins compartilham o grupo.' },
];

// Menu de permissões do grupo (só administradores)
export const GroupPermissionsModal: React.FC<{ groupId: number; group: GroupInfo; onClose: () => void; onChanged: () => void }> = ({
  groupId,
  group,
  onClose,
  onChanged,
}) => {
  const [values, setValues] = useState<Record<Perm, boolean>>({
    only_admins_send: group.only_admins_send,
    members_can_edit_info: group.members_can_edit_info,
    members_can_add: group.members_can_add,
    members_can_invite: group.members_can_invite,
  });
  const [error, setError] = useState<string | null>(null);

  const toggle = async (key: Perm) => {
    const next = !values[key];
    setValues((v) => ({ ...v, [key]: next }));
    setError(null);
    try {
      await groupsApi.manage(groupId, { action: 'update', [key]: next });
      onChanged();
    } catch (err: any) {
      setValues((v) => ({ ...v, [key]: !next }));
      setError(err?.message || 'Não foi possível salvar.');
    }
  };

  return (
    <ModalShell title="Permissões do grupo" onClose={onClose}>
      <ul className="flex flex-col gap-1">
        {PERMS.map((p) => (
          <li key={p.key}>
            <label className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-surface-container-low cursor-pointer">
              <span>
                <span className="block text-xs font-semibold text-on-surface">{p.label}</span>
                <span className="block text-[11px] text-on-surface-variant">{p.hint}</span>
              </span>
              <input type="checkbox" checked={values[p.key]} onChange={() => void toggle(p.key)} className="w-5 h-5 shrink-0 accent-[var(--color-primary,#2563eb)]" />
            </label>
          </li>
        ))}
      </ul>
      {error && <p className="mt-3 text-xs text-error">{error}</p>}
    </ModalShell>
  );
};

// Convite aberto por link (/mensagens?convite=CÓDIGO): mostra o grupo e pergunta se quer entrar
export const InviteJoinModal: React.FC<{ code: string; onClose: () => void }> = ({ code, onClose }) => {
  const navigate = useNavigate();
  const [info, setInfo] = useState<{ id: number; name: string; description: string | null; members_count: number; already_member: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    chatExtrasApi
      .invitePreview(code)
      .then(setInfo)
      .catch((err) => setError(err?.message || 'Convite inválido ou expirado.'));
  }, [code]);

  const join = async () => {
    if (!info) return;
    if (info.already_member) {
      onClose();
      navigate(`/grupos/${info.id}`);
      return;
    }
    setJoining(true);
    try {
      const res = await chatExtrasApi.joinGroup(code);
      onClose();
      navigate(`/grupos/${res.id}`);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível entrar no grupo.');
      setJoining(false);
    }
  };

  return (
    <ModalShell title="Convite para grupo" onClose={onClose}>
      {info ? (
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-2xl uppercase">{info.name.charAt(0)}</div>
          <h3 className="mt-3 text-sm font-bold text-on-surface">{info.name}</h3>
          <p className="text-[11px] text-on-surface-variant">{info.members_count} {info.members_count === 1 ? 'membro' : 'membros'}</p>
          {info.description && <p className="mt-2 text-xs text-on-surface-variant">{info.description}</p>}
          <button type="button" onClick={() => void join()} disabled={joining} className="mt-4 w-full h-10 rounded-full text-xs font-semibold bg-primary-container text-on-primary disabled:opacity-50 cursor-pointer">
            {info.already_member ? 'Abrir grupo' : 'Entrar no grupo'}
          </button>
        </div>
      ) : (
        <p className="text-xs text-center text-on-surface-variant py-6">{error || 'Carregando convite...'}</p>
      )}
      {info && error && <p className="mt-3 text-xs text-error">{error}</p>}
    </ModalShell>
  );
};
