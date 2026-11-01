// TOTP (RFC 6238) com WebCrypto: SHA-1, 6 dígitos, passo de 30 segundos, como os apps autenticadores esperam.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_PERIOD = 30;

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Uint8Array {
  const clean = input.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error("base32 inválido");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

export function generateSecret(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(20));
}

async function hotp(secret: Uint8Array, counter: number): Promise<string> {
  const message = new ArrayBuffer(8);
  const view = new DataView(message);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);
  const key = await crypto.subtle.importKey("raw", new Uint8Array(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, message));
  const offset = mac[mac.length - 1] & 0x0f;
  const binary = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(binary % 1_000_000).padStart(6, "0");
}

// Comparação em tempo constante (o tamanho já é fixo em 6)
function sameCode(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const currentStep = (now = Date.now()) => Math.floor(now / 1000 / TOTP_PERIOD);

// Devolve o passo que bateu (janela de ±1 passo para relógios um pouco fora) ou null
export async function matchTotp(secret: Uint8Array, code: string, now = Date.now()): Promise<number | null> {
  if (!/^\d{6}$/.test(code)) return null;
  const step = currentStep(now);
  let matched: number | null = null;
  for (const candidate of [step - 1, step, step + 1]) {
    // Todas as três comparações sempre rodam, sem sair no primeiro acerto
    if (sameCode(await hotp(secret, candidate), code)) matched = candidate;
  }
  return matched;
}

export function otpauthUri(account: string, secretBase32: string): string {
  const label = encodeURIComponent(`Espectro:${account}`);
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=Espectro&algorithm=SHA1&digits=6&period=${TOTP_PERIOD}`;
}
