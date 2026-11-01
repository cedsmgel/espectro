import { useEffect } from 'react';
import { authStorage, googleApi } from '../lib/api';
import { requestAuth } from '../lib/authEvents';

// Google One Tap (Google Identity Services). O widget é desenhado pelo próprio Google (ou pelo navegador, via FedCM),
// então a identidade visual e as regras de marca vêm de lá. Aqui só decidimos QUANDO mostrar e o que fazer com a credencial.

interface GsiNotification {
  isDismissedMoment?: () => boolean;
  getDismissedReason?: () => string;
  isSkippedMoment?: () => boolean;
  getSkippedReason?: () => string;
}

interface GsiApi {
  accounts: {
    id: {
      initialize: (config: Record<string, unknown>) => void;
      prompt: (listener?: (n: GsiNotification) => void) => void;
      cancel: () => void;
      disableAutoSelect: () => void;
    };
  };
}

declare global {
  interface Window {
    google?: GsiApi;
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client';
// Depois que a pessoa dispensa o widget, não voltamos a mostrar por 24 horas (o Google ainda aplica o próprio intervalo)
const SNOOZE_KEY = 'espectro_onetap_snooze_until';
const SNOOZE_MS = 24 * 60 * 60 * 1000;

let gsiPromise: Promise<void> | null = null;
// No máximo uma exibição por carregamento da página: fechar e reabrir o modal não faz o widget reaparecer
let promptedThisPage = false;

function loadGsi(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gsiPromise) {
    gsiPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        gsiPromise = null;
        reject(new Error('Google Identity Services indisponível'));
      };
      document.head.appendChild(script);
    });
  }
  return gsiPromise;
}

function snoozed(): boolean {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY) || 0) > Date.now();
  } catch {
    return false;
  }
}

function snooze(): void {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
  } catch {}
}

let configPromise: Promise<{ google_enabled?: boolean; google_client_id?: string | null }> | null = null;
function loadConfig() {
  if (!configPromise) {
    configPromise = fetch('/api/config')
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
  }
  return configPromise;
}

// Envia a credencial ao servidor (que valida assinatura, emissor, público, validade e nonce) e trata o resultado
async function handleCredential(credential: string): Promise<void> {
  try {
    const res = await googleApi.oneTap(credential);
    if ('mfa_required' in res) {
      // Conta com verificação em duas etapas: o modal abre direto no código
      requestAuth({ mode: 'login', mfaToken: res.mfa_token, reason: 'Sua conta usa verificação em duas etapas.' });
      return;
    }
    if ('link_required' in res) {
      // Já existe uma conta com o e-mail deste Google: nada é ligado sem a pessoa provar que é dona dela
      requestAuth({
        mode: 'login',
        googleLinkToken: res.link_token,
        reason: 'Já existe uma conta do Espectro com o e-mail deste Google. Entre com a senha para ligá-lo.',
      });
      return;
    }
    authStorage.setToken(res.token);
    authStorage.setUser(res.user);
  } catch (err: any) {
    // Falha silenciosa para não atrapalhar, exceto conta suspensa, que precisa de explicação
    if (/suspens/i.test(err?.message || '')) requestAuth({ mode: 'login', reason: err.message });
  }
}

// enabled = visitante, sem modal de autenticação aberto, na página inicial/login
export function useGoogleOneTap(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || promptedThisPage || snoozed()) return;
    let cancelled = false;

    (async () => {
      const config = await loadConfig();
      if (cancelled || !config.google_enabled || !config.google_client_id) return;
      await loadGsi();
      if (cancelled || !window.google) return;
      const { nonce } = await googleApi.oneTapNonce();
      if (cancelled) return;

      window.google.accounts.id.initialize({
        client_id: config.google_client_id,
        callback: (response: { credential?: string }) => {
          if (response.credential) void handleCredential(response.credential);
        },
        nonce,
        auto_select: false, // nunca entra sozinho: a pessoa sempre confirma
        cancel_on_tap_outside: true,
        context: 'signin',
        itp_support: true,
      });
      promptedThisPage = true;
      window.google.accounts.id.prompt((notification) => {
        const dismissed = notification.isDismissedMoment?.() && notification.getDismissedReason?.();
        const skipped = notification.isSkippedMoment?.() && notification.getSkippedReason?.();
        // Fechou o widget ou tocou fora: respeita e não insiste. Entrar (credential_returned) e o cancelamento
        // feito por nós (cancel_called) não contam como recusa.
        if ((dismissed && dismissed !== 'credential_returned' && dismissed !== 'cancel_called') || skipped === 'tap_outside') snooze();
      });
    })().catch(() => {
      // Sem rede, bloqueador de scripts ou Google fora do ar: o login normal continua funcionando
    });

    return () => {
      cancelled = true;
      window.google?.accounts?.id?.cancel();
    };
  }, [enabled]);
}
