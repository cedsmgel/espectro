import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { SidebarProvider, useSidebar } from './context/SidebarContext';
import { ThemeProvider } from './context/ThemeContext';
import { CreatePostModal } from './components/CreatePostModal';
import { BottomNav } from './components/BottomNav';
import { Login } from './pages/Login';
import { AuthProvider } from './context/AuthContext';
import { RequireAuth } from './components/auth/RequireAuth';
import { usePresenceHeartbeat } from './hooks/usePresence';
import { lazyNamed } from './lib/lazy';
import { PushPrompt } from './components/PushPrompt';
import { InstallPrompt } from './components/InstallPrompt';
import { OfflineBanner } from './components/OfflineBanner';

// Só o feed e o login entram no pacote inicial; as outras telas carregam ao abrir
const Activity = lazyNamed(() => import('./pages/Activity'), 'Activity');
const CloseFriends = lazyNamed(() => import('./pages/CloseFriends'), 'CloseFriends');
const Explore = lazyNamed(() => import('./pages/Explore'), 'Explore');
const Communities = lazyNamed(() => import('./pages/Communities'), 'Communities');
const CommunityDetail = lazyNamed(() => import('./pages/CommunityDetail'), 'CommunityDetail');
const DirectMessages = lazyNamed(() => import('./pages/DirectMessages'), 'DirectMessages');
const Shorts = lazyNamed(() => import('./pages/Shorts'), 'Shorts');
const Admin = lazyNamed(() => import('./pages/Admin'), 'Admin');
const Notifications = lazyNamed(() => import('./pages/Notifications'), 'Notifications');
const ProfilePage = lazyNamed(() => import('./pages/ProfilePage'), 'ProfilePage');
const DeleteAccount = lazyNamed(() => import('./pages/DeleteAccount'), 'DeleteAccount');
const ResetPassword = lazyNamed(() => import('./pages/ResetPassword'), 'ResetPassword');
const VerifyEmail = lazyNamed(() => import('./pages/VerifyEmail'), 'VerifyEmail');
const GoogleCallback = lazyNamed(() => import('./pages/GoogleCallback'), 'GoogleCallback');
const HashtagPage = lazyNamed(() => import('./pages/HashtagPage'), 'HashtagPage');
const Home = lazyNamed(() => import('./pages/Home'), 'Home');
const Friends = lazyNamed(() => import('./pages/Friends'), 'Friends');
const ProfileSection = lazyNamed(() => import('./pages/ProfileSection'), 'ProfileSection');
const ProfileSettings = lazyNamed(() => import('./pages/ProfileSettings'), 'ProfileSettings');
const AccountSettings = lazyNamed(() => import('./pages/AccountSettings'), 'AccountSettings');
const PostDetail = lazyNamed(() => import('./pages/PostDetail'), 'PostDetail');

// Endereços antigos de comunidade (/c/nome, /comunidade/nome...) levam ao oficial: /e/nome
const RedirectToCommunity: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate to={`/e/${encodeURIComponent(slug || '')}`} replace />;
};

const RouteFallback: React.FC = () => (
  <div className="min-h-dvh flex items-center justify-center" role="status" aria-label="Carregando">
    <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
  </div>
);

const GlobalCreatePostModal: React.FC = () => {
  const { isCreatePostOpen, closeCreatePostModal } = useSidebar();
  return (
    <CreatePostModal
      isOpen={isCreatePostOpen}
      onClose={closeCreatePostModal}
    />
  );
};

const PresenceHeartbeat: React.FC = () => {
  usePresenceHeartbeat();
  return null;
};

// Antes de hidratar o HTML do servidor, carrega o código da tela daquela rota (senão o Suspense mostraria o spinner no lugar do conteúdo)
export async function preloadRoute(pathname: string): Promise<void> {
  if (pathname === '/') await import('./pages/Home');
}

export const AppContent: React.FC = () => {
  return (
    <>
      <ThemeProvider>
        <AuthProvider>
        <SidebarProvider>
          <Suspense fallback={<RouteFallback />}>
          <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/post/:id" element={<PostDetail />} />
          <Route path="/perfil" element={<RequireAuth><ProfilePage /></RequireAuth>} />
          <Route path="/perfil/:username" element={<ProfilePage />} />
          <Route path="/perfil/:username/:section" element={<ProfileSection />} />
          <Route path="/u/:username/:section" element={<ProfileSection />} />
          <Route path="/u/:username" element={<ProfilePage />} />
          <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
          <Route path="/profile/:username" element={<ProfilePage />} />
          <Route path="/settings/profile" element={<RequireAuth><ProfileSettings /></RequireAuth>} />
          <Route path="/configuracoes/perfil" element={<RequireAuth><ProfileSettings /></RequireAuth>} />
          <Route path="/settings/account" element={<RequireAuth><AccountSettings /></RequireAuth>} />
          <Route path="/configuracoes/dados" element={<Navigate to="/settings/account" replace />} />
          <Route path="/configuracoes/seguranca" element={<Navigate to="/settings/account" replace />} />
          <Route path="/configuracoes/excluir-conta" element={<RequireAuth><DeleteAccount /></RequireAuth>} />
          <Route path="/configuracoes/conta" element={<AccountSettings />} />
          <Route path="/e/:slug" element={<CommunityDetail />} />
          <Route path="/c/:slug" element={<RedirectToCommunity />} />
          <Route path="/comunidade/:slug" element={<RedirectToCommunity />} />
          <Route path="/comunidades/:slug" element={<RedirectToCommunity />} />
          <Route path="/comunidades" element={<Communities />} />
          <Route path="/explorar" element={<Explore />} />
          <Route path="/atividade" element={<RequireAuth><Activity /></RequireAuth>} />
          <Route path="/atividade/:section" element={<RequireAuth><Activity /></RequireAuth>} />
          <Route path="/melhores-amigos" element={<RequireAuth><CloseFriends /></RequireAuth>} />
          <Route path="/tag/:tag" element={<HashtagPage />} />
          <Route path="/hashtag/:tag" element={<HashtagPage />} />
          <Route path="/amigos" element={<RequireAuth><Friends /></RequireAuth>} />
          <Route path="/notificacoes" element={<RequireAuth><Notifications /></RequireAuth>} />
          <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
          <Route path="/mensagens" element={<RequireAuth><DirectMessages /></RequireAuth>} />
          <Route path="/grupos/:id" element={<RequireAuth><DirectMessages /></RequireAuth>} />
          <Route path="/shorts" element={<Shorts />} />
          <Route path="/videos" element={<Navigate to="/shorts" replace />} />
          <Route path="/admin" element={<RequireAuth><Admin /></RequireAuth>} />
          <Route path="/login" element={<Login />} />
          <Route path="/redefinir-senha" element={<ResetPassword />} />
          <Route path="/entrar/google" element={<GoogleCallback />} />
          <Route path="/confirmar-email" element={<VerifyEmail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
          </Suspense>
        <GlobalCreatePostModal />
        <PresenceHeartbeat />
        <PushPrompt />
        <InstallPrompt />
        <OfflineBanner />
        <BottomNav />
        </SidebarProvider>
        </AuthProvider>
      </ThemeProvider>
    </>
  );
};

export const App: React.FC = () => (
  <BrowserRouter>
    <AppContent />
  </BrowserRouter>
);

export default App;
