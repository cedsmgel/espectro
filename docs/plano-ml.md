# Plano de Machine Learning do Espectro

Ponto de partida: feed "Para Você" por regras (`docs/algoritmo-do-feed.md`), eventos de leitura (`post_events`, 90 dias, com opção de desligar), seguidores, comunidades, hashtags. Infraestrutura: Cloudflare Pages/Workers no **plano gratuito** (10 ms de CPU por requisição), D1, R2.

A regra de ouro: **ML só entra quando ganhar do algoritmo atual num teste de verdade.** Até lá o algoritmo por regras continua sendo o padrão e a linha de base.

## 1. O que faz sentido usar ML (em ordem de valor / esforço)

| # | Uso | Precisa treinar? | Dados mínimos | Valor |
| --- | --- | --- | --- | --- |
| A | Moderação automática (texto tóxico, spam, golpes) | Não: modelo pronto (Workers AI) | Nenhum | Alto desde o dia 1 |
| B | Busca por significado e "publicações parecidas" (embeddings) | Não: modelo pronto | Nenhum | Médio |
| C | Sugestão de hashtags ao escrever | Não: embeddings + hashtags existentes | Algumas centenas de posts | Médio |
| D | Recomendar pessoas e comunidades | Começa sem treino (co-ocorrência em SQL) | Centenas de usuários | Alto |
| E | **Ranking do feed aprendido** | Sim | ~200 mil impressões e ~10 mil sinais positivos | Alto, mas só com volume |
| F | Redes neurais de recomendação (duas torres etc.) | Sim | Milhões de eventos | Só em escala grande |

Recomendação: fazer **A e B primeiro** (sem treino, valem com poucos usuários), preparar os dados para **E** desde já e não tocar em F.

## 2. Fase 0: coletar certo (sem ML) — fazer agora

Treinar bem depende de logs bem feitos. Hoje faltam:

1. **Posição e origem** de cada impressão: `position` (1.ª, 2.ª...), `feed` (`foryou`/`following`/comunidade) e `ranker_version` (ex.: `rules-v1`). Sem isso o modelo aprende que "o que aparece primeiro é bom".
2. **Sinal negativo explícito:** botão "Não tenho interesse" (esconder) por publicação e por autor. Impressão sem abrir é um negativo fraco e ruidoso.
3. **Exploração controlada:** em ~5% das posições do feed, embaralhar entre as 100 melhores. Isso gera dados sem viés para treinar e para avaliar offline.
4. **Experimentos:** sorteio estável por usuário (hash de `user_id` + nome do experimento), gravado no evento (`variant`). Permite teste A/B e desligar tudo por um interruptor.
5. **Painel simples no admin:** abertura por impressão, tempo médio na tela, esconder/denunciar, por `ranker_version`.
6. **Exportação noturna** para o R2 (Cron Trigger gratuito) em arquivos `.jsonl` por dia, com `user_id` trocado por hash. Os rótulos juntam `post_events` com votos, comentários e salvos.
7. **Política de privacidade pública** citando a coleta, a finalidade e o botão de desligar (hoje só está no documento interno).

Entrega: 1 migração (colunas novas em `post_events`), ajustes no cliente de eventos, botão de esconder, cron de exportação. Sem mudar o que o usuário vê além do botão.

## 3. Fase 1: IA pronta, sem treinar

- **Moderação (A):** ao criar publicação ou comentário, classificar o texto com Workers AI (classificador de toxicidade/segurança). Não bloqueia sozinho: manda para a **fila de moderação do admin** com a pontuação, e esconde automaticamente só acima de um limite alto. Cobre a pendência de fila de denúncias.
- **Embeddings (B, C):** gerar o vetor de cada publicação na criação (em segundo plano) e guardar em Vectorize. Usos: "publicações parecidas", busca por significado e sugestão de hashtags.
- Limites do plano gratuito (cota diária de Workers AI e de Vectorize) a confirmar antes de ligar; criar um teto de segurança e cair para o comportamento atual se a cota acabar.

## 4. Fase 2: primeiro ranker aprendido (E)

**Previsão:** probabilidade de a pessoa **abrir ou ficar ≥ 5 s** numa publicação, dado que ela apareceu. Rótulo positivo: abrir, ficar tempo, votar, comentar, salvar. Negativos: esconder (forte), impressão sem ação (fraco).

**Modelo:** regressão logística ou árvores de gradiente pequenas (LightGBM, ≤ 100 árvores, profundidade 4). São rápidas, interpretáveis e cabem nos 10 ms: ~300 candidatas x 100 árvores ≈ 30 mil passos, ordem de 1 a 3 ms.

