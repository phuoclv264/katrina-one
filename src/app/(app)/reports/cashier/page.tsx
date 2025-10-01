'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { dataStore } from '@/lib/data-store';
import type { ExpenseSlip, IncidentReport, RevenueStats, InventoryItem, OtherCostCategory, AssignedUser, ExpenseItem, IncidentCategory, ManagedUser, HandoverReport } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Banknote, Receipt, AlertTriangle, ArrowRight, Wallet, FileWarning, Calendar, LandPlot, Settings, Edit2, ChevronLeft, ChevronRight, Trash2, Eye, Edit, Loader2, ClipboardCheck, ClipboardX, TrendingUp, TrendingDown } from 'lucide-react';
import { format, startOfMonth, endOfMonth, isSameMonth, parseISO, addMonths, subMonths } from 'date-fns';
import { vi } from 'date-fns/locale';
import ExpenseSlipDialog from '../../cashier/_components/expense-slip-dialog';
import RevenueStatsDialog from '../../cashier/_components/revenue-stats-dialog';
import { toast } from 'react-hot-toast';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import OtherCostCategoryDialog from './_components/other-cost-category-dialog';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import IncidentCategoryDialog from '../../cashier/_components/incident-category-dialog';
import IncidentReportDialog from '../../cashier/_components/incident-report-dialog';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Image from 'next/image';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import OwnerHandoverReportDialog from './_components/owner-handover-report-dialog';
import UnpaidSlipsDialog from './_components/unpaid-slips-dialog';


type GroupedReports = {
  [date: string]: {
    revenue: RevenueStats[];
    expenses?: ExpenseSlip[];
    incidents?: IncidentReport[];
    handover?: HandoverReport;
  };
};

const getSlipContentName = (item: ExpenseItem): string => {
    if (item.itemId === 'other_cost') {
      if (item.name === 'Khác' && item.description) {
          return item.description;
      }
      return item.name;
  }
  return item.name;
}


