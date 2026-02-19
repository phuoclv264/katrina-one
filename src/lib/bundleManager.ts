import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import JSZip from 'jszip';

export type ManifestPayload = {
  version: string;
  url: string;
  checksum?: string;
};

type DownloadOptions = {
  retries?: number;
  onProgress?: (percent: number) => void;
};

const OTA_ROOT_DIR = 'ota';
const BUNDLES_DIR = `${OTA_ROOT_DIR}/bundles`;
const TEMP_DIR = `${OTA_ROOT_DIR}/tmp`;

const toArrayBuffer = (data: string): ArrayBuffer => {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
};

const normalizeChecksum = (input: string): string => {
  const trimmed = input.trim();
  return trimmed.includes('-') ? trimmed.split('-').slice(1).join('-') : trimmed;
};

const encodeHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

const sanitizeZipEntryPath = (entryPath: string): string | null => {
  const normalized = entryPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('..') || normalized.startsWith('/')) {
    return null;
  }
  return normalized;
};

const ensureDir = async (path: string) => {
  await Filesystem.mkdir({
    path,
    directory: Directory.Data,
    recursive: true,
  }).catch(() => undefined);
};

const removeDirIfExists = async (path: string) => {
  await Filesystem.rmdir({
    path,
    directory: Directory.Data,
    recursive: true,
  }).catch(() => undefined);
};

export class BundleManager {
  async getBundlePath(version: string): Promise<string> {
    return `${BUNDLES_DIR}/${version}`;
  }

  private async readZipAsArrayBuffer(path: string): Promise<ArrayBuffer> {
    const readResult = await Filesystem.readFile({
      path,
      directory: Directory.Data,
    });

    const base64 = typeof readResult.data === 'string' ? readResult.data : '';
    return toArrayBuffer(base64);
  }

  private async verifyChecksumIfNeeded(zipPath: string, checksum?: string): Promise<void> {
    if (!checksum) return;

    const expected = normalizeChecksum(checksum).toLowerCase();
    const data = await this.readZipAsArrayBuffer(zipPath);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const actualHex = encodeHex(digest).toLowerCase();

    if (expected.length === 64) {
      if (actualHex !== expected) {
        throw new Error('OTA checksum validation failed');
      }
      return;
    }

    const actualBase64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
    if (actualBase64 !== expected) {
      throw new Error('OTA checksum validation failed');
    }
  }

  private async unzipToBundleDirectory(zipPath: string, destinationPath: string): Promise<void> {
    const zipData = await this.readZipAsArrayBuffer(zipPath);
    const archive = await JSZip.loadAsync(zipData);

    await removeDirIfExists(destinationPath);
    await ensureDir(destinationPath);

    const entries = Object.entries(archive.files);

    for (const [entryName, entry] of entries) {
      const safeEntryPath = sanitizeZipEntryPath(entryName);
      if (!safeEntryPath) {
        throw new Error('OTA archive contains unsafe paths');
      }

      const destination = `${destinationPath}/${safeEntryPath}`;

      if (entry.dir) {
        await ensureDir(destination);
        continue;
      }

      const parent = safeEntryPath.split('/').slice(0, -1).join('/');
      if (parent) {
        await ensureDir(`${destinationPath}/${parent}`);
      }

      const fileData = await entry.async('base64');
      await Filesystem.writeFile({
        path: destination,
        directory: Directory.Data,
        data: fileData,
        recursive: true,
      });
    }
  }

  async validateBundleStructure(bundlePath: string): Promise<boolean> {
    try {
      await Filesystem.stat({ path: `${bundlePath}/index.html`, directory: Directory.Data });
      const nextDir = await Filesystem.readdir({ path: `${bundlePath}/_next`, directory: Directory.Data });
      // const assetsDir = await Filesystem.readdir({ path: `${bundlePath}/assets`, directory: Directory.Data });
      // return nextDir.files.length > 0 && assetsDir.files.length > 0;
      return nextDir.files.length > 0;
    } catch {
      return false;
    }
  }

  async downloadAndPrepareBundle(manifest: ManifestPayload, options: DownloadOptions = {}): Promise<{ version: string; path: string }> {
    if (!Capacitor.isNativePlatform()) {
      throw new Error('OTA bundle management is available only on native platforms');
    }

    const bundlePath = await this.getBundlePath(manifest.version);
    if (await this.validateBundleStructure(bundlePath)) {
      return { version: manifest.version, path: bundlePath };
    }

    const retries = Math.max(1, options.retries ?? 2);
    const zipPath = `${TEMP_DIR}/${manifest.version}.zip`;

    await ensureDir(TEMP_DIR);

    let lastError: unknown;

    for (let attempt = 1; attempt <= retries; attempt += 1) {
      let progressHandle: { remove: () => Promise<void> } | null = null;
      try {
        progressHandle = await Filesystem.addListener('progress', (event) => {
          if (!options.onProgress || !event.contentLength) return;
          const percent = Math.floor((event.bytes / event.contentLength) * 100);
          options.onProgress(Math.max(0, Math.min(100, percent)));
        });

        await Filesystem.downloadFile({
          url: manifest.url,
          path: zipPath,
          directory: Directory.Data,
          recursive: true,
        });

        await this.verifyChecksumIfNeeded(zipPath, manifest.checksum);
        await this.unzipToBundleDirectory(zipPath, bundlePath);

        const valid = await this.validateBundleStructure(bundlePath);
        if (!valid) {
          throw new Error('OTA bundle validation failed (missing index.html/_next/assets)');
        }

        await Filesystem.deleteFile({ path: zipPath, directory: Directory.Data }).catch(() => undefined);
        await progressHandle?.remove().catch(() => undefined);
        return { version: manifest.version, path: bundlePath };
      } catch (error) {
        lastError = error;
        await progressHandle?.remove().catch(() => undefined);
      }
    }

    await Filesystem.deleteFile({ path: zipPath, directory: Directory.Data }).catch(() => undefined);
    throw lastError instanceof Error ? lastError : new Error('OTA bundle download failed');
  }
}

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
  };
};
