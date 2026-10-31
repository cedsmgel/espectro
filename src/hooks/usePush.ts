import { useCallback, useEffect, useState } from 'react';
import {
  disablePush,
  enablePush,
  getCurrentSubscription,
  getPushPermission,
  needsHomeScreenInstall,
  PushPermission,
  updatePushPreview,
} from '../lib/push';

const PREVIEW_KEY = 'espectro_push_preview';

function readPreview(): boolean {
  try {
    return localStorage.getItem(PREVIEW_KEY) !== '0';
  } catch {
    return true;
  }
}

// Estado e ações das notificações push deste aparelho
export function usePush() {
  const [permission, setPermission] = useState<PushPermission>(getPushPermission());
  const [subscribed, setSubscribed] = useState(false);
  const [showPreview, setShowPreview] = useState(readPreview);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setPermission(getPushPermission());
    setSubscribed(Boolean(await getCurrentSubscription()));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await enablePush(showPreview);
      await refresh();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível ativar as notificações.');
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [showPreview, refresh]);

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await disablePush();
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const changePreview = useCallback(async (value: boolean) => {
    setShowPreview(value);
    try {
      localStorage.setItem(PREVIEW_KEY, value ? '1' : '0');
    } catch {}
    await updatePushPreview(value).catch(() => {});
  }, []);

  return {
    supported: permission !== 'unsupported',
    permission,
    subscribed,
    showPreview,
    busy,
    error,
    iosInstallNeeded: needsHomeScreenInstall(),
    enable,
    disable,
    changePreview,
  };
}

export type PushState = ReturnType<typeof usePush>;
