import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';

type OTAState = {
  activeVersion: string | null;
  activePath: string | null;
  stagedVersion: string | null;
  stagedPath: string | null;
  pendingApply: boolean;
  failedVersions: string[];
  downloadedVersions: string[];
  lastManifestVersion: string | null;
  lastAppliedAttemptVersion: string | null;
};

const STORE_FILE_PATH = 'ota/version-store.json';

const DEFAULT_STATE: OTAState = {
  activeVersion: null,
  activePath: null,
  stagedVersion: null,
  stagedPath: null,
  pendingApply: false,
  failedVersions: [],
  downloadedVersions: [],
  lastManifestVersion: null,
  lastAppliedAttemptVersion: null,
};

const uniq = (items: string[]) => Array.from(new Set(items.filter(Boolean)));

const sanitizeState = (value: unknown): OTAState => {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_STATE };
  }

  const record = value as Record<string, unknown>;

  return {
    activeVersion: typeof record.activeVersion === 'string' ? record.activeVersion : null,
    activePath: typeof record.activePath === 'string' ? record.activePath : null,
    stagedVersion: typeof record.stagedVersion === 'string' ? record.stagedVersion : null,
    stagedPath: typeof record.stagedPath === 'string' ? record.stagedPath : null,
    pendingApply: Boolean(record.pendingApply),
    failedVersions: uniq(Array.isArray(record.failedVersions) ? record.failedVersions.filter((item): item is string => typeof item === 'string') : []),
    downloadedVersions: uniq(Array.isArray(record.downloadedVersions) ? record.downloadedVersions.filter((item): item is string => typeof item === 'string') : []),
    lastManifestVersion: typeof record.lastManifestVersion === 'string' ? record.lastManifestVersion : null,
    lastAppliedAttemptVersion: typeof record.lastAppliedAttemptVersion === 'string' ? record.lastAppliedAttemptVersion : null,
  };
};

export type OTAStoreSnapshot = OTAState;

export class VersionStore {
  private state: OTAState = { ...DEFAULT_STATE };
  private loaded = false;
  private writeQueue: Promise<void> = Promise.resolve();

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;

    if (!Capacitor.isNativePlatform()) {
      this.state = { ...DEFAULT_STATE };
      return;
    }

    try {
      const result = await Filesystem.readFile({
        path: STORE_FILE_PATH,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      this.state = sanitizeState(JSON.parse(result.data as string));
    } catch {
      this.state = { ...DEFAULT_STATE };
      await this.persist();
    }
  }

  private async persist(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    await Filesystem.mkdir({
      path: 'ota',
      directory: Directory.Data,
      recursive: true,
    }).catch(() => undefined);

    await Filesystem.writeFile({
      path: STORE_FILE_PATH,
      directory: Directory.Data,
      data: JSON.stringify(this.state),
      encoding: Encoding.UTF8,
      recursive: true,
    });
  }

  private enqueueWrite(mutator: (state: OTAState) => void): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      await this.ensureLoaded();
      mutator(this.state);
      await this.persist();
    });

    return this.writeQueue;
  }

  async getSnapshot(): Promise<OTAStoreSnapshot> {
    await this.ensureLoaded();
    return { ...this.state };
  }

  async setActive(version: string, path: string): Promise<void> {
    return this.enqueueWrite((state) => {
      state.activeVersion = version;
      state.activePath = path;
      state.downloadedVersions = uniq([...state.downloadedVersions, version]);
      state.lastAppliedAttemptVersion = null;
      if (state.stagedVersion === version) {
        state.stagedVersion = null;
        state.stagedPath = null;
        state.pendingApply = false;
      }
    });
  }

  async stage(version: string, path: string): Promise<void> {
    return this.enqueueWrite((state) => {
      state.stagedVersion = version;
      state.stagedPath = path;
      state.pendingApply = true;
      state.downloadedVersions = uniq([...state.downloadedVersions, version]);
    });
  }

  async clearStaged(): Promise<void> {
    return this.enqueueWrite((state) => {
      state.stagedVersion = null;
      state.stagedPath = null;
      state.pendingApply = false;
      state.lastAppliedAttemptVersion = null;
    });
  }

  async markApplyAttempt(version: string): Promise<void> {
    return this.enqueueWrite((state) => {
      state.lastAppliedAttemptVersion = version;
    });
  }

  async markFailed(version: string): Promise<void> {
    return this.enqueueWrite((state) => {
      state.failedVersions = uniq([...state.failedVersions, version]);
      if (state.stagedVersion === version) {
        state.stagedVersion = null;
        state.stagedPath = null;
        state.pendingApply = false;
      }
      state.lastAppliedAttemptVersion = null;
    });
  }

  async clearFailed(version: string): Promise<void> {
    return this.enqueueWrite((state) => {
      state.failedVersions = state.failedVersions.filter((value) => value !== version);
    });
  }

  async setLastManifestVersion(version: string | null): Promise<void> {
    return this.enqueueWrite((state) => {
      state.lastManifestVersion = version;
    });
  }

  async isFailed(version: string): Promise<boolean> {
    const state = await this.getSnapshot();
    return state.failedVersions.includes(version);
  }

  async hasDownloaded(version: string): Promise<boolean> {
    const state = await this.getSnapshot();
    return state.downloadedVersions.includes(version);
  }
}
