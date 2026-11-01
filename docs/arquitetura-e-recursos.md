# Arquitetura e recursos do Espectro

Visão geral do que existe hoje (nov 2026). Cada tema aponta para o documento com o detalhe. O projeto roda no **plano gratuito** da Cloudflare, e isso molda várias decisões (ver `docs/analise-cloudflare.md`).

## 1. Como o site é entregue

| Parte | Como funciona | Onde |
| --- | --- | --- |
| Landing (`/`) | **SSG**: o build renderiza o React da landing em `dist/landing.html`; a Function de `/` entrega esse arquivo | `scripts/prerender.mjs`, `functions/index.ts`, `src/entry-server.tsx` |
| Páginas públicas (`/post/:id`, `/perfil/:usuario`, `/e/:slug`, `/tag/:tag`) | **SSR por texto**: a Function monta o corpo em HTML (texto, autor, comentários, listas) e o app do navegador assume o lugar. Cache de borda de 60 s para visitantes | `functions/_shared/seo.ts`, `seoPages.ts`, `seoHtml.ts` |
| Resto do app (feed, mensagens, configurações, atividade) | Client-side (SPA React) | `src/` |
| SEO | Título, descrição, canonical, Open Graph, JSON-LD, `sitemap.xml`, `robots.txt`; conteúdo privado sai genérico e com `noindex` | `functions/sitemap.xml.ts`, `functions/robots.txt.ts`, `public/_headers` |

Regras: quem está logado nunca hidrata o HTML do servidor (o app monta do zero e o HTML pronto fica escondido por CSS antes da pintura). React no servidor roda só no build (landing); nas Functions o limite de 10 ms de CPU pede HTML por texto.

## 2. Dados e serviços

- **D1** (`migrations/`, hoje até a 0039), **R2** (mídia, servida por `/api/media/*`), **Durable Object** de chat (`chat-worker/`, que também tem o **cron** de manutenção, de hora em hora).
- **Pulso** (`POST /api/pulse`): uma única chamada a cada 60 s por aba marca presença e traz os selos (mensagens e notificações). Store compartilhado em `src/lib/pulse.ts`.
- **Cache de borda** para leituras públicas de visitantes (`functions/_shared/edgeCache.ts`): comunidades, hashtags, posts, busca.
- Limite de taxa em D1 só nos endpoints sensíveis; presença e eventos não gravam no limitador.

## 3. Recursos sociais

| Recurso | Resumo | Detalhe |
| --- | --- | --- |
| Feed | Abas Para Você (ranqueado), Seguindo (cronológico) e Em alta; no celular as publicações vão de borda a borda | `docs/algoritmo-do-feed.md` |
| Publicação | Compositor em tela cheia no estilo do Reddit; foto ou vídeo sem título, com a legenda embaixo; "Curtido por" e comentários em destaque com amigos primeiro | `src/components/CreatePostForm.tsx`, `PostCard.tsx`, `functions/_shared/postSocial.ts` |
| Votos | Contador compacto `↑ N | ↓` (upvote com contagem, downvote só com a seta) | `PostCard.tsx` |
| Comunidades | Prefixo `e/`, tipos pública, restrita e privada, regras, hashtags da comunidade, moderação, banimentos, fixados, aparência | `docs/comunidades-reddit-orkut.md` |
| Hashtags | Em publicações, página da hashtag, em alta, sugestões ao digitar | `functions/_shared/hashtags.ts` |
| Seguir | Mão única; perfil privado só por amizade; listas de seguidores e seguindo | `functions/api/follows.ts`, `profile_follows.ts` |
| Amizade | Mútua; pedidos pendentes; bloqueio | `functions/api/friendships.ts`, `blocks.ts` |
| Melhores amigos | Lista privada (ninguém é avisado); define o público dos Momentum | `functions/api/close_friends.ts`, `/melhores-amigos` |
| Momentum | Conteúdo de 24 h; público Amigos ou Melhores amigos; expirados ficam em "arquivados" | `functions/api/moments/` |
| Perfil | Três contadores (posts, seguidores, seguindo), sem capa; botões de compartilhar e menu na linha de ações | `src/pages/ProfilePage.tsx` |
| Sua atividade | `/atividade`: votos, comentários, salvos, Momentum arquivados, bloqueados e histórico de leitura (com botão de apagar) | `functions/api/activity.ts`, `src/pages/Activity.tsx` |
| Explorar | Busca em seções (comunidades, pessoas, hashtags, publicações) e grade de fotos e vídeos | `src/pages/Explore.tsx` |
| Chat | Mensagens diretas e em grupo em tempo real | `chat-worker/`, `docs/mapas-no-chat.md` |

## 4. Segurança

- **Login:** senha (PBKDF2), Google (One Tap e botão, com confirmação de senha para ligar contas), 2FA por aplicativo, recuperação por e-mail (`docs/login-google.md`, `docs/recuperacao-confirmacao-2fa.md`).
- **Turnstile** no cadastro, login e "esqueci a senha" (`functions/_shared/turnstile.ts`): o servidor confere no siteverify (ação e hostname), falha fechada, token de uso único. A "prova de cadastro" de 2 minutos evita um segundo desafio no login logo depois de criar a conta. **Desligar na hora:** `wrangler pages secret delete TURNSTILE_SITEKEY --project-name espectro`.
- **Cabeçalhos** (`public/_headers`): CSP sem scripts inline (o script de tema e sessão é `public/boot.js`), `X-Frame-Options`, HSTS, `Permissions-Policy`, COOP. Qualquer origem externa nova precisa entrar na CSP (já constam Google, Turnstile e Web Analytics da Cloudflare).
- **Privacidade e LGPD:** `docs/privacidade-lgpd-dmca.md`. Eventos de leitura ficam 90 dias, com opção de desligar e de apagar.

## 5. Variáveis e secrets

Produção: `wrangler pages secret put NOME --project-name espectro`. Local: `.dev.vars` (ignorado pelo git).

| Nome | Para quê |
| --- | --- |
| `JWT_SECRET` | Assinatura das sessões (32+ caracteres, obrigatório) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Notificações push |
| `TOTP_ENC_KEY` | Cifra dos segredos do 2FA |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Login com Google |
| `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL` | E-mails (confirmação e recuperação); `EMAIL_DEV_LOG=1` só no local |
| `GIPHY_API_KEY` | GIFs no chat |
| `TURNSTILE_SITEKEY`, `TURNSTILE_SECRET`, `TURNSTILE_HOSTNAMES` | Turnstile (sem `TURNSTILE_SITEKEY` o recurso fica desligado, como no local) |
| `SITE_URL` | Opcional: domínio canônico (sitemap e links canônicos) quando houver domínio próprio |

## 6. Testes

O repositório não tem suíte automatizada além de `npm run check` (TypeScript) e do build no CI. As funcionalidades novas foram validadas com scripts de API contra o servidor local (`wrangler pages dev`) e conferência visual no navegador; ao mexer em feed, comunidades, seguidores, melhores amigos, atividade, pulso ou Turnstile, vale repetir esse tipo de teste.

## 7. Pendências conhecidas

- Domínio próprio (mídia direto da CDN, miniaturas com Images, e-mail, regras de WAF).
- Fase 0 do ML (registrar posição e versão do ranker, botão "Não tenho interesse", exploração no feed): `docs/plano-ml.md`.
- Política de privacidade pública, fluxo de direitos autorais, idade mínima.
- Alertas e acompanhamento da CPU real no painel da Cloudflare.
- Público "Melhores amigos" nas publicações (hoje só nos Momentum).
- Testado só no navegador de desktop e em largura de 390 px; falta conferir em iPhone real.
