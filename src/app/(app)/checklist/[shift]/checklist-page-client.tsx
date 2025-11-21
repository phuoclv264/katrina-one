'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import type { TaskCompletion, TasksByShift, CompletionRecord, ShiftReport, Task, Schedule } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/hooks/use-auth';
import { Send, ArrowLeft, Activity, Loader2, Save, CheckCircle, WifiOff, CloudDownload, UploadCloud, ChevronsDownUp, Sunrise, Sunset, MessageSquareWarning, ShieldAlert } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import CameraDialog from '@/components/camera-dialog';
import OpinionDialog from '@/components/opinion-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { photoStore } from '@/lib/photo-store';
import { TooltipProvider } from '@/components/ui/tooltip';
import { format, set, getISOWeek, isSameDay } from 'date-fns';
import SubmissionNotesSection from '../_components/submission-notes-section';
import { cn } from '@/lib/utils';
import { TaskItem } from '../../_components/task-item';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useLightbox } from '@/contexts/lightbox-context';

type SyncStatus = 'checking' | 'synced' | 'local-newer' | 'server-newer' | 'error';

const shiftTimeFrames: { [key: string]: { start: string; end: string } } = {
  sang: { start: '05:30', end: '12:00' },
  trua: { start: '12:00', end: '17:00' },
  toi: { start: '17:00', end: '22:30' },
};

