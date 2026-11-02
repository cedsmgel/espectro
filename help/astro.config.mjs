import { defineConfig } from 'astro/config';

// Site estático: nenhum JavaScript é enviado ao navegador sem necessidade.
// Troque `site` pelo domínio definitivo da central quando ele existir.
export default defineConfig({
  site: 'https://espectro-ajuda.pages.dev',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
});
