'use client';

import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater, BundleInfo } from '@capgo/capacitor-updater';
import { toast } from '@/components/ui/pro-toast';
import {
  storageKeys,
  getStorageNumber,
  getStorageString,
  setStorageValue,
  removeStorageValue,
  clearFailureState,
  parseManifestPayload,
  type ManifestPayload,
} from '@/lib/capacitor-updater-status';

const manifestUrl = process.env.NEXT_PUBLIC_UPDATER_MANIFEST_URL;
const CHECK_INTERVAL_MS = Number(process.env.NEXT_PUBLIC_UPDATER_CHECK_INTERVAL_MS ?? 6 * 60 * 60 * 1000); // default: 6 hours
const ALLOW_SILENT_UPDATE = (process.env.NEXT_PUBLIC_UPDATER_SILENT ?? 'true') === 'true';
const MANIFEST_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_UPDATER_MANIFEST_TIMEOUT_MS ?? 15000);
const MAX_APPLY_FAILURES = Number(process.env.NEXT_PUBLIC_UPDATER_MAX_FAILURES ?? 3);
const APPLY_DISABLE_MS = Number(process.env.NEXT_PUBLIC_UPDATER_DISABLE_MS ?? 6 * 60 * 60 * 1000); // default: 6 hours

// Safety keys to prevent restart loops
const RELOAD_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes
const LAST_RELOAD_KEY = storageKeys.lastReload;
const PENDING_VERSION_KEY = storageKeys.pendingVersion;
const APPLY_FAILURE_COUNT_KEY = storageKeys.applyFailureCount;
const AUTO_DISABLE_UNTIL_KEY = storageKeys.autoDisableUntil;

export function CapacitorUpdaterListener() {
  const isUpdatingRef = useRef(false);
  const hasShownManifestErrorToastRef = useRef(false);
  const hasShownDisabledToastRef = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (!manifestUrl) {
      console.warn('CapacitorUpdater: manifest URL is not set');
      return;
    }

    const notifyReady = async () => {
      try {
        await CapacitorUpdater.notifyAppReady();
      } catch (err) {
        console.warn('CapacitorUpdater notifyAppReady failed', err);
      }
    };

    const fetchManifest = async (): Promise<ManifestPayload | null> => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), MANIFEST_TIMEOUT_MS);

      try {
        const response = await fetch(manifestUrl, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Manifest request failed: ${response.status}`);
        }

        const data = await response.json();
        return parseManifestPayload(data);
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const markApplyFailure = () => {
      const currentFailures = getStorageNumber(APPLY_FAILURE_COUNT_KEY);
      const nextFailures = currentFailures + 1;
      setStorageValue(APPLY_FAILURE_COUNT_KEY, String(nextFailures));

      if (nextFailures >= MAX_APPLY_FAILURES) {
        const disabledUntil = Date.now() + APPLY_DISABLE_MS;
        setStorageValue(AUTO_DISABLE_UNTIL_KEY, String(disabledUntil));
        if (!hasShownDisabledToastRef.current) {
          toast.error('Tạm dừng tự động cập nhật do nhiều lần áp dụng thất bại.');
          hasShownDisabledToastRef.current = true;
        }
      }
    };

    const checkForUpdates = async () => {
      if (isUpdatingRef.current) return;
      isUpdatingRef.current = true;

      try {
        const disabledUntil = getStorageNumber(AUTO_DISABLE_UNTIL_KEY);
        if (disabledUntil > Date.now()) {
          if (!hasShownDisabledToastRef.current) {
            toast.error('Tự động cập nhật đang tạm dừng để đảm bảo ổn định ứng dụng.');
            hasShownDisabledToastRef.current = true;
          }
          return;
        }

        if (disabledUntil > 0 && disabledUntil <= Date.now()) {
          removeStorageValue(AUTO_DISABLE_UNTIL_KEY);
          removeStorageValue(APPLY_FAILURE_COUNT_KEY);
          hasShownDisabledToastRef.current = false;
        }

        const manifest = await fetchManifest();

        if (!manifest) {
          if (!hasShownManifestErrorToastRef.current) {
            toast.error('Cấu hình cập nhật không hợp lệ. Vui lòng kiểm tra manifest.');
            hasShownManifestErrorToastRef.current = true;
          }
          return;
        }

        hasShownManifestErrorToastRef.current = false;

        const current = await CapacitorUpdater.current();
        const currentVersion = current.bundle?.version ?? 'builtin';

        const lastReload = getStorageNumber(LAST_RELOAD_KEY);
        const reloadedRecently = Date.now() - lastReload < RELOAD_COOLDOWN_MS;
        const pendingVersion = getStorageString(PENDING_VERSION_KEY);

        if (pendingVersion && currentVersion === pendingVersion) {
          clearFailureState();
          removeStorageValue(LAST_RELOAD_KEY);
        }

        if (pendingVersion && reloadedRecently && currentVersion !== pendingVersion) {
          markApplyFailure();
          removeStorageValue(PENDING_VERSION_KEY);
          return;
        }

        if (manifest.version === currentVersion) return;

        const toastId = toast.loading('Đang tải bản cập nhật...');
        let downloaded: BundleInfo | null = null;

        try {
          downloaded = await CapacitorUpdater.download({
            url: manifest.url,
            version: manifest.version,
            checksum: manifest.checksum,
            sessionKey: manifest.sessionKey,
          });
        } catch (err) {
          toast.error('Tải cập nhật thất bại', { id: toastId });
          throw err;
        }

        if (!downloaded) {
          toast.dismiss(toastId);
          return;
        }

        await CapacitorUpdater.next({ id: downloaded.id });
        removeStorageValue(APPLY_FAILURE_COUNT_KEY);

        if (ALLOW_SILENT_UPDATE) {
          toast.success('Cập nhật sẵn sàng — đang khởi động lại...', { id: toastId });
          setStorageValue(PENDING_VERSION_KEY, manifest.version);
          setStorageValue(LAST_RELOAD_KEY, String(Date.now()));
          await CapacitorUpdater.reload();
        } else {
          toast.success('Cập nhật đã tải xong. Khởi động lại để áp dụng.', {
            id: toastId,
            message: 'Nhấn để khởi động lại',
            onPress: async () => {
              setStorageValue(PENDING_VERSION_KEY, manifest.version);
              setStorageValue(LAST_RELOAD_KEY, String(Date.now()));
              await CapacitorUpdater.reload();
            },
          });
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);

        if (errorMessage.toLowerCase().includes('manifest request failed') || errorMessage.toLowerCase().includes('abort')) {
          if (!hasShownManifestErrorToastRef.current) {
            toast.error('Không thể kiểm tra bản cập nhật lúc này. Vui lòng thử lại sau.', { duration: 8000 });
            hasShownManifestErrorToastRef.current = true;
          }
        } else {
          markApplyFailure();
        }

        console.warn('CapacitorUpdater update check failed', err);
      } finally {
        isUpdatingRef.current = false;
      }
    };

    // startup + periodic checks
    notifyReady().catch(() => {});
    checkForUpdates();

    const intervalId = window.setInterval(() => checkForUpdates().catch(() => {}), CHECK_INTERVAL_MS);

    let isDisposed = false;
    let resumeListener: Awaited<ReturnType<typeof App.addListener>> | undefined;
    App.addListener('resume', () => {
      checkForUpdates().catch(() => {});
    }).then((listener) => {
      if (isDisposed) {
        listener.remove();
        return;
      }
      resumeListener = listener;
    });

    return () => {
      isDisposed = true;
      clearInterval(intervalId);
      resumeListener?.remove();
    };
  }, []);

  return null;
}