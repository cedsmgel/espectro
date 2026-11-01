import React, { useState } from 'react';
import { thumbUrl } from '../lib/mediaThumb';

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src: string };

// Mostra a miniatura da foto; se ela não existir (foto antiga, GIF), cai para a imagem original
export const ThumbImg: React.FC<Props> = ({ src, onError, loading = 'lazy', decoding = 'async', alt = '', ...rest }) => {
  const [useOriginal, setUseOriginal] = useState(false);
  const thumb = thumbUrl(src);
  return (
    <img
      {...rest}
      alt={alt}
      loading={loading}
      decoding={decoding}
      src={useOriginal ? src : thumb}
      onError={(e) => {
        if (!useOriginal && thumb !== src) setUseOriginal(true);
        else onError?.(e);
      }}
    />
  );
};
