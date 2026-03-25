'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import { useRouter } from 'nextjs-toploader/app';
import { dataStore } from '@/lib/data-store';
import type { ShiftReport, Task, ComprehensiveTaskSection } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/pro-toast';
import { useAuth } from '@/hooks/use-auth';
import { Send, Loader2, CheckCircle, WifiOff, CloudDownload, UploadCloud, ListChecks } from 'lucide-react';
import { vi } from 'date-fns/locale';
import CameraDialog from '@/components/camera-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { Badge } from '@/components/ui/badge';
import { photoStore } from '@/lib/photo-store';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { SectionReportBlock } from './section-report-block';

type SyncStatus = 'checking' | 'synced' | 'local-newer' | 'server-newer' | 'error';

interface ManagerReportViewProps {
    isStandalone?: boolean;
}

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

    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [activeTask, setActiveTask] = useState<Task | null>(null);

    const [tasks, setTasks] = useState<ComprehensiveTaskSection[] | null>(null);

    const [isBottomNavVisible, setIsBottomNavVisible] = useState<boolean>(false);

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
                
                if (hasEmptyTasks && hasEmptySections && !newReport.issues) {
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

    const handleCameraClose = useCallback(() => {
        setIsCameraOpen(false);
        setActiveTask(null);
    }, []);

    const handlePhotoTaskAction = useCallback((task: Task) => {
        setActiveTask(task);
        setIsCameraOpen(true);
    }, []);

    const handleCapturePhotos = useCallback(async (media: { id: string; type: 'photo' | 'video' }[], note?: string) => {
        if (!activeTask) return;

        const photoIds = media.filter(m => m.type === 'photo').map(m => m.id);
        const taskId = activeTask.id;
        
        // Find which section this task belongs to
        let sectionTitle = '';
        if (tasks) {
            for (const section of tasks) {
                if (section.tasks.some(t => t.id === taskId)) {
                    sectionTitle = section.title;
                    break;
                }
            }
        }

        updateLocalReport(prevReport => {
            const newReport = { ...prevReport };
            
            // 1. Update completedTasks as before
            const newCompletedTasks = { ...newReport.completedTasks };
            let taskCompletions = [...(newCompletedTasks[taskId] || [])];

            taskCompletions.unshift({
                timestamp: format(new Date(), 'HH:mm'),
                photos: [],
                photoIds: photoIds,
                note: note?.trim() || undefined
            });

            newCompletedTasks[taskId] = taskCompletions;
            newReport.completedTasks = newCompletedTasks;
            
            // 2. Add to sectionReports history
            if (sectionTitle) {
                const reports = newReport.sectionReports || {};
                const sectionReportsList = [...(reports[sectionTitle] || [])];
                
                let text = `Đã chụp ảnh: ${activeTask.text}`;
                if (note?.trim()) {
                    text += ` - ${note.trim()}`;
                }

                sectionReportsList.push({
                    timestamp: format(new Date(), 'HH:mm'),
                    text: text,
                    photoIds: photoIds
                });
                
                newReport.sectionReports = { ...reports, [sectionTitle]: sectionReportsList };
            }

            return newReport;
        });

        handleCameraClose();
    }, [activeTask, updateLocalReport, handleCameraClose]);

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
        setShowSyncDialog(false);
        const toastId = toast.loading("Đang gửi báo cáo...");

        const finalReport = { ...report, issues: generalNotes || null };

        try {
            await dataStore.submitReport(finalReport);
            const serverReport = await dataStore.overwriteLocalReport(report.id);
            setReport(serverReport);
            setSyncStatus('synced');
            setHasUnsubmittedChanges(false);
            const endTime = Date.now();
            const duration = ((endTime - startTime) / 1000).toFixed(2);
            toast.success(`Gửi báo cáo thành công! (Thời gian: ${duration} giây)`, { id: toastId });
        } catch (error) {
            console.error("Failed to submit report:", error);
            setSyncStatus('error');
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
    }

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

            {/* Sections */}
            <div className="p-4 max-w-3xl mx-auto w-full">
                {tasks.map((section) => (
                    <SectionReportBlock
                        key={section.title}
                        section={section}
                        report={report}
                        isReadonly={isReadonly}
                        onAddReport={handleAddSectionReport}
                        onPhotoAction={handlePhotoTaskAction}
                    />
                ))}

                {/* Global Notes */}
                <div className="mt-8 mb-4">
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

            {/* Submit FAB */}
            <div className={cn(
                "fixed right-4 z-[40] transition-all duration-300 md:right-8",
                isBottomNavVisible ? "bottom-20" : "bottom-6"
            )}>
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

            <CameraDialog
                isOpen={isCameraOpen}
                onClose={handleCameraClose}
                onSubmit={handleCapturePhotos}
                captureMode="photo"
                parentDialogTag="root"
                contextText={activeTask?.text || ''}
                allowCaption={true}
            />

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

