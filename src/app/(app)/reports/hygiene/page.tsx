

'use client';
import { useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import Image from '@/components/ui/image';
import { useSearchParams } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import { getQueryParamWithMobileHashFallback } from '@/lib/url-params';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Check, Camera, MessageSquareWarning, Clock, X, Droplets, UtensilsCrossed, Wind, Users, Trash2, Loader2, AlertCircle, MessageSquareText, LayoutDashboard, CheckCircle2, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { ShiftReport, CompletionRecord, TaskSection } from '@/lib/types';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { Combobox } from '@/components/combobox';
import { useAuth } from '@/hooks/use-auth';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import { useToast } from '@/components/ui/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogIcon, AlertDialogTitle, AlertDialogTrigger, } from '@/components/ui/alert-dialog';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';
import { useLightbox } from '@/contexts/lightbox-context';
import { useRouter } from 'nextjs-toploader/app';

function HygieneReportView() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const date = getQueryParamWithMobileHashFallback({
        param: 'date',
        searchParams,
        hash: typeof window !== 'undefined' ? window.location.hash : '',
    });
    const shiftKey = 'bartender_hygiene';

    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const handleDataRefresh = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
    }, []);

    const [reports, setReports] = useState<ShiftReport[]>([]);
    const [taskSections, setTaskSections] = useState<TaskSection[] | null>(null);
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const { openLightbox } = useLightbox();


    useEffect(() => {
        if (!authLoading && (!user || (user.role !== 'Chủ nhà hàng' && user.role !== 'Quản lý'))) {
            router.replace('/shifts');
            return;
        }
    }, [authLoading, user, router]);

    useEffect(() => {
        if (!date) {
            setIsLoading(false);
            return;
        }

        let isMounted = true;
        const unsubscribeTasks = dataStore.subscribeToBartenderTasks((tasks) => {
            if (isMounted) setTaskSections(tasks);
        });

        const reportsQuery = query(collection(db, "reports"), where('date', '==', date), where('shiftKey', '==', shiftKey), where('status', '==', 'submitted'));
        const unsubscribeReports = onSnapshot(reportsQuery, (querySnapshot) => {
            if (isMounted) {
                const fetchedReports: ShiftReport[] = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    submittedAt: (doc.data().submittedAt as Timestamp)?.toDate().toISOString(),
                } as ShiftReport));

                setReports(fetchedReports);

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
    }, [date, selectedReportId, refreshTrigger]);

    useDataRefresher(handleDataRefresh);

    const reportToView = useMemo(() => {
        if (!selectedReportId) return null;
        if (selectedReportId === 'summary') {
            const combinedTasks: { [taskId: string]: CompletionRecord[] } = {};
            let combinedIssues: string[] = [];

            reports.forEach(report => {
                for (const taskId in report.completedTasks) {
                    if (!combinedTasks[taskId]) {
                        combinedTasks[taskId] = [];
                    }
                    const tasksWithStaffName = report.completedTasks[taskId].map(comp => ({
                        ...comp,
                        staffName: report.staffName
                    }));
                    combinedTasks[taskId].push(...tasksWithStaffName);
                }
                if (report.issues) {
                    combinedIssues.push(`${report.staffName}: ${report.issues}`);
                }
            });

            for (const taskId in combinedTasks) {
                combinedTasks[taskId].sort((a, b) => {
                    const timeA = a.timestamp.replace(':', '');
                    const timeB = b.timestamp.replace(':', '');
                    return timeB.localeCompare(timeA);
                });
            }

            return {
                id: 'summary',
                staffName: 'Tổng hợp',
                shiftKey,
                date: date as string,
                completedTasks: combinedTasks,
                issues: combinedIssues.length > 0 ? combinedIssues.join('\n\n') : null,
            } as unknown as ShiftReport;
        }
        return reports.find(r => r.id === selectedReportId) || null;
    }, [reports, selectedReportId, shiftKey, date]);

    const allPagePhotos = useMemo(() => {
        if (!taskSections || !reportToView) return [];

        const findTaskText = (taskId: string): string => {
            for (const section of taskSections) {
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
    }, [taskSections, reportToView]);

    const handleOpenLightbox = (photoUrl: string) => {
        const photoIndex = allPagePhotos.findIndex(p => p.src === photoUrl);
        if (photoIndex > -1) openLightbox(allPagePhotos, photoIndex);
    };

    const getSectionIcon = (title: string) => {
        switch (title) {
            case 'Vệ sinh khu vực pha chế': return <Droplets className="h-5 w-5" />;
            case 'Vệ sinh dụng cụ': return <UtensilsCrossed className="h-5 w-5" />;
            case 'Vệ sinh thiết bị': return <Wind className="h-5 w-5" />;
            default: return null;
        }
    }

    const SECTION_STYLES = [
        {
            bg: 'bg-blue-100 dark:bg-blue-900/30',
            text: 'text-blue-600 dark:text-blue-400',
            border: 'border-blue-200 dark:border-blue-800',
            cardBg: 'bg-blue-50/30 dark:bg-blue-900/10',
            cardBorder: 'border-blue-100 dark:border-blue-900',
            iconBg: 'bg-blue-500 shadow-blue-500/20'
        },
        {
            bg: 'bg-green-100 dark:bg-green-900/30',
            text: 'text-green-600 dark:text-green-400',
            border: 'border-green-200 dark:border-green-800',
            cardBg: 'bg-green-50/30 dark:bg-green-900/10',
            cardBorder: 'border-green-100 dark:border-green-900',
            iconBg: 'bg-green-500 shadow-green-500/20'
        },
        {
            bg: 'bg-purple-100 dark:bg-purple-900/30',
            text: 'text-purple-600 dark:text-purple-400',
            border: 'border-purple-200 dark:border-purple-800',
            cardBg: 'bg-purple-50/30 dark:bg-purple-900/10',
            cardBorder: 'border-purple-100 dark:border-purple-900',
            iconBg: 'bg-purple-500 shadow-purple-500/20'
        },
        {
            bg: 'bg-amber-100 dark:bg-amber-900/30',
            text: 'text-amber-600 dark:text-amber-400',
            border: 'border-amber-200 dark:border-amber-800',
            cardBg: 'bg-amber-50/30 dark:bg-amber-900/10',
            cardBorder: 'border-amber-100 dark:border-amber-900',
            iconBg: 'bg-amber-500 shadow-amber-500/20'
        },
        {
            bg: 'bg-cyan-100 dark:bg-cyan-900/30',
            text: 'text-cyan-600 dark:text-cyan-400',
            border: 'border-cyan-200 dark:border-cyan-800',
            cardBg: 'bg-cyan-50/30 dark:bg-cyan-900/10',
            cardBorder: 'border-cyan-100 dark:border-cyan-900',
            iconBg: 'bg-cyan-500 shadow-cyan-500/20'
        }
    ];

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
        } catch (error) {
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

    const totalTasksCount = useMemo(() => {
        if (!taskSections) return 0;
        return taskSections.reduce((acc, section) => acc + section.tasks.length, 0);
    }, [taskSections]);

    const completedTasksStats = useMemo(() => {
        if (!reportToView || !taskSections) return { count: 0, percentage: 0 };
        let count = 0;
        taskSections.forEach(section => {
            section.tasks.forEach(task => {
                if (reportToView.completedTasks[task.id] && reportToView.completedTasks[task.id].length > 0) {
                    count++;
                }
            });
        });
        return {
            count,
            percentage: totalTasksCount > 0 ? Math.round((count / totalTasksCount) * 100) : 0
        };
    }, [reportToView, taskSections, totalTasksCount]);

    if (isLoading || authLoading) {
        return <LoadingPage />;
    }

    if (!date || reports.length === 0) {
        return (
            <div className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8">
                <h1 className="text-2xl font-bold">Không tìm thấy báo cáo.</h1>
                <p className="text-muted-foreground">Không có báo cáo vệ sinh nào được nộp vào ngày đã chọn.</p>
            </div>
        );
    }

    if (!taskSections) {
        return (
            <div className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8">
                <h1 className="text-2xl font-bold">Lỗi dữ liệu công việc.</h1>
                <p className="text-muted-foreground">Không thể tải cấu trúc công việc cho báo cáo này.</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-5xl p-4 sm:p-6 md:p-8 space-y-8">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight font-headline bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                        Báo cáo Vệ sinh quầy
                    </h1>
                    <div className="flex items-center gap-2 mt-2 text-muted-foreground bg-muted/50 w-fit px-3 py-1 rounded-full border">
                        <History className="h-4 w-4" />
                        <span className="text-sm font-medium">
                            {new Date(date).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                    </div>
                </div>

                <Card className="w-full md:w-auto overflow-hidden border-2 shadow-lg shadow-blue-500/5">
                    <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                            <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-[200px]">
                                <Combobox
                                    value={selectedReportId || ''}
                                    onChange={(val) => setSelectedReportId(val as string)}
                                    options={[
                                        ...(reports.length > 1 ? [{ value: "summary", label: "Tổng hợp toàn bộ" }] : []),
                                        ...reports.map(r => ({ value: r.id, label: r.staffName }))
                                    ]}
                                    placeholder="Chọn nhân viên xem báo cáo..."
                                    compact
                                    searchable={false}
                                    disabled={isProcessing}
                                    className="w-full border-none focus-visible:ring-0 shadow-none bg-transparent"
                                />
                            </div>
                            {user?.role === 'Chủ nhà hàng' && selectedReportId && selectedReportId !== 'summary' && (
                                <AlertDialog dialogTag="alert-dialog" parentDialogTag="root" variant="destructive">
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" disabled={isProcessing} className="text-destructive hover:bg-destructive/10">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogIcon icon={Trash2} />
                                            <div className="space-y-2 text-center sm:text-left">
                                                <AlertDialogTitle>Xác nhận xóa báo cáo?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Hành động này sẽ xóa vĩnh viễn báo cáo của <span className="font-bold">{reportToView?.staffName}</span> và tất cả hình ảnh liên quan. Hành động này không thể được hoàn tác.
                                                </AlertDialogDescription>
                                            </div>
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
            </header>

            {!reportToView ? (
                <div className="text-center py-24 bg-muted/20 border-2 border-dashed rounded-3xl">
                    <div className="bg-background w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <Users className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-xl font-medium text-muted-foreground">Vui lòng chọn một nhân viên để xem báo cáo.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-8">
                    {/* Summary Stats Card */}
                    <Card className="overflow-hidden border-none shadow-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-700 text-white rounded-[2rem]">
                        <CardContent className="p-0">
                            <div className="grid grid-cols-1 md:grid-cols-12">
                                <div className="md:col-span-8 p-8 md:p-10 space-y-6">
                                    <div className="space-y-2">
                                        <h3 className="text-blue-100 font-medium flex items-center gap-2">
                                            <LayoutDashboard className="h-4 w-4" />
                                            Trạng thái hoàn thành
                                        </h3>
                                        <div className="flex items-baseline gap-3">
                                            <span className="text-5xl md:text-6xl font-black tracking-tighter">
                                                {completedTasksStats.percentage}%
                                            </span>
                                            <span className="text-xl text-blue-100/80 font-medium">Hoàn thành</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6 pt-4 border-t border-white/10">
                                        <div>
                                            <div className="text-blue-100/60 text-sm mb-1 uppercase tracking-wider font-bold">Người thực hiện</div>
                                            <div className="text-xl font-bold flex items-center gap-2">
                                                {selectedReportId === 'summary' ? (
                                                    <><Users className="h-5 w-5" /> {reports.length} Nhân viên</>
                                                ) : (
                                                    reportToView.staffName
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-blue-100/60 text-sm mb-1 uppercase tracking-wider font-bold">Thời gian nộp</div>
                                            <div className="text-xl font-bold flex items-center gap-2">
                                                <Clock className="h-5 w-5 text-blue-200" />
                                                {selectedReportId === 'summary' ? '—' : new Date(reportToView.submittedAt as string).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="md:col-span-4 bg-white/10 backdrop-blur-md p-8 flex flex-col items-center justify-center border-l border-white/10">
                                    <div className="relative h-32 w-32 md:h-40 md:w-40">
                                        <svg className="h-full w-full" viewBox="0 0 100 100">
                                            <circle
                                                className="text-white/20 stroke-current"
                                                strokeWidth="8"
                                                cx="50"
                                                cy="50"
                                                r="40"
                                                fill="transparent"
                                            ></circle>
                                            <circle
                                                className="text-white stroke-current transition-all duration-1000 ease-out"
                                                strokeWidth="8"
                                                strokeDasharray={251.2}
                                                strokeDashoffset={251.2 * (1 - completedTasksStats.percentage / 100)}
                                                strokeLinecap="round"
                                                cx="50"
                                                cy="50"
                                                r="40"
                                                fill="transparent"
                                                transform="rotate(-90 50 50)"
                                            ></circle>
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <div className="text-2xl font-black">{completedTasksStats.count}</div>
                                            <div className="text-[10px] uppercase font-bold text-white/60 tracking-tighter">/ {totalTasksCount} Công việc</div>
                                        </div>
                                    </div>
                                    <div className="mt-4 text-center">
                                        <div className="flex items-center gap-1 text-sm font-semibold bg-white/20 px-3 py-1 rounded-full">
                                            <CheckCircle2 className="h-3 w-3" />
                                            {completedTasksStats.count === totalTasksCount ? 'Tất cả đã xử lý' : 'Đang xử lý'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Content Section */}
                    {/* Content Section moved inside taskSections map for better flow */}
                    <div className="space-y-12">
                        {taskSections.map((section, index) => {
                            const sectionIcon = getSectionIcon(section.title);
                            const styles = SECTION_STYLES[index % SECTION_STYLES.length];

                            return (
                                <section key={section.title} className="space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-2xl ${styles.bg} ${styles.text} shadow-sm border ${styles.border}`}>
                                            {sectionIcon}
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold font-headline">{section.title}</h2>
                                            <p className="text-sm text-muted-foreground">{section.tasks.length} hạng mục kiểm tra</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {section.tasks.map((task) => {
                                            const completions = (reportToView.completedTasks[task.id] || []) as CompletionRecord[];
                                            const isCompleted = completions.length > 0;

                                            return (
                                                <Card
                                                    key={task.id}
                                                    className={`overflow-hidden border-2 transition-all duration-300 rounded-2xl group ${isCompleted
                                                        ? `${styles.cardBorder} ${styles.cardBg} shadow-sm`
                                                        : 'border-muted bg-card opacity-80 hover:opacity-100 hover:border-muted-foreground/30 grayscale-[0.5] hover:grayscale-0'
                                                        }`}
                                                >
                                                    <CardContent className="p-0">
                                                        <div className={`p-5 flex items-start gap-4 ${isCompleted ? styles.cardBg : 'bg-muted/30'}`}>
                                                            <div className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full flex-shrink-0 transition-transform group-hover:scale-110 ${isCompleted
                                                                ? `${styles.iconBg} text-white shadow-lg`
                                                                : 'bg-muted-foreground/20 text-muted-foreground'
                                                                }`}>
                                                                {isCompleted ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                                                            </div>
                                                            <h4 className={`font-bold leading-snug ${isCompleted ? 'text-foreground' : 'text-muted-foreground font-medium'}`}>
                                                                {task.text}
                                                            </h4>
                                                        </div>

                                                        {isCompleted ? (
                                                            <div className="p-5 space-y-4">
                                                                {completions.map((completion, cIndex) => (
                                                                    <div key={cIndex} className="space-y-4">
                                                                        <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-widest bg-muted/30 px-3 py-1.5 rounded-lg border border-border/50">
                                                                            <span className="flex items-center gap-1.5">
                                                                                <Clock className="h-3 w-3" />
                                                                                {completion.timestamp}
                                                                            </span>
                                                                            {selectedReportId === 'summary' && (
                                                                                <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                                                                                    <Users className="h-3 w-3" />
                                                                                    {(completion as any).staffName}
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {completion.photos && completion.photos.length > 0 && (
                                                                            <div className="grid grid-cols-2 gap-2">
                                                                                {completion.photos.map((photo, pIndex) => (
                                                                                    <button
                                                                                        onClick={() => handleOpenLightbox(photo)}
                                                                                        key={photo.slice(0, 50) + pIndex}
                                                                                        className="relative group/photo overflow-hidden aspect-[4/3] rounded-xl bg-muted border-2 border-transparent hover:border-blue-500 transition-all duration-300 shadow-sm"
                                                                                    >
                                                                                        <Image
                                                                                            src={photo}
                                                                                            alt={`Ảnh bằng chứng ${pIndex + 1}`}
                                                                                            fill
                                                                                            className="object-cover transition-transform duration-500 group-hover/photo:scale-110"
                                                                                        />
                                                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center">
                                                                                            <Camera className="text-white h-6 w-6" />
                                                                                        </div>
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        )}

                                                                        {completion.note && (
                                                                            <div className="bg-amber-100/50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200/50 dark:border-amber-800/50 relative overflow-hidden group/note">
                                                                                <div className="absolute top-0 right-0 p-1 opacity-20">
                                                                                    <MessageSquareText className="h-8 w-8 text-amber-600" />
                                                                                </div>
                                                                                <p className="text-sm font-medium italic text-amber-900 dark:text-amber-400 relative z-10 leading-relaxed">
                                                                                    &ldquo;{completion.note}&rdquo;
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="p-10 flex flex-col items-center justify-center text-center opacity-40 grayscale">
                                                                <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                                                                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Chưa thực hiện</p>
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                </section>
                            );
                        })}

                        {reportToView.issues && (
                            <section className="mt-12">
                                <Card className="border-none shadow-2xl bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950/20 dark:to-rose-900/20 rounded-[2rem] overflow-hidden">
                                    <div className="grid grid-cols-1 md:grid-cols-4">
                                        <div className="md:col-span-1 bg-rose-500 p-8 flex flex-col items-center justify-center text-white text-center">
                                            <MessageSquareWarning className="h-12 w-12 mb-4 drop-shadow-lg animate-pulse" />
                                            <h3 className="text-xl font-black">CÁC VẤN ĐỀ<br />GHI NHẬN</h3>
                                        </div>
                                        <div className="md:col-span-3 p-8 md:p-10">
                                            <div className="text-lg font-medium text-rose-900 dark:text-rose-200 leading-relaxed italic whitespace-pre-wrap">
                                                {reportToView.issues}
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </section>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function HygieneReportPage() {
    return (
        <Suspense fallback={<LoadingPage />}>
            <HygieneReportView />
        </Suspense>
    )
}


