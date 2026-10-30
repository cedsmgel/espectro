import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { useSidebar } from '../context/SidebarContext';
import { authStorage, friendsApi, directMessagesApi, Friend, DirectMessage } from '../lib/api';
import { EmptyState } from '../components/EmptyState';

export const DirectMessages: React.FC = () => {
  const { isExpanded } = useSidebar();
  const user = authStorage.getUser();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [activeFriend, setActiveFriend] = useState<Friend | null>(null);
  const [searchConv, setSearchConv] = useState('');
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(true);

  // Carrega amigos reais do D1
  useEffect(() => {
    if (user) {
      setLoadingFriends(true);
      friendsApi.list()
        .then((data) => {
          if (data && data.length > 0) {
            setFriends(data);
            setActiveFriend(data[0]);
          } else {
            setFriends([]);
            setActiveFriend(null);
          }
        })
        .catch((err) => {
          console.error('Erro ao carregar amigos:', err);
          setFriends([]);
        })
        .finally(() => setLoadingFriends(false));
    } else {
      setLoadingFriends(false);
    }
  }, [user]);

  // Carrega mensagens do amigo ativo
  useEffect(() => {
    if (activeFriend && user) {
      setLoadingChat(true);
      directMessagesApi.list(activeFriend.friend_id)
        .then((data) => {
          setMessages(data);
        })
        .catch(console.error)
        .finally(() => setLoadingChat(false));
    }
  }, [activeFriend, user]);

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
          <div className="flex flex-1 w-full h-full overflow-hidden bg-surface">
            {/* COLUNA 1: Diretório Direct */}
            <aside className="w-80 lg:w-96 flex-shrink-0 flex flex-col bg-surface-container-lowest border-r border-outline-variant/30 shadow-xs z-10">
              <div className="p-4 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-base text-on-surface">
                    @{user ? user.username : 'visitante'}
                  </span>
                  <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                    expand_more
                  </span>
                </div>
                <button
                  type="button"
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
                {loadingFriends ? (
                  <div className="text-center py-8 text-xs text-on-surface-variant">
                    <span className="material-symbols-outlined text-[20px] text-primary animate-spin">progress_activity</span>
                    <p className="mt-1">Carregando contatos...</p>
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="text-center py-8 px-4 text-xs text-on-surface-variant">
                    <span className="material-symbols-outlined text-[28px] text-on-surface-variant/40 mb-1">chat_bubble_outline</span>
                    <p className="font-semibold text-on-surface">Nenhum amigo ainda</p>
                    <p className="mt-1 text-[11px]">Abra a gaveta de contatos para pesquisar e adicionar amigos.</p>
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
                    icon="chat_bubble_outline"
                    title="Nenhum sussurro por aqui."
                    description="Suas conversas privadas aparecerão aqui. Vá até o perfil de um amigo e envie um recado."
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
                          <span className="material-symbols-outlined text-primary text-[16px]">verified</span>
                        </div>
                        <p className="text-[11px] text-emerald-600 font-medium">
                          {activeFriend.mood || 'Online agora no Espectro'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-on-surface-variant">
                      <button type="button" aria-label="Chamada" className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-surface-container transition-colors">
                        <span className="material-symbols-outlined text-[20px]">call</span>
                      </button>
                      <button type="button" aria-label="Vídeo" className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-surface-container transition-colors">
                        <span className="material-symbols-outlined text-[20px]">videocam</span>
                      </button>
                      <button type="button" aria-label="Info" className="w-9 h-9 rounded-full flex items-center justify-center bg-surface-container-low text-primary hover:bg-primary-container hover:text-on-primary transition-colors">
                        <span className="material-symbols-outlined text-[20px]">info</span>
                      </button>
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
                    <span className="material-symbols-outlined text-[24px] text-primary animate-spin">progress_activity</span>
                    <p className="mt-1">Carregando mensagens...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-8">
                    <EmptyState
                      icon="forum"
                      title="Nenhum sussurro por aqui."
                      description="Suas conversas privadas aparecerão aqui. Vá até o perfil de um amigo e envie um recado."
                      className="max-w-md mx-auto"
                    />
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMe = user ? m.sender_id === user.id : false;
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
                          <span className={`text-[10px] text-on-surface-variant mt-1 ${isMe ? 'text-right mr-1' : 'ml-1'}`}>
                            {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

                  {/* Input */}
                  <div className="p-4 bg-surface-container-lowest border-t border-outline-variant/30 flex-shrink-0">
                    <form onSubmit={handleSendMessage} className="flex items-center gap-2 bg-surface-container-low rounded-full px-4 py-1.5 border border-outline-variant/30">
                      <button type="button" title="Imagem" className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
                        <span className="material-symbols-outlined text-[20px]">image</span>
                      </button>
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

            {/* COLUNA 3: Perfil do Contato */}
            {activeFriend && (
              <aside className="w-72 flex-shrink-0 bg-surface-container-lowest border-l border-outline-variant/30 hidden xl:flex flex-col p-6 overflow-y-auto">
                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-3">
                    <div className="w-20 h-20 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-2xl uppercase shadow-md">
                      {activeFriend.username.charAt(0)}
                    </div>
                    <span className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 rounded-full ring-2 ring-surface-container-lowest" />
                  </div>
                  <h3 className="font-bold text-base text-on-surface flex items-center justify-center gap-1">
                    @{activeFriend.username}
                    <span className="material-symbols-outlined text-primary text-[18px]">verified</span>
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">{activeFriend.mood || 'Amigo no Espectro'}</p>
                  <button
                    type="button"
                    className="mt-4 w-full h-9 rounded-xl bg-surface-container-high text-on-surface font-semibold text-xs hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">person</span>
                    <span>Ver Perfil</span>
                  </button>
                </div>
              </aside>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
