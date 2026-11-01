import { useEffect, useState } from 'react';
import { adminApi, authStorage } from '../lib/api';

// A consulta é feita uma vez por conta; o servidor é quem decide, o token não dá poder de admin
const cache = new Map<number, Promise<boolean>>();

// Diz se a conta logada é administradora (null enquanto consulta)
export function useIsAdmin(): boolean | null {
  const userId = authStorage.getUser()?.id;
  const [isAdmin, setIsAdmin] = useState<boolean | null>(userId ? null : false);

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      return;
    }
    let active = true;
    let request = cache.get(userId);
    if (!request) {
      request = adminApi.me().then((res) => res.is_admin).catch(() => false);
      cache.set(userId, request);
    }
    void request.then((value) => {
      if (active) setIsAdmin(value);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  return isAdmin;
}
