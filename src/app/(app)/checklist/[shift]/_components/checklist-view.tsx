'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import { dataStore } from '@/lib/data-store';
import type { TaskCompletion, TasksByShift, CompletionRecord, ShiftReport, Task } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/pro-toast';
import { useAuth } from '@/hooks/use-auth';
import { Send, ArrowLeft, Activity, Loader2, CheckCircle, WifiOff, CloudDownload, UploadCloud, ChevronsDownUp, Sunrise, Sunset, ShieldAlert, Star, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, MessageSquare, Check, LayoutGrid, ListChecks, AlertTriangle } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, AnimatePresence } from 'framer-motion';
import CameraDialog from '@/components/camera-dialog';
import OpinionDialog from '@/components/opinion-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { Badge } from '@/components/ui/badge';
import { photoStore } from '@/lib/photo-store';
import { TooltipProvider } from '@/components/ui/tooltip';
import { format, set } from 'date-fns';
import { vi } from 'date-fns/locale';
import SubmissionNotesSection from '../../_components/submission-notes-section';
import { cn } from '@/lib/utils';
import { TaskItem } from '../../../_components/task-item';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useLightbox } from '@/contexts/lightbox-context';
import { useRouter } from 'nextjs-toploader/app';

type SyncStatus = 'checking' | 'synced' | 'local-newer' | 'server-newer' | 'error';

const shiftTimeFrames: { [key: string]: { start: string; end: string } } = {
  sang: { start: '05:30', end: '12:00' },
  trua: { start: '12:00', end: '17:00' },
  toi: { start: '17:00', end: '22:30' },
};

interface ChecklistViewProps {
  shiftKey: string;
  isStandalone?: boolean;
}

