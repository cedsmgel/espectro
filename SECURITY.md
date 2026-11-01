# Política de segurança

Se você encontrou uma vulnerabilidade no Espectro, **não abra uma issue pública**.
Use o recurso "Report a vulnerability" na aba *Security* do repositório no GitHub
ou envie um e-mail privado ao mantenedor.

Segredos (como `JWT_SECRET`) nunca devem ser commitados:

- Produção: `wrangler pages secret put JWT_SECRET --project-name espectro`
- Desenvolvimento local: arquivo `.dev.vars` (ignorado pelo git)

Outras proteções em uso: Cloudflare Turnstile no cadastro, login e "esqueci a senha", CSP e demais cabeçalhos em
`public/_headers`, 2FA opcional e limite de taxa nos endpoints sensíveis. O detalhe está em
`docs/arquitetura-e-recursos.md`. Para desligar o Turnstile numa emergência:
`wrangler pages secret delete TURNSTILE_SITEKEY --project-name espectro`.
