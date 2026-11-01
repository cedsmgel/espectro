import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { mfaApi } from '../lib/api';

interface StepUpDialogProps {
  onDone: (ok: boolean) => void;
}

// Pede o código de verificação de novo antes de uma ação sensível (trocar senha, exportar dados, excluir conta...)
export const StepUpDialog: React.FC<StepUpDialogProps> = ({ onDone }) => {
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onDone]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await mfaApi.reauth(recovery ? { recovery_code: code.trim() } : { code: code.replace(/\s+/g, '') });
      onDone(true);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível verificar.');
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[150] bg-black/50 flex items-end sm:items-center justify-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onDone(false)}>
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stepup-title"
        className="w-full sm:max-w-sm bg-surface text-on-surface border border-outline-variant rounded-t-3xl sm:rounded-3xl p-6 flex flex-col gap-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        <div>
          <h2 id="stepup-title" className="text-lg font-bold">Confirme sua identidade</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            {recovery ? 'Digite um código de recuperação.' : 'Digite o código de 6 dígitos do seu aplicativo autenticador.'}
          </p>
        </div>
        <input
          ref={inputRef}
          type="text"
          inputMode={recovery ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          autoCapitalize="characters"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={recovery ? 14 : 7}
          aria-label={recovery ? 'Código de recuperação' : 'Código do aplicativo'}
          className="w-full px-4 py-3 text-base tracking-widest bg-transparent border border-outline-variant rounded-2xl focus:outline-none focus:border-on-surface"
        />
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={() => onDone(false)} className="flex-1 h-11 rounded-full border border-outline-variant text-sm font-semibold cursor-pointer hover:bg-surface-container">
            Cancelar
          </button>
          <button type="submit" disabled={busy || !code.trim()} className="flex-1 h-11 rounded-full bg-primary-container text-on-primary text-sm font-semibold cursor-pointer disabled:opacity-60">
            {busy ? 'Verificando...' : 'Confirmar'}
          </button>
        </div>
        <button type="button" onClick={() => { setRecovery((v) => !v); setCode(''); setError(null); }} className="text-sm text-on-surface-variant hover:text-on-surface hover:underline cursor-pointer self-start">
          {recovery ? 'Usar o código do aplicativo' : 'Usar um código de recuperação'}
        </button>
      </form>
    </div>,
    document.body
  );
};

// run(fn): executa a ação; se o servidor pedir verificação recente, mostra o diálogo e tenta de novo uma vez
export function useStepUp() {
  const [pending, setPending] = useState<((ok: boolean) => void) | null>(null);

  const ask = () => new Promise<boolean>((resolve) => setPending(() => resolve));

  async function run<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (err: any) {
      if (!err?.mfaRequired) throw err;
      const ok = await ask();
      if (!ok) throw new Error('Verificação cancelada.');
      return action();
    }
  }

  const dialog = pending ? (
    <StepUpDialog
      onDone={(ok) => {
        pending(ok);
        setPending(null);
      }}
    />
  ) : null;

  return { run, dialog };
}
