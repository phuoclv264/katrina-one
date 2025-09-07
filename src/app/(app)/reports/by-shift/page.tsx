
'use client';
import { useState, useEffect, useMemo, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Check, Camera, MessageSquareWarning, Clock, X, Image as ImageIcon, Sunrise, Activity, Sunset, CheckCircle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { ShiftReport, CompletionRecord, TasksByShift } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/plugins/counter.css";
import Captions from "yet-another-react-lightbox/plugins/captions";
import "yet-another-react-lightbox/plugins/captions.css";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

function ReportView() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const date = searchParams.get('date');
  const shiftKey = searchParams.get('shiftKey');

  const [reports, setReports] = useState<ShiftReport[]>([]);
  const [tasksByShift, setTasksByShift] = useState<TasksByShift | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'Chủ nhà hàng')) {
        router.replace('/shifts');
        return;
    }
  }, [authLoading, user, router]);
  
  useEffect(() => {
    if (!date || !shiftKey) {
        setIsLoading(false);
        return;
    }

    let isMounted = true;
    const unsubscribeTasks = dataStore.subscribeToTasks((tasks) => {
      if (isMounted) setTasksByShift(tasks);
    });

    const unsubscribeReports = dataStore.subscribeToReportsForShift(date, shiftKey, (fetchedReports) => {
      if (isMounted) {
        setReports(fetchedReports);
        if (fetchedReports.length > 0 && !selectedReportId) {
            setSelectedReportId(fetchedReports[0].id);
        } else if (fetchedReports.length === 0) {
            setSelectedReportId(null);
        }
        setIsLoading(false);
      }
    });

    return () => {
        isMounted = false;
        unsubscribeTasks();
        unsubscribeReports();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, shiftKey]);

  const report = useMemo(() => {
    return reports.find(r => r.id === selectedReportId) || null;
  }, [reports, selectedReportId]);
  
  const shift = useMemo(() => {
    return tasksByShift && shiftKey ? tasksByShift[shiftKey] : null;
  }, [tasksByShift, shiftKey]);
  
  const allPagePhotos = useMemo(() => {
    if (!shift || !report) return [];

    const findTaskText = (taskId: string): string => {
        for (const section of shift.sections) {
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
            if (completion.photos) {
              for (const photoUrl of completion.photos) {
                  photos.push({
                      src: photoUrl,
                      description: `${taskText}\nThực hiện lúc: ${completion.timestamp}`
                  });
              }
            }
        }
    }
    return photos;
  }, [shift, report]);

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

  if (isLoading || authLoading) {
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

  if (!date || !shiftKey || reports.length === 0) {
    return (
        <div className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8">
            <h1 className="text-2xl font-bold">Không tìm thấy báo cáo.</h1>
            <p className="text-muted-foreground">Không có báo cáo nào được nộp cho ca này vào ngày đã chọn.</p>
             <Button asChild variant="link" className="mt-4 -ml-4">
                <Link href="/reports">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Quay lại tất cả báo cáo
                </Link>
            </Button>
        </div>
    );
  }

  if (!shift) {
    return (
        <div className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8">
            <h1 className="text-2xl font-bold">Lỗi dữ liệu ca làm việc.</h1>
            <p className="text-muted-foreground">Không thể tải cấu trúc ca làm việc cho báo cáo này.</p>
        </div>
    );
  }

  return (
    <>
    <div className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8">
      <header className="mb-8">
        <Button asChild variant="ghost" className="mb-4 -ml-4">
            <Link href="/reports">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Quay lại danh sách
            </Link>
        </Button>
        <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
            <div>
                 <h1 className="text-2xl md:text-3xl font-bold font-headline">Báo cáo {shift.name}</h1>
                <p className="text-muted-foreground">
                Ngày {new Date(date).toLocaleDateString('vi-VN')}
                </p>
            </div>
            <Card className="w-full md:w-auto md:min-w-[250px]">
                <CardHeader className="p-3">
                     <CardTitle className="text-sm font-medium flex items-center gap-2"><Users className="h-4 w-4"/>Chọn nhân viên</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                    <Select onValueChange={setSelectedReportId} value={selectedReportId || ''}>
                        <SelectTrigger>
                            <SelectValue placeholder="Chọn một nhân viên..." />
                        </SelectTrigger>
                        <SelectContent>
                            {reports.map(r => (
                                <SelectItem key={r.id} value={r.id}>{r.staffName}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>
        </div>
      </header>

    {!report ? (
        <div className="text-center py-16 text-muted-foreground">
            <p>Vui lòng chọn một nhân viên để xem báo cáo.</p>
        </div>
    ) : (
      <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Nhiệm vụ đã hoàn thành</CardTitle>
               <CardDescription>
                Báo cáo từ <span className="font-semibold">{report.staffName}</span>, nộp lúc <span className="font-semibold">{new Date(report.submittedAt as string).toLocaleString('vi-VN')}</span>.
                </CardDescription>
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
                                        {completion.photos && completion.photos.length > 0 ? (
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
                <CardTitle className="flex items-center gap-2 text-xl"><MessageSquareWarning /> Vấn đề được báo cáo</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm italic bg-amber-100/60 p-4 rounded-md border border-amber-200">"{report.issues}"</p>
              </CardContent>
            </Card>
          )}
      </div>
    )}
    </div>
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
            descriptionMaxLines: 5,
        }}
    />
    </>
  );
}

export default function ByShiftPage() {
    return (
        <Suspense fallback={<div>Đang tải...</div>}>
            <ReportView />
        </Suspense>
    )
}

    