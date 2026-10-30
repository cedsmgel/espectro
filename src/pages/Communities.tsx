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
    <div className="w-full pt-20 pb-16 bg-background">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8">
        {/* Barra de Título e Ação */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-6 border-b border-outline-variant/30">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-[24px] text-primary">forum</span>
              <h1 className="text-xl font-bold text-primary">Comunidades & Círculos do Espectro</h1>
            </div>
            <p className="text-xs text-on-surface-variant">
              Espaços de discussão, trocas técnicas, design e interesses coletivos.
            </p>
          </div>

          {currentUser ? (
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="bg-primary-container hover:bg-primary text-on-primary text-xs font-semibold px-4 py-2 rounded-lg transition shadow-sm flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>{showCreateForm ? "Fechar Formulário" : "Criar Comunidade"}</span>
            </button>
          ) : (
            <Link
              to="/login"
              className="bg-primary-container hover:bg-primary text-on-primary text-xs font-semibold px-4 py-2 rounded-lg transition shadow-sm"
            >
              Entrar para Criar Comunidade
            </Link>
          )}
        </div>

        {/* Feedback */}
        {feedbackMsg && (
          <div className="mb-6 p-3 bg-secondary-container/40 border border-secondary/30 text-secondary text-xs rounded-xl flex justify-between items-center">
            <span className="font-medium">✨ {feedbackMsg}</span>
            <button
              onClick={() => setFeedbackMsg(null)}
              className="text-secondary hover:text-on-surface font-bold text-sm"
            >
              ✕
            </button>
          </div>
        )}

        {/* Formulário de Criação (Expansível) */}
        {showCreateForm && (
          <div className="rounded-xl p-6 mb-8 bg-surface-container-lowest border border-outline-variant/30 shadow-md">
            <h2 className="text-sm font-bold text-primary mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">group_add</span>
              Criar Nova Comunidade
            </h2>

            {formError && (
              <div className="mb-3 p-2 bg-red-50 text-red-600 border border-red-200 text-xs rounded-lg">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateCommunity} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">
                  Nome da Comunidade *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Design Systems Brasil ou Modelos Locais IA"
                  className="w-full text-xs px-3 py-2.5 rounded-lg bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">
                  Descrição
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Conte o objetivo, tópicos abordados e regras desta comunidade..."
                  className="w-full text-xs px-3 py-2.5 rounded-lg bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating || !name.trim()}
                  className="bg-primary-container hover:bg-primary text-on-primary text-xs font-semibold px-4 py-2 rounded-lg transition shadow-sm disabled:opacity-50"
                >
                  {creating ? "Salvando..." : "Criar Comunidade"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Grid de Comunidades */}
        {loading ? (
          <div className="rounded-xl p-12 bg-surface-container-lowest border border-outline-variant/30 text-center text-xs text-outline">
            Carregando comunidades da rede...
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 text-xs text-red-600 rounded-xl text-center">
            {error}
          </div>
        ) : communities.length === 0 ? (
          <div className="rounded-xl p-12 bg-surface-container-lowest border border-outline-variant/30 text-center text-xs text-outline">
            Nenhuma comunidade criada ainda. Seja o primeiro a criar um círculo de discussão!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
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
    </div>
  );
};
