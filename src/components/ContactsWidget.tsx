import React, { useState } from 'react';

interface Contact {
  id: number;
  name: string;
  status: 'online' | 'offline';
  customMessage: string;
  avatarChar: string;
}

const DEFAULT_CONTACTS: Contact[] = [
  { id: 1, name: 'Bia', status: 'online', customMessage: 'jogando The Sims 2...', avatarChar: 'B' },
  { id: 2, name: 'Felipe', status: 'online', customMessage: 'ouvindo Linkin Park no Winamp', avatarChar: 'F' },
  { id: 3, name: 'Carol', status: 'online', customMessage: 'estudando pro vestibular s2', avatarChar: 'C' },
  { id: 4, name: 'Lucas "Dexter"', status: 'offline', customMessage: 'jogando CS 1.6 na Lan House', avatarChar: 'L' },
  { id: 5, name: 'Mariana Costa', status: 'online', customMessage: 'Porto Seguro 2004 inesquecível!', avatarChar: 'M' },
  { id: 6, name: 'Diego', status: 'offline', customMessage: 'volto mais tarde (ausente)', avatarChar: 'D' },
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
    <div className="bg-surface-container-lowest rounded classic-bevel-border overflow-hidden">
      {/* Header */}
      <div className="retro-header-strip px-space-sm py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px] text-primary">contacts</span>
          <span className="text-label-sm font-label-sm text-primary uppercase font-bold tracking-wide">
            Contatos ({onlineCount} online)
          </span>
        </div>
      </div>

      {/* Quick Search */}
      <div className="p-2 border-b border-outline-variant bg-surface-container-low">
        <div className="relative">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="buscar contato..."
            className="w-full pl-6 pr-2 py-0.5 text-body-sm bg-white border border-outline-variant rounded outline-none focus:border-primary text-primary"
          />
          <span className="material-symbols-outlined absolute left-1.5 top-1 text-secondary text-[14px]">
            search
          </span>
        </div>
      </div>

      {/* Contact List */}
      <div className="p-2 space-y-1.5 max-h-96 overflow-y-auto">
        {filtered.map((contact) => (
          <div
            key={contact.id}
            className="flex items-center gap-2 p-1.5 rounded hover:bg-surface-container transition-colors cursor-pointer group"
          >
            {/* Avatar with Dot Indicator */}
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                {contact.avatarChar}
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ${
                  contact.status === 'online' ? 'bg-[#62B33C]' : 'bg-[#94a3b8]'
                }`}
                title={contact.status === 'online' ? 'Online' : 'Offline'}
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-bold text-primary text-body-sm truncate group-hover:underline">
                  {contact.name}
                </span>
                <span className="text-[10px] text-secondary">
                  {contact.status === 'online' ? 'online' : 'off'}
                </span>
              </div>
              <p className="text-[11px] text-secondary truncate italic">
                {contact.customMessage}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer MSN Style Status */}
      <div className="bg-surface-container p-2 border-t border-outline-variant text-center text-[11px] text-secondary flex items-center justify-center gap-1">
        <span className="w-2 h-2 rounded-full bg-[#62B33C] inline-block animate-pulse"></span>
        Rede do Espectro ativa
      </div>
    </div>
  );
};
