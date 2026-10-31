# Espectro

Rede social construída sobre a Cloudflare: React + Vite no front, Pages Functions no back,
D1 (banco), R2 (mídia) e Durable Objects (chat em tempo real).

## Estrutura

- `src/` — front-end (React, TypeScript, Tailwind)
- `functions/` — API (Cloudflare Pages Functions), em `functions/api/*`
- `chat-worker/` — Worker com o Durable Object `ChatRoom` (deploy separado)
- `migrations/` — schema do D1 (a única fonte de verdade do banco)

## Desenvolvimento local

```bash
npm ci
echo "JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")" > .dev.vars
npm run db:migrate:local
npm run build
npx wrangler pages dev dist
```

O `JWT_SECRET` precisa ter 32+ caracteres; sem ele a API recusa todas as requisições.

## Notificações push

Precisam de um par de chaves VAPID. Gere com `node scripts/generate-vapid.mjs` e:

- local: cole `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` no `.dev.vars`
- produção: `wrangler pages secret put VAPID_PUBLIC_KEY --project-name espectro` (e o mesmo para `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT`)

Sem as chaves, o servidor simplesmente não envia push. No iPhone o site precisa estar instalado na tela inicial.

## Deploy

1. Secret (uma vez): `wrangler pages secret put JWT_SECRET --project-name espectro`
2. Migrations: `npm run db:migrate:remote`
3. Chat: `npm run deploy:chat` (antes do Pages quando houver mudança no `ChatRoom`)
4. Pages: o push na `main` publica automaticamente.

## Verificações

`npm run check` e `npm run check:chat` rodam o TypeScript; o CI (`.github/workflows/ci.yml`) executa ambos e o build.
