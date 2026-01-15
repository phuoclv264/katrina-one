'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'nextjs-toploader/app';
import { useAppNavigation } from '@/contexts/app-navigation-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { PlusCircle, ArrowRight, ArrowLeft, Receipt, AlertTriangle, Banknote, Edit, Trash2, Loader2, ArrowUpCircle, ArrowDownCircle, Wallet, Lock, Edit2, LandPlot, Settings, Eye, FileWarning, ClipboardCheck, ClipboardX, TrendingUp, TrendingDown, Wand2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ExpenseSlip, IncidentReport, RevenueStats, ManagedUser, InventoryItem, OtherCostCategory, ExtractHandoverDataOutput, ExpenseItem, IncidentCategory } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { format, parseISO } from 'date-fns';
import { toast } from '@/components/ui/pro-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import ExpenseSlipDialog from '@/app/(app)/cashier/_components/expense-slip-dialog';
import IncidentReportDialog from '@/app/(app)/cashier/_components/incident-report-dialog';
import RevenueStatsDialog from '@/app/(app)/cashier/_components/revenue-stats-dialog';
import CashHandoverDialog from '@/app/(app)/cashier/_components/cash-handover-dialog';
import HandoverDialog from '@/app/(app)/cashier/_components/handover-dialog';
import HandoverComparisonDialog from '@/app/(app)/cashier/_components/handover-comparison-dialog';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import WorkShiftGuard from '@/components/work-shift-guard';
import type { CashHandoverReport } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';
import { useLightbox } from '@/contexts/lightbox-context';

interface CashierDashboardProps {
    isStandalone?: boolean;
}

