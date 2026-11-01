# Análise da Cloudflare no Espectro: o que usamos, o que falta e o que adicionar

> **Status (nov 2026):** a Fase A foi concluída (pulso único, menos escritas no D1, cache de leituras públicas, cabeçalhos de segurança, cron no Worker do chat, Turnstile e Web Analytics ligados). Faltam as fases B (domínio próprio), C (plano pago) e D (produto). Visão geral atual: `docs/arquitetura-e-recursos.md`.

Levantamento de 1 nov 2026. Fontes: configuração do repositório, comandos `wrangler` na conta, medições em `espectro.pages.dev` e a documentação da Cloudflare (limites e preços lidos no dia). Onde não consegui confirmar algo, está marcado **(a confirmar)**.

## 1. O que usamos hoje

| Serviço | Uso | Observações |
| --- | --- | --- |
| Pages (site + Functions) | Front React (Vite) e toda a API em `functions/` | Deploy por Git; SSG da landing e SSR de páginas públicas por texto |
| D1 | Banco único `espectro` (672 kB hoje) | Leitura replicada **desativada**; Time Travel funcionando |
| R2 | Bucket `espectro-midia` (fotos, vídeos, áudios) | Servido pela Function `/api/media/*` |
| Durable Objects (SQLite) | `espectro-chat`: relé de tempo real do chat | Worker separado |
| Observability | Ligada nos dois projetos | |
| Não usamos | KV, Queues, Vectorize, Workers AI, Images, Stream, Turnstile, Cron Triggers, Web Analytics, Analytics Engine, domínio próprio (zona), WAF/regras de taxa, Email | |

Conta no **plano gratuito** de Workers. Sem domínio próprio: tudo roda em `*.pages.dev`.

## 2. Os limites do plano gratuito que importam

