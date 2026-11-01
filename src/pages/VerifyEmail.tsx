import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authFlowApi } from '../lib/api';

// Destino do link do e-mail de confirmação. A confirmação só acontece ao clicar no botão,
// para que programas que "abrem" links automaticamente não gastem o token.
export const VerifyEmail: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const confirm = async () => {
    setState('busy');
    try {
      await authFlowApi.verifyEmail(token);
      setState('ok');
    } catch (err: any) {
      setMessage(err?.message || 'Não foi possível confirmar.');
      setState('error');
    }
  };

  return (
    <div className="min-h-dvh bg-surface text-on-surface flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md flex flex-col gap-5">
        <Link to="/" className="inline-flex items-center gap-2.5 self-start" aria-label="Espectro, página inicial">
          <div className="w-9 h-9 rounded-xl bg-olive flex items-center justify-center text-on-primary">
            <span className="material-symbols-outlined text-[22px]">grain</span>
          </div>
          <span className="text-xl font-bold tracking-tight">Espectro</span>
        </Link>

        {state === 'ok' ? (
          <>
            <h1 className="text-2xl font-bold">E-mail confirmado</h1>
            <p className="text-sm text-on-surface-variant">Pronto: agora você pode recuperar a senha por este e-mail.</p>
            <Link to="/" className="h-12 rounded-full bg-primary-container text-on-primary text-sm font-semibold flex items-center justify-center">Ir para o Espectro</Link>
          </>
        ) : !token ? (
          <>
            <h1 className="text-2xl font-bold">Link inválido</h1>
            <p className="text-sm text-on-surface-variant">Abra o link completo do e-mail ou peça um novo na central de segurança.</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Confirmar e-mail</h1>
            <p className="text-sm text-on-surface-variant">Confirme que este endereço de e-mail é seu.</p>
            {state === 'error' && <p role="alert" className="text-sm text-error">{message}</p>}
            <button type="button" onClick={() => void confirm()} disabled={state === 'busy'} className="h-12 rounded-full bg-primary-container text-on-primary text-sm font-semibold cursor-pointer disabled:opacity-60">
              {state === 'busy' ? 'Confirmando...' : 'Confirmar e-mail'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
