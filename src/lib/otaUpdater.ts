import { App } from '@capacitor/app';
import { Capacitor, CapacitorHttp, WebView } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import type { PluginListenerHandle } from '@capacitor/core';
import packageJson from '../../package.json';
import { BundleManager, parseManifestPayload, type ManifestPayload } from '@/lib/bundleManager';
import { VersionStore } from '@/lib/versionStore';
import { toast } from '@/components/ui/pro-toast';

type OTAUpdaterOptions = {
  manifestUrl?: string;
  manifestTimeoutMs?: number;
  downloadRetries?: number;
};

// const isDev = process.env.NODE_ENV !== 'production';
const isDev = true;
const otaToastsEnabled = true;

const otaLog = (...args: unknown[]) => {
  if (!isDev) return;
  try { console.log('[OTA]', JSON.stringify(args)); } catch { /* ignore */ }
};

const toComparableParts = (value: string): number[] =>
  value
    .split('.')
    .map((part) => Number(part.replace(/[^0-9]/g, '')))
    .map((part) => (Number.isFinite(part) ? part : 0));

const compareVersion = (left: string, right: string): number => {
  const leftParts = toComparableParts(left);
  const rightParts = toComparableParts(right);
  const max = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < max; index += 1) {
    const l = leftParts[index] ?? 0;
    const r = rightParts[index] ?? 0;
    if (l > r) return 1;
    if (l < r) return -1;
  }

  return 0;
};

export class OTAUpdater {
  private readonly versionStore = new VersionStore();
  private readonly bundleManager = new BundleManager();
  private readonly manifestUrl: string;
  private readonly manifestTimeoutMs: number;
  private readonly downloadRetries: number;

  private listeners: PluginListenerHandle[] = [];
  private started = false;
  private appIsActive = true;
  private checking = false;
  private applying = false;

  constructor(options: OTAUpdaterOptions = {}) {
    this.manifestUrl = (options.manifestUrl ?? process.env.NEXT_PUBLIC_OTA_MANIFEST_URL ?? process.env.NEXT_PUBLIC_UPDATER_MANIFEST_URL ?? '').trim();
    this.manifestTimeoutMs = options.manifestTimeoutMs ?? Number(process.env.NEXT_PUBLIC_OTA_MANIFEST_TIMEOUT_MS ?? 15000);
    this.downloadRetries = options.downloadRetries ?? Number(process.env.NEXT_PUBLIC_OTA_DOWNLOAD_RETRIES ?? 2);
  }

  async start(): Promise<void> {
    if (this.started || !Capacitor.isNativePlatform()) return;
    this.started = true;

    await this.bootstrapActiveVersion();

    // NOTE: do NOT apply `activePath` automatically at startup. Persisting
    // sentinel values such as `public` to the WebView base path can make the
    // app fail to load (connection refused). The WebView base path is only
    // changed when applying a downloaded bundle via `applyStagedUpdate()` —
    // that flow validates the bundle directory first.

    await this.registerLifecycleListeners();
    await this.applyStagedUpdate('launch');
    await this.checkForUpdate();
  }

  async stop(): Promise<void> {
    await Promise.all(this.listeners.map((listener) => listener.remove()));
    this.listeners = [];
    this.started = false;
  }

  private async bootstrapActiveVersion(): Promise<void> {
    const snapshot = await this.versionStore.getSnapshot();
    if (snapshot.activeVersion && snapshot.activePath) {
      return;
    }

    const builtinVersion = packageJson.version ?? 'builtin';
    await this.versionStore.setActive(builtinVersion, 'public');
  }

  private async registerLifecycleListeners(): Promise<void> {
    const pauseListener = await App.addListener('pause', async () => {
      this.appIsActive = false;
      await this.applyStagedUpdate('pause');
    });

    const resumeListener = await App.addListener('resume', () => {
      this.appIsActive = true;
      void this.checkForUpdate();
    });

    const appStateListener = await App.addListener('appStateChange', async ({ isActive }) => {
      this.appIsActive = isActive;
      if (!isActive) {
        await this.applyStagedUpdate('background');
      }
    });

    this.listeners.push(pauseListener, resumeListener, appStateListener);
  }

  private async fetchManifest(): Promise<ManifestPayload | null> {
    if (!this.manifestUrl) return null;

    try {
      const response = await CapacitorHttp.get({
        url: this.manifestUrl,
        headers: { Accept: 'application/json' },
        connectTimeout: this.manifestTimeoutMs,
        readTimeout: this.manifestTimeoutMs,
      });

      if (response.status < 200 || response.status >= 300) {
        otaLog('Manifest fetch failed with HTTP status', response.status);
        return null;
      }

      const payload = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      const manifest = parseManifestPayload(payload);
      otaLog('Manifest fetch result', manifest);
      return manifest;
    } catch (error) {
      otaLog('Manifest fetch error', error);
      return null;
    }
  }

