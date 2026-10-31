import React, { createContext, useContext, useState } from 'react';

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
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('espectro_sidebar_expanded');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('espectro_sidebar_expanded', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const openCreatePostModal = () => setIsCreatePostOpen(true);
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
