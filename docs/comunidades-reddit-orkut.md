# Comunidades do Espectro: modelo do Reddit e resgate do Orkut

Estudo de apoio. **Limite da pesquisa:** a central de ajuda oficial do Reddit bloqueou a leitura automática (erro 403), então o modelo do Reddit abaixo vem de guias de terceiros e de funções amplamente conhecidas; confira cada item na documentação oficial antes de fechar regras. Para o Orkut, a fonte foi a Wikipédia. Itens marcados com (?) não foram confirmados em fonte.

## 1. Estado atual das comunidades do Espectro
- Dados: nome, descrição, cor do ícone, dono, membros (tabelas `communities` e `community_members`); posts podem pertencer a uma comunidade.
- Fluxos: criar, entrar, sair, catálogo, "Minhas" e "Descobrir", recomendações, busca.
- Endereço: agora **`e/nome`** (rota `/e/nome`). Os endereços antigos `/c/`, `/comunidade/` e `/comunidades/` redirecionam para o novo.
- Não existe: regras, papéis (só o dono), tipos de comunidade, banimento, moderação por comunidade, marcadores (flair), posts fixados, ícone/banner, tópicos, boas-vindas.

## 2. O que o Reddit define para comunidades (e como aplicar em `e/`)
| Tema | Como é no Reddit | Aplicação no Espectro |
| --- | --- | --- |
| Nome | 3 a 21 caracteres, único, não muda depois de criado | Mesma regra para `e/nome` (letras, números e `_`) |
| Criação | Nome, descrição, até 3 tópicos, tipo | Mesmos campos no modal de criação |
| Tipos | Pública, restrita (todos leem, só aprovados postam) e privada (só membros aprovados) | Os três tipos, mais marca de conteúdo adulto com aviso |
| Descrição e lateral | Sobre, regras, links, moderadores | Painel "Sobre" da comunidade |
| Regras | Lista de regras com título e descrição; usadas ao denunciar e remover | Até 15 regras; cada denúncia escolhe a regra violada |
| Moderadores | Permissões separadas: acesso, configuração, marcadores, publicações, mensagens, wiki | Papéis: dono, moderador (permissões marcáveis) e membro |
| Moderação | Fila de denúncias, remover/aprovar, banir e silenciar, motivos de remoção, registro de ações | Fila por comunidade, motivos de remoção, banimento com prazo e registro (a base `moderation_log` já existe para a plataforma) |
| Marcadores (flair) | Etiquetas em posts e em membros; pode exigir marcador no post | Marcadores de post criados pelos moderadores, com opção de obrigatório |
| Fixados | Posts fixados no topo | Até 2 fixados |
| Ordenação | Melhores, em alta, novos, mais votados | Em alta, novos e mais votados por comunidade |
| Boas-vindas e wiki | Mensagem ao entrar e páginas de apoio | Mensagem de boas-vindas e uma página de regras/ajuda |
| Requisitos de post | Tipos permitidos, tamanho, marcador | Tipos de post permitidos por comunidade |

## 3. O que resgatar do Orkut
| Recurso do Orkut | Ideia para o Espectro | Cuidado |
| --- | --- | --- |
| Scraps | Já existem | Nunca aceitar HTML (o worm KutWormer de 2007 se espalhou por scraps com HTML) |
| Depoimentos (?) | Texto que um amigo escreve e a pessoa aprova antes de aparecer no perfil | Moderação e denúncia |
| Comunidades com fórum e enquetes | Tópicos de discussão e enquetes dentro de `e/` | Reaproveita posts e comentários |
| Eventos (?) | Evento da comunidade com data e confirmação de presença | Fase posterior |
| Fãs | "Virar fã" de amigos, com contador | Sem notificação invasiva |
| Notas dos amigos (confiável, legal, sexy) | Versão leve: "Confiável" e "Legal", opcional e privada por padrão | A nota "sexy" pede decisão sobre assédio e menores |
| Lista de paquera | "Paquera secreta": só avisa se os dois marcarem | Privacidade e consentimento |
| Visitantes recentes | Opcional, desligado por padrão, mostra só para quem também compartilha | Dado pessoal: precisa de consentimento (LGPD) |
| Temas (só Brasil e Índia) | Temas de perfil dentro da identidade em preto e branco | Contraste e acessibilidade |
| Álbuns de fotos e marcação | Álbuns no perfil e marcação de pessoas | A pessoa marcada precisa poder remover a marca |
| Lista de ignorados | Já existe como bloqueio | |

## 4. Fases propostas
- **C0 (feita):** prefixo `e/` e redirecionamento dos endereços antigos.
- **C1 Comunidade completa:** regras de nome, tópicos, tipos (pública/restrita/privada), painel Sobre, ícone e banner, boas-vindas.
- **C2 Moderação:** papéis e permissões, fila de denúncias por comunidade, motivos de remoção, banimento, registro de ações.
- **C3 Organização:** marcadores, fixados, ordenação, tipos de post permitidos.
- **C4 Orkut:** depoimentos, fórum e enquetes nas comunidades, fãs, temas; depois eventos, paquera secreta e visitantes (opt-in).
- **Em paralelo:** hashtags (pedido novo), que alimentam descoberta nas comunidades e no feed.

## 5. Decisões necessárias
1. Quais tipos de comunidade entram já (pública, restrita, privada)?
2. A comunidade pode ter conteúdo adulto, ou fica proibido?
3. Das ideias do Orkut, qual é prioridade? (Sugestão: depoimentos, fórum e enquetes.)
4. A nota "sexy" entra, entra com outro nome ou fica de fora?
