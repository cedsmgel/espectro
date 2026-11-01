import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { TwoFactorSettings } from './TwoFactorSettings';
import { useStepUp } from './StepUpDialog';
import { AccountSession, accountSecurityApi, authFlowApi, authStorage, profileApi, ThisDevice } from '../lib/api';

const fieldClass = 'block w-full min-w-0 appearance-none px-0 py-2.5 bg-transparent border-0 border-b border-outline-variant outline-none text-sm text-on-surface focus:border-on-surface';
const buttonClass = 'h-11 px-6 rounded-full bg-primary-container text-on-primary text-sm font-semibold cursor-pointer disabled:opacity-50';
const outlineClass = 'h-11 px-6 rounded-full border border-outline-variant text-on-surface text-sm font-semibold cursor-pointer hover:bg-surface-container disabled:opacity-50';

type Notice = { kind: 'ok' | 'error'; text: string } | null;

const countryName = (code: string | null) => {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(['pt-BR'], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
};

const sessionPlace = (s: Pick<AccountSession, 'city' | 'region' | 'country'>) =>
  [s.city, s.region, countryName(s.country)].filter(Boolean).join(', ') || 'Local desconhecido';

const deviceIcon = (d: string | null) => (d === 'mobile' ? 'smartphone' : d === 'tablet' ? 'tablet' : 'computer');

const timeAgo = (iso: string) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 2) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  if (minutes < 1440) return `há ${Math.floor(minutes / 60)} h`;
  return `há ${Math.floor(minutes / 1440)} d`;
};

const NoticeLine: React.FC<{ notice: Notice }> = ({ notice }) =>
  notice ? (
    <p role="status" className={`text-xs ${notice.kind === 'ok' ? 'text-on-surface-variant' : 'text-error'}`}>
      {notice.text}
    </p>
  ) : null;

