# Central de Ajuda do Espectro

Site estático (Astro) separado da rede social. Plano completo em `docs/plano-central-de-ajuda.md`.

## Comandos (dentro de `help/`)
- `npm install`, depois `npm run dev` (local), `npm run build`, `npm run check`.

## Conteúdo
- Artigos em `src/content/artigos/<categoria>/<slug>.md` (campos: `titulo`, `categoria`, `resumo`, `atualizado`, `ordem`).
- Categorias em `src/categorias.ts` (mesmos nomes do menu do app).

## Deploy
- Projeto Cloudflare Pages `espectro-ajuda` (https://espectro-ajuda.pages.dev). Manual: `npm run build` e `npx wrangler pages deploy dist --project-name espectro-ajuda --branch main`.
- Para publicar a cada merge, conectar o projeto ao repositório no painel da Cloudflare (raiz `help`, comando `npm run build`, saída `dist`).

## Antes do lançamento
- Remover `noindex` em `src/layouts/Base.astro` e liberar `public/robots.txt`.
- Trocar `site` em `astro.config.mjs` e `APP_URL` em `src/categorias.ts` pelos domínios definitivos.
