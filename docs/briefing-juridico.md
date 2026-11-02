# Briefing para consulta jurídica

Documento para levar a advogado(a) (preferencialmente com atuação em direito digital, LGPD e proteção de crianças e adolescentes). Resume o que o Espectro é, o que faz com dados e as perguntas que precisam de resposta antes de abrir o serviço a mais pessoas. As normas citadas foram lidas em fontes públicas (ver `docs/privacidade-lgpd-dmca.md`, seção 5); nada aqui é parecer.

## 1. O serviço
- Rede social em fase de testes fechados, poucos usuários, em português. Perfis, publicações, comentários, comunidades, Momentum (conteúdo efêmero), vídeos curtos, amizades e seguidores, mensagens privadas e em grupo (com mensagens temporárias e mídia de visualização única), notificações push.
- Cadastro por e-mail e senha ou conta Google, com declaração de ter 13 anos ou mais e aceite dos Termos (data registrada). Sem verificação de idade e sem coleta de data de nascimento.
- Operação por uma pessoa, hospedada na Cloudflare (aplicação, banco de dados D1, arquivos R2). Sem publicidade, sem venda de dados, sem monetização.
- Páginas públicas: `/termos` e `/privacidade`. Canal de contato: formulário em `/suporte/contato`.

## 2. Dados tratados (resumo)
Conta (usuário, e-mail, hash de senha, ID Google), perfil, conteúdo e mensagens, relações, registros de login (IP, localização aproximada, navegador, sistema; até 6 meses), atividade de leitura para ordenar o feed (90 dias, com opção de desligar), endereço de push, denúncias e mensagens ao suporte, data do aceite. Operadores: Cloudflare, Giphy, Google (opcional). Detalhe na Política.

## 3. Perguntas para o(a) advogado(a)

### A. Crianças e adolescentes (prioridade máxima)
1. O Espectro está no escopo da Lei 15.211/2025 (art. 1º: serviço "direcionado a" ou de "acesso provável por" crianças e adolescentes), sendo uma rede social geral que não é voltada a menores?
2. Estando no escopo, o art. 24 (contas de até 16 anos vinculadas a responsável) se aplica integralmente, e como cumpri-lo de forma proporcional para um serviço pequeno?
3. O que o Decreto 12.880/2026 e as normas da ANPD exigem de verificação de idade para redes sociais gerais? A autodeclaração é admitida para impedir contas de menores de 18 em serviço que não oferece conteúdo restrito a adultos?
4. Qual idade mínima é juridicamente mais segura (13, 16 ou 18 anos)? Subir para 18 elimina as exigências de vinculação e supervisão parental?
5. Contas já existentes, criadas com a declaração de 13 anos: como regularizar (reconfirmação no próximo acesso, suspensão até verificar)?
6. Obrigações de perfil privado por padrão, supervisão parental, ausência de recomendações personalizadas e de reprodução automática para menores (arts. 7º, 8º, 17 e 18).

### B. LGPD
7. As bases legais indicadas na Política (contrato, obrigação legal, legítimo interesse, consentimento, exercício regular de direitos) estão adequadas? Em especial, legítimo interesse para personalizar o feed com atividade de leitura, com opção de desligar.
8. Quem deve constar como controlador (pessoa física responsável ou pessoa jurídica a constituir) e quem pode ser encarregado (art. 41)? Há dispensa para agentes de tratamento de pequeno porte, e ela se aplica?
9. A transferência internacional (Cloudflare, Giphy, Google) está bem descrita? Basta o art. 33, II (garantias contratuais dos operadores)?
10. O prazo de resposta de 15 dias e o fluxo de exercício de direitos pelo formulário de suporte são suficientes?
11. É necessário relatório de impacto (RIPD) ou registro das operações de tratamento (art. 37)?

### C. Marco Civil e responsabilidade por conteúdo
12. Com o Tema 987 do STF (art. 19 parcialmente inconstitucional; embargos pendentes), quais deveres de moderação e retirada o Espectro tem hoje, e qual deve ser o fluxo mínimo (notificação, prazo, aviso ao autor)?
13. A guarda de registros de acesso por 6 meses (art. 15) é obrigatória para o Espectro enquanto operado por pessoa física sem fins econômicos? Como a Política deve tratar isso?
14. Há deveres específicos sobre mensagens privadas e mídia de visualização única (preservação em caso de ordem judicial, denúncia de participante)?

### D. Direitos autorais e moderação
15. O fluxo de notificação por formulário (obra, link, declaração, contestação) é suficiente no Brasil (Lei 9.610/1998 e Marco Civil)? Vale designar agente nos EUA (DMCA)?
16. Como estruturar notificação e recurso ao autor de conteúdo removido (ECA Digital, art. 30) e retorno ao denunciante?

### E. Contrato e operação
17. Os Termos (licença de conteúdo, condutas vedadas, limitação de responsabilidade, foro) estão adequados ao CDC e ao Marco Civil? Pessoa física operando serviço gratuito pode ser equiparada a fornecedor?
18. É necessário constituir pessoa jurídica antes de abrir ao público (responsabilidade, representante legal no País, art. 40 do ECA Digital)?
19. Seguros, retenção de provas para ordens judiciais e procedimento de resposta a incidentes (art. 48 da LGPD).

## 4. Materiais para anexar
- Termos de Uso e Política de Privacidade (`/termos`, `/privacidade`).
- `docs/privacidade-lgpd-dmca.md` (estudo, fontes e pendências).
- Captura das telas de cadastro (caixa de idade e aceite), Central de contas (baixar dados, excluir conta), Privacidade e denúncia.

## 5. Enquanto o parecer não chega
- Não divulgar o Espectro nem convidar novas pessoas.
- Não coletar nada além do que já está descrito na Política.
- Guardar mensagens do formulário de suporte (aba Suporte da moderação) e responder os pedidos de dados em até 15 dias.
