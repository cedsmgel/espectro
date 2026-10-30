import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { Header } from "./components/Header";
import { Feed } from "./pages/Feed";
import { Communities } from "./pages/Communities";
import { Login } from "./pages/Login";
import { ChatPlaceholder } from "./pages/chat";
import { NewsPlaceholder } from "./pages/news";

export const App: React.FC = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-background font-sans text-on-surface">
        <Header onOpenCreatePost={() => setIsCreateModalOpen(true)} />

        <main className="flex-1">
          <Routes>
            <Route
              path="/"
              element={
                <Feed
                  isCreateModalOpen={isCreateModalOpen}
                  onCloseCreateModal={() => setIsCreateModalOpen(false)}
                />
              }
            />
            <Route path="/login" element={<Login />} />
            <Route path="/communities" element={<Communities />} />
            <Route path="/chat" element={<ChatPlaceholder />} />
            <Route path="/news" element={<NewsPlaceholder />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Footer do Stitch BentoFeed / Espectro */}
        <footer className="w-full bg-surface-container-lowest border-t border-outline-variant/20 shadow-[0_-1px_4px_rgba(15,23,42,0.02)]">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-outline">
              <span className="material-symbols-outlined text-[18px] text-primary">blur_on</span>
              <span className="font-bold text-primary">Espectro</span>
              <span className="ml-2">© 2026 Espectro Inc. Cloudflare Pages & D1.</span>
            </div>
            <div className="flex items-center gap-6 text-xs text-on-surface-variant font-medium">
              <Link to="/communities" className="hover:text-primary transition-colors">
                Comunidades
              </Link>
              <Link to="/news" className="hover:text-primary transition-colors">
                Tópicos
              </Link>
              <Link to="/chat" className="hover:text-primary transition-colors">
                Mensagens
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
};

export default App;
