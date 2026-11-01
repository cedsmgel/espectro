import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usePush } from '../hooks/usePush';
import { authStorage } from '../lib/api';

const DISMISSED_KEY = 'espectro_push_prompt_dismissed';

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

// Convite para ativar notificações logo no início. O navegador só mostra o pedido de
// permissão depois de um toque, então o botão aqui chama o pedido diretamente.
export const PushPrompt: React.FC = () => {
  const location = useLocation();
  const push = usePush();
  const [dismissed, setDismissed] = useState(wasDismissed);

  const isLoggedIn = Boolean(authStorage.getToken());
  const shouldShow =
    isLoggedIn &&
    !dismissed &&
    location.pathname !== '/login' &&
    push.supported &&
    push.permission === 'default' &&
    !push.iosInstallNeeded;

  if (!shouldShow) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {}
    setDismissed(true);
  };

  return (
    <div
      role="dialog"
      aria-label="Ativar notificações"
      className="fixed z-50 left-3 right-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6 md:left-auto md:right-6 md:w-96 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-2xl p-4 flex flex-col gap-3"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[22px]">notifications_active</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-on-surface">Quer receber avisos?</p>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Saiba quando chegam mensagens, pedidos de amizade e respostas, mesmo com o app fechado.
          </p>
        </div>
      </div>
      {push.error && <p className="text-xs text-error">{push.error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={dismiss}
          className="px-4 py-2 rounded-full text-xs font-semibold text-on-surface-variant hover:bg-surface-container cursor-pointer"
        >
          Agora não
        </button>
        <button
          type="button"
          disabled={push.busy}
          onClick={async () => {
            await push.enable();
            dismiss();
          }}
          className="px-4 py-2 rounded-full text-xs font-semibold bg-primary-container text-on-primary hover:bg-primary cursor-pointer disabled:opacity-50"
        >
          {push.busy ? 'Ativando...' : 'Ativar notificações'}
        </button>
      </div>
    </div>
  );
};
