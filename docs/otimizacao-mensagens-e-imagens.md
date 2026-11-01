# Otimização de mensagens e imagens: estudo em etapas

Estudo feito em novembro de 2026 sobre o código em `main`. Nada aqui foi implementado ainda: é o mapa do que existe, do que pesa e da ordem sugerida para atacar. Os números do plano gratuito vêm de `docs/analise-cloudflare.md` (100 mil requisições de Function por dia, 10 ms de CPU por requisição, 100 mil escritas no D1 por dia, 10 GB no R2).

## 1. Como é hoje

### Imagens
- **Envio sem compressão.** `functions/api/upload.ts` grava o arquivo como veio. O limite é 10 MB no chat e 100 MB nas publicações. A única compressão do site é `compressImage` em `src/lib/cropImage.ts`, usada só no recorte de avatar e capa (`ImageCropperModal`). Foto de celular (3 a 8 MB) vai inteira para o R2.
- **Entrega pela Function.** Toda imagem passa por `functions/api/media/[[path]].ts`: cada visualização é uma requisição de Function mais uma leitura no R2. O cabeçalho `Cache-Control: public, max-age=31536000, immutable` ajuda quem revê a mesma imagem no mesmo aparelho, mas não há cache de borda (Cache API) nem miniaturas.
- **Imagem pequena na tela, arquivo grande na rede.** No chat a imagem aparece com ~200 a 240 px de largura, mas o navegador baixa o arquivo original. A galeria de "Mídias, links e docs" pede até 60 originais de uma vez.
- **Atributos de `<img>`.** São 40 tags `<img>` em `src`: só 3 com `loading="lazy"`, 1 com `width`/`height` e 2 com `decoding`. Sem dimensões a página "pula" ao carregar; sem lazy, o feed baixa tudo de uma vez.
- **Vídeo.** O limite de 1 minuto no chat é só do cliente; o servidor aceita até 10 MB (chat) ou 100 MB (publicação), sem miniatura de capa.

### Mensagens
- **Consultas periódicas.** Lista de conversas (DM): `conversations` + `groups` a cada 15 s (`DirectMessages.tsx`), mesmo com a aba escondida. Pulso de presença e selos: 60 s (já otimizado em um só pedido). Grupo: 30 s com WebSocket ligado, 4 s sem ele.
- **Escrita a cada leitura.** `GET /api/groups/:id/messages` faz `UPDATE chat_group_members SET last_read_id` toda vez que busca a primeira página, e cada mensagem recebida em tempo real dispara outra busca. Em D1 isso consome o limite de escritas sem mudar nada na maior parte das vezes.
- **Renderização.** O texto digitado (`inputText` / `text`) fica no mesmo componente da lista de mensagens (`DirectMessages.tsx` com ~2,7 mil linhas, `GroupChat.tsx`). Cada tecla recria todas as bolhas. Não há virtualização nem `React.memo` por linha.
- **Pacote.** O chunk `DirectMessages` tem 619 KB (146 KB comprimido), puxado pelo `@emoji-mart/data`. O pacote principal tem 392 KB (125 KB comprimido). O seletor de emojis carrega junto com a tela do chat, mesmo sem ser aberto.
- **Resíduos.** Mensagens temporárias vencidas só são ocultadas, nunca apagadas. Arquivos no R2 de mensagens apagadas ou vencidas ficam órfãos. O texto da "última mensagem" nas listas ainda pode mostrar uma mensagem já vencida.
- **Feed.** 50 publicações por requisição, cada uma com a mídia original.

## 2. Etapas sugeridas (da maior para a menor relação ganho/esforço)

Cada etapa é independente e pode virar um PR próprio.

### Etapa 0. Medir antes de mexer
- **O que:** registrar uma linha de base: peso transferido do feed e de uma conversa com 20 fotos (aba Rede do navegador), Lighthouse da home e do chat, requisições de Function por dia e escritas do D1 no painel da Cloudflare. Ligar o Web Analytics (passo pendente do usuário, exige `static.cloudflareinsights.com` no CSP).
- **Por quê:** sem a linha de base não dá para provar ganho nem escolher o próximo passo.
- **Esforço:** baixo. **Risco:** nenhum.

### Etapa 1. Comprimir e redimensionar a imagem antes do envio
- **O que:** no cliente, usar canvas para reduzir fotos para no máximo 1600 px no maior lado e salvar em WebP (ou JPEG como alternativa) com qualidade ~0,82. Não mexer em GIF, nem em arquivos já pequenos (< ~300 KB). Preservar a orientação EXIF. Aplicar no chat (DM e grupo), nas publicações e em fotos temporárias.
- **Ganho esperado:** de 3 a 8 MB para 150 a 400 KB por foto (redução de 90% ou mais), menos tempo de upload, menos armazenamento, menos banda em toda visualização.
- **Esforço:** médio (reaproveitar `compressImage`). **Risco:** baixo; testar HEIC e fotos com rotação.
- **Medir:** tamanho médio no R2 e peso transferido da conversa de teste.

### Etapa 2. Corrigir os atributos das imagens
- **O que:** `loading="lazy"` e `decoding="async"` em tudo que não está no topo da tela, `width`/`height` (ou `aspect-ratio`) para evitar salto de layout, e `fetchpriority="high"` só na primeira imagem do feed.
- **Ganho esperado:** menos dados no primeiro carregamento e melhor CLS no Lighthouse.
- **Esforço:** baixo (40 pontos). **Risco:** baixo.

