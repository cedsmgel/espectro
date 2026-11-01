import React, { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { authStorage, Community, MyActivity, Post, postsApi, ProfileFriend, profileSectionsApi, UserProfile, usersApi } from '../lib/api';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { PostCard } from '../components/PostCard';
import { PostSkeleton } from '../components/PostSkeleton';
import { MediaGrid } from '../components/MediaGrid';
import { ProfileAbout } from '../components/ProfileAbout';
import { EmptyState } from '../components/EmptyState';

export type ProfileSectionId = 'amigos' | 'sobre' | 'fotos' | 'videos' | 'comunidades' | 'salvos' | 'atividade';

const SECTIONS: { id: ProfileSectionId; label: string; icon: string; ownerOnly?: boolean }[] = [
  { id: 'sobre', label: 'Sobre', icon: 'info' },
  { id: 'amigos', label: 'Amigos', icon: 'group' },
  { id: 'comunidades', label: 'Comunidades', icon: 'forum' },
  { id: 'salvos', label: 'Salvos', icon: 'bookmark', ownerOnly: true },
  { id: 'atividade', label: 'Atividade', icon: 'history', ownerOnly: true },
];

const initialOf = (name: string) => name.charAt(0).toUpperCase();

const Avatar: React.FC<{ username: string; url?: string | null; size?: string }> = ({ username, url, size = 'w-11 h-11' }) => (
  <div className={`${size} rounded-full bg-surface-container-low flex items-center justify-center overflow-hidden shrink-0 text-sm font-bold text-on-surface`}>
    {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : initialOf(username)}
  </div>
);

const Empty: React.FC<{ text: string }> = ({ text }) => <p className="text-sm text-on-surface-variant text-center py-16">{text}</p>;

const FriendsSection: React.FC<{ username: string }> = ({ username }) => {
  const [friends, setFriends] = useState<ProfileFriend[] | null>(null);
  const [locked, setLocked] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      profileSectionsApi
        .friends(username, query.trim() || undefined)
        .then((res) => {
          if (!active) return;
          setFriends(res.friends);
          setLocked(res.locked);
        })
        .catch(() => active && setFriends([]));
    }, query ? 250 : 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [username, query]);

  if (locked) return <Empty text="Só amigos podem ver a lista de amigos deste perfil." />;
  return (
    <div className="flex flex-col">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Buscar amigos"
        className="w-full py-3 bg-transparent border-0 border-b border-outline-variant outline-none text-sm text-on-surface"
      />
      {friends === null ? (
        <Empty text="Carregando..." />
      ) : friends.length === 0 ? (
        <Empty text={query ? 'Ninguém encontrado.' : 'Nenhum amigo para mostrar.'} />
      ) : (
        <ul>
          {friends.map((f) => (
            <li key={f.id} className="border-b border-outline-variant">
              <Link to={`/perfil/${encodeURIComponent(f.username)}`} className="flex items-center gap-3 py-3 hover:bg-surface-container-low/60 transition-colors">
                <Avatar username={f.username} url={f.avatar_url} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-on-surface truncate">{f.name || `@${f.username}`}</p>
                  {f.name && <p className="text-xs text-on-surface-variant truncate">@{f.username}</p>}
                </div>
                {Boolean(f.mutual) && <span className="text-[11px] text-on-surface-variant shrink-0">Amigo em comum</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const PostsSection: React.FC<{ load: () => Promise<Post[]>; empty: string; grid?: boolean }> = ({ load, empty, grid }) => {
  const [posts, setPosts] = useState<Post[] | null>(null);
  useEffect(() => {
    let active = true;
    setPosts(null);
    load()
      .then((list) => active && setPosts(list))
      .catch(() => active && setPosts([]));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (posts === null) return <PostSkeleton />;
  if (posts.length === 0) return <Empty text={empty} />;
  if (grid) return <MediaGrid posts={posts} />;
  return (
    <div className="flex flex-col gap-5">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} onVote={() => {}} />
      ))}
    </div>
  );
};

const ActivitySection: React.FC = () => {
  const [activity, setActivity] = useState<MyActivity | null>(null);
  useEffect(() => {
    profileSectionsApi.activity().then(setActivity).catch(() => setActivity({ comments: [], votes: [] }));
  }, []);
  if (!activity) return <Empty text="Carregando..." />;
  const preview = (title: string | null, content: string) => (title || content || '').slice(0, 80);
  if (activity.comments.length === 0 && activity.votes.length === 0) return <Empty text="Sua atividade aparece aqui." />;
  return (
    <div className="flex flex-col gap-8">
      {activity.comments.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant pb-2 border-b border-outline-variant">Comentários</h2>
          <ul>
            {activity.comments.map((c) => (
              <li key={c.id} className="border-b border-outline-variant">
                <Link to={`/post/${c.post_id}`} className="block py-3 hover:bg-surface-container-low/60 transition-colors">
                  <p className="text-sm text-on-surface line-clamp-2">{c.content}</p>
                  <p className="text-xs text-on-surface-variant mt-1 truncate">em "{preview(c.post_title, c.post_content)}"</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {activity.votes.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant pb-2 border-b border-outline-variant">Votos</h2>
          <ul>
            {activity.votes.map((v) => (
              <li key={v.post_id} className="border-b border-outline-variant">
                <Link to={`/post/${v.post_id}`} className="flex items-center gap-3 py-3 hover:bg-surface-container-low/60 transition-colors">
                  <span className="material-symbols-outlined text-[20px] text-on-surface-variant">{v.vote > 0 ? 'arrow_upward' : 'arrow_downward'}</span>
                  <span className="text-sm text-on-surface truncate">{preview(v.post_title, v.post_content)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

// Subpáginas do perfil: Sobre, Amigos, Fotos, Vídeos, Comunidades e, só para o dono, Salvos e Atividade
export const ProfileSection: React.FC = () => {
  const { username: paramUsername, section } = useParams<{ username?: string; section: string }>();
  const loggedUser = authStorage.getUser();
  const username = paramUsername || loggedUser?.username || '';
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!username) return;
    setProfile(null);
    setFailed(false);
    usersApi
      .getByUsername(username)
      .then((data) => {
        setProfile(data.user);
        setCommunities(data.communities || []);
      })
      .catch(() => setFailed(true));
  }, [username]);

  const current = SECTIONS.find((s) => s.id === section);
  const base = `/perfil/${encodeURIComponent(username)}`;
  if (!current) return <Navigate to={base} replace />;

  const isSelf = Boolean(loggedUser && loggedUser.username.toLowerCase() === username.toLowerCase());
  if (current.ownerOnly && profile && !isSelf) return <Navigate to={base} replace />;
  const locked = Boolean(profile?.is_private && !isSelf && !profile?.is_friend);
  const visible = SECTIONS.filter((s) => !s.ownerOnly || isSelf);

  const body = () => {
    if (failed) return <Empty text="Não foi possível carregar este perfil." />;
    if (!profile) return <PostSkeleton />;
    if (locked && current.id !== 'sobre') return <Empty text="Este perfil é privado. Só amigos veem esta área." />;
    switch (current.id) {
      case 'sobre':
        return <ProfileAbout username={profile.username} isSelf={isSelf} />;
      case 'amigos':
        return <FriendsSection username={profile.username} />;
      case 'fotos':
        return (
          <PostsSection
            grid
            empty="Sem fotos por enquanto."
            load={() => postsApi.list({ author_name: profile.username, media: 'any', limit: 50 }).then((l) => l.filter((p) => p.media_type !== 'video'))}
          />
        );
      case 'videos':
        return <PostsSection grid empty="Sem vídeos por enquanto." load={() => postsApi.list({ author_name: profile.username, media: 'video', limit: 50 })} />;
      case 'comunidades':
        return communities.length === 0 ? (
          <Empty text="Nenhuma comunidade por enquanto." />
        ) : (
          <ul>
            {communities.map((c) => (
              <li key={c.id} className="border-b border-outline-variant">
                <Link to={`/c/${c.slug || c.id}`} className="flex items-center gap-3 py-3 hover:bg-surface-container-low/60 transition-colors">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0" style={{ backgroundColor: c.icon_color || '#404040' }}>
                    {initialOf(c.name)}
                  </div>
                  <span className="text-sm font-semibold text-on-surface truncate">{c.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        );
      case 'salvos':
        return <PostsSection empty="Você ainda não salvou nenhuma publicação." load={() => postsApi.list({ saved: true, limit: 50 })} />;
      case 'atividade':
        return <ActivitySection />;
    }
  };

  if (!username) {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex flex-col">
        <Header />
        <SidebarNav />
        <div className="pt-16 md:pt-0 md:pl-20 flex-1 flex items-center justify-center p-6">
          <EmptyState icon="account_circle" title="Acesse um perfil" description="Entre na sua conta para ver perfis." actionLabel="Entrar" actionLink="/login" className="max-w-md w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <Header />
      <SidebarNav />
      <div className="pt-16 md:pt-0 md:pl-20">
        <main className="w-full max-w-3xl mx-auto px-4 pt-4 pb-24 md:pb-8">
          <div className="flex items-center gap-3 pb-4">
            <Link to={base} aria-label="Voltar ao perfil" className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors">
              <span className="material-symbols-outlined text-[24px]">arrow_back</span>
            </Link>
            <Avatar username={username} url={profile?.avatar_url} />
            <div className="min-w-0">
              <p className="text-sm font-bold text-on-surface truncate">{profile?.name || `@${username}`}</p>
              {profile?.name && <p className="text-xs text-on-surface-variant truncate">@{username}</p>}
            </div>
          </div>

          <nav aria-label="Seções do perfil" className="flex overflow-x-auto scrollbar-none border-b border-outline-variant mb-4">
            {visible.map((s) => (
              <Link
                key={s.id}
                to={`${base}/${s.id}`}
                aria-current={s.id === current.id ? 'page' : undefined}
                className={`h-12 px-4 shrink-0 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider border-b-2 -mb-px transition-colors ${
                  s.id === current.id ? 'border-on-surface text-on-surface' : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{s.icon}</span>
                {s.label}
              </Link>
            ))}
          </nav>

          {body()}
        </main>
      </div>
    </div>
  );
};
