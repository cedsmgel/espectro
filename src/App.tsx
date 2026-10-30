import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SidebarProvider } from './context/SidebarContext';
import { Login } from './pages/Login';
import { Feed } from './pages/Feed';
import { Communities } from './pages/Communities';
import { CommunityDetail } from './pages/CommunityDetail';
import { DirectMessages } from './pages/DirectMessages';
import { Videos } from './pages/Videos';
import { Notifications } from './pages/Notifications';
import { Profile } from './pages/Profile';
import { ProfileSettings } from './pages/ProfileSettings';

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
      </SidebarProvider>
    </BrowserRouter>
  );
};

export default App;
