'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import { dataStore } from '@/lib/data-store';
import type { TaskCompletion, TasksByShift, CompletionRecord, ShiftReport, TaskSection, Task } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/pro-toast';
import { useAuth } from '@/hooks/use-auth';
import { Send, ArrowLeft, Loader2, CheckCircle, WifiOff, CloudDownload, UploadCloud, ChevronsDownUp, Droplets, UtensilsCrossed, Wind } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import CameraDialog from '@/components/camera-dialog';
import OpinionDialog from '@/components/opinion-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { Badge } from '@/components/ui/badge';
import { photoStore } from '@/lib/photo-store';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TaskItem } from '../../../_components/task-item';
import SubmissionNotesSection from '../../../checklist/_components/submission-notes-section';
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
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeCompletionIndex, setActiveCompletionIndex] = useState<number | null>(null);
    
  const [tasks, setTasks] = useState<TaskSection[] | null>(null);

  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const [openAccordionItems, setOpenAccordionItems] = useState<string[]>([]);
  const { openLightbox } = useLightbox();

  // Initialize accordion state to be all open by default
  useEffect(() => {
    if (tasks) {
      setOpenAccordionItems(tasks.map(section => section.title));
    }
  }, [tasks]);

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
            if(status === 'local-newer') {
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

  const handleOpinionClose = useCallback(() => {
    setIsOpinionOpen(false);
    setActiveTask(null);
  }, []);

    const handlePhotoTaskAction = (task: Task, completionIndex: number | null = null) => {
        setActiveTask(task);
        setActiveCompletionIndex(completionIndex);
        setIsCameraOpen(true);
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

    const handleOpinionTaskAction = (task: Task) => {
        setActiveTask(task);
        setIsOpinionOpen(true);
    }
  
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
              completionToUpdate.photoIds = (completionToUpdate.photoIds ?? []).filter((p:string) => p !== photoId);
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
    switch(title) {
        case 'Vệ sinh quầy bar': return <UtensilsCrossed className="mr-3 h-5 w-5 text-orange-500" />;
        case 'Vệ sinh máy móc': return <Wind className="mr-3 h-5 w-5 text-blue-500" />;
        case 'Vệ sinh khu vực chung': return <Droplets className="mr-3 h-5 w-5 text-cyan-500" />;
        default: return null;
    }
  }

  const getSectionBorderColor = (title: string) => {
    switch(title) {
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

  const handleToggleAll = () => {
    if (!tasks) return;
    if (openAccordionItems.length === tasks.length) {
      setOpenAccordionItems([]);
    } else {
      setOpenAccordionItems(tasks.map(s => s.title));
    }
  };
  
  if (isAuthLoading || isLoading || !report || !tasks) {
      return <LoadingPage />;
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

  const areAllSectionsOpen = tasks && openAccordionItems.length === tasks.length;

  return (
    <TooltipProvider>
    <div className={cn("container mx-auto max-w-2xl p-4 sm:p-6 md:p-8 pb-32", !isStandalone && "p-0 sm:p-0 md:p-0")}>
      <header className="mb-8">
        <div className="flex justify-between items-center mb-4">
            {isStandalone && (
                <Button variant="ghost" className="-ml-4" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại
                </Button>
            )}
            <div className="flex items-center gap-2">
                 {getSyncBadge()}
            </div>
        </div>
        <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
            <div>
                 <h1 className="text-2xl md:text-3xl font-bold font-headline">Báo cáo vệ sinh</h1>
                 <p className="text-muted-foreground">Dành cho bộ phận Pha chế (Bartender)</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleToggleAll} className="w-full sm:w-auto">
                <ChevronsDownUp className="mr-2 h-4 w-4"/>
                {areAllSectionsOpen ? 'Thu gọn tất cả' : 'Mở rộng tất cả'}
            </Button>
        </div>
      </header>

      <div className="space-y-4">
         <Accordion type="multiple" value={openAccordionItems} onValueChange={setOpenAccordionItems} className="w-full space-y-4">
            {tasks.map((section) => {
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
                            isReadonly={isSubmitting}
                            isExpanded={expandedTaskIds.has(task.id)}
                            isSingleCompletion={false}
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
            isReadonly={isSubmitting}
            isHighlighted={notesError}
        />
      </div>
    </div>
    
    <div className={cn("fixed bottom-4 right-4 z-50 md:bottom-6 md:right-6", !isStandalone && "bottom-20")}>
        <div className="relative">
            <Button
                size="lg"
                className="rounded-full shadow-lg h-16 w-16"
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
