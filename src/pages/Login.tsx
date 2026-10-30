import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, register } from "../lib/api";

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [isLoginTab, setIsLoginTab] = useState(true);

  // Campos
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (isLoginTab) {
        await login(username, password);
        navigate("/");
      } else {
        await register(username, email, password);
        setSuccess("Conta criada com sucesso! Faça login com suas novas credenciais.");
        setIsLoginTab(true);
        setPassword("");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao processar requisição.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-16 bg-background">
      <div className="w-full max-w-md bg-surface-container-lowest/90 backdrop-blur-xl border border-outline-variant/30 rounded-xl shadow-xl overflow-hidden p-6 sm:p-8">
        {/* Cabeçalho */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary-container text-on-primary flex items-center justify-center mx-auto mb-3 shadow-sm">
            <span className="material-symbols-outlined text-[24px]">blur_on</span>
          </div>
          <h1 className="text-xl font-bold text-primary tracking-tight font-sans">
            Acesse o Espectro
          </h1>
          <p className="text-xs text-on-surface-variant mt-1">
            Plataforma de conexões, comunidades e curadoria coletiva.
          </p>
        </div>

        {/* Abas */}
        <div className="flex p-1 bg-surface-container-low rounded-lg mb-6">
          <button
            type="button"
            onClick={() => {
              setIsLoginTab(true);
              setError(null);
              setSuccess(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${
              isLoginTab
                ? "bg-surface-container-lowest text-primary shadow-sm"
                : "text-outline hover:text-on-surface"
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLoginTab(false);
              setError(null);
              setSuccess(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${
              !isLoginTab
                ? "bg-surface-container-lowest text-primary shadow-sm"
                : "text-outline hover:text-on-surface"
            }`}
          >
            Cadastrar
          </button>
        </div>

        {/* Mensagens de Feedback */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">error</span>
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-secondary-container/40 border border-secondary/30 text-secondary text-xs rounded-lg font-medium flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              Nome de Usuário
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="seu_usuario"
              className="w-full text-xs px-3 py-2.5 bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
            />
          </div>

          {!isLoginTab && (
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                E-mail
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@empresa.com"
                className="w-full text-xs px-3 py-2.5 bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              Senha
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full text-xs px-3 py-2.5 bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-primary-container hover:bg-primary text-on-primary font-semibold py-2.5 px-4 rounded-lg text-xs transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {loading ? (
              <span>Processando...</span>
            ) : isLoginTab ? (
              <>
                <span className="material-symbols-outlined text-[16px]">login</span>
                <span>Entrar na Rede</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">person_add</span>
                <span>Criar Nova Conta</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
