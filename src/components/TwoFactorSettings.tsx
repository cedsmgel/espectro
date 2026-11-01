import React, { useEffect, useState } from 'react';
import { MfaStatus, mfaApi } from '../lib/api';

type Step = 'idle' | 'password' | 'scan' | 'codes' | 'disable' | 'regenerate';

const field = 'block w-full min-w-0 appearance-none px-0 py-2.5 bg-transparent border-0 border-b border-outline-variant outline-none text-base text-on-surface focus:border-on-surface';
const primary = 'h-11 px-6 rounded-full bg-primary-container text-on-primary text-sm font-semibold cursor-pointer disabled:opacity-50';
const outline = 'h-11 px-6 rounded-full border border-outline-variant text-on-surface text-sm font-semibold cursor-pointer hover:bg-surface-container disabled:opacity-50';
const danger = 'h-11 px-6 rounded-full border border-error text-error text-sm font-semibold cursor-pointer hover:bg-error/10 disabled:opacity-50';

// Verificação em duas etapas: app autenticador (TOTP) + códigos de recuperação
export const TwoFactorSettings: React.FC = () => {
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [secret, setSecret] = useState('');
  const [uri, setUri] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = () => {
    mfaApi.status().then(setStatus).catch(() => setStatus(null));
  };
  useEffect(load, []);

  // O QR é montado aqui no navegador: o segredo nunca passa por serviço externo
  useEffect(() => {
    if (!uri) return setQr(null);
    let active = true;
    import('qrcode')
      .then((lib) => lib.toDataURL(uri, { margin: 1, width: 220, errorCorrectionLevel: 'M' }))
      .then((url) => active && setQr(url))
      .catch(() => active && setQr(null));
    return () => {
      active = false;
    };
  }, [uri]);

  if (!status || !status.available) return null;

  const reset = () => {
    setStep('idle');
    setPassword('');
    setCode('');
    setUseRecovery(false);
    setSecret('');
    setUri('');
    setError(null);
  };

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível concluir.');
    } finally {
      setBusy(false);
    }
  };

  const start = () =>
    run(async () => {
      const res = await mfaApi.setup(password);
      setSecret(res.secret);
      setUri(res.otpauth_uri);
      setPassword('');
      setCode('');
      setStep('scan');
    });

  const confirm = () =>
    run(async () => {
      setCodes(await mfaApi.enable(code.replace(/\s+/g, '')));
      setCode('');
      setSecret('');
      setUri('');
      setStep('codes');
      load();
    });

  const disable = () =>
    run(async () => {
      await mfaApi.disable(password, useRecovery ? { recovery_code: code.trim() } : { code: code.replace(/\s+/g, '') });
      reset();
      setNotice('Verificação em duas etapas desativada.');
      load();
    });

  const regenerate = () =>
    run(async () => {
      setCodes(await mfaApi.regenerateCodes(password, code.replace(/\s+/g, '')));
      setPassword('');
      setCode('');
      setStep('codes');
      load();
    });

  const downloadCodes = () => {
    const blob = new Blob([`Códigos de recuperação do Espectro\nCada código vale uma vez.\n\n${codes.join('\n')}\n`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'espectro-codigos-de-recuperacao.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="flex flex-col gap-4 py-6 border-b border-outline-variant" aria-label="Verificação em duas etapas">
      <div>
        <h2 className="text-base font-bold text-on-surface">Verificação em duas etapas</h2>
        <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">
          Além da senha, o login pede um código de 6 dígitos gerado por um aplicativo autenticador (Google Authenticator, Authy, 1Password...). Mesmo que descubram sua senha, não conseguem entrar.
        </p>
      </div>

      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      {notice && step === 'idle' && <p role="status" className="text-sm text-on-surface-variant">{notice}</p>}

      {step === 'idle' && !status.enabled && (
        <div>
          <button type="button" className={primary} onClick={() => { setNotice(null); setStep('password'); }}>Ativar verificação em duas etapas</button>
        </div>
      )}

      {step === 'idle' && status.enabled && (
        <>
          <p className="text-sm text-on-surface">
            <span className="font-semibold">Ativada.</span>{' '}
            <span className="text-on-surface-variant">
              {status.recovery_codes_left} {status.recovery_codes_left === 1 ? 'código de recuperação restante' : 'códigos de recuperação restantes'}
            </span>
          </p>
          {status.recovery_codes_left <= 2 && <p className="text-sm text-error">Restam poucos códigos. Gere um novo conjunto.</p>}
          <div className="flex gap-3 flex-wrap">
            <button type="button" className={outline} onClick={() => { setNotice(null); setStep('regenerate'); }}>Gerar novos códigos</button>
            <button type="button" className={danger} onClick={() => { setNotice(null); setStep('disable'); }}>Desativar</button>
          </div>
        </>
      )}

      {step === 'password' && (
        <form onSubmit={(e) => { e.preventDefault(); void start(); }} className="flex flex-col gap-3">
          <label htmlFor="mfa-pw" className="text-sm text-on-surface-variant">Confirme sua senha para começar</label>
          <input id="mfa-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} required />
          <div className="flex gap-3">
            <button type="submit" disabled={busy || !password} className={primary}>{busy ? 'Aguarde...' : 'Continuar'}</button>
            <button type="button" onClick={reset} className={outline}>Cancelar</button>
          </div>
        </form>
      )}

      {step === 'scan' && (
        <form onSubmit={(e) => { e.preventDefault(); void confirm(); }} className="flex flex-col gap-4">
          <ol className="text-sm text-on-surface-variant leading-relaxed list-decimal pl-5 flex flex-col gap-1">
            <li>Abra seu aplicativo autenticador e adicione uma conta.</li>
            <li>Escaneie o QR code ou digite a chave abaixo.</li>
            <li>Digite o código de 6 dígitos que o aplicativo mostrar.</li>
          </ol>
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {qr ? <img src={qr} alt="QR code para o aplicativo autenticador" width={220} height={220} className="bg-white p-2 rounded-xl" /> : <div className="w-[220px] h-[220px] border border-outline-variant rounded-xl" />}
            <div className="min-w-0 flex flex-col gap-2">
              <p className="text-xs text-on-surface-variant">Chave (se não puder escanear)</p>
              <code className="text-sm break-all select-all tracking-wider">{secret.match(/.{1,4}/g)?.join(' ')}</code>
              <a href={uri} className="text-sm text-primary hover:underline">Abrir no aplicativo do celular</a>
            </div>
          </div>
          <label htmlFor="mfa-code" className="text-sm text-on-surface-variant">Código de 6 dígitos</label>
          <input id="mfa-code" type="text" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={7} className={`${field} tracking-widest`} required />
          <div className="flex gap-3">
            <button type="submit" disabled={busy || code.replace(/\s+/g, '').length !== 6} className={primary}>{busy ? 'Verificando...' : 'Confirmar e ativar'}</button>
            <button type="button" onClick={reset} className={outline}>Cancelar</button>
          </div>
        </form>
      )}

      {step === 'codes' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-on-surface leading-relaxed">
            <span className="font-semibold">Guarde estes códigos agora.</span> Eles não serão mostrados de novo. Cada um vale uma vez e entra no lugar do aplicativo se você perder o celular.
          </p>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-sm tracking-wider border-y border-outline-variant py-4">
            {codes.map((c) => (
              <li key={c} className="select-all">{c}</li>
            ))}
          </ul>
          <div className="flex gap-3 flex-wrap">
            <button type="button" className={outline} onClick={() => void navigator.clipboard?.writeText(codes.join('\n')).catch(() => {})}>Copiar</button>
            <button type="button" className={outline} onClick={downloadCodes}>Baixar .txt</button>
            <button type="button" className={primary} onClick={() => { setCodes([]); reset(); setNotice('Verificação em duas etapas ativada.'); }}>Já guardei, concluir</button>
          </div>
        </div>
      )}

      {(step === 'disable' || step === 'regenerate') && (
        <form onSubmit={(e) => { e.preventDefault(); void (step === 'disable' ? disable() : regenerate()); }} className="flex flex-col gap-3">
          <p className="text-sm text-on-surface-variant">
            {step === 'disable' ? 'Para desativar, confirme a senha e um código.' : 'Os códigos antigos deixam de valer. Confirme a senha e o código do aplicativo.'}
          </p>
          <label htmlFor="mfa-pw2" className="text-sm text-on-surface-variant">Senha</label>
          <input id="mfa-pw2" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} required />
          <label htmlFor="mfa-code2" className="text-sm text-on-surface-variant">{useRecovery ? 'Código de recuperação' : 'Código do aplicativo'}</label>
          <input id="mfa-code2" type="text" inputMode={useRecovery ? 'text' : 'numeric'} autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={useRecovery ? 14 : 7} className={`${field} tracking-widest`} required />
          {step === 'disable' && (
            <button type="button" onClick={() => { setUseRecovery((v) => !v); setCode(''); }} className="text-sm text-on-surface-variant hover:text-on-surface hover:underline cursor-pointer self-start">
              {useRecovery ? 'Usar o código do aplicativo' : 'Usar um código de recuperação'}
            </button>
          )}
          <div className="flex gap-3">
            <button type="submit" disabled={busy || !password || !code.trim()} className={step === 'disable' ? danger : primary}>
              {busy ? 'Aguarde...' : step === 'disable' ? 'Desativar' : 'Gerar novos códigos'}
            </button>
            <button type="button" onClick={reset} className={outline}>Cancelar</button>
          </div>
        </form>
      )}
    </section>
  );
};
