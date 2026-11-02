# Privacidade, LGPD e direitos autorais (DMCA) no Espectro

Estudo de apoio ao produto. Não é parecer jurídico: antes de publicar termos e política de privacidade, revise com um(a) advogado(a).

## 1. LGPD (Lei 13.709/2018): direitos da pessoa titular (art. 18)

| Direito | Como o Espectro atende | Situação |
| --- | --- | --- |
| Confirmação e acesso | Página "Senha, dados e exclusão" > **Baixar meus dados** (JSON com perfil, publicações, comentários, votos, salvos, amigos, mensagens, Momentum e bloqueios) | Feito |
| Correção | Editar perfil e informações do perfil | Feito |
| Anonimização, bloqueio ou eliminação de dados desnecessários | Cada informação do perfil é opcional e apagável; privacidade por campo (público, amigos, só eu) | Feito |
| Portabilidade | Mesmo arquivo JSON, formato aberto | Feito |
| Eliminação dos dados tratados com consentimento | **Excluir conta**: questionário de saída, confirmação com senha, 30 dias de arrependimento e apagamento definitivo (banco e arquivos) | Feito |
| Informação sobre compartilhamento | Política de privacidade lista operadores (Cloudflare, Giphy) | Falta a página |
| Revogação do consentimento | Notificações push se desligam no aparelho; configurações de conta | Parcial |
| Canal do(a) encarregado(a) (DPO) | Página com e-mail de contato e prazo de resposta (15 dias para resposta completa, praxe de mercado) | Falta |

Princípios aplicados: **minimização** (campos opcionais, privados por padrão, ano de nascimento nunca exibido), **finalidade** (questionário de saída anônimo, sem ligação com a conta), **segurança** (senha com PBKDF2, rate limit, sessões revogáveis, "sair de todos os dispositivos"), **transparência** (avisos claros do que a exclusão apaga).

### Retenção e exceções
- A exclusão apaga conteúdo, relações e arquivos (R2). O questionário de saída fica porque é anônimo.
- **Marco Civil da Internet (Lei 12.965/2014, art. 15)**: provedores de aplicação devem guardar registros de acesso por 6 meses. O Espectro não grava um log próprio de acessos além do que a Cloudflare mantém; se passar a gravar, esses registros podem ficar por 6 meses mesmo após a exclusão, e isso deve constar na política.
- Mensagens: ao excluir a conta, as mensagens enviadas e recebidas somem também para a outra pessoa. A política deve avisar.
- Dados de moderação (denúncias, suspensões) podem ser mantidos pelo prazo necessário ao exercício regular de direitos (art. 16, I e art. 7º, VI).

### Crianças e adolescentes
O ECA Digital e o art. 14 da LGPD exigem cuidado reforçado com menores. Recomendações: idade mínima declarada no cadastro (hoje não há), termos claros e perfil privado por padrão para menores de 18.

## 2. Direitos autorais: DMCA e o cenário brasileiro

O DMCA (17 U.S.C. § 512) vale para o público dos EUA; no Brasil, o equivalente é o regime de **notificação e retirada** do Marco Civil (arts. 19 e 21) e a Lei de Direitos Autorais (9.610/1998). Um fluxo único atende os dois.

**Aviso de violação (takedown)** deve ter: identificação da obra, link do conteúdo, dados de contato, declaração de boa-fé de que o uso não é autorizado, declaração (sob as penas da lei) de que o aviso é verdadeiro e de que quem envia é o titular ou representante, e assinatura.

**Contranotificação:** quem postou pode contestar; no DMCA o conteúdo volta em 10 a 14 dias úteis se o titular não entrar na Justiça.

**Política de reincidência (§ 512(i))**: encerrar contas de infratores reincidentes em circunstâncias apropriadas (sugestão: 3 avisos válidos).

**Agente designado:** para ter o abrigo (safe harbor) do DMCA nos EUA é preciso registrar um agente no Copyright Office (renovação a cada 3 anos). Só vale a pena se houver público relevante nos EUA; para o Brasil basta o canal de notificação.

### Proposta para o Espectro
1. Página pública `/direitos-autorais` com formulário de aviso (campos acima).
2. Fila na área de administração: aceitar (remove o conteúdo e avisa a pessoa) ou recusar.
3. Contranotificação pela mesma página, com prazo de 10 dias úteis.
4. Contador de avisos por conta e suspensão na terceira ocorrência.

## 3. Próximos passos
1. Página de direitos autorais e fila de moderação (item 2 acima).
2. Termos de uso, política de privacidade e página do(a) encarregado(a) (Fase 4).
3. Idade mínima e perfil privado para menores.
4. Lista de sessões por aparelho (hoje só existe "sair de todos").

## 4. Rastreamento de IP e geolocalização

Objetivo: segurança da conta (sessões por aparelho, aviso de acesso novo) e proteção contra abuso, sem virar vigilância.

