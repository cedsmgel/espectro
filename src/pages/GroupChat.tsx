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
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { ChatMenu } from '../components/chat/ChatMenu';
import { ModalShell } from '../components/chat/ModalShell';
import { MediaPicker } from '../components/chat/MediaPicker';
import { useTheme } from '../context/ThemeContext';

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
  const { isDark: isDarkTheme } = useTheme();

  const [detail, setDetail] = useState<Detail | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showManage, setShowManage] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadDetail = useCallback(async () => {
    try {
      setDetail(await groupsApi.detail(groupId));
    } catch (err: any) {
      setError(err?.message || 'Grupo não encontrado.');
    }
  }, [groupId]);

  // Primeira página e novas mensagens a cada 4 segundos
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
    const timer = window.setInterval(() => void loadLatest(), 4000);
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

  const sendPayload = async (payload: { content?: string; message_type?: 'gif' | 'sticker'; media_url?: string }) => {
    try {
      const res = await groupsApi.send(groupId, payload);
      setMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
    } catch (err: any) {
      setError(err?.message || 'Não foi possível enviar.');
    }
  };

  const sendText = async () => {
    const content = text.trim();
    if (!content) return;
    setText('');
    setShowEmoji(false);
    await sendPayload({ content });
    inputRef.current?.focus();
  };

  const leave = async () => {
    if (!window.confirm('Sair deste grupo? Você deixará de ver as mensagens novas.')) return;
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
  if (!detail) {
    return <div className="min-h-screen flex items-center justify-center text-xs text-on-surface-variant">Carregando...</div>;
  }

  const isAdmin = detail.my_role === 'admin';
  const canSend = isAdmin || !detail.group.only_admins_send;
  const roleOf = new Map(detail.members.map((m) => [m.id, m]));

  return (
    <div className="h-dvh flex flex-col bg-surface text-on-surface overflow-hidden">
      {/* Cabeçalho: mesmo padrão do chat privado */}
      <div className="min-h-14 sm:min-h-16 pt-[env(safe-area-inset-top)] px-3 sm:px-6 bg-surface-container-lowest border-b border-outline-variant/30 flex items-center justify-between shadow-xs z-10 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link to="/mensagens" className="p-1.5 rounded-full text-on-surface-variant hover:bg-surface-container" aria-label="Voltar">
            <span className="material-symbols-outlined text-[24px]">arrow_back</span>
          </Link>
          <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-sm uppercase flex-shrink-0">
            {detail.group.name.charAt(0)}
          </div>
          <button type="button" onClick={() => setShowManage(true)} className="min-w-0 text-left cursor-pointer">
            <span className="block font-semibold text-sm truncate">{detail.group.name}</span>
            <span className="block text-[11px] text-on-surface-variant truncate">
              {detail.members.map((m) => `@${m.username}`).join(', ')}
            </span>
          </button>
        </div>
        <ChatMenu
          title="Opções do grupo"
          items={[
            { key: 'manage', label: 'Dados do grupo', icon: 'info', onSelect: () => setShowManage(true) },
            { key: 'leave', label: 'Sair do grupo', icon: 'logout', danger: true, onSelect: leave },
          ]}
        />
      </div>

      {/* Histórico */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-1 min-h-0 overscroll-contain">
        {hasMore && (
          <div className="flex justify-center mb-2">
            <button type="button" onClick={loadOlder} className="text-[11px] font-semibold text-primary px-4 py-1.5 rounded-full bg-surface-container-low">
              Carregar mensagens anteriores
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <div className="text-center text-xs text-on-surface-variant py-10">
            <p className="font-semibold text-on-surface">Nenhuma mensagem ainda</p>
            <p>Diga um oi para o grupo.</p>
          </div>
        )}

        {messages.map((m, idx) => {
          if (m.message_type === 'system') {
            return (
              <div key={m.id} className="flex justify-center my-2">
                <span className="text-[11px] text-on-surface-variant bg-surface-container-low px-3 py-1 rounded-full">{m.content}</span>
              </div>
            );
          }

          const mine = m.sender_id === user?.id;
          const prev = messages[idx - 1];
          const sameAsPrev = prev && prev.sender_id === m.sender_id && prev.message_type !== 'system';
          const sender = m.sender_id ? roleOf.get(m.sender_id) : undefined;
          const bare = m.message_type === 'gif' || m.message_type === 'sticker';

          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} ${sameAsPrev ? 'mt-0.5' : 'mt-3'}`}>
              <div className={`flex flex-col max-w-[85%] sm:max-w-md ${mine ? 'items-end' : 'items-start'}`}>
                {!mine && !sameAsPrev && (
                  <span className="flex items-center gap-1.5 text-[11px] font-bold mb-0.5 ml-1" style={{ color: nameColor(m.sender_id) }}>
                    @{m.sender_username}
                    {sender?.role === 'admin' && (
                      <span className="text-[9px] px-1.5 rounded-full bg-primary/15 text-primary font-semibold">admin</span>
                    )}
                  </span>
                )}
                <div
                  className={
                    bare
                      ? ''
                      : `px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words rounded-2xl ${
                          mine
                            ? 'bg-primary-container text-on-primary rounded-br-md'
                            : 'bg-surface-container-low text-on-surface border border-outline-variant/30 rounded-bl-md'
                        }`
                  }
                >
                  {m.message_type === 'gif' && m.media_url && (
                    <img src={m.media_url} alt="GIF" className="max-w-[240px] rounded-lg" />
                  )}
                  {m.message_type === 'sticker' && m.media_url && (
                    <img src={m.media_url} alt="Figurinha" className="max-w-[160px]" />
                  )}
                  {!bare && m.content}
                </div>
                <span className="text-[10px] text-on-surface-variant mt-0.5 mx-1">
                  {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-error bg-error-container/60 cursor-pointer" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      {/* Entrada: emojis, GIFs e figurinhas, texto e enviar */}
      <div className="p-2.5 sm:p-4 pb-[max(0.75rem,calc(env(safe-area-inset-bottom)+0.6rem))] bg-surface-container-lowest border-t border-outline-variant/30 flex-shrink-0 relative">
        {showEmoji && (
          <div className="absolute bottom-20 left-3 sm:left-12 z-30 rounded-2xl overflow-hidden shadow-xl">
            <Picker
              data={data}
              onEmojiSelect={(e: any) => setText((t) => t + e.native)}
              theme={isDarkTheme ? 'dark' : 'light'}
              locale="pt"
              previewPosition="none"
              skinTonePosition="none"
              navPosition="top"
              maxFrequentRows={2}
              perLine={8}
            />
          </div>
        )}
        {showMedia && (
          <div className="absolute bottom-20 left-3 sm:left-12 z-30">
            <MediaPicker
              onClose={() => setShowMedia(false)}
              onSelect={(c) => {
                setShowMedia(false);
                void sendPayload({ message_type: c.type, media_url: c.url });
              }}
            />
          </div>
        )}

        {canSend ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendText();
            }}
            className="flex items-center gap-1 sm:gap-2 bg-surface-container-low rounded-full px-2 py-1.5"
          >
            <button
              type="button"
              onClick={() => {
                setShowEmoji((v) => !v);
                setShowMedia(false);
              }}
              className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer ${
                showEmoji ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'
              }`}
              title="Emojis"
            >
              <span className="material-symbols-outlined text-[20px]">sentiment_satisfied</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowMedia((v) => !v);
                setShowEmoji(false);
              }}
              className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer text-[11px] font-bold ${
                showMedia ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'
              }`}
              title="GIFs e figurinhas"
            >
              GIF
            </button>
            <input
              ref={inputRef}
              type="text"
              value={text}
              maxLength={2000}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Mensagem para ${detail.group.name}...`}
              className="flex-1 bg-transparent border-0 outline-none text-xs text-on-surface placeholder:text-on-surface-variant px-2"
            />
            <button type="submit" disabled={!text.trim()} className="w-8 h-8 rounded-full flex items-center justify-center text-primary disabled:opacity-40 hover:bg-surface-container cursor-pointer" title="Enviar">
              <span className="material-symbols-outlined text-[20px]">send</span>
            </button>
          </form>
        ) : (
          <p className="text-center text-xs text-on-surface-variant py-2">Só os administradores podem enviar mensagens neste grupo.</p>
        )}
      </div>

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

const NAME_COLORS = ['#f97316', '#22c55e', '#06b6d4', '#a855f7', '#ec4899', '#eab308', '#3b82f6', '#ef4444'];
function nameColor(senderId: number | null): string {
  return NAME_COLORS[Math.abs(senderId || 0) % NAME_COLORS.length];
}

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
