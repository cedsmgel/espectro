// Categorias da central. Os nomes seguem o menu do app para a pessoa achar o mesmo termo nos dois lugares.
export interface Categoria {
  slug: string;
  nome: string;
  resumo: string;
  // Conteúdo interno de um <svg viewBox="0 0 24 24"> desenhado só com traços
  icone: string;
}

export const categorias: Categoria[] = [
  {
    slug: 'primeiros-passos',
    nome: 'Primeiros passos',
    resumo: 'Criar conta, entrar, recuperar a senha.',
    icone: '<polygon points="6 4 20 12 6 20 6 4"/>',
  },
  {
    slug: 'conta-e-seguranca',
    nome: 'Conta e segurança',
    resumo: 'Senha, verificação em duas etapas, aparelhos e exclusão.',
    icone: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/>',
  },
  {
    slug: 'privacidade',
    nome: 'Privacidade',
    resumo: 'Quem vê o que você publica e como interage com você.',
    icone: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  },
  {
    slug: 'publicar-e-interagir',
    nome: 'Publicar e interagir',
    resumo: 'Publicações, Momentum, vídeos e comunidades.',
    icone: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
  },
  {
    slug: 'mensagens-e-grupos',
    nome: 'Mensagens e grupos',
    resumo: 'Conversas, mensagens temporárias e permissões.',
    icone: '<path d="M4 5h16v11H9l-5 4V5z"/>',
  },
  {
    slug: 'denuncias-e-seguranca',
    nome: 'Denúncias e segurança',
    resumo: 'Denunciar, bloquear e o que acontece depois.',
    icone: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
  },
  {
    slug: 'seus-dados',
    nome: 'Seus dados (LGPD)',
    resumo: 'Baixar, corrigir e excluir seus dados.',
    icone: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  },
  {
    slug: 'termos-e-politicas',
    nome: 'Termos e políticas',
    resumo: 'Termos de Uso, Privacidade e direitos autorais.',
    icone: '<path d="M7 3h7l4 4v14H7V3z"/><path d="M14 3v4h4"/>',
  },
];

export const APP_URL = 'https://espectro.pages.dev';