### Opções avaliadas
| Opção | Prós | Contras | Decisão |
| --- | --- | --- | --- |
| `request.cf` da Cloudflare (país, região, cidade, fuso, ASN) | Já vem na requisição, sem custo, sem latência, o IP não sai da infraestrutura que já atende o app | Precisão de cidade é aproximada; operadoras móveis (CGNAT) e VPN distorcem | **Adotada** |
| Base MaxMind GeoLite2 embutida | Offline, controlável | Exige licença, atualização semanal e dezenas de MB no Worker | Descartada |
| API externa de geoIP | Simples | Envia o IP de cada pessoa a um terceiro, adiciona latência e limite de chamadas | Descartada |

### O que o Espectro guarda (tabela `user_sessions`)
IP completo, país, região, cidade, fuso, ASN, navegador, sistema e tipo de aparelho, uma linha por login.

### Para que serve
1. **Lista de aparelhos** em "Senha, dados e exclusão", com encerramento individual.
2. **Aviso de acesso novo**: se o país, o navegador e o sistema nunca foram vistos nessa conta, chega uma notificação de segurança.
3. **Limite de requisições** por IP (já existia), para frear abuso e tentativa de senha.
4. Ideias futuras: aviso de "viagem impossível", painel de abuso para moderação.

### Limites e cuidados
- IP é dado pessoal; a base legal é a **obrigação legal** (Marco Civil, art. 15: registros de acesso por 6 meses) e o **legítimo interesse de segurança**. A política de privacidade deve dizer isso.
- **Retenção:** linhas de sessão com mais de 6 meses são apagadas pela rotina de manutenção.
- **Exibição:** a pessoa vê só a localização aproximada e o IP com o final oculto (`203.0.113.xxx`); outras pessoas nunca veem.
- **Finalidade:** não usar IP ou localização para publicidade, perfil de interesses ou decisões automáticas que bloqueiem a conta. Divergência de local gera **aviso**, nunca bloqueio, porque VPN, Tor e redes móveis geram falsos positivos.
- Ao excluir a conta, as linhas de sessão vão junto. Se a obrigação de guarda for exigida em ordem judicial, o registro precisa ser preservado antes da exclusão.

## Atividade de leitura e personalização do feed

- **O que se guarda:** para cada publicação de outra pessoa, o Espectro registra uma **visualização** (a publicação ficou na tela, com metade visível, por pelo menos 1 segundo, e por quanto tempo), e quando ela foi **aberta**. Nada de conteúdo de mensagens, localização ou IP entra aqui.
- **Finalidade:** ordenar o feed e medir se a ordenação funciona. Não é usado para publicidade nem vendido.
- **Base legal:** legítimo interesse, com **opção de desligar** em Configurações → Privacidade ("Personalizar o feed com minha atividade"). Desligar para de registrar e **apaga o histórico** na hora. Em **Sua atividade → Publicações vistas** a pessoa vê um resumo e pode **apagar o histórico** sem desligar a personalização. Falta apenas citar isso na política de privacidade pública.
- **Retenção:** 90 dias (limpeza ocasional dentro do próprio endpoint de eventos).
- **Exclusão da conta:** os eventos e os vínculos de seguir saem junto na exclusão definitiva.
- **Seguir:** relação de mão única; perfis privados não podem ser seguidos (só amizade) e bloquear desfaz o seguir nos dois sentidos.

## 5. Revisão jurídica das páginas públicas (novembro de 2026)

Revisão dos Termos de Uso e da Política de Privacidade (`src/pages/LegalPages.tsx`) contra as fontes abaixo. **Continua sendo estudo de apoio, não parecer jurídico:** a publicação final precisa de revisão por advogado(a) inscrito(a) na OAB.

### Fontes consultadas
- Lei nº 13.709/2018 (LGPD): https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- Lei nº 12.965/2014 (Marco Civil da Internet): https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm
- Lei nº 15.211/2025 (ECA Digital): https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15211.htm
- STF, Tema 987 (RE 1.037.396/SP), artigo 19 do Marco Civil: https://noticias.stf.jus.br/postsnoticias/stf-define-parametros-para-responsabilizacao-de-plataformas-por-conteudos-de-terceiros
- Análise do Tema 987 (Mattos Filho): https://www.mattosfilho.com.br/unico/responsabilizacao-provedores-internet/
- Vigência do ECA Digital (17/03/2026) e Decreto nº 12.880/2026: https://olhardigital.com.br/2026/03/17/internet-e-redes-sociais/eca-digital-entra-em-vigor-nesta-terca-saiba-o-que-muda-na-internet-brasileira/ e https://convergenciadigital.com.br/governo/com-decreto-do-eca-digital-anpd-vai-baixar-regras-especificas-para-verificacao-etaria/

