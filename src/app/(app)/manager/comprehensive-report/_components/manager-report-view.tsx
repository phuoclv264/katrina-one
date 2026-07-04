'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import { useRouter } from 'nextjs-toploader/app';
import { dataStore } from '@/lib/data-store';
import type { ShiftReport, ComprehensiveTaskSection } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/pro-toast';
import { useAuth } from '@/hooks/use-auth';
import { Send, Loader2, CheckCircle, WifiOff, CloudDownload, UploadCloud, ListChecks, ChevronDown, ChevronUp } from 'lucide-react';
import { vi } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { SectionReportBlock } from './section-report-block';
import { VideoReportSection, type LocalVideo, type UploadedVideo } from './video-report-section';

type SyncStatus = 'checking' | 'synced' | 'local-newer' | 'server-newer' | 'error';

interface ManagerReportViewProps {
    isStandalone?: boolean;
}

const PERFORMANCE_SECTION_KEYWORD = 'Báo cáo hiệu suất';

export default function ManagerReportView({ isStandalone = false }: ManagerReportViewProps) {
    const { user, loading: isAuthLoading } = useAuth();
    const router = useRouter();
    const routerRef = useRef(router);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const shiftKey = 'manager_comprehensive';

    const [report, setReport] = useState<ShiftReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasUnsubmittedChanges, setHasUnsubmittedChanges] = useState(false);

    const [syncStatus, setSyncStatus] = useState<SyncStatus>('checking');
    const [showSyncDialog, setShowSyncDialog] = useState(false);
    const [generalNotes, setGeneralNotes] = useState('');

    const [tasks, setTasks] = useState<ComprehensiveTaskSection[] | null>(null);

    // Upload progress tracking
    const [uploadProgress, setUploadProgress] = useState<{ completed: number; total: number } | null>(null);

    // Per-section task list collapsed state (true = expanded)
    const [sectionExpandedMap, setSectionExpandedMap] = useState<Record<string, boolean>>({});

    const toggleSection = useCallback((title: string) => {
        setSectionExpandedMap(prev => ({ ...prev, [title]: !prev[title] }));
    }, []);

    const [isBottomNavVisible, setIsBottomNavVisible] = useState<boolean>(false);

    // (video timestamps are stored inside report.videoTimestamps)

    // Watch for the global class toggled by BottomNav to position the FAB above it
    useEffect(() => {
        const update = () => {
            try {
                setIsBottomNavVisible(document.documentElement.classList.contains('bottom-nav-visible'));
            } catch (e) {
                setIsBottomNavVisible(false);
            }
        };

        update();

        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.type === 'attributes' && (m.target as Element) === document.documentElement) {
                    update();
                }
            }
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class']
        });

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        routerRef.current = router;
    }, [router]);

    useEffect(() => {
        if (!isAuthLoading && user && (user.role !== 'Quản lý' && user.role !== 'Chủ nhà hàng' && !user.secondaryRoles?.includes('Quản lý'))) {
            routerRef.current.replace('/');
        }
    }, [isAuthLoading, user]);

    useEffect(() => {
        let isMounted = true;
        const unsubscribeTasks = dataStore.subscribeToComprehensiveTasks((managerTasks) => {
            if (isMounted) setTasks(managerTasks);
        });
        return () => {
            isMounted = false;
            unsubscribeTasks();
        }
    }, []);

    const handleReconnect = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
    }, []);

    useEffect(() => {
        if (isAuthLoading || !user) return;
        let isMounted = true;

        const loadReport = async () => {
            setIsLoading(true);
            setSyncStatus('checking');
            try {
                const { report: loadedReport, status } = await dataStore.getOrCreateReport(user.uid, user.displayName || 'Quản lý', shiftKey);
                if (isMounted) {
                    // Ensure sectionReports exists
                    if (!loadedReport.sectionReports) {
                        loadedReport.sectionReports = {};
                    }
                    setReport(loadedReport);
                    setGeneralNotes(loadedReport.issues || '');
                    setSyncStatus(status);
                    if (status === 'local-newer' || status === 'server-newer') {
                        setShowSyncDialog(true);
                    }
                    if (status === 'local-newer') {
                        setHasUnsubmittedChanges(true);
                    }
                }
            } catch (error) {
                console.error("Error loading comprehensive report:", error);
                if (isMounted) {
                    setSyncStatus('error');
                    toast.error("Lỗi tải dữ liệu, không thể tải báo cáo. Đang chuyển hướng bạn về trang tổng quan.");
                    if (isStandalone) {
                        routerRef.current.replace('/manager');
                    }
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        loadReport();
        return () => { isMounted = false; }
    }, [isAuthLoading, user, shiftKey, refreshTrigger, isStandalone]);

    useDataRefresher(handleReconnect);

    const updateLocalReport = useCallback((updater: (prevReport: ShiftReport) => ShiftReport) => {
        setReport(prevReport => {
            if (!prevReport) return null;
            const newReport = updater(prevReport);

            (async () => {
                const hasEmptyTasks = Object.keys(newReport.completedTasks || {}).length === 0;
                const hasEmptySections = Object.keys(newReport.sectionReports || {}).length === 0;
                const hasSectionVideos = Object.values(newReport.sectionVideoIds || {}).some(ids => ids.length > 0);
                const hasEmptyVideos = !hasSectionVideos && (!newReport.videoIds || newReport.videoIds.length === 0);

                if (hasEmptyTasks && hasEmptySections && hasEmptyVideos && !newReport.issues) {
                    await dataStore.deleteLocalReport(newReport.id);
                    setSyncStatus('synced');
                    setHasUnsubmittedChanges(false);
                } else {
                    await dataStore.saveLocalReport(newReport);
                    setSyncStatus('local-newer');
                    setHasUnsubmittedChanges(true);
                }
            })();

            return newReport;
        });
    }, []);

    const handleAddSectionVideo = useCallback((sectionTitle: string, videoId: string, timestamp: string) => {
        updateLocalReport(prev => {
            const uploadedCount = (prev.sectionVideoUrls?.[sectionTitle] || []).length;
            const existingIds = prev.sectionVideoIds?.[sectionTitle] || [];
            const existingTs = prev.sectionVideoTimestamps?.[sectionTitle] || [];
            const paddedTs: string[] = [
                ...Array.from({ length: uploadedCount }, (_, i) => existingTs[i] ?? ''),
                ...existingTs.slice(uploadedCount),
                timestamp,
            ];
            return {
                ...prev,
                sectionVideoIds: { ...(prev.sectionVideoIds || {}), [sectionTitle]: [...existingIds, videoId] },
                sectionVideoTimestamps: { ...(prev.sectionVideoTimestamps || {}), [sectionTitle]: paddedTs },
            };
        });
    }, [updateLocalReport]);

    const handleDeleteSectionVideo = useCallback((sectionTitle: string, videoId: string) => {
        updateLocalReport(prev => {
            const uploadedCount = (prev.sectionVideoUrls?.[sectionTitle] || []).length;
            const existingIds = prev.sectionVideoIds?.[sectionTitle] || [];
            const localIdx = existingIds.indexOf(videoId);
            const newTimestamps = [...(prev.sectionVideoTimestamps?.[sectionTitle] || [])];
            if (localIdx !== -1) newTimestamps.splice(uploadedCount + localIdx, 1);
            return {
                ...prev,
                sectionVideoIds: { ...(prev.sectionVideoIds || {}), [sectionTitle]: existingIds.filter(id => id !== videoId) },
                sectionVideoTimestamps: { ...(prev.sectionVideoTimestamps || {}), [sectionTitle]: newTimestamps },
            };
        });
    }, [updateLocalReport]);

    const handleAddSectionReport = useCallback((sectionTitle: string, text: string) => {
        updateLocalReport(prevReport => {
            const newReport = { ...prevReport };
            const reports = newReport.sectionReports || {};
            const sectionReportsList = [...(reports[sectionTitle] || [])];

            sectionReportsList.push({
                timestamp: format(new Date(), 'HH:mm'),
                text: text
            });

            newReport.sectionReports = { ...reports, [sectionTitle]: sectionReportsList };
            return newReport;
        });
    }, [updateLocalReport]);

    const handleSubmitReport = async () => {
        if (!report) return;
        const startTime = Date.now();
        setIsSubmitting(true);
        setUploadProgress(null);
        setShowSyncDialog(false);
        const toastId = toast.loading("Đang gửi báo cáo...");

        const finalReport = { ...report, issues: generalNotes || null };

        try {
            await dataStore.submitReport(finalReport, (completed, total) => {
                setUploadProgress({ completed, total });
            });
            const serverReport = await dataStore.overwriteLocalReport(report.id);
            setReport(serverReport);
            setSyncStatus('synced');
            setHasUnsubmittedChanges(false);
            setUploadProgress(null);
            const endTime = Date.now();
            const duration = ((endTime - startTime) / 1000).toFixed(2);
            toast.success(`Gửi báo cáo thành công! (Thời gian: ${duration} giây)`, { id: toastId });
        } catch (error) {
            console.error("Failed to submit report:", error);
            setSyncStatus('error');
            setUploadProgress(null);
            toast.error("Gửi báo cáo thất bại. Vui lòng kiểm tra kết nối mạng và thử lại.", { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDownloadFromServer = async () => {
        if (!report) return;
        setIsSubmitting(true);
        setShowSyncDialog(false);
        const toastId = toast.loading("Đang tải dữ liệu từ máy chủ...");
        try {
            const serverReport = await dataStore.overwriteLocalReport(report.id);
            if (!serverReport.sectionReports) serverReport.sectionReports = {};
            setReport(serverReport);
            setGeneralNotes(serverReport.issues || '');
            setSyncStatus('synced');
            setHasUnsubmittedChanges(false);
            toast.success("Tải thành công! Báo cáo đã được cập nhật.", { id: toastId });
        } catch (error) {
            console.error("Failed to download report:", error);
            setSyncStatus('error');
            toast.error("Tải thất bại. Không thể tải dữ liệu từ máy chủ.", { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    }

    const isReadonly = isSubmitting;

    if (isAuthLoading || isLoading || !report || !tasks) {
        return <LoadingPage />;
    }

    // Split sections: performance section vs all others
    const performanceSections = tasks.filter(s => s.title.includes(PERFORMANCE_SECTION_KEYWORD));
    const regularSections = tasks.filter(s => !s.title.includes(PERFORMANCE_SECTION_KEYWORD));

    const getSyncBadge = () => {
        switch (syncStatus) {
            case 'synced':
                return <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle className="mr-1.5 h-3 w-3" />Đã đồng bộ</Badge>;
            case 'local-newer':
                return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20"><UploadCloud className="mr-1.5 h-3 w-3" />Chưa gửi</Badge>;
            case 'server-newer':
                return <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20"><CloudDownload className="mr-1.5 h-3 w-3" />Có bản mới</Badge>;
            case 'checking':
                return <Badge variant="secondary" className="bg-slate-500/10 text-slate-600 border-slate-500/20 shadow-none"><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Đang kiểm tra...</Badge>;
            case 'error':
                return <Badge variant="destructive"><WifiOff className="mr-1.5 h-3 w-3" />Lỗi đồng bộ</Badge>;
            default:
                return null;
        }
    };

    // Upload progress percentage
    const uploadPercent = uploadProgress && uploadProgress.total > 0
        ? Math.round((uploadProgress.completed / uploadProgress.total) * 100)
        : null;

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 pb-28">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border-b sticky top-[56px] md:top-0 z-30">
                <div className="px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                                <ListChecks className="w-5 h-5 text-primary" />
                            </div>
                            <div className="space-y-0.5">
                                <h1 className="text-lg font-black tracking-tight uppercase italic">
                                    Phiếu kiểm tra
                                </h1>
                                <div className="flex items-center gap-2">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                        {format(new Date(), 'EEEE, dd/MM', { locale: vi })}
                                    </p>
                                    {getSyncBadge()}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-4 max-w-3xl mx-auto w-full">

                {/* ── Per-section task list + video report ── */}
                {regularSections.map(section => {
                    const isExpanded = sectionExpandedMap[section.title] === true;
                    const sectionVideoUrls = report.sectionVideoUrls?.[section.title] || [];
                    const sectionVideoIds = report.sectionVideoIds?.[section.title] || [];
                    const sectionTs = report.sectionVideoTimestamps?.[section.title] || [];
                    const uploadedCount = sectionVideoUrls.length;
                    const uploadedVideos: UploadedVideo[] = sectionVideoUrls.map((url, i) => ({ url, timestamp: sectionTs[i] || '' }));
                    const localVideos: LocalVideo[] = sectionVideoIds.map((id, i) => ({ id, timestamp: sectionTs[uploadedCount + i] || '' }));
                    const videoCount = uploadedVideos.length + localVideos.length;

                    return (
                        <div key={section.title} className="mb-5 bg-white dark:bg-slate-900 border rounded-2xl shadow-sm overflow-hidden">
                            {/* Section header */}
                            <button
                                type="button"
                                className="w-full p-4 bg-slate-50/80 dark:bg-slate-800/80 border-b flex items-center justify-between"
                                onClick={() => toggleSection(section.title)}
                            >
                                <div className="flex items-center gap-2">
                                    <ListChecks className="w-4 h-4 text-primary" />
                                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                        {section.title}
                                    </h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    {videoCount > 0 ? (
                                        <span className="text-[11px] font-bold bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full">
                                            {videoCount} video ✓
                                        </span>
                                    ) : (
                                        <span className="text-[11px] font-bold text-slate-400">
                                            {section.tasks.length} công việc
                                        </span>
                                    )}
                                    {isExpanded
                                        ? <ChevronUp className="w-4 h-4 text-slate-400" />
                                        : <ChevronDown className="w-4 h-4 text-slate-400" />
                                    }
                                </div>
                            </button>

                            {/* Task list (collapsible) */}
                            {isExpanded && (
                                <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                                    <ul className="space-y-1.5">
                                        {section.tasks.map(task => (
                                            <li key={task.id} className="flex items-start gap-2 text-[13px] text-slate-700 dark:text-slate-300">
                                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                                                <span className="leading-snug">{task.text}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Video area (always visible) */}
                            <div className="p-4">
                                <VideoReportSection
                                    uploadedVideos={uploadedVideos}
                                    localVideos={localVideos}
                                    isReadonly={isReadonly || syncStatus === 'server-newer'}
                                    onAddVideo={(videoId, timestamp) => handleAddSectionVideo(section.title, videoId, timestamp)}
                                    onDeleteVideo={(videoId) => handleDeleteSectionVideo(section.title, videoId)}
                                    embedded
                                />
                            </div>
                        </div>
                    );
                })}

                {/* ── SECTION 2: Báo cáo hiệu suất (text reports) ── */}
                {performanceSections.map(section => (
                    <SectionReportBlock
                        key={section.title}
                        section={section}
                        report={report}
                        isReadonly={isReadonly}
                        onAddReport={handleAddSectionReport}
                        onPhotoAction={() => {}}
                        showTaskList={false}
                    />
                ))}

                {/* Global Notes */}
                <div className="mt-4 mb-4">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase mb-3 px-1">
                        Ghi chú chung
                    </h3>
                    <textarea
                        className="w-full min-h-[100px] border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-[13px] bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        placeholder="Nhập các lưu ý chung (không bắt buộc)..."
                        value={generalNotes}
                        onChange={(e) => {
                            setGeneralNotes(e.target.value);
                            updateLocalReport(prev => ({ ...prev, issues: e.target.value }));
                        }}
                        disabled={isReadonly}
                    />
                </div>
            </div>

            {/* Submit FAB with upload progress */}
            <div className={cn(
                "fixed right-4 z-[40] transition-all duration-300 md:right-8",
                isBottomNavVisible ? "bottom-20" : "bottom-6"
            )}>
                <div className="relative flex flex-col items-end gap-2">
                    {/* Upload progress card */}
                    {isSubmitting && uploadPercent !== null && (
                        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 px-3 py-2 w-52">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                    Đang tải lên...
                                </span>
                                <span className="text-[11px] font-mono font-bold text-primary">
                                    {uploadPercent}%
                                </span>
                            </div>
                            <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary rounded-full transition-all duration-300"
                                    style={{ width: `${uploadPercent}%` }}
                                />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">
                                {uploadProgress!.completed}/{uploadProgress!.total} tệp
                            </p>
                        </div>
                    )}

                    <div className="relative">
                        <Button
                            size="lg"
                            className="rounded-full shadow-2xl h-16 w-16 bg-primary hover:bg-primary/90 text-primary-foreground transition-transform active:scale-95"
                            onClick={handleSubmitReport}
                            disabled={isReadonly || syncStatus === 'server-newer'}
                            aria-label={report.status === 'submitted' ? 'Gửi lại báo cáo' : 'Gửi báo cáo'}
                        >
                            {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <Send className="h-6 w-6" />}
                        </Button>
                        {hasUnsubmittedChanges && (
                            <div className="absolute -top-1 -right-1 flex h-4 w-4">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-background"></span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <AlertDialog open={showSyncDialog && !isSubmitting} onOpenChange={setShowSyncDialog} parentDialogTag="root">
                <AlertDialogContent>
                    {syncStatus === 'local-newer' && (
                        <>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Bạn có thay đổi chưa được gửi</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Chúng tôi phát hiện bạn có những công việc đã hoàn thành nhưng chưa được gửi đi. Bạn có muốn gửi báo cáo bổ sung ngay bây giờ không?
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Để sau</AlertDialogCancel>
                                <AlertDialogAction onClick={handleSubmitReport}>Gửi ngay</AlertDialogAction>
                            </AlertDialogFooter>
                        </>
                    )}
                    {syncStatus === 'server-newer' && (
                        <>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Có phiên bản mới trên máy chủ</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Một phiên bản mới hơn của báo cáo này có sẵn trên máy chủ. Bạn nên tải nó về để đảm bảo dữ liệu được nhất quán. Việc này sẽ ghi đè lên các thay đổi cục bộ chưa được lưu của bạn.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Để sau</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDownloadFromServer}>Tải về ngay</AlertDialogAction>
                            </AlertDialogFooter>
                        </>
                    )}
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

