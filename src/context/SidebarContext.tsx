import React, { createContext, useContext, useState } from 'react';
import { requestAuth } from '../lib/authEvents';
import { authStorage } from '../lib/api';

interface SidebarContextType {
  isExpanded: boolean;
  toggleSidebar: () => void;
  setIsExpanded: (expanded: boolean) => void;
  isCreatePostOpen: boolean;
  openCreatePostModal: () => void;
  closeCreatePostModal: () => void;
  hideBottomNav: boolean;
  setHideBottomNav: (hidden: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isExpanded: false,
  toggleSidebar: () => {},
  setIsExpanded: () => {},
  isCreatePostOpen: false,
  openCreatePostModal: () => {},
  closeCreatePostModal: () => {},
  hideBottomNav: false,
  setHideBottomNav: () => {},
});

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [hideBottomNav, setHideBottomNav] = useState(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const toggleSidebar = () => {
    setIsExpanded((prev) => !prev);
  };

  // Criar publicação exige conta: visitante recebe o modal de entrada (a API também valida o token)
  const openCreatePostModal = () => {
    if (!authStorage.isAuthenticated()) {
      requestAuth({ mode: 'login', reason: 'Para criar uma publicação, entre ou crie uma conta.' });
      return;
    }
    setIsCreatePostOpen(true);
  };
  const closeCreatePostModal = () => setIsCreatePostOpen(false);

  return (
    <SidebarContext.Provider
      value={{
        isExpanded,
        toggleSidebar,
        setIsExpanded,
        isCreatePostOpen,
        openCreatePostModal,
        closeCreatePostModal,
        hideBottomNav,
        setHideBottomNav,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => useContext(SidebarContext);
