import React from 'react';
import { StaticRouter } from 'react-router-dom/server';
import { renderToReadableStream } from 'react-dom/server.browser';
import { AppContent } from './App';

// Renderização no servidor: devolve o HTML do app para uma URL (sempre como visitante).
// Usada no build (SSG da landing) e, depois, nas Pages Functions (SSR das páginas públicas).
export async function render(url: string): Promise<string> {
  const stream = await renderToReadableStream(
    <StaticRouter location={url}>
      <AppContent />
    </StaticRouter>
  );
  await stream.allReady;
  return await new Response(stream).text();
}
