# Plano: Central de Ajuda do Espectro (site separado, outro domínio)

Planejamento de design e programação. Nada aqui foi implementado.

## 1. Objetivo e escopo

Um site público de ajuda, independente da rede social, em domínio próprio (ex.: `ajuda.<dominio>` ou domínio separado), que:
- responde dúvidas comuns sem exigir login;
- hospeda os documentos legais (Termos, Privacidade, Direitos autorais) em endereço estável e indexável;
- recebe contato do suporte, pedidos de dados (LGPD) e notificações de direitos autorais;
- continua no ar mesmo se a rede social estiver fora do ar.

Fora do escopo agora: chat ao vivo, login na central, fórum da comunidade, tradução.

## 2. Decisões que dependem de você

| Decisão | Recomendação | Por quê |
| --- | --- | --- |
| Domínio | Subdomínio do domínio principal quando ele existir (`ajuda.`); antes disso, domínio próprio curto | Você pediu outro domínio; subdomínio herda confiança e facilita cookies e links, mas domínio totalmente separado também funciona |
| Marca | Mesmo nome e visual do Espectro, com a palavra "Ajuda" | Quem chega por e-mail ou denúncia reconhece a origem |
| Idioma | Português do Brasil apenas | Público atual; i18n depois |
| Onde ficam os textos legais | Na central (fonte única); o app só linka | Evita texto duplicado e desatualizado |

## 3. Arquitetura recomendada

- **Projeto Cloudflare Pages separado** (`espectro-ajuda`), repositório próprio ou pasta `help/` no monorepo com build independente. Mesmo plano gratuito; o tráfego da ajuda não consome o limite de Functions da rede social.
- **Site estático gerado a partir de Markdown** (conteúdo em arquivos, versionado no git, revisável por PR). Ferramenta sugerida: **Astro** (HTML estático, zero JavaScript por padrão, ótimo para SEO e desempenho). Alternativa: reutilizar Vite + React para compartilhar componentes, ao custo de mais JavaScript.
- **Busca no cliente** com índice gerado no build (Pagefind: sem servidor, funciona offline, indexa HTML estático).
- **Formulário de contato** como Pages Function própria (`/api/contato`) com Turnstile, limite de envios e gravação no mesmo banco de suporte da rede social (binding D1 compartilhado) ou envio por e-mail. Evita CORS entre domínios e mantém a central independente do app.
- **Sem login**; para ligar um pedido a uma conta, o usuário informa o e-mail ou nome de usuário, e a equipe confere pelo painel.
- **Segurança:** cabeçalhos próprios (`_headers`) com CSP restrita (sem Google, sem scripts de terceiros além do Turnstile), `frame-ancestors 'none'`, HSTS no domínio.
- **Analytics:** Cloudflare Web Analytics (sem cookies), contando buscas sem resultado para orientar novos artigos.

## 4. Estrutura de conteúdo

Categorias (alinhadas ao menu do app, para o usuário achar o mesmo nome nos dois lugares):

1. **Primeiros passos:** criar conta, entrar com Google, recuperar senha, confirmar e-mail.
2. **Sua conta e segurança:** Central de contas, verificação em duas etapas, aparelhos conectados, trocar e-mail, excluir conta e prazo de 30 dias.
3. **Privacidade:** perfil privado, quem vê suas publicações, melhores amigos, personalização do feed.
4. **Publicar e interagir:** publicações, Momentum, vídeos, comunidades, comentários, scraps.
5. **Mensagens e grupos:** mensagens temporárias, mídia de visualização única, favoritas, exportar conversa, permissões do grupo, convite.
6. **Segurança e denúncias:** denunciar, bloquear, o que acontece depois, conteúdo que viola regras, menores de idade.
7. **Seus dados (LGPD):** baixar dados, corrigir, excluir, prazos, contato do encarregado.
8. **Termos e políticas:** Termos de Uso, Política de Privacidade, Direitos autorais (aviso e contestação), Diretrizes da comunidade.
9. **Contato.**

Formato de artigo: título em forma de pergunta, resposta curta no topo, passos numerados, "Isto resolveu?" (sim/não), artigos relacionados, data de atualização. Frontmatter: `titulo`, `categoria`, `resumo`, `atualizado`, `relacionados`.

## 5. Design

**Princípios:** claro, rápido, acessível, sem decoração. Mesma linguagem monocromática do Espectro (preto, branco, cinzas, bordas finas sem sombra) com tipografia Inter, ícones Material Symbols e modo claro e escuro automáticos.

