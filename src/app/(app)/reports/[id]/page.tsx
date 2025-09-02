
'use client';
import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { dataStore } from '@/lib/data-store';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Check, Camera, MessageSquareWarning, Star, Clock, X, Image as ImageIcon, Sunrise, Activity, Sunset, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { ShiftReport, TaskCompletion, CompletionRecord, TasksByShift } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import type { CarouselApi } from '@/components/ui/carousel';
import { Skeleton } from '@/components/ui/skeleton';

export default function ReportDetailPage() {
  const params = useParams();
  const reportId = params.id as string;
  const [report, setReport] = useState<ShiftReport | null | undefined>(undefined);
  const [tasksByShift, setTasksByShift] = useState<TasksByShift | null>(null);
  
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>()
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideCount, setSlideCount] = useState(0);

  const isLoading = report === undefined || tasksByShift === null;

  useEffect(() => {
    if (!reportId) return;
    const docRef = doc(db, "reports", reportId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            setReport({
                ...data,
                id: docSnap.id,
                startedAt: (data.startedAt as any)?.toDate ? (data.startedAt as any).toDate().toISOString() : data.startedAt,
                submittedAt: (data.submittedAt as any)?.toDate ? (data.submittedAt as any).toDate().toISOString() : data.submittedAt,
                lastUpdated: (data.lastUpdated as any)?.toDate ? (data.lastUpdated as any).toDate().toISOString() : data.lastUpdated,
            } as ShiftReport);
        } else {
            setReport(null);
        }
    });
    return () => unsubscribe();
  }, [reportId]);

  useEffect(() => {
    const unsubscribe = dataStore.subscribeToTasks((tasks) => {
        setTasksByShift(tasks);
    });
    return () => unsubscribe();
  }, []);
  
  const allPagePhotos = useMemo(() => {
    if (!report) return [];
    return Object.values(report.completedTasks)
      .flat()
      .flatMap(c => (c as CompletionRecord).photos);
  }, [report]);

  useEffect(() => {
    if (!carouselApi) return;
    setSlideCount(carouselApi.scrollSnapList().length);
    setCurrentSlide(carouselApi.selectedScrollSnap());

    carouselApi.on("select", () => {
      setCurrentSlide(carouselApi.selectedScrollSnap());
    });
  }, [carouselApi, allPagePhotos.length]);

  const openImagePreview = (url: string) => {
    const photoIndex = allPagePhotos.indexOf(url);
    if (photoIndex !== -1) {
        setPreviewImageIndex(photoIndex);
        setIsPreviewOpen(true);
        // We need to re-initialize carousel when dialog opens
        setTimeout(() => carouselApi?.scrollTo(photoIndex, true), 0);
    }
  };

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

  if (isLoading) {
    return (
        <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">
            <header className="mb-8">
                <Skeleton className="h-8 w-48 mb-4" />
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-5 w-1/2 mt-2" />
            </header>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <Skeleton className="h-96 w-full" />
                </div>
                <div className="space-y-8">
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
            </div>
        </div>
    )
  }

  if (!report) {
    return (
        <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">
            <h1 className="text-2xl font-bold">Báo cáo không tìm thấy.</h1>
            <p className="text-muted-foreground">Có thể nó đã bị xóa hoặc bạn không có quyền xem.</p>
             <Button asChild variant="link" className="mt-4 -ml-4">
                <Link href="/reports">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Quay lại tất cả báo cáo
                </Link>
            </Button>
        </div>
    );
  }

  const shift = tasksByShift ? tasksByShift[report.shiftKey] : null;

  if (!shift) {
    return (
        <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">
            <h1 className="text-2xl font-bold">Lỗi dữ liệu ca làm việc.</h1>
            <p className="text-muted-foreground">Không thể tải cấu trúc ca làm việc cho báo cáo này. Vui lòng kiểm tra lại cấu hình.</p>
             <Button asChild variant="link" className="mt-4 -ml-4">
                <Link href="/reports">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Quay lại tất cả báo cáo
                </Link>
            </Button>
        </div>
    );
  }
  
  const getCompletedTaskCount = (completedTasks: TaskCompletion) => {
    const allTasks = shift.sections.flatMap(s => s.tasks);
    let completedCount = 0;
    allTasks.forEach(task => {
        const completions = completedTasks[task.id];
        if (Array.isArray(completions) && completions.length > 0) {
            completedCount++;
        }
    });
    return completedCount;
  };
  
  const totalTaskCount = shift.sections.flatMap(s => s.tasks).length;
  const completedTaskCount = getCompletedTaskCount(report.completedTasks);


  return (
    <>
    <div className="flex flex-col flex-1 p-4 sm:p-6 md:p-8 gap-8">
      <header className="flex flex-col gap-4">
        <Button asChild variant="ghost" className="mb-0 -ml-4 self-start">
            <Link href="/reports">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Quay lại tất cả báo cáo
            </Link>
        </Button>
        <div className="flex justify-between items-start">
            <div>
                 <h1 className="text-2xl md:text-3xl font-bold font-headline">Chi tiết báo cáo</h1>
                <p className="text-muted-foreground">
                Báo cáo ca từ <span className="font-semibold">{report.staffName}</span>, nộp lúc <span className="font-semibold">{new Date(report.submittedAt as string).toLocaleString('vi-VN')}</span>.
                </p>
            </div>
            <div>
                 {report.status === 'submitted' ? (
                    <Badge variant="default" className="text-base">
                        <CheckCircle className="mr-1.5 h-4 w-4" />
                        Đã nộp
                    </Badge>
                ) : (
                    <Badge variant="outline" className="text-blue-600 border-blue-600/50 text-base">
                        <Clock className="mr-1.5 h-4 w-4 animate-pulse" />
                        Đang diễn ra
                    </Badge>
                )}
            </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Nhiệm vụ đã hoàn thành</CardTitle>
                <CardDescription>{completedTaskCount} trên {totalTaskCount} nhiệm vụ đã được đánh dấu là hoàn thành.</CardDescription>
              </CardHeader>
              <CardContent>
                 <Accordion type="multiple" defaultValue={shift.sections.map(s => s.title)} className="w-full space-y-4">
                  {shift.sections.map((section) => (
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
                            const isCompleted = completions.length > 0;
                            
                            return (
                               <div key={task.id} className="flex flex-col gap-3 text-sm p-4 border rounded-md bg-background">
                                <div className="flex items-start gap-4">
                                  <div className={`flex h-5 w-5 items-center justify-center rounded-full flex-shrink-0 mt-0.5 ${isCompleted ? 'bg-accent' : 'bg-muted'}`}>
                                    {isCompleted ? <Check className="h-4 w-4 text-accent-foreground" /> : <X className="h-4 w-4 text-muted-foreground" />}
                                  </div>
                                  <span className={`flex-1 ${!isCompleted ? 'text-muted-foreground' : ''}`}>{task.text}</span>
                                </div>
                                
                                {completions.map((completion, cIndex) => (
                                  <div key={cIndex} className="mt-2 ml-9 rounded-md border bg-card p-3">
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                                          <Clock className="h-4 w-4 flex-shrink-0" />
                                          <span>Thực hiện lúc: {completion.timestamp}</span>
                                      </div>
                                    {completion.photos.length > 0 ? (
                                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                        {completion.photos.map((photo, pIndex) => (
                                            <button key={pIndex} onClick={() => openImagePreview(photo)} className="relative aspect-square overflow-hidden rounded-md group">
                                                <Image src={photo} alt={`Ảnh bằng chứng ${pIndex + 1}`} fill className="object-cover" />
                                            </button>
                                        ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground italic">Không có ảnh nào được cung cấp.</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Camera /> Tổng hợp hình ảnh</CardTitle>
            </CardHeader>
            <CardContent>
              {allPagePhotos.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {allPagePhotos.map((photo, index) => (
                    <button key={index} onClick={() => openImagePreview(photo)} className="relative aspect-video overflow-hidden rounded-md group">
                      <Image src={photo} alt={`Report photo ${index + 1}`} fill className="object-cover" data-ai-hint="work area" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Không có ảnh nào được tải lên cho ca này.</p>
              )}
            </CardContent>
          </Card>

          {report.issues && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MessageSquareWarning /> Vấn đề được báo cáo</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm italic">"{report.issues}"</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
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
    </>
  );
}
