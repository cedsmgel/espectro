# Política de segurança

Se você encontrou uma vulnerabilidade no Espectro, **não abra uma issue pública**.
Use o recurso "Report a vulnerability" na aba *Security* do repositório no GitHub
ou envie um e-mail privado ao mantenedor.

Segredos (como `JWT_SECRET`) nunca devem ser commitados:

- Produção: `wrangler pages secret put JWT_SECRET --project-name espectro`
- Desenvolvimento local: arquivo `.dev.vars` (ignorado pelo git)
