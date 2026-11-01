// Rola só a lista de mensagens até o fim. scrollIntoView também move a página inteira,
// e no iPhone, com o teclado aberto, isso faz a tela "pular" para cima.
export function scrollToEnd(end: HTMLElement | null, smooth = true): void {
  let box: HTMLElement | null = end?.parentElement ?? null;
  while (box && box !== document.body) {
    const overflowY = getComputedStyle(box).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') break;
    box = box.parentElement;
  }
  if (!box || box === document.body) return;
  box.scrollTo({ top: box.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
}