export default function ChecklistPageComponent() {
  const { openLightbox } = useLightbox();
  const { user, loading: isAuthLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const shiftKey = params.shift as string;
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
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeCompletionIndex, setActiveCompletionIndex] = useState<number | null>(null);
    
  const [tasksByShift, setTasksByShift] = useState<TasksByShift | null>(null);
  const shift = tasksByShift ? tasksByShift[shiftKey] : null;

  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const [openAccordionItems, setOpenAccordionItems] = useState<string[]>([]);

  const [isReadonly, setIsReadonly] = useState(true);
  const [isReadonlyChecked, setIsReadonlyChecked] = useState(false);

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


  // Initialize accordion state based on completion status on load
  useEffect(() => {
    if (shift && report) {
      const endShiftSection = shift.sections.find(s => s.title === 'Cuối ca');
      const inShiftSection = shift.sections.find(s => s.title === 'Trong ca');

      let hasCompletedEndShiftTask = false;
      if (endShiftSection) {
        hasCompletedEndShiftTask = endShiftSection.tasks.some(task => report.completedTasks[task.id]?.length > 0);
      }

      if (hasCompletedEndShiftTask) {
        setOpenAccordionItems(['Cuối ca']);
        return;
      }

      let hasCompletedInShiftTask = false;
      if (inShiftSection) {
        hasCompletedInShiftTask = inShiftSection.tasks.some(task => report.completedTasks[task.id]?.length > 0);
      }
      
      if (hasCompletedInShiftTask) {
          setOpenAccordionItems(['Trong ca', 'Cuối ca']);
          return;
      }
      
      // Default: open all
      setOpenAccordionItems(shift.sections.map(section => section.title));
    }
  }, [shift, report]);

  const handleProgressiveCollapse = useCallback((completedTaskId: string) => {
    if (!shift) return;

    const completedTaskSection = shift.sections.find(s => s.tasks.some(t => t.id === completedTaskId));
    if (!completedTaskSection) return;

    const sectionTitle = completedTaskSection.title;

    if (sectionTitle === 'Trong ca') {
        setOpenAccordionItems(prev => prev.filter(item => item !== 'Đầu ca'));
    } else if (sectionTitle === 'Cuối ca') {
        setOpenAccordionItems(prev => prev.filter(item => item !== 'Đầu ca' && item !== 'Trong ca'));
    }
  }, [shift]);

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
            if(isMounted) setIsLoading(false);
        }
      } else {
        // Normal mode: compare local and server versions
        try {
            const { report: loadedReport, status } = await dataStore.getOrCreateReport(user.uid, user.displayName || 'Nhân viên', shiftKey);
            if(isMounted) {
              setReport(loadedReport);
              setSubmissionNotes(loadedReport.issues || '');
              setSyncStatus(status);
              if (status === 'local-newer' || status === 'server-newer') {
                  setShowSyncDialog(true);
              }
               if(status === 'local-newer') {
                setHasUnsubmittedChanges(true);
            }
            }
        } catch (error) {
            console.error("Error loading report:", error);
            if(isMounted) {
              setSyncStatus('error');
              toast.error("Lỗi tải dữ liệu. Không thể tải hoặc đồng bộ báo cáo.");
            }
        } finally {
            if(isMounted) setIsLoading(false);
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
        handleProgressiveCollapse(taskId);
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
        handleProgressiveCollapse(activeTask.id);
        handleOpinionClose();
    }
  
  const handleCapturePhotos = useCallback(async (media: { id: string; type: 'photo' | 'video' }[]) => {
        if (!activeTask) return;

        // Vì captureMode="photo", chúng ta có thể tự tin rằng tất cả media đều là ảnh.
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
        
        if(completionIndex === null) { // This is a new completion
          handleProgressiveCollapse(taskId);
        }
        
        handleCameraClose();
    }, [activeTask, activeCompletionIndex, updateLocalReport, handleCameraClose, handleProgressiveCollapse]);
  
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
            completionToUpdate.photoIds = (completionToUpdate.photoIds ?? []).filter((p:string) => p !== photoId);
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

      if(completionToDelete.photoIds) {
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
    switch(title) {
        case 'Đầu ca': return <Sunrise className="mr-3 h-5 w-5 text-yellow-500" />;
        case 'Trong ca': return <Activity className="mr-3 h-5 w-5 text-sky-500" />;
        case 'Cuối ca': return <Sunset className="mr-3 h-5 w-5 text-indigo-500" />;
        default: return null;
    }
  }

  const getSectionBorderColor = (title: string) => {
    switch(title) {
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

  const handleToggleAll = () => {
    if (!shift) return;
    if (openAccordionItems.length === shift.sections.length) {
      setOpenAccordionItems([]);
    } else {
      setOpenAccordionItems(shift.sections.map(s => s.title));
    }
  };
  
  if (isAuthLoading || isLoading || !isReadonlyChecked || !report || !tasksByShift || !shift) {
      return (
        <div className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8">
            <header className="mb-8">
                <Skeleton className="h-8 w-48 mb-4" />
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-5 w-1/2 mt-2" />
            </header>
            <div className="space-y-8">
                <Skeleton className="h-96 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        </div>
    )
  }
  
  const getSyncBadge = () => {
    switch(syncStatus) {
        case 'synced':
            return <Badge variant="default"><CheckCircle className="mr-1.5 h-3 w-3"/>Đã đồng bộ</Badge>;
        case 'local-newer':
            return <Badge variant="secondary"><UploadCloud className="mr-1.5 h-3 w-3 text-blue-500"/>Có thay đổi chưa gửi</Badge>;
        case 'server-newer':
            return <Badge variant="secondary"><CloudDownload className="mr-1.5 h-3 w-3 text-green-500"/>Có bản mới trên máy chủ</Badge>;
        case 'checking':
            return <Badge variant="outline"><Loader2 className="mr-1.5 h-3 w-3 animate-spin"/>Đang kiểm tra</Badge>;
        case 'error':
             return <Badge variant="destructive"><WifiOff className="mr-1.5 h-3 w-3"/>Lỗi đồng bộ</Badge>;
        default:
            return null;
    }
  }

  const areAllSectionsOpen = shift && openAccordionItems.length === shift.sections.length;

  return (
    <TooltipProvider>
    <div className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8 pb-32">
      <header className="mb-8">
        <div className="flex justify-between items-center mb-4">
            <Button variant="ghost" className="-ml-4" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại
            </Button>
            <div className="flex items-center gap-2">
                 {getSyncBadge()}
            </div>
        </div>
        <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
            <div>
                 <h1 className="text-2xl md:text-3xl font-bold font-headline">Checklist: {shift.name}</h1>
                 <p className="text-muted-foreground">Mọi thay đổi sẽ được lưu cục bộ trên thiết bị này.</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleToggleAll} className="w-full sm:w-auto">
                <ChevronsDownUp className="mr-2 h-4 w-4"/>
                {areAllSectionsOpen ? 'Thu gọn tất cả' : 'Mở rộng tất cả'}
            </Button>
        </div>
      </header>

      {isReadonly && (
        <Alert variant="destructive" className="mb-6">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Chế độ chỉ xem</AlertTitle>
            <AlertDescription>
                Đã hết thời gian làm việc cho ca này. Bạn không thể thực hiện thêm thay đổi nào.
            </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
         <Accordion type="multiple" value={openAccordionItems} onValueChange={setOpenAccordionItems} className="w-full space-y-4">
            {shift.sections.map((section) => {
            const isSingleCompletionSection = section.title === 'Đầu ca' || section.title === 'Cuối ca';
            return (
            <AccordionItem value={section.title} key={section.title} className={cn('rounded-lg border-[3px] bg-card', getSectionBorderColor(section.title))}>
                <AccordionTrigger className="text-lg font-bold p-4 hover:no-underline">
                    <div className="flex items-center">
                    {getSectionIcon(section.title)}
                    {section.title}
                    </div>
                </AccordionTrigger>
                <AccordionContent className="border-t p-4">
                <div className="space-y-4 pt-2">
                    {section.tasks.map((task) => (
                         <TaskItem
                            key={task.id}
                            task={task}
                            completions={(report.completedTasks[task.id] || []) as CompletionRecord[]}
                            isReadonly={isReadonly || isSubmitting}
                            isExpanded={expandedTaskIds.has(task.id)}
                            isSingleCompletion={isSingleCompletionSection}
                            onPhotoAction={handlePhotoTaskAction}
                            onBooleanAction={handleBooleanTaskAction}
                            onOpinionAction={handleOpinionTaskAction}
                            onDeleteCompletion={handleDeleteCompletion}
                            onDeletePhoto={handleDeletePhoto}
                            onToggleExpand={toggleExpandTask}
                            onOpenLightbox={openLightbox}
                        />
                    ))}
                </div>
                </AccordionContent>
            </AccordionItem>
            )
            })}
        </Accordion>
        <SubmissionNotesSection 
            ref={notesSectionRef}
            initialNotes={submissionNotes}
            onNotesChange={handleNotesChange}
            isReadonly={isReadonly}
            isHighlighted={notesError}
        />
      </div>
    </div>
    
    {!isReadonly && (
        <div className="fixed bottom-4 right-4 z-50 md:bottom-6 md:right-6">
        <div className="relative">
            <Button
                size="lg"
                className="rounded-full shadow-lg h-16 w-16"
                onClick={handleSubmitReport}
                disabled={isReadonly || isSubmitting || syncStatus === 'server-newer'}
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
    )}

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
    />
    
    <AlertDialog open={showSyncDialog && !isSubmitting} onOpenChange={setShowSyncDialog}>
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