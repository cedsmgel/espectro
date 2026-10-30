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
    <div className="max-w-md mx-auto my-12 px-4">
      <div className="bg-white border-2 border-[#bfd4f2] rounded-xl shadow-md overflow-hidden">
        {/* Cabeçalho do Card */}
        <div className="bg-[#3b5998] text-white p-4 text-center">
          <h1 className="text-xl font-bold tracking-wide">
            Bem-vindo ao <span className="text-[#ea5b88] font-black">Espectro</span>
          </h1>
          <p className="text-xs text-blue-100 mt-1">
            Conecte-se aos seus amigos e reviva as comunidades clássicas.
          </p>
        </div>

        {/* Abas */}
        <div className="flex border-b border-[#bfd4f2] bg-[#e8eef7]">
          <button
            type="button"
            onClick={() => {
              setIsLoginTab(true);
              setError(null);
              setSuccess(null);
            }}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${
              isLoginTab
                ? "bg-white text-[#3b5998] border-b-2 border-[#3b5998]"
                : "text-gray-600 hover:text-gray-900"
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
            className={`flex-1 py-3 text-sm font-bold transition-colors ${
              !isLoginTab
                ? "bg-white text-[#3b5998] border-b-2 border-[#3b5998]"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Criar Conta
          </button>
        </div>

        {/* Mensagens de Feedback */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md font-medium">
              ⚠️ {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded-md font-medium">
              ✅ {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Nome de Usuário
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ex: joaosilva"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-[#3b5998] focus:ring-1 focus:ring-[#3b5998]"
              />
            </div>

            {!isLoginTab && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-[#3b5998] focus:ring-1 focus:ring-[#3b5998]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Senha
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-[#3b5998] focus:ring-1 focus:ring-[#3b5998]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#3b5998] hover:bg-[#2d4373] text-white font-bold py-2.5 px-4 rounded text-sm transition shadow-sm disabled:opacity-50 mt-2"
            >
              {loading
                ? "Processando..."
                : isLoginTab
                ? "Entrar no Espectro"
                : "Cadastrar Nova Conta"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
