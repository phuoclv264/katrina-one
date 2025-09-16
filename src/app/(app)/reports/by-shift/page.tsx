
'use client';
import { useState, useEffect, useMemo, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Check, Camera, MessageSquareWarning, Clock, X, Image as ImageIcon, Sunrise, Activity, Sunset, CheckCircle, Users, Trash2, Loader2, AlertCircle, FilePen, Info, ListTodo, UserCheck, ListX, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { ShiftReport, CompletionRecord, TasksByShift, Shift, Schedule } from '@/lib/types';
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
import { getISOWeek } from 'date-fns';


function ShiftSummaryCard({ 
    shift, 
    reports, 
    schedule,
    onViewPhotos 
}: { 
    shift: Shift, 
    reports: ShiftReport[],
    schedule: Schedule | null,
    onViewPhotos: (photos: {src: string, description: string}[], startIndex: number) => void
}) {
    const summary = useMemo(() => {
        const allCompletedTasks = new Map<string, { staffName: string; timestamp: string, photos?: string[] }[]>();
        reports.forEach(report => {
            for (const taskId in report.completedTasks) {
                if (!allCompletedTasks.has(taskId)) {
                    allCompletedTasks.set(taskId, []);
                }
                const completionsWithStaff = report.completedTasks[taskId].map(comp => ({
                    staffName: report.staffName,
                    timestamp: comp.timestamp,
                    photos: comp.photos
                }));
                allCompletedTasks.get(taskId)!.push(...completionsWithStaff);
            }
        });

        const startShiftSection = shift.sections.find(s => s.title === 'Đầu ca');
        const endShiftSection = shift.sections.find(s => s.title === 'Cuối ca');
        const inShiftSection = shift.sections.find(s => s.title === 'Trong ca');

        const uncompletedStartShiftTasks = startShiftSection?.tasks.filter(task => !allCompletedTasks.has(task.id)) || [];
        const uncompletedInShiftTasks = inShiftSection?.tasks.filter(task => !allCompletedTasks.has(task.id)) || [];
        const uncompletedEndShiftTasks = endShiftSection?.tasks.filter(task => !allCompletedTasks.has(task.id)) || [];
            
        const completedInShiftTasks = inShiftSection?.tasks
            .map(task => ({
                taskText: task.text,
                completions: allCompletedTasks.get(task.id) || [],
            }))
            .filter(item => item.completions.length > 0) || [];
        
        const allStartShiftTasksUncompleted = startShiftSection ? uncompletedStartShiftTasks.length === startShiftSection.tasks.length : false;
        const allEndShiftTasksUncompleted = endShiftSection ? uncompletedEndShiftTasks.length === endShiftSection.tasks.length : false;
        
        const assignedUsers = schedule?.shifts.find(s => s.date === reports[0]?.date && s.label === shift.name)?.assignedUsers.map(u => u.userName) || [];
        const submittedUsers = Array.from(new Set(reports.map(r => r.staffName)));
        const absentUsers = assignedUsers.filter(u => !submittedUsers.includes(u));

        return { 
            uncompletedStartShiftTasks, 
            uncompletedInShiftTasks,
            uncompletedEndShiftTasks, 
            completedInShiftTasks,
            allStartShiftTasksUncompleted,
            allEndShiftTasksUncompleted,
            assignedUsers,
            submittedUsers,
            absentUsers
        };
    }, [shift, reports, schedule]);

    const hasUncompleted = summary.uncompletedStartShiftTasks.length > 0 || summary.uncompletedEndShiftTasks.length > 0 || summary.uncompletedInShiftTasks.length > 0;
    const hasInShiftCompletions = summary.completedInShiftTasks.length > 0;

    if (!hasUncompleted && !hasInShiftCompletions && summary.absentUsers.length === 0) {
        return null; // Don't render the card if there's nothing to show
    }

    return (
        <Card className="mb-8 border-amber-500/50 bg-amber-50/20 dark:bg-amber-900/10">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <Info className="h-5 w-5" /> Tóm tắt báo cáo ca
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                
                <div>
                    <h4 className="font-semibold flex items-center gap-2 mb-2"><Users/> Chuyên cần</h4>
                    <div className="space-y-3">
                         <div className="p-3 bg-card rounded-md border">
                            <p className="font-medium text-sm mb-1 text-muted-foreground">Nhân viên được phân công:</p>
                             <p className="text-sm">{summary.assignedUsers.length > 0 ? summary.assignedUsers.join(', ') : 'Không có ai.'}</p>
                        </div>
                        {summary.absentUsers.length > 0 && (
                            <div className="p-3 bg-destructive/10 rounded-md border border-destructive/30">
                                <p className="font-medium text-sm mb-1 text-destructive">Nhân viên vắng (không nộp báo cáo):</p>
                                <p className="text-sm font-semibold text-destructive">{summary.absentUsers.join(', ')}</p>
                            </div>
                        )}
                    </div>
                </div>

                {hasUncompleted && (
                     <div>
                        <h4 className="font-semibold flex items-center gap-2 mb-2"><ListX/> Công việc chưa hoàn thành</h4>
                        <div className="space-y-3">
                        {summary.uncompletedStartShiftTasks.length > 0 && (
                            <div className="p-3 bg-card rounded-md border">
                                <p className="font-medium text-sm mb-1 text-muted-foreground">Đầu ca:</p>
                                {summary.allStartShiftTasksUncompleted ? (
                                    <p className="text-sm italic">Toàn bộ các công việc đầu ca chưa được thực hiện.</p>
                                ) : (
                                    <ul className="list-disc pl-5 space-y-1 text-sm">
                                        {summary.uncompletedStartShiftTasks.map(task => <li key={task.id}>{task.text}</li>)}
                                    </ul>
                                )}
                            </div>
                        )}
                        {summary.uncompletedInShiftTasks.length > 0 && (
                            <div className="p-3 bg-card rounded-md border">
                                <p className="font-medium text-sm mb-1 text-muted-foreground">Trong ca:</p>
                                <ul className="list-disc pl-5 space-y-1 text-sm">
                                    {summary.uncompletedInShiftTasks.map(task => <li key={task.id}>{task.text}</li>)}
                                </ul>
                            </div>
                        )}
                        {summary.uncompletedEndShiftTasks.length > 0 && (
                             <div className="p-3 bg-card rounded-md border">
                                <p className="font-medium text-sm mb-1 text-muted-foreground">Cuối ca:</p>
                                {summary.allEndShiftTasksUncompleted ? (
                                    <p className="text-sm italic">Toàn bộ các công việc cuối ca chưa được thực hiện.</p>
                                ) : (
                                    <ul className="list-disc pl-5 space-y-1 text-sm">
                                        {summary.uncompletedEndShiftTasks.map(task => <li key={task.id}>{task.text}</li>)}
                                    </ul>
                                )}
                            </div>
                        )}
                        </div>
                    </div>
                )}
                {hasInShiftCompletions && (
                     <div>
                        <h4 className="font-semibold flex items-center gap-2 mb-2"><ListTodo/> Công việc đã làm trong ca</h4>
                         <div className="space-y-3">
                            {summary.completedInShiftTasks.map(item => (
                                <div key={item.taskText} className="p-3 bg-card rounded-md border">
                                    <p className="font-medium mb-2">{item.taskText}</p>
                                    <ul className="space-y-1">
                                        {item.completions.map((comp, index) => (
                                            <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <UserCheck className="h-4 w-4 text-green-500" />
                                                <span className="font-semibold text-foreground">{comp.staffName}</span>
                                                <span>lúc</span>
                                                <span className="font-mono">{comp.timestamp}</span>
                                                 {(comp.photos && comp.photos.length > 0) && (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-6 w-6 ml-auto" 
                                                        onClick={() => {
                                                            const slides = comp.photos!.map(p => ({ 
                                                                src: p, 
                                                                description: `${item.taskText}\nThực hiện bởi: ${comp.staffName}\nLúc: ${comp.timestamp}`
                                                            }));
                                                            onViewPhotos(slides, 0);
                                                        }}>
                                                        <ImageIcon className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}


function ReportView() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const date = searchParams.get('date');
  const shiftKey = searchParams.get('shiftKey');

  const [reports, setReports] = useState<ShiftReport[]>([]);
  const [tasksByShift, setTasksByShift] = useState<TasksByShift | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxSlides, setLightboxSlides] = useState<{ src: string, description?: string }[]>([]);
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

    const weekId = `${new Date(date).getFullYear()}-W${getISOWeek(new Date(date))}`;
    const unsubscribeSchedule = dataStore.subscribeToSchedule(weekId, (sch) => {
         if (isMounted) setSchedule(sch);
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
        unsubscribeSchedule();
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
  
  const openLightbox = (slides: {src: string, description?: string}[], startIndex: number = 0) => {
      setLightboxSlides(slides);
      setLightboxIndex(startIndex);
      setIsLightboxOpen(true);
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
    const reportNameToDelete = reportToView.staffName;
    try {
        await dataStore.deleteShiftReport(reportToView.id);
        toast({
            title: "Đã xóa báo cáo",
            description: `Báo cáo của ${reportNameToDelete} đã được xóa thành công.`,
        });
        // The useEffect will handle the state update and re-selection
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

      <ShiftSummaryCard 
        shift={shift} 
        reports={reports} 
        schedule={schedule} 
        onViewPhotos={openLightbox}
        />

    {!reportToView ? (
        <div className="text-center py-16 text-muted-foreground">
            <p>Vui lòng chọn một chế độ xem.</p>
        </div>
    ) : (
      <div className="space-y-8">
           <Accordion type="single" collapsible value={isDetailViewOpen ? 'details' : ''} onValueChange={(value) => setIsDetailViewOpen(value === 'details')}>
              <AccordionItem value="details" className="border-none">
                  <div className="text-center">
                    <AccordionTrigger className="inline-flex hover:no-underline text-muted-foreground">
                       {isDetailViewOpen ? 'Ẩn báo cáo chi tiết' : 'Hiển thị báo cáo chi tiết'}
                    </AccordionTrigger>
                  </div>
                   <AccordionContent>
                      <Card className="mt-4">
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
                                                                  onClick={() => {
                                                                      const slides = completion.photos!.map(p => ({
                                                                          src: p,
                                                                          description: `${task.text}\nThực hiện bởi: ${(completion as any).staffName || reportToView.staffName}\nLúc: ${completion.timestamp}`
                                                                      }));
                                                                      const currentPhotoIndex = completion.photos!.findIndex(p => p === photo);
                                                                      openLightbox(slides, currentPhotoIndex);
                                                                  }}
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
                   </AccordionContent>
              </AccordionItem>
            </Accordion>
          
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
        slides={lightboxSlides}
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
