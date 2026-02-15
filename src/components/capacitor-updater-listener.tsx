'use client';

import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater, BundleInfo } from '@capgo/capacitor-updater';
import { toast } from '@/components/ui/pro-toast';

type ManifestPayload = {
  version: string;
  url: string;
  checksum?: string;
  sessionKey?: string;
};

const manifestUrl = process.env.NEXT_PUBLIC_UPDATER_MANIFEST_URL;
const CHECK_INTERVAL_MS = Number(process.env.NEXT_PUBLIC_UPDATER_CHECK_INTERVAL_MS ?? 6 * 60 * 60 * 1000); // default: 6 hours
const ALLOW_SILENT_UPDATE = (process.env.NEXT_PUBLIC_UPDATER_SILENT ?? 'true') === 'true';

export function CapacitorUpdaterListener() {
  const isUpdatingRef = useRef(false);
  const hasShownSetupToastRef = useRef(false);

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
      const response = await fetch(manifestUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Manifest request failed: ${response.status}`);
      }
      const data = await response.json();
      if (!data?.version || !data?.url) return null;
      return data as ManifestPayload;
    };

    const checkForUpdates = async () => {
      if (isUpdatingRef.current) return;
      isUpdatingRef.current = true;

      try {
        const manifest = await fetchManifest();

        // one-time diagnostic toast to show whether updater is configured correctly
        if (!hasShownSetupToastRef.current) {
          if (!manifest) {
            toast.error('Capacitor Updater: manifest không hợp lệ hoặc không tìm thấy.');
            hasShownSetupToastRef.current = true;
            // do not proceed with update logic on missing manifest
            return;
          }

          toast.success(`Capacitor Updater: manifest truy cập được — v${manifest.version}`);
          hasShownSetupToastRef.current = true;
        }

        if (!manifest) return;

        const current = await CapacitorUpdater.current();
        const currentVersion = current.bundle?.version ?? 'builtin';

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

        if (ALLOW_SILENT_UPDATE) {
          toast.success('Cập nhật sẵn sàng — đang khởi động lại...', { id: toastId });
          await CapacitorUpdater.reload();
        } else {
          // pro-toast supports `message` + `onPress` (tap anywhere to act)
          toast.success('Cập nhật đã tải xong. Khởi động lại để áp dụng.', {
            id: toastId,
            message: 'Nhấn để khởi động lại',
            onPress: async () => await CapacitorUpdater.reload(),
          });
        }
      } catch (err) {
        // show one-time diagnostic error toast if auth/network prevents manifest fetch
        if (!hasShownSetupToastRef.current) {
          toast.error('Capacitor Updater: không thể truy cập manifest / cấu hình.');
          hasShownSetupToastRef.current = true;
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

    let resumeListener: Awaited<ReturnType<typeof App.addListener>> | undefined;
    App.addListener('resume', checkForUpdates).then((listener) => {
      resumeListener = listener;
    });

    return () => {
      clearInterval(intervalId);
      resumeListener?.remove();
    };
  }, []);

  return null;
}