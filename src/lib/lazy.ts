import { lazy, type ComponentType } from 'react';

const RELOAD_FLAG = 'espectro:chunk-reload';

// Carrega um componente sob demanda. Depois de um deploy os arquivos antigos deixam de existir,
// então uma aba aberta recarrega uma vez para buscar a versão nova.
export function lazyNamed<M extends Record<K, ComponentType<any>>, K extends keyof M>(
  load: () => Promise<M>,
  name: K
) {
  return lazy<M[K]>(async () => {
    try {
      const mod = await load();
      try {
        sessionStorage.removeItem(RELOAD_FLAG);
      } catch {}
      return { default: mod[name] };
    } catch (err) {
      let alreadyReloaded = true;
      try {
        alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === '1';
        sessionStorage.setItem(RELOAD_FLAG, '1');
      } catch {}
      if (alreadyReloaded) throw err;
      window.location.reload();
      return new Promise<never>(() => {});
    }
  });
}
