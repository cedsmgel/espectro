import React, { useState } from 'react';

interface Contact {
  id: number;
  name: string;
  status: 'online' | 'offline';
  customMessage: string;
  avatarGradient: string;
}

const DEFAULT_CONTACTS: Contact[] = [
  { id: 1, name: 'Bia Ribeiro', status: 'online', customMessage: 'criando no figma...', avatarGradient: 'from-pink-500 to-rose-500' },
  { id: 2, name: 'Felipe Santos', status: 'online', customMessage: 'ouvindo synthwave & codando', avatarGradient: 'from-blue-500 to-cyan-500' },
  { id: 3, name: 'Carol Andrade', status: 'online', customMessage: 'café e novas playlists', avatarGradient: 'from-amber-500 to-orange-500' },
  { id: 4, name: 'Lucas "Dexter"', status: 'offline', customMessage: 'ausente • volta às 18h', avatarGradient: 'from-indigo-500 to-purple-500' },
  { id: 5, name: 'Mariana Costa', status: 'online', customMessage: 'admirando o visual liquid glass!', avatarGradient: 'from-emerald-500 to-teal-500' },
  { id: 6, name: 'Diego Martins', status: 'offline', customMessage: 'ocupado', avatarGradient: 'from-violet-500 to-fuchsia-500' },
];

export const ContactsWidget: React.FC = () => {
  const [filter, setFilter] = useState('');
  const [contacts] = useState<Contact[]>(DEFAULT_CONTACTS);

  const filtered = contacts.filter((c) =>
    c.name.toLowerCase().includes(filter.toLowerCase()) ||
    c.customMessage.toLowerCase().includes(filter.toLowerCase())
  );

  const onlineCount = contacts.filter((c) => c.status === 'online').length;

  return (
    <div className="glass-panel rounded-2xl overflow-hidden p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-brand-blue text-[20px]">group</span>
          <h3 className="font-display font-bold text-sm text-white">Contatos</h3>
        </div>
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-neon-green/10 border border-neon-green/20 text-[11px] text-neon-green font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-neon-green"></span>
          {onlineCount} online
        </span>
      </div>

      {/* Modern Search */}
      <div className="relative">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar amigos..."
          className="w-full glass-input pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-500 rounded-xl"
        />
        <span className="material-symbols-outlined absolute left-2.5 top-2 text-neutral-500 text-[16px]">
          search
        </span>
      </div>

      {/* Contacts List */}
      <div className="space-y-1 max-h-[380px] overflow-y-auto pr-1">
        {filtered.map((contact) => (
          <div
            key={contact.id}
            className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.05] transition-all cursor-pointer group"
          >
            {/* Avatar with Status Dot */}
            <div className="relative flex-shrink-0">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${contact.avatarGradient} text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm`}>
                {contact.name.charAt(0)}
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#121620] ${
                  contact.status === 'online'
                    ? 'bg-neon-green shadow-glow-green'
                    : 'bg-neutral-500'
                }`}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-display font-semibold text-xs text-white group-hover:text-blue-400 transition-colors truncate">
                  {contact.name}
                </span>
                <span className="text-[10px] text-neutral-500">
                  {contact.status === 'online' ? 'agora' : 'offline'}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 truncate">
                {contact.customMessage}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
