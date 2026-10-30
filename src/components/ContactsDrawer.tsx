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
      name: 'Camila Brandão',
      username: 'camila_designer',
      online: true,
      time: 'agora',
      mood: '🎨 Focando no design',
      avatarColor: 'from-secondary to-primary',
    },
    {
      id: 2,
      name: 'Lucas Silveira',
      username: 'lucas_s',
      online: true,
      time: '5m',
      mood: '☕ Café & Código',
      avatarColor: 'from-blue-500 to-indigo-600',
    },
    {
      id: 3,
      name: 'Beatriz Rocha',
      username: 'biarocha',
      online: true,
      time: '12m',
      mood: '🚀 Sprint final',
      avatarColor: 'from-amber-400 to-rose-500',
    },
    {
      id: 4,
      name: 'Thiago Silveira',
      username: 'thiago_dev',
      online: true,
      time: '28m',
      mood: '💻 Compilando kernel',
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
        className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Drawer Panel */}
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-sm sm:max-w-md bg-surface-container-lowest border-l border-outline-variant/30 shadow-2xl flex flex-col transition-transform duration-300 ease-out transform ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-outline-variant/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary-container text-on-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">chat</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span>Mensagens Rápidas</span>
                <span className="text-[10px] font-semibold bg-secondary-container text-on-secondary-container px-2 py-0.2 rounded-full">
                  Direct
                </span>
              </h2>
              <p className="text-[11px] text-on-surface-variant">Contatos e conversas ativas</p>
            </div>
          </div>

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
              <span className="hidden sm:inline">Expandir</span>
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

        {/* Search input */}
        <div className="p-4 border-b border-outline-variant/20">
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-3 text-on-surface-variant text-[18px]">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar amigos ou status..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary-container transition-all"
            />
          </div>
        </div>

        {/* Success Alert */}
        {sentSuccess && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-emerald-100 text-emerald-800 text-xs flex items-center gap-2 border border-emerald-300">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            <span>{sentSuccess}</span>
          </div>
        )}

        {/* Contacts List / Active Chat */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {chatContact ? (
            /* Direct Chat Box with Selected Friend */
            <div className="bg-surface-container-low rounded-2xl p-4 flex flex-col gap-3.5 border border-outline-variant/30 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-full bg-gradient-to-tr ${chatContact.avatarColor} flex items-center justify-center text-white text-xs font-bold uppercase shadow-xs`}
                  >
                    {chatContact.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-on-surface">
                      {chatContact.name}
                    </h4>
                    <span className="text-[10px] text-on-surface-variant">@{chatContact.username}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setChatContact(null)}
                  className="text-xs text-primary hover:underline cursor-pointer"
                >
                  Voltar à lista
                </button>
              </div>

              {/* Status info */}
              <div className="px-3 py-2 rounded-xl bg-surface-container text-[11px] text-on-surface">
                <p className="font-semibold text-primary">{chatContact.mood}</p>
                <p className="text-[10px] text-on-surface-variant mt-0.5">
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
                  className="w-full p-2.5 text-xs rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary-container transition-all resize-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setChatContact(null)}
                    className="px-3 py-1.5 rounded-full text-xs text-on-surface-variant hover:bg-surface-container cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!messageText.trim()}
                    className="px-4 py-1.5 rounded-full bg-primary-container text-on-primary text-xs font-semibold hover:bg-primary shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Enviar</span>
                    <span className="material-symbols-outlined text-[14px]">send</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Friend List */
            <>
              <div className="flex items-center justify-between pb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Amigos Conectados ({defaultContacts.filter((c) => c.online).length})
                </span>
                <span className="text-[10px] text-primary font-medium">Tempo Real</span>
              </div>

              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  onClick={() => setChatContact(contact)}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-container-low transition-all cursor-pointer border border-transparent hover:border-outline-variant/20 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative">
                      <div
                        className={`w-10 h-10 rounded-full bg-gradient-to-tr ${contact.avatarColor} flex items-center justify-center text-white text-xs font-bold uppercase shadow-xs`}
                      >
                        {contact.name.charAt(0)}
                      </div>
                      <span
                        className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-surface-container-lowest ${
                          contact.online ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}
                      />
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-on-surface group-hover:text-primary transition-colors truncate">
                          {contact.name}
                        </span>
                        <span className="text-[10px] text-on-surface-variant truncate">
                          @{contact.username}
                        </span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant truncate font-normal">
                        {contact.mood}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Conversar"
                  >
                    <span className="material-symbols-outlined text-[18px]">chat</span>
                  </button>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer Shortcut to Full Direct Screen */}
        <div className="p-4 border-t border-outline-variant/20 bg-surface-container-low/50">
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate('/mensagens');
            }}
            className="w-full py-2.5 rounded-full bg-primary-container text-on-primary font-semibold text-xs hover:bg-primary shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">forum</span>
            <span>Abrir Espectro Direct Completo</span>
          </button>
        </div>
      </aside>
    </>
  );
};
