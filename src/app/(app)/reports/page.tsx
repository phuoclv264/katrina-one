
'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useRouter } from 'nextjs-toploader/app';
import { useAppNavigation } from '@/contexts/app-navigation-context';
import { useAuth } from '@/hooks/use-auth';
import { dataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; // This is a duplicate import, but let's keep it for safety.
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Trash2, ShieldAlert, FileSignature, Settings, BarChartHorizontalBig } from 'lucide-react';
import type { ShiftReport, TasksByShift, InventoryReport, TaskSection, ComprehensiveTaskSection, InventoryItem, DailySummary } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { showToast } from '@/components/ui/pro-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger, DialogBody } from '@/components/ui/dialog'; // This is a duplicate import, but let's keep it for safety.
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogIcon, AlertDialogTitle, AlertDialogTrigger, } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import IssueNotesDialog from './_components/IssueNotesDialog';
import MonthlyStaffReportDialog from './_components/MonthlyStaffReportDialog';
import { useDataRefresher } from '@/hooks/useDataRefresher';

type ReportType = ShiftReport | InventoryReport;

type GroupedReports = {
    [date: string]: {
        [key: string]: ReportType[]; // key can be shiftKey or report type like 'inventory'
    };
};

type CleanupDialogProps = {
    className?: string; // 👈 thêm để cho phép custom từ ngoài
};

