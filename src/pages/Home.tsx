import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Feed } from './Feed';
import { Landing } from './Landing';

// "/": logado vai direto ao feed; visitante vê a apresentação. Visitante que segue um link de
// exploração (em alta, busca) continua podendo ler o feed público.
export const Home: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [params] = useSearchParams();
  const exploring = params.has('filter') || params.has('q') || params.has('type');
  return isAuthenticated || exploring ? <Feed /> : <Landing />;
};
