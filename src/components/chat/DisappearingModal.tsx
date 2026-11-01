import React, { useState } from 'react';
import { ModalShell } from './ModalShell';

export const DISAPPEAR_CHOICES = [
  { seconds: 0, label: 'Desativadas', hint: 'As mensagens ficam para sempre.' },
  { seconds: 24 * 3600, label: '24 horas', hint: 'Somem um dia depois de enviadas.' },
  { seconds: 7 * 24 * 3600, label: '7 dias', hint: 'Somem uma semana depois de enviadas.' },
  { seconds: 90 * 24 * 3600, label: '90 dias', hint: 'Somem três meses depois de enviadas.' },
];

export function disappearLabel(seconds: number): string {
  return DISAPPEAR_CHOICES.find((c) => c.seconds === seconds)?.label ?? 'Desativadas';
}

interface Props {
  current: number;
  onSave: (seconds: number) => Promise<void> | void;
  onClose: () => void;
}

// Escolha do prazo das mensagens temporárias; vale só para as mensagens enviadas depois
export const DisappearingModal: React.FC<Props> = ({ current, onSave, onClose }) => {
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(value);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title="Mensagens temporárias"
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || value === current}
          className="w-full h-10 rounded-full text-xs font-semibold bg-primary-container text-on-primary disabled:opacity-50 cursor-pointer"
        >
          Salvar
        </button>
      }
    >
      <p className="text-xs text-on-surface-variant mb-3">
        As novas mensagens somem da conversa depois do prazo escolhido. As que já foram enviadas não mudam.
      </p>
      <ul className="flex flex-col gap-1">
        {DISAPPEAR_CHOICES.map((c) => (
          <li key={c.seconds}>
            <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-container-low cursor-pointer">
              <input type="radio" name="disappear" checked={value === c.seconds} onChange={() => setValue(c.seconds)} className="accent-[var(--color-primary,#2563eb)]" />
              <span>
                <span className="block text-xs font-semibold text-on-surface">{c.label}</span>
                <span className="block text-[11px] text-on-surface-variant">{c.hint}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </ModalShell>
  );
};
