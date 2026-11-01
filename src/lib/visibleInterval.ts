// setInterval que não dispara com a aba escondida (economiza requisições do plano e bateria).
// Devolve a função que cancela.
export function visibleInterval(callback: () => void, ms: number): () => void {
  const id = window.setInterval(() => {
    if (document.visibilityState === 'visible') callback();
  }, ms);
  return () => window.clearInterval(id);
}
