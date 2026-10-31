import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SidebarProvider, useSidebar } from './context/SidebarContext';
import { ThemeProvider } from './context/ThemeContext';
import { CreatePostModal } from './components/CreatePostModal';
import { Login } from './pages/Login';
import { Feed } from './pages/Feed';
import { Communities } from './pages/Communities';
import { CommunityDetail } from './pages/CommunityDetail';
import { DirectMessages } from './pages/DirectMessages';
import { Videos } from './pages/Videos';
import { Notifications } from './pages/Notifications';
import { Profile } from './pages/Profile';
import { ProfilePage } from './pages/ProfilePage';
import { ProfileSettings } from './pages/ProfileSettings';
import { AccountSettings } from './pages/AccountSettings';

const GlobalCreatePostModal: React.FC = () => {
  const { isCreatePostOpen, closeCreatePostModal } = useSidebar();
  return (
    <CreatePostModal
      isOpen={isCreatePostOpen}
      onClose={closeCreatePostModal}
    />
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <SidebarProvider>
          <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/perfil/:username" element={<ProfilePage />} />
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
          <Route path="/videos" element={<Videos />} />
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <GlobalCreatePostModal />
        </SidebarProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

export default App;
