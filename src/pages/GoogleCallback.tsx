import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authStorage, googleApi } from '../lib/api';
import { requestAuth } from '../lib/authEvents';

// Volta do Google (/entrar/google?code=...): troca o código de uso único por uma sessão e leva a pessoa ao destino
export const GoogleCallback: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const code = params.get('code');
    const linkToken = params.get('link');
    const linkEmail = params.get('email');
    const signupToken = params.get('signup');
    let next = '/';
    try {
      next = sessionStorage.getItem('espectro_google_next') || '/';
      sessionStorage.removeItem('espectro_google_next');
    } catch {}
    // Só caminhos internos
    if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/entrar/google')) next = '/';

    // O Google identificou a pessoa, mas o e-mail já tem conta: abre a tela que pede a senha dessa conta para ligar
    if (linkToken) {
      navigate(next, { replace: true });
      requestAuth({ mode: 'login', googleLinkToken: linkToken, googleEmail: linkEmail || undefined, redirectTo: next });
      return;
    }

    // Primeiro acesso com o Google: pede a declaração de idade mínima e o aceite dos termos antes de criar a conta
    if (signupToken) {
      navigate(next, { replace: true });
      requestAuth({ mode: 'register', googleSignupToken: signupToken, googleEmail: linkEmail || undefined, redirectTo: next });
      return;
    }

    if (!code) {
      navigate('/?auth_error=google_failed', { replace: true });
      return;
    }

    googleApi
      .exchange(code)
      .then((res) => {
        if ('mfa_required' in res) {
          // Tem 2FA ativo: segue para o código antes de criar a sessão
          navigate(next, { replace: true });
          requestAuth({ mode: 'login', mfaToken: res.mfa_token, redirectTo: next, reason: 'Sua conta usa verificação em duas etapas.' });
          return;
        }
        authStorage.setToken(res.token);
        authStorage.setUser(res.user);
        navigate(next, { replace: true });
      })
      .catch((err: any) => setError(err?.message || 'Não foi possível entrar com o Google.'));
  }, [params, navigate]);

  return (
    <div className="min-h-dvh bg-surface text-on-surface flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center flex flex-col gap-4" role="status">
        {error ? (
          <>
            <h1 className="text-xl font-bold">Não foi possível entrar</h1>
            <p className="text-sm text-on-surface-variant">{error}</p>
            <Link to="/" className="mx-auto h-11 px-6 rounded-full border border-outline-variant text-sm font-semibold flex items-center hover:bg-surface-container">
              Voltar
            </Link>
          </>
        ) : (
          <>
            <div className="w-8 h-8 mx-auto rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <p className="text-sm text-on-surface-variant">Entrando com o Google...</p>
          </>
        )}
      </div>
    </div>
  );
};
