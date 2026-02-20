'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'nextjs-toploader/app';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/pro-toast';
import { 
    Archive, RefreshCw, Loader2, CheckCircle2, 
    XCircle, Trash2, Copy, Play, AlertTriangle, 
    ShieldCheck, History, Laptop, HardDrive, Info
} from 'lucide-react';
import { VersionStore, type OTAStoreSnapshot } from '@/lib/versionStore';
import { BundleManager } from '@/lib/bundleManager';
import { getOTAUpdater } from '@/lib/otaUpdater';
import { Capacitor, WebView } from '@capacitor/core';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from '@/lib/utils';

export default function OTADiagnosticsPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [snapshot, setSnapshot] = useState<OTAStoreSnapshot | null>(null);
    const [isBusy, setIsBusy] = useState(false);
    const [webviewPath, setWebviewPath] = useState<string | null>(null);
    const [confirmAction, setConfirmAction] = useState<{
        title: string;
        description: string;
        action: () => Promise<void>;
        destructive?: boolean;
    } | null>(null);

    const versionStore = new VersionStore();
    const bundleManager = new BundleManager();

    useEffect(() => {
        if (!loading && user?.role !== 'Chủ nhà hàng') {
            router.replace('/');
        }
    }, [user, loading, router]);

    const loadSnapshot = async () => {
        try {
            const snap = await versionStore.getSnapshot();
            setSnapshot(snap);

            // read runtime WebView base path (native only) so we can detect mismatches
            if (Capacitor.isNativePlatform()) {
                try {
                    const base = await WebView.getServerBasePath();
                    setWebviewPath(base?.path ?? null);
                } catch (err) {
                    setWebviewPath(null);
                }
            } else {
                setWebviewPath(null);
            }
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
        if (!snapshot?.stagedPath) { toast.error('No staged bundle to validate'); return; }
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
        if (!snapshot?.stagedVersion) { toast.error('No staged version to apply'); return; }
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
        if (!snapshot?.failedVersions?.length) { toast.info('No failed versions'); return; }
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

    const handleDeleteVersion = async (v: string) => {
        setIsBusy(true);
        try {
            await bundleManager.deleteBundle(v);
            await versionStore.removeDownloaded(v);
            await loadSnapshot();
            toast.success(`Deleted version ${v} and its bundle`);
        } catch (err) {
            console.error('Delete version failed', err);
            toast.error(`Could not delete version ${v}`);
        } finally {
            setIsBusy(false);
            setConfirmAction(null);
        }
    };

    const handleSwitchVersion = async (version: string) => {
        if (!version) { toast.error('No version selected'); return; }
        if (snapshot?.activeVersion === version) { toast.info('Version already active'); return; }
        if (snapshot?.failedVersions?.includes(version)) { toast.error('Version is blacklisted (failed)'); return; }

        setIsBusy(true);
        try {
            const bundlePath = await bundleManager.getBundlePath(version);

            // quick sanity check
            const isValid = await bundleManager.validateBundleStructure(bundlePath);
            if (!isValid) { toast.error(`Bundle for v${version} is missing or invalid`); return; }

            // Stage + apply so existing apply logic (validation, setActive, WebView persist, reload)
            await versionStore.stage(version, bundlePath);
            await getOTAUpdater().applyStagedUpdate('launch');

            // applyStagedUpdate will reload on success; refresh snapshot if it returns
            await loadSnapshot();
            toast.success(`Switch to v${version} initiated`);
        } catch (err: any) {
            console.error('Switch version failed', err);
            toast.error(String(err?.message ?? err ?? 'Switch failed'));
        } finally {
            setIsBusy(false);
        }
    };

    const handleSyncWebView = async () => {
        if (!snapshot?.activePath) { toast.error('No active path to sync'); return; }
        if (!Capacitor.isNativePlatform()) { toast.error('Sync is native-only'); return; }

        setIsBusy(true);
        try {
            // Use empty string to reset to default assets if sentinel is active
            const targetPath = (snapshot.activePath === 'public' || snapshot.activePath === 'builtin') ? '' : snapshot.activePath;

            // Try applying the target path; fall back to file:// variant if needed (not for empty)
            try {
                await WebView.setServerBasePath({ path: targetPath });
                await WebView.persistServerBasePath();
            } catch (err) {
                if (targetPath) {
                    const alt = targetPath.startsWith('file://') ? targetPath.replace(/^file:\/\//, '') : `file://${targetPath}`;
                    await WebView.setServerBasePath({ path: alt });
                    await WebView.persistServerBasePath();
                } else {
                    throw err;
                }
            }

            const after = await WebView.getServerBasePath();
            setWebviewPath(after?.path ?? null);
            toast.success('WebView base path synced');
        } catch (err) {
            console.error('Sync WebView failed', err);
            toast.error('Could not sync WebView path');
        } finally {
            setIsBusy(false);
            await loadSnapshot();
        }
    };

    const copyToClipboard = async (text?: string | null) => {
        if (!text) { toast.error('No value to copy'); return; }
        try {
            await navigator.clipboard.writeText(text);
            toast.success('Copied to clipboard');
        } catch (err) {
            console.error('Copy failed', err);
            toast.error('Copy failed');
        }
    };

    if (loading) return null;

    return (
        <div className="min-h-screen bg-background/50">
            <div className="container mx-auto p-4 sm:p-6 pb-24 md:pb-8 max-w-7xl">
                <header className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-1"
                    >
                        <div className="flex items-center gap-2 text-primary mb-1">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <Archive className="h-5 w-5" />
                            </div>
                            <span className="text-sm font-bold uppercase tracking-widest">Admin Control</span>
                        </div>
                        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">OTA Systems</h1>
                        <p className="text-muted-foreground text-lg">Diagnostics and control for Over-The-Air application updates.</p>
                    </motion.div>
                    
                    <div className="flex flex-wrap gap-2">
                        <Button 
                            variant="outline" 
                            size="lg"
                            className="shadow-sm hover:shadow transition-all bg-card"
                            onClick={handleRefresh} 
                            disabled={isBusy}
                        >
                            <RefreshCw className={cn("mr-2 h-4 w-4", isBusy && "animate-spin")} /> Refresh State
                        </Button>
                    </div>
                </header>

                {/* Status Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <StatusCard 
                        title="Active Version" 
                        value={snapshot?.activeVersion || 'Built-in'} 
                        icon={<ShieldCheck className="h-5 w-5 text-emerald-500" />}
                        description="Currently running version"
                    />
                    <StatusCard 
                        title="Staged Update" 
                        value={snapshot?.stagedVersion || 'None'} 
                        icon={<History className="h-5 w-5 text-blue-500" />}
                        description="Next version to apply"
                        badge={snapshot?.pendingApply ? "Pending" : undefined}
                    />
                    <StatusCard 
                        title="Latest Manifest" 
                        value={snapshot?.lastManifestVersion || 'Unknown'} 
                        icon={<Info className="h-5 w-5 text-indigo-500" />}
                        description="From remote update check"
                    />
                    <StatusCard 
                        title="Storage" 
                        value={`${snapshot?.downloadedVersions?.length || 0} Versions`} 
                        icon={<HardDrive className="h-5 w-5 text-amber-500" />}
                        description="Locally stored bundles"
                    />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    {/* Left Column: Management & Native Status */}
                    <div className="xl:col-span-2 space-y-8">
                        <Tabs defaultValue="management" className="w-full">
                            <TabsList className="mb-4 bg-muted/50 p-1 rounded-xl">
                                <TabsTrigger value="management" className="rounded-lg px-4 text-center">Update Management</TabsTrigger>
                                <TabsTrigger value="runtime" className="rounded-lg px-4 text-center">Native Runtime</TabsTrigger>
                            </TabsList>

                            <TabsContent value="management" className="focus-visible:outline-none">
                                <Card className="border-2 overflow-hidden">
                                    <div className="bg-muted/30 px-6 py-4 border-b flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Play className="h-5 w-5 text-primary" />
                                            <h2 className="font-bold text-lg">Staged Update Control</h2>
                                        </div>
                                        {snapshot?.stagedVersion && (
                                            <Badge variant="outline" className="animate-pulse bg-primary/5 text-primary">v{snapshot.stagedVersion}</Badge>
                                        )}
                                    </div>
                                    <CardContent className="p-6">
                                        {!snapshot?.stagedVersion ? (
                                            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 bg-muted/20 rounded-xl border-2 border-dashed">
                                                <div className="p-4 bg-background rounded-full">
                                                    <CheckCircle2 className="h-8 w-8 text-muted-foreground/30" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="font-medium text-muted-foreground">No updates currently staged</p>
                                                    <p className="text-xs text-muted-foreground/60 max-w-[250px]">The system will check for updates automatically in the background.</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <InfoRow label="Staged path" value={snapshot.stagedPath} isMono copyable onCopy={() => copyToClipboard(snapshot.stagedPath)} />
                                                    <InfoRow label="Applied attempt" value={snapshot.lastAppliedAttemptVersion} />
                                                    <InfoRow label="Status" value={snapshot.pendingApply ? "Ready for launch" : "Inactive"} />
                                                </div>

                                                <Separator />

                                                <div className="flex flex-wrap gap-3 pt-2">
                                                    <Button 
                                                        className="flex-1 min-w-[140px]" 
                                                        onClick={handleValidateStaged} 
                                                        disabled={isBusy}
                                                    >
                                                        {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />} Validate
                                                    </Button>
                                                    <Button 
                                                        variant="secondary"
                                                        className="flex-1 min-w-[140px] bg-blue-600 hover:bg-blue-700 text-white" 
                                                        onClick={() => setConfirmAction({
                                                            title: "Apply Staged Update?",
                                                            description: `This will switch the app to v${snapshot.stagedVersion} and immediately reload the interface.`,
                                                            action: handleApplyStaged
                                                        })} 
                                                        disabled={isBusy}
                                                    >
                                                        <Play className="mr-2 h-4 w-4 fill-current text-white/90" /> Apply Version
                                                    </Button>
                                                    <Button 
                                                        variant="destructive" 
                                                        className="flex-1 min-w-[140px]"
                                                        onClick={() => setConfirmAction({
                                                            title: "Clear Staged Update?",
                                                            description: "This will remove the current staged version from the update queue. The bundle will remain in storage.",
                                                            action: handleClearStaged,
                                                            destructive: true
                                                        })} 
                                                        disabled={isBusy}
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" /> Clear Staged
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="runtime" className="focus-visible:outline-none">
                                <Card className="border-2">
                                    <div className="bg-muted/30 px-6 py-4 border-b">
                                        <div className="flex items-center gap-2">
                                            <Laptop className="h-5 w-5 text-primary" />
                                            <h2 className="font-bold text-lg">WebView Environment</h2>
                                        </div>
                                    </div>
                                    <CardContent className="p-6 space-y-6">
                                        <div className="space-y-4">
                                            <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-medium">Platform</span>
                                                    <Badge variant="outline">{Capacitor.getPlatform()}</Badge>
                                                </div>
                                                <Separator className="bg-muted" />
                                                <div className="space-y-1">
                                                    <span className="text-sm font-medium text-muted-foreground">Runtime WebView Path</span>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <code className="text-[10px] bg-background/80 p-1.5 rounded border block flex-1 uppercase tracking-tight">
                                                            {webviewPath || 'BUILT_IN_ASSETS'}
                                                        </code>
                                                        {webviewPath && (
                                                            <Button size="icon" variant="ghost" onClick={() => copyToClipboard(webviewPath)}>
                                                                <Copy className="h-3 w-3" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-2">
                                                <Button 
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full text-xs"
                                                    onClick={async () => {
                                                        setIsBusy(true);
                                                        try {
                                                            await WebView.setServerBasePath({ path: '' });
                                                            await WebView.persistServerBasePath();
                                                            toast.success('WebView reset to empty path');
                                                            await loadSnapshot();
                                                        } catch (err) {
                                                            toast.error('Reset failed');
                                                        } finally {
                                                            setIsBusy(false);
                                                        }
                                                    }}
                                                >
                                                    Emergency Reset to Built-in Assets
                                                </Button>
                                            </div>

                                            {snapshot?.activePath && snapshot.activePath !== webviewPath && !(snapshot.activePath === 'public' && !webviewPath) && (
                                                <div className="p-4 border-2 border-amber-500/20 bg-amber-500/5 rounded-lg flex items-start gap-4">
                                                    <div className="p-2 bg-amber-500/10 rounded-full">
                                                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                                                    </div>
                                                    <div className="space-y-2 flex-1">
                                                        <h3 className="font-bold text-amber-800 text-sm">Path Mismatch Detected</h3>
                                                        <p className="text-xs text-amber-700/80 leading-relaxed">
                                                            The persistent version store expects <code className="font-bold">v{snapshot.activeVersion}</code> but the current WebView is loading from a different path.
                                                        </p>
                                                        <Button 
                                                            size="sm" 
                                                            className="bg-amber-600 hover:bg-amber-700 text-white border-0 shadow-lg"
                                                            onClick={handleSyncWebView} 
                                                            disabled={isBusy || !Capacitor.isNativePlatform()}
                                                        >
                                                            Sync WebView Path
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>

                        {/* Downloaded Versions List */}
                        <Card className="border-2 overflow-hidden shadow-sm">
                            <div className="bg-muted/30 px-6 py-4 border-b flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <HardDrive className="h-5 w-5 text-primary" />
                                    <h2 className="font-bold text-lg">Bundle Storage</h2>
                                </div>
                                <Badge variant="secondary" className="font-mono">
                                    {(snapshot?.downloadedVersions ?? []).length} total
                                </Badge>
                            </div>
                            <CardContent className="p-0">
                                <div className="divide-y divide-muted">
                                    <AnimatePresence initial={false}>
                                        {(snapshot?.downloadedVersions ?? []).length === 0 ? (
                                            <div className="p-12 text-center text-muted-foreground text-sm italic">
                                                No versions downloaded yet.
                                            </div>
                                        ) : (
                                            [...(snapshot?.downloadedVersions ?? [])].reverse().map((v, i) => (
                                                <motion.div 
                                                    key={v}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: i * 0.05 }}
                                                    className={cn(
                                                        "p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:bg-muted/10",
                                                        v === snapshot?.activeVersion && "bg-emerald-500/5"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className={cn(
                                                            "w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shadow-sm border",
                                                            v === snapshot?.activeVersion 
                                                                ? "bg-emerald-100 text-emerald-700 border-emerald-200" 
                                                                : "bg-white text-muted-foreground border-muted"
                                                        )}>
                                                            {v.split('.').pop()}
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-base">Version {v}</span>
                                                                {v === snapshot?.activeVersion && (
                                                                    <Badge className="bg-emerald-500 hover:bg-emerald-600">Active</Badge>
                                                                )}
                                                                {v === snapshot?.stagedVersion && (
                                                                    <Badge variant="secondary" className="text-blue-600 bg-blue-50 border-blue-100">Staged</Badge>
                                                                )}
                                                            </div>
                                                            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-tighter opacity-70">
                                                                Bundle Path: .../{v}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 self-end sm:self-auto overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
                                                        {v !== snapshot?.activeVersion && (
                                                            <>
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="ghost"
                                                                    className="h-9 px-3 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                                    onClick={() => setConfirmAction({
                                                                        title: `Switch to v${v}?`,
                                                                        description: "This will stage this version and reload the application.",
                                                                        action: () => handleSwitchVersion(v)
                                                                    })}
                                                                    disabled={isBusy || snapshot?.failedVersions?.includes(v)}
                                                                >
                                                                    <Play className="h-4 w-4 mr-1.5" /> Switch
                                                                </Button>
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="ghost"
                                                                    className="h-9 px-3 text-destructive hover:bg-destructive/10"
                                                                    onClick={() => setConfirmAction({
                                                                        title: `Delete version ${v}?`,
                                                                        description: "This will PERMANENTLY delete the bundle files from storage. If this version is needed later, it must be re-downloaded.",
                                                                        action: () => handleDeleteVersion(v),
                                                                        destructive: true
                                                                    })}
                                                                    disabled={isBusy || v === snapshot?.stagedVersion}
                                                                >
                                                                    <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                                                                </Button>
                                                            </>
                                                        )}
                                                        <Button 
                                                            size="icon" 
                                                            variant="ghost" 
                                                            className="h-9 w-9 text-muted-foreground"
                                                            onClick={async () => {
                                                                const path = await bundleManager.getBundlePath(v);
                                                                copyToClipboard(path);
                                                            }}
                                                        >
                                                            <Copy className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </motion.div>
                                            ))
                                        )}
                                    </AnimatePresence>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column: Failed Versions & Tips */}
                    <div className="space-y-6">
                        <Card className="border-2 border-destructive/20 overflow-hidden shadow-sm shadow-destructive/5">
                            <div className="bg-destructive/5 px-6 py-4 border-b border-destructive/10 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <XCircle className="h-5 w-5 text-destructive" />
                                    <h2 className="font-bold text-lg text-destructive">Blacklisted</h2>
                                </div>
                                <Badge variant="destructive" className="font-mono">
                                    {(snapshot?.failedVersions ?? []).length}
                                </Badge>
                            </div>
                            <CardContent className="p-4 sm:p-6">
                                <div className="space-y-4">
                                    {(snapshot?.failedVersions ?? []).length === 0 ? (
                                        <div className="py-8 text-center text-muted-foreground text-sm italic">
                                            No versions blacklisted.
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {(snapshot?.failedVersions ?? []).map((v) => (
                                                <div key={v} className="flex items-center justify-between p-3 bg-muted rounded-xl border border-muted-foreground/10 group">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                                                        <span className="font-bold text-sm">v{v}</span>
                                                    </div>
                                                    <Button 
                                                        size="sm" 
                                                        variant="outline" 
                                                        className="h-8 bg-background opacity-70 group-hover:opacity-100 transition-opacity" 
                                                        onClick={() => handleClearFailedVersion(v)} 
                                                        disabled={isBusy}
                                                    >
                                                        Unlock
                                                    </Button>
                                                </div>
                                            ))}
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="w-full mt-2 text-destructive hover:bg-destructive/5" 
                                                onClick={handleClearAllFailed} 
                                                disabled={isBusy}
                                            >
                                                <Trash2 className="h-4 w-4 mr-2" /> Clear all blacklist
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-primary/5 border-primary/10 shadow-none border-2">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Info className="h-4 w-4 text-primary" />
                                    System Info
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-xs space-y-3 leading-relaxed text-muted-foreground">
                                <p>• <strong>Active Versions</strong> are persisted in SQLite/Filesystem for native boots.</p>
                                <p>• <strong>Blacklisted versions</strong> are skipped automatically during update checks to prevent boot loops.</p>
                                <p>• <strong>Syncing WebView</strong> is required if the native platform drifts from the stored path (common during manual interventions).</p>
                                <p>• <strong>Deleting a version</strong> removes it from filesystem storage. Be careful not to delete a version currently being staged.</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Global Confirmation Dialog */}
                <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
                    <AlertDialogContent className="rounded-2xl max-w-[400px]">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-xl font-bold">{confirmAction?.title}</AlertDialogTitle>
                            <AlertDialogDescription className="text-muted-foreground/80">
                                {confirmAction?.description}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="gap-2 sm:gap-0">
                            <AlertDialogCancel className="rounded-xl border-2">Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                                onClick={() => confirmAction?.action()}
                                className={cn(
                                    "rounded-xl border-0 shadow-lg transition-transform active:scale-95",
                                    confirmAction?.destructive ? "bg-destructive text-white" : "bg-primary"
                                )}
                            >
                                Confirm
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}

function StatusCard({ title, value, icon, description, badge }: { title: string; value: string; icon: React.ReactNode; description: string; badge?: string }) {
    return (
        <Card className="border-2 shadow-sm overflow-hidden hover:border-primary/20 transition-colors">
            <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                    <div className="p-2.5 bg-muted rounded-xl">
                        {icon}
                    </div>
                    {badge && (
                        <Badge className="bg-primary/10 text-primary border-0 font-bold text-[10px] px-2 uppercase tracking-wide">
                            {badge}
                        </Badge>
                    )}
                </div>
                <div className="space-y-0.5">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{title}</div>
                    <div className="text-xl font-black">{value}</div>
                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1 opacity-70 italic">{description}</p>
                </div>
            </CardContent>
        </Card>
    );
}

function InfoRow({ label, value, isMono, copyable, onCopy }: { label: string; value: string | null | undefined; isMono?: boolean; copyable?: boolean; onCopy?: () => void }) {
    return (
        <div className="space-y-1.5 group">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
                {copyable && value && (
                    <button onClick={onCopy} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded text-primary">
                        <Copy className="h-3 w-3" />
                    </button>
                )}
            </div>
            <div className={cn(
                "p-2 bg-muted/40 rounded-lg border border-muted-foreground/10 text-sm font-medium",
                isMono && "font-mono text-[10px] break-all"
            )}>
                {value || '—'}
            </div>
        </div>
    );
}
