import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Header } from "./components/Header";
import { Feed } from "./pages/Feed";
import { Communities } from "./pages/Communities";
import { Login } from "./pages/Login";
import { ChatPlaceholder } from "./pages/chat";
import { NewsPlaceholder } from "./pages/news";

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-[#d2dff1]">
        <Header />
        <main className="flex-1 pb-10">
          <Routes>
            <Route path="/" element={<Feed />} />
            <Route path="/login" element={<Login />} />
            <Route path="/communities" element={<Communities />} />
            <Route path="/chat" element={<ChatPlaceholder />} />
            <Route path="/news" element={<NewsPlaceholder />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <footer className="text-center py-4 text-xs text-gray-500 border-t border-[#bfd4f2] bg-white">
          Espectro © 2026 • Inspirado na era de ouro das redes sociais • Cloudflare Pages & D1
        </footer>
      </div>
    </BrowserRouter>
  );
};

export default App;
