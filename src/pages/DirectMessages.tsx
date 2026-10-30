import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { useSidebar } from '../context/SidebarContext';
import { authStorage, friendsApi, directMessagesApi, Friend, DirectMessage } from '../lib/api';
import { EmptyState } from '../components/EmptyState';

export const DirectMessages: React.FC = () => {
  const navigate = useNavigate();
  const { isExpanded } = useSidebar();
  const user = authStorage.getUser();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [activeFriend, setActiveFriend] = useState<Friend | null>(null);
  const [searchConv, setSearchConv] = useState('');
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(true);

  // Modal para iniciar nova conversa / buscar pessoas
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: number; username: string; friendship_status: string | null }>>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  // Carrega amigos reais do D1
  const loadFriends = async () => {
    if (!user) {
      setLoadingFriends(false);
      return;
    }
    setLoadingFriends(true);
    try {
      const data = await friendsApi.list();
      if (data && data.length > 0) {
        setFriends(data);
        setActiveFriend(data[0]);
      } else {
        setFriends([]);
        setActiveFriend(null);
      }
    } catch (err) {
      console.error('Erro ao carregar amigos:', err);
      setFriends([]);
    } finally {
      setLoadingFriends(false);
    }
  };

  useEffect(() => {
    loadFriends();
  }, [user]);

  // Carrega histórico de mensagens do amigo ativo
  useEffect(() => {
    if (activeFriend && user) {
      setLoadingChat(true);
      directMessagesApi
        .list(activeFriend.friend_id)
        .then((data) => {
          setMessages(data || []);
        })
        .catch((err) => {
          console.error('Erro ao carregar mensagens:', err);
          setMessages([]);
        })
        .finally(() => setLoadingChat(false));
    }
  }, [activeFriend, user]);

  // Envio de mensagem
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeFriend || !user) return;

    const content = inputText.trim();
    setInputText('');

    try {
      const created = await directMessagesApi.send({
        receiver_id: activeFriend.friend_id,
        content,
      });
      setMessages((prev) => [...prev, created]);
    } catch (err: any) {
      console.error('Erro ao enviar mensagem:', err);
    }
  };

  // Busca de usuários no modal de nova conversa
  useEffect(() => {
    if (!userSearchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const results = await friendsApi.search(userSearchQuery.trim());
        setSearchResults(results || []);
      } catch (err) {
        console.error('Erro ao buscar usuários:', err);
      } finally {
        setSearchingUsers(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [userSearchQuery]);

  const handleStartChatWithUser = async (targetUser: { id: number; username: string }) => {
    // Adiciona como amigo caso ainda não seja
    try {
      await friendsApi.add(targetUser.id, targetUser.username);
    } catch {
      // Já pode ser amigo
    }
    const newFriend: Friend = {
      friend_id: targetUser.id,
      username: targetUser.username,
      status: 'accepted',
      online: true,
    };
    setFriends((prev) => {
      const exists = prev.some((f) => f.friend_id === targetUser.id);
      return exists ? prev : [newFriend, ...prev];
    });
    setActiveFriend(newFriend);
    setShowNewChatModal(false);
    setUserSearchQuery('');
  };

  const filteredConversations = friends.filter((c) =>
    c.username.toLowerCase().includes(searchConv.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <Header />
      <SidebarNav />

      <div
        className={`pt-16 flex-1 flex flex-col transition-all duration-300 ease-in-out ${
          isExpanded ? 'pl-0 md:pl-64' : 'pl-0 md:pl-[72px]'
        }`}
      >
        <main className="w-full flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
          {/* Se o usuário não estiver logado */}
          {!user ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <EmptyState
                icon="lock"
                title="Acesse o Direct do Espectro"
                description="Faça login com sua conta para conversar em tempo real com seus amigos e gerenciar conversas privadas."
                actionLabel="Entrar ou Cadastrar"
                actionLink="/login"
                className="max-w-md w-full"
              />
            </div>
          ) : loadingFriends ? (
            /* Loading State */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-on-surface-variant gap-3">
              <span className="material-symbols-outlined text-[36px] text-primary animate-spin">
                progress_activity
              </span>
              <p className="text-sm font-medium">Sintonizando suas conversas privadas...</p>
            </div>
          ) : friends.length === 0 ? (
            /* ================================================================= */
            /* BLANK PAGE PARA O CHAT (quando não há conversas existentes)        */
            /* ================================================================= */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface">
              <div className="flex flex-col items-center gap-2.5 max-w-sm">
                <span className="material-symbols-outlined text-[48px] text-on-surface-variant/30 mb-1">
                  chat_bubble_outline
                </span>
                <h1 className="text-xl font-bold text-on-surface">Não há conversas</h1>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Suas mensagens diretas aparecerão aqui quando você iniciar uma nova conversa.
                </p>
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(true)}
                  className="mt-3 px-5 py-2.5 rounded-full bg-primary-container text-on-primary font-semibold text-xs hover:bg-primary shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  <span>Nova Conversa</span>
                </button>
              </div>
            </div>
          ) : (
            /* ================================================================= */
            /* LAYOUT COM CONVERSAS REAIS EXISTENTES                              */
            /* ================================================================= */
            <div className="flex flex-1 w-full h-full overflow-hidden bg-surface">
              {/* COLUNA 1: Diretório Direct */}
              <aside className="w-80 lg:w-96 flex-shrink-0 flex flex-col bg-surface-container-lowest border-r border-outline-variant/30 shadow-xs z-10">
                <div className="p-4 pb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-bold text-base text-on-surface truncate">
                      @{user.username}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNewChatModal(true)}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-container-low text-on-surface hover:bg-primary-container hover:text-on-primary transition-colors cursor-pointer"
                    title="Nova Conversa"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit_square</span>
                  </button>
                </div>

                <div className="px-4 pb-2">
                  <div className="relative flex items-center w-full">
                    <span className="material-symbols-outlined absolute left-3 text-on-surface-variant text-[18px] pointer-events-none">
                      search
                    </span>
                    <input
                      type="text"
                      value={searchConv}
                      onChange={(e) => setSearchConv(e.target.value)}
                      placeholder="Pesquisar conversas..."
                      className="w-full h-9 pl-9 pr-3 bg-surface-container-low text-on-surface placeholder:text-on-surface-variant rounded-full text-xs focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary-container outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Lista de Conversas / Amigos */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {filteredConversations.length === 0 ? (
                    <div className="text-center py-8 px-4 text-xs text-on-surface-variant">
                      <span className="material-symbols-outlined text-[28px] text-on-surface-variant/40 mb-1">
                        search_off
                      </span>
                      <p className="font-semibold text-on-surface">Nenhum resultado</p>
                      <p className="mt-1 text-[11px]">Nenhum amigo encontrado com essa busca.</p>
                    </div>
                  ) : (
                    filteredConversations.map((c) => (
                      <div
                        key={c.friend_id}
                        onClick={() => setActiveFriend(c)}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                          activeFriend?.friend_id === c.friend_id
                            ? 'bg-surface-container-low border border-outline-variant/30 shadow-xs'
                            : 'hover:bg-surface-container-low/60'
                        }`}
                      >
                        <div className="relative flex-shrink-0">
                          <div className="w-11 h-11 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-sm uppercase">
                            {c.username.charAt(0)}
                          </div>
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-surface-container-lowest" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-on-surface truncate">
                              @{c.username}
                            </span>
                            <span className="text-[11px] text-emerald-600 font-medium">
                              online
                            </span>
                          </div>
                          <p className="text-xs text-on-surface-variant truncate mt-0.5">
                            {c.mood || 'Disponível no Direct'}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </aside>

              {/* COLUNA 2: Conversa Ativa */}
              <section className="flex-1 flex flex-col bg-surface min-w-0 relative">
                {!activeFriend ? (
                  <div className="flex-1 flex items-center justify-center p-8">
                    <EmptyState
                      icon="forum"
                      title="Nenhum sussurro por aqui."
                      description="Selecione um contato na lista à esquerda para iniciar o bate-papo."
                      className="max-w-md w-full"
                    />
                  </div>
                ) : (
                  <>
                    <div className="h-16 px-6 bg-surface-container-lowest border-b border-outline-variant/30 flex items-center justify-between shadow-xs z-10 flex-shrink-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-sm uppercase">
                            {activeFriend.username.charAt(0)}
                          </div>
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-surface-container-lowest" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h2 className="font-semibold text-sm text-on-surface truncate">
                              @{activeFriend.username}
                            </h2>
                          </div>
                          <p className="text-[11px] text-emerald-600 font-medium">
                            {activeFriend.mood || 'Online no Espectro'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Histórico */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      <div className="flex items-center justify-center">
                        <span className="text-[11px] text-on-surface-variant bg-surface-container-low px-3 py-1 rounded-full uppercase tracking-wider font-medium">
                          Conversa privada criptografada
                        </span>
                      </div>

                      {loadingChat ? (
                        <div className="text-center py-8 text-xs text-on-surface-variant">
                          <span className="material-symbols-outlined text-[24px] text-primary animate-spin">
                            progress_activity
                          </span>
                          <p className="mt-1">Carregando mensagens...</p>
                        </div>
                      ) : messages.length === 0 ? (
                        <div className="py-8">
                          <EmptyState
                            icon="waving_hand"
                            title={`Diga olá para @${activeFriend.username}!`}
                            description="Nenhuma mensagem foi trocada ainda. Quebre o gelo enviando a primeira mensagem."
                            className="max-w-md mx-auto"
                          />
                        </div>
                      ) : (
                        messages.map((m) => {
                          const isMe = m.sender_id === user.id;
                          return (
                            <div
                              key={m.id}
                              className={`flex items-end gap-2 max-w-xl ${
                                isMe ? 'ml-auto justify-end' : 'mr-auto justify-start'
                              }`}
                            >
                              {!isMe && (
                                <div className="w-7 h-7 rounded-full bg-primary-container text-on-primary font-bold flex items-center justify-center text-xs flex-shrink-0 mb-1">
                                  {activeFriend.username.charAt(0)}
                                </div>
                              )}
                              <div className="flex flex-col">
                                <div
                                  className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                                    isMe
                                      ? 'bg-primary-container text-on-primary rounded-br-xs'
                                      : 'bg-surface-container-low text-on-surface rounded-bl-xs border border-outline-variant/30'
                                  }`}
                                >
                                  {m.content}
                                </div>
                                <span
                                  className={`text-[10px] text-on-surface-variant mt-1 ${
                                    isMe ? 'text-right mr-1' : 'ml-1'
                                  }`}
                                >
                                  {new Date(m.created_at).toLocaleTimeString('pt-BR', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Input */}
                    <div className="p-4 bg-surface-container-lowest border-t border-outline-variant/30 flex-shrink-0">
                      <form
                        onSubmit={handleSendMessage}
                        className="flex items-center gap-2 bg-surface-container-low rounded-full px-4 py-1.5 border border-outline-variant/30"
                      >
                        <input
                          type="text"
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          placeholder={`Mensagem para @${activeFriend.username}...`}
                          className="flex-1 bg-transparent border-0 outline-none text-xs text-on-surface placeholder:text-on-surface-variant px-2"
                        />
                        <button
                          type="submit"
                          disabled={!inputText.trim()}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-primary disabled:opacity-40 hover:bg-surface-container transition-all cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[20px]">send</span>
                        </button>
                      </form>
                    </div>
                  </>
                )}
              </section>
            </div>
          )}
        </main>
      </div>

      {/* MODAL: Nova Conversa / Buscar Amigos */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">person_search</span>
                <h3 className="font-bold text-base text-on-surface">Buscar Amigos no Espectro</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewChatModal(false)}
                className="p-1.5 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none">
                search
              </span>
              <input
                type="text"
                autoFocus
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Digitar nome de usuário..."
                className="w-full pl-10 pr-4 py-2.5 rounded-full bg-surface-container-low border border-outline-variant/40 text-on-surface text-xs focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container outline-none transition-all"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {searchingUsers ? (
                <div className="text-center py-6 text-xs text-on-surface-variant">
                  <span className="material-symbols-outlined text-[22px] text-primary animate-spin">
                    progress_activity
                  </span>
                  <p className="mt-1">Procurando usuários...</p>
                </div>
              ) : userSearchQuery.trim() && searchResults.length === 0 ? (
                <div className="text-center py-6 text-xs text-on-surface-variant">
                  <p className="font-medium">Nenhum usuário encontrado com "{userSearchQuery}".</p>
                </div>
              ) : (
                searchResults.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-surface-container-low/60 hover:bg-surface-container transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary font-bold flex items-center justify-center text-xs uppercase">
                        {u.username.charAt(0)}
                      </div>
                      <span className="text-xs font-semibold text-on-surface truncate">
                        @{u.username}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleStartChatWithUser(u)}
                      className="px-3.5 py-1.5 rounded-full bg-primary-container text-on-primary font-semibold text-xs hover:bg-primary transition-all cursor-pointer shadow-xs"
                    >
                      Conversar
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
