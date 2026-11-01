// Roda antes da primeira pintura (script externo e bloqueante, para a política de segurança não precisar de scripts inline)
(function () {
  try {
    // Tema: evita o "flash" de tema errado
    var stored = localStorage.getItem('espectro-theme');
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (stored === 'dark' || (!stored && systemDark)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Sessão: quem está logado não deve ver o HTML pronto do servidor (landing ou página pública) piscar antes do app montar
    if (localStorage.getItem('espectro_token')) document.documentElement.classList.add('has-session');
  } catch (e) {}
})();
