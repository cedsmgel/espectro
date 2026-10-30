import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, authStorage } from '../lib/api';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'login' | 'cadastro'>('login');

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Register form state
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [regError, setRegError] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);

  useEffect(() => {
    if (authStorage.isAuthenticated()) {
      navigate('/');
    }
    if (searchParams.get('tab') === 'cadastro') {
      setActiveTab('cadastro');
    }
  }, [navigate, searchParams]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      await api.login({ username: loginUsername, password: loginPassword });
      navigate('/');
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Falha no login');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    if (regPassword !== regPasswordConfirm) {
      setRegError('As senhas não coincidem');
      return;
    }

    setRegLoading(true);
    try {
      await api.register({
        username: regUsername.trim(),
        email: regEmail.trim(),
        password: regPassword,
      });
      // Automatically log in after registration
      await api.login({ username: regUsername.trim(), password: regPassword });
      navigate('/');
    } catch (err: unknown) {
      setRegError(err instanceof Error ? err.message : 'Falha no cadastro');
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="bg-surface-container-low text-on-surface font-body-md text-body-md antialiased min-h-screen flex flex-col justify-between selection:bg-secondary-container selection:text-primary">
      {/* Brand Header */}
      <header className="w-full bg-surface-container-high border-b border-outline-variant shadow-sm sticky top-0 z-30">
        <div className="flex justify-between items-center w-full px-space-lg py-space-sm max-w-[1180px] mx-auto">
          {/* Logo + Tagline */}
          <div className="flex items-center gap-space-md">
            <div className="flex items-center gap-space-xs">
              <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center shadow-inner border border-primary">
                <span className="text-on-primary font-bold text-headline-sm lowercase tracking-tighter">e</span>
              </div>
              <span className="text-headline-lg font-headline-lg font-bold lowercase tracking-tight text-primary font-retro-brand select-none">
                espectro
              </span>
            </div>
            <span className="hidden md:inline-block text-outline text-label-md font-label-md pl-space-xs border-l border-outline-variant italic">
              conecta amigos, comunidades e memórias
            </span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-space-md">
            <div className="hidden sm:flex items-center gap-space-xs text-secondary text-label-md font-label-md bg-surface-container-lowest px-space-sm py-1 rounded border border-outline-variant">
              <span className="material-symbols-outlined text-primary text-label-md">language</span>
              <span>Português (Brasil)</span>
            </div>
            <nav className="flex items-center gap-space-sm text-label-md font-label-md">
              <button
                type="button"
                onClick={() => setActiveTab('login')}
                className={`px-space-xs py-1 ${activeTab === 'login' ? 'text-primary font-bold underline' : 'text-secondary hover:text-primary'}`}
              >
                Entrar
              </button>
              <span className="text-outline-variant">|</span>
              <button
                type="button"
                onClick={() => setActiveTab('cadastro')}
                className={`px-space-xs py-1 ${activeTab === 'cadastro' ? 'text-primary font-bold underline' : 'text-secondary hover:text-primary'}`}
              >
                Criar Conta
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Canvas (Two-Column Layout ~1000px centered) */}
      <main className="flex-grow flex items-center justify-center px-space-md py-space-xl">
        <div className="w-full max-w-[1000px] grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-start">
          {/* Left Column: Nostalgic Value Proposition & Web 2.0 Features (7 cols) */}
          <section className="lg:col-span-7 flex flex-col gap-space-lg">
            {/* Welcome Title Banner */}
            <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-secondary-container retro-bevel-card">
              <h1 className="text-headline-lg font-headline-lg text-primary mb-space-xs leading-snug">
                Conecte-se aos seus amigos e faça novas amizades através de comunidades.
              </h1>
              <p className="text-secondary font-body-md text-body-md">
                O Espectro resgata a internet acolhedora, humana e divertida. Um lugar feito para guardar depoimentos sinceros e debater seus tópicos favoritos.
              </p>
            </div>

            {/* 4 Classic Feature Blocks */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
              {/* Feature 1 */}
              <div className="bg-surface-container-lowest p-space-md rounded-lg border border-secondary-container flex gap-space-sm items-start hover:border-primary-container transition-colors">
                <div className="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center text-primary flex-shrink-0 border border-secondary-fixed">
                  <span className="material-symbols-outlined">groups</span>
                </div>
                <div>
                  <h2 className="text-label-md font-label-md text-primary mb-0.5">Comunidades vibrantes</h2>
                  <p className="text-body-sm font-body-sm text-secondary">
                    Descubra fóruns sobre tudo o que você ama: música, piadas, livros e nostalgias dos anos 2000.
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="bg-surface-container-lowest p-space-md rounded-lg border border-secondary-container flex gap-space-sm items-start hover:border-primary-container transition-colors">
                <div className="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center text-primary flex-shrink-0 border border-secondary-fixed">
                  <span className="material-symbols-outlined">forum</span>
                </div>
                <div>
                  <h2 className="text-label-md font-label-md text-primary mb-0.5">Recados & Depoimentos</h2>
                  <p className="text-body-sm font-body-sm text-secondary">
                    Deixe aquele recado público ou escreva um depoimento com o lendário &quot;só aceita se quiser!&quot;.
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="bg-surface-container-lowest p-space-md rounded-lg border border-secondary-container flex gap-space-sm items-start hover:border-primary-container transition-colors">
                <div className="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center text-primary flex-shrink-0 border border-secondary-fixed">
                  <span className="material-symbols-outlined">military_tech</span>
                </div>
                <div>
                  <h2 className="text-label-md font-label-md text-primary mb-0.5">Medidores de Amizade</h2>
                  <p className="text-body-sm font-body-sm text-secondary">
                    Avalie seus melhores amigos com as insígnias clássicas: Confiável, Legal e Sexy.
                  </p>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="bg-surface-container-lowest p-space-md rounded-lg border border-secondary-container flex gap-space-sm items-start hover:border-primary-container transition-colors">
                <div className="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center text-primary flex-shrink-0 border border-secondary-fixed">
                  <span className="material-symbols-outlined">visibility</span>
                </div>
                <div>
                  <h2 className="text-label-md font-label-md text-primary mb-0.5">Visitas recentes</h2>
                  <p className="text-body-sm font-body-sm text-secondary">
                    Descubra quem andou espiando o seu perfil hoje e mantenha sua rede de contatos sempre viva.
                  </p>
                </div>
              </div>
            </div>

            {/* Badges & Karma Mock Strip */}
            <div className="bg-surface-container-high border border-secondary-container rounded-lg p-space-sm flex flex-wrap items-center justify-between gap-space-sm text-body-sm font-body-sm">
              <div className="flex items-center gap-space-xs text-primary font-bold">
                <span className="material-symbols-outlined text-label-md">verified</span>
                <span>Avaliações da rede:</span>
              </div>
              <div className="flex items-center gap-space-md">
                <div className="flex items-center gap-1">
                  <span className="text-secondary font-medium">Confiável:</span>
                  <span className="inline-flex text-[#E9A825] text-label-md">★★★</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-secondary font-medium">Legal:</span>
                  <span className="inline-flex text-[#62B33C] text-label-md">★★★</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-secondary font-medium">Sexy:</span>
                  <span className="inline-flex text-[#D94343] text-label-md">★★★</span>
                </div>
              </div>
            </div>

            {/* Security Notice Callout */}
            <div className="bg-surface-container-lowest border-l-4 border-primary-container p-space-sm rounded-r-lg border-y border-r border-secondary-container flex items-center gap-space-sm shadow-sm">
              <span className="material-symbols-outlined text-primary-container flex-shrink-0">security</span>
              <p className="text-body-sm font-body-sm text-on-surface-variant">
                <strong className="text-primary font-label-md">Aviso de Segurança:</strong> O Espectro nunca pede sua senha por e-mail, scraps ou mensagens privadas. Mantenha seus dados sempre em sigilo.
              </p>
            </div>
          </section>

          {/* Right Column: Authentication Card with Nostalgic Tabs (5 cols) */}
          <section className="lg:col-span-5 w-full">
            <div className="bg-surface-container-lowest rounded-xl border border-secondary-container retro-bevel-card overflow-hidden">
              {/* Tab Strip */}
              <div className="retro-header-strip px-space-md pt-space-sm flex items-end gap-1 border-b border-secondary-container">
                <button
                  type="button"
                  onClick={() => setActiveTab('login')}
                  className={`px-space-md py-2 text-label-md font-label-md rounded-t-lg -mb-px flex items-center gap-1 transition-all focus:outline-none ${
                    activeTab === 'login'
                      ? 'bg-surface-container-lowest text-primary font-bold border-t border-x border-secondary-container shadow-sm'
                      : 'bg-surface-container-high text-secondary hover:text-primary border-t border-x border-secondary-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-label-md">login</span>
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('cadastro')}
                  className={`px-space-md py-2 text-label-md font-label-md rounded-t-lg -mb-px flex items-center gap-1 transition-all focus:outline-none ${
                    activeTab === 'cadastro'
                      ? 'bg-surface-container-lowest text-primary font-bold border-t border-x border-secondary-container shadow-sm'
                      : 'bg-surface-container-high text-secondary hover:text-primary border-t border-x border-secondary-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-label-md">person_add</span>
                  Criar Conta
                </button>
              </div>

              <div className="p-space-lg">
                {/* LOGIN FORM */}
                {activeTab === 'login' && (
                  <form className="space-y-space-md" onSubmit={handleLoginSubmit}>
                    <div className="border-b border-surface-container pb-space-xs">
                      <span className="text-primary font-label-md text-label-md">Acesse seu perfil</span>
                      <p className="text-secondary text-body-sm font-body-sm">Digite suas credenciais cadastradas.</p>
                    </div>

                    {loginError && (
                      <div className="p-2 rounded bg-error-container text-on-error-container text-body-sm border border-error">
                        {loginError}
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="block text-label-md font-label-md text-on-surface" htmlFor="login-username">
                        Usuário ou E-mail:
                      </label>
                      <div className="relative">
                        <input
                          id="login-username"
                          type="text"
                          required
                          value={loginUsername}
                          onChange={(e) => setLoginUsername(e.target.value)}
                          placeholder="seu_usuario"
                          className="w-full text-body-md font-body-md px-space-sm py-1.5 rounded border border-outline-variant bg-surface-container-lowest focus:border-primary-container focus:ring-2 focus:ring-secondary-container outline-none transition-all placeholder:text-outline"
                        />
                        <span className="material-symbols-outlined absolute right-2.5 top-2 text-outline text-label-md">
                          person
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="block text-label-md font-label-md text-on-surface" htmlFor="login-pass">
                          Senha:
                        </label>
                      </div>
                      <div className="relative">
                        <input
                          id="login-pass"
                          type="password"
                          required
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full text-body-md font-body-md px-space-sm py-1.5 rounded border border-outline-variant bg-surface-container-lowest focus:border-primary-container focus:ring-2 focus:ring-secondary-container outline-none transition-all placeholder:text-outline"
                        />
                        <span className="material-symbols-outlined absolute right-2.5 top-2 text-outline text-label-md">
                          lock
                        </span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loginLoading}
                      className="w-full retro-btn-primary text-on-primary py-2 px-space-md rounded border border-[#1A3775] font-label-md text-label-md font-bold transition-all active:translate-y-px disabled:opacity-50"
                    >
                      {loginLoading ? 'Entrando...' : 'Entrar no Espectro'}
                    </button>

                    <div className="pt-space-sm text-center border-t border-surface-container">
                      <p className="text-body-sm font-body-sm text-secondary">
                        Primeira vez aqui?{' '}
                        <button
                          type="button"
                          onClick={() => setActiveTab('cadastro')}
                          className="text-primary font-bold hover:underline ml-1"
                        >
                          Crie sua conta agora
                        </button>
                      </p>
                    </div>
                  </form>
                )}

                {/* REGISTER FORM */}
                {activeTab === 'cadastro' && (
                  <form className="space-y-space-md" onSubmit={handleRegisterSubmit}>
                    <div className="border-b border-surface-container pb-space-xs">
                      <span className="text-primary font-label-md text-label-md">Crie seu perfil no Espectro</span>
                      <p className="text-secondary text-body-sm font-body-sm">Leva menos de 1 minuto para se juntar.</p>
                    </div>

                    {regError && (
                      <div className="p-2 rounded bg-error-container text-on-error-container text-body-sm border border-error">
                        {regError}
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="block text-label-md font-label-md text-on-surface" htmlFor="cad-nick">
                        Nome de usuário (@apelido):
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1.5 text-secondary text-body-md font-bold">@</span>
                        <input
                          id="cad-nick"
                          type="text"
                          required
                          value={regUsername}
                          onChange={(e) => setRegUsername(e.target.value)}
                          placeholder="clarinha2004"
                          className="w-full text-body-md font-body-md pl-7 pr-space-sm py-1.5 rounded border border-outline-variant bg-surface-container-lowest focus:border-primary-container focus:ring-2 focus:ring-secondary-container outline-none transition-all placeholder:text-outline"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-label-md font-label-md text-on-surface" htmlFor="cad-email">
                        E-mail válido:
                      </label>
                      <input
                        id="cad-email"
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="seu.email@provedor.com"
                        className="w-full text-body-md font-body-md px-space-sm py-1.5 rounded border border-outline-variant bg-surface-container-lowest focus:border-primary-container focus:ring-2 focus:ring-secondary-container outline-none transition-all placeholder:text-outline"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-space-sm">
                      <div className="space-y-1">
                        <label className="block text-label-md font-label-md text-on-surface" htmlFor="cad-pass">
                          Senha:
                        </label>
                        <input
                          id="cad-pass"
                          type="password"
                          required
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full text-body-md font-body-md px-space-sm py-1.5 rounded border border-outline-variant bg-surface-container-lowest focus:border-primary-container focus:ring-2 focus:ring-secondary-container outline-none transition-all placeholder:text-outline"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-label-md font-label-md text-on-surface" htmlFor="cad-pass-confirm">
                          Confirmar:
                        </label>
                        <input
                          id="cad-pass-confirm"
                          type="password"
                          required
                          value={regPasswordConfirm}
                          onChange={(e) => setRegPasswordConfirm(e.target.value)}
                          placeholder="••••••••"
                          className="w-full text-body-md font-body-md px-space-sm py-1.5 rounded border border-outline-variant bg-surface-container-lowest focus:border-primary-container focus:ring-2 focus:ring-secondary-container outline-none transition-all placeholder:text-outline"
                        />
                      </div>
                    </div>

                    <p className="text-body-sm font-body-sm text-secondary leading-tight pt-1">
                      Ao clicar em &quot;Cadastrar-se&quot;, você concorda com nossos Termos e Privacidade.
                    </p>

                    <button
                      type="submit"
                      disabled={regLoading}
                      className="w-full retro-btn-primary text-on-primary py-2 px-space-md rounded border border-[#1A3775] font-label-md text-label-md font-bold transition-all active:translate-y-px disabled:opacity-50"
                    >
                      {regLoading ? 'Criando conta...' : 'Cadastrar-se no Espectro'}
                    </button>

                    <div className="pt-space-sm text-center border-t border-surface-container">
                      <p className="text-body-sm font-body-sm text-secondary">
                        Já possui conta?{' '}
                        <button
                          type="button"
                          onClick={() => setActiveTab('login')}
                          className="text-primary font-bold hover:underline ml-1"
                        >
                          Entrar com seus dados
                        </button>
                      </p>
                    </div>
                  </form>
                )}
              </div>

              {/* Bottom Metric Banner inside card */}
              <div className="bg-surface-container-high py-2.5 px-space-md border-t border-secondary-container text-center">
                <span className="text-body-sm font-body-sm text-primary font-semibold flex items-center justify-center gap-1">
                  <span className="material-symbols-outlined text-primary text-label-md">public</span>
                  Conectando amigos e memórias nostálgicas desde 2004!
                </span>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-surface-container border-t border-outline-variant mt-space-lg">
        <div className="flex flex-col sm:flex-row justify-between items-center w-full px-space-lg py-space-md max-w-[1180px] mx-auto gap-space-sm">
          <span className="text-body-sm font-body-sm text-secondary text-center sm:text-left">
            © 2004-2026 Espectro Redes Sociais. Todos os direitos reservados.
          </span>
          <nav className="flex flex-wrap justify-center items-center gap-x-space-md gap-y-1 text-label-sm font-label-sm">
            <span className="text-secondary">Sobre o Espectro</span>
            <span className="text-outline-variant">•</span>
            <span className="text-secondary">Centro de Segurança</span>
            <span className="text-outline-variant">•</span>
            <span className="text-secondary">Privacidade</span>
            <span className="text-outline-variant">•</span>
            <span className="text-secondary">Termos de Uso</span>
          </nav>
        </div>
      </footer>
    </div>
  );
};
