import React from 'react';
import { ChatFontSize, ChatPrefs } from '../../hooks/useChatPrefs';
import { ModalShell } from './ModalShell';

interface ChatPrefsModalProps {
  prefs: ChatPrefs;
  onChange: (patch: Partial<ChatPrefs>) => void;
  onClose: () => void;
}

const FONT_OPTIONS: Array<{ id: ChatFontSize; label: string }> = [
  { id: 'sm', label: 'Pequeno' },
  { id: 'md', label: 'Médio' },
  { id: 'lg', label: 'Grande' },
];

export const ChatPrefsModal: React.FC<ChatPrefsModalProps> = ({ prefs, onChange, onClose }) => (
  <ModalShell title="Preferências do chat" onClose={onClose}>
    <p className="text-[11px] text-on-surface-variant mb-4">Estas opções valem só neste aparelho.</p>

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

    <label className="flex items-center justify-between gap-4 cursor-pointer">
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
  </ModalShell>
);
