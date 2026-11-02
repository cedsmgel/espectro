import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { authStorage } from '../lib/api';
import { useIsAdmin } from '../hooks/useIsAdmin';

interface Entry {
  to?: string;
  onClick?: () => void;
  icon: string;
  label: string;
  hint?: string;
  danger?: boolean;
}

interface Category {
  title: string;
  entries: Entry[];
}

const Row: React.FC<{ entry: Entry }> = ({ entry }) => {
  const body = (
    <>
      <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${entry.danger ? 'bg-error/10 text-error' : 'bg-surface-container text-on-surface'}`}>
        <span className="material-symbols-outlined text-[20px]">{entry.icon}</span>
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className={`block text-sm font-semibold truncate ${entry.danger ? 'text-error' : 'text-on-surface'}`}>{entry.label}</span>
        {entry.hint && <span className="block text-xs text-on-surface-variant truncate">{entry.hint}</span>}
      </span>
      {!entry.danger && <span className="material-symbols-outlined text-[20px] text-on-surface-variant shrink-0">chevron_right</span>}
    </>
  );
  const cls = 'w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container/60 transition-colors cursor-pointer';
  return entry.to ? (
    <Link to={entry.to} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={entry.onClick} className={cls}>
      {body}
    </button>
  );
};

// Configurações e atividade: tudo da conta reunido em categorias
export const MenuPage: React.FC = () => {
  const navigate = useNavigate();
  const user = authStorage.getUser();
  const isAdmin = useIsAdmin();

  const logout = () => {
    authStorage.clear();
    navigate('/', { replace: true });
  };
  const switchAccount = () => {
    authStorage.clear();
    navigate('/login');
  };

  const categories: Category[] = user
    ? [
        {
          title: 'Sua conta',
          entries: [
            { to: '/settings/account', icon: 'manage_accounts', label: 'Central de contas', hint: 'Senha, aparelhos conectados, seus dados e exclusão' },
            { to: '/settings/profile', icon: 'person', label: 'Editar perfil', hint: 'Foto, nome, biografia e informações' },
          ],
        },
        {
          title: 'Como você usa o Espectro',
          entries: [
            { to: '/atividade', icon: 'history', label: 'Sua atividade', hint: 'Curtidas, comentários e publicações vistas' },
            { to: `/perfil/${encodeURIComponent(user.username)}/salvos`, icon: 'bookmark', label: 'Salvos' },
            { to: '/atividade/arquivados', icon: 'inventory_2', label: 'Momentum arquivados' },
            { to: '/amigos', icon: 'group', label: 'Amigos', hint: 'Lista, pedidos e sugestões' },
            { to: '/melhores-amigos', icon: 'star', label: 'Melhores amigos' },
          ],
        },
        {
          title: 'Quem pode ver seu conteúdo',
          entries: [
            { to: '/settings/privacy', icon: 'lock', label: 'Privacidade da conta', hint: 'Perfil privado e visibilidade das publicações' },
            { to: '/melhores-amigos', icon: 'star', label: 'Melhores amigos', hint: 'Compartilhe Momentum só com eles' },
            { to: '/atividade/bloqueados', icon: 'block', label: 'Contas bloqueadas' },
          ],
        },
        {
          title: 'Como outras pessoas podem interagir com você',
          entries: [
            { to: '/settings/privacy', icon: 'edit_note', label: 'Scraps no seu mural', hint: 'Quem pode escrever no seu perfil' },
            { to: '/mensagens', icon: 'chat_bubble', label: 'Mensagens', hint: 'Conversas, grupos e preferências do chat' },
            { to: '/atividade/bloqueados', icon: 'block', label: 'Bloqueios' },
          ],
        },
        {
          title: 'O que você vê',
          entries: [
            { to: '/settings/privacy', icon: 'tune', label: 'Personalização do feed', hint: 'Como o Espectro adapta o Para você' },
            { to: '/comunidades', icon: 'forum', label: 'Comunidades' },
            { to: '/notificacoes', icon: 'notifications', label: 'Notificações' },
          ],
        },
        {
          title: 'Configurações de mídia',
          entries: [{ to: '/settings/media', icon: 'perm_media', label: 'Mídia', hint: 'Vídeos automáticos e qualidade das fotos enviadas' }],
        },
        {
          title: 'Informações de suporte',
          entries: [
            { to: '/suporte', icon: 'help', label: 'Ajuda e suporte', hint: 'Perguntas frequentes e como denunciar' },
            ...(isAdmin ? [{ to: '/admin', icon: 'gavel', label: 'Moderação' }] : []),
          ],
        },
        {
          title: 'Entrada e saída da conta',
          entries: [
            { onClick: switchAccount, icon: 'switch_account', label: 'Trocar de conta', hint: 'Sai desta conta e abre a tela de entrada' },
            { onClick: logout, icon: 'logout', label: 'Sair', danger: true },
          ],
        },
      ]
    : [
        { title: 'Informações de suporte', entries: [{ to: '/suporte', icon: 'help', label: 'Ajuda e suporte' }] },
        { title: 'Entrada e saída da conta', entries: [{ to: '/login', icon: 'login', label: 'Entrar ou criar conta' }] },
      ];

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <Header />
      <SidebarNav />
      <div className="pt-16 md:pt-0 md:pl-20">
        <main className="w-full max-w-xl mx-auto px-3 sm:px-4 pt-4 pb-28 md:pb-10">
          <h1 className="text-xl font-bold px-1 pb-1">Configurações e atividade</h1>
          {user && <p className="text-xs text-on-surface-variant px-1 pb-4">Conectado como @{user.username}</p>}
          <div className="flex flex-col gap-5 mt-2">
            {categories.map((category) => (
              <section key={category.title} aria-label={category.title}>
                <h2 className="px-1 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{category.title}</h2>
                <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden divide-y divide-outline-variant">
                  {category.entries.map((entry) => (
                    <Row key={`${category.title}-${entry.label}`} entry={entry} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
};

export default MenuPage;
