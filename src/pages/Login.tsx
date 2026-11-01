import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { authApi, authStorage } from '../lib/api';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Aviso deixado quando a sessão foi encerrada por suspensão
  useEffect(() => {
    try {
      const notice = sessionStorage.getItem('espectro_login_notice');
      if (notice) {
        setError(notice);
        sessionStorage.removeItem('espectro_login_notice');
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (searchParams.get('tab') === 'cadastro') {
      setActiveTab('register');
    }
    if (authStorage.isAuthenticated()) {
      navigate('/');
    }
  }, [searchParams, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (activeTab === 'login') {
        const res = await authApi.login({ username, password });
        authStorage.setToken(res.token);
        authStorage.setUser(res.user);
        navigate('/');
      } else {
        await authApi.register({ username, email, password });
        // Automatically login after successful registration
        const loginRes = await authApi.login({ username, password });
        authStorage.setToken(loginRes.token);
        authStorage.setUser(loginRes.user);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao processar solicitação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="theme-brand min-h-screen flex items-center justify-center py-12 px-4 bg-surface text-on-surface">
      <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/30 shadow-md max-w-md w-full p-8 md:p-10 flex flex-col gap-6">
        {/* Card Header with Espectro Logo */}
        <div className="text-center flex flex-col items-center gap-2">
          <Link to="/" className="inline-flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-olive flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[24px]">grain</span>
            </div>
            <span className="text-2xl font-bold tracking-tight text-primary">
              Espectro
            </span>
          </Link>

          <div>
            <span className="inline-flex items-center px-3 py-0.5 rounded-full text-[11px] font-semibold bg-secondary-fixed text-on-secondary-fixed-variant">
              Plataforma Social Conectada
            </span>
          </div>

          <h2 className="text-lg font-bold text-on-surface pt-1">
            {activeTab === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta no Espectro'}
          </h2>
          <p className="text-xs text-on-surface-variant max-w-xs">
            {activeTab === 'login'
              ? 'Acesse suas conversas, tópicos e comunidades favoritas.'
              : 'Junte-se à nova geração de redes sociais focadas em comunidades.'}
          </p>
        </div>

        {/* Capsule Tab Switcher */}
        <div className="grid grid-cols-2 p-1 rounded-full bg-surface-container-low border border-outline-variant/30">
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setError(null);
            }}
            className={`py-2 text-xs font-semibold rounded-full transition-all cursor-pointer ${
              activeTab === 'login'
                ? 'bg-surface-container-lowest text-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              setError(null);
            }}
            className={`py-2 text-xs font-semibold rounded-full transition-all cursor-pointer ${
              activeTab === 'register'
                ? 'bg-surface-container-lowest text-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Criar Conta
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-2xl bg-error-container text-error text-xs font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface">Nome de Usuário</label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3.5 text-on-surface-variant text-[18px]">
                alternate_email
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="seunome"
                required
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-surface-container-low border border-outline-variant/30 rounded-2xl text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary-container/20 transition-all"
              />
            </div>
          </div>

          {activeTab === 'register' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface">E-mail</label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3.5 text-on-surface-variant text-[18px]">
                  mail
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-surface-container-low border border-outline-variant/30 rounded-2xl text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary-container/20 transition-all"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-on-surface">Senha</label>
              {activeTab === 'login' && (
                <a href="#" className="text-[11px] text-primary hover:underline">
                  Esqueceu a senha?
                </a>
              )}
            </div>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3.5 text-on-surface-variant text-[18px]">
                lock
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-10 pr-10 py-2.5 text-xs bg-surface-container-low border border-outline-variant/30 rounded-2xl text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary-container/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded text-primary focus:ring-primary"
            />
            <label htmlFor="remember" className="text-xs text-on-surface-variant cursor-pointer">
              Lembrar meus dados nesta máquina
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-full bg-primary-container text-on-primary font-semibold text-xs hover:bg-primary shadow-xs transition-all disabled:opacity-50 cursor-pointer mt-2"
          >
            {loading ? 'Processando...' : activeTab === 'login' ? 'Acessar Conta' : 'Concluir Cadastro'}
          </button>
        </form>

        <p className="text-center text-[11px] text-on-surface-variant">
          Ao prosseguir, você concorda com as{' '}
          <a href="#" className="text-primary hover:underline">
            Diretrizes de Convivência
          </a>{' '}
          do Espectro.
        </p>
      </div>
    </div>
  );
};
