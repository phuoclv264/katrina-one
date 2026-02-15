export type ManifestPayload = {
  version: string;
  url: string;
  checksum?: string;
  sessionKey?: string;
};

const isBrowser = () => typeof window !== 'undefined';

const safeGetItem = (key: string) => {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const storageKeys = {
  lastReload: 'cap_updater_last_reload',
  pendingVersion: 'cap_updater_pending_version',
  applyFailureCount: 'cap_updater_apply_failure_count',
  autoDisableUntil: 'cap_updater_auto_disabled_until',
} as const;

export const getStorageNumber = (key: string): number => {
  const raw = safeGetItem(key);
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getStorageString = (key: string): string | null => safeGetItem(key);

export const setStorageValue = (key: string, value: string) => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage errors
  }
};

export const removeStorageValue = (key: string) => {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore storage errors
  }
};

export const clearFailureState = () => {
  removeStorageValue(storageKeys.applyFailureCount);
  removeStorageValue(storageKeys.autoDisableUntil);
  removeStorageValue(storageKeys.pendingVersion);
};

export const parseManifestPayload = (value: unknown): ManifestPayload | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const version = typeof record.version === 'string' ? record.version.trim() : '';
  const url = typeof record.url === 'string' ? record.url.trim() : '';

  if (!version || !url) return null;

  try {
    new URL(url);
  } catch {
    return null;
  }

  return {
    version,
    url,
    checksum: typeof record.checksum === 'string' ? record.checksum : undefined,
    sessionKey: typeof record.sessionKey === 'string' ? record.sessionKey : undefined,
  };
};