export default function ChecklistView({ shiftKey, isStandalone = true }: ChecklistViewProps) {
  const { openLightbox } = useLightbox();
  const { user, loading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const notesSectionRef = useRef<HTMLTextAreaElement>(null);

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
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeCompletionIndex, setActiveCompletionIndex] = useState<number | null>(null);

  const [tasksByShift, setTasksByShift] = useState<TasksByShift | null>(null);
  const shift = tasksByShift ? tasksByShift[shiftKey] : null;

  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());

  const [isReadonly, setIsReadonly] = useState(true);
  const [isReadonlyChecked, setIsReadonlyChecked] = useState(false);

  const [activeTab, setActiveTab] = useState<string>('Đầu ca');
  const initialTabSet = useRef(false);

  // --- Derived State for UI ---
  const allTasks = shift ? shift.sections.flatMap(s => s.tasks) : [];
  const checklistTasks = allTasks.filter(t => t.type !== 'opinion');

  const totalTasksCount = checklistTasks.length;
  const completedTasksCount = checklistTasks.filter(t => {
    return (report?.completedTasks[t.id]?.length || 0) > 0;
  }).length;

  const progressPercentage = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  // Auto-set active tab on first load only: prefer the section that contains the newest completion; fallback to first incomplete section
  useEffect(() => {
    if (initialTabSet.current) return;
    if (shift && report && !isReadonly) {
      // Find the newest completion across all tasks (timestamps are 'HH:mm')
      let newestTime = -Infinity;
      let newestTaskId: string | null = null;

      Object.entries(report.completedTasks || {}).forEach(([taskId, completions]) => {
        (completions || []).forEach((c: CompletionRecord) => {
          if (!c?.timestamp) return;
          const [h, m] = c.timestamp.split(':').map(Number);
          const d = new Date();
          d.setHours(h || 0, m || 0, 0, 0);

          const t = d.getTime();
          if (t >= newestTime) {
            newestTime = t;
            newestTaskId = taskId;
          }
        });
      });

      if (newestTaskId) {
        const containingSection = shift.sections.find(s => s.tasks.some(t => t.id === newestTaskId));
        if (containingSection) {
          setActiveTab(containingSection.title);
          initialTabSet.current = true;
          return;
        }
      }

      // Fallback: set to the first incomplete section as before
      const sections = shift.sections;
      for (const section of sections) {
        const sectionTasks = section.tasks.filter(t => t.type !== 'opinion');
        const isSectionComplete = sectionTasks.length > 0 && sectionTasks.every(t => (report.completedTasks[t.id]?.length || 0) > 0);
        if (!isSectionComplete) {
          setActiveTab(section.title);
          initialTabSet.current = true;
          break;
        }
      }
    }
  }, [shift, report, isReadonly]);

  useEffect(() => {
    if (!shiftKey || !shiftTimeFrames[shiftKey]) return;
    const now = new Date();
    const [startHour, startMinute] = shiftTimeFrames[shiftKey].start.split(':').map(Number);
    const [endHour, endMinute] = shiftTimeFrames[shiftKey].end.split(':').map(Number);

    const validStartTime = set(now, { hours: startHour, minutes: startMinute, seconds: 0, milliseconds: 0 });
    validStartTime.setHours(validStartTime.getHours() - 1);

    const validEndTime = set(now, { hours: endHour, minutes: endMinute, seconds: 0, milliseconds: 0 });
    validEndTime.setHours(validEndTime.getHours() + 1);

    const readonly = now < validStartTime || now > validEndTime;
    setIsReadonly(readonly);
    setIsReadonlyChecked(true);
  }, [shiftKey]);

  // --- Data Loading and Initialization ---
  useEffect(() => {
    if (!isAuthLoading && user && (user.role !== 'Phục vụ' && !user.secondaryRoles?.includes('Phục vụ'))) {
      router.replace('/');
    }
  }, [isAuthLoading, user, router]);

  useEffect(() => {
    const unsubscribeTasks = dataStore.subscribeToTasks((tasks) => {
      setTasksByShift(tasks);
    });
    return () => unsubscribeTasks();
  }, []);

  const handleReconnect = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (isAuthLoading || !user || !shiftKey || !isReadonlyChecked) return;

    let isMounted = true;

    const loadData = async () => {
      setIsLoading(true);
      setSyncStatus('checking');

      if (isReadonly) {
        // Readonly mode: clean up local photos and fetch directly from server
        try {
          await photoStore.cleanupOldPhotos(); // Clears all photos not for today
          const serverReport = await dataStore.overwriteLocalReport(user.uid, shiftKey);
          if (isMounted) {
            setReport(serverReport);
            setSubmissionNotes(serverReport.issues || '');
            setSyncStatus('synced');
          }
        } catch (error) {
          console.warn("Could not fetch server report in readonly mode:", error);
          // Fallback: create an empty report to avoid crashing
          if (isMounted) {
            const newReport: ShiftReport = {
              id: `report-${user.uid}-${shiftKey}-${new Date().toISOString().split('T')[0]}`,
              userId: user.uid, staffName: user.displayName || 'Nhân viên', shiftKey,
              status: 'ongoing', date: new Date().toISOString().split('T')[0],
              startedAt: new Date().toISOString(), lastUpdated: new Date().toISOString(),
              completedTasks: {}, issues: null,
            };
            setReport(newReport);
            setSyncStatus('error');
            toast.error("Không thể tải báo cáo đã nộp.");
          }
        } finally {
          if (isMounted) setIsLoading(false);
        }
      } else {
        // Normal mode: compare local and server versions
        try {
          const { report: loadedReport, status } = await dataStore.getOrCreateReport(user.uid, user.displayName || 'Nhân viên', shiftKey);
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
          console.error("Error loading report:", error);
          if (isMounted) {
            setSyncStatus('error');
            toast.error("Lỗi tải dữ liệu. Không thể tải hoặc đồng bộ báo cáo.");
          }
        } finally {
          if (isMounted) setIsLoading(false);
        }
      }
    };

    loadData();
    return () => { isMounted = false; }
  }, [isAuthLoading, user, shiftKey, isReadonly, isReadonlyChecked, refreshTrigger]);

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

  const handleOpinionClose = useCallback(() => {
    setIsOpinionOpen(false);
    setActiveTask(null);
  }, []);

  const handlePhotoTaskAction = (task: Task, completionIndex: number | null = null) => {
    setActiveTask(task);
    setActiveCompletionIndex(completionIndex);
    setIsCameraOpen(true);
  };

  const handleBooleanTaskAction = async (taskId: string, value: boolean) => {
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


  const handleOpinionTaskAction = (task: Task) => {
    setActiveTask(task);
    setIsOpinionOpen(true);
  }

  const handleSaveOpinion = async (opinionText: string) => {
    if (!activeTask) return;

    updateLocalReport(prevReport => {
      const newReport = { ...prevReport };
      const newCompletedTasks = { ...newReport.completedTasks };

      const newCompletion: CompletionRecord = {
        timestamp: format(new Date(), 'HH:mm'),
        opinion: opinionText.trim() || undefined,
      };

      newCompletedTasks[activeTask.id] = [newCompletion];
      newReport.completedTasks = newCompletedTasks;
      return newReport;
    });
    handleOpinionClose();
  }

  const handleCapturePhotos = useCallback(async (media: { id: string; type: 'photo' | 'video' }[]) => {
    if (!activeTask) return;

    // Only keep photo IDs here (camera dialog can return videos as well)
    const photoIds = media.filter(m => m.type === 'photo').map(m => m.id);
    const taskId = activeTask.id;
    const completionIndex = activeCompletionIndex;

    updateLocalReport(prevReport => {
      const newReport = { ...prevReport };
      const newCompletedTasks = { ...newReport.completedTasks };
      let taskCompletions = [...(newCompletedTasks[taskId] || [])];

      // If a specific completion index was provided (user clicked "add photo" on that completion),
      // append the new photos to that completion's photoIds. Otherwise, create a new completion
      // (we keep previous completions intact so new photos do NOT replace old ones).
      if (completionIndex !== null && taskCompletions[completionIndex]) {
        const completionToUpdate = { ...taskCompletions[completionIndex] };
        completionToUpdate.photoIds = [...(completionToUpdate.photoIds || []), ...photoIds];
        taskCompletions[completionIndex] = completionToUpdate;
      } else {
        // Add a new completion at the start (most-recent-first)
        taskCompletions.unshift({
          timestamp: format(new Date(), 'HH:mm'),
          photos: [],
          photoIds: photoIds
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
      const completionToUpdate = { ...taskCompletions[completionIndex] };

      if (!completionToUpdate) return prevReport;

      if (isLocal) {
        completionToUpdate.photoIds = (completionToUpdate.photoIds ?? []).filter((p: string) => p !== photoId);
      } else {
        completionToUpdate.photos = (completionToUpdate.photos ?? []).filter((p: string) => p !== photoId);
      }

      if ((completionToUpdate.photoIds?.length || 0) === 0 && (completionToUpdate.photos?.length || 0) === 0) {
        const taskDefinition = shift?.sections.flatMap(s => s.tasks).find(t => t.id === taskId);
        if (taskDefinition?.type === 'photo') {
          taskCompletions.splice(completionIndex, 1);
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
    if (!report || !shift) return;

    // Final check before submitting
    if (isReadonly) {
      toast.error("Đã hết giờ làm việc. Bạn không thể gửi báo cáo ngoài giờ làm việc cho phép.");
      router.refresh();
      return;
    }

    // --- Validation for end-of-shift notes ---
    const endOfShiftSection = shift.sections.find(s => s.title === 'Cuối ca');
    if (endOfShiftSection) {
      const endOfShiftTaskIds = new Set(endOfShiftSection.tasks.map(t => t.id));
      const hasCompletedEndOfShiftTask = Object.keys(report.completedTasks).some(
        taskId => endOfShiftTaskIds.has(taskId) && report.completedTasks[taskId].length > 0
      );

      if (hasCompletedEndOfShiftTask && (!submissionNotes || submissionNotes.trim() === '')) {
        toast.error("Vui lòng nhập ghi chú cuối ca trước khi gửi báo cáo.");
        setNotesError(true);
        notesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }
    // --- End Validation ---

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
      case 'Đầu ca': return <Sunrise className="mr-3 h-5 w-5 text-yellow-500" />;
      case 'Trong ca': return <Activity className="mr-3 h-5 w-5 text-sky-500" />;
      case 'Cuối ca': return <Sunset className="mr-3 h-5 w-5 text-indigo-500" />;
      default: return null;
    }
  }

  const getSectionBorderColor = (title: string) => {
    switch (title) {
      case 'Đầu ca': return 'border-yellow-500/80';
      case 'Trong ca': return 'border-sky-500/80';
      case 'Cuối ca': return 'border-indigo-500/80';
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

  if (isAuthLoading || isLoading || !isReadonlyChecked || !report || !tasksByShift || !shift) {
    return <LoadingPage />;
  }

  const getSyncBadge = () => {
    switch (syncStatus) {
      case 'synced':
        return <Badge variant="default"><CheckCircle className="mr-1.5 h-3 w-3" />Đã đồng bộ</Badge>;
      case 'local-newer':
        return <Badge variant="secondary"><UploadCloud className="mr-1.5 h-3 w-3 text-blue-500" />Có thay đổi chưa gửi</Badge>;
      case 'server-newer':
        return <Badge variant="secondary"><CloudDownload className="mr-1.5 h-3 w-3 text-green-500" />Có bản mới trên máy chủ</Badge>;
      case 'checking':
        return <Badge variant="outline"><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Đang kiểm tra</Badge>;
      case 'error':
        return <Badge variant="destructive"><WifiOff className="mr-1.5 h-3 w-3" />Lỗi đồng bộ</Badge>;
      default:
        return null;
    }
  }

  const getSectionPhaseName = (title: string) => {
    switch (title) {
      case 'Đầu ca': return 'Bắt đầu';
      case 'Trong ca': return 'Đang phục vụ';
      case 'Cuối ca': return 'Kết ca';
      default: return title;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-24">
      {/* --- Sticky Header --- */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b shadow-sm">
        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <ListChecks className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight leading-none">
                  {shift.name}
                </h1>
                <p className="text-[11px] text-muted-foreground mt-1 font-medium uppercase tracking-wider">
                  {format(new Date(), 'EEEE, dd/MM', { locale: vi })}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                {syncStatus === 'checking' && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 animate-pulse">
                    <div className="w-1 h-1 bg-amber-500 rounded-full animate-ping" />
                    ĐANG LƯU
                  </span>
                )}
                {isReadonly && isReadonlyChecked && (
                  <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100 flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" />
                    CHỈ XEM
                  </span>
                )}
              </div>
              <div className="text-[10px] font-bold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                {completedTasksCount}/{totalTasksCount} HOÀN THÀNH
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center px-0.5">
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Tiến độ ca trực</span>
              <span className="text-[10px] font-black text-primary">{progressPercentage}%</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden border border-muted shadow-inner">
              <motion.div
                className="h-full bg-gradient-to-r from-primary via-primary to-primary/80"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* --- Main Content: Tabs --- */}
      <div className="flex-1 px-3 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
          <TabsList className="grid grid-cols-3 w-full h-12 p-1 bg-muted/50 rounded-xl border">
            {shift.sections.map((section) => (
              <TabsTrigger
                key={section.title}
                value={section.title}
                className="rounded-lg text-xs font-bold data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
              >
                {section.title}
              </TabsTrigger>
            ))}
          </TabsList>

          {shift.sections.map((section) => {
            const sectionTasks = section.tasks.filter(t => t.type !== 'opinion');
            const sectionOpinions = section.tasks.filter(t => t.type === 'opinion');

            return (
              <TabsContent key={section.title} value={section.title} className="mt-0 focus-visible:outline-none">
                <div className="space-y-6">
                  {/* Checklist Grid */}
                  {sectionTasks.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      {sectionTasks.map((task) => {
                        const isCompleted = (report.completedTasks[task.id]?.length || 0) > 0;

                        return (
                          <div key={task.id} className="relative">
                            {isCompleted && (
                              <div className="absolute top-2 right-2 z-10">
                                <div className="bg-green-500 rounded-full p-0.5 shadow-sm">
                                  <CheckCircle className="w-3 h-3 text-white" />
                                </div>
                              </div>
                            )}

                            <TaskItem
                              task={task}
                              completions={(report.completedTasks[task.id] || []) as CompletionRecord[]}
                              onBooleanAction={handleBooleanTaskAction}
                              onPhotoAction={handlePhotoTaskAction}
                              onOpinionAction={handleOpinionTaskAction}
                              onDeletePhoto={handleDeletePhoto}
                              onDeleteCompletion={handleDeleteCompletion}
                              onToggleExpand={toggleExpandTask}
                              isReadonly={isReadonly || isSubmitting}
                              isExpanded={expandedTaskIds.has(task.id)}
                              isSingleCompletion={section.title !== 'Trong ca' ? true : false}
                              onOpenLightbox={openLightbox}
                              className={cn(
                                "h-full border-[1.5px] transition-all duration-300 rounded-2xl",
                                isCompleted
                                  ? "border-green-500/30 bg-white shadow-[0_4px_12px_rgba(34,197,94,0.08)]"
                                  : task.isCritical
                                    ? "border-amber-500/40 bg-white shadow-[0_8px_20px_rgba(245,158,11,0.12)] active:scale-[0.98]"
                                    : "border-slate-200 bg-white shadow-[0_4px_12px_rgba(0,0,0,0.05)] active:scale-[0.98]"
                              )}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Opinions / Incidents Section */}
                  {sectionOpinions.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center gap-2 px-1">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <h3 className="text-sm font-bold text-amber-700 uppercase tracking-tight">Báo cáo & Sự cố</h3>
                      </div>
                      <div className="space-y-3">
                        {sectionOpinions.map((task) => (
                          <TaskItem
                            key={task.id}
                            task={task}
                            completions={(report.completedTasks[task.id] || []) as CompletionRecord[]}
                            onPhotoAction={handlePhotoTaskAction}
                            onBooleanAction={handleBooleanTaskAction}
                            onOpinionAction={handleOpinionTaskAction}
                            onDeleteCompletion={handleDeleteCompletion}
                            onDeletePhoto={handleDeletePhoto}
                            onToggleExpand={toggleExpandTask}
                            isReadonly={isReadonly || isSubmitting}
                            isExpanded={expandedTaskIds.has(task.id)}
                            isSingleCompletion={false}
                            onOpenLightbox={openLightbox}
                            className="bg-white border-amber-200 shadow-[0_4px_12px_rgba(245,158,11,0.08)] rounded-2xl"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            );
          })}
        </Tabs>

        {/* Notes Section - Always at bottom of content */}
        <div className="mt-8 pt-6 border-t border-dashed">
          <Card className={cn(
            "border-2 overflow-hidden transition-all duration-300",
            notesError ? "border-red-200 bg-red-50/30" : "border-primary/20 bg-primary/5"
          )}>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-primary" />
                </div>
                <h3 className="text-sm font-bold text-primary uppercase tracking-tight">Ghi chú bàn giao</h3>
              </div>
              <textarea
                ref={notesSectionRef}
                className="w-full min-h-[120px] p-3 text-sm bg-background border-2 border-primary/10 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none placeholder:text-muted-foreground/50"
                placeholder="Nhập ghi chú bàn giao cho ca sau hoặc nhắn gửi quản lý..."
                value={submissionNotes}
                onChange={(e) => handleNotesChange(e.target.value)}
                disabled={isReadonly || isSubmitting}
              />
              {notesError && (
                <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider animate-pulse">
                  Vui lòng nhập ghi chú cuối ca trước khi gửi báo cáo.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* --- Bottom Action Bar --- */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-lg border-t p-4 pb-safe-offset-4">
        <div className="max-w-md mx-auto flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-12 rounded-xl font-bold border-2"
            onClick={() => router.back()}
          >
            QUAY LẠI
          </Button>
          <Button
            className="flex-[2] h-12 rounded-xl font-black shadow-lg shadow-primary/20 text-base bg-green-600 hover:bg-green-700 text-white"
            onClick={handleSubmitReport}
            disabled={isSubmitting || isReadonly}
          >
            {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
            GỬI BÁO CÁO
          </Button>
        </div>
      </div>

      {/* Dialogs */}
      <CameraDialog
        isOpen={isCameraOpen}
        onClose={handleCameraClose}
        onSubmit={handleCapturePhotos}
        captureMode="photo"
      />

      <OpinionDialog
        isOpen={isOpinionOpen}
        onClose={handleOpinionClose}
        onSubmit={handleSaveOpinion}
        taskText={activeTask?.text || ''}
        initialValue={activeTask ? (report.completedTasks[activeTask.id]?.[0]?.opinion || '') : ''}
      />

      <AlertDialog open={showSyncDialog && !isSubmitting} onOpenChange={setShowSyncDialog}>
        <AlertDialogContent className="rounded-3xl">
          {syncStatus === 'local-newer' && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Bạn có thay đổi chưa được gửi</AlertDialogTitle>
                <AlertDialogDescription>
                  Chúng tôi phát hiện bạn có những công việc đã hoàn thành nhưng chưa được gửi đi. Bạn có muốn gửi báo cáo bổ sung ngay bây giờ không?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">Để sau</AlertDialogCancel>
                <AlertDialogAction onClick={handleSubmitReport} className="rounded-xl">Gửi ngay</AlertDialogAction>
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
                <AlertDialogCancel className="rounded-xl">Để sau</AlertDialogCancel>
                <AlertDialogAction onClick={handleDownloadFromServer} className="rounded-xl">Tải về ngay</AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

