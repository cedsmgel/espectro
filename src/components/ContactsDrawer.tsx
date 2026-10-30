import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Contact {
  id: number;
  name: string;
  username: string;
  online: boolean;
  time: string;
  mood: string;
  avatarColor: string;
}

interface ContactsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ContactsDrawer: React.FC<ContactsDrawerProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [chatContact, setChatContact] = useState<Contact | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sentSuccess, setSentSuccess] = useState<string | null>(null);

  const defaultContacts: Contact[] = [
    {
      id: 1,
      name: 'Clarice Lis',
      username: 'clarice_lis',
      online: true,
      time: 'agora',
      mood: '🎵 Ouvindo rock 2000s',
      avatarColor: 'from-purple-500 to-pink-500',
    },
    {
      id: 2,
      name: 'Thiago M.',
      username: 'thiago_dev',
      online: true,
      time: '5m',
      mood: '💻 Compilando kernel Rust',
      avatarColor: 'from-blue-500 to-cyan-500',
    },
    {
      id: 3,
      name: 'Bia Rocha',
      username: 'bia',
      online: true,
      time: '12m',
      mood: '✨ Em transe criativo no Figma',
      avatarColor: 'from-amber-400 to-rose-500',
    },
    {
      id: 4,
      name: 'Rodrigo Sol',
      username: 'rodrigo_sol',
      online: true,
      time: '28m',
      mood: '☕ Café & café',
      avatarColor: 'from-emerald-400 to-teal-500',
    },
    {
      id: 5,
      name: 'Marina Silva',
      username: 'marina_s',
      online: false,
      time: '3h',
      mood: 'Visto há 3h',
      avatarColor: 'from-slate-600 to-slate-500',
    },
  ];

  const filteredContacts = defaultContacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.mood.toLowerCase().includes(search.toLowerCase())
  );

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !chatContact) return;

    setSentSuccess(`Mensagem direta enviada para @${chatContact.username}!`);
    setMessageText('');
    setTimeout(() => {
      setSentSuccess(null);
    }, 3000);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Drawer Panel */}
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-sm sm:max-w-md glass-surface backdrop-blur-3xl border-l border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col transition-transform duration-300 ease-out transform ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
              <span className="material-symbols-outlined text-[18px]">forum</span>
            </div>
            <div>
              <h2 className="text-base font-display font-bold text-white flex items-center gap-2">
                <span>Mensagens Diretas</span>
                <span className="text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.2 rounded-full">
                  Direct
                </span>
              </h2>
              <p className="text-[11px] text-neutral-400">Contatos e conversas em tempo real</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            title="Fechar"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Search input */}
        <div className="p-4 border-b border-white/5">
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-3 text-neutral-400 text-[18px]">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar amigos ou músicas..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl glass-recessed text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-400 transition-all"
            />
          </div>
        </div>

        {/* Success Alert */}
        {sentSuccess && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            <span>{sentSuccess}</span>
          </div>
        )}

        {/* Contacts List / Active Chat */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {chatContact ? (
            /* Direct Chat Box with Selected Friend */
            <div className="glass-surface rounded-2xl p-4 flex flex-col gap-3.5 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-full bg-gradient-to-tr ${chatContact.avatarColor} flex items-center justify-center text-white text-xs font-bold uppercase shadow-sm`}
                  >
                    {chatContact.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white font-display">
                      {chatContact.name}
                    </h4>
                    <span className="text-[10px] text-neutral-400">@{chatContact.username}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setChatContact(null)}
                  className="text-xs text-neutral-400 hover:text-white"
                >
                  Voltar à lista
                </button>
              </div>

              {/* Status info */}
              <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/5 text-[11px] text-neutral-300">
                <p className="font-medium text-cyan-300">{chatContact.mood}</p>
                <p className="text-[10px] text-neutral-500 mt-0.5">
                  {chatContact.online ? 'Online agora no Espectro' : 'Offline'}
                </p>
              </div>

              {/* Chat Message Form */}
              <form onSubmit={handleSendMessage} className="space-y-2 pt-1">
                <textarea
                  rows={3}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={`Escreva uma mensagem direta para @${chatContact.username}...`}
                  className="w-full p-2.5 text-xs rounded-xl glass-recessed text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-400 transition-all resize-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setChatContact(null)}
                    className="btn-glass text-xs font-semibold px-3 py-1.5 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!messageText.trim()}
                    className="btn-primary-blue text-xs font-semibold px-4 py-1.5 rounded-xl disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <span>Enviar</span>
                    <span className="material-symbols-outlined text-[14px]">send</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Friends List */
            filteredContacts.map((contact) => (
              <div
                key={contact.id}
                className={`glass-surface rounded-2xl p-3 flex items-center justify-between gap-3 hover:border-cyan-400/40 transition-all duration-200 group ${
                  !contact.online ? 'opacity-65' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-10 h-10 rounded-full shrink-0">
                    <div
                      className={`w-full h-full rounded-full bg-gradient-to-tr ${contact.avatarColor} flex items-center justify-center text-white text-xs font-bold font-display uppercase shadow-sm`}
                    >
                      {contact.name.charAt(0)}
                    </div>
                    <span
                      className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-[#111318] ${
                        contact.online
                          ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
                          : 'bg-slate-500'
                      }`}
                    />
                  </div>

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white truncate group-hover:text-cyan-300 transition-colors">
                        {contact.name}
                      </span>
                      <span className="text-[10px] text-neutral-400">• {contact.time}</span>
                    </div>
                    <p className="text-[11px] text-neutral-400 truncate mt-0.5">{contact.mood}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setChatContact(contact)}
                    className="p-2 rounded-xl bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400 hover:text-[#001f26] border border-cyan-400/20 transition-all cursor-pointer"
                    title="Enviar Mensagem Direta"
                  >
                    <span className="material-symbols-outlined text-[16px]">chat</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate(`/?type=scrap&author=${contact.username}`);
                    }}
                    className="p-2 rounded-xl hover:bg-white/10 text-neutral-400 hover:text-white transition-all cursor-pointer"
                    title="Ver Scraps"
                  >
                    <span className="material-symbols-outlined text-[16px]">history_edu</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-white/10 text-center text-[11px] text-neutral-400">
          <span>Espectro Direct • Criptografia ponto a ponto</span>
        </div>
      </aside>
    </>
  );
};
