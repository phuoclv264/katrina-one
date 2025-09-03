
'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import type { TaskCompletion, TasksByShift, CompletionRecord, ShiftReport } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Camera, Send, ArrowLeft, Clock, X, Trash2, AlertCircle, Sunrise, Sunset, Activity, Loader2, Save, CheckCircle, WifiOff, CloudDownload, UploadCloud } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import CameraDialog from '@/components/camera-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import type { CarouselApi } from '@/components/ui/carousel';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { v4 as uuidv4 } from 'uuid';
import ShiftNotesCard from '@/components/shift-notes-card';

type SyncStatus = 'checking' | 'synced' | 'local-newer' | 'server-newer' | 'error';

export default function ChecklistPage() {
  const { toast } = useToast();
  const { user, loading: isAuthLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const shiftKey = params.shift as string;
  
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('checking');
  const [showSyncDialog, setShowSyncDialog] = useState(false);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeCompletionIndex, setActiveCompletionIndex] = useState<number | null>(null);
  
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>()
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideCount, setSlideCount] = useState(0);
  
  const [tasksByShift, setTasksByShift] = useState<TasksByShift | null>(null);
  const shift = tasksByShift ? tasksByShift[shiftKey] : null;


  // --- Data Loading and Initialization ---
  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace('/');
    }
  }, [isAuthLoading, user, router]);

  useEffect(() => {
    const unsubscribeTasks = dataStore.subscribeToTasks((tasks) => {
      setTasksByShift(tasks);
    });
    return () => unsubscribeTasks();
  }, []);

  useEffect(() => {
    if (isAuthLoading || !user || !shiftKey) return;
    
    const loadReport = async () => {
        setIsLoading(true);
        setSyncStatus('checking');
        try {
            const { report: loadedReport, status } = await dataStore.getOrCreateReport(user.uid, user.displayName || 'Nhân viên', shiftKey);
            setReport(loadedReport);
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
  }, [isAuthLoading, user, shiftKey, toast]);

  const allPagePhotos = useMemo(() => {
    if (!shift || !report) return [];
    
    return Object.values(report.completedTasks)
        .flat()
        .flatMap(c => (c as CompletionRecord).photos);
  }, [shift, report]);

  useEffect(() => {
    if (!carouselApi) return;
    setSlideCount(carouselApi.scrollSnapList().length);
    setCurrentSlide(carouselApi.selectedScrollSnap());
    carouselApi.on("select", () => {
      setCurrentSlide(carouselApi.selectedScrollSnap());
    });
  }, [carouselApi, allPagePhotos.length]);

  const updateLocalReport = useCallback(async (updatedReport: ShiftReport) => {
      setReport(updatedReport);
      if (dataStore.isReportEmpty(updatedReport)) {
        await dataStore.deleteLocalReport(updatedReport.id);
        // User stays on page, local report is gone. Status is technically synced now as there's nothing to sync.
        setSyncStatus('synced');
      } else {
        await dataStore.saveLocalReport(updatedReport);
        setSyncStatus('local-newer');
      }
  }, []);

  const handleTaskAction = (taskId: string) => {
    setActiveTaskId(taskId);
    setActiveCompletionIndex(null);
    setIsCameraOpen(true);
  };

  const handleEditPhotos = (taskId: string, completionIndex: number) => {
    setActiveTaskId(taskId);
    setActiveCompletionIndex(completionIndex);
    setIsCameraOpen(true);
  };
  
  const handleCapturePhotos = useCallback(async (photosDataUris: string[]) => {
    if (!activeTaskId || !report) return;

    const newReport = JSON.parse(JSON.stringify(report));
    let taskCompletions = (newReport.completedTasks[activeTaskId] as CompletionRecord[]) || [];
    
    if (activeCompletionIndex !== null && taskCompletions[activeCompletionIndex]) {
        taskCompletions[activeCompletionIndex].photos.push(...photosDataUris);
    } else {
        const now = new Date();
        const formattedTime = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        taskCompletions.unshift({
            timestamp: formattedTime,
            photos: photosDataUris
        });
    }
    
    newReport.completedTasks[activeTaskId] = taskCompletions;
    await updateLocalReport(newReport);
    
    setIsCameraOpen(false);
    setActiveTaskId(null);
    setActiveCompletionIndex(null);
  }, [activeTaskId, activeCompletionIndex, report, updateLocalReport]);
  
  const handleDeletePhoto = async (taskId: string, completionIndex: number, photoUrl: string) => {
      if (!report) return;
      
      const newReport = JSON.parse(JSON.stringify(report));
      const taskCompletions = newReport.completedTasks[taskId] as CompletionRecord[];
      if (!taskCompletions || !taskCompletions[completionIndex]) return;

      taskCompletions[completionIndex].photos = taskCompletions[completionIndex].photos.filter((p:string) => p !== photoUrl);
      
      if (taskCompletions[completionIndex].photos.length === 0) {
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
            setReport(prev => prev ? {...prev, status: 'submitted'} : null);
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
    
  const cameraInitialPhotos = useMemo(() => {
    if (activeTaskId && activeCompletionIndex !== null && report) {
      const completions = (report.completedTasks[activeTaskId] || []) as CompletionRecord[];
      return completions[activeCompletionIndex]?.photos || [];
    }
    return [];
  }, [activeTaskId, activeCompletionIndex, report]);

  const handleCameraClose = useCallback(() => {
    setIsCameraOpen(false);
    setActiveTaskId(null);
    setActiveCompletionIndex(null);
  }, []);
  
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
        case 'Đầu ca': return 'border-yellow-500/50';
        case 'Trong ca': return 'border-sky-500/50';
        case 'Cuối ca': return 'border-indigo-500/50';
        default: return 'border-border';
    }
  }
  
  const openImagePreview = (url: string) => {
    const photoIndex = allPagePhotos.indexOf(url);
    if(photoIndex !== -1) {
        if (carouselApi) carouselApi.scrollTo(photoIndex, true);
        setPreviewImageIndex(photoIndex);
        setIsPreviewOpen(true);
    }
  };
  
  const handleSaveNotes = useCallback((newIssues: string) => {
    if(!report) return;
    // Only update if the value has actually changed
    if (newIssues !== (report.issues || '')) {
      const newReport = { ...report, issues: newIssues || null };
      updateLocalReport(newReport);
    }
  }, [report, updateLocalReport]);

  const isReadonly = isSubmitting;

  if (isAuthLoading || isLoading || !report || !tasksByShift || !shift) {
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
    <>
    <div className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8 pb-24">
      <header className="mb-8">
         <div className="flex justify-between items-center mb-4">
            <Button asChild variant="ghost" className="-ml-4">
                <Link href="/shifts">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Quay lại Ca làm việc
                </Link>
            </Button>
            <div className="flex items-center gap-2">
                 {getSyncBadge()}
            </div>
        </div>
        <div className="flex justify-between items-start">
            <div>
                 <h1 className="text-2xl md:text-3xl font-bold font-headline">Checklist: {shift.name}</h1>
                 <p className="text-muted-foreground">Mọi thay đổi sẽ được lưu cục bộ trên thiết bị này.</p>
            </div>
        </div>
      </header>

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Nhiệm vụ</CardTitle>
            <CardDescription>
              Nhấn "Đã hoàn thành" để ghi nhận công việc bằng hình ảnh. Bạn có thể thực hiện một công việc nhiều lần.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" defaultValue={shift.sections.map(s => s.title)} className="w-full space-y-4">
              {shift.sections.map((section) => {
                const isSingleCompletionSection = section.title === 'Đầu ca' || section.title === 'Cuối ca';
                return (
                <AccordionItem value={section.title} key={section.title} className={`rounded-lg border-2 bg-card ${getSectionBorderColor(section.title)}`}>
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
                        const isCompletedOnce = completions.length > 0;
                        const isDisabledForNew = (isSingleCompletionSection && isCompletedOnce) || isReadonly;
                        
                        return (
                           <div key={task.id} className={`rounded-md border p-4 transition-colors ${isCompletedOnce ? 'bg-accent/20' : ''}`}>
                            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                              <p className="font-medium flex-1">
                                {task.text}
                              </p>
                              <Button 
                                size="sm" 
                                className="w-full md:w-auto active:scale-95 transition-transform"
                                onClick={() => handleTaskAction(task.id)}
                                disabled={isDisabledForNew}
                              >
                                  <Camera className="mr-2 h-4 w-4"/>
                                  Đã hoàn thành
                              </Button>
                            </div>
                            
                            {completions.map((completion, cIndex) => (
                              <div key={cIndex} className="mt-4 rounded-md border bg-card p-3">
                                  <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                          <Clock className="h-4 w-4 flex-shrink-0" />
                                          <span>Thực hiện lúc: {completion.timestamp}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                          {!isSingleCompletionSection && (
                                            <Button size="xs" variant="outline" onClick={() => handleEditPhotos(task.id, cIndex)} disabled={isReadonly}>
                                                <Camera className="mr-1.5 h-3 w-3" />
                                                Thêm ảnh
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
                                {completion.photos.length > 0 ? (
                                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                                    {completion.photos.map((photo, pIndex) => {
                                      return (
                                        <div key={photo.slice(0, 50) + pIndex} className="relative aspect-square overflow-hidden rounded-md group bg-muted">
                                            <button onClick={() => openImagePreview(photo)} className="w-full h-full">
                                                <Image src={photo} alt={`Ảnh bằng chứng ${pIndex + 1}`} fill className={`object-cover`} />
                                            </button>
                                            
                                            {!isReadonly && (
                                                <Button 
                                                    variant="destructive"
                                                    size="icon"
                                                    className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full z-10"
                                                    onClick={(e) => { e.stopPropagation(); handleDeletePhoto(task.id, cIndex, photo); }}
                                                >
                                                    <X className="h-3 w-3" />
                                                    <span className="sr-only">Xóa ảnh</span>
                                                </Button>
                                            )}
                                        </div>
                                    )})}
                                    </div>
                                ): (
                                    <p className="text-xs text-muted-foreground italic">Không có ảnh nào được chụp cho lần thực hiện này.</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
                )
              })}
            </Accordion>
          </CardContent>
        </Card>

        <ShiftNotesCard
          initialIssues={report.issues || ''}
          onSave={handleSaveNotes}
          disabled={isReadonly}
        />

        <Card className="border-green-500/50">
           <CardHeader>
                <CardTitle>Gửi báo cáo</CardTitle>
                <CardDescription>Khi kết thúc ca, nhấn nút bên dưới để gửi báo cáo của bạn. Bạn có thể gửi nhiều lần.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Button className="w-full" size="lg" onClick={handleSubmitReport} disabled={isReadonly || syncStatus === 'server-newer'}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                    {report.status === 'submitted' ? 'Gửi lại báo cáo' : 'Gửi báo cáo'}
                </Button>
                 {report.status === 'submitted' && (
                    <p className="text-xs text-muted-foreground mt-2 text-center">Bạn đã gửi báo cáo cho ca này. Gửi lại sẽ ghi đè lên báo cáo trước đó.</p>
                 )}
                 {syncStatus === 'server-newer' && (
                    <p className="text-xs text-destructive mt-2 text-center">Vui lòng tải phiên bản mới nhất từ máy chủ trước khi gửi báo cáo.</p>
                 )}
            </CardContent>
        </Card>
      </div>
    </div>

    <div className="fixed bottom-4 right-4 z-50 md:bottom-6 md:right-6">
        <Button 
            size="icon"
            className="rounded-full shadow-lg h-14 w-14 md:h-16 md:w-16" 
            onClick={handleSubmitReport} 
            disabled={isReadonly || syncStatus === 'server-newer'}
            aria-label="Gửi báo cáo"
        >
            {isSubmitting ? <Loader2 className="h-5 w-5 md:h-6 md:w-6 animate-spin" /> : <Send className="h-5 w-5 md:h-6 md:w-6" />}
        </Button>
    </div>

    <CameraDialog 
        isOpen={isCameraOpen}
        onClose={handleCameraClose}
        onSubmit={handleCapturePhotos}
        initialPhotos={cameraInitialPhotos}
    />
     <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="w-[90vw] max-w-[90vw] sm:w-[60vw] sm:max-w-[60vw] p-0 border-0 bg-transparent shadow-none">
            <DialogHeader>
                <DialogTitle className="sr-only">Xem trước hình ảnh</DialogTitle>
                 <DialogClose className="absolute top-2 right-2 z-20 text-white rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                    <X className="h-6 w-6" />
                    <span className="sr-only">Đóng</span>
                </DialogClose>
            </DialogHeader>
            <Carousel
                setApi={setCarouselApi}
                opts={{
                    startIndex: previewImageIndex,
                    loop: allPagePhotos.length > 1,
                }}
                className="w-full"
            >
                <CarouselContent>
                    {allPagePhotos.map((url, index) => (
                    <CarouselItem key={index}>
                        <div className="w-full">
                             <Image 
                                src={url} 
                                alt={`Ảnh xem trước ${index + 1}`} 
                                width={0}
                                height={0}
                                sizes="90vw sm:60vw"
                                className="w-full h-auto object-contain"
                            />
                        </div>
                    </CarouselItem>
                    ))}
                </CarouselContent>
                {allPagePhotos.length > 1 && (
                    <>
                        <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2 z-10" />
                        <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2 z-10" />
                    </>
                )}
            </Carousel>
           
            {allPagePhotos.length > 1 && (
                 <div className="text-center text-white text-sm mt-2 pointer-events-none">
                    Ảnh {currentSlide + 1} / {slideCount}
                </div>
            )}
        </DialogContent>
    </Dialog>
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
    </>
  );
}

    