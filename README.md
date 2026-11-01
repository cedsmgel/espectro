# Espectro

Rede social construída sobre a Cloudflare: React + Vite no front, Pages Functions no back,
D1 (banco), R2 (mídia) e Durable Objects (chat em tempo real). Roda no plano gratuito (ver `docs/analise-cloudflare.md`).

A landing é gerada no build (SSG) e as páginas públicas (post, perfil, comunidade, hashtag) saem com o corpo em HTML
no servidor (SSR por texto), para SEO e prévias de link; o resto é uma SPA. Mais em `docs/arquitetura-e-recursos.md`.

## Estrutura

- `src/` — front-end (React, TypeScript, Tailwind)
- `functions/` — API (Cloudflare Pages Functions), em `functions/api/*`
- `chat-worker/` — Worker com o Durable Object `ChatRoom` e o cron de manutenção (deploy separado)
- `migrations/` — schema do D1 (a única fonte de verdade do banco)
- `scripts/` — `prerender.mjs` (SSG da landing no build) e `generate-vapid.mjs`
- `public/` — arquivos estáticos, `_headers` (CSP e demais cabeçalhos) e `boot.js` (tema e sessão antes da pintura)
- `docs/` — documentação (índice abaixo)

## Desenvolvimento local

```bash
npm ci
echo "JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")" > .dev.vars
npm run db:migrate:local
npm run build
npx wrangler pages dev dist
```

`npm run build` roda três passos: build do navegador, build de servidor (`vite build --ssr`) e a pré-renderização da landing.
Se a pré-renderização falhar, o build continua e o site publica sem a landing pronta.

O servidor local lê `_headers` e `.dev.vars` só ao iniciar: reinicie-o depois de mudar um deles. Sem `TURNSTILE_SITEKEY` no
`.dev.vars`, o Turnstile fica desligado (cadastro e login funcionam sem desafio).

O `JWT_SECRET` precisa ter 32+ caracteres; sem ele a API recusa todas as requisições.

## Notificações push

Precisam de um par de chaves VAPID. Gere com `node scripts/generate-vapid.mjs` e:

- local: cole `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` no `.dev.vars`
- produção: `wrangler pages secret put VAPID_PUBLIC_KEY --project-name espectro` (e o mesmo para `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT`)

Sem as chaves, o servidor simplesmente não envia push. No iPhone o site precisa estar instalado na tela inicial.

## Deploy

1. Secret (uma vez): `wrangler pages secret put JWT_SECRET --project-name espectro`
2. Migrations: `npm run db:migrate:remote`
3. Chat: `npm run deploy:chat` (antes do Pages quando houver mudança no `ChatRoom` ou na manutenção agendada; esse Worker tem o cron `7 * * * *` e os bindings do D1 e do R2)
4. Pages: o push na `main` publica automaticamente.

Secrets e variáveis (JWT, Google, Resend, Turnstile, Giphy, VAPID...): tabela em `docs/arquitetura-e-recursos.md`.

## Verificações

`npm run check` e `npm run check:chat` rodam o TypeScript; o CI (`.github/workflows/ci.yml`) executa ambos e o build.

## Documentação

| Documento | Assunto |
| --- | --- |
| [arquitetura-e-recursos.md](docs/arquitetura-e-recursos.md) | Visão geral: entrega do site, dados, recursos sociais, segurança, variáveis |
| [analise-cloudflare.md](docs/analise-cloudflare.md) | Serviços da Cloudflare, limites do plano gratuito e plano em fases |
| [algoritmo-do-feed.md](docs/algoritmo-do-feed.md) | Ranking do "Para Você" |
| [plano-ml.md](docs/plano-ml.md) | Plano de Machine Learning |
| [comunidades-reddit-orkut.md](docs/comunidades-reddit-orkut.md) | Modelo de comunidades |
| [privacidade-lgpd-dmca.md](docs/privacidade-lgpd-dmca.md) | Privacidade, LGPD e direitos autorais |
| [login-google.md](docs/login-google.md), [recuperacao-confirmacao-2fa.md](docs/recuperacao-confirmacao-2fa.md) | Login, recuperação, confirmação de e-mail e 2FA |
| [mapas-no-chat.md](docs/mapas-no-chat.md) | Localização no chat |