**Tokens:** reaproveitar as variáveis de cor do app (`surface`, `on-surface`, `outline-variant`, `primary`) para manter identidade; um único destaque de cor para links e foco.

**Páginas e componentes**
- **Início:** cabeçalho com logo e "Ajuda"; título "Como podemos ajudar?"; **campo de busca grande** (atalho `/`); grade de 8 categorias (ícone, nome, 1 linha); bloco "Mais lidos"; rodapé com Termos, Privacidade, Contato e link "Voltar ao Espectro".
- **Categoria:** lista de artigos com resumo; navegação lateral no desktop.
- **Artigo:** coluna de leitura de ~70 caracteres, sumário lateral fixo (desktop), passos numerados, avisos (nota, atenção), "Isto resolveu?", relacionados, "Atualizado em".
- **Busca:** resultados instantâneos com destaque do termo e tela de "nada encontrado" com sugestão de contato.
- **Contato:** formulário curto (assunto, mensagem, e-mail), texto de prazo (15 dias), temas especiais com instruções (direitos autorais, dados/LGPD).
- **Documentos legais:** página de leitura longa com índice, data de vigência e histórico de versões.
- **Estados:** 404 útil (busca + categorias), página offline simples.

**Responsivo e acessibilidade:** mobile primeiro; alvos de toque de 44 px; contraste AA; navegação completa por teclado; foco visível; `lang="pt-BR"`; sem animações essenciais; respeita `prefers-reduced-motion` e tema do sistema. Meta: Lighthouse acima de 95 em desempenho, acessibilidade e SEO.

## 6. Integração com a rede social

- O app aponta para a central: menu "Ajuda e suporte" e rodapé da página inicial passam a abrir o domínio da ajuda; páginas `/termos` e `/privacidade` do app viram redirecionamentos 301 para a central.
- Links profundos: cada tela sensível do app (denúncia, exclusão de conta, privacidade) linka o artigo correspondente.
- O CSP do app já aceita links de saída; nenhum recurso da central é carregado dentro do app (sem iframe).
- O formulário de suporte do app (`/suporte/contato`) pode permanecer para usuários logados, gravando no mesmo banco; a central cobre quem não consegue entrar.

## 7. Plano de execução

| Fase | Entrega | Esforço aproximado |
| --- | --- | --- |
| 0. Preparação | Definir domínio, nome, categorias finais, quem escreve e revisa; apontar DNS | 1 dia (e a compra do domínio) |
| 1. Fundação | Projeto Astro no Pages, tokens e layout, tema claro/escuro, CSP e cabeçalhos, deploy automático por PR | 1 a 2 dias |
| 2. Conteúdo base | Início, categorias, componente de artigo, 20 a 25 artigos prioritários em Markdown | 3 a 4 dias |
| 3. Busca e navegação | Pagefind, sumário, relacionados, "Isto resolveu?" (contagem agregada sem cookies) | 1 a 2 dias |
| 4. Contato e jurídico | Formulário com Turnstile e limite, páginas legais finais (após parecer), página de direitos autorais | 2 dias |
| 5. Integração | Redirecionamentos do app, links profundos, sitemap e `robots.txt`, Web Analytics | 1 dia |
| 6. Qualidade | Lighthouse, teste de teclado e leitor de tela, revisão de textos, medição inicial | 1 a 2 dias |

Total estimado: 10 a 14 dias de trabalho, sem contar redação e revisão jurídica do conteúdo.

## 8. Riscos e dependências

- **Parecer jurídico** define os textos finais de Termos, Privacidade e direitos autorais, e a idade mínima (ver `docs/briefing-juridico.md`). A central pode subir antes com artigos operacionais e receber os textos legais depois.
- **Domínio e DNS** ainda não existem; sem eles a central fica em `*.pages.dev` temporariamente.
- **Responsável pelo conteúdo:** ajuda desatualizada é pior que nenhuma. Definir quem revisa a cada mudança do app e usar a data de atualização em cada artigo.
- **Resposta ao suporte:** o formulário só recebe; é preciso rotina para responder em até 15 dias (prazo prometido na Política).

## 9. Critérios de sucesso

- Busca devolve o artigo certo para as 20 dúvidas mais comuns.
- Páginas carregam em menos de 1 segundo em rede móvel.
- Menos de 10% de buscas sem resultado após o primeiro mês.
- Todo texto legal acessível em endereço estável e linkado no cadastro do app.
