
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
import { Camera, Send, ArrowLeft, Clock, X, Trash2, AlertCircle, Sunrise, Sunset, Activity, Loader2, Save } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import CameraDialog from '@/components/camera-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import type { CarouselApi } from '@/components/ui/carousel';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';


export default function ChecklistPage() {
  const { toast } = useToast();
  const { staffName, isLoading: isAuthLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const shiftKey = params.shift as string;
  
  const [tasksByShift, setTasksByShift] = useState<TasksByShift | null>(null);
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);
  
  const [isSaving, setIsSaving] = useState<{[completionKey: string]: boolean}>({});

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeCompletionIndex, setActiveCompletionIndex] = useState<number | null>(null);
  
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>()
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideCount, setSlideCount] = useState(0);

  const shift = tasksByShift ? tasksByShift[shiftKey] : null;

  useEffect(() => {
    const unsubscribeTasks = dataStore.subscribeToTasks((tasks) => {
      setTasksByShift(tasks);
    });

    return () => unsubscribeTasks();
  }, []);

  useEffect(() => {
    if (isAuthLoading || !staffName || !shiftKey) return;

    let unsubscribeReport: (() => void) | null = null;
    
    const initializeReport = async () => {
        setIsDataLoading(true);
        const initialReport = await dataStore.getOrCreateReport(staffName, shiftKey);
        
        unsubscribeReport = dataStore.subscribeToReport(initialReport.id, (liveReport) => {
            setReport(liveReport);
            setIsDataLoading(false);
        });
    };

    initializeReport();

    return () => {
        if (unsubscribeReport) {
            unsubscribeReport();
        }
    };
  }, [isAuthLoading, staffName, shiftKey]);
  
  const allPagePhotos = useMemo(() => {
    if (!shift || !report) return [];
    const photos = report.uploadedPhotos || [];
    return photos.filter(p => !p.startsWith('data:image')); // Only show uploaded photos
  }, [shift, report]);

  useEffect(() => {
    if (!carouselApi) return;
    setSlideCount(carouselApi.scrollSnapList().length);
    setCurrentSlide(carouselApi.selectedScrollSnap());

    carouselApi.on("select", () => {
      setCurrentSlide(carouselApi.selectedScrollSnap());
    });
  }, [carouselApi]);
  
  const handleTaskAction = (taskId: string) => {
    setActiveTaskId(taskId);
    setActiveCompletionIndex(null); // New completion
    setIsCameraOpen(true);
  };

  const handleEditPhotos = (taskId: string, completionIndex: number) => {
    setActiveTaskId(taskId);
    setActiveCompletionIndex(completionIndex);
    setIsCameraOpen(true);
  };

  const updateLiveReport = useCallback(async (updatedCompletion: TaskCompletion, updatedPhotos: string[], updatedIssues?: string) => {
      if (!report) return;
      try {
         await dataStore.updateReport(report.id, {
            completedTasks: updatedCompletion,
            uploadedPhotos: updatedPhotos,
            ...(updatedIssues !== undefined && { issues: updatedIssues || null })
         });
      } catch (error) {
         console.error("Failed to update report:", error);
         toast({ title: "Lỗi cập nhật", description: "Không thể lưu thay đổi lên cloud.", variant: "destructive" });
      }
  }, [report, toast]);
  
  const handleCapturePhotos = async (photosDataUris: string[]) => {
    if (!activeTaskId || !report) return;
    setIsCameraOpen(false); // Close dialog immediately

    const newCompletion = JSON.parse(JSON.stringify(report.completedTasks));
    let taskCompletions = (newCompletion[activeTaskId] as CompletionRecord[]) || [];
    
    const completionKey = activeCompletionIndex !== null ? `${activeTaskId}-${activeCompletionIndex}` : `${activeTaskId}-new`;
    setIsSaving(prevState => ({...prevState, [completionKey]: true }));

    // Prepare a temporary completion record for optimistic UI update
    const existingPhotos = getInitialPhotosForCamera();
    const tempPhotos = [...existingPhotos, ...photosDataUris];

    if (activeCompletionIndex !== null) {
        taskCompletions[activeCompletionIndex].photos = tempPhotos;
    } else {
        const now = new Date();
        const formattedTime = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        taskCompletions.push({
            timestamp: formattedTime,
            photos: tempPhotos
        });
        setActiveCompletionIndex(taskCompletions.length - 1); // Set index for the new completion
    }
    
    newCompletion[activeTaskId] = taskCompletions;
    const allCurrentPhotos = Object.values(newCompletion).flat().flatMap(c => (c as CompletionRecord).photos);
    setReport(prev => prev ? {...prev, completedTasks: newCompletion, uploadedPhotos: allCurrentPhotos} : null);

    // Start upload process
    try {
        const uploadedUrls = await Promise.all(
            photosDataUris.map(p => dataStore.uploadPhoto(p, report.id, activeTaskId))
        );
        
        // Now update the report with the final URLs
        const finalCompletion = JSON.parse(JSON.stringify(report.completedTasks));
        let finalTaskCompletions = (finalCompletion[activeTaskId] as CompletionRecord[]) || [];

        const indexToUpdate = activeCompletionIndex !== null ? activeCompletionIndex : finalTaskCompletions.length > 0 ? finalTaskCompletions.length - 1 : 0;
        
        if (!finalTaskCompletions[indexToUpdate]) {
           const now = new Date();
           const formattedTime = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
           finalTaskCompletions[indexToUpdate] = { timestamp: formattedTime, photos: [] };
        }
        
        const existingFinalPhotos = finalTaskCompletions[indexToUpdate].photos.filter((p:string) => !p.startsWith('data:image'));
        finalTaskCompletions[indexToUpdate].photos = [...existingFinalPhotos, ...uploadedUrls];
        
        finalCompletion[activeTaskId] = finalTaskCompletions;
        const newUploadedPhotos = Object.values(finalCompletion).flat().flatMap(c => (c as CompletionRecord).photos);
        
        await updateLiveReport(finalCompletion, newUploadedPhotos);
        
    } catch (error) {
        console.error("Error capturing photos and updating report:", error);
        toast({ title: "Lỗi lưu ảnh", description: "Đã có lỗi xảy ra khi tải ảnh lên và cập nhật báo cáo.", variant: "destructive" });
    } finally {
        setIsSaving(prevState => ({...prevState, [completionKey]: false }));
        setActiveTaskId(null);
        setActiveCompletionIndex(null);
    }
  };
  
  const handleDeletePhoto = async (taskId: string, completionIndex: number, photoUrl: string) => {
      if (!report) return;
      
      const completionKey = `${taskId}-${completionIndex}`;
      setIsSaving(prevState => ({...prevState, [completionKey]: true }));

      try {
        const newCompletion = JSON.parse(JSON.stringify(report.completedTasks));
        const taskCompletions = newCompletion[taskId] as CompletionRecord[];
        const targetCompletion = taskCompletions[completionIndex];

        // Delete from Storage only if it's a real URL
        if (photoUrl.startsWith('https://')) {
            await dataStore.deletePhoto(photoUrl); 
        }

        targetCompletion.photos = targetCompletion.photos.filter((p:string) => p !== photoUrl);
        
        if (targetCompletion.photos.length === 0 && (report.completedTasks[taskId] as CompletionRecord[])[completionIndex].photos.length > 0) {
            taskCompletions.splice(completionIndex, 1);
        }
        
        newCompletion[taskId] = taskCompletions;
        const newUploadedPhotos = Object.values(newCompletion).flat().flatMap(c => (c as CompletionRecord).photos);
        await updateLiveReport(newCompletion, newUploadedPhotos);

      } catch (error) {
          console.error("Error deleting photo:", error);
          toast({ title: "Lỗi xóa ảnh", description: "Không thể xóa ảnh.", variant: "destructive" });
      } finally {
          setIsSaving(prevState => ({...prevState, [completionKey]: false }));
      }
  };

  const handleDeleteCompletion = async (taskId: string, completionIndex: number) => {
      if (!report) return;
      const completionKey = `${taskId}-${completionIndex}`;
      setIsSaving(prevState => ({...prevState, [completionKey]: true }));
      
      try {
        const newCompletion = JSON.parse(JSON.stringify(report.completedTasks));
        const taskCompletions = newCompletion[taskId] as CompletionRecord[];
        
        const completionToDelete = taskCompletions[completionIndex];
        for(const photoUrl of completionToDelete.photos) {
             if (photoUrl.startsWith('https://')) {
                await dataStore.deletePhoto(photoUrl);
            }
        }

        taskCompletions.splice(completionIndex, 1);
        newCompletion[taskId] = taskCompletions;
        const newUploadedPhotos = Object.values(newCompletion).flat().flatMap(c => (c as CompletionRecord).photos);
        await updateLiveReport(newCompletion, newUploadedPhotos);
        toast({
            title: "Đã xóa lần thực hiện",
            description: "Lần hoàn thành công việc đã được xóa khỏi báo cáo.",
            variant: "destructive"
        });
      } catch (error) {
          console.error("Error deleting completion:", error);
          toast({ title: "Lỗi xóa", description: "Không thể xóa lần thực hiện này.", variant: "destructive" });
      } finally {
         setIsSaving(prevState => ({...prevState, [completionKey]: false }));
      }
  }
  
  const getInitialPhotosForCamera = () => {
    if (activeTaskId && activeCompletionIndex !== null && report) {
      const completions = (report.completedTasks[activeTaskId] || []) as CompletionRecord[];
      return completions[activeCompletionIndex]?.photos || [];
    }
    return [];
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
        case 'Đầu ca': return 'border-yellow-500/50';
        case 'Trong ca': return 'border-sky-500/50';
        case 'Cuối ca': return 'border-indigo-500/50';
        default: return 'border-border';
    }
  }
  
  const openImagePreview = (url: string) => {
    const photoIndex = allPagePhotos.indexOf(url);
    if(photoIndex !== -1) {
        if (carouselApi) {
            carouselApi.scrollTo(photoIndex, true);
        }
        setPreviewImageIndex(photoIndex);
        setIsPreviewOpen(true);
    }
  };

  const handleIssuesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if(!report) return;
    const newIssues = e.target.value;
    const newReportState = { ...report, issues: newIssues };
    setReport(newReportState); // Optimistic update
    updateLiveReport(report.completedTasks, report.uploadedPhotos, newIssues);
  };
  
  const isAnythingSaving = Object.values(isSaving).some(s => s === true);

  if (isDataLoading || isAuthLoading || !report || !tasksByShift) {
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
    <div className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8">
      <header className="mb-8">
         <div className="flex justify-between items-center mb-4">
            <Button asChild variant="ghost" className="-ml-4">
                <Link href="/shifts">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Quay lại Ca làm việc
                </Link>
            </Button>
            <div className="flex items-center gap-2">
                 {isAnythingSaving ? (
                     <Badge variant="secondary"><Loader2 className="mr-1.5 h-3 w-3 animate-spin"/> Đang lưu...</Badge>
                 ) : (
                     <Badge variant="secondary">Đã lưu lên cloud</Badge>
                 )}
            </div>
        </div>
        <h1 className="text-3xl font-bold font-headline">Checklist: {shift?.name}</h1>
        <p className="text-muted-foreground">Mọi thay đổi sẽ được tự động lưu và cập nhật theo thời gian thực.</p>
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
                        const isDisabled = isSingleCompletionSection && isCompletedOnce;
                        
                        return (
                           <div key={task.id} className={`rounded-md border p-4 transition-colors ${isCompletedOnce ? 'bg-accent/20' : ''}`}>
                            <div className="flex items-center gap-4">
                              <div className="flex-1">
                                <p className="font-medium">
                                  {task.text}
                                </p>
                              </div>
                              <Button 
                                size="sm" 
                                style={!isDisabled ? {
                                  backgroundColor: 'hsl(var(--accent)/0.8)',
                                  color: 'hsl(var(--accent-foreground))'
                                } : {}}
                                className="active:scale-95 transition-transform"
                                onClick={() => handleTaskAction(task.id)}
                                disabled={isDisabled || isAnythingSaving}
                              >
                                  <Camera className="mr-2 h-4 w-4"/>
                                  Đã hoàn thành
                              </Button>
                            </div>
                            
                            {completions.map((completion, cIndex) => {
                              const isCompletionSaving = isSaving[`${task.id}-${cIndex}`] || isSaving[`${task.id}-new`] && cIndex === completions.length-1;
                              return (
                              <div key={cIndex} className={`mt-4 rounded-md border bg-card p-3 relative transition-opacity ${isCompletionSaving ? 'opacity-60' : ''}`}>
                                  {isCompletionSaving && (
                                    <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-md z-10">
                                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                          <Clock className="h-4 w-4 flex-shrink-0" />
                                          <span>Thực hiện lúc: {completion.timestamp}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                          {!isDisabled && (
                                            <Button size="xs" variant="outline" onClick={() => handleEditPhotos(task.id, cIndex)} disabled={isAnythingSaving}>
                                                <Camera className="mr-1.5 h-3 w-3" />
                                                Sửa ảnh
                                            </Button>
                                          )}
                                          
                                          <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                               <Button size="xs" variant="ghost" className="text-destructive hover:bg-destructive/10" disabled={isAnythingSaving}>
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
                                                        Hành động này sẽ xóa lần hoàn thành công việc này và tất cả các ảnh liên quan. Bạn không thể hoàn tác hành động này.
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
                                      const isUploading = photo.startsWith('data:image');
                                      return (
                                        <div key={pIndex} className="relative aspect-square overflow-hidden rounded-md group">
                                            {isUploading ? (
                                              <div className="w-full h-full bg-muted flex items-center justify-center">
                                                 <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                              </div>
                                            ) : (
                                              <button onClick={() => openImagePreview(photo)} className="w-full h-full">
                                                  <Image src={photo} alt={`Ảnh bằng chứng ${pIndex + 1}`} fill className="object-cover" />
                                              </button>
                                            )}
                                            <Button 
                                                variant="destructive"
                                                size="icon"
                                                className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full"
                                                onClick={() => handleDeletePhoto(task.id, cIndex, photo)}
                                                disabled={isAnythingSaving}
                                            >
                                                <X className="h-3 w-3" />
                                                <span className="sr-only">Xóa ảnh</span>
                                            </Button>
                                        </div>
                                    )})}
                                    </div>
                                ): (
                                    <p className="text-xs text-muted-foreground italic">Không có ảnh nào được chụp cho lần thực hiện này.</p>
                                )}
                              </div>
                            )})}
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
              disabled={isAnythingSaving}
            />
          </CardContent>
        </Card>
      </div>
    </div>
    <CameraDialog 
        isOpen={isCameraOpen}
        onClose={() => {
            setIsCameraOpen(false);
            setActiveTaskId(null);
            setActiveCompletionIndex(null);
        }}
        onSubmit={handleCapturePhotos}
        initialPhotos={getInitialPhotosForCamera()}
    />
     <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl p-0 border-0 bg-transparent shadow-none">
            <DialogHeader className="absolute top-2 right-2 z-20">
                 <DialogClose className="text-white rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
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
                        <div className="relative aspect-video w-full h-[80vh] sm:h-auto">
                             <Image 
                                src={url} 
                                alt={`Ảnh xem trước ${index + 1}`} 
                                fill 
                                className="object-contain"
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

    