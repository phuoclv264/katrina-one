'use client';

import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater, type BundleInfo } from '@capgo/capacitor-updater';
import { ManifestPayload, parseManifestPayload } from '@/lib/capacitor-updater-status';

const manifestUrl = process.env.NEXT_PUBLIC_UPDATER_MANIFEST_URL;
const CHECK_INTERVAL_MS = Number(process.env.NEXT_PUBLIC_UPDATER_CHECK_INTERVAL_MS ?? 6 * 60 * 60 * 1000);
const MANIFEST_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_UPDATER_MANIFEST_TIMEOUT_MS ?? 15000);

// When the JavaScript bundle is loaded (which may occur while the app is
// backgrounded), we need to notify the native updater plugin as soon as
// possible.  Relying purely on a React effect means the notification can be
// delayed until hydration, or skipped entirely if the webview is suspended
// before React runs.  A top‑level call guarantees the plugin sees the
// notification immediately.
if (typeof window !== 'undefined' &&
    Capacitor.isNativePlatform() &&
    CapacitorUpdater?.notifyAppReady) {
    console.log('CapacitorUpdater: early module init notifyAppReady');
    CapacitorUpdater.notifyAppReady().catch(err => {
        console.warn('CapacitorUpdater early notifyAppReady failed', err);
    });
}

