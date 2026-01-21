'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import { useRouter } from 'nextjs-toploader/app';
import { dataStore } from '@/lib/data-store';
import type { ShiftReport, CompletionRecord, ComprehensiveTaskSection, ComprehensiveTask, Task } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/pro-toast';
import { useAuth } from '@/hooks/use-auth';
import { Send, ArrowLeft, Loader2, CheckCircle, WifiOff, CloudDownload, UploadCloud, Building, ChevronsDownUp, ListChecks, Activity, LayoutGrid, ChevronRight, ChevronLeft, UtensilsCrossed, GlassWater, Package, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { vi } from 'date-fns/locale';
import CameraDialog from '@/components/camera-dialog';
import OpinionDialog from '@/components/opinion-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { Badge } from '@/components/ui/badge';
import { photoStore } from '@/lib/photo-store';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TaskItem } from '../../../_components/task-item';
import TaskNoteDialog from '@/components/task-note-dialog';
import { format } from 'date-fns';
import { useLightbox } from '@/contexts/lightbox-context';
import { cn } from '@/lib/utils';

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
    const [submissionNotes, setSubmissionNotes] = useState('');

    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isOpinionOpen, setIsOpinionOpen] = useState(false);
    const [isNoteOpen, setIsNoteOpen] = useState(false);
    const [activeTask, setActiveTask] = useState<Task | null>(null);
    const [activeCompletionIndex, setActiveCompletionIndex] = useState<number | null>(null);

    const [tasks, setTasks] = useState<ComprehensiveTaskSection[] | null>(null);

    const [activeTab, setActiveTab] = useState<string>('');
    const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
    const [isBottomNavVisible, setIsBottomNavVisible] = useState<boolean>(false);
    const { openLightbox } = useLightbox();

    // Derived State for UI
    const allTasks = tasks ? tasks.flatMap(s => s.tasks) : [];
    const totalTasksCount = allTasks.length;
    const completedTasksCount = allTasks.filter(t => {
        const completions = report?.completedTasks[t.id] || [];
        const min = (t as any)?.minCompletions ?? 1;
        return completions.length >= min;
    }).length;
    const progressPercentage = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

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

    // Initialize accordion to be all open by default
    /* Intentionally removed accordion initialization as we switched to tabs */

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
                    setReport(loadedReport);
                    setSubmissionNotes(loadedReport.issues || '');
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
                if (dataStore.isReportEmpty(newReport)) {
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

    const handleNotesChange = useCallback((notes: string) => {
        setSubmissionNotes(notes);
        updateLocalReport(prevReport => ({ ...prevReport, issues: notes }));
    }, [updateLocalReport]);

    const handleCameraClose = useCallback(() => {
        setIsCameraOpen(false);
        setActiveTask(null);
        setActiveCompletionIndex(null);
    }, []);

    const handleOpinionClose = () => {
        setIsOpinionOpen(false);
        setActiveTask(null);
    };

    const handleNoteClose = () => {
        setIsNoteOpen(false);
        setActiveTask(null);
    };

    const handlePhotoTaskAction = (task: Task, completionIndex: number | null = null) => {
        setActiveTask(task);
        setActiveCompletionIndex(completionIndex);
        setIsCameraOpen(true);
    };

    const handleBooleanTaskAction = (taskId: string, value: boolean) => {
        updateLocalReport(prevReport => {
            const newReport = { ...prevReport };
            const newCompletedTasks = { ...newReport.completedTasks };
            let taskCompletions = [...(newCompletedTasks[taskId] || [])];

            const newCompletion: CompletionRecord = {
                timestamp: format(new Date(), 'HH:mm'),
                photos: [],
                photoIds: [],
                value: value,
            };

            taskCompletions.unshift(newCompletion);
            newCompletedTasks[taskId] = taskCompletions;
            newReport.completedTasks = newCompletedTasks;
            return newReport;
        });
    };

    const handleOpinionTaskAction = (task: Task) => {
        setActiveTask(task);
        setIsOpinionOpen(true);
    };

    const handleNoteTaskAction = (task: Task) => {
        setActiveTask(task);
        setIsNoteOpen(true);
    };

    const handleSaveNote = (note: string) => {
        if (!activeTask) return;

        updateLocalReport(prevReport => {
            const taskId = activeTask.id;
            const currentCompletions = prevReport.completedTasks[taskId] || [];

            const newCompletion: CompletionRecord = {
                timestamp: format(new Date(), 'HH:mm:ss'),
                note: note
            };

            return {
                ...prevReport,
                completedTasks: {
                    ...prevReport.completedTasks,
                    [taskId]: [newCompletion, ...currentCompletions]
                }
            };
        });

        handleNoteClose();
    };

    const handleSaveOpinion = (opinionText: string) => {
        if (!activeTask) return;

        updateLocalReport(prevReport => {
            const newReport = { ...prevReport };
            const newCompletedTasks = { ...newReport.completedTasks };
            let taskCompletions = [...(newCompletedTasks[activeTask.id] || [])];

            const newCompletion: CompletionRecord = {
                timestamp: format(new Date(), 'HH:mm'),
                photos: [],
                photoIds: [],
                opinion: opinionText.trim() || undefined,
            };

            taskCompletions.unshift(newCompletion);
            newCompletedTasks[activeTask.id] = taskCompletions;
            newReport.completedTasks = newCompletedTasks;
            return newReport;
        });

        handleOpinionClose();
    }

    const handleCapturePhotos = useCallback(async (media: { id: string; type: 'photo' | 'video' }[], note?: string) => {
        if (!activeTask) return;

        // Filter for photos only, as this dialog currently only handles images.
        const photoIds = media.filter(m => m.type === 'photo').map(m => m.id);

        const taskId = activeTask.id;
        const completionIndex = activeCompletionIndex;

        updateLocalReport(prevReport => {
            const newReport = { ...prevReport };
            const newCompletedTasks = { ...newReport.completedTasks };
            let taskCompletions = [...(newCompletedTasks[taskId] || [])];

            if (completionIndex !== null && taskCompletions[completionIndex]) {
                const completionToUpdate = { ...taskCompletions[completionIndex] };
                completionToUpdate.photoIds = [...(completionToUpdate.photoIds || []), ...photoIds];
                if (note && note.trim()) completionToUpdate.note = note.trim();
                taskCompletions[completionIndex] = completionToUpdate;
            } else {
                taskCompletions.unshift({
                    timestamp: format(new Date(), 'HH:mm'),
                    photos: [],
                    photoIds: photoIds,
                    note: note?.trim() || undefined
                });
            }

            newCompletedTasks[taskId] = taskCompletions;
            newReport.completedTasks = newCompletedTasks;
            return newReport;
        });

        handleCameraClose();
    }, [activeTask, activeCompletionIndex, updateLocalReport, handleCameraClose]);

    const handleDeletePhoto = async (taskId: string, completionIndex: number, photoId: string, isLocal: boolean) => {
        if (!report) return;

        if (isLocal) {
            await photoStore.deletePhoto(photoId);
        } else {
            await dataStore.deletePhotoFromStorage(photoId);
        }

        updateLocalReport(prevReport => {
            const newReport = { ...prevReport };
            const newCompletedTasks = { ...newReport.completedTasks };
            const taskCompletions = [...(newCompletedTasks[taskId] || [])];
            const completionToUpdate = { ...taskCompletions[completionIndex] };

            if (!completionToUpdate) return prevReport;

            if (isLocal) {
                completionToUpdate.photoIds = (completionToUpdate.photoIds ?? []).filter((p: string) => p !== photoId);
            } else {
                completionToUpdate.photos = (completionToUpdate.photos ?? []).filter((p: string) => p !== photoId);
            }

            if ((completionToUpdate.photoIds?.length || 0) === 0 && (completionToUpdate.photos?.length || 0) === 0) {
                const taskDefinition = tasks?.flatMap(s => s.tasks).find(t => t.id === taskId);
                if (taskDefinition?.type === 'photo') {
                    taskCompletions.splice(completionIndex, 1);
                } else {
                    taskCompletions[completionIndex] = completionToUpdate;
                }
            } else {
                taskCompletions[completionIndex] = completionToUpdate;
            }

            if (taskCompletions.length === 0) {
                delete newCompletedTasks[taskId];
            } else {
                newCompletedTasks[taskId] = taskCompletions;
            }

            newReport.completedTasks = newCompletedTasks;
            return newReport;
        });
    };

    const handleDeleteCompletion = async (taskId: string, completionIndex: number) => {
        if (!report) return;

        const completionToDelete = report.completedTasks[taskId]?.[completionIndex];
        if (!completionToDelete) return;

        if (completionToDelete.photoIds) {
            await photoStore.deletePhotos(completionToDelete.photoIds);
        }
        if (completionToDelete.photos) {
            await Promise.all(completionToDelete.photos.map(url => dataStore.deletePhotoFromStorage(url)));
        }

        updateLocalReport(prevReport => {
            const newReport = { ...prevReport };
            const newCompletedTasks = { ...newReport.completedTasks };
            const taskCompletions = [...(newCompletedTasks[taskId] || [])];
            taskCompletions.splice(completionIndex, 1);

            if (taskCompletions.length > 0) {
                newCompletedTasks[taskId] = taskCompletions;
            } else {
                delete newCompletedTasks[taskId];
            }
            newReport.completedTasks = newCompletedTasks;
            return newReport;
        });
    }

    const handleSubmitReport = async () => {
        if (!report) return;
        const startTime = Date.now();
        setIsSubmitting(true);
        setShowSyncDialog(false);
        const toastId = toast.loading("Đang gửi báo cáo...");

        const finalReport = { ...report, issues: submissionNotes || null };

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
            setReport(serverReport);
            setSubmissionNotes(serverReport.issues || '');
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

    const toggleExpandTask = useCallback((taskId: string) => {
        setExpandedTaskIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(taskId)) {
                newSet.delete(taskId);
            } else {
                newSet.add(taskId);
            }
            return newSet;
        });
    }, []);

    const getSectionIcon = (title: string) => {
        const t = title.toLowerCase();
        if (t.includes('phục vụ')) return <UtensilsCrossed className="h-5 w-5 text-orange-500" />;
        if (t.includes('pha chế')) return <GlassWater className="h-5 w-5 text-blue-500" />;
        if (t.includes('kho')) return <Package className="h-5 w-5 text-amber-500" />;
        if (t.includes('quản lý')) return <ShieldCheck className="h-5 w-5 text-indigo-500" />;
        return <LayoutGrid className="h-5 w-5 text-slate-500" />;
    }

    const getSectionBorderColor = (title: string) => {
        const t = title.toLowerCase();
        if (t.includes('phục vụ')) return 'border-orange-500/80';
        if (t.includes('pha chế')) return 'border-blue-500/80';
        if (t.includes('kho')) return 'border-amber-500/80';
        if (t.includes('quản lý')) return 'border-indigo-500/80';
        return 'border-border';
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
        <TooltipProvider>
            <div className="flex flex-col min-h-screen bg-background pb-24">
                {/* --- Header & Stats Section --- */}
                <div className="bg-white dark:bg-slate-950 border-b">
                    <div className="px-4 pt-5 pb-4 space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 rotate-3">
                                        <ListChecks className="w-6 h-6 text-primary -rotate-3" />
                                    </div>
                                    {syncStatus === 'checking' && (
                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-2 border-white animate-pulse" />
                                    )}
                                </div>
                                <div className="space-y-0.5">
                                    <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase italic">
                                        Phiếu kiểm tra toàn diện
                                    </h1>
                                    <div className="flex items-center gap-2">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/50 px-2 py-0.5 rounded-md">
                                            {format(new Date(), 'EEEE, dd/MM', { locale: vi })}
                                        </p>
                                        {getSyncBadge()}
                                    </div>
                                </div>
                            </div>

                            <div className="text-right">
                                <div className="flex items-baseline justify-end gap-0.5">
                                    <span className="text-2xl font-black text-primary leading-none">{progressPercentage}</span>
                                    <span className="text-[10px] font-bold text-primary/60 uppercase">%</span>
                                </div>
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-tight">Hoàn tất</p>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="relative px-0.5">
                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner border border-slate-200/50">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-primary via-primary to-primary/80 shadow-[0_0_8px_rgba(var(--primary),0.3)]"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progressPercentage}%` }}
                                    transition={{ duration: 1, ease: "circOut" }}
                                />
                            </div>
                            <div className="flex justify-between mt-1.5 text-[9px] font-black text-muted-foreground/60 uppercase tracking-tighter">
                                <span>BẮT ĐẦU</span>
                                <div className="flex items-center gap-1 text-primary">
                                    <CheckCircle className="w-2.5 h-2.5" />
                                    <span>{completedTasksCount}/{totalTasksCount} NHIỆM VỤ</span>
                                </div>
                                <span>HOÀN TẤT</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- Main Content: Sections Grid or Tasks Grid --- */}
                <div className="flex-1 px-3 py-4">
                    {!activeTab ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {tasks.map((section) => {
                                const sectionTasks = section.tasks;
                                const sectionCompletedCount = sectionTasks.filter(t => {
                                    const completions = report.completedTasks[t.id] || [];
                                    const min = (t as any)?.minCompletions ?? 1;
                                    return completions.length >= min;
                                }).length;
                                const sectionTotalCount = sectionTasks.length;
                                const sectionProgress = sectionTotalCount > 0 ? Math.round((sectionCompletedCount / sectionTotalCount) * 100) : 0;
                                
                                return (
                                    <motion.div
                                        key={section.title}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setActiveTab(section.title)}
                                        className={cn(
                                            "relative p-5 rounded-2xl border bg-white dark:bg-slate-900 shadow-sm cursor-pointer transition-all active:bg-slate-50 dark:active:bg-slate-800/50 hover:border-primary/30",
                                            getSectionBorderColor(section.title)
                                        )}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="relative shrink-0">
                                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 ring-1 ring-inset ring-slate-200/5 dark:ring-white/5">
                                                    {getSectionIcon(section.title)}
                                                </div>
                                                {sectionProgress === 100 && (
                                                    <div className="absolute -top-1.5 -right-1.5 bg-green-500 rounded-full p-0.5 border-2 border-white dark:border-slate-900 shadow-sm">
                                                        <CheckCircle className="w-3 h-3 text-white" />
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                <div className="flex items-center justify-between mb-2.5">
                                                    <h3 className="text-[13px] font-black text-slate-900 dark:text-white uppercase tracking-tight leading-tight mr-1">
                                                        {section.title}
                                                    </h3>
                                                    <span className="text-[10px] font-bold text-primary tabular-nums italic">
                                                        {sectionProgress}%
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                                                        <motion.div 
                                                            className="h-full bg-primary"
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${sectionProgress}%` }}
                                                            transition={{ duration: 0.5, ease: "easeOut" }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] font-black text-muted-foreground/60 tabular-nums uppercase tracking-tighter">
                                                        {sectionCompletedCount}/{sectionTotalCount}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400 group-active:text-primary transition-colors">
                                                <ChevronRight className="h-4 w-4" />
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Section Header with Back Button */}
                            <div className="sticky top-[56px] md:top-0 z-40 -mx-3 px-3 py-3 bg-background/80 backdrop-blur-xl border-b mb-6 flex items-center gap-3">
                                <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase italic tracking-wider">
                                    {activeTab}
                                </h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {tasks.find(s => s.title === activeTab)?.tasks.map((task: any) => (
                                    <div key={task.id} className="relative">
                                        <div className="absolute -top-2 -right-2 z-10 pointer-events-none">
                                            {(() => {
                                                const count = (report.completedTasks[task.id]?.length || 0);
                                                const min = (task as any)?.minCompletions ?? 1;
                                                if (count >= min) {
                                                    return (
                                                        <div className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-green-500 text-white shadow-sm border-2 border-white">
                                                            <CheckCircle className="w-3 h-3" />
                                                        </div>
                                                    );
                                                }
                                                if (count > 0) {
                                                    return (
                                                        <div className="inline-flex items-center justify-center h-5 min-w-[24px] px-1 rounded-full bg-slate-600 text-white text-[10px] font-bold shadow-sm border-2 border-white">
                                                            {`${count}/${min}`}
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>
                                        <TaskItem
                                            task={task as unknown as Task}
                                            completions={(report.completedTasks[task.id] || []) as CompletionRecord[]}
                                            isReadonly={isReadonly}
                                            isExpanded={expandedTaskIds.has(task.id)}
                                            isSingleCompletion={false}
                                            onPhotoAction={handlePhotoTaskAction as (task: Task, completionIndex?: number | null) => void}
                                            onBooleanAction={handleBooleanTaskAction}
                                            onOpinionAction={handleOpinionTaskAction as (task: Task) => void}
                                            onNoteAction={handleNoteTaskAction}
                                            onDeleteCompletion={handleDeleteCompletion}
                                            onDeletePhoto={handleDeletePhoto}
                                            onToggleExpand={toggleExpandTask}
                                            onOpenLightbox={openLightbox}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <TaskNoteDialog 
                    isOpen={isNoteOpen}
                    onClose={handleNoteClose}
                    onSubmit={handleSaveNote}
                    taskText={activeTask?.text || ''}
                    parentDialogTag="root"
                />
            </div>

            <div className={cn(
                "fixed right-4 z-[20] transition-all duration-300 md:right-8", 
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
                contextText={activeTask?.text}
                allowCaption={true}
                initialCaption={activeTask ? (report.completedTasks[activeTask.id]?.find(c => c.note)?.note || '') : ''}
            />

            <OpinionDialog
                isOpen={isOpinionOpen}
                onClose={handleOpinionClose}
                onSubmit={handleSaveOpinion}
                taskText={activeTask?.text || ''}
                parentDialogTag="root"
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

        </TooltipProvider>
    );
}
