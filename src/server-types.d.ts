// O @types/react-dom não declara a versão "browser" do servidor (usa Web Streams, a que roda em Workers)
declare module 'react-dom/server.browser' {
  import type { ReactNode } from 'react';
  export function renderToReadableStream(
    children: ReactNode,
    options?: { onError?: (error: unknown) => void; bootstrapScripts?: string[] }
  ): Promise<ReadableStream<Uint8Array> & { allReady: Promise<void> }>;
}
