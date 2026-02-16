'use client';

import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater, type BundleInfo } from '@capgo/capacitor-updater';
import { ManifestPayload, parseManifestPayload } from '@/lib/capacitor-updater-status';

const manifestUrl = process.env.NEXT_PUBLIC_UPDATER_MANIFEST_URL;
const CHECK_INTERVAL_MS = Number(process.env.NEXT_PUBLIC_UPDATER_CHECK_INTERVAL_MS ?? 6 * 60 * 60 * 1000);
const MANIFEST_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_UPDATER_MANIFEST_TIMEOUT_MS ?? 15000);

export function CapacitorUpdaterListener() {
    const isUpdatingRef = useRef(false);
    const hasLoggedManifestErrorRef = useRef(false);
    const promptedVersionRef = useRef<string | null>(null);
    const pendingVersionRef = useRef<BundleInfo | null>(null);

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

        const checkForUpdates = async () => {
            if (isUpdatingRef.current) return;
            isUpdatingRef.current = true;

            try {
                // plugin handles retries/rollbacks — always attempt to fetch manifest
                const manifest = await fetchManifest();

                if (!manifest) {
                    if (!hasLoggedManifestErrorRef.current) {
                        console.warn('CapacitorUpdater: manifest payload is invalid');
                        hasLoggedManifestErrorRef.current = true;
                    }
                    return;
                }

                hasLoggedManifestErrorRef.current = false;

                const current = await CapacitorUpdater.current();

                // check currently active plugin bundle version
                if (manifest.version === current.bundle?.version) return;

                if (promptedVersionRef.current === manifest.version) return;
                promptedVersionRef.current = manifest.version;

                const version = await CapacitorUpdater.download({
                    url: manifest.url,
                    version: manifest.version,
                    checksum: manifest.checksum,
                    sessionKey: manifest.sessionKey,
                });

                if (!version) {
                    throw new Error('CapacitorUpdater download returned empty version');
                }

                // Stage the downloaded bundle but DO NOT apply it while the app is active.
                // Applying here can cause Android WebViewLocalServer to switch to the
                // pending bundle immediately and fail to find `public/index.html`.
                // Defer calling `set()` until the app is backgrounded/paused or hidden.
                pendingVersionRef.current = version;
                console.info('CapacitorUpdater: download complete — staging update for background apply', version);
            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : String(err);

                if (errorMessage.toLowerCase().includes('manifest request failed') || errorMessage.toLowerCase().includes('abort')) {
                    if (!hasLoggedManifestErrorRef.current) {
                        console.warn('CapacitorUpdater: manifest request failed');
                        hasLoggedManifestErrorRef.current = true;
                    }
                } else {
                    console.warn('CapacitorUpdater update check failed', err);
                }
            } finally {
                isUpdatingRef.current = false;
            }
        };

        const applyPendingVersion = async () => {
            const pending = pendingVersionRef.current;
            if (!pending) return;

            // Only apply when app is not visible (background / paused).
            if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
                console.info('CapacitorUpdater: deferring apply until backgrounded', pending);
                return;
            }

            try {
                console.info('CapacitorUpdater: applying staged update', pending);
                await CapacitorUpdater.set(pending);
                pendingVersionRef.current = null;
                console.info('CapacitorUpdater: staged update applied');
            } catch (err) {
                console.warn('CapacitorUpdater: failed to apply staged update', err);
            }
        };

        const manualEventName = 'cap-updater-check';
        const manualCheckHandler = () => {
            checkForUpdates().catch(() => { });
        };

        notifyReady().catch(() => { });
        checkForUpdates();

        const intervalId = window.setInterval(() => checkForUpdates().catch(() => { }), CHECK_INTERVAL_MS);
        window.addEventListener(manualEventName, manualCheckHandler);

        // apply staged update when the app is backgrounded or paused
        const visibilityHandler = () => {
            if (document.visibilityState === 'hidden') {
                applyPendingVersion().catch(() => { });
            }
        };
        window.addEventListener('visibilitychange', visibilityHandler);

        let isDisposed = false;
        let resumeListener: Awaited<ReturnType<typeof App.addListener>> | undefined;
        let pauseListener: Awaited<ReturnType<typeof App.addListener>> | undefined;

        App.addListener('resume', () => {
            // refresh checks on resume and attempt to apply any staged update
            checkForUpdates().catch(() => { });
            applyPendingVersion().catch(() => { });
        }).then((listener) => {
            if (isDisposed) {
                listener.remove();
                return;
            }
            resumeListener = listener;
        });

        App.addListener('pause', () => {
            // apply staged update when the app is paused (Android lifecycle)
            applyPendingVersion().catch(() => { });
        }).then((listener) => {
            if (isDisposed) {
                listener.remove();
                return;
            }
            pauseListener = listener;
        });

        return () => {
            isDisposed = true;
            window.removeEventListener(manualEventName, manualCheckHandler);
            window.removeEventListener('visibilitychange', visibilityHandler);
            clearInterval(intervalId);
            resumeListener?.remove();
            pauseListener?.remove();
        };
    }, []);

    return null;
}