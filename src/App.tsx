import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SidebarProvider, useSidebar } from './context/SidebarContext';
import { ThemeProvider } from './context/ThemeContext';
import { CreatePostModal } from './components/CreatePostModal';
import { BottomNav } from './components/BottomNav';
import { Login } from './pages/Login';
import { Feed } from './pages/Feed';
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
        <SidebarProvider>
          <Suspense fallback={<RouteFallback />}>
          <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/post/:id" element={<PostDetail />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/perfil/:username" element={<ProfilePage />} />
          <Route path="/perfil/:username/:section" element={<ProfileSection />} />
          <Route path="/u/:username/:section" element={<ProfileSection />} />
          <Route path="/u/:username" element={<ProfilePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/:username" element={<ProfilePage />} />
          <Route path="/settings/profile" element={<ProfileSettings />} />
          <Route path="/configuracoes/perfil" element={<ProfileSettings />} />
          <Route path="/settings/account" element={<AccountSettings />} />
          <Route path="/configuracoes/conta" element={<AccountSettings />} />
          <Route path="/e/:slug" element={<CommunityDetail />} />
          <Route path="/c/:slug" element={<CommunityDetail />} />
          <Route path="/comunidade/:slug" element={<CommunityDetail />} />
          <Route path="/comunidades/:slug" element={<CommunityDetail />} />
          <Route path="/comunidades" element={<Communities />} />
          <Route path="/notificacoes" element={<Notifications />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/mensagens" element={<DirectMessages />} />
          <Route path="/grupos/:id" element={<DirectMessages />} />
          <Route path="/shorts" element={<Shorts />} />
          <Route path="/videos" element={<Navigate to="/shorts" replace />} />
          <Route path="/admin" element={<Admin />} />
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
      </ThemeProvider>
    </BrowserRouter>
  );
};

export default App;
