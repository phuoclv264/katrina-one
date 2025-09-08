
'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { dataStore } from '@/lib/data-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowRight, CheckCircle, Users, Wand2, Loader2 } from 'lucide-react';
import type { ShiftReport, TasksByShift, InventoryReport, TaskSection, ComprehensiveTaskSection, InventoryItem } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { generateDailySummary } from '@/ai/flows/generate-daily-summary';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import ReactMarkdown from 'react-markdown';


type ReportType = ShiftReport | InventoryReport;

type GroupedReports = {
  [date: string]: {
    [key: string]: ReportType[]; // key can be shiftKey or report type like 'inventory'
  };
};

function DailySummaryGenerator({
  date,
  reports,
  taskDefinitions,
  cachedSummary,
  onSummaryGenerated,
}: {
  date: string,
  reports: ReportType[],
  taskDefinitions: any,
  cachedSummary?: string,
  onSummaryGenerated: (summary: string) => void,
}) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [summary, setSummary] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const { toast } = useToast();

    const handleGenerate = async () => {
        if (cachedSummary) {
            setSummary(cachedSummary);
            setIsDialogOpen(true);
            return;
        }

        setIsGenerating(true);
        setSummary('');
        try {
            const result = await generateDailySummary({
                date,
                reports,
                taskDefinitions
            });
            setSummary(result.summary);
            onSummaryGenerated(result.summary); // Cache the new summary
            setIsDialogOpen(true);
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

    return (
        <>
            <Button onClick={handleGenerate} variant="outline" size="sm" disabled={isGenerating}>
                {isGenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Wand2 className="mr-2 h-4 w-4" />
                )}
                Tóm tắt bằng AI
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Tóm tắt báo cáo ngày {new Date(date).toLocaleDateString('vi-VN')}</DialogTitle>
                        <DialogDescription>
                            AI đã phân tích tất cả các báo cáo đã nộp trong ngày.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="prose prose-sm dark:prose-invert max-h-[70vh] overflow-y-auto rounded-md border p-4">
                        <ReactMarkdown>{summary}</ReactMarkdown>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [allReports, setAllReports] = useState<ReportType[]>([]);
  const [tasksByShift, setTasksByShift] = useState<TasksByShift | null>(null);
  const [bartenderTasks, setBartenderTasks] = useState<TaskSection[] | null>(null);
  const [comprehensiveTasks, setComprehensiveTasks] = useState<ComprehensiveTaskSection[] | null>(null);
  const [inventoryList, setInventoryList] = useState<InventoryItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cachedSummaries, setCachedSummaries] = useState<Record<string, string>>({});


  useEffect(() => {
    if (!authLoading && user?.role !== 'Chủ nhà hàng') {
      router.replace('/shifts');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || user.role !== 'Chủ nhà hàng') return;

    const unsubscribes: (()=>void)[] = [];
    
    try {
        unsubscribes.push(dataStore.subscribeToTasks((tasks) => setTasksByShift(tasks)));
        unsubscribes.push(dataStore.subscribeToBartenderTasks((tasks) => setBartenderTasks(tasks)));
        unsubscribes.push(dataStore.subscribeToComprehensiveTasks((tasks) => setComprehensiveTasks(tasks)));
        unsubscribes.push(dataStore.subscribeToInventoryList((items) => setInventoryList(items)));
        unsubscribes.push(dataStore.subscribeToReports((reports) => setAllReports(reports)));
    } catch(error) {
         console.error("Error subscribing to data:", error);
         toast({
            title: "Lỗi tải dữ liệu",
            description: "Không thể tải được một số cấu hình công việc hoặc báo cáo.",
            variant: "destructive",
        });
    }

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [user, toast]);
  
  useEffect(() => {
      if (tasksByShift && bartenderTasks && comprehensiveTasks && inventoryList && allReports) {
          setIsLoading(false);
      }
  }, [tasksByShift, bartenderTasks, comprehensiveTasks, inventoryList, allReports]);

  const getReportKey = (report: ReportType): string => {
    if ('shiftKey' in report) {
      return report.shiftKey;
    }
    // Simple way to identify inventory reports
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

  const sortedDates = Object.keys(groupedReports).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  
  const taskDefinitions = useMemo(() => ({
      serverTasks: tasksByShift,
      bartenderTasks,
      comprehensiveTasks,
      inventoryItems: inventoryList,
  }), [tasksByShift, bartenderTasks, comprehensiveTasks, inventoryList]);

  if(isLoading || authLoading || user?.role !== 'Chủ nhà hàng') {
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
        <p className="text-muted-foreground">Xem lại các báo cáo đã được gửi từ tất cả nhân viên, được nhóm theo ngày và ca.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Báo cáo gần đây</CardTitle>
          <CardDescription>
            Hiển thị {allReports.length} báo cáo đã nộp gần nhất, được nhóm theo ngày và ca.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedDates.length > 0 ? (
            <Accordion type="multiple" defaultValue={sortedDates.slice(0,1)}>
              {sortedDates.map((date) => {
                const reportsForDate = Object.values(groupedReports[date]).flat();
                return (
                  <AccordionItem value={date} key={date}>
                    <AccordionTrigger className="text-lg font-medium hover:no-underline">
                        <span>Ngày {new Date(date).toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <div className="flex justify-end pr-4">
                            <DailySummaryGenerator 
                                date={date} 
                                reports={reportsForDate}
                                taskDefinitions={taskDefinitions}
                                cachedSummary={cachedSummaries[date]}
                                onSummaryGenerated={(summary) => {
                                  setCachedSummaries(prev => ({...prev, [date]: summary}))
                                }}
                            />
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Tên báo cáo</TableHead>
                              <TableHead>Nhân viên đã nộp</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(groupedReports[date]).map(([key, reportGroup]) => {
                              const reportName = getReportName(key);
                              const staffNames = [...new Set(reportGroup.map(r => r.staffName))].join(', ');
                              
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
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          ) : (
             <div className="text-center text-muted-foreground py-8">
                <p>Không có báo cáo nào được nộp.</p>
             </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
