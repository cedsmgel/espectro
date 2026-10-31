import React, { useEffect, useState } from 'react';
import { communitiesApi, Community, CreatePostData, Post, postsApi } from '../lib/api';
import { CreatePostForm } from './CreatePostForm';

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
    // Dispara evento global para que qualquer Feed atualize instantaneamente
    window.dispatchEvent(new CustomEvent('espectro:post-created', { detail: created }));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200">
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
