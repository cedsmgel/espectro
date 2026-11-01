import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CloseFriendRow, closeFriendsApi } from '../lib/api';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';

// Melhores amigos: lista privada (ninguém é avisado). Quem está nela vê os Momentum compartilhados só com os melhores amigos.
export const CloseFriends: React.FC = () => {
  const [friends, setFriends] = useState<CloseFriendRow[] | null>(null);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      closeFriendsApi
        .list(query.trim() || undefined)
        .then((res) => active && setFriends(res.friends))
        .catch(() => active && setFriends([]));
    }, query ? 250 : 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const toggle = async (friend: CloseFriendRow) => {
    setBusyId(friend.id);
    setError(null);
    const next = !friend.close;
    // Troca na hora; se o servidor recusar, volta
    setFriends((list) => (list ? list.map((f) => (f.id === friend.id ? { ...f, close: next } : f)) : list));
    try {
      await closeFriendsApi.set(friend.id, next);
    } catch (err: any) {
      setFriends((list) => (list ? list.map((f) => (f.id === friend.id ? { ...f, close: friend.close } : f)) : list));
      setError(err?.message || 'Não foi possível atualizar a lista.');
    } finally {
      setBusyId(null);
    }
  };

  const closeCount = friends ? friends.filter((f) => f.close).length : 0;
  const inList = friends ? friends.filter((f) => f.close) : [];
  const others = friends ? friends.filter((f) => !f.close) : [];

  const row = (f: CloseFriendRow) => (
    <li key={f.id} className="flex items-center gap-3 py-3 border-b border-outline-variant">
      <div className="w-11 h-11 rounded-full bg-surface-container-low flex items-center justify-center overflow-hidden shrink-0 text-sm font-bold text-on-surface">
        {f.avatar_url ? <img src={f.avatar_url} alt="" className="w-full h-full object-cover" /> : f.username.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-on-surface truncate">{f.username}</p>
        {f.name && <p className="text-xs text-on-surface-variant truncate">{f.name}</p>}
      </div>
      <button
        type="button"
        role="checkbox"
        aria-checked={f.close}
        aria-label={f.close ? `Tirar ${f.username} dos melhores amigos` : `Adicionar ${f.username} aos melhores amigos`}
        disabled={busyId === f.id}
        onClick={() => void toggle(f)}
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-colors disabled:opacity-60 ${
          f.close ? 'bg-emerald-600 text-white' : 'border-2 border-outline-variant text-transparent hover:border-on-surface-variant'
        }`}
      >
        <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
          {f.close ? 'star' : 'check'}
        </span>
      </button>
    </li>
  );

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <Header />
      <SidebarNav />
      <div className="pt-16 md:pt-0 md:pl-20">
        <main className="w-full max-w-2xl mx-auto px-4 pt-4 pb-24 md:pb-8">
          <div className="flex items-center gap-3 pb-3">
            <Link to="/perfil" aria-label="Voltar ao perfil" className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors">
              <span className="material-symbols-outlined text-[24px]">arrow_back</span>
            </Link>
            <h1 className="text-xl font-bold">Melhores amigos</h1>
          </div>
          <p className="text-sm text-on-surface-variant pb-3">
            Escolha quem vê os Momentum que você compartilhar só com os melhores amigos. A lista é privada: ninguém é avisado quando você mexe nela.
          </p>

          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar amigos"
            aria-label="Pesquisar amigos"
            className="w-full py-3 bg-transparent border-0 border-b border-outline-variant outline-none text-base text-on-surface placeholder:text-on-surface-variant"
          />

          {error && <p role="alert" className="text-sm text-error py-2">{error}</p>}

          {friends === null ? (
            <p className="text-sm text-on-surface-variant text-center py-16">Carregando...</p>
          ) : friends.length === 0 ? (
            <p className="text-sm text-on-surface-variant text-center py-16">
              {query ? 'Ninguém encontrado.' : 'Você ainda não tem amigos. Adicione amigos para montar a lista.'}
            </p>
          ) : (
            <>
              {inList.length > 0 && (
                <section aria-label="Na sua lista">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant pt-4 pb-1">Na sua lista ({closeCount})</h2>
                  <ul>{inList.map(row)}</ul>
                </section>
              )}
              {others.length > 0 && (
                <section aria-label="Seus amigos">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant pt-4 pb-1">Seus amigos</h2>
                  <ul>{others.map(row)}</ul>
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};
