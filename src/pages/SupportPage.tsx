import React from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: 'Como denunciar uma publicação, conversa ou perfil?',
    a: 'Abra o menu (⋮) da publicação, da mensagem ou do perfil e escolha Denunciar. A equipe de moderação analisa cada denúncia.',
  },
  {
    q: 'Como bloquear alguém?',
    a: (
      <>
        No perfil da pessoa, abra o menu e toque em Bloquear. Você vê e desfaz seus bloqueios em <Link to="/atividade/bloqueados" className="text-primary underline">Contas bloqueadas</Link>.
      </>
    ),
  },
  {
    q: 'Como deixar minha conta privada?',
    a: (
      <>
        Em <Link to="/settings/privacy" className="text-primary underline">Privacidade</Link>, ligue o perfil privado. Só amigos confirmados passam a ver suas publicações.
      </>
    ),
  },
  {
    q: 'Esqueci minha senha. E agora?',
    a: 'Na tela de entrada, toque em esqueci a senha e siga o link enviado para o seu e-mail.',
  },
  {
    q: 'Como baixar ou apagar meus dados?',
    a: (
      <>
        Na <Link to="/settings/account" className="text-primary underline">Central de contas</Link> você baixa seus dados e pode pedir a exclusão da conta. Há um prazo de 30 dias para desistir.
      </>
    ),
  },
  {
    q: 'As mensagens temporárias e as fotos de visualização única somem mesmo?',
    a: 'Mensagens temporárias saem da conversa no prazo escolhido. Fotos e vídeos de visualização única abrem uma vez por pessoa. Nenhum dos dois impede captura de tela.',
  },
];

// Ajuda: respostas rápidas para as dúvidas mais comuns
export const SupportPage: React.FC = () => (
  <div className="min-h-screen bg-surface text-on-surface flex flex-col">
    <Header />
    <SidebarNav />
    <div className="pt-16 md:pt-0 md:pl-20">
      <main className="w-full max-w-xl mx-auto px-3 sm:px-4 pt-4 pb-28 md:pb-10 flex flex-col gap-4">
        <div>
          <Link to="/menu" className="inline-flex items-center gap-1 text-xs font-semibold text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Configurações e atividade
          </Link>
          <h1 className="text-xl font-bold mt-2">Ajuda e suporte</h1>
          <p className="text-xs text-on-surface-variant mt-1">Respostas rápidas para as dúvidas mais comuns.</p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden divide-y divide-outline-variant">
          {FAQ.map((item) => (
            <details key={item.q} className="group px-4 py-3">
              <summary className="flex items-center justify-between gap-3 text-sm font-semibold cursor-pointer list-none">
                <span>{item.q}</span>
                <span className="material-symbols-outlined text-[20px] text-on-surface-variant transition-transform group-open:rotate-180">expand_more</span>
              </summary>
              <p className="mt-2 text-xs text-on-surface-variant leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>

        <Link
          to="/suporte/contato"
          className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-primary-container text-on-primary hover:bg-primary transition-colors"
        >
          <span className="material-symbols-outlined text-[22px]">mail</span>
          <span className="flex-1">
            <span className="block text-sm font-semibold">Falar com o suporte</span>
            <span className="block text-xs opacity-80">Dúvidas, problemas, seus dados (LGPD) e direitos autorais</span>
          </span>
          <span className="material-symbols-outlined text-[20px]">chevron_right</span>
        </Link>

        <p className="text-xs text-on-surface-variant text-center">
          <Link to="/termos" className="underline hover:text-on-surface">Termos de uso</Link>
          {' · '}
          <Link to="/privacidade" className="underline hover:text-on-surface">Política de Privacidade</Link>
        </p>
      </main>
    </div>
  </div>
);

export default SupportPage;
