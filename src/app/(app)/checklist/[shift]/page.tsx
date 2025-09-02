
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
import { v4 as uuidv4 } from 'uuid';
import { Progress } from '@/components/ui/progress';

type UploadState = {
  [tempId: string]: {
    progress: number;
    dataUri: string; // Store the data URI for preview
    finalUrl?: string;
  };
};

export default function ChecklistPage() {
  const { toast } = useToast();
  const { staffName, isLoading: isAuthLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const shiftKey = params.shift as string;
  
  const [tasksByShift, setTasksByShift] = useState<TasksByShift | null>(null);
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);
  
  const [isSavingIssues, setIsSavingIssues] = useState(false);
  const [uploads, setUploads] = useState<UploadState>({});

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
    if (!isAuthLoading && !staffName) {
      router.replace('/');
    }
  }, [isAuthLoading, staffName, router]);

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
    return report.uploadedPhotos || [];
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

  const updateLiveReport = useCallback(async (updatedCompletion: TaskCompletion, updatedPhotos: string[]) => {
      if (!report) return;
      try {
         await dataStore.updateReport(report.id, {
            completedTasks: updatedCompletion,
            uploadedPhotos: updatedPhotos
         });
      } catch (error) {
         console.error("Failed to update report:", error);
         toast({ title: "Lỗi cập nhật", description: "Không thể lưu thay đổi lên cloud.", variant: "destructive" });
      }
  }, [report, toast]);
  
  const handleCapturePhotos = async (photosDataUris: string[]) => {
    if (!activeTaskId || !report) return;
    setIsCameraOpen(false);

    const newCompletion = JSON.parse(JSON.stringify(report.completedTasks));
    let taskCompletions = (newCompletion[activeTaskId] as CompletionRecord[]) || [];
    let completionIndex = activeCompletionIndex;

    const newPhotosWithTempIds = photosDataUris.map(dataUri => ({
        tempId: `temp_${uuidv4()}`,
        dataUri: dataUri
    }));

    const tempPhotoUrls = newPhotosWithTempIds.map(p => `uploading://${p.tempId}`);

    if (completionIndex !== null) {
        taskCompletions[completionIndex].photos.push(...tempPhotoUrls);
    } else {
        const now = new Date();
        const formattedTime = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        taskCompletions.push({
            timestamp: formattedTime,
            photos: tempPhotoUrls
        });
        completionIndex = taskCompletions.length - 1;
    }
    
    newCompletion[activeTaskId] = taskCompletions;
    setReport(prev => prev ? {...prev, completedTasks: newCompletion } : null);

    setUploads(prev => {
        const newUploadsState = {...prev};
        newPhotosWithTempIds.forEach(({ tempId, dataUri }) => {
            newUploadsState[tempId] = { progress: 0, dataUri };
        });
        return newUploadsState;
    });

    newPhotosWithTempIds.forEach(({ tempId, dataUri }) => {
        dataStore.uploadPhotoWithProgress(
            dataUri,
            report.id,
            activeTaskId,
            (progress) => {
                setUploads(prev => ({...prev, [tempId]: {...prev[tempId], progress }}));
            }
        ).promise.then(finalUrl => {
            setUploads(prev => ({...prev, [tempId]: {...prev[tempId], finalUrl }}));
        }).catch(error => {
            console.error("Upload failed for", tempId, error);
            toast({ title: "Lỗi tải ảnh lên", description: `Một ảnh không thể tải lên được. Vui lòng thử xóa và chụp lại.`, variant: "destructive" });
            
            setUploads(prev => {
                const newUploads = {...prev};
                delete newUploads[tempId];
                return newUploads;
            });
            
            const tempUrl = `uploading://${tempId}`;
            
            if(report) {
                 const finalCompletion = JSON.parse(JSON.stringify(report.completedTasks));
                 const finalTaskCompletions = (finalCompletion[activeTaskId] as CompletionRecord[]);
                 if (finalTaskCompletions[completionIndex!]) {
                    finalTaskCompletions[completionIndex!].photos = finalTaskCompletions[completionIndex!].photos.filter((p: string) => p !== tempUrl);
                    if (finalTaskCompletions[completionIndex!].photos.length === 0 && finalTaskCompletions[completionIndex!].timestamp) {
                        // If no photos left, remove the completion record itself
                         finalTaskCompletions.splice(completionIndex!, 1);
                         finalCompletion[activeTaskId] = finalTaskCompletions;
                    }
                    const newUploadedPhotos = Object.values(finalCompletion).flat().flatMap(c => (c as CompletionRecord).photos);
                    updateLiveReport(finalCompletion, newUploadedPhotos);
                }
            }
        });
    });

    setActiveTaskId(null);
    setActiveCompletionIndex(null);
  };
  
  useEffect(() => {
    const completedUploads = Object.entries(uploads).filter(([_, u]) => u.finalUrl);
    if (completedUploads.length === 0 || !report) return;

    const newCompletion = JSON.parse(JSON.stringify(report.completedTasks));
    let hasChanged = false;

    for (const [tempId, { finalUrl }] of completedUploads) {
        if (!finalUrl) continue;
        const tempUrl = `uploading://${tempId}`;
        
        for(const taskId in newCompletion) {
            const completions = newCompletion[taskId] as CompletionRecord[];
            for(const completion of completions) {
                const photoIndex = completion.photos.indexOf(tempUrl);
                if(photoIndex > -1) {
                    completion.photos[photoIndex] = finalUrl;
                    hasChanged = true;
                    // No break here, continue searching in case the same temp URL was somehow added multiple times
                }
            }
        }
    }

    if(hasChanged) {
        const newUploadedPhotos = Object.values(newCompletion).flat().flatMap(c => (c as CompletionRecord).photos).filter(p => p && !p.startsWith('uploading://'));
        updateLiveReport(newCompletion, newUploadedPhotos);
        
        setUploads(prev => {
            const newUploadsState = {...prev};
            completedUploads.forEach(([tempId, _]) => {
                // Keep the progress and finalUrl but remove the hefty dataUri to free up memory
                 if (newUploadsState[tempId]) {
                    delete newUploadsState[tempId].dataUri;
                 }
            });
            return newUploadsState;
        });
    }

  }, [uploads, report, updateLiveReport]);
  
  const handleDeletePhoto = async (taskId: string, completionIndex: number, photoUrl: string) => {
      if (!report) return;
      
      const isUploading = photoUrl.startsWith('uploading://');

      if (isUploading) {
        const tempId = photoUrl.replace('uploading://', '');
        // TODO: Cancel upload if possible. For now, just remove from UI.
        setUploads(prev => {
            const newUploads = {...prev};
            delete newUploads[tempId];
            return newUploads;
        });
        toast({ title: "Đã hủy", description: "Đã hủy tải lên ảnh.", variant: "destructive" });
      }

      try {
        const newCompletion = JSON.parse(JSON.stringify(report.completedTasks));
        const taskCompletions = newCompletion[taskId] as CompletionRecord[];
        
        if (!taskCompletions || !taskCompletions[completionIndex]) return;

        const targetCompletion = taskCompletions[completionIndex];

        if (photoUrl.startsWith('https://')) {
            await dataStore.deletePhoto(photoUrl); 
        }

        targetCompletion.photos = targetCompletion.photos.filter((p:string) => p !== photoUrl);
        
        if (targetCompletion.photos.length === 0) {
            taskCompletions.splice(completionIndex, 1);
            if (taskCompletions.length === 0) {
                delete newCompletion[taskId];
            } else {
                 newCompletion[taskId] = taskCompletions;
            }
        }
        
        const newUploadedPhotos = Object.values(newCompletion).flat().flatMap(c => (c as CompletionRecord).photos).filter(p => p && !p.startsWith('uploading://'));
        await updateLiveReport(newCompletion, newUploadedPhotos);

      } catch (error) {
          console.error("Error deleting photo:", error);
          toast({ title: "Lỗi xóa ảnh", description: "Không thể xóa ảnh.", variant: "destructive" });
      }
  };

  const handleDeleteCompletion = async (taskId: string, completionIndex: number) => {
      if (!report) return;
      
      try {
        const newCompletion = JSON.parse(JSON.stringify(report.completedTasks));
        const taskCompletions = newCompletion[taskId] as CompletionRecord[];
        
        const completionToDelete = taskCompletions[completionIndex];
        for(const photoUrl of completionToDelete.photos) {
             if (photoUrl.startsWith('https://')) {
                await dataStore.deletePhoto(photoUrl);
            }
             // TODO: Also cancel any uploads in progress
        }

        taskCompletions.splice(completionIndex, 1);
        if (taskCompletions.length > 0) {
            newCompletion[taskId] = taskCompletions;
        } else {
            delete newCompletion[taskId];
        }
        const newUploadedPhotos = Object.values(newCompletion).flat().flatMap(c => (c as CompletionRecord).photos).filter(p => p && !p.startsWith('uploading://'));
        await updateLiveReport(newCompletion, newUploadedPhotos);
        toast({
            title: "Đã xóa lần thực hiện",
            description: "Lần hoàn thành công việc đã được xóa khỏi báo cáo.",
            variant: "destructive"
        });
      } catch (error) {
          console.error("Error deleting completion:", error);
          toast({ title: "Lỗi xóa", description: "Không thể xóa lần thực hiện này.", variant: "destructive" });
      }
  }
  
  const getInitialPhotosForCamera = () => {
    if (activeTaskId && activeCompletionIndex !== null && report) {
      const completions = (report.completedTasks[activeTaskId] || []) as CompletionRecord[];
      // Filter out uploading photos as they can't be edited
      return (completions[activeCompletionIndex]?.photos || []).filter(p => !p.startsWith('uploading://'));
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
  };
  
  const handleSaveIssues = () => {
    if(!report || report.issues === null) return;
    setIsSavingIssues(true);
    dataStore.updateReport(report.id, { issues: report.issues })
        .then(() => toast({ title: "Đã lưu ghi chú" }))
        .catch(() => toast({ title: "Lỗi lưu ghi chú", variant: "destructive" }))
        .finally(() => setIsSavingIssues(false));
  }
  
  if (isAuthLoading || !staffName || isDataLoading || !report || !tasksByShift) {
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
                <Badge variant="secondary">Đã lưu lên cloud</Badge>
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
                        const isDisabledForNew = isSingleCompletionSection && isCompletedOnce;
                        
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
                                style={!isDisabledForNew ? {
                                  backgroundColor: 'hsl(var(--accent)/0.8)',
                                  color: 'hsl(var(--accent-foreground))'
                                } : {}}
                                className="active:scale-95 transition-transform"
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
                                            <Button size="xs" variant="outline" onClick={() => handleEditPhotos(task.id, cIndex)}>
                                                <Camera className="mr-1.5 h-3 w-3" />
                                                Thêm ảnh
                                            </Button>
                                          )}
                                          
                                          <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                               <Button size="xs" variant="ghost" className="text-destructive hover:bg-destructive/10">
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
                                      const isUploading = photo.startsWith('uploading://');
                                      const tempId = isUploading ? photo.replace('uploading://', '') : '';
                                      const uploadProgress = isUploading ? uploads[tempId]?.progress : 100;
                                      const previewSrc = isUploading ? uploads[tempId]?.dataUri : photo;

                                      return (
                                        <div key={photo} className="relative aspect-square overflow-hidden rounded-md group">
                                            {isUploading && previewSrc ? (
                                                <div className="w-full h-full bg-muted flex items-center justify-center">
                                                    <Image src={previewSrc} alt={`Ảnh đang tải lên ${pIndex + 1}`} fill className="object-cover opacity-30" />
                                                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white z-10 p-1">
                                                        <span className="text-xs font-bold">{Math.round(uploadProgress || 0)}%</span>
                                                        <Progress value={uploadProgress} className="absolute bottom-0 h-1 w-full rounded-none" />
                                                    </div>
                                                </div>
                                            ) : (
                                              <button onClick={() => openImagePreview(photo)} className="w-full h-full">
                                                  <Image src={photo} alt={`Ảnh bằng chứng ${pIndex + 1}`} fill className="object-cover" />
                                              </button>
                                            )}
                                            <Button 
                                                variant="destructive"
                                                size="icon"
                                                className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full z-20"
                                                onClick={() => handleDeletePhoto(task.id, cIndex, photo)}
                                                disabled={isUploading && (uploadProgress < 100)}
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
              onBlur={handleSaveIssues}
            />
          </CardContent>
           <CardFooter>
            {isSavingIssues && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin"/> Đang lưu...
              </p>
            )}
           </CardFooter>
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

    
