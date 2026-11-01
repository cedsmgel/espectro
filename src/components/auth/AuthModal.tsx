import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { authApi, authFlowApi } from '../../lib/api';
import { AuthRequest } from '../../lib/authEvents';

interface AuthModalProps {
  request: AuthRequest;
  onClose: () => void;
  onSuccess: () => void;
}

type Mode = 'login' | 'register' | 'forgot' | 'mfa';

const fieldClass =
  'w-full pl-10 pr-4 py-3 text-base bg-transparent border border-outline-variant rounded-2xl text-on-surface focus:outline-none focus:border-on-surface transition-colors';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

// Login e cadastro em um modal único. Usa as mesmas chamadas e validações do restante do app (authApi).
export const AuthModal: React.FC<AuthModalProps> = ({ request, onClose, onSuccess }) => {
  const [mode, setMode] = useState<Mode>(request.mode === 'register' ? 'register' : 'login');
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canRecover, setCanRecover] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  loadingRef.current = loading;

  useEffect(() => {
    void authFlowApi.emailEnabled().then(setCanRecover);
  }, []);

  // O pedido pode mudar o modo com o modal aberto (ex.: "Criar conta" clicado de novo)
  useEffect(() => {
    if (request.mode) setMode(request.mode);
  }, [request.mode]);

  // Aviso deixado por logout forçado (conta suspensa, todos os dispositivos...)
  useEffect(() => {
    try {
      const notice = sessionStorage.getItem('espectro_login_notice');
      if (notice) {
        setError(notice);
        sessionStorage.removeItem('espectro_login_notice');
      }
    } catch {}
  }, []);

  // Foco, ESC, trava de rolagem e retorno do foco ao fechar
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const firstField = dialog?.querySelector<HTMLElement>('input');
    firstField?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loadingRef.current) {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialog) return;
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setForgotSent(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'mfa') {
      if (!mfaToken) return;
      setLoading(true);
      try {
        await authApi.loginMfa(mfaToken, useRecovery ? { recovery_code: mfaCode.trim() } : { code: mfaCode.replace(/\s+/g, '') });
        onSuccess();
      } catch (err: any) {
        const message: string = err?.message || 'Não foi possível verificar.';
        // O token do primeiro passo dura 5 minutos: se acabou, volta a pedir a senha
        if (/expirou/i.test(message)) {
          setMfaToken(null);
          setMfaCode('');
          setMode('login');
        }
        setError(message);
        setLoading(false);
      }
      return;
    }

    if (mode === 'forgot') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Informe um e-mail válido.');
      setLoading(true);
      try {
        await authFlowApi.forgotPassword(email.trim());
        setForgotSent(true);
      } catch (err: any) {
        setError(err?.message || 'Não foi possível enviar agora. Tente novamente.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === 'register') {
      if (!/^[a-zA-Z0-9_]{3,30}$/.test(username.trim())) return setError('O usuário deve ter de 3 a 30 caracteres: letras, números e underline.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Informe um e-mail válido.');
      if (password.length < 8) return setError('A senha deve ter pelo menos 8 caracteres.');
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await authApi.login({ username: identifier.trim(), password });
        if ('mfa_required' in res) {
          setMfaToken(res.mfa_token);
          setMfaCode('');
          setUseRecovery(false);
          setMode('mfa');
          setLoading(false);
          setPassword('');
          return;
        }
      } else {
        await authApi.register({ username: username.trim(), email: email.trim(), password });
        await authApi.login({ username: username.trim(), password });
      }
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível concluir. Tente novamente.');
      setLoading(false);
    }
  };

  const reason =
    mode === 'mfa'
      ? useRecovery
        ? 'Digite um dos seus códigos de recuperação. Cada código vale uma única vez.'
        : 'Digite o código de 6 dígitos do seu aplicativo autenticador.'
      : mode === 'forgot'
      ? 'Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.'
      : request.reason || (mode === 'register' ? 'Crie sua conta para participar do Espectro.' : 'Entre na sua conta para continuar.');

  return createPortal(
    <div
      className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center bg-black/50 sm:p-4 animate-in fade-in duration-150 motion-reduce:animate-none"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        aria-describedby="auth-reason"
        className="relative w-full sm:max-w-md max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-surface text-on-surface border border-outline-variant p-6 sm:p-8 flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-150 motion-reduce:animate-none pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          aria-label="Fechar"
          className="absolute top-3 right-3 w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[22px]">close</span>
        </button>

        <div className="flex flex-col gap-1 pr-8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-olive flex items-center justify-center text-on-primary">
              <span className="material-symbols-outlined text-[20px]">grain</span>
            </div>
            <span className="text-lg font-bold tracking-tight">Espectro</span>
          </div>
          <h2 id="auth-title" className="text-xl font-bold pt-2">
            {mode === 'login' ? 'Entrar' : mode === 'register' ? 'Criar conta' : mode === 'forgot' ? 'Recuperar senha' : 'Verificação em duas etapas'}
          </h2>
          <p id="auth-reason" className="text-sm text-on-surface-variant leading-relaxed">
            {reason}
          </p>
        </div>

        {mode !== 'forgot' && mode !== 'mfa' && (
        <div role="tablist" aria-label="Entrar ou criar conta" className="grid grid-cols-2 border-b border-outline-variant">
          {(
            [
              { id: 'login', label: 'Entrar' },
              { id: 'register', label: 'Criar conta' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={mode === t.id}
              onClick={() => switchMode(t.id)}
              className={`h-11 text-sm font-semibold border-b-2 -mb-px cursor-pointer transition-colors ${
                mode === t.id ? 'border-on-surface text-on-surface' : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        )}

        {error && (
          <div role="alert" className="p-3 rounded-2xl bg-error-container text-error text-sm flex items-start gap-2">
            <span className="material-symbols-outlined text-[18px] mt-0.5">error</span>
            <span>{error}</span>
          </div>
        )}

        {mode === 'mfa' ? (
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="auth-mfa" className="text-sm font-semibold">{useRecovery ? 'Código de recuperação' : 'Código do aplicativo'}</label>
              <input
                id="auth-mfa"
                type="text"
                inputMode={useRecovery ? 'text' : 'numeric'}
                autoComplete="one-time-code"
                autoCapitalize="characters"
                autoCorrect="off"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                maxLength={useRecovery ? 14 : 7}
                required
                className="w-full px-4 py-3 text-base tracking-widest bg-transparent border border-outline-variant rounded-2xl text-on-surface focus:outline-none focus:border-on-surface transition-colors"
              />
            </div>
            <button type="submit" disabled={loading || !mfaCode.trim()} className="w-full h-12 rounded-full bg-primary-container text-on-primary font-semibold text-sm hover:bg-primary transition-colors disabled:opacity-60 cursor-pointer">
              {loading ? 'Verificando...' : 'Verificar e entrar'}
            </button>
            <button type="button" onClick={() => { setUseRecovery((v) => !v); setMfaCode(''); setError(null); }} className="text-sm text-on-surface-variant hover:text-on-surface hover:underline cursor-pointer self-start">
              {useRecovery ? 'Usar o código do aplicativo' : 'Usar um código de recuperação'}
            </button>
            <button type="button" onClick={() => switchMode('login')} className="text-sm text-on-surface-variant hover:text-on-surface cursor-pointer self-start">
              Voltar
            </button>
          </form>
        ) : mode === 'forgot' ? (
          forgotSent ? (
            <div className="flex flex-col gap-4">
              <p role="status" className="text-sm leading-relaxed">Se existir uma conta com esse e-mail, enviamos o link. Ele vale por 30 minutos. Confira também a caixa de spam.</p>
              <button type="button" onClick={() => switchMode('login')} className="w-full h-12 rounded-full border border-outline-variant text-sm font-semibold cursor-pointer hover:bg-surface-container">Voltar para entrar</button>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="auth-forgot-email" className="text-sm font-semibold">E-mail</label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3.5 text-on-surface-variant text-[18px]">mail</span>
                  <input id="auth-forgot-email" type="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} required className={fieldClass} />
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full h-12 rounded-full bg-primary-container text-on-primary font-semibold text-sm hover:bg-primary transition-colors disabled:opacity-60 cursor-pointer">{loading ? 'Enviando...' : 'Enviar link'}</button>
              <button type="button" onClick={() => switchMode('login')} className="text-sm text-on-surface-variant hover:text-on-surface cursor-pointer">Voltar</button>
            </form>
          )
        ) : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {mode === 'login' ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="auth-identifier" className="text-sm font-semibold">E-mail ou usuário</label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3.5 text-on-surface-variant text-[18px]">mail</span>
                <input
                  id="auth-identifier"
                  type="text"
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  className={fieldClass}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="auth-username" className="text-sm font-semibold">Nome de usuário</label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3.5 text-on-surface-variant text-[18px]">alternate_email</span>
                  <input id="auth-username" type="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" value={username} onChange={(e) => setUsername(e.target.value)} required maxLength={30} className={fieldClass} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="auth-email" className="text-sm font-semibold">E-mail</label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3.5 text-on-surface-variant text-[18px]">mail</span>
                  <input id="auth-email" type="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} required className={fieldClass} />
                </div>
              </div>
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="auth-password" className="text-sm font-semibold">Senha</label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3.5 text-on-surface-variant text-[18px]">lock</span>
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                maxLength={128}
                className={`${fieldClass} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                aria-pressed={showPassword}
                className="absolute right-1 w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
            {mode === 'register' && <p className="text-xs text-on-surface-variant">Mínimo de 8 caracteres.</p>}
            {mode === 'login' && canRecover && (
              <button type="button" onClick={() => switchMode('forgot')} className="self-start text-sm text-on-surface-variant hover:text-on-surface hover:underline cursor-pointer">
                Esqueci minha senha
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-full bg-primary-container text-on-primary font-semibold text-sm hover:bg-primary transition-colors disabled:opacity-60 cursor-pointer"
          >
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>
        )}

        {mode !== 'forgot' && mode !== 'mfa' && (
        <p className="text-center text-sm text-on-surface-variant">
          {mode === 'login' ? 'Ainda não tem conta? ' : 'Já tem conta? '}
          <button type="button" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')} className="font-semibold text-on-surface hover:underline cursor-pointer">
            {mode === 'login' ? 'Criar conta' : 'Entrar'}
          </button>
        </p>
        )}
      </div>
    </div>,
    document.body
  );
};