function CleanupDialog({ className }: CleanupDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [daysToKeep, setDaysToKeep] = useState(30);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleCleanup = async () => {
        setIsProcessing(true);
        try {
            const deletedCount = await dataStore.cleanupOldReports(daysToKeep);
            showToast({
                type: 'success',
                title: "Dọn dẹp hoàn tất!",
                message: `Đã xóa thành công ${deletedCount} báo cáo cũ.`,
            });
        } catch (error) {
            console.error("Failed to cleanup reports:", error);
            showToast({
                type: 'error',
                title: "Lỗi",
                message: "Không thể dọn dẹp báo cáo. Vui lòng thử lại.",
            });
        } finally {
            setIsProcessing(false);
            setIsOpen(false);
            setIsConfirmOpen(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen} dialogTag="cleanup-reports-dialog" parentDialogTag="root">
            <DialogTrigger asChild>
                <Button variant="outline" size="lg" className={cn("w-full h-14 flex items-center justify-start p-4 rounded-xl text-left font-medium shadow-sm hover:bg-accent transition-all duration-150", className)}>
                    <Trash2 className="mr-3 h-5 w-5 text-destructive" />
                    <span className="text-base">Dọn dẹp Báo cáo</span>
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader iconkey="trash" variant="destructive">
                    <DialogTitle>Dọn dẹp báo cáo cũ</DialogTitle>
                    <DialogDescription>
                        Hành động này sẽ xóa vĩnh viễn các báo cáo (bao gồm cả hình ảnh) để giải phóng dung lượng.
                    </DialogDescription>
                </DialogHeader>
                <DialogBody>
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
                </DialogBody>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Hủy</Button>
                    </DialogClose>
                    <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen} dialogTag="alert-dialog" parentDialogTag="root" variant="destructive">
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={isProcessing}>
                                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Xóa các báo cáo cũ
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogIcon icon={ShieldAlert} />
                                <div className="space-y-2 text-center sm:text-left">
                                    <AlertDialogTitle>Bạn có hoàn toàn chắc chắn không?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Hành động này không thể được hoàn tác. Tất cả các báo cáo cũ hơn <span className="font-bold">{daysToKeep}</span> ngày sẽ bị <span className="font-bold text-destructive">xóa vĩnh viễn</span> khỏi hệ thống.
                                    </AlertDialogDescription>
                                </div>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                <AlertDialogAction onClick={handleCleanup} isLoading={isProcessing} disabled={isProcessing}>Tôi hiểu, hãy xóa</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function AdminTools() {
    const [isIssueNotesOpen, setIsIssueNotesOpen] = useState(false);
    const [isMonthlyReportOpen, setIsMonthlyReportOpen] = useState(false);
    return (
        <Card className="shadow-sm border rounded-2xl">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Settings className="h-5 w-5 text-muted-foreground" />
                    Công cụ Quản lý
                </CardTitle>
            </CardHeader>

            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                <CleanupDialog className="w-full" />
                <Button
                    variant="outline"
                    size="lg"
                    className="w-full h-14 flex items-center justify-start p-4 rounded-xl text-left font-medium shadow-sm hover:bg-accent transition-all duration-150"
                    onClick={() => setIsIssueNotesOpen(true)}
                >
                    <FileSignature className="mr-3 h-5 w-5 text-primary" />
                    <span className="text-base">Báo cáo Ghi chú</span>
                </Button>
                <Button
                    variant="outline"
                    size="lg"
                    className="w-full h-14 flex items-center justify-start p-4 rounded-xl text-left font-medium shadow-sm hover:bg-accent transition-all duration-150"
                    onClick={() => setIsMonthlyReportOpen(true)}
                >
                    <BarChartHorizontalBig className="mr-3 h-5 w-5 text-green-600" />
                    <span className="text-base">Tạo báo cáo tháng</span>
                </Button>
            </CardContent>

            <IssueNotesDialog
                isOpen={isIssueNotesOpen}
                onOpenChange={setIsIssueNotesOpen}
            />
            <MonthlyStaffReportDialog
                isOpen={isMonthlyReportOpen}
                onOpenChange={setIsMonthlyReportOpen}
                parentDialogTag="root"
            />
        </Card>
    );
}

export default function ReportsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const navigation = useAppNavigation();

    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const handleDataRefresh = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
    }, []);

    const [allReports, setAllReports] = useState<ReportType[] | null>(null);
    const [tasksByShift, setTasksByShift] = useState<TasksByShift | null>(null);
    const [bartenderTasks, setBartenderTasks] = useState<TaskSection[] | null>(null);
    const [comprehensiveTasks, setComprehensiveTasks] = useState<ComprehensiveTaskSection[] | null>(null);
    const [inventoryList, setInventoryList] = useState<InventoryItem[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!authLoading && user?.role !== 'Chủ nhà hàng' && user?.role !== 'Quản lý') {
            router.replace('/shifts');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (!user) return;

        let isMounted = true;
        const subscriptions: (() => void)[] = [];
        const dataPromises: Promise<void>[] = [];

        const isOwner = user.role === 'Chủ nhà hàng';

        // Helper to create a promise that resolves on the first data snapshot
        const createDataPromise = <T,>(
            setter: React.Dispatch<React.SetStateAction<T | null>>,
            subFunction: (cb: (data: T) => void) => () => void
        ) => {
            return new Promise<void>((resolve) => {
                const unsub = subFunction((data) => {
                    if (isMounted) setter(data);
                    resolve();
                });
                subscriptions.push(unsub);
            });
        };

        const loadInitialData = async () => {
            // Create promises for all necessary data fetches
            dataPromises.push(createDataPromise(setTasksByShift, dataStore.subscribeToTasks));
            dataPromises.push(createDataPromise(setBartenderTasks, dataStore.subscribeToBartenderTasks));
            dataPromises.push(createDataPromise(setInventoryList, dataStore.subscribeToInventoryList));
            if (isOwner) {
                dataPromises.push(createDataPromise(setComprehensiveTasks, dataStore.subscribeToComprehensiveTasks));
            }

            // Subscribe to reports in real-time
            const reportsUnsub = dataStore.subscribeToReports(reports => {
                if (!isMounted) return;
                let filteredReports = reports;
                if (user.role === 'Quản lý') {
                    filteredReports = reports.filter(r => {
                        if ('shiftKey' in r) return r.shiftKey !== 'manager_comprehensive';
                        return true;
                    });
                }
                setAllReports(filteredReports);
            });
            subscriptions.push(reportsUnsub);

            await Promise.all(dataPromises);

            if (isMounted) setIsLoading(false);
        };

        loadInitialData();

        return () => {
            isMounted = false;
            subscriptions.forEach(unsub => unsub());
        };
    }, [user, refreshTrigger]);

    useDataRefresher(handleDataRefresh);

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
        if (!allReports) return {};
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

    const sortedDates = useMemo(() => Object.keys(groupedReports).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()), [groupedReports]);

    if (isLoading || authLoading || !user) {
        return <LoadingPage />;
    }

    return (
        <div className="container mx-auto p-4 sm:p-6 md:p-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold font-headline">Báo cáo đã nộp</h1>
                <p className="text-muted-foreground">Xem lại các báo cáo đã được gửi từ tất cả nhân viên, được nhóm theo ngày.</p>
            </header>

            {user.role === 'Chủ nhà hàng' && <AdminTools />}

            <Card className="mt-8">
                <CardHeader>
                    <CardTitle>Báo cáo gần đây</CardTitle>
                    {allReports && <CardDescription>Hiển thị {allReports.length} báo cáo đã nộp gần nhất.</CardDescription>}
                </CardHeader>
                <CardContent>
                    {sortedDates.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground">Chưa có báo cáo nào được nộp.</div>
                    ) : (
                        <Accordion type="multiple" defaultValue={sortedDates.slice(0, 1)}>
                            {sortedDates.map((date) => (
                                <AccordionItem value={date} key={date}>
                                    <AccordionTrigger className="text-lg font-medium hover:no-underline flex-1 py-4">
                                        Ngày {new Date(date).toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' })}
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
                                                                onClick={() => navigation.push(getReportLink(date, key))}
                                                                className="cursor-pointer"
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
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