export function CapacitorUpdaterListener() {
    const isUpdatingRef = useRef(false);
    const hasLoggedManifestErrorRef = useRef(false);
    const promptedVersionRef = useRef<string | null>(null);
    const pendingVersionRef = useRef<BundleInfo | null>(null);

    useEffect(() => {
            // make sure we're running inside the native web‑view; if not there is
        // nothing for the plugin to do.  this also prevents logs from flooding
        // the desktop browser during development.
        if (!Capacitor.isNativePlatform()) {
            console.log('CapacitorUpdater: not running on native platform — listener disabled');
            return;
        }

        // provide some early diagnostics for debugging. developers will often
        // look at Android/iOS logcat and not realise that the console messages
        // live in the webview context, so we print the plugin object as well.
        console.log('CapacitorUpdater: plugin object', CapacitorUpdater);

        if (!manifestUrl) {
            console.log('CapacitorUpdater: manifest URL is not set — aborting updater listener');
            console.warn('CapacitorUpdater: manifest URL is not set');
            return;
        }

        const fetchManifest = async (): Promise<ManifestPayload | null> => {
            const controller = new AbortController();
            const timeoutId = window.setTimeout(() => controller.abort(), MANIFEST_TIMEOUT_MS);

            try {
                console.log('CapacitorUpdater: fetching manifest from', manifestUrl);
                const response = await fetch(manifestUrl, { cache: 'no-store', signal: controller.signal });
                if (!response.ok) {
                    throw new Error(`Manifest request failed: ${response.status}`);
                }

                const data = await response.json();
                const parsed = parseManifestPayload(data);
                console.log('CapacitorUpdater: manifest fetched', parsed);
                return parsed;
            } finally {
                clearTimeout(timeoutId);
            }
        };

        const checkForUpdates = async () => {
            if (isUpdatingRef.current) {
                console.log('CapacitorUpdater: update check already in progress — skipping');
                return;
            }
            isUpdatingRef.current = true;
            console.log('CapacitorUpdater: checkForUpdates started');

            try {
                // plugin handles retries/rollbacks — always attempt to fetch manifest
                const manifest = await fetchManifest();

                if (!manifest) {
                    console.log('CapacitorUpdater: fetched manifest is invalid or malformed');
                    if (!hasLoggedManifestErrorRef.current) {
                        console.warn('CapacitorUpdater: manifest payload is invalid');
                        hasLoggedManifestErrorRef.current = true;
                    }
                    return;
                }

                hasLoggedManifestErrorRef.current = false;

                const current = await CapacitorUpdater.current();
                console.log('CapacitorUpdater: current bundle version=', current.bundle?.version, 'manifest version=', manifest.version, 'manifest payload=', JSON.stringify(manifest), 'current bundle info=', JSON.stringify(current.bundle));

                // check currently active plugin bundle version
                if (manifest.version === current.bundle?.version) {
                    console.log('CapacitorUpdater: versions match — no update needed');
                    return;
                }

                if (promptedVersionRef.current === manifest.version) {
                    console.log('CapacitorUpdater: already prompted for version', manifest.version);
                    return;
                }
                promptedVersionRef.current = manifest.version;

                console.log('CapacitorUpdater: starting download for version', manifest.version, manifest.url);
                const version = await CapacitorUpdater.download({
                    url: manifest.url,
                    version: manifest.version
                });
                console.log('CapacitorUpdater: download() returned', version);

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
                // include manifest URL + target version (if set) and full error object to aid native/plugin debugging
                console.log('CapacitorUpdater: checkForUpdates error:', errorMessage, { manifestUrl, targetVersion: promptedVersionRef.current, err });

                // give an explicit hint when the native/plugin download fails
                if (errorMessage.toLowerCase().includes('failed to download') || errorMessage.toLowerCase().includes('download failed')) {
                    console.warn('CapacitorUpdater: download failed — verify manifest.url is reachable, server TLS/config, checksum, and plugin responseTimeout.');
                }

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
            if (!pending) {
                console.log('CapacitorUpdater: no staged update to apply');
                return;
            }
            console.log('CapacitorUpdater: applyPendingVersion invoked for', pending);

            // Only apply when app is not visible (background / paused).
            if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
                console.info('CapacitorUpdater: deferring apply until backgrounded', pending);
                console.log('CapacitorUpdater: document.visibilityState is visible — deferring apply');
                return;
            }

            try {
                console.info('CapacitorUpdater: applying staged update', JSON.stringify(pending));
                console.log('CapacitorUpdater: calling CapacitorUpdater.set(...)');
                await CapacitorUpdater.set(pending);
                pendingVersionRef.current = null;
                console.info('CapacitorUpdater: staged update applied');
                console.log('CapacitorUpdater: applyPendingVersion completed successfully');
            } catch (err) {
                console.warn('CapacitorUpdater: failed to apply staged update', err);
                console.log('CapacitorUpdater: applyPendingVersion error', err);
            }
        };

        const manualEventName = 'cap-updater-check';
        const manualCheckHandler = () => {
            console.log('CapacitorUpdater: manual check event received');
            checkForUpdates().catch(() => { });
        };

        // the native side requires an explicit "ready" notification before
        // it will talk to the webview plugin.  previously this was being called
        // from the layout component on the server, which never executed on the
        // device.  move the call inside the client effect so it actually runs
        // and you start seeing logs.
        const notifyReady = async () => {
            try {
                console.log('CapacitorUpdater: notifyAppReady() — notifying native plugin that app is ready');
                await CapacitorUpdater.notifyAppReady();
                console.log('CapacitorUpdater: notifyAppReady() succeeded');
            } catch (err) {
                console.warn('CapacitorUpdater notifyAppReady failed', err);
                console.log('CapacitorUpdater: notifyAppReady() error', err);
            }
        };
        notifyReady().catch(() => {});

        console.log('CapacitorUpdater: running initial update check');
        checkForUpdates();

        const intervalId = window.setInterval(() => checkForUpdates().catch(() => { }), CHECK_INTERVAL_MS);
        console.log('CapacitorUpdater: scheduled periodic checks every', CHECK_INTERVAL_MS, 'ms');
        window.addEventListener(manualEventName, manualCheckHandler);

        // apply staged update when the app is backgrounded or paused
        const visibilityHandler = () => {
            console.log('CapacitorUpdater: visibilitychange', document.visibilityState);
            // do not apply while hidden; we prefer to wait until resume so that
            // the JS environment is guaranteed to run and call notifyAppReady.
            if (document.visibilityState === 'hidden') {
                console.log('CapacitorUpdater: document hidden — deferring apply until resume');
            }
        };
        window.addEventListener('visibilitychange', visibilityHandler);

        let isDisposed = false;
        let resumeListener: Awaited<ReturnType<typeof App.addListener>> | undefined;
        let pauseListener: Awaited<ReturnType<typeof App.addListener>> | undefined;

        App.addListener('resume', () => {
            console.log('CapacitorUpdater: App resume event received');
            // on resume make sure the plugin knows we're ready again; this
            // covers the case where a bundle was applied while we were
            // backgrounded and the early module call may have been skipped.
            notifyReady().catch(() => {});

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
            console.log('CapacitorUpdater: App pause event received — applying staged update if any');
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
            console.log('CapacitorUpdater: disposing listeners and timers');
            window.removeEventListener(manualEventName, manualCheckHandler);
            window.removeEventListener('visibilitychange', visibilityHandler);
            clearInterval(intervalId);
            resumeListener?.remove();
            pauseListener?.remove();
        };
    }, []);

    return null;
}