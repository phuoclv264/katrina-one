'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import Image from 'next/image';
import { useRouter } from 'nextjs-toploader/app';
import { dataStore } from '@/lib/data-store';
import type { ShiftReport, CompletionRecord, ComprehensiveTaskSection, ComprehensiveTask, Task } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/hooks/use-auth';
import { Camera, Send, ArrowLeft, Clock, X, Trash2, AlertCircle, Loader2, CheckCircle, WifiOff, CloudDownload, UploadCloud, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, Check, Building, MessageSquare, ChevronsDownUp, FilePen, FilePlus2 } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import CameraDialog from '@/components/camera-dialog';
import OpinionDialog from '@/components/opinion-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { Badge } from '@/components/ui/badge';
import { photoStore } from '@/lib/photo-store';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TaskItem } from '../../_components/task-item';
import SubmissionNotesSection from '../../checklist/_components/submission-notes-section';
import { format, getISOWeek } from 'date-fns';
import WorkShiftGuard from '@/components/work-shift-guard';
import { useLightbox } from '@/contexts/lightbox-context';

type SyncStatus = 'checking' | 'synced' | 'local-newer' | 'server-newer' | 'error';

function ComprehensiveReportPageComponent() {
  const { user, loading: isAuthLoading } = useAuth();
  const router = useRouter();
  // To prevent useEffect loops, we store the router in a ref.
  // The ref object is stable across renders, and we can access the
  // current router instance via routerRef.current inside effects
  // without needing to add it as a dependency.
  const routerRef = useRef(router);
  routerRef.current = router;
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
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeCompletionIndex, setActiveCompletionIndex] = useState<number | null>(null);
  
  const [tasks, setTasks] = useState<ComprehensiveTaskSection[] | null>(null);

  const [openAccordionItems, setOpenAccordionItems] = useState<string[]>([]);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const { openLightbox } = useLightbox();

  // Initialize accordion to be all open by default
  useEffect(() => {
    if (tasks) {
      setOpenAccordionItems(tasks.map(section => section.title));
    }
  }, [tasks]);

  useEffect(() => {
    if (!isAuthLoading && user && (user.role !== 'Quản lý' && user.role !== 'Chủ nhà hàng' && !user.secondaryRoles?.includes('Quản lý'))) {
      routerRef.current.replace('/');
    }
  }, [isAuthLoading, user]);

  useEffect(() => {
    let isMounted = true;
    const unsubscribeTasks = dataStore.subscribeToComprehensiveTasks((managerTasks) => {
      if(isMounted) setTasks(managerTasks);
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
            console.error("Error loading comprehensive report:", error);
            if(isMounted) {
              setSyncStatus('error');
              toast.error("Lỗi tải dữ liệu, không thể tải báo cáo. Đang chuyển hướng bạn về trang tổng quan.");
              routerRef.current.replace('/manager');
            }
        } finally {
            if(isMounted) setIsLoading(false);
        }
    };

    loadReport();
    return () => { isMounted = false; }
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
    setSubmissionNotes(notes);
    updateLocalReport(prevReport => ({ ...prevReport, issues: notes }));
  }, [updateLocalReport]);

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
  }

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

    const handleCapturePhotos = useCallback(async (media: { id: string; type: 'photo' | 'video' }[]) => {
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
                taskCompletions[completionIndex] = completionToUpdate;
            } else {
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
    
  const handleToggleAll = () => {
    if (!tasks) return;
    if (openAccordionItems.length === tasks.length) {
      setOpenAccordionItems([]);
    } else {
      setOpenAccordionItems(tasks.map(s => s.title));
    }
  };
  
  const isReadonly = isSubmitting;
  
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
                 <h1 className="text-2xl md:text-3xl font-bold font-headline">Phiếu kiểm tra toàn diện</h1>
                 <p className="text-muted-foreground">Thực hiện và ghi nhận các công việc kiểm tra trong ngày.</p>
            </div>
             <Button variant="outline" size="sm" onClick={handleToggleAll} className="w-full sm:w-auto">
                <ChevronsDownUp className="mr-2 h-4 w-4"/>
                {areAllSectionsOpen ? 'Thu gọn tất cả' : 'Mở rộng tất cả'}
            </Button>
        </div>
      </header>

      <div className="space-y-4">
        <Accordion type="multiple" value={openAccordionItems} onValueChange={setOpenAccordionItems} className="w-full space-y-4">
            {tasks.map((section) => (
            <AccordionItem value={section.title} key={section.title} className="rounded-lg border-[3px] bg-card border-primary/50">
                <div className="sticky top-14 bg-card/95 rounded-lg">
                    <AccordionTrigger className="text-lg font-bold p-4 hover:no-underline">
                        <div className="flex items-center">
                        <Building className="mr-3 h-5 w-5 text-primary" />
                        {section.title}
                        </div>
                    </AccordionTrigger>
                </div>
                <AccordionContent className="border-t p-4">
                <div className="space-y-4 pt-2">
                    {section.tasks.map((task) => (
                        <TaskItem
                            key={task.id}
                            task={task as unknown as Task}
                            completions={(report.completedTasks[task.id] || []) as CompletionRecord[]}
                            isReadonly={isReadonly}
                            isSingleCompletion={false}
                            isExpanded={expandedTaskIds.has(task.id)}
                            onPhotoAction={handlePhotoTaskAction as (task: Task, completionIndex?: number | null) => void}
                            onBooleanAction={handleBooleanTaskAction}
                            onOpinionAction={handleOpinionTaskAction as (task: Task) => void}
                            onDeleteCompletion={handleDeleteCompletion}
                            onDeletePhoto={handleDeletePhoto}
                            onToggleExpand={toggleExpandTask}
                            onOpenLightbox={openLightbox}
                        />
                    ))}
                </div>
                </AccordionContent>
            </AccordionItem>
            ))}
        </Accordion>
         <SubmissionNotesSection 
            initialNotes={submissionNotes}
            onNotesChange={handleNotesChange}
            isReadonly={isReadonly}
        />
      </div>
    </div>
    
    <div className="fixed bottom-4 right-4 z-50 md:bottom-6 md:right-6">
        <div className="relative">
            <Button
              size="lg"
              className="rounded-full shadow-lg h-16 w-16"
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

export default function ComprehensiveReportPage() {
    return (
        <WorkShiftGuard redirectPath="/manager">
            <ComprehensiveReportPageComponent />
        </WorkShiftGuard>
    )
}