  async checkForUpdate(): Promise<void> {
    if (this.checking || !this.manifestUrl || !Capacitor.isNativePlatform()) return;
    this.checking = true;

    try {
      const manifest = await this.fetchManifest();
      if (!manifest) return;

      await this.versionStore.setLastManifestVersion(manifest.version);
      const state = await this.versionStore.getSnapshot();

      const currentVersion = state.activeVersion ?? packageJson.version ?? 'builtin';
      const comparison = compareVersion(manifest.version, currentVersion);
      otaLog('Version comparison', { currentVersion, remoteVersion: manifest.version, comparison });

      if (comparison <= 0) return;
      if (state.stagedVersion === manifest.version) return;
      if (state.downloadedVersions.includes(manifest.version)) return;
      if (state.failedVersions.includes(manifest.version)) {
        otaLog('Skipping blacklisted failed version', manifest.version);
        return;
      }

      let toastId: string | null = null;
      if (otaToastsEnabled) {
        toastId = toast.loading(`Downloading v${manifest.version}...`);
      }

      const prepared = await this.bundleManager.downloadAndPrepareBundle(manifest, {
        retries: this.downloadRetries,
        onProgress: (percent) => {
          otaLog('Download progress', `${percent}%`);
          if (otaToastsEnabled && toastId) {
            toast.show({ id: toastId, title: `Downloading v${manifest.version}`, message: `${percent}%` });
          }
        },
      });

      await this.versionStore.stage(prepared.version, prepared.path);
      otaLog('Staged OTA update', prepared.version);

      if (otaToastsEnabled && toastId) {
        // Offer a direct "apply now" action in the toast — tap to apply immediately
        toast.success(`Downloaded v${prepared.version}`, {
          id: toastId,
          message: 'Tap to apply now or it will apply automatically on next restart.',
          onPress: () => void this.applyStagedUpdate('launch'),
        });
      }
    } catch (error) {
      otaLog('OTA check/download failed', error);
      if (otaToastsEnabled) {
        const msg = error instanceof Error ? error.message : String(error ?? 'unknown error');
        toast.error('OTA download failed', { message: `${msg} — will retry later.` });
      }
    } finally {
      this.checking = false;
    }
  }

  private async rollbackToPrevious(previousPath: string | null): Promise<void> {
    if (!previousPath) return;
    try {
      await WebView.setServerBasePath({ path: previousPath });
      await WebView.persistServerBasePath();
      otaLog('Rollback applied to path', previousPath);
    } catch (error) {
      otaLog('Rollback failed', error);
    }
  }

  private async pathHasIndexHtml(path: string | null): Promise<boolean> {
    if (!path) return false;

    const normalized = path.replace(/\/+$/, '');
    const statCandidates = [
      `${normalized}/index.html`,
      normalized.startsWith('file://') ? `${normalized.replace(/^file:\/\//, '')}/index.html` : null,
    ].filter((candidate): candidate is string => Boolean(candidate));

    for (const candidate of statCandidates) {
      try {
        if (candidate.startsWith('/') || candidate.startsWith('file://')) {
          await Filesystem.stat({ path: candidate } as any);
        } else {
          await Filesystem.stat({ path: candidate, directory: Directory.Data });
        }
        return true;
      } catch {
        // try next candidate
      }
    }

    return false;
  }

