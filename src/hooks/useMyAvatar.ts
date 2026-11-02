import { useEffect, useState } from 'react';
import { authStorage, profileApi } from '../lib/api';

// O usuário guardado vem do token de login e pode não trazer a foto: busca uma vez e guarda junto com o usuário
const requested = new Set<number>();

export function useMyAvatar(): string | null {
  const user = authStorage.getUser();
  const [fetched, setFetched] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.avatar_url !== undefined || requested.has(user.id)) return;
    requested.add(user.id);
    profileApi
      .get()
      .then((profile) => {
        const avatar = profile.avatar_url ?? null;
        authStorage.setUser({ ...user, avatar_url: avatar });
        setFetched(avatar);
      })
      .catch(() => requested.delete(user.id));
  }, [user?.id, user?.avatar_url]);

  return user?.avatar_url ?? fetched;
}