const Block: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({ title, description, children }) => (
  <section className="flex flex-col gap-4 py-6 border-b border-outline-variant">
    <div>
      <h2 className="text-base font-bold text-on-surface">{title}</h2>
      {description && <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">{description}</p>}
    </div>
    {children}
  </section>
);

// Central de segurança: senha, sessões, cópia dos meus dados (LGPD art. 18) e exclusão da conta
export const SecurityCenter: React.FC = () => {
  const user = authStorage.getUser();
  const { run: stepUp, dialog: stepUpDialog } = useStepUp();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordNotice, setPasswordNotice] = useState<Notice>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [sessionNotice, setSessionNotice] = useState<Notice>(null);
  const [sessions, setSessions] = useState<AccountSession[] | null>(null);
  const [thisDevice, setThisDevice] = useState<ThisDevice | null>(null);
  const [emailState, setEmailState] = useState<{ email: string; verified: boolean; canSend: boolean } | null>(null);
  const [emailNotice, setEmailNotice] = useState<Notice>(null);
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<Notice>(null);

  const loadSessions = () => {
    accountSecurityApi
      .listSessions()
      .then((res) => {
        setSessions(res.sessions);
        setThisDevice(res.thisDevice);
      })
      .catch(() => setSessions([]));
  };
  useEffect(() => {
    if (!user) return;
    Promise.all([profileApi.get(), authFlowApi.emailEnabled()])
      .then(([profile, canSend]) => setEmailState({ email: profile.email || '', verified: Boolean(profile.email_verified), canSend }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user) loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return <Navigate to="/login" replace />;

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordNotice(null);
    if (next.length < 8) return setPasswordNotice({ kind: 'error', text: 'A nova senha deve ter pelo menos 8 caracteres.' });
    if (next !== confirm) return setPasswordNotice({ kind: 'error', text: 'A confirmação não confere com a nova senha.' });
    setSavingPassword(true);
    try {
      await stepUp(() => accountSecurityApi.changePassword(current, next));
      setCurrent('');
      setNext('');
      setConfirm('');
      setPasswordNotice({ kind: 'ok', text: 'Senha alterada. Os outros dispositivos foram desconectados.' });
    } catch (err: any) {
      setPasswordNotice({ kind: 'error', text: err?.message || 'Não foi possível alterar a senha.' });
    } finally {
      setSavingPassword(false);
    }
  };

  const signOutEverywhere = async () => {
    setSessionNotice(null);
    try {
      await stepUp(() => accountSecurityApi.signOutEverywhere());
      try {
        sessionStorage.setItem('espectro_login_notice', 'Você saiu de todos os dispositivos. Entre novamente para continuar.');
      } catch {}
      window.location.href = '/login';
    } catch (err: any) {
      setSessionNotice({ kind: 'error', text: err?.message || 'Não foi possível encerrar as sessões.' });
    }
  };

  const download = async () => {
    setExportNotice(null);
    setExporting(true);
    try {
      await stepUp(() => accountSecurityApi.downloadMyData());
      setExportNotice({ kind: 'ok', text: 'Download iniciado. O arquivo contém suas mensagens e e-mail: guarde em local seguro.' });
    } catch (err: any) {
      setExportNotice({ kind: 'error', text: err?.message || 'Não foi possível gerar o arquivo.' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col">
      {emailState && (
        <Block
          title="E-mail da conta"
          description="O e-mail confirmado é o que permite recuperar a senha se você a esquecer."
        >
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm text-on-surface break-all">{emailState.email}</p>
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${emailState.verified ? 'text-on-surface-variant' : 'text-error'}`}>
              {emailState.verified ? 'Confirmado' : 'Não confirmado'}
            </span>
          </div>
          {!emailState.verified && emailState.canSend && (
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                className={outlineClass}
                onClick={() => {
                  setEmailNotice(null);
                  authFlowApi
                    .resendVerification()
                    .then((r) => setEmailNotice({ kind: 'ok', text: r.already_verified ? 'Seu e-mail já está confirmado.' : 'Enviamos o link. Confira a caixa de entrada e o spam.' }))
                    .catch((err: any) => setEmailNotice({ kind: 'error', text: err?.message || 'Não foi possível enviar agora.' }));
                }}
              >
                Reenviar e-mail de confirmação
              </button>
              <NoticeLine notice={emailNotice} />
            </div>
          )}
        </Block>
      )}

  <TwoFactorSettings />

  <Block title="Alterar senha" description="Ao trocar a senha, os outros dispositivos conectados são desconectados.">
    <form onSubmit={changePassword} className="flex flex-col gap-1">
      <label className="text-sm text-on-surface-variant" htmlFor="pw-current">Senha atual</label>
      <input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={fieldClass} required />
      <label className="text-sm text-on-surface-variant mt-3" htmlFor="pw-next">Nova senha (mínimo de 8 caracteres)</label>
      <input id="pw-next" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={fieldClass} required minLength={8} maxLength={128} />
      <label className="text-sm text-on-surface-variant mt-3" htmlFor="pw-confirm">Repita a nova senha</label>
      <input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={fieldClass} required />
      <div className="flex items-center gap-3 justify-between mt-4">
        <NoticeLine notice={passwordNotice} />
        <button type="submit" disabled={savingPassword} className={`${buttonClass} ml-auto`}>
          {savingPassword ? 'Salvando...' : 'Alterar senha'}
        </button>
      </div>
    </form>
  </Block>

  <Block title="Sessões" description="Aparelhos conectados à sua conta e a área aproximada de onde foram usados. Se algum não for seu, encerre e troque a senha. O IP aparece parcialmente oculto.">
    {thisDevice && (
      <div className="flex items-start gap-3 py-3 border-y border-outline-variant">
        <span className="material-symbols-outlined text-[26px] text-on-surface shrink-0">{deviceIcon(thisDevice.device)}</span>
        <div className="min-w-0 flex-1 text-sm break-words">
          <p className="font-semibold text-on-surface">
            Este aparelho
            <span className="ml-2 text-[11px] font-medium text-on-surface-variant">ativo agora</span>
          </p>
          <p className="text-on-surface-variant text-xs mt-0.5">
            {thisDevice.browser} em {thisDevice.os}
          </p>
          <p className="text-on-surface-variant text-xs">
            Área: {sessionPlace(thisDevice)}
            {thisDevice.timezone ? ` (${thisDevice.timezone})` : ''}
          </p>
          {thisDevice.ip && <p className="text-on-surface-variant text-xs">IP: {thisDevice.ip}</p>}
        </div>
      </div>
    )}

    {sessions && sessions.some((s) => !s.current) && (
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant pb-1">Outros aparelhos</h3>
        <ul>
          {sessions
            .filter((s) => !s.current)
            .map((s) => (
              <li key={s.id} className="flex items-start gap-3 py-3 border-b border-outline-variant">
                <span className="material-symbols-outlined text-[24px] text-on-surface-variant shrink-0">{deviceIcon(s.device)}</span>
                <div className="min-w-0 flex-1 text-xs text-on-surface-variant break-words">
                  <p className="text-sm font-semibold text-on-surface">
                    {s.browser} em {s.os}
                  </p>
                  <p>Área: {sessionPlace(s)}</p>
                  <p>
                    {s.ip ? `IP: ${s.ip} · ` : ''}
                    último uso {timeAgo(s.last_seen_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void accountSecurityApi.revokeSession(s.id).then(loadSessions).catch(() => {});
                  }}
                  className="h-9 px-3 rounded-full border border-outline-variant text-xs font-semibold cursor-pointer hover:bg-surface-container shrink-0"
                >
                  Encerrar
                </button>
              </li>
            ))}
        </ul>
      </div>
    )}

    <div className="flex items-center gap-3 flex-wrap">
      {confirmingSignOut ? (
        <>
          <p className="w-full text-xs text-on-surface-variant">Isso encerra todos os aparelhos, inclusive este. Você precisará entrar de novo.</p>
          <button type="button" onClick={() => void signOutEverywhere()} className={buttonClass}>Sair de tudo</button>
          <button type="button" onClick={() => setConfirmingSignOut(false)} className={outlineClass}>Cancelar</button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirmingSignOut(true)} className={outlineClass}>Sair de todos os dispositivos</button>
      )}
      <NoticeLine notice={sessionNotice} />
    </div>
  </Block>

  <Block
    title="Seus dados"
    description="Você tem direito de saber quais dados temos sobre você e de receber uma cópia (LGPD, art. 18). O arquivo traz perfil, publicações, comentários, votos, salvos, amigos, mensagens, Momentum e bloqueios."
  >
    <div className="flex items-center gap-3 flex-wrap">
      <button type="button" onClick={() => void download()} disabled={exporting} className={outlineClass}>
        {exporting ? 'Preparando...' : 'Baixar meus dados'}
      </button>
      <NoticeLine notice={exportNotice} />
    </div>
  </Block>

  <Block
    title="Excluir conta"
    description="Seu perfil e suas publicações saem do ar na hora. Você tem 30 dias para desistir: basta entrar de novo. Depois, tudo é apagado de forma definitiva."
  >
    <div>
      <Link to="/configuracoes/excluir-conta" className="inline-flex items-center h-10 px-5 rounded-full border border-error text-error text-xs font-semibold hover:bg-error/10 transition-colors">
        Excluir minha conta
      </Link>
    </div>
  </Block>
      {stepUpDialog}
    </div>
  );
};