### Etapa 3. Cache de borda para `/api/media`
- **O que:** na Function, consultar `caches.default` antes do R2 e guardar a resposta completa (respeitando `Range` para vídeo). Assim visitantes diferentes não repetem a leitura no R2 nem consomem tanta CPU.
- **Ganho esperado:** cai o número de leituras no R2 e o tempo de resposta de imagens muito vistas. Cada visualização continua contando como uma requisição de Function; só uma borda sem Function (domínio próprio com bucket público) tiraria essa conta.
- **Esforço:** médio. **Risco:** médio (corrigir `Range`, `ETag` e a política de CSP/`Cross-Origin-Resource-Policy` atuais).

### Etapa 4. Miniaturas
- **O que:** gerar no cliente uma segunda versão pequena (~320 px, WebP) no momento do envio e guardar com sufixo (`images/<id>_t.webp`); o campo de mídia continua com a imagem principal. Usar a miniatura na galeria de mídias, na lista de favoritas, nas pré-visualizações do feed e nas respostas citadas; abrir o original ao tocar.
- **Ganho esperado:** a galeria de 60 itens passa de dezenas de MB para poucos MB.
- **Esforço:** médio (nova convenção de chave e fallback para imagens antigas sem miniatura). **Risco:** baixo.

### Etapa 5. Menos consultas periódicas
- **O que:** pausar os temporizadores quando a aba está escondida (`document.visibilityState`), aumentar o intervalo da lista de conversas para ~45 a 60 s e atualizá-la por evento (mensagem nova pelo pulso ou WebSocket) em vez de por relógio. No grupo, usar recuo exponencial quando o WebSocket cai.
- **Ganho esperado:** uma aba esquecida aberta hoje gasta ~11 mil requisições por dia só na lista de conversas; isso cai para quase zero em segundo plano.
- **Esforço:** baixo a médio. **Risco:** baixo.

### Etapa 6. Reduzir escritas no D1
- **O que:** gravar `last_read_id` só quando o valor muda (cláusula `WHERE last_read_id < ?`), não a cada busca; no cliente, não buscar de novo o grupo inteiro a cada mensagem recebida em tempo real (aplicar a mensagem do WebSocket e só marcar como lida quando a tela está visível).
- **Ganho esperado:** menos escritas por mensagem lida; folga para crescer sem pagar plano.
- **Esforço:** baixo. **Risco:** baixo.

### Etapa 7. Renderização do chat
- **O que:** separar o campo de digitação em componente próprio (o texto deixa de recriar a lista) e envolver a linha da mensagem em `React.memo`. Só considerar virtualização se, depois disso, conversas longas ainda ficarem pesadas.
- **Ganho esperado:** digitação fluida em conversas com muitas mensagens e menos CPU no celular.
- **Esforço:** médio (componentes grandes). **Risco:** médio; precisa de testes manuais do chat.

### Etapa 8. Pacote de JavaScript
- **O que:** carregar o seletor de emojis (e o `@emoji-mart/data`) só na primeira abertura, com `import()` dinâmico. Rever o que mais entra no chunk do chat.
- **Ganho esperado:** o chunk do chat cai de ~619 KB para algo na casa de 200 KB.
- **Esforço:** baixo. **Risco:** baixo.

### Etapa 9. Limpeza automática
- **O que:** no cron horário do `espectro-chat`, apagar mensagens temporárias vencidas, e apagar do R2 os arquivos de mensagens removidas ou vencidas e de publicações apagadas. Corrigir a "última mensagem" das listas para ignorar o que venceu.
- **Ganho esperado:** o banco e o R2 não crescem sem controle; sem lixo visível nas listas.
- **Esforço:** médio. **Risco:** médio (nunca apagar um arquivo que ainda é referenciado; fazer em duas fases, marcar e depois apagar).

### Etapa 10. Vídeo
- **O que:** limitar a duração e o tamanho também no servidor, capturar um quadro de capa no cliente, `preload="metadata"` e carregar o vídeo só quando entra na tela (já existe `LazyVideoPlayer`).
- **Esforço:** médio. **Risco:** baixo. Transcodificar vídeo de verdade exigiria serviço pago; fica fora do plano atual.

## 3. Ordem recomendada
1. Etapa 0, depois as rápidas e seguras: 2, 6, 8 e 5.
2. Etapa 1 (maior ganho isolado) seguida da 4 (miniaturas, que dependem da mesma rotina de imagem).
3. Etapa 3, 7, 9 e 10 conforme a medição mostrar onde dói.

## 4. Fora do escopo por enquanto
- Cloudflare Images / Stream e domínio próprio com bucket público (dependem de plano pago ou do domínio pendente).
- Transcodificação de vídeo no servidor.
- Virtualização completa da lista de mensagens (só se a etapa 7 não bastar).

## 5. Decisões que o usuário precisa tomar
- **Formato e qualidade:** WebP 1600 px a 82% está bom, ou prefere preservar mais qualidade nas publicações do que no chat?
- **Imagens antigas:** manter como estão, ou criar um script único para recomprimir o que já está no R2?
- **Mensagens vencidas:** apagar de vez (recomendado) ou manter por um período para denúncias e moderação?
