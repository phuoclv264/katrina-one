
'use client';
import { useState, useEffect, useMemo, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Check, Camera, MessageSquareWarning, Clock, X, Image as ImageIcon, Sunrise, Activity, Sunset, CheckCircle, Users, Trash2, Loader2, AlertCircle, FilePen } from 'lucide-react';
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, } from '@/components/ui/alert-dialog';


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
  const [isProcessing, setIsProcessing] = useState(false);

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // --- Back button handling for Lightbox ---
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (isLightboxOpen) {
        event.preventDefault();
        setIsLightboxOpen(false);
      }
    };

    if (isLightboxOpen) {
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isLightboxOpen]);


  useEffect(() => {
    if (!authLoading && (!user || (user.role !== 'Chủ nhà hàng' && user.role !== 'Quản lý'))) {
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
        
        // If the selected report was deleted, default to summary or null
        if (selectedReportId && !fetchedReports.some(r => r.id === selectedReportId) && selectedReportId !== 'summary') {
            setSelectedReportId(fetchedReports.length > 0 ? 'summary' : null);
        } else if (!selectedReportId && fetchedReports.length > 0) {
            setSelectedReportId('summary');
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

    const reportToView = useMemo(() => {
        if (!selectedReportId) return null;
        if (selectedReportId === 'summary') {
            const combinedTasks: { [taskId: string]: CompletionRecord[] } = {};
            let combinedIssues: string[] = [];

            reports.forEach(report => {
                // Combine tasks
                for (const taskId in report.completedTasks) {
                    if (!combinedTasks[taskId]) {
                        combinedTasks[taskId] = [];
                    }
                    const tasksWithStaffName = report.completedTasks[taskId].map(comp => ({
                        ...comp,
                        staffName: report.staffName // Inject staffName into each completion
                    }));
                    combinedTasks[taskId].push(...tasksWithStaffName);
                }
                 // Combine issues
                if (report.issues) {
                    combinedIssues.push(`${report.staffName}: ${report.issues}`);
                }
            });

             // Sort completions for each task chronologically (newest first)
            for (const taskId in combinedTasks) {
                combinedTasks[taskId].sort((a, b) => {
                    const timeA = a.timestamp.replace(':', '');
                    const timeB = b.timestamp.replace(':', '');
                    return timeB.localeCompare(timeA); // Sort descending
                });
            }

             return {
                id: 'summary',
                staffName: 'Tổng hợp',
                shiftKey: shiftKey as string,
                date: date as string,
                completedTasks: combinedTasks,
                issues: combinedIssues.length > 0 ? combinedIssues.join('\n\n') : null,
            } as unknown as ShiftReport;
        }
        return reports.find(r => r.id === selectedReportId) || null;
    }, [reports, selectedReportId, shiftKey, date]);
  
  const shift = useMemo(() => {
    return tasksByShift && shiftKey ? tasksByShift[shiftKey] : null;
  }, [tasksByShift, shiftKey]);
  
  const allPagePhotos = useMemo(() => {
    if (!shift || !reportToView) return [];

    const findTaskText = (taskId: string): string => {
        for (const section of shift.sections) {
            const task = section.tasks.find(t => t.id === taskId);
            if (task) return task.text;
        }
        return "Nhiệm vụ không xác định";
    };

    const photos: { src: string, description: string }[] = [];
    for (const taskId in reportToView.completedTasks) {
        const taskText = findTaskText(taskId);
        const completions = reportToView.completedTasks[taskId] as CompletionRecord[];
        for (const completion of completions) {
            if (completion.photos) {
              for (const photoUrl of completion.photos) {
                  const staffCredit = (completion as any).staffName ? `Thực hiện bởi: ${(completion as any).staffName}\n` : '';
                  photos.push({
                      src: photoUrl,
                      description: `${taskText}\n${staffCredit}Lúc: ${completion.timestamp}`
                  });
              }
            }
        }
    }
    return photos;
  }, [shift, reportToView]);

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

  const handleDeleteReport = async () => {
    if (!reportToView || reportToView.id === 'summary' || user?.role !== 'Chủ nhà hàng') return;
    setIsProcessing(true);
    try {
        await dataStore.deleteShiftReport(reportToView.id);
        toast({
            title: "Đã xóa báo cáo",
            description: `Báo cáo của ${reportToView.staffName} đã được xóa thành công.`,
        });
    } catch(error) {
        console.error("Error deleting report:", error);
        toast({
            title: "Lỗi",
            description: "Không thể xóa báo cáo. Vui lòng thử lại.",
            variant: "destructive"
        });
    } finally {
        setIsProcessing(false);
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
            <Link href={user?.role === 'Quản lý' ? '/manager' : '/reports'}>
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
                     <CardTitle className="text-sm font-medium flex items-center gap-2"><Users className="h-4 w-4"/>Chế độ xem</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                    <div className="flex items-center gap-2">
                        <Select onValueChange={setSelectedReportId} value={selectedReportId || ''} disabled={isProcessing}>
                            <SelectTrigger>
                                <SelectValue placeholder="Chọn chế độ xem..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="summary">Tổng hợp</SelectItem>
                                {reports.map(r => (
                                    <SelectItem key={r.id} value={r.id}>{r.staffName}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {user?.role === 'Chủ nhà hàng' && selectedReportId && selectedReportId !== 'summary' && (
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="icon" disabled={isProcessing}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="flex items-center gap-2">
                                            <AlertCircle className="text-destructive"/>
                                            Xác nhận xóa báo cáo?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Hành động này sẽ xóa vĩnh viễn báo cáo của <span className="font-bold">{reportToView?.staffName}</span> và tất cả hình ảnh liên quan. Hành động này không thể được hoàn tác.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDeleteReport}>Xóa vĩnh viễn</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
      </header>

    {!reportToView ? (
        <div className="text-center py-16 text-muted-foreground">
            <p>Vui lòng chọn một chế độ xem.</p>
        </div>
    ) : (
      <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Nhiệm vụ đã hoàn thành</CardTitle>
               <CardDescription>
                {selectedReportId === 'summary' 
                    ? `Tổng hợp báo cáo từ ${reports.length} nhân viên.`
                    : `Báo cáo từ ${reportToView.staffName}, nộp lúc ${new Date(reportToView.submittedAt as string).toLocaleString('vi-VN', {hour12: false})}.`
                }
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
                          const completions = (reportToView.completedTasks[task.id] || []) as CompletionRecord[];
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
                                        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Clock className="h-4 w-4 flex-shrink-0" />
                                                <span>Thực hiện lúc: {completion.timestamp}</span>
                                            </div>
                                             {selectedReportId === 'summary' && (
                                                <Badge variant="secondary" className="font-normal">
                                                   {(completion as any).staffName}
                                                </Badge>
                                            )}
                                        </div>
                                        
                                        {task.type === 'photo' && (
                                            completion.photos && completion.photos.length > 0 ? (
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
                                            )
                                        )}

                                        {task.type === 'boolean' && completion.value !== undefined && (
                                            <Badge variant={completion.value ? 'default' : 'destructive'}>
                                                {completion.value ? 'Đảm bảo' : 'Không đảm bảo'}
                                            </Badge>
                                        )}
                                        
                                        {task.type === 'opinion' && (
                                            completion.opinion ? (
                                                <p className="text-sm italic bg-muted p-3 rounded-md border">"{completion.opinion}"</p>
                                            ) : (
                                                <p className="text-xs text-muted-foreground italic">Đã ghi nhận, không có ý kiến chi tiết.</p>
                                            )
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
          
          {reportToView.issues && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl"><MessageSquareWarning /> Vấn đề được báo cáo</CardTitle>
              </CardHeader>
              <CardContent>
                 <div className="text-sm italic bg-amber-100/60 p-4 rounded-md border border-amber-200 whitespace-pre-wrap">{reportToView.issues}</div>
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
