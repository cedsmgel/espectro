import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSidebar } from '../context/SidebarContext';

const PILLARS = [
  { icon: 'group', title: 'Pessoas', text: 'Encontre amigos, acompanhe perfis e mantenha conversas diretas e em grupo.' },
  { icon: 'forum', title: 'Comunidades', text: 'Participe de círculos de interesse e discuta ideias com quem pensa como você.' },
  { icon: 'play_circle', title: 'Experiências', text: 'Compartilhe textos, fotos e vídeos curtos, e mostre seus momentos por 24 horas.' },
];

// Página inicial para visitantes: apresenta o Espectro e leva ao modal de entrada
export const Landing: React.FC = () => {
  const { openAuth } = useAuth();
  const { setHideBottomNav } = useSidebar();

  // A apresentação não mostra a navegação do app
  useEffect(() => {
    setHideBottomNav(true);
    return () => setHideBottomNav(false);
  }, [setHideBottomNav]);

  return (
    <div className="min-h-dvh bg-surface text-on-surface flex flex-col">
      <header className="w-full max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between pt-[env(safe-area-inset-top)]">
        <Link to="/" className="inline-flex items-center gap-2.5" aria-label="Espectro, página inicial">
          <div className="w-9 h-9 rounded-xl bg-olive flex items-center justify-center text-on-primary">
            <span className="material-symbols-outlined text-[22px]">grain</span>
          </div>
          <span className="text-xl font-bold tracking-tight">Espectro</span>
        </Link>
        <button
          type="button"
          onClick={() => openAuth({ mode: 'login' })}
          className="h-10 px-5 rounded-full text-sm font-semibold hover:bg-surface-container transition-colors cursor-pointer"
        >
          Entrar
        </button>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 flex flex-col">
        <section className="flex-1 flex flex-col justify-center py-14 sm:py-24 max-w-2xl">
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05] text-balance">
            Uma rede social para pessoas, comunidades e ideias.
          </h1>
          <p className="mt-5 text-base sm:text-lg text-on-surface-variant leading-relaxed max-w-xl">
            Um espaço para descobrir pessoas, compartilhar experiências, conversar e participar de comunidades.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => openAuth({ mode: 'register' })}
              className="h-12 px-8 rounded-full bg-primary-container text-on-primary text-sm font-semibold hover:bg-primary transition-colors cursor-pointer"
            >
              Criar conta
            </button>
            <button
              type="button"
              onClick={() => openAuth({ mode: 'login' })}
              className="h-12 px-8 rounded-full border border-on-surface text-on-surface text-sm font-semibold hover:bg-surface-container transition-colors cursor-pointer"
            >
              Entrar
            </button>
          </div>

          <Link to="/?filter=trending" className="mt-6 inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors self-start">
            Ver o que está em alta
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Link>
        </section>

        <section aria-label="O que você encontra no Espectro" className="grid grid-cols-1 sm:grid-cols-3 border-t border-outline-variant">
          {PILLARS.map((p, i) => (
            <div key={p.title} className={`py-6 sm:py-8 flex flex-col gap-2 ${i > 0 ? 'border-t sm:border-t-0 sm:border-l border-outline-variant sm:pl-6' : ''} ${i < PILLARS.length - 1 ? 'sm:pr-6' : ''}`}>
              <span className="material-symbols-outlined text-[24px]">{p.icon}</span>
              <h2 className="text-base font-bold">{p.title}</h2>
              <p className="text-sm text-on-surface-variant leading-relaxed">{p.text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 text-xs text-on-surface-variant pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        Espectro © {new Date().getFullYear()}
      </footer>
    </div>
  );
};