const ExpenseList = ({ expenses, onEdit, canDelete, onDelete, isProcessing }: { expenses: ExpenseSlip[], onEdit: (slip: ExpenseSlip) => void, canDelete: boolean, onDelete: (id: string) => void, isProcessing: boolean }) => {
  return (
      <div className="space-y-3">
          {expenses.map((expense, index) => (
              <div key={expense.id} className="border-t first:border-t-0 pt-3 first:pt-0">
                  <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                          <p className="font-semibold">{getSlipContentName(expense.items[0])}{expense.items.length > 1 && ` và ${expense.items.length - 1} mục khác`}</p>
                          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground mt-1">
                              <span>{expense.createdBy.userName}</span>
                              <span className="text-gray-300">•</span>
                              <span>{format(new Date(expense.createdAt as string), 'HH:mm')}</span>
                              <span className="text-gray-300">•</span>
                              <Badge variant={expense.paymentMethod === 'cash' ? 'secondary' : 'outline'} className="text-xs">
                                {expense.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                              </Badge>
                              {expense.isAiGenerated && <Badge className="text-xs bg-blue-100 text-blue-800">AI</Badge>}
                              {expense.lastModifiedBy && <Badge variant="outline" className="text-xs">Đã sửa</Badge>}
                              {expense.associatedHandoverReportId && <Badge variant="secondary" className="font-normal text-xs">Tự động</Badge>}
                          </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                          <p className="text-xl font-bold text-red-600">-{expense.totalAmount.toLocaleString('vi-VN')}đ</p>
                          {(expense.paymentMethod === 'cash' && typeof expense.actualPaidAmount === 'number' && expense.actualPaidAmount !== expense.totalAmount) && (
                              <p className='text-xs text-red-600'>(Thực trả: {(expense.actualPaidAmount).toLocaleString('vi-VN')}đ)</p>
                          )}
                      </div>
                  </div>
                   <div className="flex justify-end items-center gap-1 mt-1">
                        <Button variant="outline" size="sm" onClick={() => onEdit(expense)} className="h-8">Chi tiết</Button>
                        {canDelete && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" disabled={isProcessing}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Xóa phiếu chi này?</AlertDialogTitle>
                                        <AlertDialogDescription>Hành động này sẽ xóa vĩnh viễn phiếu chi và không thể hoàn tác.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => onDelete(expense.id)}>Xóa</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
              </div>
          ))}
      </div>
  );
};


export default function CashierReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [allData, setAllData] = useState<{
    revenueStats: RevenueStats[];
    expenseSlips: ExpenseSlip[];
    incidents: IncidentReport[];
    inventoryList: InventoryItem[],
    otherCostCategories: OtherCostCategory[],
    incidentCategories: IncidentCategory[],
    users: ManagedUser[],
    handoverReports: HandoverReport[],
  }>({ revenueStats: [], expenseSlips: [], incidents: [], inventoryList: [], otherCostCategories: [], incidentCategories: [], users: [], handoverReports: [] });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isRevenueDialogOpen, setIsRevenueDialogOpen] = useState(false);
  const [isIncidentDialogOpen, setIsIncidentDialogOpen] = useState(false);
  const [isOtherCostCategoryDialogOpen, setIsOtherCostCategoryDialogOpen] = useState(false);
  const [isIncidentCategoryDialogOpen, setIsIncidentCategoryDialogOpen] = useState(false);
  const [isIntangibleCostDialogOpen, setIsIntangibleCostDialogOpen] = useState(false);
  const [isHandoverReportDialogOpen, setIsHandoverReportDialogOpen] = useState(false);
  const [isUnpaidSlipsDialogOpen, setIsUnpaidSlipsDialogOpen] = useState(false);
  
  const [slipToEdit, setSlipToEdit] = useState<ExpenseSlip | null>(null);
  const [revenueStatsToEdit, setRevenueStatsToEdit] = useState<RevenueStats | null>(null);
  const [incidentToEdit, setIncidentToEdit] = useState<IncidentReport | null>(null);
  const [handoverToEdit, setHandoverToEdit] = useState<HandoverReport | null>(null);
  
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxSlides, setLightboxSlides] = useState<{ src: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
        if (lightboxOpen) {
            event.preventDefault();
            setLightboxOpen(false);
        }
    };

    if (lightboxOpen) {
        window.history.pushState(null, '', window.location.href);
        window.addEventListener('popstate', handlePopState);
    }
    return () => {
        window.removeEventListener('popstate', handlePopState);
    };
  }, [lightboxOpen]);


  useEffect(() => {
    if (!authLoading && user?.role !== 'Chủ nhà hàng') {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    
    setIsLoading(true);

    const unsubExpense = dataStore.subscribeToAllExpenseSlips(slips => setAllData(prev => ({...prev, expenseSlips: slips})));
    const unsubIncidents = dataStore.subscribeToAllIncidents(incidents => setAllData(prev => ({...prev, incidents: incidents})));
    const unsubRevenue = dataStore.subscribeToAllRevenueStats(stats => setAllData(prev => ({...prev, revenueStats: stats})));
    const unsubInventory = dataStore.subscribeToInventoryList(items => setAllData(prev => ({...prev, inventoryList: items})));
    const unsubOtherCostCategories = dataStore.subscribeToOtherCostCategories(categories => setAllData(prev => ({...prev, otherCostCategories: categories})));
    const unsubIncidentCategories = dataStore.subscribeToIncidentCategories(categories => setAllData(prev => ({...prev, incidentCategories: categories})));
    const unsubUsers = dataStore.subscribeToUsers(users => setAllData(prev => ({...prev, users: users})));
    const unsubHandovers = dataStore.subscribeToAllHandoverReports(reports => setAllData(prev => ({...prev, handoverReports: reports})));
    
    const timer = setTimeout(() => setIsLoading(false), 1500);

    return () => {
      unsubExpense();
      unsubIncidents();
      unsubRevenue();
      unsubInventory();
      unsubOtherCostCategories();
      unsubIncidentCategories();
      unsubUsers();
      unsubHandovers();
      clearTimeout(timer);
    };
  }, [user]);

  const allMonthsWithData = useMemo(() => {
    const monthSet = new Set<string>();
    const combined = [...allData.revenueStats, ...allData.expenseSlips, ...allData.incidents, ...allData.handoverReports];
    combined.forEach(item => {
        monthSet.add(format(parseISO(item.date), 'yyyy-MM'));
    });
    return Array.from(monthSet).sort().reverse();
  }, [allData]);

  useEffect(() => {
    if (allMonthsWithData.length > 0) {
      setCurrentMonth(parseISO(`${allMonthsWithData[0]}-01`));
    }
  }, [allMonthsWithData]);

    const reportsForCurrentMonth = useMemo(() => {
    const reports: GroupedReports = {};

    const filterAndGroup = (items: (RevenueStats | ExpenseSlip | IncidentReport | HandoverReport)[]) => {
      items.forEach(item => {
        const itemDate = parseISO(item.date);
        if (isSameMonth(itemDate, currentMonth)) {
          if (!reports[item.date]) {
            reports[item.date] = { revenue: [] }; // Initialize revenue as an array
          }
           if ('netRevenue' in item) { // RevenueStats
            reports[item.date].revenue.push(item);
          } else if ('expenseType' in item) { // ExpenseSlip
            if (!reports[item.date].expenses) reports[item.date].expenses = [];
            reports[item.date].expenses!.push(item);
          } else if ('content' in item) { // IncidentReport
            if (!reports[item.date].incidents) reports[item.date].incidents = [];
            reports[item.date].incidents!.push(item);
          } else if ('handoverImageUrl' in item) { // HandoverReport
            reports[item.date].handover = item;
          }
        }
      });
    };
    
    filterAndGroup(allData.revenueStats);
    filterAndGroup(allData.expenseSlips);
    filterAndGroup(allData.incidents);
    filterAndGroup(allData.handoverReports);

    // Sort entries within each day
    for (const date in reports) {
      reports[date].revenue?.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
      reports[date].expenses?.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
      reports[date].incidents?.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
    }

    return reports;
  }, [currentMonth, allData]);

  const sortedDatesInMonth = useMemo(() => Object.keys(reportsForCurrentMonth).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()), [reportsForCurrentMonth]);
  
  const monthlyBankTransferSlips = useMemo(() => {
    return allData.expenseSlips.filter(slip => 
        isSameMonth(parseISO(slip.date), currentMonth) &&
        slip.paymentMethod === 'bank_transfer'
    );
  }, [allData.expenseSlips, currentMonth]);

  const monthlySummary = useMemo(() => {
      const reportsInMonth = Object.values(reportsForCurrentMonth).flat();
      const allExpenses = reportsInMonth.flatMap(day => day.expenses || []);
      const allRevenueStats = reportsInMonth.flatMap(day => day.revenue || []);
      const allIncidents = reportsInMonth.flatMap(day => day.incidents || []);

      const latestDailyStats: { [date: string]: RevenueStats } = {};
        allRevenueStats.forEach(stat => {
            if (!latestDailyStats[stat.date] || new Date(stat.createdAt as string) > new Date(latestDailyStats[stat.date].createdAt as string)) {
                latestDailyStats[stat.date] = stat;
            }
        });
      
      const totalRevenue = Object.values(latestDailyStats).reduce((sum, stat) => sum + (stat.netRevenue || 0), 0);
      const totalExpense = allExpenses.reduce((sum, slip) => sum + slip.totalAmount, 0);
  
      const revenueByMethod = Object.values(latestDailyStats).reduce((acc, stat) => {
          if (stat.revenueByPaymentMethod) {
              for (const key in stat.revenueByPaymentMethod) {
                  acc[key] = (acc[key] || 0) + stat.revenueByPaymentMethod[key as keyof typeof stat.revenueByPaymentMethod];
              }
          }
          return acc;
      }, {} as {[key: string]: number});
      
      const expenseByPaymentMethod = allExpenses.reduce((acc, slip) => {
          acc[slip.paymentMethod] = (acc[slip.paymentMethod] || 0) + slip.totalAmount;
          return acc;
      }, {} as {[key: string]: number});
      
      const unpaidBankTransfer = monthlyBankTransferSlips
        .filter(s => s.paymentStatus === 'unpaid')
        .reduce((sum, slip) => sum + slip.totalAmount, 0);

      const intangibleCost = allIncidents
        .filter(i => i.paymentMethod === 'intangible_cost' && i.cost > 0)
        .reduce((sum, i) => sum + i.cost, 0);

      const expenseByType = allExpenses.reduce((acc, slip) => {
          const type = slip.expenseType === 'goods_import' ? 'Nhập hàng' : (getSlipContentName(slip.items[0]) || 'Khác');
          acc[type] = (acc[type] || 0) + slip.totalAmount;
          return acc;
      }, {} as {[key: string]: number});
      
      return { totalRevenue, totalExpense, revenueByMethod, expenseByType, expenseByPaymentMethod, intangibleCost, unpaidBankTransfer };
  }, [reportsForCurrentMonth, monthlyBankTransferSlips]);


  const handleMonthChange = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => direction === 'next' ? addMonths(prev, 1) : subMonths(prev, 1));
  };
  
  const isNextMonthButtonDisabled = useMemo(() => {
    if (allMonthsWithData.length === 0) return true;
    const currentMonthKey = format(currentMonth, 'yyyy-MM');
    return currentMonthKey === allMonthsWithData[0];
  }, [currentMonth, allMonthsWithData]);


  const handleEditExpense = (slip: ExpenseSlip) => {
      setSlipToEdit(slip);
      setIsExpenseDialogOpen(true);
  }

  const handleEditRevenue = (stats: RevenueStats) => {
      setRevenueStatsToEdit(stats);
      setIsRevenueDialogOpen(true);
  }

  const handleEditIncident = (incident: IncidentReport) => {
    setIncidentToEdit(incident);
    setIsIncidentDialogOpen(true);
  };

  const handleEditHandover = (handover: HandoverReport) => {
      setHandoverToEdit(handover);
      setIsHandoverReportDialogOpen(true);
  };

  const handleSaveSlip = useCallback(async (data: any, id?: string) => {
    if (!user) return;
    setIsProcessing(true);
    try {
        const slipData = { 
            ...data, 
            createdBy: slipToEdit?.createdBy || { userId: user.uid, userName: user.displayName },
            lastModifiedBy: id ? { userId: user.uid, userName: user.displayName } : undefined
        };
        await dataStore.addOrUpdateExpenseSlip(slipData, id);
        toast.success(`Đã cập nhật phiếu chi.`);
        setIsExpenseDialogOpen(false);
    } catch (error) {
        console.error("Failed to save expense slip", error);
        toast.error("Không thể lưu phiếu chi.");
    } finally {
        setIsProcessing(false);
    }
  }, [user, slipToEdit]);

  const handleSaveRevenue = useCallback(async (data: Omit<RevenueStats, 'id' | 'date' | 'createdAt' | 'createdBy' | 'isEdited'>, isEdited: boolean) => {
    if(!user || !revenueStatsToEdit) return;
    setIsProcessing(true);
    try {
        await dataStore.addOrUpdateRevenueStats(data, user, isEdited, revenueStatsToEdit.id);
        toast.success("Đã cập nhật doanh thu.");
        setIsRevenueDialogOpen(false);
    } catch(error) {
        console.error("Failed to save revenue stats", error);
        toast.error("Không thể lưu doanh thu.");
    } finally {
        setIsProcessing(false);
    }
  }, [user, revenueStatsToEdit]);

  const handleSaveIncident = useCallback(async (data: any, id?: string) => {
    if (!user) return;
    setIsProcessing(true);
    try {
      await dataStore.addOrUpdateIncident(data, id, user);
      toast.success(`Đã ${id ? 'cập nhật' : 'ghi nhận'} sự cố.`);
      setIsIncidentDialogOpen(false);
    } catch (error) {
      console.error('Failed to save incident:', error);
      toast.error('Không thể lưu báo cáo sự cố.');
    } finally {
      setIsProcessing(false);
    }
  }, [user]);

   const handleSaveHandover = useCallback(async (data: any, id: string) => {
    if (!user) return;
    setIsProcessing(true);
    try {
      await dataStore.updateHandoverReport(id, data, user);
      toast.success('Đã cập nhật báo cáo bàn giao.');
      setIsHandoverReportDialogOpen(false);
    } catch (error) {
      console.error('Failed to update handover report:', error);
      toast.error('Không thể cập nhật báo cáo bàn giao.');
    } finally {
      setIsProcessing(false);
    }
  }, [user]);

  const handleDeleteExpense = async (id: string) => {
    const slipToDelete = allData.expenseSlips.find(s => s.id === id);
    if (!slipToDelete) return;

    // Optimistic UI update
    setAllData(prev => ({
        ...prev,
        expenseSlips: prev.expenseSlips.filter(s => s.id !== id),
    }));

    try {
        await dataStore.deleteExpenseSlip(slipToDelete);
        toast.success("Đã xóa phiếu chi.");
    } catch(error) {
        toast.error("Lỗi: Không thể xóa phiếu chi. Đang hoàn tác.");
        // Revert UI on failure
        setAllData(prev => ({
            ...prev,
            expenseSlips: [...prev.expenseSlips, slipToDelete].sort((a,b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime()),
        }));
    }
  };

  const handleDeleteRevenue = async (id: string) => {
    if (!user) return;
    const statToDelete = allData.revenueStats.find(s => s.id === id);
    if(!statToDelete) return;

    setAllData(prev => ({
        ...prev,
        revenueStats: prev.revenueStats.filter(s => s.id !== id),
    }));

    try {
        await dataStore.deleteRevenueStats(id, user);
        toast.success("Đã xóa phiếu thống kê doanh thu.");
    } catch(error) {
        toast.error("Lỗi: Không thể xóa phiếu thống kê. Đang hoàn tác.");
        setAllData(prev => ({
            ...prev,
            revenueStats: [...prev.revenueStats, statToDelete].sort((a,b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime()),
        }));
    }
  };

  const handleDeleteIncident = async (id: string) => {
    const incidentToDelete = allData.incidents.find(i => i.id === id);
    if(!incidentToDelete) return;

    setAllData(prev => ({
        ...prev,
        incidents: prev.incidents.filter(i => i.id !== id),
    }));

    try {
        await dataStore.deleteIncident(incidentToDelete);
        toast.success("Đã xóa báo cáo sự cố.");
    } catch(error) {
        toast.error("Lỗi: Không thể xóa báo cáo sự cố. Đang hoàn tác.");
        setAllData(prev => ({
            ...prev,
            incidents: [...prev.incidents, incidentToDelete].sort((a,b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime()),
        }));
    }
  };
  
  const handleDeleteHandover = async (id: string) => {
    if (!user) return;
    const handoverToDelete = allData.handoverReports.find(h => h.id === id);
    if (!handoverToDelete) return;

    setAllData(prev => ({
        ...prev,
        handoverReports: prev.handoverReports.filter(h => h.id !== id),
    }));

    try {
      await dataStore.deleteHandoverReport(id);
      toast.success("Đã xóa báo cáo bàn giao.");
    } catch (error) {
      console.error("Failed to delete handover report:", error);
      toast.error("Không thể xóa báo cáo bàn giao. Đang hoàn tác.");
      setAllData(prev => ({
            ...prev,
            handoverReports: [...prev.handoverReports, handoverToDelete].sort((a,b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime()),
        }));
    }
  };


  const openPhotoLightbox = (photos: string[]) => {
    setLightboxSlides(photos.map(p => ({ src: p })));
    setLightboxOpen(true);
  };

  const ChangeIndicator = ({ value, isRevenue = true }: { value: number, isRevenue?: boolean }) => {
    if (isNaN(value) || !isFinite(value) || value === 0) return null;

    const isPositive = value > 0;
    const isNegative = value < 0;

    const colorClass = isPositive ? (isRevenue ? 'text-green-600' : 'text-red-600') : (isRevenue ? 'text-red-600' : 'text-green-600');

    return (
        <span className={cn(
            "text-xs font-semibold flex items-center gap-0.5",
            colorClass
        )}>
            {isPositive ? <TrendingUp className="h-3 w-3"/> : <TrendingDown className="h-3 w-3"/>}
            {Math.abs(value).toLocaleString('vi-VN')}đ
        </span>
    );
  };


  if (isLoading || authLoading || !user) {
    return (
      <div className="container mx-auto p-4 sm:p-6 md:p-8">
        <header className="mb-8"><Skeleton className="h-10 w-1/2" /></header>
        <Card><CardContent className="p-6"><Skeleton className="h-96 w-full" /></CardContent></Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="container mx-auto p-4 sm:p-6 md:p-8">
      <header className="mb-8">
        <Button asChild variant="ghost" className="-ml-4 mb-4">
          <Link href="/reports">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Quay lại
          </Link>
        </Button>
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
                 <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Banknote /> Báo cáo Thu ngân</h1>
                <p className="text-muted-foreground mt-2">
                Tổng hợp báo cáo doanh thu, phiếu chi và sự cố do thu ngân gửi.
                </p>
            </div>
             <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => handleMonthChange('prev')}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-lg font-medium w-32 text-center">{format(currentMonth, 'MM/yyyy')}</span>
                <Button variant="outline" size="icon" onClick={() => handleMonthChange('next')} disabled={isNextMonthButtonDisabled}><ChevronRight className="h-4 w-4" /></Button>
            </div>
             <Card>
                <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Settings className="h-4 w-4"/>
                        Cài đặt
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 flex flex-col gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsOtherCostCategoryDialogOpen(true)}>Quản lý Loại chi phí khác</Button>
                    <Button variant="outline" size="sm" onClick={() => setIsIncidentCategoryDialogOpen(true)}>Quản lý Loại sự cố</Button>
                </CardContent>
             </Card>
        </div>
      </header>

      {sortedDatesInMonth.length === 0 ? (
          <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                  Chưa có báo cáo nào trong tháng {format(currentMonth, 'MM/yyyy')}.
              </CardContent>
          </Card>
      ) : (
        <div className="space-y-6">
            <Card className="border-primary">
                <CardHeader><CardTitle>Tổng quan Tháng {format(currentMonth, 'MM/yyyy')}</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <h4 className="font-semibold text-lg text-green-600">Doanh thu: {monthlySummary.totalRevenue.toLocaleString('vi-VN')}đ</h4>
                        <div className="text-sm space-y-1">
                             <p className="font-medium">Theo phương thức thanh toán:</p>
                            {Object.entries(monthlySummary.revenueByMethod).map(([key, value]) => (
                                <p key={key} className="pl-4">{key}: <span className="font-medium">{value.toLocaleString('vi-VN')}đ</span></p>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h4 className="font-semibold text-lg text-red-600">Chi phí: {monthlySummary.totalExpense.toLocaleString('vi-VN')}đ</h4>
                        <div className="text-sm space-y-1">
                             <p className="font-medium">Theo Phương thức Thanh toán:</p>
                             <p className="pl-4">Tiền mặt: <span className="font-medium">{(monthlySummary.expenseByPaymentMethod['cash'] || 0).toLocaleString('vi-VN')}đ</span></p>
                             <div className="pl-4 flex items-center gap-2">
                                <span>Chuyển khoản: <span className="font-medium">{(monthlySummary.expenseByPaymentMethod['bank_transfer'] || 0).toLocaleString('vi-VN')}đ</span></span>
                                {monthlySummary.unpaidBankTransfer > 0 && (
                                    <div className='flex items-center gap-1'>
                                        <Badge variant="destructive">Chưa TT: {monthlySummary.unpaidBankTransfer.toLocaleString('vi-VN')}đ</Badge>
                                        <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setIsUnpaidSlipsDialogOpen(true)}>Xem chi tiết</Button>
                                    </div>
                                )}
                             </div>
                             {monthlySummary.intangibleCost > 0 && (
                                <div className="pl-4 flex items-center gap-2">
                                  <span>Chi phí vô hình: <span className="font-medium">{(monthlySummary.intangibleCost || 0).toLocaleString('vi-VN')}đ</span></span>
                                  <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setIsIntangibleCostDialogOpen(true)}>Xem chi tiết</Button>
                                </div>
                             )}
                        </div>
                        <Separator/>
                        <div className="text-sm space-y-1">
                            <p className="font-medium">Theo Loại chi phí:</p>
                            {Object.entries(monthlySummary.expenseByType).map(([key, value]) => (
                                 <p key={key} className="pl-4">{key}: <span className="font-medium">{value.toLocaleString('vi-VN')}đ</span></p>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Accordion type="multiple" defaultValue={sortedDatesInMonth.slice(0, 1)} className="space-y-4">
                {sortedDatesInMonth.map(date => {
                    const dayReports = reportsForCurrentMonth[date];
                    const latestRevenue = (dayReports.revenue || [])[0];
                    const totalDailyRevenue = latestRevenue?.netRevenue || 0;
                    const totalDailyExpense = (dayReports.expenses || []).reduce((sum, e) => sum + e.totalAmount, 0) + (dayReports.incidents || []).reduce((sum, i) => sum + i.cost, 0);

                    return (
                        <AccordionItem value={date} key={date} className="border rounded-xl shadow-md bg-white dark:bg-card">
                            <AccordionTrigger className="p-4 text-base font-semibold hover:no-underline rounded-t-xl">
                                <div className="w-full flex justify-between items-center gap-4">
                                    <div className="flex flex-col text-left">
                                        <div className="text-lg font-bold flex items-center gap-2">
                                            {dayReports.handover ? <ClipboardCheck className="h-5 w-5 text-green-500" /> : <ClipboardX className="h-5 w-5 text-destructive" />}
                                            {format(parseISO(date), 'eeee, dd/MM/yyyy', { locale: vi })}
                                        </div>
                                        <div className="text-sm text-muted-foreground font-normal flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                            <span>Thu: <span className="font-semibold text-green-600">{totalDailyRevenue.toLocaleString('vi-VN')}đ</span></span>
                                            <span>Chi: <span className="font-semibold text-red-600">{totalDailyExpense.toLocaleString('vi-VN')}đ</span></span>
                                            {(dayReports.incidents?.length || 0) > 0 && <span>Sự cố: <span className="font-semibold text-amber-600">{dayReports.incidents?.length}</span></span>}
                                        </div>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-4 bg-muted/20 rounded-b-xl">
                                <div className="space-y-6">
                                    {/* Revenue Section */}
                                    <Card className="border-green-500/50 rounded-lg shadow-sm">
                                        <CardHeader className="p-4 pb-2">
                                            <CardTitle className="text-base flex items-center gap-2 text-green-800 dark:text-green-300"><Receipt /> Doanh thu</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-4 pt-0 space-y-4">
                                            {(dayReports.revenue || []).map((stat, index) => {
                                                const prevStat = (dayReports.revenue || [])[index + 1];
                                                const difference = prevStat ? stat.netRevenue - prevStat.netRevenue : 0;
                                                return (
                                                    <div key={stat.id} className="border-t first:border-t-0 pt-3 first:pt-0">
                                                        <div className="flex justify-between items-start">
                                                            <p className="text-sm text-muted-foreground">Lúc {format(new Date(stat.createdAt as string), 'HH:mm')} bởi {stat.createdBy.userName}</p>
                                                            <div className="flex items-center gap-2">
                                                                {stat.isEdited && <Badge variant="secondary" className="text-xs">Đã sửa</Badge>}
                                                                {stat.isOutdated && <Badge variant="destructive" className="text-xs">Phiếu cũ</Badge>}
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-between items-center mt-1">
                                                            <div className="flex items-baseline gap-2">
                                                                <p className="text-xl font-bold text-green-700 dark:text-green-200">{stat.netRevenue.toLocaleString('vi-VN')}đ</p>
                                                                {difference !== 0 && <ChangeIndicator value={difference} />}
                                                            </div>
                                                            <div className="flex gap-1">
                                                                <Button variant="outline" size="sm" onClick={() => handleEditRevenue(stat)} className="h-8">Chi tiết</Button>
                                                                <AlertDialog>
                                                                    <AlertDialogTrigger asChild>
                                                                        <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" disabled={isProcessing}><Trash2 className="h-4 w-4" /></Button>
                                                                    </AlertDialogTrigger>
                                                                    <AlertDialogContent>
                                                                        <AlertDialogHeader>
                                                                            <AlertDialogTitle>Xóa phiếu thống kê?</AlertDialogTitle>
                                                                            <AlertDialogDescription>Hành động này sẽ xóa vĩnh viễn phiếu và không thể hoàn tác.</AlertDialogDescription>
                                                                        </AlertDialogHeader>
                                                                        <AlertDialogFooter>
                                                                            <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                                            <AlertDialogAction onClick={() => handleDeleteRevenue(stat.id)}>Xóa</AlertDialogAction>
                                                                        </AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {(dayReports.revenue || []).length === 0 && <p className="text-sm text-center text-muted-foreground py-2">Chưa có báo cáo.</p>}
                                        </CardContent>
                                    </Card>

                                    {/* Expenses Section */}
                                    <Card className="border-blue-500/50 rounded-lg shadow-sm">
                                        <CardHeader className="p-4 pb-2">
                                            <CardTitle className="text-base flex items-center gap-2 text-blue-800 dark:text-blue-300"><Wallet /> Phiếu chi</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-4 pt-0">
                                            {(dayReports.expenses || []).length > 0
                                                ? <ExpenseList expenses={dayReports.expenses!} onEdit={handleEditExpense} canDelete={true} onDelete={handleDeleteExpense} isProcessing={isProcessing} />
                                                : <p className="text-sm text-center text-muted-foreground py-2">Không có phiếu chi nào.</p>
                                            }
                                        </CardContent>
                                    </Card>
                                    
                                    {/* Incidents Section */}
                                    <Card className="border-amber-500/50 rounded-lg shadow-sm">
                                        <CardHeader className="p-4 pb-2"><CardTitle className="text-base flex items-center gap-2 text-amber-800 dark:text-amber-300"><AlertTriangle /> Sự cố</CardTitle></CardHeader>
                                        <CardContent className="p-4 pt-0 space-y-3">
                                            {(dayReports.incidents || []).length > 0 ? dayReports.incidents!.map(incident => (
                                                <div key={incident.id} className="border-t first:border-t-0 pt-3 first:pt-0">
                                                    <div className="flex justify-between items-start gap-2">
                                                        <div>
                                                            <p className="font-semibold">{incident.content}</p>
                                                        </div>
                                                        <p className="text-xl font-bold text-amber-600">{incident.cost.toLocaleString('vi-VN')}đ</p>
                                                    </div>
                                                    <div className="flex justify-end gap-1 mt-1">
                                                        {incident.photos && incident.photos.length > 0 && <Button variant="secondary" size="sm" onClick={() => openPhotoLightbox(incident.photos)} className="h-8">Xem ảnh</Button>}
                                                        <Button variant="outline" size="sm" onClick={() => handleEditIncident(incident)} className="h-8">Chi tiết</Button>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive h-8 w-8"><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader><AlertDialogTitle>Xóa sự cố?</AlertDialogTitle></AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleDeleteIncident(incident.id)}>Xóa</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                </div>
                                            )) : <p className="text-sm text-muted-foreground text-center py-2">Không có sự cố nào.</p>}
                                        </CardContent>
                                    </Card>

                                    {/* Handover Section */}
                                     {dayReports.handover && (
                                        <Card className="border-slate-500/50 rounded-lg shadow-sm">
                                            <CardHeader className="p-4 pb-2"><CardTitle className="text-base flex items-center gap-2 text-slate-800 dark:text-slate-300"><ClipboardCheck /> Bàn giao ca</CardTitle></CardHeader>
                                            <CardContent className="p-4 pt-0">
                                                <div className="flex justify-between items-center mt-1">
                                                    <p className="text-sm text-muted-foreground">Bàn giao bởi: <span className="font-semibold text-foreground">{dayReports.handover.createdBy.userName}</span></p>
                                                    <div className="flex gap-1">
                                                      <Button variant="outline" size="sm" onClick={() => handleEditHandover(dayReports.handover!)} className="h-8">Chi tiết</Button>
                                                      <AlertDialog>
                                                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive h-8 w-8"><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger>
                                                          <AlertDialogContent>
                                                              <AlertDialogHeader><AlertDialogTitle>Xóa Báo cáo Bàn giao?</AlertDialogTitle></AlertDialogHeader>
                                                              <AlertDialogFooter>
                                                                  <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                                  <AlertDialogAction onClick={() => handleDeleteHandover(dayReports.handover!.id)}>Xóa</AlertDialogAction>
                                                              </AlertDialogFooter>
                                                          </AlertDialogContent>
                                                      </AlertDialog>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    );
                })}
            </Accordion>
            </div>
          )}
    </div>
    {user && 
        <ExpenseSlipDialog
            open={isExpenseDialogOpen}
            onOpenChange={setIsExpenseDialogOpen}
            onSave={handleSaveSlip}
            isProcessing={isProcessing}
            slipToEdit={slipToEdit}
            inventoryList={allData.inventoryList}
            reporter={user}
            otherCostCategories={allData.otherCostCategories}
            isOwnerView={true}
        />
    }
    {user && 
        <RevenueStatsDialog
            open={isRevenueDialogOpen}
            onOpenChange={setIsRevenueDialogOpen}
            onSave={handleSaveRevenue}
            isProcessing={isProcessing}
            existingStats={revenueStatsToEdit}
            isOwnerView={true}
        />
    }
    {user && (
        <IncidentReportDialog
          open={isIncidentDialogOpen}
          onOpenChange={setIsIncidentDialogOpen}
          onSave={handleSaveIncident}
          isProcessing={isProcessing}
          violationToEdit={incidentToEdit as any}
          reporter={user}
          categories={allData.incidentCategories}
          onCategoriesChange={dataStore.updateIncidentCategories}
          canManageCategories={user.role === 'Chủ nhà hàng'}
        />
    )}
    {handoverToEdit && user && (
        <OwnerHandoverReportDialog
            open={isHandoverReportDialogOpen}
            onOpenChange={setIsHandoverReportDialogOpen}
            onSave={handleSaveHandover}
            isProcessing={isProcessing}
            reportToEdit={handoverToEdit}
            reporter={user}
        />
    )}
     <UnpaidSlipsDialog
        isOpen={isUnpaidSlipsDialogOpen}
        onClose={() => setIsUnpaidSlipsDialogOpen(false)}
        bankTransferSlips={monthlyBankTransferSlips}
        inventoryList={allData.inventoryList}
    />
    <OtherCostCategoryDialog
        open={isOtherCostCategoryDialogOpen}
        onOpenChange={setIsOtherCostCategoryDialogOpen}
    />
     <IncidentCategoryDialog
        open={isIncidentCategoryDialogOpen}
        onOpenChange={setIsIncidentCategoryDialogOpen}
    />
    
    <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIndex}
        slides={lightboxSlides}
        carousel={{ finite: true }}
    />
    </TooltipProvider>
  );
}
