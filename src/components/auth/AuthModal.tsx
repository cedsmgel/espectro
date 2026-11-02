import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { authApi, authFlowApi, googleApi } from '../../lib/api';
import { currentPath } from '../../lib/authEvents';
import { TurnstileWidget } from './TurnstileWidget';
import { AuthRequest } from '../../lib/authEvents';

interface AuthModalProps {
  request: AuthRequest;
  onClose: () => void;
  onSuccess: () => void;
}

type Mode = 'login' | 'register' | 'forgot' | 'mfa' | 'link';

const fieldClass =
  'w-full pl-10 pr-4 py-3 text-base bg-transparent border border-outline-variant rounded-2xl text-on-surface focus:outline-none focus:border-on-surface transition-colors';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

// Login e cadastro em um modal único. Usa as mesmas chamadas e validações do restante do app (authApi).
export const AuthModal: React.FC<AuthModalProps> = ({ request, onClose, onSuccess }) => {
  const [mode, setMode] = useState<Mode>(request.mfaToken ? 'mfa' : request.googleLinkToken ? 'link' : request.mode === 'register' ? 'register' : 'login');
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState(request.googleEmail || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canRecover, setCanRecover] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(request.mfaToken ?? null);
  const [googleReady, setGoogleReady] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  // Turnstile: chave do site (null = desligado), token atual (uso único) e contador para reiniciar o desafio
  const [tsSite, setTsSite] = useState<string | null>(null);
  const [tsToken, setTsToken] = useState<string | null>(null);
  const [tsReset, setTsReset] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  loadingRef.current = loading;

  useEffect(() => {
    void authFlowApi.emailEnabled().then(setCanRecover);
    void authFlowApi.googleEnabled().then(setGoogleReady);
    void authFlowApi.turnstileSiteKey().then(setTsSite);
  }, []);

  const continueWithGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      // Guarda para onde voltar; o navegador sai para o Google e volta em /entrar/google
      try {
        sessionStorage.setItem('espectro_google_next', request.redirectTo || currentPath());
      } catch {}
      window.location.href = await googleApi.start('login');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível abrir o Google agora.');
      setLoading(false);
    }
  };

  // O pedido pode mudar o modo com o modal aberto (ex.: "Criar conta" clicado de novo)
  useEffect(() => {
    // Pedidos que já abrem num passo específico (código do 2FA, confirmar senha para ligar o Google) não voltam ao login
    if (request.mode && !request.mfaToken && !request.googleLinkToken) setMode(request.mode);
  }, [request.mode, request.mfaToken, request.googleLinkToken]);

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
    setTsToken(null);
    setMode(next);
    setError(null);
    setForgotSent(false);
  };

  // Cada envio gasta o token do Turnstile (uso único): depois de qualquer tentativa o desafio recomeça
  const submit = async (e: React.FormEvent) => {
    try {
      await submitInner(e);
    } finally {
      setTsToken(null);
      setTsReset((n) => n + 1);
    }
  };

  const submitInner = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'link') {
      setLoading(true);
      try {
        const res = await authApi.login({ username: (request.googleEmail || email).trim(), password, turnstile_token: tsToken ?? undefined });
        if ('mfa_required' in res) {
          setMfaToken(res.mfa_token);
          setMfaCode('');
          setUseRecovery(false);
          setPassword('');
          setMode('mfa');
          setLoading(false);
          return;
        }
        // A ligação do Google é concluída por onSuccess (AuthContext), já com a conta autenticada
        onSuccess();
      } catch (err: any) {
        setError(err?.message || 'Não foi possível confirmar.');
        setLoading(false);
      }
      return;
    }

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
        await authFlowApi.forgotPassword(email.trim(), tsToken ?? undefined);
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
        const res = await authApi.login({ username: identifier.trim(), password, turnstile_token: tsToken ?? undefined });
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
        const created = await authApi.register({ username: username.trim(), email: email.trim(), password, turnstile_token: tsToken ?? undefined });
        // A prova do cadastro evita um segundo desafio no login imediato
        await authApi.login({ username: username.trim(), password, login_proof: created.login_proof });
      }
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível concluir. Tente novamente.');
      setLoading(false);
    }
  };

  const tsNeeded = Boolean(tsSite) && (mode === 'login' || mode === 'register' || mode === 'forgot' || mode === 'link');
  const tsAction = mode === 'register' ? 'signup' : mode === 'forgot' ? 'forgot_password' : 'login';
  const tsBlock = tsNeeded && tsSite ? <TurnstileWidget key={mode} siteKey={tsSite} action={tsAction} onToken={setTsToken} resetKey={tsReset} /> : null;
  const tsWaiting = tsNeeded && !tsToken;

  const reason =
    mode === 'link'
      ? `O Google identificou ${request.googleEmail || 'seu e-mail'}, que já tem conta no Espectro. Digite a senha dessa conta para ligar o Google a ela.`
      : mode === 'mfa'
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
            {mode === 'login' ? 'Entrar' : mode === 'register' ? 'Criar conta' : mode === 'forgot' ? 'Recuperar senha' : mode === 'link' ? 'Confirme sua senha' : 'Verificação em duas etapas'}
          </h2>
          <p id="auth-reason" className="text-sm text-on-surface-variant leading-relaxed">
            {reason}
          </p>
        </div>

        {mode !== 'forgot' && mode !== 'mfa' && mode !== 'link' && (
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

        {mode === 'link' ? (
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="auth-link-email" className="text-sm font-semibold">Conta</label>
              <input id="auth-link-email" type="text" value={request.googleEmail || email} readOnly className="w-full px-4 py-3 text-base bg-transparent border border-outline-variant rounded-2xl text-on-surface-variant" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="auth-link-password" className="text-sm font-semibold">Senha</label>
              <div className="relative flex items-center">
                <input
                  id="auth-link-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  maxLength={128}
                  autoFocus
                  className="w-full pl-4 pr-12 py-3 text-base bg-transparent border border-outline-variant rounded-2xl text-on-surface focus:outline-none focus:border-on-surface transition-colors"
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword} className="absolute right-1 w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer">
                  <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
              {canRecover ? (
                <button type="button" onClick={() => switchMode('forgot')} className="self-start text-sm text-on-surface-variant hover:text-on-surface hover:underline cursor-pointer">
                  Esqueci minha senha
                </button>
              ) : (
                <p className="text-xs text-on-surface-variant">Não lembra a senha? A recuperação por e-mail ainda não está disponível.</p>
              )}
            </div>
            {tsBlock}
            <button type="submit" disabled={loading || !password || tsWaiting} className="w-full h-12 rounded-full bg-primary-container text-on-primary font-semibold text-sm hover:bg-primary transition-colors disabled:opacity-60 cursor-pointer">
              {loading ? 'Confirmando...' : 'Confirmar e ligar o Google'}
            </button>
            <button type="button" onClick={onClose} className="text-sm text-on-surface-variant hover:text-on-surface cursor-pointer self-start">
              Cancelar
            </button>
          </form>
        ) : mode === 'mfa' ? (
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
              {tsBlock}
              <button type="submit" disabled={loading || tsWaiting} className="w-full h-12 rounded-full bg-primary-container text-on-primary font-semibold text-sm hover:bg-primary transition-colors disabled:opacity-60 cursor-pointer">{loading ? 'Enviando...' : 'Enviar link'}</button>
              <button type="button" onClick={() => switchMode('login')} className="text-sm text-on-surface-variant hover:text-on-surface cursor-pointer">Voltar</button>
            </form>
          )
        ) : (
        <>
        {googleReady && (
          <>
            <button
              type="button"
              onClick={() => void continueWithGoogle()}
              disabled={loading}
              className="w-full h-12 rounded-full border border-outline-variant flex items-center justify-center gap-3 text-sm font-semibold hover:bg-surface-container transition-colors disabled:opacity-60 cursor-pointer"
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
                <path fill="#FBBC05" d="M10.5 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.7l7.9-6.1z" />
                <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
              </svg>
              Continuar com o Google
            </button>
            <div className="flex items-center gap-3 text-xs text-on-surface-variant" aria-hidden="true">
              <span className="flex-1 h-px bg-outline-variant" />
              ou
              <span className="flex-1 h-px bg-outline-variant" />
            </div>
          </>
        )}
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

          {tsBlock}
          <button
            type="submit"
            disabled={loading || tsWaiting}
            className="w-full h-12 rounded-full bg-primary-container text-on-primary font-semibold text-sm hover:bg-primary transition-colors disabled:opacity-60 cursor-pointer"
          >
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
          {mode === 'register' && (
            <p className="text-xs text-on-surface-variant text-center">
              Ao criar a conta, você concorda com os{' '}
              <a href="/termos" target="_blank" rel="noopener noreferrer" className="underline hover:text-on-surface">Termos de uso</a> e a{' '}
              <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="underline hover:text-on-surface">Política de Privacidade</a>.
            </p>
          )}
        </form>
        </>
        )}

        {mode !== 'forgot' && mode !== 'mfa' && mode !== 'link' && (
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
