import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Community, getCommunities, createCommunity, joinCommunity, getCurrentUser } from "../lib/api";
import { CommunityCard } from "../components/CommunityCard";

export const Communities: React.FC = () => {
  const currentUser = getCurrentUser();

  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Criação de comunidade
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Status de adesão
  const [joiningId, setJoiningId] = useState<number | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const loadCommunities = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCommunities();
      setCommunities(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar comunidades.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCommunities();
  }, []);

  const handleCreateCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    setFormError(null);

    try {
      await createCommunity(name, description);
      setName("");
      setDescription("");
      setShowCreateForm(false);
      setFeedbackMsg("Comunidade criada com sucesso!");
      await loadCommunities();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao criar comunidade.";
      setFormError(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (id: number) => {
    if (!currentUser) {
      setFeedbackMsg("Faça login para participar das comunidades.");
      return;
    }

    setJoiningId(id);
    try {
      const res = await joinCommunity(id);
      setFeedbackMsg(res.message || "Você agora participa desta comunidade!");
      await loadCommunities();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao entrar na comunidade.";
      setFeedbackMsg(msg);
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Barra de Título e Ação */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#bfd4f2] pb-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#2d4373]">
            Comunidades do Espectro
          </h1>
          <p className="text-xs text-gray-600">
            Encontre pessoas com os mesmos interesses e participe das discussões.
          </p>
        </div>

        {currentUser ? (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-[#3b5998] hover:bg-[#2d4373] text-white text-xs font-bold px-4 py-2 rounded transition shadow-sm"
          >
            {showCreateForm ? "Fechar Formulário" : "+ Criar Nova Comunidade"}
          </button>
        ) : (
          <Link
            to="/login"
            className="bg-[#3b5998] hover:bg-[#2d4373] text-white text-xs font-bold px-4 py-2 rounded transition shadow-sm"
          >
            Entrar para Criar Comunidade
          </Link>
        )}
      </div>

      {/* Mensagem de Feedback Global */}
      {feedbackMsg && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-[#3b5998] text-xs rounded-md flex justify-between items-center">
          <span>ℹ️ {feedbackMsg}</span>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-gray-400 hover:text-gray-600 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Formulário de Criação (Expansível) */}
      {showCreateForm && (
        <div className="bg-white border-2 border-[#bfd4f2] rounded-lg p-5 mb-6 shadow-sm">
          <h2 className="text-sm font-bold text-[#2d4373] mb-3">
            Nova Comunidade
          </h2>

          {formError && (
            <div className="mb-3 p-2 bg-red-50 text-red-600 border border-red-200 text-xs rounded">
              {formError}
            </div>
          )}

          <form onSubmit={handleCreateCommunity} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Nome da Comunidade *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Eu Odeio Acordar Cedo"
                className="w-full text-sm px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#3b5998]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Descrição
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Conte sobre o propósito e regras da comunidade..."
                className="w-full text-sm px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#3b5998]"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded text-xs font-semibold hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={creating || !name.trim()}
                className="bg-[#3b5998] hover:bg-[#2d4373] text-white text-xs font-bold px-4 py-1.5 rounded transition shadow-sm disabled:opacity-50"
              >
                {creating ? "Salvando..." : "Criar Comunidade"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grid de Comunidades */}
      {loading ? (
        <div className="bg-white p-8 rounded-lg border border-[#bfd4f2] text-center text-sm text-gray-500">
          Carregando comunidades...
        </div>
      ) : error ? (
        <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-xs text-red-600 text-center">
          {error}
        </div>
      ) : communities.length === 0 ? (
        <div className="bg-white p-8 rounded-lg border border-[#bfd4f2] text-center text-sm text-gray-500">
          Nenhuma comunidade encontrada. Crie a primeira comunidade do Espectro!
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {communities.map((comm) => (
            <CommunityCard
              key={comm.id}
              community={comm}
              onJoin={handleJoin}
              isJoining={joiningId === comm.id}
            />
          ))}
        </div>
      )}
    </div>
  );
};
