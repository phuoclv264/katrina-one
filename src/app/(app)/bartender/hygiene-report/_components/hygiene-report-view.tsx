'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import { dataStore } from '@/lib/data-store';
import type { TaskCompletion, TasksByShift, CompletionRecord, ShiftReport, TaskSection, Task } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/pro-toast';
import { useAuth } from '@/hooks/use-auth';
import { Send, ArrowLeft, Loader2, CheckCircle, WifiOff, CloudDownload, UploadCloud, ChevronsDownUp, Droplets, UtensilsCrossed, Wind, ListChecks, Activity, LayoutGrid, ChevronRight, ChevronLeft } from 'lucide-react';
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
import { useRouter } from 'nextjs-toploader/app';
import { cn } from '@/lib/utils';

type SyncStatus = 'checking' | 'synced' | 'local-newer' | 'server-newer' | 'error';

interface HygieneReportViewProps {
    isStandalone?: boolean;
}

export default function HygieneReportView({ isStandalone = true }: HygieneReportViewProps) {
    const { user, loading: isAuthLoading } = useAuth();
    const router = useRouter();
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const shiftKey = 'bartender_hygiene';
    const notesSectionRef = useRef<HTMLDivElement>(null);

    const [report, setReport] = useState<ShiftReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasUnsubmittedChanges, setHasUnsubmittedChanges] = useState(false);

    const [syncStatus, setSyncStatus] = useState<SyncStatus>('checking');
    const [showSyncDialog, setShowSyncDialog] = useState(false);
    const [submissionNotes, setSubmissionNotes] = useState('');
    const [notesError, setNotesError] = useState(false);

    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isOpinionOpen, setIsOpinionOpen] = useState(false);
    const [isNoteOpen, setIsNoteOpen] = useState(false);
    const [activeTask, setActiveTask] = useState<Task | null>(null);
    const [activeCompletionIndex, setActiveCompletionIndex] = useState<number | null>(null);

    const [tasks, setTasks] = useState<TaskSection[] | null>(null);

    const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<string>('');
    const [isBottomNavVisible, setIsBottomNavVisible] = useState<boolean>(false);
    const { openLightbox } = useLightbox();

    // Derived State for UI
    const allTasks = tasks ? tasks.flatMap(s => s.tasks) : [];
    const totalTasksCount = allTasks.length;
    const completedTasksCount = allTasks.filter(t => {
        const completions = report?.completedTasks[t.id] || [];
        return completions.length >= (t.minCompletions || 1);
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

    // --- Data Loading and Initialization ---
    useEffect(() => {
        if (!isAuthLoading && user && (user.role !== 'Pha chế' && !user.secondaryRoles?.includes('Pha chế'))) {
            router.replace('/');
        }
    }, [isAuthLoading, user, router]);

    useEffect(() => {
        const unsubscribeTasks = dataStore.subscribeToBartenderTasks((bartenderTasks) => {
            setTasks(bartenderTasks);
        });
        return () => unsubscribeTasks();
    }, []);

    const handleReconnect = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
    }, []);

    useEffect(() => {
        if (isAuthLoading || !user) return;

        const loadReport = async () => {
            setIsLoading(true);
            setSyncStatus('checking');
            try {
                const { report: loadedReport, status } = await dataStore.getOrCreateReport(user.uid, user.displayName || 'Nhân viên', shiftKey);
                setReport(loadedReport);
                setSubmissionNotes(loadedReport.issues || '');
                setSyncStatus(status);
                if (status === 'local-newer' || status === 'server-newer') {
                    setShowSyncDialog(true);
                }
                if (status === 'local-newer') {
                    setHasUnsubmittedChanges(true);
                }
            } catch (error) {
                console.error("Error loading report:", error);
                setSyncStatus('error');
                toast.error("Lỗi tải dữ liệu. Không thể tải hoặc đồng bộ báo cáo.");
            }
            setIsLoading(false);
        };

        loadReport();
    }, [isAuthLoading, user, shiftKey, refreshTrigger]);

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
        if (notesError) {
            setNotesError(false);
        }
        setSubmissionNotes(notes);
        updateLocalReport(prevReport => ({ ...prevReport, issues: notes }));
    }, [updateLocalReport, notesError]);

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

    const handleBooleanTaskAction = (taskId: string, value: boolean) => {
        updateLocalReport(prevReport => {
            const newReport = { ...prevReport };
            const newCompletedTasks = { ...newReport.completedTasks };
            const taskCompletions = [...(newCompletedTasks[taskId] || [])];

            const newCompletion: CompletionRecord = {
                timestamp: format(new Date(), 'HH:mm'),
                value: value,
            };

            taskCompletions.unshift(newCompletion);
            newCompletedTasks[taskId] = taskCompletions;
            newReport.completedTasks = newCompletedTasks;
            return newReport;
        });
    };

    const handleSaveOpinion = (opinionText: string) => {
        if (!activeTask) return;

        updateLocalReport(prevReport => {
            const newReport = { ...prevReport };
            const newCompletedTasks = { ...newReport.completedTasks };
            const taskCompletions = [...(newCompletedTasks[activeTask.id] || [])];

            const newCompletion: CompletionRecord = {
                timestamp: format(new Date(), 'HH:mm'),
                opinion: opinionText.trim() || undefined,
            };

            taskCompletions.unshift(newCompletion);
            newCompletedTasks[activeTask.id] = taskCompletions;
            newReport.completedTasks = newCompletedTasks;
            return newReport;
        });

        handleOpinionClose();
    }

    const handleCapturePhotos = useCallback(async (media: { id: string; type: 'photo' | 'video' }[]) => {
        if (!activeTask) return;

        // Since captureMode="photo", we can be confident all media are photos.
        const photoIds = media.map(m => m.id);

        const taskId = activeTask.id;
        const completionIndex = activeCompletionIndex;

        updateLocalReport(prevReport => {
            const newReport = { ...prevReport };
            const newCompletedTasks = { ...newReport.completedTasks };
            const taskCompletions = [...(newCompletedTasks[taskId] || [])];

            if (completionIndex !== null && taskCompletions[completionIndex]) {
                const completionToUpdate = { ...taskCompletions[completionIndex] };
                completionToUpdate.photoIds = [...(completionToUpdate.photoIds || []), ...photoIds];
                taskCompletions[completionIndex] = completionToUpdate;
            } else {
                taskCompletions.unshift({
                    timestamp: format(new Date(), 'HH:mm'),
                    photoIds: photoIds,
                    photos: [],
                });
            }

            newCompletedTasks[taskId] = taskCompletions;
            newReport.completedTasks = newCompletedTasks;
            return newReport;
        });

        handleCameraClose();
    }, [activeTask, activeCompletionIndex, updateLocalReport, handleCameraClose]);

    const handleDeletePhoto = async (taskId: string, completionIndex: number, photoId: string, isLocal: boolean) => {
        if (isLocal) {
            await photoStore.deletePhoto(photoId);
        } else {
            await dataStore.deletePhotoFromStorage(photoId);
        }

        updateLocalReport(prevReport => {
            const newReport = { ...prevReport };
            const newCompletedTasks = { ...newReport.completedTasks };
            const taskCompletions = [...(newCompletedTasks[taskId] || [])];
            if (!taskCompletions[completionIndex]) return prevReport;

            const completionToUpdate = { ...taskCompletions[completionIndex] };

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
            const serverReport = await dataStore.overwriteLocalReport(user!.uid, shiftKey);
            setReport(serverReport);
            setHasUnsubmittedChanges(false);
            setSyncStatus('synced');
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
        if (!user) return;
        setIsSubmitting(true);
        setShowSyncDialog(false);
        const toastId = toast.loading("Đang tải dữ liệu từ máy chủ...");
        try {
            const serverReport = await dataStore.overwriteLocalReport(user.uid, shiftKey);
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

    const getSectionIcon = (title: string) => {
        switch (title) {
            case 'Vệ sinh quầy bar': return <UtensilsCrossed className="mr-3 h-5 w-5 text-orange-500" />;
            case 'Vệ sinh máy móc': return <Wind className="mr-3 h-5 w-5 text-blue-500" />;
            case 'Vệ sinh khu vực chung': return <Droplets className="mr-3 h-5 w-5 text-cyan-500" />;
            default: return null;
        }
    }

    const getSectionBorderColor = (title: string) => {
        switch (title) {
            case 'Vệ sinh quầy bar': return 'border-orange-500/80';
            case 'Vệ sinh máy móc': return 'border-blue-500/80';
            case 'Vệ sinh khu vực chung': return 'border-cyan-500/80';
            default: return 'border-border';
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
                                        Báo cáo vệ sinh
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
                                    return completions.length >= (t.minCompletions || 1);
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
                                                    {getSectionIcon(section.title) || <LayoutGrid className="h-5 w-5 text-slate-500" />}
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
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setActiveTab('')}
                                    className="bg-muted rounded-xl hover:bg-muted/80 uppercase text-[10px] font-black px-3"
                                >
                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                    Quay lại
                                </Button>
                                <div className="h-4 w-px bg-border" />
                                <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase italic tracking-wider">
                                    {activeTab}
                                </h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {tasks.find(s => s.title === activeTab)?.tasks.map((task) => (
                                    <div key={task.id} className="relative">
                                        <div className="absolute -top-2 -right-2 z-10 pointer-events-none">
                                            {(() => {
                                                const count = (report.completedTasks[task.id]?.length || 0);
                                                const min = task.minCompletions || 1;
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
                                            task={task}
                                            completions={(report.completedTasks[task.id] || []) as CompletionRecord[]}
                                            isReadonly={isSubmitting}
                                            isExpanded={expandedTaskIds.has(task.id)}
                                            isSingleCompletion={false}
                                            onPhotoAction={handlePhotoTaskAction}
                                            onBooleanAction={handleBooleanTaskAction}
                                            onOpinionAction={handleOpinionTaskAction}
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
                "fixed right-4 z-[60] transition-all duration-300 md:right-8", 
                isBottomNavVisible ? "bottom-20" : "bottom-6"
            )}>
                <div className="relative">
                    <Button
                        size="lg"
                        className="rounded-full shadow-2xl h-16 w-16 bg-primary hover:bg-primary/90 text-primary-foreground transition-transform active:scale-95"
                        onClick={handleSubmitReport}
                        disabled={isSubmitting || syncStatus === 'server-newer'}
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
