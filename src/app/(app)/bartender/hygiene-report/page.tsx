
'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import type { TaskCompletion, TasksByShift, CompletionRecord, ShiftReport, TaskSection, Task } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Camera, Send, ArrowLeft, Clock, X, Trash2, AlertCircle, Activity, Loader2, Save, CheckCircle, WifiOff, CloudDownload, UploadCloud, ChevronDown, ChevronUp, Droplets, UtensilsCrossed, Wind, ChevronsDownUp, FilePlus2, ThumbsUp, ThumbsDown, FilePen } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import CameraDialog from '@/components/camera-dialog';
import OpinionDialog from '@/components/opinion-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import SubmissionNotesDialog from '@/components/submission-notes-dialog';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/plugins/counter.css";
import Captions from "yet-another-react-lightbox/plugins/captions";
import "yet-another-react-lightbox/plugins/captions.css";
import { photoStore } from '@/lib/photo-store';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type SyncStatus = 'checking' | 'synced' | 'local-newer' | 'server-newer' | 'error';

export default function HygieneReportPage() {
  const { toast } = useToast();
  const { user, loading: isAuthLoading } = useAuth();
  const router = useRouter();
  const shiftKey = 'bartender_hygiene';
  
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasUnsubmittedChanges, setHasUnsubmittedChanges] = useState(false);
  
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('checking');
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [isSubmissionNotesOpen, setIsSubmissionNotesOpen] = useState(false);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isOpinionOpen, setIsOpinionOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeCompletionIndex, setActiveCompletionIndex] = useState<number | null>(null);
    
  const [tasks, setTasks] = useState<TaskSection[] | null>(null);

  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const [openAccordionItems, setOpenAccordionItems] = useState<string[]>([]);
  
  const [localPhotoUrls, setLocalPhotoUrls] = useState<Map<string, string>>(new Map());


  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Initialize accordion state to be all open by default
  useEffect(() => {
    if (tasks) {
      setOpenAccordionItems(tasks.map(section => section.title));
    }
  }, [tasks]);

    const fetchLocalPhotos = useCallback(async (currentReport: ShiftReport | null) => {
        if (!currentReport) return;

        const allPhotoIds = new Set<string>();
        for (const taskId in currentReport.completedTasks) {
            for (const completion of currentReport.completedTasks[taskId]) {
                if (completion.photoIds) {
                    completion.photoIds.forEach(id => {
                        if (!localPhotoUrls.has(id)) {
                           allPhotoIds.add(id)
                        }
                    });
                }
            }
        }

        if (allPhotoIds.size === 0) {
            return;
        }

        const urls = await photoStore.getPhotosAsUrls(Array.from(allPhotoIds));
        setLocalPhotoUrls(prevUrls => new Map([...prevUrls, ...urls]));
    }, [localPhotoUrls]);

  // --- Data Loading and Initialization ---
  useEffect(() => {
    if (!isAuthLoading && (!user || user.role !== 'Pha chế')) {
      router.replace('/');
    }
  }, [isAuthLoading, user, router]);

  useEffect(() => {
    const unsubscribeTasks = dataStore.subscribeToBartenderTasks((bartenderTasks) => {
      setTasks(bartenderTasks);
    });
    return () => unsubscribeTasks();
  }, []);

  useEffect(() => {
    if (isAuthLoading || !user) return;
    
    const loadReport = async () => {
        setIsLoading(true);
        setSyncStatus('checking');
        try {
            const { report: loadedReport, status } = await dataStore.getOrCreateReport(user.uid, user.displayName || 'Nhân viên', shiftKey);
            setReport(loadedReport);
            await fetchLocalPhotos(loadedReport); // Fetch photos right after setting report
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
            toast({
                title: "Lỗi tải dữ liệu",
                description: "Không thể tải hoặc đồng bộ báo cáo. Vui lòng thử lại.",
                variant: "destructive"
            });
        }
        setIsLoading(false);
    };

    loadReport();
  }, [isAuthLoading, user, shiftKey, toast, fetchLocalPhotos]);

  const allPagePhotos = useMemo(() => {
    if (!tasks || !report) return [];

    const findTaskText = (taskId: string): string => {
        for (const section of tasks) {
            const task = section.tasks.find(t => t.id === taskId);
            if (task) return task.text;
        }
        return "Nhiệm vụ không xác định";
    };

    const photos: { src: string, description: string }[] = [];
    for (const taskId in report.completedTasks) {
        const taskText = findTaskText(taskId);
        const completions = report.completedTasks[taskId] as CompletionRecord[];
        for (const completion of completions) {
             const combinedPhotos = [
                ...(completion.photoIds || []).map(id => localPhotoUrls.get(id)),
                ...(completion.photos || [])
            ].filter((url): url is string => !!url);

            for(const photoUrl of combinedPhotos) {
                 photos.push({
                    src: photoUrl,
                    description: `${taskText}\nThực hiện lúc: ${completion.timestamp}`
                });
            }
        }
    }
    return photos;
  }, [tasks, report, localPhotoUrls]);

  const updateLocalReport = useCallback((updater: (prevReport: ShiftReport) => ShiftReport) => {
    setReport(prevReport => {
        if (!prevReport) return null;
        const newReport = updater(prevReport);

        (async () => {
            await fetchLocalPhotos(newReport); // Refresh photo URLs after every local update
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
  }, [fetchLocalPhotos]);

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
            const newReport = { ...prevReport, completedTasks: { ...prevReport.completedTasks } };
            let taskCompletions = [...(newReport.completedTasks[taskId] as CompletionRecord[]) || []];
            
            const newCompletion: CompletionRecord = {
                timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                value: value,
            };

            taskCompletions.unshift(newCompletion);
            newReport.completedTasks[taskId] = taskCompletions;
            return newReport;
        });
    };

    const handleOpinionTaskAction = (task: Task) => {
        setActiveTask(task);
        setIsOpinionOpen(true);
    }
  
    const handleSaveOpinion = (opinionText: string) => {
        if (!activeTask) return;
        const taskId = activeTask.id;

        updateLocalReport(prevReport => {
            const newReport = { ...prevReport, completedTasks: { ...prevReport.completedTasks } };
            let taskCompletions = [...(newReport.completedTasks[taskId] as CompletionRecord[]) || []];
            
            const newCompletion: CompletionRecord = {
                timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                opinion: opinionText.trim() || undefined,
            };

            taskCompletions.unshift(newCompletion);
            newReport.completedTasks[taskId] = taskCompletions;
            return newReport;
        });
        
        handleOpinionClose();
    }

    const handleCapturePhotos = useCallback((photoIds: string[]) => {
        if (!activeTask) return;
        const taskId = activeTask.id;
        const completionIndex = activeCompletionIndex;

        updateLocalReport(prevReport => {
            const newReport = { ...prevReport, completedTasks: { ...prevReport.completedTasks } };
            let taskCompletions = [...(newReport.completedTasks[taskId] as CompletionRecord[] || [])];

            if (completionIndex !== null && taskCompletions[completionIndex]) {
                const completionToUpdate = { ...taskCompletions[completionIndex] };
                completionToUpdate.photoIds = [...(completionToUpdate.photoIds || []), ...photoIds];
                taskCompletions[completionIndex] = completionToUpdate;
            } else {
                taskCompletions.unshift({
                    timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                    photoIds: photoIds,
                    photos: [],
                });
            }
            
            newReport.completedTasks[taskId] = taskCompletions;
            return newReport;
        });
        
        handleCameraClose();
    }, [activeTask, activeCompletionIndex, updateLocalReport, handleCameraClose]);
  
  const handleDeletePhoto = async (taskId: string, completionIndex: number, photoId: string, isLocal: boolean) => {
       if (isLocal) {
          const photoUrl = localPhotoUrls.get(photoId);
          if (photoUrl) URL.revokeObjectURL(photoUrl);
          setLocalPhotoUrls(prev => {
              const newMap = new Map(prev);
              newMap.delete(photoId);
              return newMap;
          });
          await photoStore.deletePhoto(photoId);
      } else {
          await dataStore.deletePhotoFromStorage(photoId);
      }

      updateLocalReport(prevReport => {
          const newReport = { ...prevReport, completedTasks: { ...prevReport.completedTasks } };
          const taskCompletions = [...(newReport.completedTasks[taskId] || [])];
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
              delete newReport.completedTasks[taskId];
          } else {
              newReport.completedTasks[taskId] = taskCompletions;
          }
          
          return newReport;
      });
  };

  const handleDeleteCompletion = async (taskId: string, completionIndex: number) => {
      if (!report) return;
      
      const completionToDelete = report.completedTasks[taskId]?.[completionIndex];
      if (!completionToDelete) return;

      if(completionToDelete.photoIds) {
        completionToDelete.photoIds.forEach(id => {
             const photoUrl = localPhotoUrls.get(id);
             if (photoUrl) URL.revokeObjectURL(photoUrl);
        });
        await photoStore.deletePhotos(completionToDelete.photoIds);
      }
      if (completionToDelete.photos) {
        await Promise.all(completionToDelete.photos.map(url => dataStore.deletePhotoFromStorage(url)));
      }

      updateLocalReport(prevReport => {
          const newReport = { ...prevReport, completedTasks: { ...prevReport.completedTasks } };
          const taskCompletions = [...(newReport.completedTasks[taskId] || [])];
          taskCompletions.splice(completionIndex, 1);

          if (taskCompletions.length > 0) {
              newReport.completedTasks[taskId] = taskCompletions;
          } else {
              delete newReport.completedTasks[taskId];
          }
          return newReport;
      });
  }
  
    const handleSubmitReport = async (notes: string) => {
        if (!report) return;
        const startTime = Date.now();
        setIsSubmitting(true);
        setShowSyncDialog(false);
        setIsSubmissionNotesOpen(false);
        toast({
            title: "Đang gửi báo cáo...",
            description: "Vui lòng đợi, quá trình này có thể mất vài phút.",
        });

        const finalReport = { ...report, issues: notes || null };

        try {
            await dataStore.submitReport(finalReport);
            const serverReport = await dataStore.overwriteLocalReport(report.id);
            setReport(serverReport);
            await fetchLocalPhotos(serverReport);
            setSyncStatus('synced');
            setHasUnsubmittedChanges(false);
            const endTime = Date.now();
            const duration = ((endTime - startTime) / 1000).toFixed(2);
            toast({
                title: "Gửi báo cáo thành công!",
                description: `Báo cáo đã được đồng bộ. (Thời gian: ${duration} giây)`,
            });
        } catch (error) {
            console.error("Failed to submit report:", error);
            setSyncStatus('error');
            toast({
                variant: "destructive",
                title: "Gửi báo cáo thất bại",
                description: "Đã xảy ra lỗi khi gửi báo cáo của bạn. Vui lòng kiểm tra kết nối mạng và thử lại.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };
    
  const handleDownloadFromServer = async () => {
      if (!report) return;
      setIsSubmitting(true);
      setShowSyncDialog(false);
       toast({
            title: "Đang tải dữ liệu từ máy chủ...",
        });
      try {
        const serverReport = await dataStore.overwriteLocalReport(report.id);
        setReport(serverReport);
        await fetchLocalPhotos(serverReport);
        setSyncStatus('synced');
        setHasUnsubmittedChanges(false);
         toast({
            title: "Tải thành công!",
            description: "Báo cáo đã được cập nhật với phiên bản mới nhất từ máy chủ.",
        });
      } catch (error) {
         console.error("Failed to download report:", error);
         setSyncStatus('error');
         toast({
            variant: "destructive",
            title: "Tải thất bại",
            description: "Không thể tải dữ liệu từ máy chủ. Vui lòng thử lại.",
        });
      } finally {
        setIsSubmitting(false);
      }
  }
  
  const getSectionIcon = (title: string) => {
    switch(title) {
        case 'Vệ sinh khu vực pha chế': return <Droplets className="mr-3 h-5 w-5 text-blue-500" />;
        case 'Vệ sinh dụng cụ': return <UtensilsCrossed className="mr-3 h-5 w-5 text-green-500" />;
        case 'Vệ sinh thiết bị': return <Wind className="mr-3 h-5 w-5 text-purple-500" />;
        default: return null;
    }
  }

  const getSectionBorderColor = (title: string) => {
    switch(title) {
        case 'Vệ sinh khu vực pha chế': return 'border-blue-500/80';
        case 'Vệ sinh dụng cụ': return 'border-green-500/80';
        case 'Vệ sinh thiết bị': return 'border-purple-500/80';
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

  const openLightbox = (photoUrl: string) => {
    const photoIndex = allPagePhotos.findIndex(p => p.src === photoUrl);
    if (photoIndex > -1) {
        setLightboxIndex(photoIndex);
        setIsLightboxOpen(true);
    }
  };

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

  const areAllSectionsOpen = tasks && openAccordionItems.length === tasks.length;

  return (
    <TooltipProvider>
    <div className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8 pb-32">
      <header className="mb-8">
         <div className="flex justify-between items-center mb-4">
            <Button asChild variant="ghost" className="-ml-4">
                <Link href="/bartender">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Quay lại
                </Link>
            </Button>
            <div className="flex items-center gap-2">
                 {getSyncBadge()}
            </div>
        </div>
        <div className="flex justify-between items-start">
            <div>
                 <h1 className="text-2xl md:text-3xl font-bold font-headline">Báo cáo Vệ sinh quầy</h1>
                 <p className="text-muted-foreground">Thực hiện và ghi nhận các công việc vệ sinh trong ca.</p>
            </div>
        </div>
      </header>

      <div className="space-y-8">
        <Card>
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Danh sách công việc</CardTitle>
              <CardDescription>
                Thực hiện các công việc và ghi nhận lại. Bạn có thể thực hiện một công việc nhiều lần.
              </CardDescription>
            </div>
             <Button variant="outline" size="sm" onClick={handleToggleAll} className="w-full sm:w-auto">
                <ChevronsDownUp className="mr-2 h-4 w-4"/>
                {areAllSectionsOpen ? 'Thu gọn tất cả' : 'Mở rộng tất cả'}
            </Button>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" value={openAccordionItems} onValueChange={setOpenAccordionItems} className="w-full space-y-4">
              {tasks.map((section) => (
                <AccordionItem value={section.title} key={section.title} className={`rounded-lg border-[3px] bg-card ${getSectionBorderColor(section.title)}`}>
                  <AccordionTrigger className="text-lg font-bold p-4 hover:no-underline">
                     <div className="flex items-center">
                        {getSectionIcon(section.title)}
                        {section.title}
                     </div>
                  </AccordionTrigger>
                  <AccordionContent className="border-t p-4">
                    <div className="space-y-4 pt-2">
                      {section.tasks.map((task) => {
                        const completions = (report.completedTasks[task.id] || []) as CompletionRecord[];
                        const isTaskCompleted = completions.length > 0;
                        const isExpanded = expandedTaskIds.has(task.id);
                        
                        return (
                           <div key={task.id} className={`rounded-md border p-4 transition-colors ${isTaskCompleted ? 'bg-accent/20' : ''}`}>
                            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                              <p className="font-semibold flex-1">
                                {task.text}
                              </p>
                              <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
                                {task.type === 'photo' && (
                                  <Button 
                                    size="sm" 
                                    className="w-full active:scale-95 transition-transform"
                                    onClick={() => handlePhotoTaskAction(task)}
                                    disabled={isReadonly}
                                  >
                                      <Camera className="mr-2 h-4 w-4"/>
                                      Đã hoàn thành
                                  </Button>
                                )}
                                {task.type === 'boolean' && (
                                    <>
                                        <Button
                                            size="sm"
                                            variant={"outline"}
                                            className="w-full"
                                            onClick={() => handleBooleanTaskAction(task.id, true)}
                                            disabled={isReadonly}
                                        >
                                            <ThumbsUp className="mr-2 h-4 w-4"/> Đảm bảo
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant={"outline"}
                                            className="w-full"
                                            onClick={() => handleBooleanTaskAction(task.id, false)}
                                            disabled={isReadonly}
                                        >
                                            <ThumbsDown className="mr-2 h-4 w-4"/> Không đảm bảo
                                        </Button>
                                    </>
                                )}
                                {task.type === 'opinion' && (
                                    <Button
                                        size="sm"
                                        className="w-full"
                                        onClick={() => handleOpinionTaskAction(task)}
                                        disabled={isReadonly}
                                    >
                                        <FilePen className="mr-2 h-4 w-4"/> Ghi nhận ý kiến
                                    </Button>
                                )}
                              </div>
                            </div>
                            
                            {isTaskCompleted && (
                                <div className="mt-4 space-y-3">
                                {(isExpanded ? completions : completions.slice(0, 1)).map((completion, cIndex) => {
                                  return (
                                <div key={cIndex} className="rounded-md border bg-card p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Clock className="h-4 w-4 flex-shrink-0" />
                                            <span>Thực hiện lúc: {completion.timestamp}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {completion.value !== undefined && (
                                              <Badge variant={completion.value ? "default" : "destructive"}>
                                                {completion.value ? "Đảm bảo" : "Không đảm bảo"}
                                              </Badge>
                                            )}
                                            {!isReadonly && task.type === 'photo' && (
                                                <Button size="xs" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => handlePhotoTaskAction(task, cIndex)}>
                                                  <FilePlus2 className="h-3 w-3" />
                                                </Button>
                                            )}
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild disabled={isReadonly}>
                                                <Button size="xs" variant="ghost" className="text-destructive hover:bg-destructive/10" disabled={isReadonly}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle className="flex items-center gap-2">
                                                            <AlertCircle className="text-destructive"/>
                                                            Bạn có chắc chắn không?
                                                        </AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Hành động này sẽ xóa lần hoàn thành công việc này và tất cả các ảnh liên quan.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteCompletion(task.id, cIndex)}>Xóa</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                                        {(completion.photos || []).map((photoUrl, pIndex) => (
                                          <div key={photoUrl} className="relative z-0 overflow-hidden aspect-square rounded-md group bg-muted">
                                            <button onClick={() => openLightbox(photoUrl)} className="w-full h-full block">
                                              <Image src={photoUrl} alt={`Ảnh bằng chứng ${pIndex + 1}`} fill className="object-cover" />
                                            </button>
                                          </div>
                                        ))}
                                        {(completion.photoIds || []).map((photoId, pIndex) => {
                                          const photoUrl = localPhotoUrls.get(photoId);
                                          if (!photoUrl) return null;
                                          return (
                                            <div key={photoId} className="relative z-0 overflow-hidden aspect-square rounded-md group bg-muted">
                                              <button onClick={() => openLightbox(photoUrl)} className="w-full h-full block">
                                                <Image src={photoUrl} alt={`Ảnh bằng chứng ${pIndex + 1}`} fill className="object-cover" />
                                              </button>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <div className="absolute top-1 left-1 bg-blue-500/80 text-white rounded-full p-0.5 z-20">
                                                    <UploadCloud className="h-3 w-3" />
                                                  </div>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  <p>Ảnh chưa được gửi</p>
                                                </TooltipContent>
                                              </Tooltip>
                                              {!isReadonly && (
                                                <Button 
                                                    variant="destructive"
                                                    size="icon"
                                                    className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full z-10"
                                                    onClick={(e) => { e.stopPropagation(); handleDeletePhoto(task.id, cIndex, photoId, true); }}
                                                >
                                                    <X className="h-3 w-3" />
                                                    <span className="sr-only">Xóa ảnh</span>
                                                </Button>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                      {completion.opinion && (
                                        <p className="text-sm italic bg-muted p-3 rounded-md border">"{completion.opinion}"</p>
                                      )}
                                </div>
                                )})}
                                {completions.length > 1 && (
                                    <Button variant="link" size="sm" onClick={() => toggleExpandTask(task.id)} className="w-full text-muted-foreground">
                                        {isExpanded ? 'Thu gọn' : `Xem thêm (${completions.length - 1})`}
                                        {isExpanded ? <ChevronUp className="ml-1.5 h-4 w-4" /> : <ChevronDown className="ml-1.5 h-4 w-4" />}
                                    </Button>
                                )}
                                </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
                )
              )}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
    
    <div className="fixed bottom-4 right-4 z-50 md:bottom-6 md:right-6">
      <div className="relative">
        <Button
            size="lg"
            className="rounded-full shadow-lg h-16 w-16"
            onClick={() => setIsSubmissionNotesOpen(true)}
            disabled={isReadonly || syncStatus === 'server-newer'}
            aria-label="Gửi báo cáo"
        >
            <Send className="h-6 w-6" />
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
    />

    <OpinionDialog
        isOpen={isOpinionOpen}
        onClose={handleOpinionClose}
        onSubmit={handleSaveOpinion}
        taskText={activeTask?.text || ''}
    />
    
    <SubmissionNotesDialog
        isOpen={isSubmissionNotesOpen}
        onClose={() => setIsSubmissionNotesOpen(false)}
        onSubmit={handleSubmitReport}
        isSubmitting={isSubmitting}
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
                    <AlertDialogAction onClick={() => setIsSubmissionNotesOpen(true)}>Gửi ngay</AlertDialogAction>
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

    <Lightbox
        open={isLightboxOpen}
        close={() => setIsLightboxOpen(false)}
        slides={allPagePhotos}
        index={lightboxIndex}
        plugins={[Zoom, Counter, Captions]}
        zoom={{ maxZoomPixelRatio: 4 }}
        counter={{ container: { style: { top: "unset", bottom: 0 } } }}
        captions={{ 
            showToggle: true, 
            descriptionTextAlign: 'center',
            descriptionMaxLines: 5
        }}
    />
    </TooltipProvider>
  );
}

    
