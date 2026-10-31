import React, { useState } from 'react';
import { blocksApi, reportsApi } from '../../lib/api';
import { ModalShell } from './ModalShell';

const REASONS: Array<{ id: string; label: string; hint: string }> = [
  { id: 'spam', label: 'Spam', hint: 'Mensagens repetidas ou propaganda' },
  { id: 'assedio', label: 'Assédio ou ameaça', hint: 'Ofensas, intimidação ou perseguição' },
  { id: 'conteudo_improprio', label: 'Conteúdo impróprio', hint: 'Nudez, violência ou conteúdo perturbador' },
  { id: 'golpe', label: 'Golpe ou falsidade', hint: 'Tentativa de enganar ou roubar dados' },
  { id: 'outro', label: 'Outro motivo', hint: 'Conte o que aconteceu' },
];

interface ReportModalProps {
  userId: number;
  username: string;
  messageId?: number | null;
  alreadyBlocked?: boolean;
  onDone: (result: { reported: boolean; blocked: boolean }) => void;
  onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  userId,
  username,
  messageId,
  alreadyBlocked,
  onDone,
  onClose,
}) => {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(!alreadyBlocked);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!reason) {
      setError('Escolha um motivo.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await reportsApi.send({ user_id: userId, reason, details: details.trim() || undefined, message_id: messageId });
      let blocked = false;
      if (alsoBlock && !alreadyBlocked) {
        await blocksApi.block(userId);
        blocked = true;
      }
      onDone({ reported: true, blocked });
    } catch (err: any) {
      setError(err?.message || 'Não foi possível enviar a denúncia.');
    } finally {
      setSending(false);
    }
  };

  return (
    <ModalShell
      title={messageId ? 'Denunciar mensagem' : `Denunciar @${username}`}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full text-xs font-semibold text-on-surface bg-surface-container hover:bg-surface-container-high cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={sending}
            className="px-4 py-2 rounded-full text-xs font-semibold bg-error text-white hover:opacity-90 disabled:opacity-60 cursor-pointer"
          >
            {sending ? 'Enviando...' : 'Enviar denúncia'}
          </button>
        </div>
      }
    >
      <p className="text-[11px] text-on-surface-variant mb-4">
        {messageId ? `Sobre a mensagem de @${username}. ` : ''}
        Sua denúncia é confidencial: a pessoa não é avisada.
      </p>

      <fieldset className="space-y-2 mb-4">
        <legend className="sr-only">Motivo</legend>
        {REASONS.map((r) => (
          <label
            key={r.id}
            className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-colors ${
              reason === r.id
                ? 'border-primary bg-primary/5'
                : 'border-outline-variant/40 bg-surface-container-low hover:bg-surface-container'
            }`}
          >
            <input
              type="radio"
              name="report-reason"
              value={r.id}
              checked={reason === r.id}
              onChange={() => setReason(r.id)}
              className="mt-0.5 accent-[var(--color-primary,#2563eb)]"
            />
            <span>
              <span className="block text-xs font-semibold text-on-surface">{r.label}</span>
              <span className="block text-[11px] text-on-surface-variant">{r.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <label htmlFor="report-details" className="text-xs font-semibold text-on-surface">
        Detalhes (opcional)
      </label>
      <textarea
        id="report-details"
        value={details}
        maxLength={500}
        onChange={(e) => setDetails(e.target.value)}
        rows={3}
        className="mt-2 w-full p-3 rounded-xl bg-surface-container-low text-xs text-on-surface placeholder:text-on-surface-variant outline-none focus:ring-1 focus:ring-primary-container resize-none"
        placeholder="Explique o que aconteceu"
      />

      {!alreadyBlocked && (
        <label className="mt-3 flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={alsoBlock}
            onChange={(e) => setAlsoBlock(e.target.checked)}
            className="w-4 h-4 accent-[var(--color-primary,#2563eb)]"
          />
          <span className="text-xs text-on-surface">Bloquear @{username} também</span>
        </label>
      )}

      {error && <p className="mt-3 text-xs text-error">{error}</p>}
    </ModalShell>
  );
};
