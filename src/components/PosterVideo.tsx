import React from 'react';
import { usePoster } from '../hooks/usePoster';

type Props = Omit<React.VideoHTMLAttributes<HTMLVideoElement>, 'src' | 'poster'> & { src: string };

// <video> que usa a capa quando ela existe e só baixa o arquivo quando a pessoa der play
export const PosterVideo: React.FC<Props> = ({ src, preload = 'metadata', ...rest }) => {
  const poster = usePoster(src);
  return <video {...rest} src={src} poster={poster} preload={poster ? 'none' : preload} />;
};
