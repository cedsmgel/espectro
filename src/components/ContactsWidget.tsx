import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Community } from '../lib/api';

interface ContactsWidgetProps {
  communities?: Community[];
}

export const ContactsWidget: React.FC<ContactsWidgetProps> = ({ communities = [] }) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const defaultContacts = [
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

  return (
    <aside className="hidden xl:flex flex-col gap-6 sticky top-20">
      {/* 'Contatos' (Friends & Chat) Glass Widget from Stitch */}
      <section className="glass-surface rounded-2xl p-4 flex flex-col gap-3.5">
        {/* Widget Header */}
        <div className="flex items-center justify-between pb-1 border-b border-white/10">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-display font-bold text-white">Contatos</h2>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              14 Online
            </span>
          </div>
          <button
            type="button"
            className="p-1 rounded-lg text-neutral-400 hover:text-white transition-colors"
            title="Abrir Chat"
          >
            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
          </button>
        </div>

        {/* Quick Search Amigos */}
        <div className="relative flex items-center">
          <span className="material-symbols-outlined absolute left-3 text-neutral-400 text-[16px]">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar amigos..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl glass-recessed text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-400 transition-all"
          />
        </div>

        {/* Friends List */}
        <div className="flex flex-col gap-1">
          {filteredContacts.map((contact) => (
            <div
              key={contact.id}
              onClick={() => navigate(`/?type=scrap&author=${contact.username}`)}
              className={`flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors group ${
                !contact.online ? 'opacity-60' : ''
              }`}
            >
              <div className="relative w-9 h-9 rounded-full shrink-0">
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

              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white truncate group-hover:text-cyan-300 transition-colors">
                    {contact.name}
                  </span>
                  <span className="text-[10px] text-neutral-400">{contact.time}</span>
                </div>
                <p className="text-[11px] text-neutral-400 truncate">{contact.mood}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 'Comunidades em Alta' Widget from Stitch */}
      <section className="glass-surface rounded-2xl p-4 flex flex-col gap-3.5">
        <div className="flex items-center justify-between pb-1 border-b border-white/10">
          <h2 className="text-sm font-display font-bold text-white">Comunidades em Alta</h2>
          <Link to="/comunidades" className="text-xs text-cyan-300 hover:underline">
            Ver todas
          </Link>
        </div>

        <div className="flex flex-col gap-3">
          {communities.length > 0 ? (
            communities.slice(0, 3).map((comm) => (
              <div key={comm.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-cyan-300 font-bold shrink-0">
                    <span className="material-symbols-outlined text-[16px]">groups</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <Link
                      to={`/e/${comm.slug || comm.id}`}
                      className="text-xs font-semibold text-white truncate hover:text-cyan-300"
                    >
                      e/{comm.name}
                    </Link>
                    <span className="text-[10px] text-neutral-400">
                      {comm.members_count} {comm.members_count === 1 ? 'membro' : 'membros'}
                    </span>
                  </div>
                </div>
                <Link
                  to={`/e/${comm.slug || comm.id}`}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-cyan-400 hover:text-[#001f26] text-[11px] text-cyan-300 border border-cyan-400/30 transition-all font-semibold shrink-0"
                >
                  Entrar
                </Link>
              </div>
            ))
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 font-bold shrink-0">
                    <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-white truncate">
                      e/nostalgia-anos-2000
                    </span>
                    <span className="text-[10px] text-neutral-400">42.5k membros</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/e/nostalgia-anos-2000')}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-cyan-400 hover:text-[#001f26] text-[11px] text-cyan-300 border border-cyan-400/30 transition-all font-semibold shrink-0"
                >
                  Entrar
                </button>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 font-bold shrink-0">
                    <span className="material-symbols-outlined text-[16px]">brush</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-white truncate">e/designers</span>
                    <span className="text-[10px] text-neutral-400">28.1k membros</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/comunidades')}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-cyan-400 hover:text-[#001f26] text-[11px] text-cyan-300 border border-cyan-400/30 transition-all font-semibold shrink-0"
                >
                  Entrar
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Trending Topics Pills Widget from Stitch */}
      <section className="glass-surface rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between pb-1 border-b border-white/10">
          <h2 className="text-sm font-display font-bold text-white">Tópicos do Momento</h2>
          <span className="material-symbols-outlined text-neutral-400 text-[18px]">trending_up</span>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {['#LiquidGlass', '#Web3', '#Nostalgia2000', '#IndieWeb', '#Synthwave'].map((tag) => (
            <Link
              key={tag}
              to={`/?q=${encodeURIComponent(tag)}`}
              className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-cyan-400/15 text-neutral-300 hover:text-cyan-300 border border-white/10 hover:border-cyan-400/30 text-xs transition-all duration-150"
            >
              {tag}
            </Link>
          ))}
        </div>
        <div className="pt-3 border-t border-white/5 text-[10px] text-neutral-400 flex flex-wrap gap-x-2.5 gap-y-1">
          <span>Privacidade</span>
          <span>•</span>
          <span>Diretrizes</span>
          <span>•</span>
          <span>Karma Protocol</span>
          <span>•</span>
          <span>© 2025 Espectro</span>
        </div>
      </section>
    </aside>
  );
};
