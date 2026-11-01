import React, { Suspense, lazy } from 'react';

// O seletor e a lista de emojis pesam ~400 KB: só baixam na primeira vez que alguém abre o seletor
const Inner = lazy(async () => {
  const [{ default: Picker }, { default: data }] = await Promise.all([import('@emoji-mart/react'), import('@emoji-mart/data')]);
  const Loaded: React.FC<Record<string, unknown>> = (props) => <Picker data={data} {...props} />;
  return { default: Loaded };
});

export const EmojiPicker: React.FC<Record<string, unknown>> = (props) => (
  <Suspense fallback={<div className="w-[352px] max-w-[90vw] h-[435px] max-h-[60vh] flex items-center justify-center bg-surface-container-lowest text-xs text-on-surface-variant">Carregando emojis...</div>}>
    <Inner {...props} />
  </Suspense>
);
