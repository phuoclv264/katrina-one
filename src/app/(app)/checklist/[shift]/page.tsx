
'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import type { TaskCompletion, TasksByShift, CompletionRecord, ShiftReport } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Camera, Send, ArrowLeft, Clock, X, Trash2, AlertCircle, Sunrise, Sunset, Activity, Loader2, Save, CheckCircle, WifiOff } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import CameraDialog from '@/components/camera-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import type { CarouselApi } from '@/components/ui/carousel';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { v4 as uuidv4 } from 'uuid';

export default function ChecklistPage() {
  const { toast } = useToast();
  const { user, loading: isAuthLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const shiftKey = params.shift as string;
  
  const [tasksByShift, setTasksByShift] = useState<TasksByShift | null>(null);
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeCompletionIndex, setActiveCompletionIndex] = useState<number | null>(null);
  
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>()
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideCount, setSlideCount] = useState(0);

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
        const serverReport = await dataStore.getOrCreateReport(user.uid, user.displayName || 'Nhân viên', shiftKey);
        
        await dataStore.saveLocalReport(serverReport);
        setReport(serverReport);
        setIsLoading(false);
    };

    loadReport();
  }, [isAuthLoading, user, shiftKey]);

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
      await dataStore.saveLocalReport(updatedReport);
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
    setIsCameraOpen(false);

    const newReport = JSON.parse(JSON.stringify(report));
    let taskCompletions = (newReport.completedTasks[activeTaskId] as CompletionRecord[]) || [];
    
    if (activeCompletionIndex !== null) {
        taskCompletions[activeCompletionIndex].photos.unshift(...photosDataUris);
    } else {
        const now = new Date();
        const formattedTime = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        taskCompletions.push({
            timestamp: formattedTime,
            photos: photosDataUris
        });
    }
    
    newReport.completedTasks[activeTaskId] = taskCompletions;
    await updateLocalReport(newReport);

    setActiveTaskId(null);
    setActiveCompletionIndex(null);
  }, [activeCompletionIndex, activeTaskId, report, updateLocalReport]);
  
  const handleDeletePhoto = async (taskId: string, completionIndex: number, photoUrl: string) => {
      if (!report) return;
      
      const newReport = JSON.parse(JSON.stringify(report));
      const taskCompletions = newReport.completedTasks[taskId] as CompletionRecord[];
      if (!taskCompletions || !taskCompletions[completionIndex]) return;

      taskCompletions[completionIndex].photos = taskCompletions[completionIndex].photos.filter((p:string) => p !== photoUrl);
      
      if (taskCompletions[completionIndex].photos.length === 0) {
          taskCompletions.splice(completionIndex, 1);
          if (taskCompletions.length === 0) {
              delete newReport.completedTasks[taskId];
          }
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
  
    const handleSyncReport = async () => {
        if (!report) return;
        setIsSubmitting(true);
        toast({
            title: "Đang đồng bộ báo cáo...",
            description: "Vui lòng đợi, quá trình này có thể mất vài phút.",
        });

        try {
            const syncedReport = await dataStore.syncReport(report.id);
            // Update local state with the synced report (which has updated URLs and lastSynced time)
            await updateLocalReport(syncedReport);

            toast({
                title: "Đồng bộ thành công!",
                description: "Những thay đổi của bạn đã được lưu lên cloud.",
            });
        } catch (error) {
            console.error("Failed to sync report:", error);
            toast({
                variant: "destructive",
                title: "Đồng bộ thất bại",
                description: "Đã xảy ra lỗi khi lưu báo cáo của bạn. Vui lòng kiểm tra kết nối mạng và thử lại.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };
    
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

  const handleIssuesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if(!report) return;
    const newReport = { ...report, issues: e.target.value };
    updateLocalReport(newReport);
  };
  
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
                 <Badge variant="secondary"><CheckCircle className="mr-1.5 h-3 w-3 text-green-500"/> Mọi thay đổi đã được lưu cục bộ</Badge>
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
                                                    className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full z-20"
                                                    onClick={() => handleDeletePhoto(task.id, cIndex, photo)}
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

        <Card>
          <CardHeader>
            <CardTitle>Ghi chú ca</CardTitle>
            <CardDescription>Báo cáo mọi sự cố hoặc sự kiện đáng chú ý trong ca của bạn.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="ví dụ: 'Máy pha cà phê bị rò rỉ.'"
              value={report.issues || ''}
              onChange={handleIssuesChange}
              disabled={isReadonly}
            />
          </CardContent>
        </Card>

        <Card className="border-green-500/50">
           <CardHeader>
                <CardTitle>Lưu và Đồng bộ</CardTitle>
                <CardDescription>Nhấn nút bên dưới để lưu tất cả thay đổi của bạn lên cloud. Bạn có thể lưu nhiều lần trong ca.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Button className="w-full" size="lg" onClick={handleSyncReport} disabled={isReadonly}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                    Lưu và Đồng bộ
                </Button>
            </CardContent>
             {report.lastSynced && (
                <CardFooter>
                    <p className="text-xs text-muted-foreground w-full text-center">
                        Đã đồng bộ lần cuối lúc: {new Date(report.lastSynced).toLocaleTimeString('vi-VN')}
                    </p>
                </CardFooter>
            )}
        </Card>
      </div>
    </div>

    <div className="fixed bottom-4 right-4 z-50 md:bottom-6 md:right-6">
        <Button 
            size="icon"
            className="rounded-full shadow-lg h-14 w-14 md:h-16 md:w-16" 
            onClick={handleSyncReport} 
            disabled={isReadonly}
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
        <DialogContent className="w-[80vw] max-w-[80vw] p-0 border-0 bg-transparent shadow-none">
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
                                sizes="80vw"
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
    </>
  );
}

    

    