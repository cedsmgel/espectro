// SSG: depois do build do navegador e do build de servidor, gera páginas estáticas com o HTML já renderizado.
// Hoje: a landing (/) vira dist/landing.html. A Pages Function de "/" entrega esse arquivo.
process.env.NODE_ENV ||= 'production';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const dist = process.env.DIST_DIR || 'dist';
const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const { render } = await import(pathToFileURL(path.resolve('dist-ssr/entry-server.js')).href);

function page(html) {
  if (!template.includes('<div id="root"></div>')) throw new Error('index.html sem <div id="root"></div>');
  return template.replace('<div id="root"></div>', `<div id="root" data-ssr="1">${html}</div>`);
}

try {
  const landing = await render('/');
  if (!landing.includes('Espectro')) throw new Error('A landing renderizou vazia');
  fs.writeFileSync(path.join(dist, 'landing.html'), page(landing));
  console.log(`prerender: landing.html (${(landing.length / 1024).toFixed(1)} KB de HTML)`);
} catch (err) {
  // Sem landing pré-renderizada o site continua funcionando como antes
  console.warn('prerender: falhou, seguindo sem SSG:', err);
}
