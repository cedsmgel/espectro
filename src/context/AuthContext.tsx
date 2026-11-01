import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authStorage, googleApi, User } from '../lib/api';
import { AUTH_CHANGED_EVENT, AUTH_REQUIRED_EVENT, AuthRequest, requestAuth } from '../lib/authEvents';
import { AuthModal } from '../components/auth/AuthModal';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  // Modal aberto no momento (no máximo um)
  authRequest: AuthRequest | null;
  openAuth: (request?: AuthRequest) => void;
  closeAuth: () => void;
  // Para ações protegidas: devolve true se já há sessão; senão abre o modal e devolve false
  requireAuth: (reason?: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
};

// Estado global de autenticação por cima do authStorage/JWT existente, mais o modal único de entrada
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(() => (authStorage.isAuthenticated() ? authStorage.getUser() : null));
  const [authRequest, setAuthRequest] = useState<AuthRequest | null>(null);

  const sync = useCallback(() => {
    setUser(authStorage.isAuthenticated() ? authStorage.getUser() : null);
  }, []);

  // Login/logout nesta aba (evento próprio) e em outras abas (evento storage)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === 'espectro_token' || e.key === 'espectro_user') sync();
    };
    window.addEventListener(AUTH_CHANGED_EVENT, sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, [sync]);

  useEffect(() => {
    if (user) setAuthRequest(null);
  }, [user]);

  const openAuth = useCallback((request: AuthRequest = {}) => {
    // Nunca dois modais: um pedido novo só atualiza o que já está aberto
    setAuthRequest((current) => (current ? { ...current, ...request } : { mode: 'login', ...request }));
  }, []);

  // Pedidos vindos de fora do React (sessão expirada, ação bloqueada na API)
  useEffect(() => {
    const onRequired = (e: Event) => openAuth((e as CustomEvent<AuthRequest>).detail || {});
    window.addEventListener(AUTH_REQUIRED_EVENT, onRequired);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, onRequired);
  }, [openAuth]);

  const closeAuth = useCallback(() => {
    setAuthRequest(null);
    // /login é só um atalho que abre o modal sobre a página inicial: ao fechar, volta para ela
    if (location.pathname === '/login') navigate('/', { replace: true });
  }, [location.pathname, navigate]);

  const handleSuccess = useCallback(() => {
    // Ligação do Google pedida pelo One Tap: a conta existente acabou de ser autenticada (senha e 2FA)
    if (authRequest?.googleLinkToken) void googleApi.linkCredential(authRequest.googleLinkToken).catch(() => undefined);
    const target = authRequest?.redirectTo;
    setAuthRequest(null);
    sync();
    const here = `${location.pathname}${location.search}`;
    if (target && target !== here) navigate(target, { replace: true });
    else if (location.pathname === '/login') navigate('/', { replace: true });
  }, [authRequest, location.pathname, location.search, navigate, sync]);

  const requireAuth = useCallback(
    (reason?: string) => {
      if (authStorage.isAuthenticated()) return true;
      requestAuth({ mode: 'login', reason });
      return false;
    },
    []
  );

  const logout = useCallback(() => {
    authStorage.clear();
    setAuthRequest(null);
    navigate('/', { replace: true });
  }, [navigate]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: Boolean(user), authRequest, openAuth, closeAuth, requireAuth, logout }),
    [user, authRequest, openAuth, closeAuth, requireAuth, logout]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {authRequest && !user && <AuthModal request={authRequest} onClose={closeAuth} onSuccess={handleSuccess} />}
    </AuthContext.Provider>
  );
};
