// Envio de e-mail transacional pelo Resend (API REST). Todo o app envia por aqui,
// então trocar de provedor depois é mexer só neste arquivo.

export interface EmailEnv {
  RESEND_API_KEY?: string;
  // Remetente. Sem domínio verificado no Resend, só "Espectro <onboarding@resend.dev>" funciona (e só para o dono da conta Resend).
  EMAIL_FROM?: string;
  // Endereço público do app, usado nos links dos e-mails (nunca o cabeçalho Host da requisição)
  APP_URL?: string;
  // "1" só em desenvolvimento: em vez de enviar, escreve o e-mail (com o link) no console do servidor
  EMAIL_DEV_LOG?: string;
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  // Mesma chave = no máximo um e-mail, mesmo se a requisição for repetida
  idempotencyKey?: string;
}

export const emailEnabled = (env: EmailEnv): boolean => Boolean(env.RESEND_API_KEY);

export const appUrl = (env: EmailEnv): string => (env.APP_URL || "https://espectro.pages.dev").replace(/\/$/, "");

const FROM_DEFAULT = "Espectro <onboarding@resend.dev>";

// Tenta de novo só em falha de rede, 429 e 5xx; 4xx não se repete
export async function sendEmail(env: EmailEnv, email: OutgoingEmail): Promise<{ sent: boolean; error?: string }> {
  if (!env.RESEND_API_KEY) {
    if (env.EMAIL_DEV_LOG === "1") {
      console.log(`[EMAIL_DEV_LOG] para ${email.to} | ${email.subject}\n${email.text}`);
      return { sent: true };
    }
    return { sent: false, error: "RESEND_API_KEY não configurada" };
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          ...(email.idempotencyKey ? { "Idempotency-Key": email.idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM || FROM_DEFAULT,
          to: [email.to],
          subject: email.subject,
          html: email.html,
          text: email.text,
        }),
      });
      if (response.ok) return { sent: true };
      if (response.status !== 429 && response.status < 500) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        return { sent: false, error: `Resend ${response.status}: ${body?.message || "erro"}` };
      }
    } catch {
      // falha de rede: tenta de novo
    }
    await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt));
  }
  return { sent: false, error: "Resend indisponível" };
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

function layout(title: string, intro: string, buttonLabel: string | null, url: string | null, footer: string): { html: string; text: string } {
  const button = buttonLabel && url
    ? `<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:600;display:inline-block">${escapeHtml(buttonLabel)}</a></p><p style="color:#666;font-size:13px">Se o botão não abrir, copie este endereço no navegador:<br>${escapeHtml(url)}</p>`
    : "";
  const html = `<div style="font-family:system-ui,Segoe UI,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111"><h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1><p style="font-size:15px;line-height:1.5">${escapeHtml(intro)}</p>${button}<hr style="border:none;border-top:1px solid #ddd;margin:24px 0"><p style="color:#666;font-size:13px;line-height:1.5">${escapeHtml(footer)}</p><p style="color:#666;font-size:13px">Espectro</p></div>`;
  const text = `${title}\n\n${intro}\n\n${url ? `${buttonLabel}: ${url}\n\n` : ""}${footer}\n\nEspectro`;
  return { html, text };
}

export function verifyEmailMessage(env: EmailEnv, to: string, token: string): OutgoingEmail {
  const url = `${appUrl(env)}/confirmar-email?token=${encodeURIComponent(token)}`;
  const { html, text } = layout(
    "Confirme seu e-mail",
    "Confirme que este endereço é seu para poder recuperar a senha e proteger sua conta no Espectro. O link vale por 24 horas.",
    "Confirmar e-mail",
    url,
    "Se você não criou uma conta no Espectro, ignore esta mensagem."
  );
  return { to, subject: "Confirme seu e-mail no Espectro", html, text };
}

export function resetPasswordMessage(env: EmailEnv, to: string, token: string): OutgoingEmail {
  const url = `${appUrl(env)}/redefinir-senha?token=${encodeURIComponent(token)}`;
  const { html, text } = layout(
    "Redefinir sua senha",
    "Recebemos um pedido para redefinir a senha da sua conta. O link vale por 30 minutos e só pode ser usado uma vez.",
    "Criar nova senha",
    url,
    "Se não foi você, ignore esta mensagem: sua senha continua a mesma."
  );
  return { to, subject: "Redefinir a senha do Espectro", html, text };
}

export function passwordChangedMessage(to: string): OutgoingEmail {
  const { html, text } = layout(
    "Sua senha foi alterada",
    "A senha da sua conta no Espectro acabou de ser redefinida e os outros aparelhos foram desconectados.",
    null,
    null,
    "Se não foi você, redefina a senha de novo agora e confira os aparelhos conectados na central de segurança."
  );
  return { to, subject: "Sua senha do Espectro foi alterada", html, text };
}
