import React, { useState } from 'react';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { authStorage } from '../lib/api';

interface Message {
  id: number;
  sender: 'me' | 'other';
  text?: string;
  time: string;
  audioDuration?: string;
  isAudio?: boolean;
}

interface Conversation {
  id: number;
  name: string;
  username: string;
  avatarLetter: string;
  avatarColor: string;
  online: boolean;
  statusText: string;
  lastMessage: string;
  time: string;
  unread?: number;
  verified?: boolean;
}

export const DirectMessages: React.FC = () => {
  const user = authStorage.getUser();
  const [conversations] = useState<Conversation[]>([
    {
      id: 1,
      name: 'Camila Brandão',
      username: 'camila_designer',
      avatarLetter: 'C',
      avatarColor: 'from-secondary to-primary',
      online: true,
      statusText: 'Online agora',
      lastMessage: 'Você viu a nova especificação da API?',
      time: '2m',
      unread: 1,
      verified: true,
    },
    {
      id: 2,
      name: 'Lucas Silveira',
      username: 'lucas_s',
      avatarLetter: 'L',
      avatarColor: 'from-blue-500 to-indigo-600',
      online: true,
      statusText: 'Online há 15m',
      lastMessage: 'Fechado, amanhã às 10h alinhamos.',
      time: '1h',
      verified: false,
    },
    {
      id: 3,
      name: 'Beatriz Rocha',
      username: 'biarocha',
      avatarLetter: 'B',
      avatarColor: 'from-amber-500 to-rose-500',
      online: false,
      statusText: 'Visto há 3h',
      lastMessage: 'Enviou um clipe no Espectro Play 🎬',
      time: '3h',
      verified: true,
    },
    {
      id: 4,
      name: 'Devs Espectro 🔥',
      username: 'espectro_devs',
      avatarLetter: 'D',
      avatarColor: 'from-emerald-500 to-teal-600',
      online: true,
      statusText: '12 membros online',
      lastMessage: 'Pedro: Alguém testou o beta 4.2?',
      time: '5h',
      verified: true,
    },
  ]);

  const [activeConv, setActiveConv] = useState<Conversation>(conversations[0]);
  const [searchConv, setSearchConv] = useState('');
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      sender: 'other',
      text: 'Gabriel, finalizei os tokens cromáticos do modo escuro para o Espectro! Ficou bem imersivo. Dá uma olhada no preview.',
      time: '14:30',
    },
    {
      id: 2,
      sender: 'me',
      text: 'Ficou impecável! O contraste com o tom surface-tint tá perfeito. Vou integrar nos componentes agora.',
      time: '14:32',
    },
    {
      id: 3,
      sender: 'me',
      isAudio: true,
      audioDuration: '0:14 / 0:38',
      time: '14:33',
    },
    {
      id: 4,
      sender: 'other',
      text: 'Você viu a nova especificação da API? Suporta streaming em tempo real das mensagens sem precisar de polling extra!',
      time: '14:35',
    },
  ]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMsg: Message = {
      id: Date.now(),
      sender: 'me',
      text: inputText.trim(),
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText('');
  };

  const filteredConversations = conversations.filter(
    (c) =>
      c.name.toLowerCase().includes(searchConv.toLowerCase()) ||
      c.username.toLowerCase().includes(searchConv.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <Header />
      <SidebarNav />

      <div className="pl-0 md:pl-[72px] pt-16 flex-1 flex flex-col">
        <main className="w-full flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
          <div className="flex flex-1 w-full h-full overflow-hidden bg-surface">
            {/* COLUNA 1: Lista de Mensagens / Diretório Direct */}
            <aside className="w-80 lg:w-96 flex-shrink-0 flex flex-col bg-surface-container-lowest border-r border-outline-variant/30 shadow-xs z-10">
              {/* Topo: Identidade do Usuário & Criar Conversa */}
              <div className="p-4 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-base text-on-surface">
                    @{user ? user.username : 'gabriel_dev'}
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

              {/* Barra de Busca de Conversas */}
              <div className="px-4 pb-2">
                <div className="relative flex items-center w-full">
                  <span className="material-symbols-outlined absolute left-3 text-on-surface-variant text-[18px] pointer-events-none">
                    search
                  </span>
                  <input
                    type="text"
                    value={searchConv}
                    onChange={(e) => setSearchConv(e.target.value)}
                    placeholder="Pesquisar mensagens ou pessoas..."
                    className="w-full h-9 pl-9 pr-3 bg-surface-container-low text-on-surface placeholder:text-on-surface-variant rounded-full text-xs focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary-container outline-none transition-all"
                  />
                </div>
              </div>

              {/* Notas Rápidas / Pensamentos (Stories de Notas) */}
              <div className="px-4 py-2 border-b border-outline-variant/20 overflow-x-auto scrollbar-none flex items-start gap-4">
                <div className="flex flex-col items-center flex-shrink-0 w-14 cursor-pointer group">
                  <div className="relative mb-1">
                    <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center text-on-primary font-bold text-xs shadow-xs">
                      {user ? user.username.charAt(0).toUpperCase() : 'G'}
                    </div>
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-surface-container-lowest shadow-sm px-1.5 py-0.2 rounded-full border border-outline-variant/30 text-[9px] font-semibold whitespace-nowrap">
                      No flow ⚡
                    </div>
                  </div>
                  <span className="text-[10px] text-on-surface-variant truncate w-full text-center">
                    Sua nota
                  </span>
                </div>

                {conversations.slice(0, 3).map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setActiveConv(c)}
                    className="flex flex-col items-center flex-shrink-0 w-14 cursor-pointer group"
                  >
                    <div className="relative mb-1">
                      <div className={`w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr ${c.avatarColor} shadow-xs`}>
                        <div className="w-full h-full rounded-full bg-surface-container-lowest flex items-center justify-center font-bold text-xs text-primary">
                          {c.avatarLetter}
                        </div>
                      </div>
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-surface-container-lowest shadow-sm px-1.5 py-0.2 rounded-full border border-outline-variant/30 text-[9px] font-semibold whitespace-nowrap">
                        {c.id === 1 ? 'Design 🎨' : c.id === 2 ? 'Café ☕' : 'Foco 🚀'}
                      </div>
                    </div>
                    <span className="text-[10px] text-on-surface truncate w-full text-center font-medium">
                      {c.name.split(' ')[0]}
                    </span>
                  </div>
                ))}
              </div>

              {/* Lista de Conversas */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredConversations.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setActiveConv(c)}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                      activeConv.id === c.id
                        ? 'bg-surface-container-low border border-outline-variant/30 shadow-xs'
                        : 'hover:bg-surface-container-low/60'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className={`w-11 h-11 rounded-full p-0.5 bg-gradient-to-tr ${c.avatarColor}`}>
                        <div className="w-full h-full rounded-full bg-surface-container-lowest flex items-center justify-center font-bold text-sm text-primary">
                          {c.avatarLetter}
                        </div>
                      </div>
                      {c.online && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-surface-container-lowest" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-on-surface truncate">
                          {c.name}
                        </span>
                        <span className="text-[11px] text-on-surface-variant font-medium">
                          {c.time}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-xs text-on-surface-variant truncate">
                          {c.lastMessage}
                        </p>
                        {c.unread && (
                          <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 ml-1.5" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </aside>

            {/* COLUNA 2: Conversa Ativa */}
            <section className="flex-1 flex flex-col bg-surface min-w-0 relative">
              {/* Cabeçalho do Chat */}
              <div className="h-16 px-6 bg-surface-container-lowest border-b border-outline-variant/30 flex items-center justify-between shadow-xs z-10 flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative flex-shrink-0">
                    <div className={`w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr ${activeConv.avatarColor}`}>
                      <div className="w-full h-full rounded-full bg-surface-container-lowest flex items-center justify-center font-bold text-sm text-primary">
                        {activeConv.avatarLetter}
                      </div>
                    </div>
                    {activeConv.online && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-surface-container-lowest" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h2 className="font-semibold text-sm text-on-surface truncate">
                        {activeConv.name}
                      </h2>
                      {activeConv.verified && (
                        <span className="material-symbols-outlined text-primary text-[16px]">
                          verified
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-emerald-600 font-medium">
                      {activeConv.statusText}
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
                  <button type="button" aria-label="Informações" className="w-9 h-9 rounded-full flex items-center justify-center bg-surface-container-low text-primary hover:bg-primary-container hover:text-on-primary transition-colors">
                    <span className="material-symbols-outlined text-[20px]">info</span>
                  </button>
                </div>
              </div>

              {/* Feed de Mensagens */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="flex items-center justify-center">
                  <span className="text-[11px] text-on-surface-variant bg-surface-container-low px-3 py-1 rounded-full uppercase tracking-wider font-medium">
                    Hoje, 14:28
                  </span>
                </div>

                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex items-end gap-2 max-w-xl ${
                      m.sender === 'me' ? 'ml-auto justify-end' : 'mr-auto justify-start'
                    }`}
                  >
                    {m.sender === 'other' && (
                      <div className="w-7 h-7 rounded-full bg-primary-container text-on-primary font-bold flex items-center justify-center text-xs flex-shrink-0 mb-1">
                        {activeConv.avatarLetter}
                      </div>
                    )}

                    <div className="flex flex-col">
                      {m.isAudio ? (
                        <div className="bg-gradient-to-r from-primary-container to-secondary-container text-on-primary px-4 py-3 rounded-2xl rounded-br-sm shadow-xs flex items-center gap-3">
                          <button type="button" className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white">
                            <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                          </button>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1 h-4">
                              {[6, 12, 8, 16, 10, 14, 6, 12, 8].map((h, i) => (
                                <span key={i} className="w-1 bg-white/90 rounded-full" style={{ height: `${h}px` }} />
                              ))}
                            </div>
                            <span className="text-[10px] text-white/80">{m.audioDuration}</span>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                            m.sender === 'me'
                              ? 'bg-gradient-to-r from-primary-container to-secondary-container text-on-primary rounded-br-sm'
                              : 'bg-surface-container-low text-on-surface rounded-bl-sm border border-outline-variant/30'
                          }`}
                        >
                          {m.text}
                        </div>
                      )}
                      <span className={`text-[10px] text-on-surface-variant mt-1 ${m.sender === 'me' ? 'text-right mr-1' : 'ml-1'}`}>
                        {m.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Barra Inferior de Entrada (Direct Input) */}
              <div className="p-4 bg-surface-container-lowest border-t border-outline-variant/30 flex-shrink-0">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2 bg-surface-container-low rounded-full px-4 py-1.5 border border-outline-variant/30">
                  <button type="button" title="Imagem" className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
                    <span className="material-symbols-outlined text-[20px]">image</span>
                  </button>
                  <button type="button" title="Microfone" className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
                    <span className="material-symbols-outlined text-[20px]">mic</span>
                  </button>
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Enviar mensagem..."
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
            </section>

            {/* COLUNA 3: Painel Lateral de Informações do Contato */}
            <aside className="w-72 flex-shrink-0 bg-surface-container-lowest border-l border-outline-variant/30 hidden xl:flex flex-col p-6 overflow-y-auto">
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-3">
                  <div className={`w-20 h-20 rounded-full p-0.5 bg-gradient-to-tr ${activeConv.avatarColor} shadow-sm`}>
                    <div className="w-full h-full rounded-full bg-surface-container-lowest flex items-center justify-center font-bold text-2xl text-primary">
                      {activeConv.avatarLetter}
                    </div>
                  </div>
                  {activeConv.online && (
                    <span className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 rounded-full ring-2 ring-surface-container-lowest" />
                  )}
                </div>
                <h3 className="font-bold text-base text-on-surface flex items-center justify-center gap-1">
                  {activeConv.name}
                  {activeConv.verified && (
                    <span className="material-symbols-outlined text-primary text-[18px]">verified</span>
                  )}
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">@{activeConv.username}</p>
                <button
                  type="button"
                  className="mt-4 w-full h-9 rounded-xl bg-surface-container-high text-on-surface font-semibold text-xs hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">person</span>
                  <span>Ver Perfil</span>
                </button>
              </div>

              <div className="mt-6 pt-4 border-t border-outline-variant/20 flex flex-col gap-3 text-xs">
                <div className="flex items-center justify-between text-on-surface cursor-pointer hover:text-primary transition-colors">
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">notifications_off</span>
                    <span>Silenciar</span>
                  </span>
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </div>
                <div className="flex items-center justify-between text-on-surface cursor-pointer hover:text-primary transition-colors">
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">palette</span>
                    <span>Tema do chat</span>
                  </span>
                  <span className="w-4 h-4 rounded-full bg-primary" />
                </div>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
};
