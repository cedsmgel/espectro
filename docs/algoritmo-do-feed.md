# Algoritmo do feed "Para Você"

Regras simples e explicáveis, sem modelo treinado. Código em `functions/_shared/ranking.ts` (nota e diversidade) e `functions/_shared/feedSignals.ts` (leitura dos sinais no banco). Endpoint: `GET /api/posts?feed=foryou`.

## Como funciona

1. **Candidatas:** as 300 publicações mais recentes que a pessoa pode ver (mesmas regras de privacidade, bloqueio e comunidade do feed comum).
2. **Nota de cada uma:** `qualidade x frescor x relação x afinidade x "já vista"`.
3. **Escolha final:** ordena pela nota e, ao escolher as 50 primeiras, reduz quem já apareceu muito entre as escolhidas (diversidade de autores).

| Fator | Regra |
| --- | --- |
| Qualidade | `1 + ln(1 + curtidas líquidas) + 0,5 x ln(1 + comentários)`; metade se tem mais descurtidas que curtidas |
| Frescor | `1 / (horas + 2) ^ 1,25` |
| Relação | segue x1,7; amigo x1,5; comunidade em que participa x1,25; própria publicação x0,5 |
| Afinidade | autor lido: `1 + 0,9 x a`; assunto (hashtag) lido: `1 + 0,6 x t`; `a` e `t` vão de 0 a 1 conforme abertura (peso 2) e tempo na tela (até 3, com 30 s) dos últimos 1500 eventos |
| Já vista | cada vez que apareceu na tela sem ser aberta x0,55 (mínimo 0,1); já aberta x0,5 |
| Diversidade | cada publicação do mesmo autor já escolhida multiplica a próxima por 0,75 |

Todas as constantes estão em `WEIGHTS` e podem ser ajustadas com dados reais.

## Transparência

A resposta traz o campo `why` e o card mostra o motivo ("Você segue", "Seu amigo", "Da comunidade e/x", "Você costuma ler @x", "Parecido com o que você lê (#x)", "Em alta").

## Privacidade

- Visitante: só qualidade e frescor.
- Afinidade e "já vista" usam os eventos de leitura (`post_events`, 90 dias). Quem desliga **Personalizar o feed com minha atividade** em Privacidade perde esses dois sinais (e o histórico é apagado). Seguir, amizade e comunidades continuam valendo, porque são escolhas explícitas.
- Nada de conteúdo de mensagens, localização ou IP entra no ranking.

## Custo e limites

Roda no plano gratuito de Workers (10 ms de CPU): 1 consulta de candidatas e 1 lote de 7 consultas de sinais; a nota e a diversidade são feitas em memória sobre 300 itens.

## Evolução

- Depois de algumas semanas de dados, ajustar `WEIGHTS` olhando tempo médio na tela e taxa de abertura por posição.
- Paginação do feed ranqueado (hoje devolve as 50 melhores de uma vez).
- Passo seguinte (ML): usar os mesmos eventos para treinar um modelo e comparar com este como linha de base.