| Limite | Valor | Fonte |
| --- | --- | --- |
| Requisições de Workers/**Pages Functions** por dia | **100 mil** (estourou, as Functions falham; arquivos estáticos seguem) | Docs Workers e Pages |
| CPU por requisição | 10 ms | Docs Workers |
| Chamadas ao D1 por invocação | 50 | Docs D1 |
| D1: leituras / **escritas** por dia | 5 milhões / **100 mil** (estourou, o banco recusa consultas até 00:00 UTC) | Docs D1 |
| R2 | 10 GB, 1 M operações "A" e 10 M "B" por mês; saída de dados grátis | Docs R2 |
| Workers AI | 10 mil "neurons" por dia, **sem passar disso** no plano gratuito | Docs Workers AI |
| Vectorize | 5 M de dimensões guardadas (≈ 6,5 mil vetores de 768) | Docs Vectorize |
| Images | 5 mil transformações únicas por mês (também sobre arquivos do R2) | Docs Images |
| Turnstile | Grátis, 20 widgets, verificações ilimitadas | Docs Turnstile |
| Plano pago (Workers) | **US$ 5/mês**: 10 M de requisições e 30 M ms de CPU incluídos, CPU até 30 s por requisição, sem teto diário de D1 | Docs Workers |

## 3. O consumo real e onde estamos em risco

Medição no D1 de produção nas últimas 24 h: 29,4 mil consultas de leitura (236 mil linhas lidas) e **4,9 mil consultas de escrita (8,7 mil linhas escritas)**. Com pouquíssimos usuários, as escritas já estão em ~9% do teto diário de 100 mil.

### 3.1 Teto de 100 mil requisições por dia (risco principal)

Com uma aba visível aberta, o app faz sozinho, por hora:

| Chamada | Intervalo | Por hora |
| --- | --- | --- |
| Batimento de presença | 45 s | 80 |
| Mensagens não lidas | 30 s | 120 |
| Contagem de notificações | 30 s | 120 |
| **Total em espera** | | **~320** |

(Já pausam com a aba oculta.) Fora isso há ~10 chamadas por tela aberta. Conta aproximada: **100 mil / 320 ≈ 310 horas de aba aberta por dia**. Algo como 50 a 100 pessoas ativas por dia já bate no teto, e aí **a API inteira para**.

Mídia também entra na conta: cada foto, avatar e **cada pedaço de vídeo (Range)** passa pela Function `/api/media/*`, ou seja, consome requisições, CPU e operações do R2. Um único vídeo assistido gera várias requisições.

### 3.2 Teto de 100 mil escritas por dia no D1

Maiores escritores hoje:
- **Limite de taxa:** cada chamada a `rateLimit` faz um `INSERT ... ON CONFLICT` no D1 (37 pontos de uso, inclusive na presença, que roda a cada 45 s).
- **Presença:** `UPDATE users SET last_seen_at` por batimento (com filtro de 30 s, mas a consulta de escrita roda sempre).
- **Eventos de leitura** (`post_events`): uma linha por impressão, abertura e tempo na tela.
- Posts, votos, comentários, mensagens, sessões.

### 3.3 CPU de 10 ms

O SSR por texto e o ranking foram desenhados para caber, mas **não medimos CPU real** em produção.

### 3.4 Latência

TTFB medido do Brasil: HTML ~115–225 ms; API 290–450 ms (D1 sem réplicas de leitura; a região primária do banco é automática e não há opção na América do Sul).

### 3.5 Segurança e entrega

- Arquivos de build com cache de 1 ano e Brotli: **bom** (JS inicial ~125 kB comprimido). HTTP/3 ativo.
- Faltam cabeçalhos de segurança no HTML: **CSP, X-Frame-Options/frame-ancestors, Permissions-Policy, HSTS** (só temos `referrer-policy` e `nosniff`).
- Sem desafio anti-bot (Turnstile) em cadastro, login e recuperação de senha; só limite de taxa por IP/usuário.
- Sem recursos de borda de zona (WAF, regras de taxa, Bot Fight Mode), porque não há domínio próprio.

## 4. O que fazer, em ordem

### Fase A: grátis e sem domínio (fazer já)

1. **Um só "pulso" no lugar de 3 chamadas periódicas.** `/api/pulse` devolve não lidas + notificações + registra presença, a cada 60 s com recuo quando nada mudou. De ~320 para ~60 requisições por hora por aba (**-80%**). Opcional depois: empurrar mudanças pelo Durable Object do chat (mensagens recebidas pelo WebSocket contam 20:1).
2. **Cortar escritas no D1.**
   - Tirar `rateLimit` dos endpoints baratos e frequentes (presença, eventos) e manter nos sensíveis (login, cadastro, busca, criar conteúdo); avaliar o binding de Rate Limiting do Workers **(a confirmar: funciona nas Pages Functions?)**.
   - Presença: gravar só se passou de 2 a 3 min.
   - Eventos: juntar impressão + tempo na tela numa linha só e limitar por sessão.
3. **Cache de borda (Cache API) de leituras públicas** por 30–60 s: lista de comunidades, hashtags em alta, grade do Explorar, feed de visitante. Poupa D1 e CPU (a requisição ainda conta).
4. **Cabeçalhos de segurança** em `public/_headers`: CSP (com as origens do Google, Fonts e Resend), `frame-ancestors 'none'`, Permissions-Policy.
5. **Web Analytics** ligado no projeto Pages (grátis): Core Web Vitals reais de quem usa.
6. **Turnstile** (grátis) em cadastro, login, "esqueci a senha" e denúncia: corta bots antes de gastarem requisições e escritas.
7. **Rotinas agendadas no Worker do chat** (Cron Trigger): exclusão definitiva de contas e limpeza de `post_events` e `rate_limits`, hoje feitas de carona em requisições de usuários.
8. **Alertas:** notificações de falha de deploy e acompanhamento diário de `rows_written`, `rows_read` e erros 1102/1027 no painel.
9. **Backup:** o Time Travel do D1 já funciona; combinar um export periódico para o R2 (no mesmo cron).

### Fase B: precisa de domínio próprio (~US$ 10 por ano)

10. **Domínio no site e no bucket de mídia (`media.seudominio`).** É o maior ganho de escala: mídia sai das Functions e passa a ser servida direto pela CDN (cache de borda, sem consumir requisições, sem CPU), com saída gratuita do R2.
11. **Images em fotos e avatares** (miniaturas, WebP/AVIF) pelo domínio de mídia: até 5 mil transformações únicas por mês no plano gratuito; menos banda e carregamento mais rápido.
12. **Recursos de zona:** regras de WAF e de taxa, Bot Fight Mode, Cache Rules, HSTS, redirecionamento www.
13. **E-mail:** Email Routing para receber (`contato@`) e domínio verificado para enviar (Resend ou o serviço de e-mail da Cloudflare), o que destrava a confirmação de e-mail e o aviso de login suspeito em produção.
14. **Cloudflare Access** (grátis até 50 usuários) na frente do `/admin`, com e-mail ou Google, como segunda camada além do 2FA do app.
15. **SEO de verdade:** canônico e sitemap passam a usar o domínio (`SITE_URL`), envio ao Google Search Console.

### Fase C: plano pago do Workers (US$ 5/mês)

16. Remove o teto de 100 mil requisições e de escritas do D1, sobe a CPU de 10 ms para até 30 s e inclui 10 M de requisições. **Meu critério:** assinar quando passarmos de ~50% de qualquer teto diário por alguns dias seguidos, ou antes de qualquer divulgação. Destrava também React no servidor (SSR completo), Queues e KV sem os tetos de escrita baixos.

### Fase D: recursos de produto

17. **Workers AI + Vectorize** para moderação, busca por significado e hashtags (plano `docs/plano-ml.md`). No gratuito há 10 mil neurons por dia e ~6,5 mil vetores, ou seja, dá para um piloto, não para escala. Melhor depois da Fase C.
18. **Queues** para trabalhos assíncronos (push, embeddings, exportações) **(limites do plano gratuito a confirmar)**.
19. **Stream** para vídeo adaptativo (HLS): US$ 5 por mês a cada 1.000 minutos guardados + US$ 1 por 1.000 minutos entregues. Só se vídeo virar peça central.
20. **Leitura replicada do D1** para reduzir a latência de leitura: avaliar custo e comportamento antes **(a confirmar)**.
21. **Analytics Engine** para métricas de eventos fora do D1 **(a confirmar plano e limites)**.

## 5. Resumo de custos

| Item | Custo |
| --- | --- |
| Fases A e (quase toda) B | Grátis, exceto o domínio (~US$ 10 por ano) |
| Fase C | US$ 5 por mês (+ US$ 0,30 por milhão de requisições acima de 10 M) |
| Fase D | Grátis até as cotas; depois por uso |

## 6. O que não recomendo agora

- Trocar de plataforma ou reescrever em outro framework: o desenho atual (Pages + D1 + R2 + DO) está certo para o estágio.
- Stream, redes neurais de recomendação e SSR completo com React antes do plano pago e de tráfego que justifique.
