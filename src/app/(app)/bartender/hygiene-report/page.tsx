
'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import type { TaskCompletion, TasksByShift, CompletionRecord, ShiftReport, TaskSection } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Camera, Send, ArrowLeft, Clock, X, Trash2, AlertCircle, Activity, Loader2, Save, CheckCircle, WifiOff, CloudDownload, UploadCloud, ChevronDown, ChevronUp, Droplets, UtensilsCrossed, Wind } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import CameraDialog from '@/components/camera-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import ShiftNotesCard from '@/components/shift-notes-card';
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
  
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('checking');
  const [showSyncDialog, setShowSyncDialog] = useState(false);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
    
  const [tasks, setTasks] = useState<TaskSection[] | null>(null);

  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const [openAccordionItems, setOpenAccordionItems] = useState<string[]>([]);
  
  const [localPhotoUrls, setLocalPhotoUrls] = useState<Map<string, string>>(new Map());


  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Initialize accordion state
  useEffect(() => {
    if (tasks && report) {
      const defaultOpenItems = tasks
        .filter(section => {
          const allTasksCompleted = section.tasks.every(task => {
            const completions = (report.completedTasks[task.id] || []) as CompletionRecord[];
            return completions.length > 0;
          });
          return !allTasksCompleted;
        })
        .map(section => section.title);
        
      setOpenAccordionItems(defaultOpenItems);
    }
  }, [tasks, report]);

  const collapseCompletedSection = useCallback((section: TaskSection) => {
    if (!report) return;

    const allTasksCompleted = section.tasks.every(task => {
        const completions = (report.completedTasks[task.id] || []) as CompletionRecord[];
        return completions.length > 0;
    });

    if (allTasksCompleted) {
        setOpenAccordionItems(prev => prev.filter(item => item !== section.title));
    }
  }, [report]);

    const fetchLocalPhotos = useCallback(async (currentReport: ShiftReport | null) => {
        if (!currentReport) return;

        const allPhotoIds = new Set<string>();
        for (const taskId in currentReport.completedTasks) {
            for (const completion of currentReport.completedTasks[taskId]) {
                if (completion.photoIds) {
                    completion.photoIds.forEach(id => allPhotoIds.add(id));
                }
            }
        }

        if (allPhotoIds.size === 0) {
            setLocalPhotoUrls(new Map());
            return;
        }

        const urls = await photoStore.getPhotosAsUrls(Array.from(allPhotoIds));
        setLocalPhotoUrls(urls);
    }, []);

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

  const updateLocalReport = useCallback(async (updatedReport: ShiftReport) => {
      setReport(updatedReport);
      await fetchLocalPhotos(updatedReport); // Refresh photo URLs after every local update
      if (dataStore.isReportEmpty(updatedReport)) {
        await dataStore.deleteLocalReport(updatedReport.id);
        setSyncStatus('synced');
      } else {
        await dataStore.saveLocalReport(updatedReport);
        setSyncStatus('local-newer');
      }
  }, [fetchLocalPhotos]);

  const handleTaskAction = (taskId: string, section: TaskSection) => {
    setActiveTaskId(taskId);
    setIsCameraOpen(true);
    collapseCompletedSection(section);
  };
  
  const handleCapturePhotos = useCallback(async (photoIds: string[]) => {
    if (!activeTaskId || !report) return;

    const newReport = JSON.parse(JSON.stringify(report));
    let taskCompletions = (newReport.completedTasks[activeTaskId] as CompletionRecord[]) || [];
    
    const now = new Date();
    const formattedTime = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    taskCompletions.unshift({
        timestamp: formattedTime,
        photoIds: photoIds,
        photos: [],
    });
    
    newReport.completedTasks[activeTaskId] = taskCompletions;
    await updateLocalReport(newReport);
    
    const section = tasks?.find(s => s.tasks.some(t => t.id === activeTaskId));
    if (section) {
        collapseCompletedSection(section);
    }

    setIsCameraOpen(false);
    setActiveTaskId(null);
  }, [activeTaskId, report, updateLocalReport, tasks, collapseCompletedSection]);
  
  const handleDeletePhoto = async (taskId: string, completionIndex: number, photoId: string, isLocal: boolean) => {
      if (!report) return;
      
      const newReport = JSON.parse(JSON.stringify(report));
      const taskCompletions = newReport.completedTasks[taskId] as CompletionRecord[];
      const completionToUpdate = taskCompletions[completionIndex];

      if (!completionToUpdate) return;

      if (isLocal) {
          completionToUpdate.photoIds = (completionToUpdate.photoIds ?? []).filter((p:string) => p !== photoId);
          await photoStore.deletePhoto(photoId);
      } else {
          completionToUpdate.photos = (completionToUpdate.photos ?? []).filter((p: string) => p !== photoId);
          await dataStore.deletePhotoFromStorage(photoId);
      }

      if ((completionToUpdate.photoIds?.length || 0) === 0 && (completionToUpdate.photos?.length || 0) === 0) {
          taskCompletions.splice(completionIndex, 1);
      }
      
      if (taskCompletions.length === 0) {
          delete newReport.completedTasks[taskId];
      } else {
          newReport.completedTasks[taskId] = taskCompletions;
      }
      
      await updateLocalReport(newReport);
  };

  const handleDeleteCompletion = async (taskId: string, completionIndex: number) => {
      if (!report) return;
      
      const newReport = JSON.parse(JSON.stringify(report));
      const taskCompletions = newReport.completedTasks[taskId] as CompletionRecord[];
      
      const completionToDelete = taskCompletions[completionIndex];
      if (!completionToDelete) return;

      if(completionToDelete.photoIds) {
        await photoStore.deletePhotos(completionToDelete.photoIds);
      }
      if (completionToDelete.photos) {
        await Promise.all(completionToDelete.photos.map(url => dataStore.deletePhotoFromStorage(url)));
      }

      taskCompletions.splice(completionIndex, 1);
      
      if (taskCompletions.length > 0) {
          newReport.completedTasks[taskId] = taskCompletions;
      } else {
          delete newReport.completedTasks[taskId];
      }
      
      await updateLocalReport(newReport);
  }
  
    const handleSubmitReport = async () => {
        if (!report) return;
        setIsSubmitting(true);
        setShowSyncDialog(false);
        toast({
            title: "Đang gửi báo cáo...",
            description: "Vui lòng đợi, quá trình này có thể mất vài phút.",
        });

        try {
            await dataStore.submitReport(report);
            const serverReport = await dataStore.overwriteLocalReport(report.id);
            setReport(serverReport);
            await fetchLocalPhotos(serverReport);
            setSyncStatus('synced');
            toast({
                title: "Gửi báo cáo thành công!",
                description: "Báo cáo của bạn đã được đồng bộ lên hệ thống.",
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
    
  const handleCameraClose = useCallback(() => {
    setIsCameraOpen(false);
    setActiveTaskId(null);
  }, []);
  
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
    
  const handleSaveNotes = useCallback((newIssues: string) => {
    if(!report) return;
    if (newIssues !== (report.issues || '')) {
      const newReport = { ...report, issues: newIssues || null };
      updateLocalReport(newReport);
    }
  }, [report, updateLocalReport]);

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
          <CardHeader>
            <CardTitle>Danh sách công việc</CardTitle>
            <CardDescription>
              Nhấn "Đã hoàn thành" để ghi nhận công việc bằng hình ảnh.
            </CardDescription>
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
                              <Button 
                                size="sm" 
                                className="w-full md:w-auto active:scale-95 transition-transform"
                                onClick={() => handleTaskAction(task.id, section)}
                                disabled={isReadonly}
                              >
                                  <Camera className="mr-2 h-4 w-4"/>
                                  Đã hoàn thành
                              </Button>
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

        <ShiftNotesCard
          initialIssues={report.issues || ''}
          onSave={handleSaveNotes}
          disabled={isReadonly}
        />
      </div>
    </div>

    <div className="fixed bottom-4 right-4 z-50 md:bottom-6 md:right-6">
      <div className="relative">
        <Button 
            size="icon"
            className="rounded-full shadow-lg h-14 w-14 md:h-16 md:w-16" 
            onClick={handleSubmitReport} 
            disabled={isReadonly || syncStatus === 'server-newer'}
            aria-label="Gửi báo cáo"
        >
            {isSubmitting ? <Loader2 className="h-5 w-5 md:h-6 md:w-6 animate-spin" /> : <Send className="h-5 w-5 md:h-6 md:w-6" />}
        </Button>
        {syncStatus === 'local-newer' && (
          <span className="absolute top-0 right-0 block h-3 w-3 rounded-full bg-red-500 ring-2 ring-background" />
        )}
      </div>
    </div>

    <CameraDialog 
        isOpen={isCameraOpen}
        onClose={handleCameraClose}
        onSubmit={handleCapturePhotos}
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
