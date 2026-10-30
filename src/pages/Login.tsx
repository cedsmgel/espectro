import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
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
      await api.login({ username: regUsername.trim(), password: regPassword });
      navigate('/');
    } catch (err: unknown) {
      setRegError(err instanceof Error ? err.message : 'Falha no cadastro');
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between font-sans selection:bg-brand-blue/30 selection:text-blue-300">
      {/* Sleek Minimal Header */}
      <header className="w-full glass-header py-4 px-6 sticky top-0 z-30">
        <div className="max-w-[1180px] mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-blue to-neon-cyan flex items-center justify-center shadow-glow-blue">
              <span className="text-white font-display font-bold text-base lowercase">e</span>
            </div>
            <span className="font-display font-bold text-xl text-white tracking-tight">
              espectro
            </span>
          </Link>

          <Link to="/" className="text-xs text-neutral-400 hover:text-white transition-colors">
            ← Voltar ao início
          </Link>
        </div>
      </header>

      {/* Main Liquid Glass Canvas */}
      <main className="flex-grow flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[960px] grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Modern Value Prop */}
          <section className="lg:col-span-6 space-y-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-blue/15 border border-brand-blue/30 text-blue-400 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse"></span>
                Liquid Glass Design System
              </div>

              <h1 className="text-3xl sm:text-4xl font-display font-bold text-white tracking-tight leading-tight">
                A nova geração da rede social descentralizada e acolhedora.
              </h1>

              <p className="text-sm text-neutral-400 leading-relaxed font-sans">
                O Espectro une o calor das comunidades com a estética moderna e fluida do Liquid Glass. Fóruns temáticos, discussões em thread e recados autênticos.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="glass-panel p-4 rounded-2xl space-y-1">
                <span className="material-symbols-outlined text-brand-blue text-2xl">hub</span>
                <h3 className="font-display font-bold text-sm text-white">e/Comunidades</h3>
                <p className="text-xs text-neutral-400">URLs amigáveis com /e/ e debates em tópicos.</p>
              </div>

              <div className="glass-panel p-4 rounded-2xl space-y-1">
                <span className="material-symbols-outlined text-neon-green text-2xl">thumb_up</span>
                <h3 className="font-display font-bold text-sm text-white">Upvotes Neons</h3>
                <p className="text-xs text-neutral-400">Curadoria orgânica e positiva da comunidade.</p>
              </div>
            </div>
          </section>

          {/* Right Column: Glass Card */}
          <section className="lg:col-span-6 w-full">
            <div className="glass-panel bg-[#131722]/85 rounded-3xl p-6 sm:p-8 space-y-6 border border-white/10 shadow-2xl">
              {/* Tab Selector */}
              <div className="flex bg-white/[0.04] p-1 rounded-2xl border border-white/10 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('login')}
                  className={`flex-1 py-2 rounded-xl font-medium transition-all cursor-pointer ${
                    activeTab === 'login'
                      ? 'bg-brand-blue text-white shadow-glow-blue font-bold'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Entrar na Conta
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('cadastro')}
                  className={`flex-1 py-2 rounded-xl font-medium transition-all cursor-pointer ${
                    activeTab === 'cadastro'
                      ? 'bg-brand-blue text-white shadow-glow-blue font-bold'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Criar Nova Conta
                </button>
              </div>

              {/* Login Form */}
              {activeTab === 'login' && (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  {loginError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                      {loginError}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-neutral-300" htmlFor="login-username">
                      Usuário ou E-mail:
                    </label>
                    <input
                      id="login-username"
                      type="text"
                      required
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder="seu_usuario"
                      className="w-full glass-input px-4 py-2.5 rounded-xl text-sm text-white outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-neutral-300" htmlFor="login-pass">
                      Senha de Acesso:
                    </label>
                    <input
                      id="login-pass"
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full glass-input px-4 py-2.5 rounded-xl text-sm text-white outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full btn-primary-blue text-sm font-semibold py-2.5 rounded-xl cursor-pointer disabled:opacity-50 mt-2 shadow-glow-blue"
                  >
                    {loginLoading ? 'Conectando...' : 'Entrar no Espectro'}
                  </button>
                </form>
              )}

              {/* Register Form */}
              {activeTab === 'cadastro' && (
                <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                  {regError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                      {regError}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-neutral-300" htmlFor="cad-nick">
                      Nome de usuário (@apelido):
                    </label>
                    <input
                      id="cad-nick"
                      type="text"
                      required
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      placeholder="clara2026"
                      className="w-full glass-input px-4 py-2 text-sm rounded-xl text-white outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-neutral-300" htmlFor="cad-email">
                      E-mail:
                    </label>
                    <input
                      id="cad-email"
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="seu.email@provedor.com"
                      className="w-full glass-input px-4 py-2 text-sm rounded-xl text-white outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-neutral-300" htmlFor="cad-pass">
                        Senha:
                      </label>
                      <input
                        id="cad-pass"
                        type="password"
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full glass-input px-3.5 py-2 text-sm rounded-xl text-white outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-neutral-300" htmlFor="cad-pass-confirm">
                        Confirmar:
                      </label>
                      <input
                        id="cad-pass-confirm"
                        type="password"
                        required
                        value={regPasswordConfirm}
                        onChange={(e) => setRegPasswordConfirm(e.target.value)}
                        placeholder="••••••••"
                        className="w-full glass-input px-3.5 py-2 text-sm rounded-xl text-white outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={regLoading}
                    className="w-full btn-primary-blue text-sm font-semibold py-2.5 rounded-xl cursor-pointer disabled:opacity-50 mt-2 shadow-glow-blue"
                  >
                    {regLoading ? 'Criando perfil...' : 'Criar Conta no Espectro'}
                  </button>
                </form>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Modern Footer */}
      <footer className="w-full border-t border-white/[0.06] py-5 px-6 text-center text-xs text-neutral-500">
        <p>© 2026 Espectro. Liquid Glass Design System. Cloudflare Pages &amp; D1.</p>
      </footer>
    </div>
  );
};
