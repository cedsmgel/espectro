# Login com o Google: configuração e operação

## Como está ligado
- Fluxo OpenID Connect (authorization code + PKCE + nonce) nas funções do Pages: `functions/api/auth/google/{start,callback,exchange}.ts`.
- Segredos do Pages (produção): `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`. Sem eles o botão não aparece.
- URI de redirecionamento cadastrada no Google: `https://espectro.pages.dev/api/auth/google/callback`. Deve ser **idêntica** à que o servidor monta (`APP_URL` + `/api/auth/google/callback`). Ao trocar de domínio, cadastre a nova no Google e defina `APP_URL`.

## Estado da tela de consentimento
- Em modo **Teste**, só entram os e-mails cadastrados como "usuários de teste" no Google Cloud Console (limite de 100).
- Para abrir ao público: publicar o aplicativo ("Em produção") e, para escopos básicos (`openid`, `email`, `profile`), a verificação costuma ser simples, mas o Google pode exigir domínio próprio verificado, página de política de privacidade e termos.

## Regras de conta
- Conta nova pelo Google: e-mail já confirmado, sem senha própria (`has_password = 0`).
- E-mail igual ao de uma conta local: **não liga sozinho**; a pessoa entra com a senha e liga o Google em Configurações > Segurança.
- Quem tem 2FA continua precisando do código ao entrar com o Google.
- Desligar o Google só é permitido se a conta tiver senha.

## Rotação do segredo
Gere um novo segredo no Google Cloud Console (Credenciais > cliente OAuth) e atualize no Pages:

```bash
npx wrangler pages secret put GOOGLE_CLIENT_SECRET --project-name espectro
```

O novo valor vale na próxima publicação (merge em `main`).

## Google One Tap (Google Identity Services)
- Aparece só na página inicial para visitantes, com o modal de entrada fechado, no máximo uma vez por carregamento. Se a pessoa dispensa o widget, não voltamos a mostrar por 24 horas (o Google e o navegador ainda aplicam o próprio intervalo). Nunca entra sozinho (`auto_select: false`).
- O botão "Continuar com o Google" continua existindo.
- Fluxo: o navegador pede um nonce de uso único (`/api/auth/google/onetap-nonce`), o Google grava o nonce na credencial e ela volta para `/api/auth/google/onetap`, onde o servidor confere a assinatura RS256 com as chaves públicas do Google (cache pelo Cache-Control), emissor, público, validade, data de emissão e o nonce (consumido na leitura).
- Identidade: `sub`. E-mail de conta existente sem vínculo NÃO é ligado sozinho: o servidor devolve um pedido de ligação (10 min) e a ligação só acontece depois de a pessoa entrar na conta (senha e, se houver, 2FA).
- O e-mail só é marcado como confirmado quando o Google é autoridade sobre ele (`@gmail.com` ou conta Workspace com `hd`).

### Configuração obrigatória no Google Cloud Console
No cliente OAuth (APIs e serviços > Credenciais), em **Origens JavaScript autorizadas**, adicione:

- `https://espectro.pages.dev`

Sem isso o widget não abre (o console do navegador mostra `The given origin is not allowed for the given client ID`). O URI de redirecionamento do botão (`https://espectro.pages.dev/api/auth/google/callback`) continua como está. Ao usar domínio próprio, adicione também a origem dele.

### Quando o e-mail do Google já tem conta no Espectro
Nos dois caminhos (botão e One Tap) o resultado é o mesmo: depois que o Google identifica a pessoa, abre a tela **"Confirme sua senha"**, com o e-mail do Google à vista. Ao digitar a senha da conta (e o código do 2FA, se houver), a conta é autenticada e o Google é ligado a ela; nas próximas vezes o login pelo Google entra direto. Nada é ligado sem essa confirmação, e o pedido pendente vale 10 minutos e uma única vez. Se a pessoa não lembrar a senha, a tela oferece "Esqueci minha senha" (quando o envio de e-mails estiver ativo).
