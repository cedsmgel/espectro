import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SidebarProvider, useSidebar } from './context/SidebarContext';
import { CreatePostModal } from './components/CreatePostModal';
import { Login } from './pages/Login';
import { Feed } from './pages/Feed';
import { Communities } from './pages/Communities';
import { CommunityDetail } from './pages/CommunityDetail';
import { DirectMessages } from './pages/DirectMessages';
import { Videos } from './pages/Videos';
import { Notifications } from './pages/Notifications';
import { Profile } from './pages/Profile';
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
      <SidebarProvider>
        <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/u/:username" element={<Profile />} />
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
    </BrowserRouter>
  );
};

export default App;
