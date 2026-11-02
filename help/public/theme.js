// Aplica o tema antes de pintar a página (sem piscar): preferência salva ou a do sistema
(function () {
  try {
    var saved = localStorage.getItem('ajuda_tema');
    var dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
