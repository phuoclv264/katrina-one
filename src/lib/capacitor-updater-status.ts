export type ManifestPayload = {
  version: string;
  url: string;
  checksum?: string;
  sessionKey?: string;
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