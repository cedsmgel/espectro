import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  authStorage,
  friendsApi,
  Friend,
  GroupMember,
  GroupMessage,
  groupsApi,
} from '../lib/api';
import { ChatMenu } from '../components/chat/ChatMenu';
import { ModalShell } from '../components/chat/ModalShell';

type Detail = {
  group: { id: number; name: string; description: string | null; only_admins_send: boolean };
  members: GroupMember[];
  my_role: 'admin' | 'member';
};

export const GroupChat: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const groupId = Number(id);
  const navigate = useNavigate();
  const user = authStorage.getUser();

  const [detail, setDetail] = useState<Detail | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showManage, setShowManage] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadDetail = useCallback(async () => {
    try {
      setDetail(await groupsApi.detail(groupId));
    } catch (err: any) {
      setError(err?.message || 'Grupo não encontrado.');
    }
  }, [groupId]);

  // Primeira página, e depois novas mensagens a cada 4 segundos
  const loadLatest = useCallback(async () => {
    try {
      const res = await groupsApi.messages(groupId);
      setMessages((prev) => {
        const known = new Map(prev.map((m) => [m.id, m]));
        res.messages.forEach((m) => known.set(m.id, m));
        return [...known.values()].sort((a, b) => a.id - b.id);
      });
      setHasMore((prev) => prev || res.has_more);
    } catch {}
  }, [groupId]);

  useEffect(() => {
    void loadDetail();
    void loadLatest();
    const timer = window.setInterval(() => {
      void loadLatest();
    }, 4000);
    const detailTimer = window.setInterval(() => void loadDetail(), 30000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(detailTimer);
    };
  }, [loadDetail, loadLatest]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const loadOlder = async () => {
    const oldest = messages[0];
    if (!oldest) return;
    try {
      const res = await groupsApi.messages(groupId, oldest.id);
      setMessages((prev) => [...res.messages, ...prev]);
      setHasMore(res.has_more);
    } catch {}
  };

  const send = async () => {
    const content = text.trim();
    if (!content) return;
    setText('');
    try {
      const res = await groupsApi.send(groupId, content);
      setMessages((prev) => [...prev, res.message]);
    } catch (err: any) {
      setText(content);
      setError(err?.message || 'Não foi possível enviar.');
    }
  };

  const leave = async () => {
    if (!window.confirm('Sair deste grupo? Você não verá as mensagens novas.')) return;
    try {
      await groupsApi.manage(groupId, { action: 'leave' });
      navigate('/mensagens');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível sair.');
    }
  };

  if (error && !detail) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center text-sm text-on-surface-variant">
        <div>
          <p className="font-semibold text-on-surface">{error}</p>
          <Link to="/mensagens" className="text-primary text-xs hover:underline">Voltar às mensagens</Link>
        </div>
      </div>
    );
  }
  if (!detail) return <div className="min-h-screen flex items-center justify-center text-xs text-on-surface-variant">Carregando...</div>;

  const isAdmin = detail.my_role === 'admin';
  const canSend = isAdmin || !detail.group.only_admins_send;

  return (
    <div className="h-dvh flex flex-col bg-surface text-on-surface">
      <header className="px-3 sm:px-6 py-3 bg-surface-container-lowest border-b border-outline-variant/30 flex items-center gap-3">
        <Link to="/mensagens" className="p-1.5 rounded-full hover:bg-surface-container" aria-label="Voltar">
          <span className="material-symbols-outlined text-[22px]">arrow_back</span>
        </Link>
        <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold">
          {detail.group.name.charAt(0).toUpperCase()}
        </div>
        <button type="button" onClick={() => setShowManage(true)} className="flex-1 min-w-0 text-left cursor-pointer">
          <span className="block text-sm font-semibold truncate">{detail.group.name}</span>
          <span className="block text-[11px] text-on-surface-variant">
            {detail.members.length} membros{detail.group.only_admins_send ? ' · só admins enviam' : ''}
          </span>
        </button>
        <ChatMenu
          title="Opções do grupo"
          items={[
            { key: 'manage', label: 'Gerenciar grupo', icon: 'settings', onSelect: () => setShowManage(true) },
            { key: 'leave', label: 'Sair do grupo', icon: 'logout', danger: true, onSelect: leave },
          ]}
        />
      </header>

      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-2">
        {hasMore && (
          <div className="flex justify-center">
            <button type="button" onClick={loadOlder} className="text-[11px] font-semibold text-primary px-4 py-1.5 rounded-full bg-surface-container-low">
              Carregar mensagens anteriores
            </button>
          </div>
        )}
        {messages.length === 0 && (
          <p className="text-center text-xs text-on-surface-variant py-8">Nenhuma mensagem ainda.</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          const system = m.sender_id === null;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs whitespace-pre-wrap ${
                  mine
                    ? 'bg-primary-container text-on-primary'
                    : 'bg-surface-container-low text-on-surface border border-outline-variant/30'
                }`}
              >
                {!mine && !system && (
                  <span className="block text-[11px] font-bold text-primary mb-0.5">@{m.sender_username}</span>
                )}
                {m.content}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-error bg-error-container/60" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="p-3 bg-surface-container-lowest border-t border-outline-variant/30 flex items-center gap-2"
      >
        {canSend ? (
          <>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Mensagem para o grupo..."
              maxLength={2000}
              className="flex-1 h-10 px-3 rounded-full bg-surface-container-low text-xs outline-none"
            />
            <button type="submit" disabled={!text.trim()} className="w-10 h-10 rounded-full flex items-center justify-center text-primary disabled:opacity-40">
              <span className="material-symbols-outlined">send</span>
            </button>
          </>
        ) : (
          <p className="flex-1 text-center text-xs text-on-surface-variant py-2">Só os administradores podem enviar mensagens.</p>
        )}
      </form>

      {showManage && (
        <ManageGroupModal
          groupId={groupId}
          detail={detail}
          onClose={() => setShowManage(false)}
          onChanged={() => {
            void loadDetail();
            void loadLatest();
          }}
        />
      )}
    </div>
  );
};

interface ManageProps {
  groupId: number;
  detail: Detail;
  onClose: () => void;
  onChanged: () => void;
}

const ManageGroupModal: React.FC<ManageProps> = ({ groupId, detail, onClose, onChanged }) => {
  const isAdmin = detail.my_role === 'admin';
  const [name, setName] = useState(detail.group.name);
  const [description, setDescription] = useState(detail.group.description || '');
  const [onlyAdmins, setOnlyAdmins] = useState(detail.group.only_admins_send);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    friendsApi
      .list()
      .then((list) => {
        const inGroup = new Set(detail.members.map((m) => m.id));
        setFriends(list.filter((f: any) => !inGroup.has(f.friend_id)).map((f: any) => ({ ...f, friend_id: f.friend_id })));
      })
      .catch(() => {});
  }, [isAdmin, detail.members]);

  const run = async (body: Record<string, unknown>) => {
    setError(null);
    try {
      await groupsApi.manage(groupId, body);
      onChanged();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível concluir.');
    }
  };

  return (
    <ModalShell title="Dados do grupo" onClose={onClose}>
      {isAdmin && (
        <section className="mb-5 space-y-3">
          <label className="block text-xs font-semibold">
            Nome
            <input value={name} maxLength={50} onChange={(e) => setName(e.target.value)} className="mt-1 w-full h-9 px-3 rounded-xl bg-surface-container-low text-xs outline-none" />
          </label>
          <label className="block text-xs font-semibold">
            Descrição
            <textarea value={description} maxLength={300} rows={2} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full p-3 rounded-xl bg-surface-container-low text-xs outline-none resize-none" />
          </label>
          <label className="flex items-center justify-between gap-3 text-xs">
            <span>
              <span className="block font-semibold">Só admins enviam mensagens</span>
              <span className="block text-[11px] text-on-surface-variant">Os outros membros só leem.</span>
            </span>
            <input type="checkbox" checked={onlyAdmins} onChange={(e) => setOnlyAdmins(e.target.checked)} className="w-5 h-5 accent-[var(--color-primary,#2563eb)]" />
          </label>
          <button type="button" onClick={() => run({ action: 'update', name, description, only_admins_send: onlyAdmins })} className="px-4 py-2 rounded-full text-xs font-semibold bg-primary-container text-on-primary">
            Salvar alterações
          </button>
        </section>
      )}

      <section className="mb-5">
        <h3 className="text-xs font-semibold mb-2">{detail.members.length} membros</h3>
        <ul className="space-y-2">
          {detail.members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 p-2 rounded-xl bg-surface-container-low">
              <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center text-xs font-bold uppercase">{m.username.charAt(0)}</div>
              <div className="flex-1 min-w-0">
                <span className="block text-xs font-semibold truncate">@{m.username}{m.id === authStorage.getUser()?.id ? ' (você)' : ''}</span>
                {m.role === 'admin' && <span className="text-[10px] text-primary font-semibold">Administrador</span>}
              </div>
              {isAdmin && m.id !== authStorage.getUser()?.id && (
                <ChatMenu
                  title="Ações do membro"
                  items={[
                    m.role === 'admin'
                      ? { key: 'demote', label: 'Remover dos admins', icon: 'remove_moderator', onSelect: () => run({ action: 'demote', user_id: m.id }) }
                      : { key: 'promote', label: 'Tornar admin', icon: 'shield_person', onSelect: () => run({ action: 'promote', user_id: m.id }) },
                    { key: 'remove', label: 'Remover do grupo', icon: 'person_remove', danger: true, onSelect: () => run({ action: 'remove', user_id: m.id }), hidden: m.role === 'admin' },
                  ]}
                />
              )}
            </li>
          ))}
        </ul>
      </section>

      {isAdmin && friends.length > 0 && (
        <section className="mb-4">
          <h3 className="text-xs font-semibold mb-2">Adicionar amigos</h3>
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {friends.map((f) => (
              <li key={f.friend_id}>
                <label className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-container-low cursor-pointer text-xs">
                  <input type="checkbox" checked={picked.includes(f.friend_id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, f.friend_id] : p.filter((x) => x !== f.friend_id)))} className="accent-[var(--color-primary,#2563eb)]" />
                  @{f.username}
                </label>
              </li>
            ))}
          </ul>
          <button type="button" disabled={picked.length === 0} onClick={() => { run({ action: 'add', user_ids: picked }); setPicked([]); }} className="mt-2 px-4 py-2 rounded-full text-xs font-semibold bg-primary-container text-on-primary disabled:opacity-50">
            Adicionar {picked.length > 0 ? `(${picked.length})` : ''}
          </button>
        </section>
      )}

      <button type="button" onClick={() => { void groupsApi.manage(groupId, { action: 'leave' }).then(() => { window.location.href = '/mensagens'; }); }} className="w-full py-2.5 rounded-full text-xs font-semibold text-error bg-surface-container hover:bg-surface-container-high">
        Sair do grupo
      </button>

      {error && <p className="mt-3 text-xs text-error">{error}</p>}
    </ModalShell>
  );
};
