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
