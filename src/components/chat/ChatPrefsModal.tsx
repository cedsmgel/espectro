import React, { useEffect, useState } from 'react';
import { accountApi, blocksApi, BlockedUser } from '../../lib/api';
import { ChatFontSize, ChatPrefs } from '../../hooks/useChatPrefs';
import type { PushState } from '../../hooks/usePush';
import { ModalShell } from './ModalShell';

interface ChatPrefsModalProps {
  prefs: ChatPrefs;
  onChange: (patch: Partial<ChatPrefs>) => void;
  push: PushState;
  onClose: () => void;
}

const FONT_OPTIONS: Array<{ id: ChatFontSize; label: string }> = [
  { id: 'sm', label: 'Pequeno' },
  { id: 'md', label: 'Médio' },
  { id: 'lg', label: 'Grande' },
];

export const ChatPrefsModal: React.FC<ChatPrefsModalProps> = ({ prefs, onChange, push, onClose }) => {
  const [showLastSeen, setShowLastSeen] = useState<boolean | null>(null);
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [unblockingId, setUnblockingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    blocksApi
      .list()
      .then((list) => {
        if (!cancelled) setBlocked(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const unblock = async (person: BlockedUser) => {
    setUnblockingId(person.id);
    try {
      await blocksApi.unblock(person.id);
      setBlocked((prev) => prev.filter((b) => b.id !== person.id));
    } catch (err: any) {
      setPrivacyError(err?.message || 'Não foi possível desbloquear.');
    } finally {
      setUnblockingId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    accountApi
      .getSettings()
      .then((settings) => {
        if (!cancelled) setShowLastSeen(settings.show_last_seen);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleLastSeen = async (value: boolean) => {
    const previous = showLastSeen;
    setShowLastSeen(value);
    setPrivacyError(null);
    try {
      const res = await accountApi.updateSettings({ show_last_seen: value });
      setShowLastSeen(res.settings.show_last_seen);
    } catch (err: any) {
      setShowLastSeen(previous);
      setPrivacyError(err?.message || 'Não foi possível salvar.');
    }
  };

  return (
    <ModalShell title="Preferências do chat" onClose={onClose}>
      <p className="text-[11px] text-on-surface-variant mb-4">
        As opções de notificação e de texto valem só neste aparelho.
      </p>

      <div className="mb-5 p-3 rounded-2xl bg-surface-container-low">
        <div className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-xs font-semibold text-on-surface">Notificações push</span>
            <span className="block text-[11px] text-on-surface-variant mt-0.5">
              {!push.supported
                ? 'Este navegador não suporta notificações.'
                : push.permission === 'denied'
                ? 'Bloqueadas no navegador. Libere nas configurações do site.'
                : push.subscribed
                ? 'Ativas neste aparelho, mesmo com o app fechado.'
                : 'Receba mensagens e pedidos de amizade com o app fechado.'}
            </span>
          </span>
          {push.supported && push.permission !== 'denied' && (
            <button
              type="button"
              disabled={push.busy}
              onClick={push.subscribed ? push.disable : push.enable}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer disabled:opacity-60 ${
                push.subscribed
                  ? 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                  : 'bg-primary-container text-on-primary hover:bg-primary'
              }`}
            >
              {push.busy ? 'Aguarde...' : push.subscribed ? 'Desativar' : 'Ativar'}
            </button>
          )}
        </div>

        {push.iosInstallNeeded && (
          <p className="mt-2 text-[11px] text-on-surface-variant">
            No iPhone, toque em Compartilhar e em "Adicionar à Tela de Início" para poder ativar.
          </p>
        )}

        {push.subscribed && (
          <label className="mt-3 pt-3 border-t border-outline-variant flex items-center justify-between gap-4 cursor-pointer">
            <span className="text-[11px] text-on-surface">Mostrar o texto da mensagem na notificação</span>
            <input
              type="checkbox"
              checked={push.showPreview}
              onChange={(e) => push.changePreview(e.target.checked)}
              className="w-5 h-5 accent-[var(--color-primary,#2563eb)] cursor-pointer"
            />
          </label>
        )}

        {push.error && <p className="mt-2 text-[11px] text-error">{push.error}</p>}
      </div>

      <div className="mb-5">
        <span className="text-xs font-semibold text-on-surface">Tamanho do texto</span>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {FONT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange({ fontSize: option.id })}
              className={`py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                prefs.fontSize === option.id
                  ? 'bg-primary-container text-on-primary border-transparent'
                  : 'bg-surface-container-low text-on-surface border-outline-variant/40 hover:bg-surface-container'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center justify-between gap-4 cursor-pointer mb-5">
        <span>
          <span className="block text-xs font-semibold text-on-surface">Prévia das mensagens na lista</span>
          <span className="block text-[11px] text-on-surface-variant mt-0.5">
            Desative para esconder o texto da última mensagem.
          </span>
        </span>
        <input
          type="checkbox"
          checked={prefs.showPreviews}
          onChange={(e) => onChange({ showPreviews: e.target.checked })}
          className="w-5 h-5 accent-[var(--color-primary,#2563eb)] cursor-pointer"
        />
      </label>

      <label className="flex items-center justify-between gap-4 cursor-pointer">
        <span>
          <span className="block text-xs font-semibold text-on-surface">Mostrar meu "visto por último"</span>
          <span className="block text-[11px] text-on-surface-variant mt-0.5">
            Seus amigos veem quando você esteve online. Se desligar, você também deixa de ver o dos outros.
          </span>
        </span>
        <input
          type="checkbox"
          disabled={showLastSeen === null}
          checked={showLastSeen ?? true}
          onChange={(e) => toggleLastSeen(e.target.checked)}
          className="w-5 h-5 accent-[var(--color-primary,#2563eb)] cursor-pointer disabled:opacity-50"
        />
      </label>
      {privacyError && <p className="mt-2 text-[11px] text-error">{privacyError}</p>}

      <div className="mt-5 pt-4 border-t border-outline-variant">
        <span className="text-xs font-semibold text-on-surface">Usuários bloqueados</span>
        {blocked.length === 0 ? (
          <p className="mt-1 text-[11px] text-on-surface-variant">Você não bloqueou ninguém.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {blocked.map((person) => (
              <li key={person.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-container-low">
                <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                  {person.username.charAt(0)}
                </div>
                <span className="flex-1 min-w-0 text-xs font-semibold text-on-surface truncate">@{person.username}</span>
                <button
                  type="button"
                  disabled={unblockingId === person.id}
                  onClick={() => unblock(person)}
                  className="px-3 py-1.5 rounded-full bg-surface-container text-on-surface text-[11px] font-semibold hover:bg-surface-container-high disabled:opacity-60 cursor-pointer"
                >
                  Desbloquear
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ModalShell>
  );
};
