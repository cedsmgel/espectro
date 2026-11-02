import { useEffect, useState } from 'react';
import { videoPosterUrl } from '../lib/mediaThumb';

// Capa do vídeo, só se ela existir (vídeos antigos não têm): confere carregando a imagem uma vez
export function usePoster(videoUrl: string | null | undefined): string | undefined {
  const [poster, setPoster] = useState<string | undefined>(undefined);
  useEffect(() => {
    setPoster(undefined);
    const candidate = videoPosterUrl(videoUrl);
    if (!candidate) return;
    let active = true;
    const img = new Image();
    img.onload = () => active && setPoster(candidate);
    img.src = candidate;
    return () => {
      active = false;
      img.onload = null;
    };
  }, [videoUrl]);
  return poster;
}
