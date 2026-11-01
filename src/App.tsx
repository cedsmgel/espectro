import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
const Communities = lazyNamed(() => import('./pages/Communities'), 'Communities');
const CommunityDetail = lazyNamed(() => import('./pages/CommunityDetail'), 'CommunityDetail');
const DirectMessages = lazyNamed(() => import('./pages/DirectMessages'), 'DirectMessages');
const Shorts = lazyNamed(() => import('./pages/Shorts'), 'Shorts');
const Admin = lazyNamed(() => import('./pages/Admin'), 'Admin');
const Notifications = lazyNamed(() => import('./pages/Notifications'), 'Notifications');
const ProfilePage = lazyNamed(() => import('./pages/ProfilePage'), 'ProfilePage');
const AccountData = lazyNamed(() => import('./pages/AccountData'), 'AccountData');
const DeleteAccount = lazyNamed(() => import('./pages/DeleteAccount'), 'DeleteAccount');
const Home = lazyNamed(() => import('./pages/Home'), 'Home');
const Friends = lazyNamed(() => import('./pages/Friends'), 'Friends');
const ProfileSection = lazyNamed(() => import('./pages/ProfileSection'), 'ProfileSection');
const ProfileSettings = lazyNamed(() => import('./pages/ProfileSettings'), 'ProfileSettings');
const AccountSettings = lazyNamed(() => import('./pages/AccountSettings'), 'AccountSettings');
const PostDetail = lazyNamed(() => import('./pages/PostDetail'), 'PostDetail');

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

export const App: React.FC = () => {
  return (
    <BrowserRouter>
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
          <Route path="/configuracoes/dados" element={<RequireAuth><AccountData /></RequireAuth>} />
          <Route path="/configuracoes/excluir-conta" element={<RequireAuth><DeleteAccount /></RequireAuth>} />
          <Route path="/configuracoes/conta" element={<AccountSettings />} />
          <Route path="/e/:slug" element={<CommunityDetail />} />
          <Route path="/c/:slug" element={<CommunityDetail />} />
          <Route path="/comunidade/:slug" element={<CommunityDetail />} />
          <Route path="/comunidades/:slug" element={<CommunityDetail />} />
          <Route path="/comunidades" element={<Communities />} />
          <Route path="/amigos" element={<RequireAuth><Friends /></RequireAuth>} />
          <Route path="/notificacoes" element={<RequireAuth><Notifications /></RequireAuth>} />
          <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
          <Route path="/mensagens" element={<RequireAuth><DirectMessages /></RequireAuth>} />
          <Route path="/grupos/:id" element={<RequireAuth><DirectMessages /></RequireAuth>} />
          <Route path="/shorts" element={<Shorts />} />
          <Route path="/videos" element={<Navigate to="/shorts" replace />} />
          <Route path="/admin" element={<RequireAuth><Admin /></RequireAuth>} />
          <Route path="/login" element={<Login />} />
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
    </BrowserRouter>
  );
};

export default App;
