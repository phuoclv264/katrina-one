'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'nextjs-toploader/app';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/pro-toast';
import { Archive, RefreshCw, Loader2, CheckCircle2, XCircle, Trash2, Copy, Play } from 'lucide-react';
import { VersionStore, type OTAStoreSnapshot } from '@/lib/versionStore';
import { BundleManager } from '@/lib/bundleManager';
import { getOTAUpdater } from '@/lib/otaUpdater';

export default function OTADiagnosticsPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [snapshot, setSnapshot] = useState<OTAStoreSnapshot | null>(null);
    const [isBusy, setIsBusy] = useState(false);

    const versionStore = new VersionStore();
    const bundleManager = new BundleManager();

    useEffect(() => {
        if (!loading && user?.role !== 'Chủ nhà hàng') {
            router.replace('/');
        }
    }, [user, loading, router]);

    const loadSnapshot = async () => {
        try {
            toast.loading('Loading OTA snapshot...', { id: 'loading-snapshot' });
            const snap = await versionStore.getSnapshot();
            setSnapshot(snap);
        } catch (err) {
            console.error('Failed to load OTA snapshot', err);
            toast.error('Không thể tải trạng thái OTA');
        }
    };

    useEffect(() => {
        void loadSnapshot();
    }, []);

    const handleRefresh = async () => {
        await loadSnapshot();
        toast.success('OTA snapshot refreshed');
    };

    const handleValidateStaged = async () => {
        if (!snapshot?.stagedPath) return toast.error('No staged bundle to validate');
        setIsBusy(true);
        try {
            const valid = await bundleManager.validateBundleStructure(snapshot.stagedPath);
            toast[valid ? 'success' : 'error'](valid ? 'Staged bundle is valid' : 'Staged bundle is INVALID');
            await loadSnapshot();
        } catch (err: any) {
            console.error('Validate staged failed', err);
            toast.error(String(err?.message ?? err ?? 'Validation failed'));
        } finally {
            setIsBusy(false);
        }
    };

    const handleApplyStaged = async () => {
        if (!snapshot?.stagedVersion) return toast.error('No staged version to apply');
        setIsBusy(true);
        try {
            await getOTAUpdater().applyStagedUpdate('launch');
            // applyStagedUpdate will reload on success; still refresh snapshot if it returns
            await loadSnapshot();
        } catch (err: any) {
            console.error('Apply staged failed', err);
            toast.error(String(err?.message ?? err ?? 'Apply failed'));
        } finally {
            setIsBusy(false);
        }
    };

    const handleClearStaged = async () => {
        setIsBusy(true);
        try {
            await versionStore.clearStaged();
            await loadSnapshot();
            toast.success('Cleared staged OTA bundle');
        } catch (err) {
            console.error('Clear staged failed', err);
            toast.error('Could not clear staged bundle');
        } finally {
            setIsBusy(false);
        }
    };

    const handleClearFailedVersion = async (v: string) => {
        setIsBusy(true);
        try {
            await versionStore.clearFailed(v);
            await loadSnapshot();
            toast.success(`Cleared failed version ${v}`);
        } catch (err) {
            console.error('Clear failed version', err);
            toast.error('Could not clear failed version');
        } finally {
            setIsBusy(false);
        }
    };

    const handleClearAllFailed = async () => {
        if (!snapshot?.failedVersions?.length) return toast.info('No failed versions');
        setIsBusy(true);
        try {
            await Promise.all(snapshot.failedVersions.map((v) => versionStore.clearFailed(v)));
            await loadSnapshot();
            toast.success('Cleared all failed versions');
        } catch (err) {
            console.error('Clear all failed', err);
            toast.error('Could not clear failed versions');
        } finally {
            setIsBusy(false);
        }
    };

    const copyToClipboard = async (text?: string | null) => {
        if (!text) return toast.error('No value to copy');
        try {
            await navigator.clipboard.writeText(text);
            toast.success('Copied to clipboard');
        } catch (err) {
            console.error('Copy failed', err);
            toast.error('Copy failed');
        }
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 pb-24 md:pb-8">
            <header className="mb-8 md:flex md:items-end md:justify-between space-y-4 md:space-y-0">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-primary mb-1">
                        <Archive className="h-5 w-5" />
                        <span className="text-sm font-semibold uppercase tracking-wider">Diagnostics</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight">OTA Diagnostics</h1>
                    <p className="text-muted-foreground">View staged/downloaded/failed OTA bundles and perform safe actions (admin only).</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleRefresh} disabled={isBusy}>
                        <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                    </Button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Version Store</CardTitle>
                        <CardDescription>Persistent OTA state (active, staged, failed)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-4">
                                <div className="text-sm text-muted-foreground">Active Version</div>
                                <div className="font-medium">{snapshot?.activeVersion ?? '—'}</div>
                            </div>

                            <div className="flex items-center justify-between gap-4">
                                <div className="text-sm text-muted-foreground">Active Path</div>
                                <div className="font-mono text-xs text-muted-foreground/80 truncate max-w-[60%]">{snapshot?.activePath ?? '—'}</div>
                            </div>

                            <div className="flex items-center justify-between gap-4">
                                <div className="text-sm text-muted-foreground">Staged Version</div>
                                <div className="flex items-center gap-2">
                                    <div className="font-medium">{snapshot?.stagedVersion ?? '—'}</div>
                                    {snapshot?.stagedPath && (
                                        <Button size="icon" variant="ghost" onClick={() => copyToClipboard(snapshot.stagedPath)}>
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-4">
                                <div className="text-sm text-muted-foreground">Staged Path</div>
                                <div className="font-mono text-xs text-muted-foreground/80 truncate max-w-[60%]">{snapshot?.stagedPath ?? '—'}</div>
                            </div>

                            <div className="flex items-center justify-between gap-4">
                                <div className="text-sm text-muted-foreground">Pending Apply</div>
                                <Badge variant="secondary">{snapshot?.pendingApply ? 'yes' : 'no'}</Badge>
                            </div>

                            <div className="flex items-center justify-between gap-4">
                                <div className="text-sm text-muted-foreground">Last Manifest Version</div>
                                <div className="font-medium">{snapshot?.lastManifestVersion ?? '—'}</div>
                            </div>

                            <div className="flex items-center justify-between gap-4">
                                <div className="text-sm text-muted-foreground">Last Apply Attempt</div>
                                <div className="font-medium">{snapshot?.lastAppliedAttemptVersion ?? '—'}</div>
                            </div>

                            <Separator />

                            <div className="flex gap-2">
                                <Button onClick={handleValidateStaged} disabled={!snapshot?.stagedPath || isBusy}>
                                    {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Validate staged
                                </Button>
                                <Button onClick={handleApplyStaged} disabled={!snapshot?.stagedVersion || isBusy}>
                                    <Play className="mr-2 h-4 w-4" /> Apply staged
                                </Button>
                                <Button variant="destructive" onClick={handleClearStaged} disabled={!snapshot?.stagedVersion || isBusy}>
                                    <Trash2 className="mr-2 h-4 w-4" /> Clear staged
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Downloaded & Failed</CardTitle>
                        <CardDescription>Downloaded bundles and blacklisted (failed) versions</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div>
                                <div className="text-sm text-muted-foreground mb-2">Downloaded Versions</div>
                                <div className="flex flex-wrap gap-2">
                                    {(snapshot?.downloadedVersions ?? []).length === 0 && <div className="text-xs text-muted-foreground">— none</div>}
                                    {(snapshot?.downloadedVersions ?? []).map((v) => (
                                        <Badge key={v} className="px-3 py-1" variant="secondary">{v}</Badge>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-sm text-muted-foreground">Failed (blacklisted) versions</div>
                                    <div className="text-xs text-muted-foreground">{(snapshot?.failedVersions ?? []).length} total</div>
                                </div>

                                <div className="space-y-2">
                                    {(snapshot?.failedVersions ?? []).length === 0 && (
                                        <div className="text-xs text-muted-foreground">— none</div>
                                    )}

                                    {(snapshot?.failedVersions ?? []).map((v) => (
                                        <div key={v} className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-3">
                                                <Badge variant="destructive">{v}</Badge>
                                                <div className="text-xs text-muted-foreground">(blacklisted)</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button size="sm" variant="ghost" onClick={() => handleClearFailedVersion(v)} disabled={isBusy}>
                                                    Clear
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {snapshot?.failedVersions?.length ? (
                                    <div className="mt-3">
                                        <Button variant="outline" size="sm" onClick={handleClearAllFailed} disabled={isBusy}>
                                            Clear all failed
                                        </Button>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="mt-8 text-sm text-muted-foreground">
                <p>Tip: staged bundles are applied automatically on app restart or when you tap <strong>Apply staged</strong>. Failed versions are blacklisted and skipped by the updater.</p>
            </div>
        </div>
    );
}
