import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { authStorage, supportApi } from '../lib/api';

const TOPICS = [
  { id: 'duvida', label: 'Dúvida' },
  { id: 'problema', label: 'Problema no Espectro' },
  { id: 'dados', label: 'Meus dados (LGPD)' },
  { id: 'direitos_autorais', label: 'Direitos autorais' },
  { id: 'outro', label: 'Outro assunto' },
];

// Fale com o suporte: dúvidas, problemas, pedidos sobre dados e avisos de direitos autorais
export const SupportContactPage: React.FC = () => {
  const user = authStorage.getUser();
  const [topic, setTopic] = useState('duvida');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await supportApi.send({ topic, message, contact_email: email || undefined });
      setSent(true);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível enviar agora. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <Header />
      <SidebarNav />
      <div className="pt-16 md:pt-0 md:pl-20">
        <main className="w-full max-w-xl mx-auto px-3 sm:px-4 pt-4 pb-28 md:pb-10 flex flex-col gap-4">
          <div>
            <Link to="/suporte" className="inline-flex items-center gap-1 text-xs font-semibold text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Ajuda e suporte
            </Link>
            <h1 className="text-xl font-bold mt-2">Fale com o suporte</h1>
            <p className="text-xs text-on-surface-variant mt-1">Respondemos em até 15 dias.</p>
          </div>

          {sent ? (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 text-center">
              <span className="material-symbols-outlined text-[36px] text-primary">mark_email_read</span>
              <p className="text-sm font-semibold mt-2">Mensagem enviada</p>
              <p className="text-xs text-on-surface-variant mt-1">Obrigado! {email ? `Vamos responder para ${email}.` : 'Vamos responder pelo e-mail da sua conta.'}</p>
              <Link to="/suporte" className="inline-block mt-4 text-xs font-semibold text-primary hover:underline">Voltar à ajuda</Link>
            </div>
          ) : (
            <form onSubmit={submit} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Assunto
                <select value={topic} onChange={(e) => setTopic(e.target.value)} className="h-10 px-3 rounded-xl bg-surface-container-low text-sm font-normal outline-none">
                  {TOPICS.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </label>
              {topic === 'direitos_autorais' && (
                <p className="text-[11px] text-on-surface-variant -mt-2">Informe a obra, o link do conteúdo, seus dados e a declaração de que o aviso é verdadeiro e de que você é o titular ou representante.</p>
              )}
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Mensagem
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  maxLength={3000}
                  required
                  className="p-3 rounded-xl bg-surface-container-low text-sm font-normal outline-none resize-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold">
                E-mail para resposta {user ? '(opcional)' : ''}
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required={!user}
                  maxLength={200}
                  className="h-10 px-3 rounded-xl bg-surface-container-low text-sm font-normal outline-none"
                />
              </label>
              {error && <p className="text-xs text-error">{error}</p>}
              <button type="submit" disabled={busy} className="h-11 rounded-full bg-primary-container text-on-primary font-semibold text-sm hover:bg-primary disabled:opacity-60 cursor-pointer">
                {busy ? 'Enviando...' : 'Enviar'}
              </button>
            </form>
          )}
        </main>
      </div>
    </div>
  );
};

export default SupportContactPage;
