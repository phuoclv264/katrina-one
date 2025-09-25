

'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { dataStore } from '@/lib/data-store';
import type { ExpenseSlip, IncidentReport, RevenueStats, InventoryItem, OtherCostCategory, AssignedUser, ExpenseItem, IncidentCategory, ManagedUser } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Banknote, Receipt, AlertTriangle, ArrowRight, DollarSign, Wallet, FileWarning, Calendar, LandPlot, Settings, Edit2, ChevronLeft, ChevronRight, Trash2, Eye, Edit, Loader2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, isSameMonth, parseISO, addMonths, subMonths } from 'date-fns';
import { vi } from 'date-fns/locale';
import OwnerCashierDialogs from './_components/owner-cashier-dialogs';
import { toast } from 'react-hot-toast';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import OtherCostCategoryDialog from './_components/other-cost-category-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import IncidentCategoryDialog from '../../cashier/_components/incident-category-dialog';
import IncidentReportDialog from '../../cashier/_components/incident-report-dialog';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";


type GroupedReports = {
  [date: string]: {
    revenue: RevenueStats[];
    expenses?: ExpenseSlip[];
    incidents?: IncidentReport[];
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
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile(containerRef);

  if (!isMobile) {
    return (
      <div ref={containerRef}>
        <Table>
            <TableHeader>
            <TableRow>
                <TableHead>Thời gian</TableHead>
                <TableHead>Nội dung</TableHead>
                <TableHead>Tổng tiền / Thực trả</TableHead>
                <TableHead>Phương thức</TableHead>
                <TableHead>Người lập</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
            {expenses.map(expense => (
                <TableRow key={expense.id}>
                <TableCell className="text-sm text-muted-foreground">{format(new Date(expense.createdAt as string), 'HH:mm')}</TableCell>
                <TableCell>
                    {getSlipContentName(expense.items[0])}{expense.items.length > 1 && ` và ${expense.items.length - 1} mục khác`}
                    {expense.lastModifiedBy && <Badge variant="outline" className="ml-2 text-xs">Đã sửa</Badge>}
                     {expense.associatedHandoverReportId && <Badge variant="secondary" className="ml-2 text-xs">Tự động</Badge>}
                </TableCell>
                <TableCell>
                    <div className='flex flex-col items-start'>
                        <span>{expense.totalAmount.toLocaleString('vi-VN')}đ</span>
                        {(expense.paymentMethod === 'cash' && typeof expense.actualPaidAmount === 'number' && expense.actualPaidAmount !== expense.totalAmount) && (
                                <span className='text-xs text-red-600'>({(expense.actualPaidAmount).toLocaleString('vi-VN')}đ)</span>
                        )}
                    </div>
                </TableCell>
                <TableCell className="text-sm">
                    <Badge variant={expense.paymentMethod === 'cash' ? 'secondary' : 'outline'}>
                        {expense.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                    </Badge>
                </TableCell>
                 <TableCell>{expense.createdBy.userName}</TableCell>
                <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => onEdit(expense)}>Chi tiết</Button>
                    {canDelete && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive h-9 w-9" disabled={isProcessing}>
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
                </TableCell>
                </TableRow>
            ))}
            </TableBody>
        </Table>
      </div>
    );
  }

  // Mobile View
  return (
    <div className="space-y-3" ref={containerRef}>
      {expenses.map((expense, index) => {
        const actualAmount = expense.paymentMethod === 'cash' ? expense.actualPaidAmount ?? expense.totalAmount : expense.totalAmount;
        return(
        <React.Fragment key={expense.id}>
          <div className="p-3">
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-medium text-sm pr-2">
                        {getSlipContentName(expense.items[0])}{expense.items.length > 1 && ` và ${expense.items.length - 1} mục khác`}
                        {expense.associatedHandoverReportId && <Badge variant="secondary" className="ml-2 text-xs">Tự động</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">bởi {expense.createdBy.userName}</p>
                </div>
                <div className="text-right">
                    <p className="font-bold text-base">{expense.totalAmount.toLocaleString('vi-VN')}đ</p>
                    {(expense.paymentMethod === 'cash' && typeof expense.actualPaidAmount === 'number' && expense.actualPaidAmount !== expense.totalAmount) && (
                        <p className='text-xs text-red-600'>({(expense.actualPaidAmount).toLocaleString('vi-VN')}đ)</p>
                    )}
                </div>
            </div>
            <div className="flex justify-between items-center mt-2 text-xs">
                <div className="flex items-center gap-2">
                    <Badge variant={expense.paymentMethod === 'cash' ? 'secondary' : 'outline'} className="text-xs">
                        {expense.paymentMethod === 'cash' ? <Wallet className="mr-1 h-3 w-3"/> : <LandPlot className="mr-1 h-3 w-3"/>}
                        {expense.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                    </Badge>
                    <span className="text-muted-foreground">{format(new Date(expense.createdAt as string), 'HH:mm')}</span>
                </div>
                 <div className="flex items-center">
                    <Button variant="link" size="sm" onClick={() => onEdit(expense)} className="h-auto p-0">
                        Xem chi tiết
                    </Button>
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
          </div>
          {index < expenses.length - 1 && <Separator />}
        </React.Fragment>
        )}
      )}
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
  }>({ revenueStats: [], expenseSlips: [], incidents: [], inventoryList: [], otherCostCategories: [], incidentCategories: [], users: [] });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Dialog states
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isRevenueDialogOpen, setIsRevenueDialogOpen] = useState(false);
  const [isIncidentDialogOpen, setIsIncidentDialogOpen] = useState(false);
  const [isOtherCostCategoryDialogOpen, setIsOtherCostCategoryDialogOpen] = useState(false);
  const [isIncidentCategoryDialogOpen, setIsIncidentCategoryDialogOpen] = useState(false);
  
  // States for editing
  const [slipToEdit, setSlipToEdit] = useState<ExpenseSlip | null>(null);
  const [revenueStatsToEdit, setRevenueStatsToEdit] = useState<RevenueStats | null>(null);
  const [incidentToEdit, setIncidentToEdit] = useState<IncidentReport | null>(null);
  
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
    const unsubOtherCostCategories = dataStore.subscribeToOtherCostCategories(categories => {
        setAllData(prev => ({...prev, otherCostCategories: categories}));
    });
     const unsubIncidentCategories = dataStore.subscribeToIncidentCategories(categories => {
        setAllData(prev => ({...prev, incidentCategories: categories}));
    });
    const unsubUsers = dataStore.subscribeToUsers(users => setAllData(prev => ({...prev, users: users})));
    
    const timer = setTimeout(() => setIsLoading(false), 1500);

    return () => {
      unsubExpense();
      unsubIncidents();
      unsubRevenue();
      unsubInventory();
      unsubOtherCostCategories();
      unsubIncidentCategories();
      unsubUsers();
      clearTimeout(timer);
    };
  }, [user]);

  const allMonthsWithData = useMemo(() => {
    const monthSet = new Set<string>();
    const combined = [...allData.revenueStats, ...allData.expenseSlips, ...allData.incidents];
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

    const filterAndGroup = (items: (RevenueStats | ExpenseSlip | IncidentReport)[]) => {
      items.forEach(item => {
        const itemDate = parseISO(item.date);
        if (isSameMonth(itemDate, currentMonth)) {
          if (!reports[item.date]) {
            reports[item.date] = { revenue: [] }; // Initialize revenue as an array
          }
          if ('netRevenue' in item) {
            reports[item.date].revenue.push(item);
          } else if ('items' in item) {
            if (!reports[item.date].expenses) reports[item.date].expenses = [];
            reports[item.date].expenses!.push(item);
          } else if ('content' in item) {
            if (!reports[item.date].incidents) reports[item.date].incidents = [];
            reports[item.date].incidents!.push(item);
          }
        }
      });
    };

    filterAndGroup(allData.revenueStats);
    filterAndGroup(allData.expenseSlips);
    filterAndGroup(allData.incidents);

    // Sort entries within each day
    for (const date in reports) {
      // Sort revenue reports by time (newest first)
      reports[date].revenue?.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
      reports[date].expenses?.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
      reports[date].incidents?.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
    }

    return reports;
  }, [currentMonth, allData]);

  const sortedDatesInMonth = useMemo(() => Object.keys(reportsForCurrentMonth).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()), [reportsForCurrentMonth]);

  const monthlySummary = useMemo(() => {
      const reportsInMonth = Object.values(reportsForCurrentMonth).flat();
      const allExpenses = reportsInMonth.flatMap(day => day.expenses || []);
      const allRevenueStats = reportsInMonth.flatMap(day => day.revenue || []);

      // Use the latest stat of each day for summary
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

      const expenseByType = allExpenses.reduce((acc, slip) => {
          const type = slip.expenseType === 'goods_import' ? 'Nhập hàng' : (getSlipContentName(slip.items[0]) || 'Khác');
          acc[type] = (acc[type] || 0) + slip.totalAmount;
          return acc;
      }, {} as {[key: string]: number});
      
      return { totalRevenue, totalExpense, revenueByMethod, expenseByType, expenseByPaymentMethod };
  }, [reportsForCurrentMonth]);


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

  const handleSaveSlip = useCallback(async (data: any, id?: string) => {
    if (!user) return;
    setIsProcessing(true);
    try {
        const slipData = { 
            ...data, 
            createdBy: slipToEdit?.createdBy || { userId: user.uid, userName: user.displayName },
            lastModifiedBy: slipToEdit ? { userId: user.uid, userName: user.displayName } : undefined
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

  const handleDeleteExpense = async (id: string) => {
      const slip = allData.expenseSlips.find(s => s.id === id);
      if(!slip) return;
      setIsProcessing(true);
      try {
          await dataStore.deleteExpenseSlip(slip);
          toast.success("Đã xóa phiếu chi.");
      } catch(error) {
          toast.error("Lỗi: Không thể xóa phiếu chi.");
      } finally {
          setIsProcessing(false);
      }
  }

  const handleDeleteRevenue = async (id: string) => {
      if (!user) return;
      setIsProcessing(true);
      try {
          await dataStore.deleteRevenueStats(id, user);
          toast.success("Đã xóa phiếu thống kê doanh thu.");
      } catch(error) {
          toast.error("Lỗi: Không thể xóa phiếu thống kê.");
      } finally {
          setIsProcessing(false);
      }
  }

  const handleDeleteIncident = async (id: string) => {
      const incident = allData.incidents.find(i => i.id === id);
      if(!incident) return;
      setIsProcessing(true);
      try {
          await dataStore.deleteIncident(id);
          toast.success("Đã xóa báo cáo sự cố.");
      } catch(error) {
          toast.error("Lỗi: Không thể xóa báo cáo sự cố.");
      } finally {
          setIsProcessing(false);
      }
  }
  
  const openPhotoLightbox = (photos: string[]) => {
    setLightboxSlides(photos.map(p => ({ src: p })));
    setLightboxOpen(true);
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
                             <p className="pl-4">Chuyển khoản: <span className="font-medium">{(monthlySummary.expenseByPaymentMethod['bank_transfer'] || 0).toLocaleString('vi-VN')}đ</span></p>
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

            <Accordion type="multiple" defaultValue={sortedDatesInMonth.slice(0,1)}>
            {sortedDatesInMonth.map(date => {
                const dayReports = reportsForCurrentMonth[date];
                const revenueReports = (dayReports.revenue || []).sort((a,b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());

                return (
                    <AccordionItem value={date} key={date} className="bg-card border rounded-lg shadow-sm">
                        <AccordionTrigger className="p-4 text-base font-semibold">
                            Ngày {format(parseISO(date), 'dd/MM/yyyy, eeee', { locale: vi })}
                        </AccordionTrigger>
                        <AccordionContent className="p-4 border-t grid grid-cols-1 gap-6">
                            <Card className="bg-green-500/10 border-green-500/30">
                                <CardHeader className="p-4 pb-2">
                                    <CardTitle className="text-base flex items-center gap-2 text-green-800 dark:text-green-300">
                                        <Receipt /> Doanh thu
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-0 space-y-4">
                                {revenueReports.length > 0 ? (
                                    revenueReports.map((stat, index) => {
                                        const prevStat = index < revenueReports.length - 1 ? revenueReports[index + 1] : null;
                                        const netRevenueDiff = prevStat ? stat.netRevenue - prevStat.netRevenue : stat.netRevenue;
                                        
                                        const netRevenueDisplay = prevStat 
                                            ? `${netRevenueDiff >= 0 ? '+' : ''}${netRevenueDiff.toLocaleString('vi-VN')}đ` 
                                            : `${stat.netRevenue.toLocaleString('vi-VN')}đ`;

                                        return (
                                        <div key={stat.id} className="border-t first:border-t-0 pt-3 first:pt-0">
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
                                            <CardDescription className="text-green-700 dark:text-green-400/80 mb-2 sm:mb-0">
                                                Lúc {format(new Date(stat.createdAt as string), 'HH:mm')} bởi {stat.createdBy.userName}
                                            </CardDescription>
                                            <div className="flex items-center gap-2">
                                                {stat.isEdited && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild><Edit2 className="h-4 w-4 text-orange-500" /></TooltipTrigger>
                                                    <TooltipContent><p>Thu ngân đã chỉnh sửa thủ công</p></TooltipContent>
                                                </Tooltip>
                                                )}
                                                {stat.isOutdated && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild><AlertTriangle className="h-4 w-4 text-yellow-500" /></TooltipTrigger>
                                                    <TooltipContent><p>Phiếu doanh thu có thể đã cũ</p></TooltipContent>
                                                </Tooltip>
                                                )}
                                                <Button size="sm" onClick={() => handleEditRevenue(stat)}>
                                                Chi tiết <ArrowRight className="ml-2 h-4 w-4" />
                                                </Button>
                                                <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="text-destructive h-9 w-9" disabled={isProcessing}>
                                                    <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                    <AlertDialogTitle>Xóa phiếu thống kê?</AlertDialogTitle>
                                                    <AlertDialogDescription>Hành động này sẽ xóa phiếu doanh thu và cập nhật lại phiếu chi ĐTGH tương ứng.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                    <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteRevenue(stat.id)}>Xóa</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                            <span className="text-2xl font-bold text-green-700 dark:text-green-200">{stat.netRevenue.toLocaleString('vi-VN')}đ</span>
                                            {prevStat && (
                                                <Badge className={cn(netRevenueDiff > 0 ? "bg-green-600" : (netRevenueDiff < 0 ? "bg-red-600" : "bg-gray-500"), "text-white")}>
                                                    {netRevenueDisplay}
                                                </Badge>
                                            )}
                                            </div>
                                        </div>
                                        )
                                    })
                                ) : <p className="text-sm text-muted-foreground text-center py-2">Chưa có báo cáo doanh thu.</p>}
                                </CardContent>
                            </Card>
                            
                            {dayReports.expenses && dayReports.expenses.length > 0 ? (
                                <Card>
                                    <CardHeader className="p-4"><CardTitle className="text-base">Phiếu chi</CardTitle></CardHeader>
                                    <CardContent className="p-0"><ExpenseList expenses={dayReports.expenses} onEdit={handleEditExpense} canDelete={true} onDelete={handleDeleteExpense} isProcessing={isProcessing} /></CardContent>
                                </Card>
                            ) : <p className="text-sm text-muted-foreground text-center py-2">Không có phiếu chi.</p>}
                            
                             {dayReports.incidents && dayReports.incidents.length > 0 && (
                                <Card>
                                    <CardHeader className="p-4 pb-2"><CardTitle className="text-base text-amber-600">Sự cố</CardTitle></CardHeader>
                                    <CardContent className="p-4 pt-0 space-y-3">
                                        {dayReports.incidents.map(incident => (
                                            <div key={incident.id} className="text-sm flex flex-col sm:flex-row justify-between items-start gap-2 pt-3 border-t first:border-t-0 first:pt-0">
                                                <div>
                                                    <p className="font-semibold">{incident.content} (<span className="font-normal text-red-600">{incident.cost.toLocaleString('vi-VN')}đ</span>)</p>
                                                    <p className="text-xs text-muted-foreground">bởi {incident.createdBy.userName} | {incident.category}</p>
                                                </div>
                                                 <div className="flex items-center gap-1 self-end sm:self-start flex-shrink-0">
                                                    {incident.photos && incident.photos.length > 0 && (
                                                        <Button variant="secondary" size="sm" onClick={() => openPhotoLightbox(incident.photos)}>
                                                            <Eye className="mr-2 h-4 w-4"/> Xem ảnh
                                                        </Button>
                                                    )}
                                                    <Button variant="outline" size="sm" onClick={() => handleEditIncident(incident)}>
                                                        <Edit className="mr-2 h-4 w-4"/> Sửa
                                                    </Button>
                                                     <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="text-destructive h-9 w-9" disabled={isProcessing}><Trash2 className="h-4 w-4" /></Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Xóa báo cáo sự cố?</AlertDialogTitle>
                                                                <AlertDialogDescription>Hành động này sẽ xóa vĩnh viễn báo cáo sự cố và phiếu chi liên quan (nếu có).</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteIncident(incident.id)}>Xóa</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                 </div>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            )}
                        </AccordionContent>
                    </AccordionItem>
                );
            })}
            </Accordion>
        </div>
      )}
    </div>
    {user && 
        <OwnerCashierDialogs
            inventoryList={allData.inventoryList}
            isExpenseDialogOpen={isExpenseDialogOpen}
            setIsExpenseDialogOpen={setIsExpenseDialogOpen}
            handleSaveSlip={handleSaveSlip}
            isProcessing={isProcessing}
            slipToEdit={slipToEdit}
            isRevenueDialogOpen={isRevenueDialogOpen}
            setIsRevenueDialogOpen={setIsRevenueDialogOpen}
            handleSaveRevenue={handleSaveRevenue}
            revenueStatsToEdit={revenueStatsToEdit}
            otherCostCategories={allData.otherCostCategories}
        />
    }
    {user && (
        <IncidentReportDialog
          open={isIncidentDialogOpen}
          onOpenChange={setIsIncidentDialogOpen}
          onSave={handleSaveIncident}
          users={allData.users}
          isProcessing={isProcessing}
          violationToEdit={incidentToEdit}
          reporter={user}
          categories={allData.incidentCategories}
          onCategoriesChange={dataStore.updateIncidentCategories}
          canManageCategories={true}
        />
    )}
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
