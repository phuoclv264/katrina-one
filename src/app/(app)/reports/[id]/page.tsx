
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
import { ArrowLeft, Check, Camera, MessageSquareWarning, Clock, X, Image as ImageIcon, Sunrise, Activity, Sunset, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { ShiftReport, TaskCompletion, CompletionRecord, TasksByShift } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/plugins/counter.css";

export default function ReportDetailPage() {
  const params = useParams();
  const reportId = params.id as string;
  const [report, setReport] = useState<ShiftReport | null | undefined>(undefined);
  const [tasksByShift, setTasksByShift] = useState<TasksByShift | null>(null);

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

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
      .flatMap(c => (c as CompletionRecord).photos.map(photoUrl => ({src: photoUrl})));
  }, [report]);

  const openLightbox = (photoUrl: string) => {
    const photoIndex = allPagePhotos.findIndex(p => p.src === photoUrl);
    if (photoIndex > -1) {
        setLightboxIndex(photoIndex);
        setIsLightboxOpen(true);
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
        case 'Đầu ca': return 'border-yellow-500/80';
        case 'Trong ca': return 'border-sky-500/80';
        case 'Cuối ca': return 'border-indigo-500/80';
        default: return 'border-border';
    }
  }

  if (isLoading) {
    return (
        <div className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8">
            <header className="mb-8">
                <Skeleton className="h-8 w-48 mb-4" />
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-5 w-1/2 mt-2" />
            </header>
            <div className="space-y-8">
                <Skeleton className="h-96 w-full" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-32 w-full" />
            </div>
        </div>
    )
  }

  if (!report) {
    return (
        <div className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8">
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
        <div className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8">
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
    <div className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8">
      <header className="mb-8">
        <Button asChild variant="ghost" className="mb-4 -ml-4">
            <Link href="/reports">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Quay lại tất cả báo cáo
            </Link>
        </Button>
        <div className="flex justify-between items-start">
            <div>
                 <h1 className="text-2xl md:text-3xl font-bold font-headline">Chi tiết báo cáo {shift.name}</h1>
                <p className="text-muted-foreground">
                Báo cáo từ <span className="font-semibold">{report.staffName}</span>, nộp lúc <span className="font-semibold">{new Date(report.submittedAt as string).toLocaleString('vi-VN')}</span>.
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

      <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Nhiệm vụ đã hoàn thành</CardTitle>
              <CardDescription>{completedTaskCount} trên {totalTaskCount} nhiệm vụ đã được đánh dấu là hoàn thành.</CardDescription>
            </CardHeader>
            <CardContent>
                <Accordion type="multiple" defaultValue={shift.sections.map(s => s.title)} className="w-full space-y-4">
                {shift.sections.map((section) => (
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
                          const isCompleted = completions.length > 0;
                          
                          return (
                              <div key={task.id} className={`rounded-md border p-4 transition-colors ${isCompleted ? 'bg-accent/20' : ''}`}>
                                <div className="flex items-start gap-4">
                                  <div className="flex-1">
                                      <div className="flex items-center gap-3">
                                          <div className={`flex h-5 w-5 items-center justify-center rounded-full flex-shrink-0 mt-0.5 ${isCompleted ? 'bg-green-500/20 text-green-700' : 'bg-muted'}`}>
                                            {isCompleted ? <Check className="h-4 w-4" /> : <X className="h-4 w-4 text-muted-foreground" />}
                                          </div>
                                          <p className={`font-semibold ${!isCompleted ? 'text-muted-foreground' : ''}`}>
                                            {task.text}
                                          </p>
                                      </div>
                                  </div>
                                </div>
                                
                                {isCompleted && (
                                    <div className="mt-4 ml-8 space-y-3 pl-3 border-l-2">
                                    {completions.map((completion, cIndex) => (
                                    <div key={cIndex} className="rounded-md border bg-card p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Clock className="h-4 w-4 flex-shrink-0" />
                                                <span>Thực hiện lúc: {completion.timestamp}</span>
                                            </div>
                                        </div>
                                        {completion.photos.length > 0 ? (
                                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                                            {completion.photos.map((photo, pIndex) => (
                                                <button
                                                  onClick={() => openLightbox(photo)}
                                                  key={photo.slice(0, 50) + pIndex}
                                                  className="relative z-0 overflow-hidden aspect-square rounded-md group bg-muted"
                                                >
                                                  <Image src={photo} alt={`Ảnh bằng chứng ${pIndex + 1}`} fill className="object-cover" />
                                                </button>
                                            ))}
                                            </div>
                                        ): (
                                            <p className="text-xs text-muted-foreground italic">Không có ảnh nào được chụp cho lần thực hiện này.</p>
                                        )}
                                    </div>
                                    ))}
                                    </div>
                                )}
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
          
          {report.issues && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MessageSquareWarning /> Vấn đề được báo cáo</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm italic bg-amber-100/60 p-4 rounded-md border border-amber-200">"{report.issues}"</p>
              </CardContent>
            </Card>
          )}

           <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ImageIcon /> Toàn bộ hình ảnh</CardTitle>
              <CardDescription>Tổng hợp tất cả hình ảnh từ báo cáo này.</CardDescription>
            </CardHeader>
            <CardContent>
              {allPagePhotos.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {allPagePhotos.map((photo, index) => (
                     <button
                        onClick={() => openLightbox(photo.src)}
                        key={index}
                        className="relative aspect-square overflow-hidden rounded-md group bg-muted"
                      >
                        <Image src={photo.src} alt={`Report photo ${index + 1}`} fill className="object-cover" data-ai-hint="work area" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                    <p>Không có ảnh nào được tải lên cho ca này.</p>
                </div>
              )}
            </CardContent>
          </Card>
      </div>
    </div>
     <Lightbox
        open={isLightboxOpen}
        close={() => setIsLightboxOpen(false)}
        slides={allPagePhotos}
        index={lightboxIndex}
        plugins={[Zoom, Counter]}
        zoom={{ maxZoomPixelRatio: 4 }}
        counter={{ container: { style: { top: "unset", bottom: 0 } } }}
    />
    </>
  );
}

    