'use client';

import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater, BundleInfo } from '@capgo/capacitor-updater';

type ManifestPayload = {
  version: string;
  url: string;
  checksum?: string;
  sessionKey?: string;
};

const manifestUrl = process.env.NEXT_PUBLIC_UPDATER_MANIFEST_URL;

export function CapacitorUpdaterListener() {
  const isUpdatingRef = useRef(false);

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
        if (!manifest) return;

        const current = await CapacitorUpdater.current();
        const currentVersion = current.bundle?.version ?? 'builtin';

        if (manifest.version === currentVersion) return;

        const downloaded: BundleInfo = await CapacitorUpdater.download({
          url: manifest.url,
          version: manifest.version,
          checksum: manifest.checksum,
          sessionKey: manifest.sessionKey,
        });

        await CapacitorUpdater.next({ id: downloaded.id });
        await CapacitorUpdater.reload();
      } catch (err) {
        console.warn('CapacitorUpdater update check failed', err);
      } finally {
        isUpdatingRef.current = false;
      }
    };

    notifyReady().catch(() => {});
    checkForUpdates();

    let resumeListener: Awaited<ReturnType<typeof App.addListener>> | undefined;
    App.addListener('resume', checkForUpdates).then((listener) => {
      resumeListener = listener;
    });

    return () => {
      resumeListener?.remove();
    };
  }, []);

  return null;
}