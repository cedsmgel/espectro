import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authStorage, friendsApi, Friend } from '../lib/api';
import { EmptyState } from './EmptyState';
import { useChat } from '../hooks/useChat';

interface ContactsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ContactsDrawer: React.FC<ContactsDrawerProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const user = authStorage.getUser();
  const userId = user?.id;

  const [activeTab, setActiveTab] = useState<'friends' | 'search'>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: number; username: string; friendship_status: string | null }>>([]);
  const [searching, setSearching] = useState(false);

  // Conversa ativa dentro da gaveta lateral
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  // Hook de chat em tempo real via WebSocket & Cloudflare Durable Objects
  const {
    messages,
    sendMessage,
    sendTyping,
    isOtherUserTyping,
    connectionStatus,
    loadingHistory: loadingMessages,
    reconnect,
  } = useChat({
    activeFriendId: selectedFriend?.friend_id,
    activeFriendUsername: selectedFriend?.username,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<number | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Carrega lista de amigos reais do D1
  const loadFriends = async () => {
    if (!userId) return;
    setLoadingFriends(true);
    try {
      const data = await friendsApi.list();
      setFriends(data);
    } catch (err) {
      console.error('Erro ao carregar amigos:', err);
    } finally {
      setLoadingFriends(false);
    }
  };

  useEffect(() => {
    if (isOpen && userId) {
      loadFriends();
    }
  }, [isOpen, userId]);

  // Auto-scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOtherUserTyping]);

  // Pesquisa de novos usuários para adicionar
  useEffect(() => {
    if (!searchQuery.trim() || activeTab !== 'search') {
      setSearchResults([]);
      return;
    }

    const delay = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await friendsApi.search(searchQuery.trim());
        setSearchResults(results);
      } catch (err) {
        console.error('Erro ao pesquisar usuários:', err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(delay);
  }, [searchQuery, activeTab]);

  // Enviar mensagem direta privada via WebSocket
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedFriend || !user) return;

    const content = newMessage.trim();
    setNewMessage('');

    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
    }
    sendTyping(false);

    const sent = sendMessage(content);
    if (!sent && connectionStatus !== 'connected') {
      showToast('Reconectando ao chat... aguarde um instante.');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    sendTyping(true);

    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
    }
    typingTimerRef.current = window.setTimeout(() => {
      sendTyping(false);
    }, 2000);
  };

  // Adicionar amigo
  const handleAddFriend = async (friendId: number, username: string) => {
    try {
      await friendsApi.add(friendId, username);
      showToast(`@${username} adicionado aos seus amigos!`);
      loadFriends();
      setActiveTab('friends');
      setSearchQuery('');
    } catch (err: any) {
      showToast(err.message || 'Erro ao adicionar amigo.');
    }
  };

  const displayFriends = friends;

  const filteredFriends = displayFriends.filter((f) =>
    f.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Drawer Lateral */}
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-sm sm:max-w-md bg-surface-container-lowest border-l border-outline-variant/30 shadow-2xl flex flex-col transition-transform duration-300 ease-out transform ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Toast Notifier */}
        {toast && (
          <div className="absolute top-4 left-4 right-4 z-50 p-2.5 rounded-xl bg-on-surface text-surface text-xs font-semibold shadow-lg flex items-center gap-2 animate-in fade-in">
            <span className="material-symbols-outlined text-[16px] text-emerald-400">info</span>
            <span>{toast}</span>
          </div>
        )}

        {/* 1. Topo da Gaveta: Identidade ou Chat Header */}
        <div className="flex items-center justify-between p-4 border-b border-outline-variant/20 bg-surface-container-lowest">
          {selectedFriend ? (
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setSelectedFriend(null)}
                className="p-1 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container cursor-pointer"
                title="Voltar para amigos"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              </button>
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary font-bold flex items-center justify-center text-xs uppercase shadow-xs">
                  {selectedFriend.username.charAt(0)}
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-surface-container-lowest" />
              </div>
              <div className="min-w-0 flex flex-col">
                <span className="text-xs font-bold text-on-surface truncate">
                  @{selectedFriend.username}
                </span>
                <span className="text-[10px] text-emerald-600 font-medium">
                  {selectedFriend.mood || 'Online no Espectro'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary-container text-on-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">chat</span>
              </div>
              <div>
                <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
                  <span>Espectro Direct</span>
                  <span className="text-[10px] font-semibold bg-secondary-container text-on-secondary-container px-2 py-0.2 rounded-full">
                    Privado
                  </span>
                </h2>
                <p className="text-[11px] text-on-surface-variant">Mensagens privadas e amigos</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate('/mensagens');
              }}
              className="p-1.5 rounded-lg text-primary hover:bg-surface-container text-xs font-semibold flex items-center gap-1 cursor-pointer"
              title="Abrir tela cheia"
            >
              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
              <span className="hidden sm:inline">Tela Cheia</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
              title="Fechar"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Se usuário não estiver logado */}
        {!user ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[28px]">lock</span>
            </div>
            <h3 className="font-bold text-sm text-on-surface">Acesse seu Espectro Direct</h3>
            <p className="text-xs text-on-surface-variant max-w-xs">
              Conecte-se com sua conta para conversar em tempo real com seus amigos e gerenciar suas amizades.
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate('/login');
              }}
              className="mt-2 px-5 py-2 rounded-full bg-primary-container text-on-primary font-semibold text-xs hover:bg-primary shadow-xs cursor-pointer"
            >
              Entrar ou Criar Conta
            </button>
          </div>
        ) : selectedFriend ? (
          /* ========================================================================= */
          /* 2. CHAT PRIVADO ATIVO COM AMIGO SELECIONADO                                */
          /* ========================================================================= */
          <div className="flex-1 flex flex-col min-h-0 bg-surface">
            {/* Aviso de Reconexão */}
            {connectionStatus === 'reconnecting' && (
              <div className="bg-amber-500/10 border-b border-amber-500/20 px-3 py-1.5 flex items-center justify-between text-[11px] text-amber-500 z-10 flex-shrink-0 animate-in fade-in">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                  <span>Reconectando ao chat (tentando a cada 3s)...</span>
                </div>
                <button
                  type="button"
                  onClick={reconnect}
                  className="underline hover:text-amber-400 font-semibold cursor-pointer text-[10px]"
                >
                  Tentar agora
                </button>
              </div>
            )}

            {/* Histórico de Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="text-center py-2 flex items-center justify-center gap-2">
                <span className="text-[10px] text-on-surface-variant bg-surface-container-low px-2.5 py-1 rounded-full uppercase tracking-wider font-medium">
                  Conversa privada com @{selectedFriend.username}
                </span>
                {connectionStatus === 'connected' && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500" title="Conectado em tempo real" />
                )}
              </div>

              {loadingMessages ? (
                <div className="text-center py-8 text-xs text-on-surface-variant">
                  <span className="material-symbols-outlined text-[22px] text-primary animate-spin">
                    progress_activity
                  </span>
                  <p className="mt-1">Carregando histórico do Direct...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="py-6">
                  <EmptyState
                    icon="waving_hand"
                    title="Nenhuma mensagem ainda. Diga um oi!"
                    description={`Diga olá para @${selectedFriend.username}! Envie a primeira mensagem privada.`}
                    className="p-4"
                  />
                </div>
              ) : (
                messages.map((m, idx) => {
                  const isMe = m.sender_id === user.id;
                  return (
                    <div
                      key={m.id || `${m.created_at}-${idx}`}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed shadow-xs ${
                          isMe
                            ? 'bg-primary-container text-on-primary rounded-br-xs'
                            : 'bg-surface-container-low text-on-surface rounded-bl-xs border border-outline-variant/30'
                        }`}
                      >
                        {m.content}
                      </div>
                      <span className="text-[9px] text-on-surface-variant mt-0.5 px-1">
                        {new Date(m.created_at).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  );
                })
              )}

              {/* Indicador de Digitação */}
              {isOtherUserTyping && (
                <div className="flex items-center gap-2 text-[11px] text-on-surface-variant italic pl-2 py-1 animate-pulse">
                  <div className="flex gap-1 items-center">
                    <span className="w-1 h-1 rounded-full bg-primary animate-bounce" />
                    <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:0.4s]" />
                  </div>
                  <span>@{selectedFriend.username} está digitando...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input para envio de Mensagem */}
            <div className="p-3 bg-surface-container-lowest border-t border-outline-variant/20">
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={handleInputChange}
                  placeholder={`Mensagem para @${selectedFriend.username}...`}
                  className="flex-1 bg-surface-container-low border border-outline-variant/30 rounded-full px-4 py-2 text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container focus:ring-1 focus:ring-primary-container transition-all"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center disabled:opacity-40 hover:bg-primary shadow-xs transition-all cursor-pointer flex-shrink-0"
                >
                  <span className="material-symbols-outlined text-[16px]">send</span>
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* 3. LISTA DE AMIGOS E BUSCA DE NOVAS AMIZADES                             */
          /* ========================================================================= */
          <div className="flex-1 flex flex-col min-h-0 bg-surface">
            {/* Tabs: Meus Amigos vs Encontrar Pessoas */}
            <div className="flex border-b border-outline-variant/20 bg-surface-container-lowest">
              <button
                type="button"
                onClick={() => setActiveTab('friends')}
                className={`flex-1 py-2.5 text-xs font-semibold text-center transition-colors cursor-pointer relative ${
                  activeTab === 'friends'
                    ? 'text-primary'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Amigos ({displayFriends.length})
                {activeTab === 'friends' && (
                  <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-full" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('search')}
                className={`flex-1 py-2.5 text-xs font-semibold text-center transition-colors cursor-pointer relative flex items-center justify-center gap-1 ${
                  activeTab === 'search'
                    ? 'text-primary'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">person_add</span>
                <span>Buscar Pessoas</span>
                {activeTab === 'search' && (
                  <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-full" />
                )}
              </button>
            </div>

            {/* Input de Busca */}
            <div className="p-3 bg-surface-container-lowest border-b border-outline-variant/20">
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-on-surface-variant text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    activeTab === 'friends'
                      ? 'Filtrar meus amigos...'
                      : 'Digitar nome de usuário para adicionar...'
                  }
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container transition-all"
                />
              </div>
            </div>

            {/* Conteúdo da Aba Ativa */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {activeTab === 'friends' ? (
                /* Lista de Amigos */
                loadingFriends ? (
                  <div className="text-center py-8 text-xs text-on-surface-variant">
                    <span className="material-symbols-outlined text-[24px] text-primary animate-spin">
                      progress_activity
                    </span>
                    <p className="mt-1">Carregando lista de amigos...</p>
                  </div>
                ) : filteredFriends.length === 0 ? (
                  <EmptyState
                    icon="chat_bubble_outline"
                    title="Nenhum sussurro por aqui."
                    description="Suas conversas privadas aparecerão aqui. Vá até o perfil de um amigo e envie um recado."
                    actionLabel="Buscar pessoas"
                    onAction={() => setActiveTab('search')}
                    className="p-6"
                  />
                ) : (
                  filteredFriends.map((friend) => (
                    <div
                      key={friend.friend_id}
                      onClick={() => setSelectedFriend(friend)}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-container-low transition-all cursor-pointer border border-transparent hover:border-outline-variant/30 group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-secondary text-on-primary font-bold flex items-center justify-center text-xs uppercase shadow-xs">
                            {friend.username.charAt(0)}
                          </div>
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-surface-container-lowest" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-on-surface group-hover:text-primary transition-colors truncate">
                            @{friend.username}
                          </span>
                          <span className="text-[11px] text-on-surface-variant truncate">
                            {friend.mood || 'Online no Direct'}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="p-1.5 rounded-lg text-primary hover:bg-surface-container opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Abrir chat"
                      >
                        <span className="material-symbols-outlined text-[18px]">chat</span>
                      </button>
                    </div>
                  ))
                )
              ) : (
                /* Busca de Novos Usuários */
                <div>
                  {searching ? (
                    <div className="text-center py-6 text-xs text-on-surface-variant">
                      <span className="material-symbols-outlined text-[20px] text-primary animate-spin">
                        progress_activity
                      </span>
                      <p className="mt-1">Procurando no Espectro...</p>
                    </div>
                  ) : !searchQuery.trim() ? (
                    <div className="text-center py-6 text-xs text-on-surface-variant">
                      <p>Digite o nome de um usuário para buscar e adicionar como amigo.</p>
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="text-center py-6 text-xs text-on-surface-variant">
                      <p>Nenhum usuário encontrado com "{searchQuery}".</p>
                    </div>
                  ) : (
                    searchResults.map((usr) => {
                      const isAlreadyFriend =
                        usr.friendship_status === 'accepted' ||
                        friends.some((f) => f.friend_id === usr.id);

                      return (
                        <div
                          key={usr.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 mb-2"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary font-bold flex items-center justify-center text-xs uppercase">
                              {usr.username.charAt(0)}
                            </div>
                            <span className="text-xs font-bold text-on-surface truncate">
                              @{usr.username}
                            </span>
                          </div>

                          {isAlreadyFriend ? (
                            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">check</span>
                              <span>Amigo</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAddFriend(usr.id, usr.username)}
                              className="px-3 py-1 rounded-full bg-primary-container text-on-primary font-semibold text-[10px] hover:bg-primary shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[14px]">person_add</span>
                              <span>Adicionar</span>
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Atalho Rodapé para Tela Completa */}
            <div className="p-3 border-t border-outline-variant/20 bg-surface-container-lowest">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate('/mensagens');
                }}
                className="w-full py-2.5 rounded-full bg-primary-container text-on-primary font-semibold text-xs hover:bg-primary shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">forum</span>
                <span>Abrir Direct Completo</span>
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
