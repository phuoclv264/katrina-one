
'use client';
import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import type { TaskCompletion, TasksByShift, CompletionRecord } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Camera, Send, ArrowLeft, Clock, X, Trash2, AlertCircle, Sunrise, Sunset, Activity } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import CameraDialog from '@/components/camera-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import type { CarouselApi } from '@/components/ui/carousel';


export default function ChecklistPage() {
  const { toast } = useToast();
  const { staffName } = useAuth();
  const params = useParams();
  const shiftKey = params.shift as string;

  const [tasksByShift, setTasksByShift] = useState<TasksByShift>(dataStore.getTasks());
  
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeCompletionIndex, setActiveCompletionIndex] = useState<number | null>(null);
  
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>()
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideCount, setSlideCount] = useState(0);


  useEffect(() => {
    const unsubscribe = dataStore.subscribe(() => {
      setTasksByShift(dataStore.getTasks());
    });
    return () => unsubscribe();
  }, []);
  
  const shift = tasksByShift[shiftKey];

  const [taskCompletion, setTaskCompletion] = useState<TaskCompletion>({});
  
  useEffect(() => {
    if (shift) {
      const initialCompletion: TaskCompletion = {};
      shift.sections.forEach(section => {
        section.tasks.forEach(task => {
          initialCompletion[task.id] = [];
        });
      });
      setTaskCompletion(initialCompletion);
    }
  }, [shift]);
  
  const [issues, setIssues] = useState('');
  
  const allPagePhotos = useMemo(() => {
    if (!shift) return [];
    const photos: string[] = [];
    shift.sections.forEach(section => {
        section.tasks.forEach(task => {
            const completions = (taskCompletion[task.id] || []) as CompletionRecord[];
            completions.forEach(comp => {
                photos.push(...comp.photos);
            });
        });
    });
    return photos;
  }, [shift, taskCompletion]);

  useEffect(() => {
    if (!carouselApi) return;
    setSlideCount(carouselApi.scrollSnapList().length);
    setCurrentSlide(carouselApi.selectedScrollSnap());

    carouselApi.on("select", () => {
      setCurrentSlide(carouselApi.selectedScrollSnap());
    });
  }, [carouselApi]);


  if (!shift) {
    return <div className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8">Đang tải...</div>;
  }
  
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
  
  const handleCapturePhotos = (photos: string[]) => {
    if (activeTaskId) {
      setTaskCompletion(current => {
        const newCompletion = JSON.parse(JSON.stringify(current));
        const taskCompletions = (newCompletion[activeTaskId] as CompletionRecord[]) || [];

        if (activeCompletionIndex !== null) {
          // Editing existing completion
          taskCompletions[activeCompletionIndex].photos = photos;
        } else {
          // Adding new completion
          const now = new Date();
          const formattedTime = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
          taskCompletions.push({
            timestamp: formattedTime,
            photos: photos
          });
        }
        
        newCompletion[activeTaskId] = taskCompletions;
        return newCompletion;
      });
    }
    setIsCameraOpen(false);
    setActiveTaskId(null);
    setActiveCompletionIndex(null);
  };
  
  const handleDeletePhoto = (taskId: string, completionIndex: number, photoIndex: number) => {
    setTaskCompletion(prev => {
      const newCompletion = JSON.parse(JSON.stringify(prev));
      const taskCompletions = newCompletion[taskId] as CompletionRecord[];
      const targetCompletion = taskCompletions[completionIndex];

      if (targetCompletion) {
          targetCompletion.photos.splice(photoIndex, 1);
          // If this was the last photo, remove the entire completion record.
          if (targetCompletion.photos.length === 0) {
              taskCompletions.splice(completionIndex, 1);
          }
      }
      
      newCompletion[taskId] = taskCompletions;
      return newCompletion;
    });
  };

  const handleDeleteCompletion = (taskId: string, completionIndex: number) => {
     setTaskCompletion(prev => {
      const newCompletion = JSON.parse(JSON.stringify(prev));
      const taskCompletions = newCompletion[taskId] as CompletionRecord[];
      taskCompletions.splice(completionIndex, 1);
      newCompletion[taskId] = taskCompletions;
      return newCompletion;
    });
     toast({
        title: "Đã xóa lần thực hiện",
        description: "Lần hoàn thành công việc đã được xóa khỏi báo cáo.",
        variant: "destructive"
    });
  }


  const handleSubmit = () => {
    const allUploadedPhotos = Object.values(taskCompletion)
      .flat()
      .flatMap((record: CompletionRecord) => record.photos);
      
    dataStore.addReport({
        shiftKey,
        staffName: staffName || 'Nhân viên',
        completedTasks: taskCompletion,
        uploadedPhotos: allUploadedPhotos,
        issues: issues || null,
    });
    
    toast({
      title: "Đã gửi báo cáo!",
      description: "Báo cáo ca làm việc của bạn đã được gửi thành công.",
      style: {
        backgroundColor: 'var(--accent)',
        color: 'var(--accent-foreground)'
      }
    });

    // Reset state
    const initialCompletion: TaskCompletion = {};
    shift.sections.forEach(section => {
      section.tasks.forEach(task => {
        initialCompletion[task.id] = [];
      });
    });
    setTaskCompletion(initialCompletion);
    setIssues('');
  };
  
  const getInitialPhotosForCamera = () => {
    if (activeTaskId && activeCompletionIndex !== null) {
      const completions = taskCompletion[activeTaskId] as CompletionRecord[];
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
        setPreviewImageIndex(photoIndex);
        setIsPreviewOpen(true);
    }
  };


  return (
    <>
    <div className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8">
      <header className="mb-8">
        <Button asChild variant="ghost" className="mb-4 -ml-4">
            <Link href="/shifts">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Quay lại Ca làm việc
            </Link>
        </Button>
        <h1 className="text-3xl font-bold font-headline">Checklist: {shift.name}</h1>
        <p className="text-muted-foreground">Hoàn thành nhiệm vụ của bạn và gửi báo cáo cuối ca.</p>
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
                        const completions = (taskCompletion[task.id] || []) as CompletionRecord[];
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
                                disabled={isDisabled}
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
                                          {!isDisabled && (
                                            <Button size="xs" variant="outline" onClick={() => handleEditPhotos(task.id, cIndex)}>
                                                <Camera className="mr-1.5 h-3 w-3" />
                                                Sửa ảnh
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
                                    {completion.photos.map((photo, pIndex) => (
                                        <div key={pIndex} className="relative aspect-square overflow-hidden rounded-md group">
                                            <button onClick={() => openImagePreview(photo)} className="w-full h-full">
                                                <Image src={photo} alt={`Ảnh bằng chứng ${pIndex + 1}`} fill className="object-cover" />
                                            </button>
                                            <Button 
                                                variant="destructive"
                                                size="icon"
                                                className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full"
                                                onClick={() => handleDeletePhoto(task.id, cIndex, pIndex)}
                                            >
                                                <X className="h-3 w-3" />
                                                <span className="sr-only">Xóa ảnh</span>
                                            </Button>
                                        </div>
                                    ))}
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
              value={issues}
              onChange={(e) => setIssues(e.target.value)}
            />
          </CardContent>
        </Card>
        
        <Button size="lg" className="w-full" onClick={handleSubmit}>
          <Send className="mr-2" />
          Gửi báo cáo cuối cùng
        </Button>
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
        <DialogContent className="max-w-3xl p-0 border-0">
            <DialogHeader className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/50 to-transparent p-2">
                <DialogTitle className="text-center text-white text-sm font-normal pointer-events-none">
                    Xem trước ảnh ({currentSlide + 1} / {slideCount})
                </DialogTitle>
            </DialogHeader>
            <Carousel
                setApi={setCarouselApi}
                opts={{
                    startIndex: previewImageIndex,
                    loop: false,
                }}
                className="w-full"
            >
                <CarouselContent>
                    {allPagePhotos.map((url, index) => (
                    <CarouselItem key={index}>
                        <div className="relative aspect-video w-full h-[80vh] sm:h-auto">
                            <Image src={url} alt={`Ảnh xem trước ${index + 1}`} fill className="object-contain" />
                        </div>
                    </CarouselItem>
                    ))}
                </CarouselContent>
                <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2 z-10" />
                <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2 z-10" />
            </Carousel>
        </DialogContent>
    </Dialog>
    </>
  );
}

    