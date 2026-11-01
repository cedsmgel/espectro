import React, { useEffect, useState } from 'react';
import { communitiesApi, Community, CreatePostData, Post, postsApi } from '../lib/api';
import { CreatePostForm } from './CreatePostForm';
import { useVisualViewport } from '../hooks/useVisualViewport';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: (post: Post) => void;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  onPostCreated,
}) => {
  const [communities, setCommunities] = useState<Community[]>([]);
  const { height, isMobile, isKeyboardOpen } = useVisualViewport();

  useEffect(() => {
    if (isOpen) {
      communitiesApi
        .list()
        .then((data) => setCommunities(data))
        .catch(() => {});
    }
  }, [isOpen]);

  // Fecha modal ao pressionar ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePostSubmit = async (data: CreatePostData) => {
    const created = await postsApi.create(data);
    if (onPostCreated) {
      onPostCreated(created);
    }
    // Dispara evento global para que qualquer Feed ou lista atualize instantaneamente
    window.dispatchEvent(new CustomEvent('espectro:post-created', { detail: created }));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-hidden h-[100dvh]"
      style={{
        height: isMobile && isKeyboardOpen && height ? `${height}px` : undefined,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Modal: Tela inteira no mobile respeitando a viewport dinâmica (100dvh / visualViewport no teclado), Janela no Desktop (max-w-2xl, rounded-2xl) */}
      <div
        style={{
          height: isMobile && isKeyboardOpen && height ? `${height}px` : undefined,
        }}
        className="w-full h-[100dvh] sm:max-w-2xl sm:h-[88vh] sm:max-h-[820px] bg-surface-container-lowest sm:rounded-2xl border-0 sm:border border-outline-variant shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 fade-in duration-250 text-on-surface overscroll-contain"
      >
        <CreatePostForm
          onPostCreated={handlePostSubmit}
          communities={communities}
          isModal={true}
          onClose={onClose}
        />
      </div>
    </div>
  );
};
