import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { useSidebar } from '../context/SidebarContext';
import { authStorage, profileApi, uploadApi, UserProfile } from '../lib/api';
import { EmptyState } from '../components/EmptyState';

export const ProfileSettings: React.FC = () => {
  const navigate = useNavigate();
  const { isExpanded } = useSidebar();
  const loggedUser = authStorage.getUser();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Campos do formulário
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Estados de feedback
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carrega os dados reais do perfil a partir do backend D1
  useEffect(() => {
    if (!loggedUser) {
      setLoading(false);
      return;
    }

    const loadProfileData = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const data = await profileApi.get();
        setName(data.name || '');
        setUsername(data.username || '');
        setEmail(data.email || '');
        setBio(data.bio || '');
        setAvatarUrl(data.avatar_url || null);
      } catch (err: any) {
        console.error('Erro ao carregar perfil:', err);
        setErrorMessage(err.message || 'Falha ao carregar seus dados de perfil.');
      } finally {
        setLoading(false);
      }
    };

    loadProfileData();
  }, [loggedUser?.id]);

  // Upload de nova foto de perfil para o Cloudflare R2
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('A imagem deve ter no máximo 10MB.');
      return;
    }

    setUploading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await uploadApi.upload(file);
      setAvatarUrl(res.url);
      setSuccessMessage('Foto carregada com sucesso! Clique em "Salvar Alterações" para confirmar.');
    } catch (err: any) {
      console.error('Erro no upload da foto:', err);
      setErrorMessage(err.message || 'Erro ao enviar a imagem para o servidor.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Remover foto atual
  const handleRemovePhoto = () => {
    setAvatarUrl(null);
    setSuccessMessage('Foto removida. Clique em "Salvar Alterações" para confirmar.');
  };

  // Salvar alterações via PUT /api/profile
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanUsername = username.trim();
    if (!cleanUsername || cleanUsername.length < 3 || cleanUsername.length > 30) {
      setErrorMessage('O nome de usuário deve ter entre 3 e 30 caracteres.');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      setErrorMessage('O nome de usuário só pode conter letras, números e underlines.');
      return;
    }

    setSaving(true);
    try {
      const result = await profileApi.update({
        name: name.trim() || null,
        username: cleanUsername,
        bio: bio.trim() || null,
        avatar_url: avatarUrl,
      });

      // Atualiza token JWT se o username tiver mudado
      if (result.token) {
        authStorage.setToken(result.token);
      }

      // Atualiza usuário no localStorage
      authStorage.setUser({
        id: result.user.id,
        username: result.user.username,
        name: result.user.name,
        avatar_url: result.user.avatar_url,
        bio: result.user.bio,
      });

      setSuccessMessage('Perfil atualizado com sucesso no Espectro!');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('Erro ao atualizar perfil:', err);
      setErrorMessage(err.message || 'Falha ao salvar as alterações do perfil.');
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
            icon="account_circle"
            title="Acesse suas configurações"
            description="Faça login com sua conta para gerenciar e editar seu perfil público no Espectro."
            actionLabel="Entrar ou Cadastrar"
            actionLink="/login"
            className="max-w-md w-full"
          />
        </div>
      </div>
    );
  }

  const initialLetter = (name.trim() || username || 'U').charAt(0).toUpperCase();

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
          <div className="w-full max-w-3xl mx-auto px-4 sm:px-6">
            {/* Header da Página */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-on-surface tracking-tight flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[28px]">
                    manage_accounts
                  </span>
                  Configurações de Perfil
                </h1>
                <p className="text-xs text-on-surface-variant mt-1">
                  Gerencie sua identidade visual, nome público e biografia no Espectro.
                </p>
              </div>

              <Link
                to={`/u/${username || loggedUser.username}`}
                className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface-container-low text-on-surface hover:bg-surface-container hover:text-primary text-xs font-semibold transition-colors border border-outline-variant"
              >
                <span className="material-symbols-outlined text-[16px]">visibility</span>
                <span>Ver Perfil</span>
              </Link>
            </div>

            {/* Card Principal do Formulário */}
            <div className="bg-surface-container-lowest rounded-3xl p-6 sm:p-8 border border-outline-variant shadow-xs">
              {loading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[36px] text-primary animate-spin">
                    progress_activity
                  </span>
                  <p className="text-sm font-medium">Carregando dados do seu perfil...</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                  {/* Alertas de Sucesso e Erro */}
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

                  {/* 1. SEÇÃO DE FOTO DE PERFIL / AVATAR */}
                  <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-outline-variant">
                    <div className="relative group shrink-0">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt="Avatar do Usuário"
                          className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover shadow-sm ring-4 ring-surface-container-low"
                        />
                      ) : (
                        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-primary to-secondary text-on-primary flex items-center justify-center font-bold text-3xl sm:text-4xl uppercase shadow-sm ring-4 ring-surface-container-low">
                          {initialLetter}
                        </div>
                      )}

                      {/* Botão overlay para upload */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="absolute inset-0 rounded-full bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Trocar foto"
                      >
                        <span className="material-symbols-outlined text-[24px]">
                          {uploading ? 'progress_activity' : 'photo_camera'}
                        </span>
                        <span className="text-[10px] font-semibold mt-0.5">
                          {uploading ? 'Enviando...' : 'Alterar'}
                        </span>
                      </button>

                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handlePhotoSelect}
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                      />
                    </div>

                    <div className="flex flex-col gap-2.5 text-center sm:text-left flex-1 min-w-0">
                      <div>
                        <h3 className="font-bold text-sm text-on-surface">Foto de Perfil</h3>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          Sua foto será exibida no feed, nos comentários e no seu mural. PNG, JPG ou WEBP de até 10MB.
                        </p>
                      </div>

                      <div className="flex items-center justify-center sm:justify-start gap-2.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="px-4 py-2 rounded-full bg-primary-container text-on-primary font-semibold text-xs hover:bg-primary transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {uploading ? 'progress_activity' : 'cloud_upload'}
                          </span>
                          <span>{uploading ? 'Enviando foto...' : 'Fazer Upload'}</span>
                        </button>

                        {avatarUrl && (
                          <button
                            type="button"
                            onClick={handleRemovePhoto}
                            disabled={uploading}
                            className="px-3.5 py-2 rounded-full bg-surface-container-low text-on-surface-variant hover:text-error hover:bg-error-container/20 font-semibold text-xs transition-colors cursor-pointer"
                          >
                            Remover Foto
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 2. CAMPOS DO FORMULÁRIO */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Nome de Exibição */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-primary">badge</span>
                        Nome de Exibição
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: Carlos Eduardo"
                        maxLength={50}
                        className="w-full px-4 py-2.5 rounded-2xl bg-surface-container-low border border-outline-variant text-on-surface text-xs placeholder:text-on-surface-variant focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container outline-none transition-all"
                      />
                      <p className="text-[10px] text-on-surface-variant">
                        Como você quer ser chamado no seu perfil.
                      </p>
                    </div>

                    {/* Nome de Usuário (@handle) */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-primary">alternate_email</span>
                        Nome de Usuário (@)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-xs font-semibold">
                          @
                        </span>
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                          placeholder="seu_usuario"
                          maxLength={30}
                          required
                          className="w-full pl-8 pr-4 py-2.5 rounded-2xl bg-surface-container-low border border-outline-variant text-on-surface text-xs placeholder:text-on-surface-variant focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container outline-none transition-all"
                        />
                      </div>
                      <p className="text-[10px] text-on-surface-variant">
                        Identificador único para menções e URL pública (/u/{username || 'usuario'}).
                      </p>
                    </div>
                  </div>

                  {/* E-mail (somente leitura) */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant">mail</span>
                      Endereço de E-mail
                    </label>
                    <input
                      type="email"
                      value={email}
                      disabled
                      className="w-full px-4 py-2.5 rounded-2xl bg-surface-container-low/50 border border-outline-variant text-on-surface-variant text-xs cursor-not-allowed select-none"
                    />
                    <p className="text-[10px] text-on-surface-variant">
                      O e-mail da sua conta não é exibido publicamente.
                    </p>
                  </div>

                  {/* Biografia / Recado do Perfil */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-primary">edit_note</span>
                        Biografia / Sobre Você
                      </label>
                      <span className="text-[10px] text-on-surface-variant">
                        {bio.length}/160 caracteres
                      </span>
                    </div>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Conte um pouco sobre você, seus interesses e hobbies no Espectro..."
                      rows={3}
                      maxLength={160}
                      className="w-full px-4 py-3 rounded-2xl bg-surface-container-low border border-outline-variant text-on-surface text-xs placeholder:text-on-surface-variant focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container outline-none transition-all resize-none"
                    />
                  </div>

                  {/* Botões de Ação */}
                  <div className="pt-4 border-t border-outline-variant flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => navigate(`/u/${username || loggedUser.username}`)}
                      className="px-5 py-2.5 rounded-full bg-surface-container-low text-on-surface hover:bg-surface-container text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>

                    <button
                      type="submit"
                      disabled={saving || uploading}
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
                          <span>Salvar Alterações</span>
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
