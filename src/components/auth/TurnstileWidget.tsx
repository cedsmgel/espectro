import React, { useEffect, useRef } from 'react';

interface TurnstileApi {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise: Promise<TurnstileApi> | null = null;

// Carrega o script do Turnstile uma única vez
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile indisponível')));
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error('Não foi possível carregar o Turnstile'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

interface Props {
  siteKey: string;
  // "signup", "login" ou "forgot_password": o servidor confere que o token foi emitido para esta ação
  action: string;
  onToken: (token: string | null) => void;
  // Aumentar este número reinicia o desafio (o token é de uso único)
  resetKey: number;
}

// Desafio anti-bot do Cloudflare. O token chega por onToken; expirado ou com erro volta como null.
export const TurnstileWidget: React.FC<Props> = ({ siteKey, action, onToken, resetKey }) => {
  const holder = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    let cancelled = false;
    onTokenRef.current(null);
    loadTurnstile()
      .then((api) => {
        if (cancelled || !holder.current) return;
        widgetId.current = api.render(holder.current, {
          sitekey: siteKey,
          action,
          theme: 'auto',
          callback: (token: string) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
        });
      })
      .catch(() => onTokenRef.current(null));
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          // o widget já saiu da página
        }
      }
      widgetId.current = null;
    };
  }, [siteKey, action]);

  useEffect(() => {
    if (resetKey === 0 || !widgetId.current || !window.turnstile) return;
    try {
      window.turnstile.reset(widgetId.current);
    } catch {
      // sem widget para reiniciar
    }
  }, [resetKey]);

  return <div ref={holder} className="flex justify-center min-h-[65px]" aria-label="Verificação de segurança" />;
};
