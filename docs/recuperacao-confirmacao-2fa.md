# Recuperação de senha, confirmação de e-mail e 2FA no Espectro

Estudo de apoio. Fontes de segurança citadas aqui são blogs secundários; a norma de referência é a NIST SP 800-63B (revisão 4) e a RFC 6238 (TOTP). Confirme os números nelas antes de documentar como política.

## 1. Dá para usar a Cloudflare para enviar e-mails?

Sim: o **Cloudflare Email Service (Email Sending, em beta)** envia e-mail transacional (confirmações, alertas, recuperação) por binding de Worker, API REST ou SMTP. Requisitos que não dependem de código:

| Requisito | Situação do Espectro |
| --- | --- |
| Plano Workers Paid | A confirmar na conta |
| Domínio próprio na Cloudflare com o envio habilitado (SPF/DKIM/DMARC) | **Não há**: o app roda em `espectro.pages.dev`, que não pode ser configurado para envio |
| Antes de habilitar o domínio, só envia a endereços verificados | Serve para testar, não para usuários |
| Limite diário baixo no início, que cresce com a reputação | Contar com isso no lançamento |

Na checagem feita aqui, `wrangler email sending list` respondeu "Unauthorized": o token atual não alcançou a API de envio (permissão ou plano).

Ponto técnico: a documentação consultada não confirma o binding `send_email` em **Pages Functions**. Plano B previsto: API REST com um token guardado como secret do Pages.

## 2. Desenho: confirmação de e-mail e recuperação de senha

- Tabela `email_tokens` (`user_id`, `purpose`, `token_hash`, `expires_at`, `used_at`): token aleatório de 32 bytes, **só o hash SHA-256 fica no banco**, uso único.
- Validade: recuperação 30 min; confirmação 24 h. Um novo pedido invalida os anteriores.
- Resposta **sempre igual** ("se o e-mail existir, enviamos o link"), para não revelar quais contas existem; limite por IP e por conta.
- Ao redefinir a senha: encerrar todas as sessões (já existe `sessions_valid_after`) e enviar aviso "sua senha foi alterada".
- `users.email_verified_at`: obrigatório para recuperar senha e para recuperar 2FA; troca de e-mail exige confirmar o novo endereço e avisa o antigo.
- Links apontam para o domínio próprio, nunca para o cabeçalho `Host` da requisição.

## 3. 2FA rigoroso

### Fatores recomendados
1. **Passkeys (WebAuthn)**: resistentes a phishing, o nível mais forte. Exigem um `rpId` fixo (o domínio). **Se o domínio mudar depois, as passkeys deixam de valer**, por isso o domínio precisa ser decidido antes.
2. **TOTP (RFC 6238)**: app autenticador, 6 dígitos, 30 s, SHA-1, segredo de 20 bytes. Implementável com WebCrypto, sem biblioteca.
3. **Códigos de recuperação**: 10 códigos de uso único, mostrados uma vez, guardados com hash.

Fora: **SMS** (troca de chip, custo) e e-mail como segundo fator (mesma caixa que recupera a senha). E-mail só entra como recuperação, com espera.

### Regras de implementação
- Segredo TOTP **cifrado em repouso** (AES-GCM, chave em secret novo `TOTP_ENC_KEY`).
- Aceitar janela de ±1 passo e **gravar o último passo usado** para impedir reaproveitamento do mesmo código.
- Login em dois passos: senha correta devolve `mfa_required` e um token curto (5 min) que **não dá acesso a nada**; só o código válido emite a sessão. O JWT final registra `amr` (métodos usados) e o horário do segundo fator.
- Limite de tentativas: 5 por 5 min por conta e IP, bloqueio crescente, aviso ao dono da conta após falhas repetidas.
- Ativar exige senha e um código válido de confirmação; desativar ou gerar novos códigos exige senha e um código.
- **Reautenticação** (código recente, até 10 min) para trocar senha ou e-mail, exportar dados, excluir a conta e encerrar sessões.
- **Administradores**: 2FA obrigatório.
- "Lembrar este aparelho": desligado por padrão; se existir, preso à sessão do aparelho e com prazo curto.
- Recuperação sem fator: só com e-mail confirmado, espera de 48 h, aviso aos aparelhos ativos e possibilidade de cancelar.

### Biblioteca
TOTP e códigos de recuperação não precisam de dependência. Passkeys exigem validação de CBOR/COSE e assinatura: usar `@simplewebauthn/server` (funciona em Workers) é mais seguro que reescrever.

## 4. Fases propostas
1. **Infra de e-mail** (domínio, envio, `email_tokens`), confirmação de e-mail e recuperação de senha.
2. **TOTP + códigos de recuperação + reautenticação** e 2FA obrigatório para administradores.
3. **Passkeys.**
4. Alertas de segurança por e-mail (novo acesso, 2FA alterado) e painel de moderação de abuso.

## 5. Decisões necessárias
1. Existe um domínio próprio para o Espectro (ou será comprado) e a conta está no plano Workers Paid?
2. A confirmação de e-mail será obrigatória para usar a conta ou só para recuperação e 2FA? (Recomendado: só para recuperação e 2FA, para não travar o cadastro.)
