import { Capacitor, CapacitorHttp } from '@capacitor/core';
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

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000; // 32KB chunks
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
};

const normalizeChecksum = (input: string): string => {
  const trimmed = input.trim();
  return trimmed.includes('-') ? trimmed.split('-').slice(1).join('-') : trimmed;
};

const encodeHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

// Serialize errors and plugin/native results for logging (preserves message + stack)
const _serializeError = (v: unknown): unknown => {
  if (v instanceof Error) return { name: v.name, message: v.message, stack: v.stack };
  if (v && typeof v === 'object') {
    const anyV = v as Record<string, unknown>;
    if (typeof anyV.message === 'string' || typeof anyV.name === 'string' || typeof anyV.stack === 'string') {
      return { name: anyV.name, message: anyV.message, stack: anyV.stack };
    }
    try { return JSON.parse(JSON.stringify(v)); } catch { return String(v); }
  }
  return v;
};

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
        throw new Error('OTA checksum validation failed, actual: ' + actualHex + ', expected: ' + expected);
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

  private async downloadUrlToFile(manifest: ManifestPayload, zipPath: string, options: DownloadOptions = {}): Promise<void> {
    // Primary: streaming fetch (reports progress when content-length is available)
    try {
      const resp = await fetch(manifest.url, { method: 'GET' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const contentLengthHeader = resp.headers.get('content-length');
      const total = contentLengthHeader ? parseInt(contentLengthHeader, 10) : NaN;
      let arrayBuffer: ArrayBuffer;

      if (resp.body && options.onProgress && !Number.isNaN(total)) {
        const reader = resp.body.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.length;
            options.onProgress(Math.floor((received / total) * 100));
          }
        }
        const buffer = new Uint8Array(received);
        let offset = 0;
        for (const c of chunks) { buffer.set(c, offset); offset += c.length; }
        arrayBuffer = buffer.buffer;
      } else {
        arrayBuffer = await resp.arrayBuffer();
        if (options.onProgress) options.onProgress(100);
      }

      const base64 = arrayBufferToBase64(arrayBuffer);
      await Filesystem.writeFile({ path: zipPath, directory: Directory.Data, data: base64, recursive: true });
      return;
    } catch (fetchErr) {
      // Fallback to CapacitorHttp for environments where fetch doesn't work as expected
      try {
        const httpResp = await CapacitorHttp.get({
          url: manifest.url,
          responseType: 'arraybuffer' as any,
          connectTimeout: 30000,
          readTimeout: 30000,
        });
        const data = httpResp.data;
        let arrayBuffer: ArrayBuffer;
        if (data instanceof ArrayBuffer) arrayBuffer = data;
        else if (typeof data === 'string') arrayBuffer = toArrayBuffer(data);
        else if (data && (data as any).buffer instanceof ArrayBuffer) arrayBuffer = (data as any).buffer;
        else throw fetchErr;

        const base64 = arrayBufferToBase64(arrayBuffer);
        await Filesystem.writeFile({ path: zipPath, directory: Directory.Data, data: base64, recursive: true });
        if (options.onProgress) options.onProgress(100);
        return;
      } catch (err) {
        // surface original fetch error if fallback also fails
        throw err ?? fetchErr;
      }
    }
  }

  async validateBundleStructure(bundlePath: string): Promise<boolean> {
    try {
      await Filesystem.stat({ path: `${bundlePath}/index.html`, directory: Directory.Data });
      const nextDir = await Filesystem.readdir({ path: `${bundlePath}/_next`, directory: Directory.Data });
      console.debug('[OTA][bundle] Detected _next folder with', nextDir.files.length, 'items');

      return nextDir.files.length > 0;
    } catch (err) {
      console.error('[OTA][bundle] Validation error', err);
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
      try {
        // download + save ZIP to filesystem (extracted to a dedicated function)
        await this.downloadUrlToFile(manifest, zipPath, options);

        await this.verifyChecksumIfNeeded(zipPath, manifest.checksum);
        await this.unzipToBundleDirectory(zipPath, bundlePath);

        const valid = await this.validateBundleStructure(bundlePath);
        if (!valid) throw new Error('OTA bundle validation failed (missing index.html/_next/assets)');

        await Filesystem.deleteFile({ path: zipPath, directory: Directory.Data }).catch(() => undefined);
        return { version: manifest.version, path: bundlePath };
      } catch (error) {
        lastError = error;
        try { console.debug('[OTA][bundle] download attempt failed', JSON.stringify({ version: manifest.version, attempt, error: _serializeError(error) })); } catch { /* ignore */ }
      }
    }

    await Filesystem.deleteFile({ path: zipPath, directory: Directory.Data }).catch(() => undefined);

    // Normalize/rethrow so callers receive a readable Error (helps remote loggers that stringify objects)
    if (lastError instanceof Error) {
      throw new Error(`downloadAndPrepareBundle failed for ${manifest.version}: ${lastError.message}`);
    }

    throw new Error(`downloadAndPrepareBundle failed for ${manifest.version}: ${String(lastError ?? 'unknown error')}`);

  }

  async deleteBundle(version: string): Promise<void> {
    const bundlePath = await this.getBundlePath(version);
    await removeDirIfExists(bundlePath);
  }

  async copyBundleToPublic(bundlePath: string): Promise<string> {
    const publicPath = 'public';
    console.log('[OTA][bundle] Copying bundle to public folder:', { from: bundlePath, to: publicPath });
    
    // Clear the destination first to ensure a clean copy
    await removeDirIfExists(publicPath).catch(() => {});
    
    // Check if this is a virtual builtin bundle (marker only, no files to copy)
    let isVirtualBuiltin = bundlePath === 'builtin';
    if (!isVirtualBuiltin) {
      try {
        const verifyData = await Filesystem.readFile({ path: `${bundlePath}/ota-bundle.json`, directory: Directory.Data });
        const payload = JSON.parse(atob(verifyData.data as string));
        if (payload.isBuiltin) isVirtualBuiltin = true;
      } catch { /* ignore */ }
    }

    if (isVirtualBuiltin) {
      console.log('[OTA][bundle] Virtual builtin detected, returning sentinel for assets reset');
      return 'builtin';
    }

    // Copy the contents of bundlePath to public
    await Filesystem.copy({
      from: bundlePath,
      to: publicPath,
      directory: Directory.Data,
      toDirectory: Directory.Data
    });
    
    return publicPath;
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
