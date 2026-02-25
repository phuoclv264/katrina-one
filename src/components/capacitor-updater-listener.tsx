'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
    CapacitorUpdater.notifyAppReady().catch(() => { /* best-effort early notify */ });
}

export function CapacitorUpdaterListener() {
    const isUpdatingRef = useRef(false);
    const hasLoggedManifestErrorRef = useRef(false);
    const promptedVersionRef = useRef<string | null>(null);

    type UpdatePhase = 'idle' | 'checking' | 'downloading' | 'applying' | 'reloading' | 'error';
    const [phase, setPhase] = useState<UpdatePhase>('idle');
    const [statusText, setStatusText] = useState('');
    const [progress, setProgress] = useState<number | null>(null);
    const [errorText, setErrorText] = useState<string | null>(null);

    const notifyReady = useCallback(async () => {
        try {
            await CapacitorUpdater.notifyAppReady();
        } catch {
            /* ignore */
        }
    }, [manifestUrl]);

    const checkForUpdates = useCallback(async () => {
        if (typeof window === 'undefined') {
            return;
        }

        if (!Capacitor.isNativePlatform()) {
            return;
        }

        if (!manifestUrl) {
            return;
        }

        if (isUpdatingRef.current) {
            return;
        }
        isUpdatingRef.current = true;

        const fetchManifest = async (): Promise<ManifestPayload | null> => {
            const controller = new AbortController();
            const timeoutId = window.setTimeout(() => controller.abort(), MANIFEST_TIMEOUT_MS);

            try {
                const response = await fetch(manifestUrl, { cache: 'no-store', signal: controller.signal });
                if (!response.ok) {
                    throw new Error(`Manifest request failed: ${response.status}`);
                }

                const data = await response.json();
                const parsed = parseManifestPayload(data);
                return parsed;
            } finally {
                clearTimeout(timeoutId);
            }
        };

        try {
            const manifest = await fetchManifest();

            if (!manifest) {
                if (!hasLoggedManifestErrorRef.current) {
                    hasLoggedManifestErrorRef.current = true;
                }
                setPhase('idle');
                setStatusText('');
                setProgress(null);
                setErrorText(null);
                return;
            }

            hasLoggedManifestErrorRef.current = false;

            const current = await CapacitorUpdater.current();
            if (manifest.version === current.bundle?.version) {
                setPhase('idle');
                setStatusText('');
                setProgress(null);
                setErrorText(null);
                return;
            }

            if (promptedVersionRef.current === manifest.version) {
                setPhase('idle');
                setStatusText('');
                setProgress(null);
                setErrorText(null);
                return;
            }

            promptedVersionRef.current = manifest.version;

            setPhase('downloading');
            setStatusText('Downloading update...');
            setProgress(30);
            setErrorText(null);

            const version: BundleInfo | null = await CapacitorUpdater.download({
                url: manifest.url,
                version: manifest.version
            });

            if (!version) {
                throw new Error('CapacitorUpdater download returned empty version');
            }

            setPhase('applying');
            setStatusText('Applying update...');
            setProgress(70);
            await CapacitorUpdater.set(version);

            setPhase('reloading');
            setStatusText('Reloading to finish update...');
            setProgress(100);
            try {
                await CapacitorUpdater.reload();
            } catch {
                window.location.reload();
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);

            if (errorMessage.toLowerCase().includes('manifest request failed') || errorMessage.toLowerCase().includes('abort')) {
                if (!hasLoggedManifestErrorRef.current) {
                    hasLoggedManifestErrorRef.current = true;
                }
            }

            setPhase('error');
            setStatusText('Update failed.');
            setErrorText('Could not complete the update. Please retry.');
            setProgress(null);
        } finally {
            isUpdatingRef.current = false;
        }
    }, [manifestUrl]);

    useEffect(() => {
        // ensure we are inside a native webview; otherwise no updater is available
        if (!Capacitor.isNativePlatform()) {
            return;
        }

        if (!manifestUrl) {
            return;
        }

        let isDisposed = false;
        let resumeListener: Awaited<ReturnType<typeof App.addListener>> | undefined;

        const manualEventName = 'cap-updater-check';
        const manualCheckHandler = () => {
            checkForUpdates().catch(() => { });
        };

        notifyReady().catch(() => { });

        checkForUpdates();

        const intervalId = window.setInterval(() => checkForUpdates().catch(() => { }), CHECK_INTERVAL_MS);
        window.addEventListener(manualEventName, manualCheckHandler);

        App.addListener('resume', () => {
            notifyReady().catch(() => { });
            checkForUpdates().catch(() => { });
        }).then((listener) => {
            if (isDisposed) {
                listener.remove();
                return;
            }
            resumeListener = listener;
        });

        return () => {
            isDisposed = true;
            window.removeEventListener(manualEventName, manualCheckHandler);
            clearInterval(intervalId);
            resumeListener?.remove();
        };
    }, [checkForUpdates, notifyReady]);

    if (phase === 'idle') {
        return null;
    }

    const effectiveProgress = progress ?? 100;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-6">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/10 dark:bg-slate-900 dark:text-white">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-base font-semibold">Updating app</p>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{statusText}</p>
                        {errorText ? (
                            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errorText}</p>
                        ) : null}
                    </div>
                </div>

                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" aria-label="Update progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={effectiveProgress}>
                    <div
                        className="h-full bg-blue-600 transition-[width] duration-300 ease-out dark:bg-blue-400"
                        style={{ width: `${effectiveProgress}%` }}
                    />
                </div>

                {phase === 'error' ? (
                    <div className="mt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400"
                            onClick={() => {
                                setPhase('checking');
                                setStatusText('Checking for updates...');
                                setErrorText(null);
                                setProgress(10);
                                checkForUpdates().catch(() => { });
                            }}
                        >
                            Retry update
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}