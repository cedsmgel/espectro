// Ponte entre qualquer parte do app (inclusive código fora do React) e o modal de autenticação.
// Não guarda sessão: a sessão continua sendo só o token JWT em authStorage.

export interface AuthRequest {
  mode?: 'login' | 'register';
  // Explicação curta mostrada no topo do modal ("Para curtir, entre ou crie uma conta")
  reason?: string;
  // Para onde ir depois de entrar; sem valor, fica na página atual (ou vai ao feed se estiver em /login)
  redirectTo?: string | null;
  // Abre direto no segundo passo do 2FA (ex.: depois de entrar com o Google)
  mfaToken?: string;
}

export const AUTH_REQUIRED_EVENT = 'espectro:auth-required';
export const AUTH_CHANGED_EVENT = 'espectro:auth-changed';

export function requestAuth(request: AuthRequest = {}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<AuthRequest>(AUTH_REQUIRED_EVENT, { detail: request }));
}

export function notifyAuthChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export const currentPath = (): string => `${window.location.pathname}${window.location.search}`;
