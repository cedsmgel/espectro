// Alterna claro/escuro e guarda a escolha
document.addEventListener('click', function (event) {
  var button = event.target.closest('[data-theme-toggle]');
  if (!button) return;
  var dark = document.documentElement.classList.toggle('dark');
  try {
    localStorage.setItem('ajuda_tema', dark ? 'dark' : 'light');
  } catch (e) {}
  button.setAttribute('aria-pressed', dark ? 'true' : 'false');
});
