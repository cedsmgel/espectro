import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Feed } from './pages/Feed';
import { Communities } from './pages/Communities';
import { CommunityDetail } from './pages/CommunityDetail';
import { DirectMessages } from './pages/DirectMessages';
import { Videos } from './pages/Videos';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Feed />} />
        <Route path="/e/:slug" element={<CommunityDetail />} />
        <Route path="/c/:slug" element={<CommunityDetail />} />
        <Route path="/comunidade/:slug" element={<CommunityDetail />} />
        <Route path="/comunidades/:slug" element={<CommunityDetail />} />
        <Route path="/comunidades" element={<Communities />} />
        <Route path="/mensagens" element={<DirectMessages />} />
        <Route path="/videos" element={<Videos />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
