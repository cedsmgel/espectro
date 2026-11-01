import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { authStorage } from '../lib/api';
import { isIos, isStandalone, promptInstall, useCanInstall } from '../lib/install';
import { useIsPhone } from '../hooks/useIsPhone';
import { usePush } from '../hooks/usePush';

const DISMISSED_KEY = 'espectro_install_prompt_dismissed_at';
const PUSH_DISMISSED_KEY = 'espectro_push_prompt_dismissed';
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;
const SHOW_AFTER_MS = 8000;

function snoozed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISSED_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

function pushPromptDismissed(): boolean {
  try {
    return localStorage.getItem(PUSH_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

// Convite para instalar o app na tela inicial (celular). No Android abre o instalador do
// navegador; no iPhone ensina o caminho, já que lá a instalação é manual.
export const InstallPrompt: React.FC = () => {
  const location = useLocation();
  const isPhone = useIsPhone();
  const push = usePush();
  const canInstall = useCanInstall();
  const [hidden, setHidden] = useState(snoozed);
  const [ready, setReady] = useState(false);
  const [installing, setInstalling] = useState(false);

  // Não aparece logo na abertura, para não competir com o que a pessoa veio fazer
  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), SHOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const ios = isIos();
  // O convite de notificações vem primeiro, para os dois não ficarem empilhados
  const pushPromptPending =
    push.supported && push.permission === 'default' && !push.iosInstallNeeded && !pushPromptDismissed();

  const shouldShow =
    ready &&
    !hidden &&
    isPhone &&
    Boolean(authStorage.getToken()) &&
    location.pathname !== '/login' &&
    !isStandalone() &&
    (canInstall || ios) &&
    !pushPromptPending;

  if (!shouldShow) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {}
    setHidden(true);
  };

  const install = async () => {
    setInstalling(true);
    const outcome = await promptInstall();
    setInstalling(false);
    if (outcome !== 'accepted') dismiss();
  };

  return (
    <div
      role="dialog"
      aria-label="Instalar o Espectro"
      className="fixed z-50 left-3 right-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] rounded-2xl bg-surface-container-lowest border border-outline-variant shadow-2xl p-4 flex flex-col gap-3"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shrink-0 font-extrabold">
          E
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-on-surface">Instale o Espectro no celular</p>
          {canInstall ? (
            <p className="text-xs text-on-surface-variant mt-0.5">
              Abre mais rápido, em tela cheia, e recebe avisos como um app de verdade.
            </p>
          ) : (
            <p className="text-xs text-on-surface-variant mt-0.5">
              Toque em <span className="material-symbols-outlined text-[15px] align-text-bottom">ios_share</span>{' '}
              <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>. É também assim que
              o iPhone libera as notificações.
            </p>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={dismiss}
          className="px-4 py-2 rounded-full text-xs font-semibold text-on-surface-variant hover:bg-surface-container cursor-pointer"
        >
          {canInstall ? 'Agora não' : 'Entendi'}
        </button>
        {canInstall && (
          <button
            type="button"
            disabled={installing}
            onClick={install}
            className="px-4 py-2 rounded-full text-xs font-semibold bg-primary-container text-on-primary hover:bg-primary cursor-pointer disabled:opacity-50"
          >
            Instalar
          </button>
        )}
      </div>
    </div>
  );
};
