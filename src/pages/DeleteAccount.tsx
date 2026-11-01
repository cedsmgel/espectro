import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { accountSecurityApi, authStorage, DELETION_REASON_OPTIONS } from '../lib/api';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';

type Step = 'motivo' | 'confirmar' | 'pronto';

const alternatives: Record<string, { text: string; to: string; cta: string }> = {
  privacidade: { text: 'Você pode tornar seu perfil privado e escolher quem vê cada informação.', to: '/settings/account', cta: 'Ajustar privacidade' },
  assedio: { text: 'Você pode bloquear ou denunciar quem incomoda. Isso encerra o contato na hora.', to: '/amigos', cta: 'Ver meus amigos' },
  muito_tempo: { text: 'Você pode silenciar notificações e conversas em vez de sair.', to: '/notificacoes', cta: 'Ver notificações' },
};

// Exclusão de conta em dois passos: questionário de saída (anônimo) e confirmação com senha
export const DeleteAccount: React.FC = () => {
  const user = authStorage.getUser();
  const [step, setStep] = useState<Step>('motivo');
  const [reasons, setReasons] = useState<string[]>([]);
  const [details, setDetails] = useState('');
  const [wouldReturn, setWouldReturn] = useState<string>('');
  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user && step !== 'pronto') return <Navigate to="/login" replace />;

  const toggle = (id: string) => setReasons((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  const suggested = reasons.map((r) => alternatives[r]).filter(Boolean);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await accountSecurityApi.requestDeletion({ password, reasons, details: details.trim() || undefined, would_return: wouldReturn || undefined });
      authStorage.clear();
      setStep('pronto');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível excluir a conta.');
    } finally {
      setBusy(false);
    }
  };

  const optionClass = (selected: boolean) =>
    `flex items-center gap-3 py-3 border-b border-outline-variant cursor-pointer text-sm ${selected ? 'text-on-surface font-semibold' : 'text-on-surface-variant'}`;

  if (step === 'pronto') {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center flex flex-col gap-4">
          <span className="material-symbols-outlined text-[40px] mx-auto">check_circle</span>
          <h1 className="text-xl font-bold">Sua conta foi desativada</h1>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Seu perfil e suas publicações já saíram do ar. Em 30 dias, tudo será apagado de forma definitiva. Se mudar de ideia, é só entrar de novo antes disso e a exclusão é cancelada.
          </p>
          <p className="text-sm text-on-surface-variant">Obrigado pelo retorno: ele nos ajuda a melhorar.</p>
          <Link to="/login" className="mx-auto inline-flex items-center h-10 px-6 rounded-full border border-outline-variant text-xs font-semibold hover:bg-surface-container">
            Ir para o login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <Header />
      <SidebarNav />
      <div className="pt-16 md:pt-0 md:pl-20">
        <main className="w-full max-w-xl mx-auto px-4 pt-4 pb-24 md:pb-8">
          <div className="flex items-center gap-2 pb-2">
            <Link to="/configuracoes/dados" aria-label="Voltar" className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors">
              <span className="material-symbols-outlined text-[24px]">arrow_back</span>
            </Link>
            <h1 className="text-2xl font-bold">Excluir conta</h1>
          </div>

          {step === 'motivo' && (
            <section className="flex flex-col gap-4">
              <div>
                <h2 className="text-base font-bold">Por que você está saindo?</h2>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                  Escolha um ou mais motivos. As respostas são anônimas: não ficam ligadas à sua conta.
                </p>
              </div>

              <div role="group" aria-label="Motivos">
                {DELETION_REASON_OPTIONS.map((o) => (
                  <label key={o.id} className={optionClass(reasons.includes(o.id))}>
                    <input type="checkbox" checked={reasons.includes(o.id)} onChange={() => toggle(o.id)} className="w-4 h-4 accent-current" />
                    {o.label}
                  </label>
                ))}
              </div>

              {suggested.length > 0 && (
                <ul className="flex flex-col gap-2 border border-outline-variant p-4 text-xs text-on-surface-variant">
                  <li className="font-semibold text-on-surface">Antes de sair, talvez ajude:</li>
                  {suggested.map((a) => (
                    <li key={a.to} className="flex items-center justify-between gap-3">
                      <span>{a.text}</span>
                      <Link to={a.to} className="shrink-0 font-semibold text-primary hover:underline">{a.cta}</Link>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-col gap-1">
                <label htmlFor="del-details" className="text-xs text-on-surface-variant">O que poderíamos ter feito diferente? (opcional)</label>
                <textarea id="del-details" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} rows={3} className="block w-full appearance-none px-0 py-2 bg-transparent border-0 border-b border-outline-variant outline-none text-sm text-on-surface resize-none focus:border-on-surface" />
              </div>

              <fieldset className="flex flex-col">
                <legend className="text-xs text-on-surface-variant pb-1">Você voltaria ao Espectro?</legend>
                <div className="flex gap-2">
                  {[
                    { id: 'sim', label: 'Sim' },
                    { id: 'talvez', label: 'Talvez' },
                    { id: 'nao', label: 'Não' },
                  ].map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      aria-pressed={wouldReturn === o.id}
                      onClick={() => setWouldReturn(wouldReturn === o.id ? '' : o.id)}
                      className={`h-9 px-5 rounded-full border text-xs font-semibold cursor-pointer transition-colors ${wouldReturn === o.id ? 'bg-on-surface text-surface border-on-surface' : 'border-outline-variant text-on-surface-variant hover:text-on-surface'}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="flex items-center justify-between gap-3 pt-2">
                <Link to="/configuracoes/dados" className="h-10 px-5 rounded-full border border-outline-variant text-xs font-semibold flex items-center hover:bg-surface-container">Cancelar</Link>
                <button type="button" disabled={reasons.length === 0} onClick={() => setStep('confirmar')} className="h-10 px-6 rounded-full bg-primary-container text-on-primary text-xs font-semibold cursor-pointer disabled:opacity-40">
                  Continuar
                </button>
              </div>
            </section>
          )}

          {step === 'confirmar' && (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <div>
                <h2 className="text-base font-bold">Confirmar exclusão</h2>
                <ul className="mt-2 text-xs text-on-surface-variant leading-relaxed list-disc pl-5 flex flex-col gap-1">
                  <li>Seu perfil, publicações, comentários, mensagens, Momentum e salvos serão apagados de forma definitiva em 30 dias.</li>
                  <li>Suas conversas também somem para quem conversava com você.</li>
                  <li>Comunidades que você criou passam para o membro mais antigo, ou são apagadas se ficarem vazias.</li>
                  <li>Registros de acesso podem ser guardados por 6 meses por obrigação legal (Marco Civil da Internet).</li>
                  <li>Entrar de novo dentro de 30 dias cancela a exclusão.</li>
                </ul>
                <p className="text-xs mt-3">
                  Quer uma cópia antes? <Link to="/configuracoes/dados" className="font-semibold text-primary hover:underline">Baixe seus dados</Link>.
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="del-pass" className="text-xs text-on-surface-variant">Sua senha</label>
                <input id="del-pass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="block w-full appearance-none px-0 py-2.5 bg-transparent border-0 border-b border-outline-variant outline-none text-sm text-on-surface focus:border-on-surface" />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="del-type" className="text-xs text-on-surface-variant">Digite EXCLUIR para confirmar</label>
                <input id="del-type" type="text" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} className="block w-full appearance-none px-0 py-2.5 bg-transparent border-0 border-b border-outline-variant outline-none text-sm text-on-surface focus:border-on-surface" />
              </div>

              {error && <p role="alert" className="text-xs text-error">{error}</p>}

              <div className="flex items-center justify-between gap-3 pt-2">
                <button type="button" onClick={() => setStep('motivo')} className="h-10 px-5 rounded-full border border-outline-variant text-xs font-semibold cursor-pointer hover:bg-surface-container">Voltar</button>
                <button type="submit" disabled={busy || !password || typed.trim().toUpperCase() !== 'EXCLUIR'} className="h-10 px-6 rounded-full bg-error text-on-error text-xs font-semibold cursor-pointer disabled:opacity-40">
                  {busy ? 'Excluindo...' : 'Excluir minha conta'}
                </button>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  );
};