function StartOfDayCashDialog({
    currentValue,
    onSave
}: {
    currentValue: number,
    onSave: (newValue: number, reason: string) => void
}) {
    const [newValue, setNewValue] = useState(currentValue);
    const [reason, setReason] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setNewValue(currentValue);
            setReason('');
        }
    }, [isOpen, currentValue]);

    const handleSave = () => {
        if (newValue !== 1_500_000 && !reason.trim()) {
            toast.error('Vui lòng nhập lý do thay đổi số tiền đầu ca.');
            return;
        }
        onSave(newValue, reason);
        setIsOpen(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen} dialogTag="start-of-day-cash-dialog" parentDialogTag="root">
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-auto p-1 text-muted-foreground hover:text-primary">
                    <Edit className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Thay đổi Tiền mặt đầu ca</DialogTitle>
                    <DialogDescription>
                        Giá trị mặc định là 1.500.000đ. Nếu có thay đổi, vui lòng ghi rõ lý do.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="start-of-day-cash">Số tiền mặt đầu ca</Label>
                        <Input
                            id="start-of-day-cash"
                            type="number"
                            value={newValue}
                            onChange={(e) => setNewValue(Number(e.target.value))}
                            onFocus={e => e.target.select()}
                        />
                    </div>
                    {newValue !== 1_500_000 && (
                        <div className="space-y-2">
                            <Label htmlFor="reason">Lý do thay đổi (bắt buộc)</Label>
                            <Textarea
                                id="reason"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="VD: Bù tiền thối thiếu từ ca trước..."
                                onFocus={(e) => e.target.select()}
                            />
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Hủy</Button>
                    </DialogClose>
                    <Button onClick={handleSave}>Lưu thay đổi</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

const ChangeIndicator = ({ value }: { value: number }) => {
    if (isNaN(value) || !isFinite(value) || value === 0) return null;

    const isPositive = value > 0;
    const isNegative = value < 0;

    return (
        <span className={cn(
            "text-xs font-semibold flex items-center gap-0.5",
            isPositive ? 'text-green-600' : 'text-red-600'
        )}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(value).toLocaleString('vi-VN')}đ
        </span>
    );
};


function CashierDashboardPageComponent({ isStandalone = false }: CashierDashboardProps) {
    const { openLightbox } = useLightbox();
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const nav = useAppNavigation();
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const expenseSlipsRef = useRef<HTMLDivElement>(null);
    const revenueStatsRef = useRef<HTMLDivElement>(null);

    const isMobile = useIsMobile();

    const [dailySlips, setDailySlips] = useState<ExpenseSlip[]>([]);
    const [dailyIncidents, setDailyIncidents] = useState<IncidentReport[]>([]);
    const [dailyRevenueStats, setDailyRevenueStats] = useState<RevenueStats[]>([]);
    const [cashHandoverReports, setCashHandoverReports] = useState<CashHandoverReport[]>([]);

    const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
    const [otherCostCategories, setOtherCostCategories] = useState<OtherCostCategory[]>([]);
    const [incidentCategories, setIncidentCategories] = useState<IncidentCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    const [startOfDayCash, setStartOfDayCash] = useState(1_500_000);

    const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
    const [isIncidentDialogOpen, setIsIncidentDialogOpen] = useState(false);
    const [isRevenueDialogOpen, setIsRevenueDialogOpen] = useState(false);
    const [isHandoverDialogOpen, setIsHandoverDialogOpen] = useState(false);
    const [isCashHandoverDialogOpen, setIsCashHandoverDialogOpen] = useState(false);

    const [isComparisonDialogOpen, setIsComparisonDialogOpen] = useState(false);
    const [comparisonResult, setComparisonResult] = useState<any[] | null>(null);
    const [handoverReceiptData, setHandoverReceiptData] = useState<any | null>(null);

    const [slipToEdit, setSlipToEdit] = useState<ExpenseSlip | null>(null);
    const [revenueStatsToEdit, setRevenueStatsToEdit] = useState<RevenueStats | null>(null);
    const [incidentToEdit, setIncidentToEdit] = useState<IncidentReport | null>(null);

    const [cashCountToEdit, setCashCountToEdit] = useState<CashHandoverReport | null>(null);

    const [isFinalHandoverViewOpen, setIsFinalHandoverViewOpen] = useState(false);
    const [finalHandoverToView, setFinalHandoverToView] = useState<CashHandoverReport | null>(null);

    const [linkedRevenueForDialog, setLinkedRevenueForDialog] = useState<RevenueStats | null>(null);
    const [linkedExpensesForDialog, setLinkedExpensesForDialog] = useState<ExpenseSlip[]>([]);
    const [expectedCashForDialog, setExpectedCashForDialog] = useState(0);

    const getSlipContentName = useCallback((item: ExpenseItem): string => {
        if (item.name?.startsWith('Chi phí sự cố')) return item.name;
        if (item.itemId === 'other_cost') {
            if (item.name === 'Khác' && item.description) {
                return item.description;
            }
            return item.name;
        }
        const inventoryItem = inventoryList.find(i => i.id === item.itemId);
        return inventoryItem?.shortName || item.name;
    }, [inventoryList]);


    useEffect(() => {
        // Load start of day cash from local storage
        const savedCash = localStorage.getItem(`startOfDayCash-${format(new Date(), 'yyyy-MM-dd')}`);
        if (savedCash) {
            setStartOfDayCash(JSON.parse(savedCash).value);
        }
    }, []);

    const { totalCashExpense, totalBankExpense, cashRevenue, expectedCashOnHand, totalNetRevenue } = useMemo(() => {
        const { totalCashExpense, totalBankExpense } = dailySlips.reduce((acc, slip) => {
            if (slip.paymentMethod === 'cash') {
                const amount = slip.actualPaidAmount ?? slip.totalAmount;
                acc.totalCashExpense += amount;
            } else if (slip.paymentMethod === 'bank_transfer') {
                acc.totalBankExpense += slip.totalAmount;
            }
            return acc;
        }, { totalCashExpense: 0, totalBankExpense: 0 });

        const latestRevenueStats = dailyRevenueStats.length > 0 ? dailyRevenueStats[0] : null;

        const totalNetRevenue = latestRevenueStats?.netRevenue || 0;
        const cashRevenue = latestRevenueStats?.revenueByPaymentMethod.cash || 0;

        const expectedCashOnHand = cashRevenue - totalCashExpense + startOfDayCash;

        return { totalCashExpense, totalBankExpense, cashRevenue, expectedCashOnHand, totalNetRevenue };
    }, [dailySlips, dailyRevenueStats, startOfDayCash]);

    useEffect(() => {
        if (isCashHandoverDialogOpen) {
            if (cashCountToEdit) {
                // Editing an existing report: calculate historical expected cash
                const revenue = dailyRevenueStats.find(stat => stat.id === cashCountToEdit.linkedRevenueStatsId) || null;
                const expenses = dailySlips.filter(slip => cashCountToEdit.linkedExpenseSlipIds?.includes(slip.id));

                setLinkedRevenueForDialog(revenue);
                setLinkedExpensesForDialog(expenses);

                const historicalCashRevenue = revenue?.revenueByPaymentMethod.cash || 0;
                const historicalTotalCashExpense = expenses
                    .filter(slip => slip.paymentMethod === 'cash')
                    .reduce((sum, slip) => sum + (slip.actualPaidAmount ?? slip.totalAmount), 0);
                const historicalStartOfDayCash = cashCountToEdit.startOfDayCash;

                const historicalExpectedCash = historicalCashRevenue - historicalTotalCashExpense + historicalStartOfDayCash;
                setExpectedCashForDialog(historicalExpectedCash);

            } else {
                // Creating a new report: use current expected cash
                const latestRevenue = dailyRevenueStats.length > 0 ? dailyRevenueStats[0] : null;
                setLinkedRevenueForDialog(latestRevenue);
                setLinkedExpensesForDialog(dailySlips);
                setExpectedCashForDialog(expectedCashOnHand);
            }
        } else {
            // Reset when dialog is closed
            setLinkedRevenueForDialog(null);
            setLinkedExpensesForDialog([]);
            setExpectedCashForDialog(0);
        }
    }, [isCashHandoverDialogOpen, cashCountToEdit, dailyRevenueStats, dailySlips, expectedCashOnHand]);

    const handleSaveStartOfDayCash = (newValue: number, reason: string) => {
        const data = { value: newValue, reason: reason, timestamp: new Date().toISOString() };
        localStorage.setItem(`startOfDayCash-${format(new Date(), 'yyyy-MM-dd')}`, JSON.stringify(data));
        setStartOfDayCash(newValue);
        toast.success("Đã cập nhật tiền mặt đầu ca.");
    };

    useEffect(() => {
        if (!authLoading && user && user.role !== 'Thu ngân' && !user.secondaryRoles?.includes('Thu ngân')) {
            nav.replace('/');
        }
    }, [user, authLoading, nav]);

    const handleReconnect = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
    }, []);

    useEffect(() => {
        if (user) {
            const date = format(new Date(), 'yyyy-MM-dd');
            const unsubSlips = dataStore.subscribeToDailyExpenseSlips(date, setDailySlips);
            const unsubIncidents = dataStore.subscribeToAllIncidents((allIncidents) => {
                setDailyIncidents(allIncidents.filter(i => i.date === date));
            });
            const unsubRevenue = dataStore.subscribeToDailyRevenueStats(date, setDailyRevenueStats);
            const unsubInventory = dataStore.subscribeToInventoryList(setInventoryList);
            const unsubOtherCostCategories = dataStore.subscribeToOtherCostCategories(setOtherCostCategories);
            const unsubIncidentCategories = dataStore.subscribeToIncidentCategories(setIncidentCategories);
            const unsubHandover = dataStore.subscribeToHandoverReport(date, (reports) => {
                // The callback now consistently provides an array or null.
                setCashHandoverReports(reports as CashHandoverReport[] || []);
            });

            return () => {
                unsubSlips();
                unsubIncidents();
                unsubRevenue();
                unsubInventory();
                unsubOtherCostCategories();
                unsubIncidentCategories();
                unsubHandover();
            };
        }
    }, [user, refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

    useDataRefresher(handleReconnect);

    useEffect(() => {
        if (isLoading && (dailySlips.length > 0 || dailyIncidents.length > 0 || dailyRevenueStats.length > 0 || cashHandoverReports.length > 0 || user)) {
            setIsLoading(false);
        }
    }, [dailySlips, dailyIncidents, dailyRevenueStats, cashHandoverReports, user]);

    const handleSaveSlip = useCallback(async (data: any, id?: string) => {
        if (!user) return;
        setIsProcessing(true);
        try {
            const slipData = {
                ...data,
                createdBy: slipToEdit?.createdBy || { userId: user.uid, userName: user.displayName },
                lastModifiedBy: id ? { userId: user.uid, userName: user.displayName } : undefined,
            };
            await dataStore.addOrUpdateExpenseSlip(slipData, id);
            toast.success(`Đã ${id ? 'cập nhật' : 'tạo'} phiếu chi.`);
            setIsExpenseDialogOpen(false);
        } catch (error) {
            console.error("Failed to save expense slip", error);
            toast.error("Không thể lưu phiếu chi.");
        } finally {
            setIsProcessing(false);
        }
    }, [user, slipToEdit]);

    const handleDeleteSlip = async (slip: ExpenseSlip) => {
        setIsProcessing(true);
        try {
            if (slip.associatedHandoverReportId) {
                toast.error("Không thể xóa phiếu chi được tạo tự động từ bàn giao ca.");
                setIsProcessing(false);
                return;
            }
            await dataStore.deleteExpenseSlip(slip);
            toast.success("Phiếu chi đã được xóa.");
        } catch (error) {
            console.error("Failed to delete expense slip", error);
            toast.error("Không thể xóa phiếu chi.");
        } finally {
            setIsProcessing(false);
        }
    }

    const handleSaveIncident = useCallback(async (data: Omit<IncidentReport, 'id' | 'createdAt' | 'createdBy' | 'date'> & { photoIds?: string[], photosToDelete?: string[] }, id?: string) => {
        if (!user) return;
        setIsProcessing(true);
        try {
            // The data object from the dialog uses `photoIds`, but the data store expects `photosToUpload`.
            // We also ensure it's an array to prevent the .map error.
            const dataToSave = {
                ...data,
                photosToUpload: data.photoIds || [],
            };
            await dataStore.addOrUpdateIncident(dataToSave, id, user);
            toast.success(`Đã ${id ? 'cập nhật' : 'ghi nhận'} sự cố.`);
            if (data.cost > 0 && data.paymentMethod !== 'intangible_cost') {
                toast.info("Một phiếu chi tương ứng đã được tạo/cập nhật tự động.", { icon: 'ℹ️' });
            }
            setIsIncidentDialogOpen(false);
            setIncidentToEdit(null);
        } catch (error) {
            console.error("Failed to save incident report", error);
            toast.error("Không thể lưu báo cáo sự cố.");
        } finally {
            setIsProcessing(false);
        }
    }, [user]);

    const handleDeleteIncident = async (incident: IncidentReport) => {
        setIsProcessing(true);
        try {
            await dataStore.deleteIncident(incident);
            toast.success('Đã xóa báo cáo sự cố.');
        } catch (error) {
            console.error("Failed to delete incident:", error);
            toast.error('Không thể xóa báo cáo sự cố.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCategoriesChange = async (newCategories: IncidentCategory[]) => {
        await dataStore.updateIncidentCategories(newCategories);
    };

    const handleSaveRevenue = useCallback(async (data: Omit<RevenueStats, 'id' | 'date' | 'createdAt' | 'createdBy' | 'isEdited'>, isEdited: boolean) => {
        if (!user) return;
        setIsProcessing(true);
        try {
            const dataToSave = { ...data };
            if (!revenueStatsToEdit) {
                (dataToSave as any).date = format(new Date(), 'yyyy-MM-dd'); // Ensure date is set for new entries
            }

            const docId = await dataStore.addOrUpdateRevenueStats(dataToSave, user, isEdited, revenueStatsToEdit?.id);
            toast.success(`Đã ${revenueStatsToEdit ? 'cập nhật' : 'tạo'} phiếu thống kê.`);
            setIsRevenueDialogOpen(false);

            // Automatically open cash count dialog after saving revenue
            if (revenueStatsToEdit) {
                const linkedHandover = cashHandoverReports.find(report => report.linkedRevenueStatsId === revenueStatsToEdit.id);
                setCashCountToEdit(linkedHandover || null);
            } else {
                setCashCountToEdit(null);
            }
            setIsCashHandoverDialogOpen(true);

            setRevenueStatsToEdit(null);
        } catch (error) {
            console.error("Failed to save revenue stats", error);
            toast.error("Không thể lưu thống kê doanh thu.");
        } finally {
            setIsProcessing(false);
        }
    }, [user, revenueStatsToEdit, cashHandoverReports]);

    const handleDeleteRevenue = async (id: string) => {
        if (!user) return;
        setIsProcessing(true);
        try {
            await dataStore.deleteRevenueStats(id, user);
            toast.success("Đã xóa phiếu thống kê doanh thu.");
        } catch (error) {
            console.error("Failed to delete revenue stats", error);
            toast.error("Không thể xóa phiếu thống kê.");
        } finally {
            setIsProcessing(false);
        }
    }

    const handleEditSlip = (slip: ExpenseSlip) => {
        setSlipToEdit(slip);
        setIsExpenseDialogOpen(true);
    }

    const handleEditIncident = (incident: IncidentReport) => {
        setIncidentToEdit(incident);
        setIsIncidentDialogOpen(true);
    };

    const handleViewFinalHandover = useCallback((handover: CashHandoverReport) => {
        setFinalHandoverToView(handover);
        setIsFinalHandoverViewOpen(true);
    }, []);

    const handleEditRevenue = (stats: RevenueStats) => {
        setRevenueStatsToEdit(stats);
        setIsRevenueDialogOpen(true);
    }

    const handleHandoverSubmit = (data: any) => {
        setIsHandoverDialogOpen(false); // Close the input dialog

        const receiptData = data.handoverData;

        const latestRevenueStats = dailyRevenueStats.length > 0 ? dailyRevenueStats[0] : null;

        const revenueByCardFromApp = {
            techcombankVietQrPro: latestRevenueStats?.revenueByPaymentMethod.techcombankVietQrPro || 0,
            shopeeFood: latestRevenueStats?.revenueByPaymentMethod.shopeeFood || 0,
            grabFood: latestRevenueStats?.revenueByPaymentMethod.grabFood || 0,
            bankTransfer: latestRevenueStats?.revenueByPaymentMethod.bankTransfer || 0,
        };

        const appData = {
            expectedCash: expectedCashOnHand,
            startOfDayCash: startOfDayCash,
            cashExpense: totalCashExpense,
            cashRevenue: cashRevenue,
            deliveryPartnerPayout: Math.abs(receiptData.deliveryPartnerPayout || 0), // Use receipt data for comparison
            revenueByCard: revenueByCardFromApp,
        };

        const comparison = [
            { field: 'expectedCash', label: 'Tiền mặt dự kiến', appValue: appData.expectedCash, receiptValue: receiptData.expectedCash },
            { field: 'startOfDayCash', label: 'Tiền mặt đầu ca', appValue: appData.startOfDayCash, receiptValue: receiptData.startOfDayCash },
            { field: 'cashExpense', label: 'Chi tiền mặt', appValue: appData.cashExpense, receiptValue: receiptData.cashExpense },
            { field: 'cashRevenue', label: 'Doanh thu tiền mặt', appValue: appData.cashRevenue, receiptValue: receiptData.cashRevenue - Math.abs(receiptData.cashRefund || 0) },
            { field: 'deliveryPartnerPayout', label: 'Trả ĐTGH', appValue: appData.deliveryPartnerPayout, receiptValue: Math.abs(receiptData.deliveryPartnerPayout || 0) },
            { field: 'techcombankVietQrPro', label: 'DT: TCB VietQR', appValue: appData.revenueByCard.techcombankVietQrPro, receiptValue: (receiptData.revenueByCard?.techcombankVietQrPro ?? 0) - Math.abs(receiptData.otherRefund || 0) },
            { field: 'shopeeFood', label: 'DT: ShopeeFood', appValue: appData.revenueByCard.shopeeFood, receiptValue: receiptData.revenueByCard?.shopeeFood ?? 0 },
            { field: 'grabFood', label: 'DT: GrabFood', appValue: appData.revenueByCard.grabFood, receiptValue: receiptData.revenueByCard?.grabFood ?? 0 },
            { field: 'bankTransfer', label: 'DT: Chuyển Khoản', appValue: appData.revenueByCard.bankTransfer, receiptValue: receiptData.revenueByCard?.bankTransfer ?? 0 },
        ].map(item => ({ ...item, isMatch: Math.abs(item.appValue - (item.receiptValue || 0)) < 1 })); // Allow for rounding errors

        setComparisonResult(comparison);
        setHandoverReceiptData(data); // Store the full data including image URIs and other details
        setIsComparisonDialogOpen(true);
    };

    const handleNavigateToExpenses = () => {
        setIsComparisonDialogOpen(false);
        setTimeout(() => expenseSlipsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }

    const handleNavigateToRevenue = () => {
        setIsComparisonDialogOpen(false);
        setTimeout(() => revenueStatsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }

    const handleFinalizeHandover = async () => {
        if (!user || !handoverReceiptData) return;
        setIsProcessing(true);
        setIsComparisonDialogOpen(false);
        const toastId = toast.loading("Đang hoàn tất bàn giao ca...");
        try {
            // Find the latest cash handover report for today to attach the final details to.
            const latestReport = cashHandoverReports.length > 0 ? cashHandoverReports[0] : null;

            await dataStore.saveFinalHandoverDetails(handoverReceiptData, user, latestReport?.id);
            toast.success("Đã bàn giao ca thành công!", { id: toastId, duration: 5000 });
            // The UI will lock automatically due to the change in `isShiftFinalized`
        } catch (error) {
            console.error("Failed to finalize handover:", error);
            toast.error(`Lỗi: Không thể hoàn tất bàn giao. ${(error as Error).message}`, { id: toastId });
        } finally {
            setIsProcessing(false);
            setHandoverReceiptData(null);
            setComparisonResult(null);
        }
    };

    const handleCashCountSubmit = useCallback(async (finalData: any, id?: string) => {
        // Refactored logic for cash handover
        if (!user) return;
        setIsProcessing(true);
        try {
            if (id) {
                // Update existing report
                await dataStore.updateCashHandoverReport(id, finalData, user);
                toast.success("Đã cập nhật biên bản kiểm kê.");
            } else {
                // Create new report
                const latestRevenueStatsId = dailyRevenueStats.length > 0 ? dailyRevenueStats[0].id : null;
                await dataStore.addCashHandoverReport({
                    ...finalData,
                    startOfDayCash: startOfDayCash,
                    linkedExpenseSlipIds: dailySlips.map(s => s.id),
                    linkedRevenueStatsId: latestRevenueStatsId,
                }, user);
                toast.success("Đã ghi nhận biên bản kiểm kê tiền mặt.");
            }
            setIsCashHandoverDialogOpen(false);
            setCashCountToEdit(null);
        } catch (error) {
            console.error("Failed to save cash count:", error);
            toast.error("Lỗi: Không thể lưu biên bản kiểm kê.");
        } finally {
            setIsProcessing(false);
        }
    }, [user, dailyRevenueStats, dailySlips, startOfDayCash]);

    const handleEditCashCount = (count: CashHandoverReport) => {
        setCashCountToEdit(count);
        setIsCashHandoverDialogOpen(true);
    };

    const handleDeleteCashCount = async (countId: string) => {
        if (!user) return;
        setIsProcessing(true);
        try {
            await dataStore.deleteCashHandoverReport(countId, user);
            toast.success("Đã xóa lần kiểm kê.");
        } catch (error) {
            console.error("Failed to delete cash count:", error);
            toast.error(`Lỗi: Không thể xóa lần kiểm kê. ${(error as Error).message}`);
        } finally {
            setIsProcessing(false);
        }
    };


    const isShiftFinalized = useMemo(() => {
        return cashHandoverReports.some(report => !!report.finalHandoverDetails);
    }, [cashHandoverReports]);

    if (authLoading || isLoading || !user) {
        return <LoadingPage />;
    }

    return (
        <>
            <div className={cn("container mx-auto p-4 sm:p-6 md:p-8", !isStandalone && "p-0 sm:p-0 md:p-0")}>
                <header className="mb-8">
                    {isStandalone && (
                        <div className="flex justify-between items-center mb-4">
                            <Button variant="ghost" className="-ml-4" onClick={() => router.back()}>
                                <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại
                            </Button>
                        </div>
                    )}
                    <div className="flex justify-between items-center">
                        <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                            <Banknote />
                            Báo cáo Thu ngân
                        </h1>
                    </div>
                    <p className="text-muted-foreground mt-2">
                        Quản lý các khoản chi, doanh thu và các báo cáo tài chính trong ngày.
                    </p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    <Card className="lg:col-span-2 shadow-xl rounded-2xl border-primary/20 bg-gradient-to-br from-white to-blue-50 dark:from-card dark:to-primary/10">
                        <CardHeader>
                            <CardTitle className="text-primary">Tổng quan trong ngày</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-base">
                            <div className="flex justify-between items-center p-3 rounded-lg bg-green-500/10">
                                <p className="font-medium text-green-700 dark:text-green-300 flex items-center gap-2"><ArrowUpCircle className="h-5 w-5" /> Doanh thu tiền mặt</p>
                                <p className="font-bold text-xl text-green-600 dark:text-green-300">{cashRevenue.toLocaleString('vi-VN')}đ</p>
                            </div>
                            <div className="flex justify-between items-center p-3 rounded-lg bg-red-500/10">
                                <p className="font-medium text-red-700 dark:text-red-300 flex items-center gap-2"><ArrowDownCircle className="h-5 w-5" /> Tổng chi tiền mặt</p>
                                <p className="font-bold text-xl text-red-700 dark:text-red-300">{totalCashExpense.toLocaleString('vi-VN')}đ</p>
                            </div>
                            <div className="flex justify-between items-center py-2 px-3">
                                <p className="text-muted-foreground">Tổng chi chuyển khoản</p>
                                <p className="font-semibold">{totalBankExpense.toLocaleString('vi-VN')}đ</p>
                            </div>
                            <div className="flex justify-between items-center py-2 px-3">
                                <div className="text-muted-foreground flex items-center gap-2">Tiền mặt đầu ca <StartOfDayCashDialog currentValue={startOfDayCash} onSave={handleSaveStartOfDayCash} /></div>
                                <p className="font-semibold">{startOfDayCash.toLocaleString('vi-VN')}đ</p>
                            </div>
                            <Separator className="my-2" />
                            <div className="flex justify-between items-center pt-2 p-3 rounded-lg bg-blue-500/10">
                                <p className="font-semibold text-lg text-blue-700 dark:text-blue-300 flex items-center gap-2"><Wallet className="h-6 w-6" />Tiền mặt dự kiến cuối ca</p>
                                <p className="text-3xl font-bold text-blue-800 dark:text-blue-200">{expectedCashOnHand.toLocaleString('vi-VN')}đ</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="shadow-xl rounded-2xl">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3"><Settings className="h-5 w-5" />Chức năng</CardTitle>
                            <CardDescription>Thực hiện các báo cáo và nghiệp vụ trong ca.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3 relative">
                            <Button onClick={() => { setRevenueStatsToEdit(null); setIsRevenueDialogOpen(true); }} disabled={isShiftFinalized} className="w-full h-14 justify-start p-4 text-base bg-green-50 hover:bg-green-100 text-green-800 dark:bg-green-900/50 dark:hover:bg-green-900 dark:text-green-200">
                                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-green-100 dark:bg-green-800/50 mr-3">
                                    <Receipt className="h-5 w-5" />
                                </div>
                                Nhập Doanh thu
                            </Button>
                            <Button onClick={() => { setSlipToEdit(null); setIsExpenseDialogOpen(true); }} disabled={isShiftFinalized} className="w-full h-14 justify-start p-4 text-base bg-blue-50 hover:bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:hover:bg-blue-900 dark:text-blue-200">
                                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-800/50 mr-3">
                                    <PlusCircle className="h-5 w-5" />
                                </div>
                                Tạo Phiếu chi
                            </Button>
                            <Button onClick={() => { setIsIncidentDialogOpen(true); setIncidentToEdit(null); }} disabled={isShiftFinalized} className="w-full h-14 justify-start p-4 text-base bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:hover:bg-amber-900 dark:text-amber-200">
                                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-800/50 mr-3">
                                    <FileWarning className="h-5 w-5" />
                                </div>
                                Ghi nhận Sự cố
                            </Button>
                            {/* <Button onClick={() => { setCashCountToEdit(null); setIsCashHandoverDialogOpen(true); }} disabled={isShiftFinalized} className="w-full h-14 justify-start p-4 text-base bg-purple-50 hover:bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:hover:bg-purple-900 dark:text-purple-200">
                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-800/50 mr-3">
                            <ClipboardCheck className="h-5 w-5"/>
                        </div>
                        Kiểm kê tiền mặt
                    </Button> */}
                            <Button onClick={() => setIsHandoverDialogOpen(true)} disabled={dailyRevenueStats.length === 0 || isShiftFinalized} className="w-full h-14 justify-start p-4 text-base" variant={isShiftFinalized ? 'secondary' : 'default'}>
                                <div className={cn("flex items-center justify-center h-8 w-8 rounded-full mr-3", isShiftFinalized ? "bg-muted" : "bg-primary/20")}>
                                    {isShiftFinalized ? <Lock className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
                                </div>
                                {isShiftFinalized ? 'Đã Bàn Giao' : 'Bàn giao cuối ca'}
                            </Button>
                            {isShiftFinalized && (
                                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
                                    <div className="text-center p-4">
                                        <Lock className="mx-auto h-12 w-12 text-primary" />
                                        <p className="mt-4 font-semibold text-lg">Ca đã được bàn giao</p>
                                        <p className="text-sm text-muted-foreground">Các thao tác nhập liệu đã được khóa.</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 gap-6 mt-6">
                    <Card ref={revenueStatsRef} className="shadow-lg rounded-2xl">
                        <CardHeader className="border-b border-green-200 dark:border-green-800/50 bg-green-50/50 dark:bg-green-900/10">
                            <CardTitle className="text-green-800 dark:text-green-300 flex items-center gap-2"><Receipt /> Thống kê Doanh thu trong ngày</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            {dailyRevenueStats.length > 0 ? (
                                isMobile ? (
                                    <div className="space-y-3">
                                        {dailyRevenueStats.map((stat, index) => {
                                            const canEdit = stat.createdBy.userId === user.uid;
                                            const isLatest = index === 0 && !isShiftFinalized;
                                            const prevStat = dailyRevenueStats[index + 1];
                                            const difference = prevStat ? stat.netRevenue - prevStat.netRevenue : 0;
                                            const displayTime = stat.reportTimestamp
                                                ? format(parseISO(stat.reportTimestamp), 'HH:mm')
                                                : format(new Date(stat.createdAt as string), 'HH:mm');

                                            return (
                                                <Card key={stat.id} className={cn("bg-background", isLatest && "border-primary")}>
                                                    <CardContent className="p-3">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="space-y-1">
                                                                <div className="font-semibold flex items-center gap-2 flex-wrap">
                                                                    <p>Phiếu của {stat.createdBy.userName}</p>
                                                                    {isLatest && <Badge>Mới nhất</Badge>}
                                                                </div>
                                                                <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                                    <span>Lúc {displayTime}</span>
                                                                    {stat.isAiGenerated && <Badge className="bg-blue-100 text-blue-800"><Wand2 className="h-3 w-3 mr-1" />AI</Badge>}
                                                                    {stat.isEdited && <Badge variant="secondary" className="text-xs">Đã sửa</Badge>}
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col items-end">
                                                                <p className="font-bold text-lg text-green-600">{(stat.netRevenue || 0).toLocaleString('vi-VN')}đ</p>
                                                                {difference !== 0 && <ChangeIndicator value={difference} />}
                                                            </div>
                                                        </div>
                                                        {canEdit && (
                                                            <div className="flex justify-end gap-2 mt-2 border-t pt-2">
                                                                <Button variant="ghost" size="sm" onClick={() => handleEditRevenue(stat)}><Edit className="mr-2 h-4 w-4" />Sửa</Button>
                                                                <AlertDialog>
                                                                    <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Xóa</Button></AlertDialogTrigger>
                                                                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Xóa phiếu thống kê?</AlertDialogTitle><AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteRevenue(stat.id)}>Xóa</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                                                </AlertDialog>
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="border rounded-lg overflow-hidden">
                                        <Table>
                                            <TableHeader className="bg-muted/50">
                                                <TableRow>
                                                    <TableHead className="text-xs uppercase">Người tạo</TableHead>
                                                    <TableHead className="text-xs uppercase">Thời gian</TableHead>
                                                    <TableHead className="text-right text-xs uppercase">Doanh thu Net</TableHead>
                                                    <TableHead className="text-right text-xs uppercase">Hành động</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {dailyRevenueStats.map((stat, index) => {
                                                    const canEdit = stat.createdBy.userId === user.uid;
                                                    const isLatest = index === 0 && !isShiftFinalized;
                                                    const prevStat = dailyRevenueStats[index + 1];
                                                    const difference = prevStat ? stat.netRevenue - prevStat.netRevenue : 0;
                                                    const displayTime = stat.reportTimestamp
                                                        ? format(parseISO(stat.reportTimestamp), 'HH:mm')
                                                        : format(new Date(stat.createdAt as string), 'HH:mm');
                                                    return (
                                                        <TableRow key={stat.id} className={cn(isLatest && "bg-primary/5")}>
                                                            <TableCell className="font-medium">{stat.createdBy.userName} {stat.isEdited && <Badge variant="secondary" className="ml-2 text-xs">Đã sửa</Badge>}</TableCell>
                                                            <TableCell className="text-sm text-muted-foreground">{displayTime}</TableCell>
                                                            <TableCell className="text-right font-bold text-lg text-green-600">
                                                                <div className="flex items-center justify-end gap-2 flex-wrap">
                                                                    {(stat.netRevenue || 0).toLocaleString('vi-VN')}đ
                                                                    {difference !== 0 && <ChangeIndicator value={difference} />}
                                                                    {stat.isAiGenerated && <Badge className="bg-blue-100 text-blue-800"><Wand2 className="h-3 w-3 mr-1" />AI</Badge>}
                                                                    {isLatest && <Badge variant="outline" className="ml-2">Mới nhất</Badge>}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                {canEdit && !isShiftFinalized && (
                                                                    <>
                                                                        <Button variant="ghost" size="icon" onClick={() => handleEditRevenue(stat)}><Edit className="h-4 w-4" /></Button>
                                                                        <AlertDialog>
                                                                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                                            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Xóa phiếu thống kê?</AlertDialogTitle><AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteRevenue(stat.id)}>Xóa</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                                                        </AlertDialog>
                                                                    </>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )
                            ) : (
                                <div className="text-center py-10">
                                    <p className="text-sm text-muted-foreground mb-4">Chưa có phiếu thống kê doanh thu nào trong hôm nay.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card ref={expenseSlipsRef} className="shadow-lg rounded-2xl">
                        <CardHeader className="border-b border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-900/10">
                            <CardTitle className="text-blue-800 dark:text-blue-300 flex items-center gap-2"><Wallet /> Phiếu chi trong ngày</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                            {dailySlips.length > 0 ? (
                                isMobile ? (
                                    <div className="space-y-3">
                                        {dailySlips.map(slip => {
                                            const canEdit = slip.createdBy.userId === user.uid && !slip.associatedHandoverReportId && !isShiftFinalized;
                                            const actualAmount = slip.paymentMethod === 'cash' ? slip.actualPaidAmount ?? slip.totalAmount : slip.totalAmount;
                                            return (
                                                <Card key={slip.id} className="bg-background">
                                                    <CardContent className="p-3">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="space-y-1 pr-2">
                                                                <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                                                                    <p>{getSlipContentName(slip.items[0])}{slip.items.length > 1 && ` và ${slip.items.length - 1} mục khác`}</p>
                                                                    {slip.isAiGenerated && <Badge className="bg-blue-100 text-blue-800">AI</Badge>}
                                                                    {slip.lastModifiedBy && <Badge variant="outline">Đã sửa</Badge>}
                                                                    {slip.associatedHandoverReportId && <Badge variant="outline">Tự động</Badge>}
                                                                </div>
                                                                <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
                                                                    <span>{slip.createdBy.userName}</span>
                                                                    <span>•</span>
                                                                    <span>{slip.lastModified ? format(new Date(slip.lastModified as string), 'HH:mm') : format(new Date(slip.createdAt as string), 'HH:mm')}</span>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="font-bold text-base text-red-600">-{actualAmount.toLocaleString('vi-VN')}đ</p>
                                                                <div className="flex items-center justify-end gap-2 text-sm mt-1">
                                                                    {slip.paymentMethod === 'cash' ? <Wallet className="h-4 w-4" /> : <LandPlot className="h-4 w-4" />}
                                                                    <span>{slip.paymentMethod === 'cash' ? 'Tiền mặt' : 'CK'}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {canEdit && (
                                                            <div className="flex justify-end gap-2 mt-2 border-t pt-2">
                                                                <Button variant="ghost" size="sm" onClick={() => handleEditSlip(slip)} disabled={isProcessing}><Edit className="mr-2 h-4 w-4" />Sửa</Button>
                                                                <AlertDialog>
                                                                    <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive" disabled={isProcessing}><Trash2 className="mr-2 h-4 w-4" />Xóa</Button></AlertDialogTrigger>
                                                                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Xác nhận xóa?</AlertDialogTitle><AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => dataStore.deleteExpenseSlip(slip).then(() => toast.success("Đã xóa phiếu chi.")).catch(() => toast.error("Lỗi xóa phiếu chi."))}>Xóa</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                                                </AlertDialog>
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="border rounded-lg overflow-hidden">
                                        <Table>
                                            <TableHeader className="bg-muted/50">
                                                <TableRow>
                                                    <TableHead className="text-xs uppercase">Người tạo</TableHead>
                                                    <TableHead className="text-xs uppercase">Nội dung</TableHead>
                                                    <TableHead className="text-xs uppercase">Thời gian</TableHead>
                                                    <TableHead className="text-right text-xs uppercase">Tổng tiền / Thực trả</TableHead>
                                                    <TableHead className="text-xs uppercase">Hình thức</TableHead>
                                                    <TableHead className="text-right text-xs uppercase">Hành động</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {dailySlips.map(slip => {
                                                    const canEdit = slip.createdBy.userId === user.uid && !slip.associatedHandoverReportId && !isShiftFinalized;
                                                    return (
                                                        <TableRow key={slip.id}>
                                                            <TableCell>{slip.createdBy.userName}</TableCell>
                                                            <TableCell className="font-medium">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span>{getSlipContentName(slip.items[0])}{slip.items.length > 1 && ` và ${slip.items.length - 1} mục khác`}</span>
                                                                    {slip.isAiGenerated && <Badge className="bg-blue-100 text-blue-800">AI</Badge>}
                                                                    {slip.lastModifiedBy && <Badge variant="outline" className="text-xs">Đã sửa</Badge>}
                                                                    {slip.associatedHandoverReportId && <Badge variant="outline" className="font-normal">Tự động</Badge>}
                                                                </div>
                                                                <p className="text-xs text-muted-foreground font-normal">{slip.notes || 'Không có ghi chú'}</p>
                                                            </TableCell>
                                                            <TableCell className="text-sm text-muted-foreground">
                                                                {slip.lastModifiedBy && slip.lastModified ? (
                                                                    <div className="flex items-center gap-1">
                                                                        <Edit2 className="h-3 w-3 text-yellow-500" />
                                                                        {format(new Date(slip.lastModified as string), 'HH:mm')}
                                                                    </div>
                                                                ) : (
                                                                    format(new Date(slip.createdAt as string), 'HH:mm')
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-right font-bold text-lg text-red-600">
                                                                <div className='flex flex-col items-end'>
                                                                    <span>{slip.totalAmount.toLocaleString('vi-VN')}đ</span>
                                                                    {(slip.paymentMethod === 'cash' && typeof slip.actualPaidAmount === 'number' && slip.actualPaidAmount !== slip.totalAmount) && (
                                                                        <span className='text-xs font-normal text-red-600'>(Thực trả: {(slip.actualPaidAmount).toLocaleString('vi-VN')}đ)</span>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge variant={slip.paymentMethod === 'cash' ? 'secondary' : 'outline'}>
                                                                    {slip.paymentMethod === 'cash' ? <Wallet className="mr-1 h-3 w-3" /> : <LandPlot className="mr-1 h-3 w-3" />}
                                                                    {slip.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                {canEdit ? (
                                                                    <>
                                                                        <Button variant="ghost" size="icon" onClick={() => handleEditSlip(slip)} disabled={isProcessing}>
                                                                            <Edit className="h-4 w-4" />
                                                                        </Button>
                                                                        <AlertDialog>
                                                                            <AlertDialogTrigger asChild>
                                                                                <Button variant="ghost" size="icon" className="text-destructive" disabled={isProcessing}>
                                                                                    <Trash2 className="h-4 w-4" />
                                                                                </Button>
                                                                            </AlertDialogTrigger>
                                                                            <AlertDialogContent>
                                                                                <AlertDialogHeader>
                                                                                    <AlertDialogTitle>Xác nhận xóa phiếu chi?</AlertDialogTitle>
                                                                                    <AlertDialogDescription>Hành động này không thể được hoàn tác và sẽ xóa tất cả ảnh đính kèm.</AlertDialogDescription>
                                                                                </AlertDialogHeader>
                                                                                <AlertDialogFooter>
                                                                                    <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                                                    <AlertDialogAction onClick={() => handleDeleteSlip(slip)}>Xóa</AlertDialogAction>
                                                                                </AlertDialogFooter>
                                                                            </AlertDialogContent>
                                                                        </AlertDialog>
                                                                    </>
                                                                ) : null}
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )
                            ) : (
                                <p className="text-center text-sm text-muted-foreground py-10">Chưa có phiếu chi nào trong hôm nay.</p>
                            )}
                            {isProcessing && <div className="absolute inset-0 bg-white/70 dark:bg-black/70 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}
                        </CardContent>
                    </Card>

                    <Card className="shadow-lg rounded-2xl">
                        <CardHeader className="border-b border-purple-200 dark:border-purple-800/50 bg-purple-50/50 dark:bg-purple-900/10">
                            <CardTitle className="text-purple-800 dark:text-purple-300 flex items-center gap-2"><ClipboardCheck /> Lịch sử Kiểm kê Tiền mặt</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                            {cashHandoverReports.length > 0 ? (
                                <div className="space-y-3">
                                    {cashHandoverReports.filter(handover => handover.createdAt).map((handover) => {
                                        const linkedRevenue = dailyRevenueStats.find(r => r.id === handover.linkedRevenueStatsId);
                                        const cashRevenue = linkedRevenue?.revenueByPaymentMethod.cash || 0;

                                        const linkedExpenses = dailySlips.filter(e => handover.linkedExpenseSlipIds.includes(e.id) && e.paymentMethod === 'cash');
                                        const cashExpense = linkedExpenses.reduce((sum, slip) => sum + (slip.actualPaidAmount ?? slip.totalAmount), 0);

                                        const startOfDayCash = handover.startOfDayCash;
                                        const expectedCash = cashRevenue - cashExpense + startOfDayCash;
                                        const discrepancy = handover.actualCashCounted - expectedCash;

                                        return (
                                            <div key={handover.id}>
                                                <Card className="bg-background">
                                                    <CardContent className="p-3">
                                                        <div className="flex justify-between items-start gap-2 mb-2">
                                                            <div>
                                                                <p className="font-semibold">{handover.createdBy.userName}</p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Lúc {format((handover.createdAt as Timestamp).toDate(), 'HH:mm')}
                                                                </p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="font-bold text-base">{(handover.actualCashCounted).toLocaleString('vi-VN')}đ</p>
                                                                {discrepancy !== 0 && (
                                                                    <p className={cn("text-xs font-semibold", discrepancy > 0 ? "text-green-600" : "text-red-600")}>
                                                                        {discrepancy > 0 ? '+' : ''}{parseInt(discrepancy.toString()).toLocaleString('vi-VN')}đ
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="text-sm">
                                                            {handover.discrepancyReason && <p className="text-muted-foreground italic">Lý do: {handover.discrepancyReason}</p>}
                                                            {handover.discrepancyProofPhotos && handover.discrepancyProofPhotos.length > 0 && (
                                                                <Button variant="link" size="sm" className="h-auto p-0 mt-1" onClick={() => openLightbox(handover.discrepancyProofPhotos!.map(p => ({ src: p })))}>Xem {handover.discrepancyProofPhotos.length} ảnh bằng chứng</Button>
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                    {/* {handover.createdBy.userId === user.uid && (
                                            <CardFooter className="p-2 pt-0 justify-end gap-1" hidden={isShiftFinalized}>
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditCashCount(handover)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Xác nhận xóa?</AlertDialogTitle><AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteCashCount(handover.id)}>Xóa</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                                </AlertDialog>
                                            </CardFooter>
                                        )} */}
                                                </Card>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-center text-sm text-muted-foreground py-10">Chưa có lần kiểm kê nào trong ngày.</p>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="shadow-lg rounded-2xl">
                        <CardHeader className="border-b border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10">
                            <CardTitle className="text-amber-800 dark:text-amber-300 flex items-center gap-2"><AlertTriangle /> Sự cố trong ngày</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                            {dailyIncidents.length > 0 ? (
                                <div className="space-y-3">
                                    {dailyIncidents.map(incident => {
                                        const canEdit = incident.createdBy.userId === user.uid && !isShiftFinalized;
                                        return (
                                            <Card key={incident.id} className="bg-background">
                                                <CardContent className="p-3">
                                                    <div className="flex justify-between items-start gap-2 mb-2">
                                                        <div>
                                                            <div className="font-semibold flex items-center gap-2 flex-wrap">
                                                                <p>{incident.content}</p>
                                                                <Badge variant="secondary">{incident.category}</Badge>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground">{incident.createdBy.userName} • {format(new Date(incident.createdAt as string), 'HH:mm')}</p>
                                                        </div>
                                                        <p className="font-bold text-amber-600">{incident.cost > 0 && `${incident.cost.toLocaleString('vi-VN')}đ`}</p>
                                                    </div>
                                                    {canEdit && (
                                                        <div className="flex justify-end gap-2 mt-2 border-t pt-2">
                                                            {incident.photos && incident.photos.length > 0 && <Button variant="outline" size="sm" onClick={() => openLightbox(incident.photos.map(p => ({ src: p })))}>Xem {incident.photos.length} ảnh</Button>}
                                                            <Button variant="ghost" size="sm" onClick={() => handleEditIncident(incident)}><Edit className="mr-2 h-4 w-4" />Sửa</Button>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Xóa</Button></AlertDialogTrigger>
                                                                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Xóa ghi nhận này?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteIncident(incident)}>Xóa</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                                            </AlertDialog>
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        )
                                    })}
                                </div>
                            ) : (
                                <p className="text-center text-sm text-muted-foreground py-10">Không có sự cố nào được ghi nhận hôm nay.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <ExpenseSlipDialog
                open={isExpenseDialogOpen}
                onOpenChange={setIsExpenseDialogOpen}
                onSave={handleSaveSlip}
                isProcessing={isProcessing}
                slipToEdit={slipToEdit}
                inventoryList={inventoryList}
                reporter={user}
                otherCostCategories={otherCostCategories}
            />
            <IncidentReportDialog
                open={isIncidentDialogOpen}
                onOpenChange={setIsIncidentDialogOpen}
                onSave={handleSaveIncident}
                isProcessing={isProcessing}
                categories={incidentCategories}
                onCategoriesChange={handleCategoriesChange as any}
                canManageCategories={user.role === 'Chủ nhà hàng'}
                reporter={{ userId: user.uid, userName: user.displayName }}
                incidentToEdit={incidentToEdit}
            />
            <RevenueStatsDialog
                open={isRevenueDialogOpen}
                onOpenChange={setIsRevenueDialogOpen}
                onSave={handleSaveRevenue}
                isProcessing={isProcessing}
                existingStats={revenueStatsToEdit}
                reporter={user}
            />
            <HandoverDialog
                open={isHandoverDialogOpen}
                onOpenChange={setIsHandoverDialogOpen}
                onSubmit={handleHandoverSubmit}
                isProcessing={isProcessing}
                reporter={user}
            />
            {handoverReceiptData && (
                <HandoverComparisonDialog
                    open={isComparisonDialogOpen}
                    onOpenChange={setIsComparisonDialogOpen}
                    comparisonResult={comparisonResult as any}
                    onNavigateToExpenses={handleNavigateToExpenses}
                    onNavigateToRevenue={handleNavigateToRevenue}
                    onConfirm={handleFinalizeHandover}
                />
            )}
            {isCashHandoverDialogOpen && (
                <CashHandoverDialog
                    open={isCashHandoverDialogOpen}
                    onOpenChange={setIsCashHandoverDialogOpen}
                    onSubmit={handleCashCountSubmit}
                    isProcessing={isProcessing}
                    expectedCash={expectedCashForDialog}
                    countToEdit={cashCountToEdit}
                    linkedRevenueStats={linkedRevenueForDialog}
                    linkedExpenseSlips={linkedExpensesForDialog}
                />
            )}
            {finalHandoverToView && (
                <HandoverDialog
                    open={isFinalHandoverViewOpen}
                    onOpenChange={setIsFinalHandoverViewOpen}
                    onSubmit={() => { }} // Read-only, so no-op
                    isProcessing={false}
                    reportToEdit={finalHandoverToView.finalHandoverDetails}
                    isOwnerView={true}
                    reporter={user}
                />
            )}
        </>
    );
}

export function CashierHomeView({ isStandalone = false }: CashierDashboardProps) {
    return (
        <WorkShiftGuard redirectPath="/">
            <CashierDashboardPageComponent isStandalone={isStandalone} />
        </WorkShiftGuard>
    )
}
