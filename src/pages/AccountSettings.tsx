import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { useSidebar } from '../context/SidebarContext';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { authStorage, accountApi } from '../lib/api';
import { EmptyState } from '../components/EmptyState';

export const AccountSettings: React.FC = () => {
  const navigate = useNavigate();
  const { isExpanded } = useSidebar();
  const isAdmin = useIsAdmin();
  const loggedUser = authStorage.getUser();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [allowScraps, setAllowScraps] = useState(true);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Carrega configurações atuais da conta via GET /api/users/settings
  useEffect(() => {
    if (!loggedUser) {
      setLoading(false);
      return;
    }

    const loadSettings = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const settings = await accountApi.getSettings();
        setIsPrivate(settings.is_private);
        setAllowScraps(settings.allow_scraps);
      } catch (err: any) {
        console.error('Erro ao carregar configurações da conta:', err);
        setErrorMessage(err.message || 'Falha ao buscar suas preferências de conta.');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [loggedUser?.id]);

  // Salva alterações via PUT /api/users/settings
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await accountApi.updateSettings({
        is_private: isPrivate,
        allow_scraps: allowScraps,
      });

      setIsPrivate(res.settings.is_private);
      setAllowScraps(res.settings.allow_scraps);

      setSuccessMessage('Preferências de privacidade atualizadas com sucesso!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('Erro ao atualizar configurações da conta:', err);
      setErrorMessage(err.message || 'Erro ao salvar preferências no servidor.');
    } finally {
      setSaving(false);
    }
  };

  if (!loggedUser) {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex flex-col">
        <Header />
        <SidebarNav />
        <div
          className={`pt-16 md:pt-0 flex-1 flex items-center justify-center p-6 transition-all duration-300 ease-in-out ${
            isExpanded ? 'pl-0 md:pl-20' : 'pl-0 md:pl-20'
          }`}
        >
          <EmptyState
            icon="shield"
            title="Acesse suas preferências de conta"
            description="Faça login com sua conta para gerenciar as permissões de privacidade e segurança do seu perfil no Espectro."
            actionLabel="Entrar ou Cadastrar"
            actionLink="/login"
            className="max-w-md w-full"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <Header />
      <SidebarNav />

      <div
        className={`pt-16 md:pt-0 min-h-screen flex flex-col transition-all duration-300 ease-in-out ${
          isExpanded ? 'pl-0 md:pl-20' : 'pl-0 md:pl-20'
        }`}
      >
        <main className="w-full bg-surface py-8">
          <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 flex flex-col gap-6">
            {/* Cabeçalho da Página com Abas de Navegação */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-on-surface tracking-tight flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[28px]">
                    shield
                  </span>
                  Configurações da Conta
                </h1>
                <p className="text-xs text-on-surface-variant mt-1">
                  Gerencie sua privacidade, visibilidade de posts e regras para envio de scraps.
                </p>
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-error hover:underline"
                  >
                    <span className="material-symbols-outlined text-[16px]">gavel</span>
                    Abrir moderação
                  </Link>
                )}
              </div>

              {/* Links de navegação entre configurações */}
              <div className="flex items-center gap-2 bg-surface-container-low p-1 rounded-full border border-outline-variant self-start sm:self-auto">
                <Link
                  to="/settings/profile"
                  className="px-4 py-1.5 rounded-full text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  Perfil
                </Link>
                <span className="px-4 py-1.5 rounded-full text-xs font-semibold bg-primary-container text-on-primary shadow-xs">
                  Privacidade
                </span>
              </div>
            </div>

            {/* Card Principal */}
            <div className="bg-surface-container-lowest rounded-3xl p-6 sm:p-8 border border-outline-variant shadow-xs">
              {loading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[36px] text-primary animate-spin">
                    progress_activity
                  </span>
                  <p className="text-sm font-medium">Carregando preferências de privacidade...</p>
                </div>
              ) : (
                <form onSubmit={handleSave} className="flex flex-col gap-6">
                  {/* Feedback Messages */}
                  {successMessage && (
                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-medium flex items-center gap-2.5 animate-in fade-in">
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                      <span>{successMessage}</span>
                    </div>
                  )}

                  {errorMessage && (
                    <div className="p-4 rounded-2xl bg-error-container/20 border border-error/20 text-error text-xs font-medium flex items-center gap-2.5 animate-in fade-in">
                      <span className="material-symbols-outlined text-[18px]">error</span>
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* SEÇÃO 1: PRIVACIDADE DO PERFIL */}
                  <div className="flex flex-col gap-4">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">lock</span>
                      Visibilidade & Privacidade
                    </h2>

                    {/* Toggle: Perfil Privado */}
                    <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-surface-container-low border border-outline-variant hover:border-outline-variant/40 transition-colors">
                      <div className="flex items-start gap-3.5">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            isPrivate
                              ? 'bg-primary-container text-on-primary'
                              : 'bg-surface-container text-on-surface-variant'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[20px]">
                            {isPrivate ? 'lock' : 'lock_open'}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-on-surface">
                            Perfil Privado
                          </span>
                          <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                            Quando ativado, apenas amigos aceitos poderão visualizar suas publicações,
                            scraps e mídias no seu perfil público. Para os demais visitantes, o mural
                            ficará bloqueado.
                          </p>
                        </div>
                      </div>

                      {/* Switch Toggle */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isPrivate}
                        onClick={() => setIsPrivate((prev) => !prev)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                          isPrivate ? 'bg-primary' : 'bg-surface-container-high'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                            isPrivate ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Toggle: Permitir Scraps de Estranhos */}
                    <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-surface-container-low border border-outline-variant hover:border-outline-variant/40 transition-colors">
                      <div className="flex items-start gap-3.5">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            allowScraps
                              ? 'bg-secondary-container text-on-secondary-container'
                              : 'bg-surface-container text-on-surface-variant'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[20px]">
                            auto_stories
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-on-surface">
                            Permitir Scraps de Estranhos
                          </span>
                          <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                            Permite que qualquer pessoa envie recados e scraps no seu mural,
                            mesmo que ainda não façam parte da sua lista de amigos confirmados.
                          </p>
                        </div>
                      </div>

                      {/* Switch Toggle */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={allowScraps}
                        onClick={() => setAllowScraps((prev) => !prev)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                          allowScraps ? 'bg-primary' : 'bg-surface-container-high'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                            allowScraps ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Informações da Conta */}
                  <div className="pt-4 border-t border-outline-variant flex flex-col gap-2">
                    <h3 className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                        info
                      </span>
                      Sobre a Segurança no Espectro
                    </h3>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      Suas mensagens diretas já são privadas e criptografadas em trânsito.
                      Ao habilitar o <strong>Perfil Privado</strong>, suas fotos, vídeos e postagens
                      ficam visíveis única e exclusivamente aos usuários que você aceitou como amigos.
                    </p>
                  </div>

                  {/* Botões de Ação */}
                  <div className="pt-4 border-t border-outline-variant flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => navigate(`/u/${loggedUser.username}`)}
                      className="px-5 py-2.5 rounded-full bg-surface-container-low text-on-surface hover:bg-surface-container text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Voltar ao Perfil
                    </button>

                    <button
                      type="submit"
                      disabled={saving}
                      className="px-6 py-2.5 rounded-full bg-primary-container text-on-primary hover:bg-primary text-xs font-semibold transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <span className="material-symbols-outlined text-[16px] animate-spin">
                            progress_activity
                          </span>
                          <span>Salvando...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[16px]">save</span>
                          <span>Salvar Preferências</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