  private async pickValidWebViewBasePath(path: string): Promise<string> {
    const base = path.replace(/\/+$/, '');
    const withoutScheme = base.replace(/^file:\/\//, '');
    const withScheme = withoutScheme.startsWith('file://') ? withoutScheme : `file://${withoutScheme}`;

    const candidates = Array.from(new Set([base, withoutScheme, withScheme]));

    for (const candidate of candidates) {
      if (await this.pathHasIndexHtml(candidate)) {
        return candidate;
      }
    }

    return base;
  }

  /**
   * Resolve a VersionStore bundle path (usually relative like `ota/bundles/x.y.z`)
   * to the platform path/URI format expected by Capacitor WebView.
   * - leaves absolute or file:// paths untouched
   * - tries Filesystem.getUri for Directory.Data paths and normalizes to match current WebView format
   */
  private async normalizePathForWebView(path: string | null): Promise<string | null> {
    if (!path) return null;

    // If already absolute or a file URI, pick a variant that actually contains index.html
    if (path.startsWith('/') || path.startsWith('file://')) {
      return this.pickValidWebViewBasePath(path);
    }

    try {
      const uriResult: any = await Filesystem.getUri({ path, directory: Directory.Data });
      let resolved: string | null = uriResult?.uri ?? uriResult?.path ?? null;
      if (!resolved) return path;

      // Detect current WebView base path format and normalize accordingly
      try {
        const current = await WebView.getServerBasePath();
        const currentPath = current?.path ?? '';
        if (currentPath && currentPath.startsWith('/')) {
          // WebView returns plain filesystem path -> strip file:// if present
          resolved = resolved.replace(/^file:\/\//, '');
        } else if (currentPath && currentPath.startsWith('file://')) {
          // WebView expects file:// style
          if (!resolved.startsWith('file://')) resolved = `file://${resolved}`;
        }
      } catch {
        // ignore and return resolved as-is
      }

      return this.pickValidWebViewBasePath(resolved);
    } catch (err) {
      otaLog('normalizePathForWebView failed, falling back to original path', path, err);
      return this.pickValidWebViewBasePath(path);
    }
  }

  async applyStagedUpdate(trigger: 'pause' | 'background' | 'launch'): Promise<void> {
    if (this.applying || !Capacitor.isNativePlatform()) return;
    if (trigger !== 'launch' && this.appIsActive) {
      otaLog('Skip apply while app is active');
      return;
    }

    const state = await this.versionStore.getSnapshot();
    if (!state.stagedVersion || !state.stagedPath) return;

    this.applying = true;
    let applyToastId: string | null = null;
    if (otaToastsEnabled) {
      applyToastId = toast.loading(`Applying v${state.stagedVersion}...`);
    }

    try {
      const isValid = await this.bundleManager.validateBundleStructure(state.stagedPath);
      if (!isValid) {
        await this.versionStore.markFailed(state.stagedVersion);
        otaLog('Staged bundle invalid, blacklisted', state.stagedVersion);
        if (otaToastsEnabled && applyToastId) {
          toast.error('OTA apply aborted', { id: applyToastId, message: 'Staged bundle failed validation and was blacklisted.' });
        }
        return;
      }

      let previousPath: string | null = state.activePath;
      try {
        const currentPath = await WebView.getServerBasePath();
        previousPath = currentPath?.path ?? previousPath;
      } catch {
        previousPath = state.activePath;
      }

      await this.versionStore.markApplyAttempt(state.stagedVersion);

      // Resolve stagedPath to the format WebView expects (absolute / file://)
      const resolvedPath = (await this.normalizePathForWebView(state.stagedPath)) ?? state.stagedPath;

      // Defensive: never attempt to set WebView to sentinel values (e.g. 'public').
      if (resolvedPath === 'public' || resolvedPath === 'builtin') {
        otaLog('Staged path is sentinel, marking active without changing WebView', resolvedPath);
        await this.versionStore.setActive(state.stagedVersion, state.stagedPath);
        await this.versionStore.clearFailed(state.stagedVersion);
        otaLog('Applied OTA update (sentinel)', { version: state.stagedVersion, trigger });
      } else {
        // Try setting the WebView base path and verify it took effect
        await WebView.setServerBasePath({ path: resolvedPath });
        await WebView.persistServerBasePath();

        const after = await WebView.getServerBasePath();
        const appliedPath = after?.path ?? null;

        otaLog('Set server base path ->', { requested: state.stagedPath, resolved: resolvedPath, applied: appliedPath });

        const appliedHasIndex = await this.pathHasIndexHtml(appliedPath ?? resolvedPath);

        otaLog('Applied path has index.html?', appliedHasIndex);

        if (!appliedPath || !appliedHasIndex) {
          // Try an alternate form (toggle file:// prefix) as a best-effort fallback
          const alt = resolvedPath?.startsWith('file://') ? resolvedPath.replace(/^file:\/\//, '') : `file://${resolvedPath}`;
          otaLog('Retrying setServerBasePath with alternate format', alt);
          await WebView.setServerBasePath({ path: alt });
          await WebView.persistServerBasePath();
          const after2 = await WebView.getServerBasePath();
          otaLog('Retry result', after2?.path ?? null);
          const retryHasIndex = await this.pathHasIndexHtml(after2?.path ?? alt);
          if (!after2?.path || !retryHasIndex) {
            throw new Error('WebView failed to apply a bundle path with index.html');
          }
        }

        await this.versionStore.setActive(state.stagedVersion, state.stagedPath);
        await this.versionStore.clearFailed(state.stagedVersion);

        otaLog('Applied OTA update', { version: state.stagedVersion, trigger });
      }

      if (otaToastsEnabled && applyToastId) {
        toast.success(`Applied v${state.stagedVersion}`, { id: applyToastId, message: 'Restarting now...' });
      }

      // Reload to activate new bundle
      window.location.reload();
    } catch (error) {
      otaLog('Apply OTA failed', error);
      if (otaToastsEnabled && applyToastId) {
        toast.error('OTA apply failed', { id: applyToastId, message: 'Rollback completed — keeping current version.' });
      } else if (otaToastsEnabled) {
        toast.error('OTA apply failed', { message: 'Rollback completed — keeping current version.' });
      }

      await this.versionStore.markFailed(state.stagedVersion);
      await this.versionStore.clearStaged();
      await this.rollbackToPrevious(state.activePath);
    } finally {
      this.applying = false;
    }
  }
}

let singletonUpdater: OTAUpdater | null = null;

export const getOTAUpdater = (): OTAUpdater => {
  singletonUpdater ??= new OTAUpdater();
  return singletonUpdater;
};
