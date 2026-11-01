import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Landing } from '../../pages/Landing';

// Envolve páginas que só fazem sentido logado. A página NÃO é a barreira de segurança (a API valida o
// token em toda chamada): aqui só evitamos mostrar uma tela vazia e levamos a pessoa ao modal.
// A URL é mantida, então depois do login a própria página aparece, sem redirecionar nem criar laço.
export const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, openAuth } = useAuth();
  const location = useLocation();
  const target = `${location.pathname}${location.search}`;

  useEffect(() => {
    if (!isAuthenticated) openAuth({ mode: 'login', reason: 'Entre na sua conta para acessar esta página.', redirectTo: target });
  }, [isAuthenticated, target, openAuth]);

  return isAuthenticated ? children : <Landing />;
};
