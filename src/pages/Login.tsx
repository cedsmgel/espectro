import React, { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Landing } from './Landing';

// /login continua existindo (links antigos, redirecionamentos), mas sem formulário próprio:
// abre o modal de autenticação sobre a página inicial. ?tab=cadastro abre no cadastro e ?next= guarda o destino.
export const Login: React.FC = () => {
  const { isAuthenticated, openAuth } = useAuth();
  const [params] = useSearchParams();
  const next = params.get('next');
  // Só caminhos internos, para não virar redirecionamento aberto
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
  const mode = params.get('tab') === 'cadastro' ? 'register' : 'login';

  useEffect(() => {
    if (!isAuthenticated) openAuth({ mode, redirectTo: safeNext });
  }, [isAuthenticated, mode, safeNext, openAuth]);

  if (isAuthenticated) return <Navigate to={safeNext || '/'} replace />;
  return <Landing />;
};
