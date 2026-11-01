import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authFlowApi } from '../lib/api';
import { requestAuth } from '../lib/authEvents';

const fieldClass = 'block w-full appearance-none px-0 py-3 bg-transparent border-0 border-b border-outline-variant outline-none text-base text-on-surface focus:border-on-surface';

// Destino do link do e-mail de recuperação: /redefinir-senha?token=...
export const ResetPassword: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('A senha deve ter pelo menos 8 caracteres.');
    if (password !== confirm) return setError('A confirmação não confere com a nova senha.');
    setBusy(true);
    try {
      await authFlowApi.resetPassword(token, password);
      setDone(true);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível redefinir a senha.');
    } finally {
      setBusy(false);
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

        {!token ? (
          <>
            <h1 className="text-2xl font-bold">Link inválido</h1>
            <p className="text-sm text-on-surface-variant">Abra o link completo que enviamos por e-mail ou peça um novo na tela de entrada.</p>
          </>
        ) : done ? (
          <>
            <h1 className="text-2xl font-bold">Senha alterada</h1>
            <p className="text-sm text-on-surface-variant leading-relaxed">Por segurança, todos os aparelhos foram desconectados. Entre com a nova senha.</p>
            <button
              type="button"
              onClick={() => {
                navigate('/', { replace: true });
                requestAuth({ mode: 'login' });
              }}
              className="h-12 rounded-full bg-primary-container text-on-primary text-sm font-semibold cursor-pointer"
            >
              Entrar
            </button>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <h1 className="text-2xl font-bold">Criar nova senha</h1>
            <div className="flex flex-col">
              <label htmlFor="rp-new" className="text-sm text-on-surface-variant">Nova senha (mínimo de 8 caracteres)</label>
              <input id="rp-new" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={fieldClass} required maxLength={128} />
            </div>
            <div className="flex flex-col">
              <label htmlFor="rp-confirm" className="text-sm text-on-surface-variant">Repita a nova senha</label>
              <input id="rp-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={fieldClass} required maxLength={128} />
            </div>
            {error && <p role="alert" className="text-sm text-error">{error}</p>}
            <button type="submit" disabled={busy} className="h-12 rounded-full bg-primary-container text-on-primary text-sm font-semibold cursor-pointer disabled:opacity-60">
              {busy ? 'Salvando...' : 'Redefinir senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
