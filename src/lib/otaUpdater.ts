import { App } from '@capacitor/app';
import { Capacitor, CapacitorHttp, WebView } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import packageJson from '../../package.json';
import { BundleManager, parseManifestPayload, type ManifestPayload } from '@/lib/bundleManager';
import { VersionStore } from '@/lib/versionStore';

type OTAUpdaterOptions = {
  manifestUrl?: string;
  manifestTimeoutMs?: number;
  downloadRetries?: number;
};

// const isDev = process.env.NODE_ENV !== 'production';
const isDev = true;

const otaLog = (...args: unknown[]) => {
  if (!isDev) return;
  console.log('[OTA]', JSON.stringify(args.length === 1 ? args[0] : args));
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

      const prepared = await this.bundleManager.downloadAndPrepareBundle(manifest, {
        retries: this.downloadRetries,
        onProgress: (percent) => otaLog('Download progress', `${percent}%`),
      });

      await this.versionStore.stage(prepared.version, prepared.path);
      otaLog('Staged OTA update', prepared.version);
    } catch (error) {
      otaLog('OTA check/download failed', error);
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

  async applyStagedUpdate(trigger: 'pause' | 'background' | 'launch'): Promise<void> {
    if (this.applying || !Capacitor.isNativePlatform()) return;
    if (trigger !== 'launch' && this.appIsActive) {
      otaLog('Skip apply while app is active');
      return;
    }

    const state = await this.versionStore.getSnapshot();
    if (!state.stagedVersion || !state.stagedPath) return;

    this.applying = true;

    try {
      const isValid = await this.bundleManager.validateBundleStructure(state.stagedPath);
      if (!isValid) {
        await this.versionStore.markFailed(state.stagedVersion);
        otaLog('Staged bundle invalid, blacklisted', state.stagedVersion);
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

      await WebView.setServerBasePath({ path: state.stagedPath });
      await WebView.persistServerBasePath();
      await this.versionStore.setActive(state.stagedVersion, state.stagedPath);
      await this.versionStore.clearFailed(state.stagedVersion);

      otaLog('Applied OTA update', { version: state.stagedVersion, trigger });
      window.location.reload();
    } catch (error) {
      otaLog('Apply OTA failed', error);
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