**Características (features):**
- Publicação: idade, votos, comentários, tamanho, tem mídia, nº de hashtags, tipo (discussão/scrap), seguidores do autor.
- Pessoa x publicação: segue, amigo, mesma comunidade, afinidade com o autor e com as hashtags, quantas vezes já viu, já abriu.
- Pessoa: nível de atividade, hora do dia.
- Nada sensível (sem inferir religião, saúde, orientação, política etc.).

**Treino:** fora dos Workers, no seu computador ou num GitHub Actions agendado (gratuito), em Python lendo os `.jsonl` do R2. Divisão **por tempo** (treina no passado, valida na semana seguinte), nunca aleatória.

**Serviço:** exportar o modelo como JSON (pesos ou árvores) para o R2; a Function carrega uma vez por instância e avalia em memória. Atributos pesados (afinidades, estatísticas por autor) vêm de uma tabela `user_features` e `author_stats` atualizada por cron, para não fazer junções pesadas na requisição.

**Portas de entrada (gates)** antes de treinar de verdade:
- ≥ 200 mil impressões com `position` e `ranker_version` registrados.
- ≥ 10 mil sinais positivos e ≥ 500 usuários ativos por semana.
- Exploração ligada há pelo menos 2 semanas.

**Validação em 3 etapas:**
1. **Offline:** comparar com o algoritmo atual repetindo o log (AUC, log-loss, NDCG@10), ponderando pelo viés de posição graças à exploração.
2. **Sombra:** o modelo calcula a nota e só grava, sem alterar o feed, por 1 a 2 semanas.
3. **A/B:** 10% dos usuários, depois 50%. Aprovar se abertura por impressão subir ≥ 5% ou tempo médio na tela subir ≥ 8%, **sem** aumento relevante de esconder/denunciar (> 10%), sem queda de diversidade de autores e sem piora de latência. Se não ganhar, fica o algoritmo por regras.

**Interruptor:** variável `RANKER=rules|model` e versão do modelo fixada; voltar atrás em um deploy.

## 5. Fase 3: recomendar pessoas e comunidades (D)

- Começar em SQL: "quem segue quem você segue", "comunidades em que seus amigos estão" (já existe em parte nas sugestões) e co-ocorrência de seguir/participar.
- Quando houver dados, filtragem colaborativa simples (item-item) ou fatoração (ALS) treinada fora e exportada como tabela de sugestões pré-calculadas por usuário (lida em 1 consulta).

## 6. Riscos e como tratar

| Risco | Tratamento |
| --- | --- |
| LGPD | Finalidade e base legal documentadas, opção de desligar já existe, dados de treino com `user_id` em hash, exclusão de conta e opt-out removem o histórico e entram na próxima rodada de treino, retenção de 90 dias |
| Bolha e polarização | Diversidade de autores, exploração fixa, reserva de espaço para publicações novas e para quem você segue |
| Cold start (usuário e publicação novos) | Algoritmo por regras como piso; impulso temporário para publicações novas |
| Manipulação (bots, votos falsos) | Contar votos únicos por usuário, limites de taxa já existentes, penalizar contas novas em sinais de qualidade |
| Viés de posição / de seleção | Registrar posição e versão, exploração, avaliação ponderada |
| Explicabilidade | Manter o motivo no card (regras) ou mostrar as 1–2 características que mais pesaram |
| Custo | Tudo cabe no plano gratuito: treino em GitHub Actions/local, R2 para arquivos, cron gratuito. Monitorar leituras do D1 e cota de Workers AI |
| Modelo quebrado em produção | Versão fixada, interruptor, comparação contínua com a linha de base |

## 7. Ordem e decisões

1. Fase 0 (coleta certa, botão "Não tenho interesse", exploração, experimentos, exportação, painel).
2. Fase 1 (moderação e embeddings) em paralelo, pois não depende de volume.
3. Fase 3 (sugestões de pessoas/comunidades) em SQL.
4. Fase 2 (ranker aprendido) só quando passar pelas portas de entrada; até lá, ajustar os pesos do algoritmo por regras com os dados do painel.

Decisões pendentes do dono do produto:
- Aprovar o botão "Não tenho interesse" e a exploração de 5% no feed.
- Confirmar Fase 1 (moderação automática com fila para revisão humana) antes de qualquer bloqueio automático.
- Onde treinar (computador local ou GitHub Actions).
- Texto da política de privacidade pública sobre coleta e personalização.
