# Mapas interativos no chat do Espectro

Estudo de apoio. Preços e limites mudam: confirme nas páginas oficiais antes de decidir.

## Situação atual
- O chat já tem a mensagem do tipo `location`: o botão de anexo lê a posição do aparelho e envia o texto "Localização: lat, lng" com um link para o Google Maps. A mensagem aparece como um cartão com as coordenadas e "Ver no Google Maps".
- Não há mapa dentro do balão, nem escolha de ponto, nem localização em tempo real.

## O que "mapa interativo no chat" pode ser
| Nível | O que o usuário vê | Custo técnico |
| --- | --- | --- |
| 1. Prévia no balão | Mapa pequeno com um marcador; toque abre em tela cheia para arrastar e dar zoom | Baixo |
| 2. Escolher o ponto | Antes de enviar, abre o mapa para ajustar o pino (em vez de mandar o ponto exato do GPS) e escolher "aproximada" ou "exata" | Médio |
| 3. Pesquisar um lugar | Campo de busca por endereço ou nome de lugar | Médio, exige geocodificação |
| 4. Localização em tempo real | O ponto se move por 15 min, 1 h ou 8 h, com botão de parar | Alto: atualizações contínuas, bateria, expiração |

## Onde buscar os mapas (tiles)
| Opção | Prós | Contras |
| --- | --- | --- |
| **Protomaps (PMTiles) hospedado no R2** | Nativo Cloudflare, sem custo por requisição, sem chave, sem enviar dados dos usuários a terceiros; funciona com MapLibre | Precisa gerar e hospedar um arquivo (um recorte do Brasil costuma ficar na casa de poucos GB), e atualizá-lo de tempos em tempos |
| Provedor com plano grátis (MapTiler, Stadia, etc.) | Pronto em minutos, com busca de endereços | Chave de API, limite mensal, cobrança ao crescer, os provedores veem as requisições |
| Servidor público do OpenStreetMap | Zero configuração | A política de uso proíbe uso pesado e exige identificar o aplicativo; serve só para testes |
| Google Maps | Qualidade e busca excelentes | Cobrança por uso, exige chave e cartão, termos restritivos |

Biblioteca de exibição: **MapLibre GL JS** (vetorial, suave no celular) ou **Leaflet** (mais leve e simples, tiles em imagem). Nos dois casos carregar **sob demanda**, só quando alguém abre um mapa, para não pesar o app.

## Busca de endereços (nível 3)
O Nominatim público não aceita uso comercial pesado. Alternativas: geocodificador do próprio provedor de mapas, ou o Photon/Pelias hospedado. Pode ficar para depois do nível 2.

## Privacidade (o ponto mais importante)
- Localização exata é dado pessoal sensível na prática: mostrar **antes de enviar** o que será compartilhado e com quem.
- Oferecer **localização aproximada** (arredondar para cerca de 500 m a 1 km) além da exata.
- Em tempo real: expiração obrigatória, botão de parar sempre visível, aviso persistente enquanto ativa, e nunca compartilhar sem o gesto da pessoa.
- Guardar no banco só o necessário: coordenadas e, no tempo real, só o último ponto.
- A permissão de localização do navegador só é pedida no clique; já é assim hoje.
- Em grupos, avisar que todos os membros veem o ponto.

## Recomendação
1. **Já**: níveis 1 e 2 com **Leaflet + tiles de um provedor com plano grátis** (rápido, sem hospedar nada), escolha entre exata e aproximada, mapa tocável em tela cheia, carregado sob demanda.
2. **Depois**: migrar os tiles para **PMTiles no R2 com MapLibre** quando o volume justificar, removendo custo e dependência externa.
3. **Por último**: tempo real, com expiração e parada visível.

## Decisões necessárias
1. Aceita começar com um provedor de tiles com chave (qual?) ou prefere já hospedar os mapas no R2?
2. Localização em tempo real entra no escopo agora ou depois?
3. A busca de endereços é necessária no começo?
