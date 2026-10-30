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
    <div className="min-h-screen flex items-center justify-center py-12 px-4 relative overflow-hidden bg-[#0a0c10] text-neutral-100">
      {/* Ambient Volumetric Glow Orbs from Stitch */}
      <div className="orb-glow-1" />
      <div className="orb-glow-2" />

      {/* Floating Liquid Glass Card (Stitch Specification) */}
      <div className="glass-surface backdrop-blur-3xl rounded-3xl border border-white/15 shadow-[0_24px_80px_rgba(0,0,0,0.8),0_0_40px_rgba(56,189,248,0.15)] max-w-lg w-full p-8 md:p-10 relative overflow-hidden z-10">
        {/* Subtle top rim light */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-cyan-400/20 rounded-full blur-3xl pointer-events-none" />

        {/* Card Header with Prism Logo */}
        <div className="text-center space-y-2 mb-6">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-2 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-cyan-400 to-indigo-500 p-[1.5px] shadow-[0_0_16px_rgba(76,215,246,0.4)] group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-[#0d0f14] rounded-[10px] flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px] text-cyan-300">auto_awesome</span>
              </div>
            </div>
            <span className="text-2xl font-display font-bold tracking-tight bg-gradient-to-r from-blue-400 via-cyan-300 to-white bg-clip-text text-transparent">
              espectro.
            </span>
          </Link>

          <div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-400/10 text-cyan-300 border border-cyan-400/30 tracking-wider">
              v2.4 GLASS • ÓRBITA
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-display font-bold text-white pt-1">
            A rede social nostálgica para a era espacial
          </h2>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            Conecte-se aos seus círculos, scraps do futuro e comunidades retrô.
          </p>
        </div>

        {/* Capsule Tab Switcher */}
        <div className="grid grid-cols-2 p-1 rounded-2xl glass-recessed border border-white/10 mb-6">
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setError(null);
            }}
            className={`py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'login'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.4)]'
                : 'text-neutral-400 hover:text-white'
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
            className={`py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'register'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.4)]'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Criar Conta
          </button>
        </div>

        {error && (
          <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs px-3.5 py-2.5 rounded-xl mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form Fields (Recessed Glass Inputs) */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Nome de Usuário
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3.5 text-neutral-400 text-[18px]">
                person
              </span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="@seunome"
                className="w-full pl-10 pr-4 py-3 text-xs sm:text-sm rounded-xl glass-recessed text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
              />
            </div>
          </div>

          {activeTab === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                E-mail
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3.5 text-neutral-400 text-[18px]">
                  alternate_email
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full pl-10 pr-4 py-3 text-xs sm:text-sm rounded-xl glass-recessed text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Senha secreta
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3.5 text-neutral-400 text-[18px]">
                lock
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-3 text-xs sm:text-sm rounded-xl glass-recessed text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-neutral-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          {activeTab === 'login' && (
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-neutral-400 hover:text-white">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded bg-white/10 border-white/20 text-blue-500 focus:ring-0"
                />
                <span>Lembrar nesta nave</span>
              </label>
              <button
                type="button"
                onClick={() => alert('Para redefinir sua senha, entre em contato com o suporte do Espectro.')}
                className="text-cyan-400 hover:underline cursor-pointer"
              >
                Esqueceu a chave?
              </button>
            </div>
          )}

          {/* Primary Action Button from Stitch */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 text-white font-semibold text-sm shadow-[0_0_25px_rgba(56,189,248,0.45)] hover:shadow-[0_0_35px_rgba(56,189,248,0.65)] hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
          >
            <span>
              {loading
                ? 'Processando...'
                : activeTab === 'login'
                ? 'Entrar no Espectro'
                : 'Criar Minha Conta'}
            </span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </form>

        {/* Nostalgic 2000s Badges Footer from Stitch */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-xl bg-white/5 border border-white/5">
              <span className="text-[11px] block font-semibold text-amber-300">🌟 100%</span>
              <span className="text-[9px] text-neutral-400 uppercase tracking-wider">Confiável</span>
            </div>
            <div className="p-2 rounded-xl bg-white/5 border border-white/5">
              <span className="text-[11px] block font-semibold text-rose-400">🔥 100%</span>
              <span className="text-[9px] text-neutral-400 uppercase tracking-wider">Legal</span>
            </div>
            <div className="p-2 rounded-xl bg-white/5 border border-white/5">
              <span className="text-[11px] block font-semibold text-cyan-300">💎 100%</span>
              <span className="text-[9px] text-neutral-400 uppercase tracking-wider">Nostálgico</span>
            </div>
          </div>

          <div className="text-center mt-4 text-[10px] text-neutral-500">
            © 2025 Espectro Inc. • Protocolo Karma
          </div>
        </div>
      </div>
    </div>
  );
};
