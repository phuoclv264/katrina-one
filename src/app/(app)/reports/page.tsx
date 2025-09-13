

'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { dataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Wand2, Loader2, RefreshCw, Trash2, ShieldAlert } from 'lucide-react';
import type { ShiftReport, TasksByShift, InventoryReport, TaskSection, ComprehensiveTaskSection, InventoryItem, DailySummary } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { generateDailySummary } from '@/ai/flows/generate-daily-summary';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, } from '@/components/ui/alert-dialog';
import ReactMarkdown from 'react-markdown';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


type ReportType = ShiftReport | InventoryReport;

type GroupedReports = {
  [date: string]: {
    [key: string]: ReportType[]; // key can be shiftKey or report type like 'inventory'
  };
};

function CleanupDialog() {
    const [isOpen, setIsOpen] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [daysToKeep, setDaysToKeep] = useState(30);
    const [isProcessing, setIsProcessing] = useState(false);
    const { toast } = useToast();

    const handleCleanup = async () => {
        setIsProcessing(true);
        try {
            const deletedCount = await dataStore.cleanupOldReports(daysToKeep);
            toast({
                title: "Dọn dẹp hoàn tất!",
                description: `Đã xóa thành công ${deletedCount} báo cáo cũ.`,
            });
        } catch (error) {
            console.error("Failed to cleanup reports:", error);
            toast({
                title: "Lỗi",
                description: "Không thể dọn dẹp báo cáo. Vui lòng thử lại.",
                variant: "destructive",
            });
        } finally {
            setIsProcessing(false);
            setIsOpen(false);
            setIsConfirmOpen(false);
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                 <Button variant="outline" size="sm">
                    <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                    Dọn dẹp Báo cáo
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Dọn dẹp báo cáo cũ</DialogTitle>
                    <DialogDescription>
                        Hành động này sẽ xóa vĩnh viễn các báo cáo (bao gồm cả hình ảnh) để giải phóng dung lượng.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                     <Label htmlFor="days">Giữ lại báo cáo trong (ngày)</Label>
                     <Input
                        id="days"
                        type="number"
                        value={daysToKeep}
                        onChange={(e) => setDaysToKeep(parseInt(e.target.value, 10) || 0)}
                        placeholder="Ví dụ: 30"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                        Tất cả các báo cáo cũ hơn {daysToKeep} ngày sẽ bị xóa.
                    </p>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Hủy</Button>
                    </DialogClose>
                    <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={isProcessing}>
                                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Xóa các báo cáo cũ
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2">
                                    <ShieldAlert className="text-destructive"/>
                                    Bạn có hoàn toàn chắc chắn không?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    Hành động này không thể được hoàn tác. Tất cả các báo cáo cũ hơn <span className="font-bold">{daysToKeep}</span> ngày sẽ bị <span className="font-bold text-destructive">xóa vĩnh viễn</span> khỏi hệ thống.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                <AlertDialogAction onClick={handleCleanup}>Tôi hiểu, hãy xóa</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function DailySummaryGenerator({
  date,
  reports,
  taskDefinitions,
}: {
  date: string,
  reports: ReportType[],
  taskDefinitions: any,
}) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [summaryData, setSummaryData] = useState<DailySummary | null>(null);
    const { toast } = useToast();

    const fetchAndSetSummary = async () => {
        setIsGenerating(true);
        setSummaryData(null); // Clear old summary before fetching
        const existingSummary = await dataStore.getDailySummary(date);
        setSummaryData(existingSummary);
        setIsGenerating(false);
    }
    
    const handleGenerate = async (forceRegenerate = false) => {
        if (summaryData && !forceRegenerate) {
            setIsDialogOpen(true);
            return;
        }

        setIsGenerating(true);
        if (!isDialogOpen) {
          setIsDialogOpen(true);
        }
        try {
            const result = await generateDailySummary({
                date,
                reports,
                taskDefinitions
            });
            await dataStore.saveDailySummary(date, result.summary);
            // After saving, fetch it again to get the server timestamp
            const newSummary = await dataStore.getDailySummary(date);
            setSummaryData(newSummary);
        } catch (error) {
            console.error("Failed to generate summary:", error);
            toast({
                title: "Lỗi tạo tóm tắt",
                description: "Đã có lỗi xảy ra khi AI xử lý dữ liệu. Vui lòng thử lại.",
                variant: "destructive",
            });
        } finally {
            setIsGenerating(false);
        }
    }

    const handleClick = async () => {
        setIsDialogOpen(true);
        await fetchAndSetSummary();
    }

    return (
        <>
            <Button onClick={handleClick} variant="outline" size="sm">
                <Wand2 className="mr-2 h-4 w-4" />
                Tóm tắt bằng AI
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Tóm tắt báo cáo ngày {new Date(date).toLocaleDateString('vi-VN')}</DialogTitle>
                        {summaryData?.generatedAt && (
                            <DialogDescription>
                                AI tạo lúc: {new Date(summaryData.generatedAt as string).toLocaleString('vi-VN', {hour12: false})}
                            </DialogDescription>
                        )}
                    </DialogHeader>
                    <div className="prose prose-sm dark:prose-invert max-h-[70vh] overflow-y-auto rounded-md border p-4">
                        {isGenerating ? (
                             <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <span>AI đang phân tích, vui lòng đợi...</span>
                             </div>
                        ) : summaryData ? (
                            <ReactMarkdown>{summaryData.summary}</ReactMarkdown>
                        ) : (
                           <div className="text-center py-8">
                                <p className="text-muted-foreground mb-4">Chưa có bản tóm tắt nào cho ngày này.</p>
                                <Button onClick={() => handleGenerate(true)}>Tạo ngay</Button>
                           </div>
                        )}
                    </div>
                    <DialogFooter>
                        {summaryData && (
                            <Button variant="secondary" onClick={() => handleGenerate(true)} disabled={isGenerating}>
                                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4" />}
                                Tạo lại
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

function ReportsTable({
  groupedReports,
  getReportName,
  getReportLink
}: {
  groupedReports: GroupedReports,
  getReportName: (key: string) => string,
  getReportLink: (date: string, key: string) => string,
}) {
    const router = useRouter();
    const sortedDates = Object.keys(groupedReports).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
    return (
        <Accordion type="multiple" defaultValue={sortedDates.slice(0, 1)}>
            {sortedDates.map((date) => (
                <AccordionItem value={date} key={date}>
                    <AccordionTrigger className="text-lg font-medium hover:no-underline">
                        <span>Ngày {new Date(date).toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </AccordionTrigger>
                    <AccordionContent>
                        <div className="space-y-4">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tên báo cáo</TableHead>
                                        <TableHead>Nhân viên đã nộp</TableHead>
                                        <TableHead className="text-right">Thời gian nộp</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {Object.entries(groupedReports[date]).map(([key, reportGroup]) => {
                                        const reportName = getReportName(key);
                                        const staffNames = [...new Set(reportGroup.map(r => r.staffName))].join(', ');
                                        const latestSubmission = reportGroup.reduce((latest, current) => {
                                            if (!latest.submittedAt) return current;
                                            if (!current.submittedAt) return latest;
                                            return new Date(current.submittedAt as string) > new Date(latest.submittedAt as string) ? current : latest;
                                        });
                                        const submissionTime = latestSubmission.submittedAt ? new Date(latestSubmission.submittedAt as string).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }) : 'N/A';

                                        return (
                                            <TableRow
                                                key={`${date}-${key}`}
                                                onClick={() => router.push(getReportLink(date, key))}
                                                className="cursor-pointer select-none"
                                            >
                                                <TableCell className="font-semibold capitalize">{reportName}</TableCell>
                                                <TableCell>
                                                    <p className="text-sm text-muted-foreground">{staffNames}</p>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <p className="text-sm text-muted-foreground">{submissionTime}</p>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    )
}

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const [allReports, setAllReports] = useState<ReportType[]>([]);
  const [tasksByShift, setTasksByShift] = useState<TasksByShift | null>(null);
  const [bartenderTasks, setBartenderTasks] = useState<TaskSection[] | null>(null);
  const [comprehensiveTasks, setComprehensiveTasks] = useState<ComprehensiveTaskSection[] | null>(null);
  const [inventoryList, setInventoryList] = useState<InventoryItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const defaultTab = searchParams.get('defaultTab') || 'all';

  useEffect(() => {
    if (!authLoading && user?.role !== 'Chủ nhà hàng' && user?.role !== 'Quản lý') {
      router.replace('/shifts');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    
    const isOwner = user.role === 'Chủ nhà hàng';
    const isManager = user.role === 'Quản lý';

    const subscriptions: (() => void)[] = [];

    const subscribe = (subscriptionFunc: () => () => void) => {
        try {
            subscriptions.push(subscriptionFunc());
        } catch (error) {
            console.error("Error subscribing to data:", error);
            toast({
                title: "Lỗi tải dữ liệu",
                description: "Không thể tải được một số cấu hình.",
                variant: "destructive",
            });
        }
    };

    subscribe(() => dataStore.subscribeToTasks((tasks) => setTasksByShift(tasks)));
    subscribe(() => dataStore.subscribeToBartenderTasks((tasks) => setBartenderTasks(tasks)));
    subscribe(() => dataStore.subscribeToInventoryList((items) => setInventoryList(items)));

    if (isOwner) {
        subscribe(() => dataStore.subscribeToComprehensiveTasks((tasks) => setComprehensiveTasks(tasks)));
        subscribe(() => dataStore.subscribeToReports((reports) => setAllReports(reports)));
    } else if (isManager) {
        // Manager sees a subset of reports
        subscribe(() => dataStore.subscribeToReports((reports) => {
            const managerVisibleReports = reports.filter(r => {
                if ('shiftKey' in r) {
                    return r.shiftKey === 'bartender_hygiene' || (tasksByShift && tasksByShift[r.shiftKey]);
                }
                if ('stockLevels' in r) {
                    return true;
                }
                return false;
            });
            setAllReports(managerVisibleReports);
        }));
    }

    Promise.all([
        new Promise(resolve => onSnapshot(collection(db, 'reports'), () => resolve(true), { onlyOnce: true })),
        new Promise(resolve => onSnapshot(doc(db, 'app-data', 'tasks'), () => resolve(true), { onlyOnce: true })),
    ]).then(() => setIsLoading(false));

    return () => {
      subscriptions.forEach(unsub => unsub());
    };
}, [user, toast, tasksByShift]);
  
  useEffect(() => {
      const dataLoaded = (user?.role === 'Quản lý' && tasksByShift && bartenderTasks && inventoryList && allReports.length >= 0) || 
                         (user?.role === 'Chủ nhà hàng' && tasksByShift && bartenderTasks && comprehensiveTasks && inventoryList && allReports.length >= 0);
      
      if (dataLoaded) {
          setIsLoading(false);
      }
  }, [tasksByShift, bartenderTasks, comprehensiveTasks, inventoryList, allReports, user]);

  const getReportKey = (report: ReportType): string => {
    if ('shiftKey' in report) {
      return report.shiftKey;
    }
    if ('stockLevels' in report) {
      return 'inventory';
    }
    return 'unknown';
  }

  const getReportLink = (date: string, key: string): string => {
    if (tasksByShift?.[key]) { // Checklist reports
        return `/reports/by-shift?date=${date}&shiftKey=${key}`;
    }
    switch (key) {
        case 'bartender_hygiene':
            return `/reports/hygiene?date=${date}`;
        case 'inventory':
            return `/reports/inventory`;
        case 'manager_comprehensive':
            return `/reports/comprehensive?date=${date}`;
        default:
             return '#';
    }
  }
  
  const getReportName = (key: string): string => {
    if (tasksByShift && tasksByShift[key]) {
      return `Checklist ${tasksByShift[key].name}`;
    }
    switch (key) {
      case 'bartender_hygiene':
        return 'Báo cáo Vệ sinh quầy';
      case 'inventory':
        return 'Báo cáo Kiểm kê Tồn kho';
      case 'manager_comprehensive':
        return 'Phiếu kiểm tra toàn diện';
      default:
        return `Báo cáo không xác định: ${key}`;
    }
  };


  const groupedReports: GroupedReports = useMemo(() => {
    return allReports.reduce((acc, report) => {
      const date = report.date;
      const key = getReportKey(report);
      
      if (!acc[date]) {
        acc[date] = {};
      }
      if (!acc[date][key]) {
        acc[date][key] = [];
      }
      acc[date][key].push(report);
      return acc;
    }, {} as GroupedReports);
  }, [allReports]);
  

  if(isLoading || authLoading || !user) {
      return (
        <div className="container mx-auto p-4 sm:p-6 md:p-8">
            <header className="mb-8">
                <Skeleton className="h-10 w-1/2" />
                <Skeleton className="h-4 w-1/3 mt-2" />
            </header>
             <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/3" />
                    <Skeleton className="h-4 w-1/4 mt-2" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-24 w-full" />
                </CardContent>
            </Card>
        </div>
      )
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold font-headline">Báo cáo đã nộp</h1>
        <p className="text-muted-foreground">Xem lại các báo cáo đã được gửi từ tất cả nhân viên, được nhóm theo ngày.</p>
      </header>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle>Báo cáo gần đây</CardTitle>
            <CardDescription>
              Hiển thị {allReports.length} báo cáo đã nộp gần nhất.
            </CardDescription>
          </div>
          {user.role === 'Chủ nhà hàng' && <CleanupDialog />}
        </CardHeader>
        <CardContent>
            <ReportsTable groupedReports={groupedReports} getReportName={getReportName} getReportLink={getReportLink}/>
        </CardContent>
      </Card>
    </div>
  );
}