Os textos das leis foram lidos nas páginas do Planalto (resumidos por ferramenta de leitura); os artigos citados abaixo devem ser conferidos no texto oficial antes da publicação. Itens do Decreto nº 12.880/2026 e das normas da ANPD vieram de reportagens, não do texto oficial.

### O que foi ajustado nos textos
| Tema | Norma | Ajuste |
| --- | --- | --- |
| Informações ao titular (finalidade, forma, duração, controlador, compartilhamento, direitos) | LGPD arts. 6º, VI, e 9º | Política reescrita com tabela de dados, finalidade e base legal por tratamento |
| Bases legais | LGPD art. 7º, I, II, V, VI e IX | Cada tratamento passou a indicar a base (contrato, obrigação legal, legítimo interesse, consentimento) |
| Direitos do titular e prazo | LGPD arts. 18 e 19, II (15 dias) e art. 18, § 1º (petição à ANPD) | Direitos listados e canal de exercício descritos |
| Conservação | LGPD arts. 15 e 16; Marco Civil art. 15 (registros de acesso por 6 meses) | Prazos explícitos por categoria de dado |
| Transferência internacional | LGPD art. 33 | Nova seção: operadores fora do Brasil (Cloudflare, Giphy, Google) |
| Incidentes | LGPD art. 48 | Compromisso de comunicar ANPD e titulares |
| Mensagens privadas | Marco Civil art. 10 | Termos informam que o acesso ocorre só nas hipóteses legais ou por denúncia de participante |
| Conteúdo de terceiros | Marco Civil arts. 19 e 21; Tema 987 do STF | Termos citam ordem judicial, notificação de conteúdo íntimo e o regime do Tema 987 sem prometer prazos |
| Crianças e adolescentes | LGPD art. 14; ECA Digital arts. 24 e 29 | Seção própria e cláusula de suspensão por indício de idade abaixo do mínimo |

### Pendências que exigem decisão ou dado seu
1. **Idade mínima e ECA Digital (crítico).** A Lei nº 15.211/2025 está em vigor desde 17/03/2026. O art. 24 prevê que contas de crianças e adolescentes **até 16 anos** devem estar **vinculadas a um responsável**, o art. 9º, § 1º, veda a **autodeclaração** como verificação de idade para conteúdo impróprio a menores de 18, e o Decreto nº 12.880/2026 distingue "aferição" de "verificação" de idade. O Espectro hoje aceita **13 anos por autodeclaração e sem vínculo parental**. Isso é incompatível com o art. 24 para a faixa de 13 a 16 anos. Opções: (a) elevar o mínimo para 17/18 anos (e planejar verificação de idade), (b) implementar vínculo com conta de responsável e ferramentas de supervisão (arts. 17 e 18), ou (c) obter parecer jurídico sobre se o serviço está no escopo do art. 1º (produto direcionado ou de acesso provável por crianças e adolescentes).
2. **Controlador e encarregado.** A LGPD exige divulgar a identidade e o contato do controlador (art. 9º, III) e do encarregado (art. 41, § 1º). Incluir nome, CNPJ/CPF, endereço e e-mail em `help/src/content/artigos/termos-e-politicas/politica-de-privacidade.md` (item 1). Enquanto não houver, o texto indica o formulário de suporte.
3. **Representante legal no País.** O ECA Digital (art. 40) exige que o fornecedor mantenha representante legal no Brasil.
4. **Aviso e recurso ao autor da remoção.** O art. 30 do ECA Digital prevê notificação ao autor do conteúdo removido, com motivação, recurso e prazos. O Espectro ainda não avisa o autor nem oferece recurso.
5. **Retorno ao denunciante e fila de direitos autorais.** Hoje a denúncia não gera retorno e o aviso de direitos autorais cai na fila de suporte, sem prazos nem contranotificação estruturados.
6. **Consentimento destacado.** O Marco Civil (art. 7º, IX) pede consentimento expresso e destacado para coleta e tratamento de dados. A caixa do cadastro cobre Termos e idade; avaliar um destaque separado para a personalização do feed.
7. **Menores de 18: perfil privado por padrão** (ECA Digital art. 7º) depende de saber a idade, hoje não coletada.
8. **Relatórios semestrais** (art. 31) só se aplicam acima de 1 milhão de usuários menores registrados.

### Decisão registrada (2 de novembro de 2026)
O responsável pelo Espectro decidiu **publicar os Termos e a Política com idade mínima de 13 anos por autodeclaração**, ciente do conflito com o art. 24 da Lei nº 15.211/2025 descrito no item 1 das pendências acima e de que a revisão por advogado(a) ainda não ocorreu. Os textos agora ficam na Central de Ajuda (`help/src/content/artigos/termos-e-politicas/`), e as rotas `/termos` e `/privacidade` do app redirecionam para lá. Revisitar esta decisão assim que houver parecer.
