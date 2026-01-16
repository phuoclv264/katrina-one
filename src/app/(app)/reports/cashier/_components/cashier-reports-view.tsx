'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'nextjs-toploader/app';
import { useSearchParams } from 'next/navigation';
import { getQueryParamWithMobileHashFallback } from '@/lib/url-params';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import { useAuth } from '@/hooks/use-auth';
import { dataStore } from '@/lib/data-store';
import type { ExpenseSlip, IncidentReport, RevenueStats, InventoryItem, OtherCostCategory, IncidentCategory, ManagedUser, CashHandoverReport } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion } from '@/components/ui/accordion';
import { ArrowLeft, Banknote, Settings, ChevronLeft, ChevronRight, PlusCircle, Calendar as CalendarIcon, FilePlus, ChevronsUpDown } from 'lucide-react';
import { format, isSameMonth, parseISO, addMonths, subMonths, eachDayOfInterval, startOfMonth, endOfMonth, isBefore } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from '@/components/ui/pro-toast';

import UnpaidSlipsDialog from './unpaid-slips-dialog';
import OwnerCashierDialogs from './owner-cashier-dialogs';
import IncidentCategoryDialog from '../../../cashier/_components/incident-category-dialog';
import OtherCostCategoryDialog from '../../../cashier/_components/other-cost-category-dialog';
import MonthlySummary from './MonthlySummary';
import DailyReportAccordionItem from './DailyReportAccordionItem';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useLightbox } from '@/contexts/lightbox-context';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { useIsMobile } from '@/hooks/use-mobile';


function AddDocumentDialog({
  isOpen,
  onOpenChange,
  onConfirm,
  parentDialogTag
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (date: Date, action: 'revenue' | 'expense' | 'incident' | 'handover') => void;
  parentDialogTag: string;
}) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [action, setAction] = useState<'revenue' | 'expense' | 'incident' | 'handover'>('revenue');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const handleConfirm = () => {
    if (date) {
      onConfirm(date, action);
      // Keep the AddDocumentDialog open so the child dialog opens with
      // parentDialogTag="add-document-dialog" (caller will set activeParentDialogTag).
      // Do NOT close here.
    } else {
      toast.error("Vui lòng chọn một ngày.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange} dialogTag="add-document-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="bg-white dark:bg-card">
        <DialogHeader>
          <DialogTitle>Bổ sung chứng từ</DialogTitle>
          <DialogDescription>Chọn ngày và loại chứng từ bạn muốn thêm vào hệ thống.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 py-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ngày chứng từ</Label>
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal h-11",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP", { locale: vi }) : <span>Chọn ngày</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(selectedDate) => {
                    setDate(selectedDate);
                    setIsCalendarOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Loại chứng từ</Label>
            <RadioGroup value={action} onValueChange={(value) => setAction(value as any)} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Label htmlFor="action-revenue" className="flex items-center justify-between rounded-lg border p-3 cursor-pointer [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5 transition-colors">
                <span className="font-medium text-sm">Doanh thu</span>
                <RadioGroupItem value="revenue" id="action-revenue" />
              </Label>
              <Label htmlFor="action-expense" className="flex items-center justify-between rounded-lg border p-3 cursor-pointer [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5 transition-colors">
                <span className="font-medium text-sm">Phiếu chi</span>
                <RadioGroupItem value="expense" id="action-expense" />
              </Label>
              <Label htmlFor="action-incident" className="flex items-center justify-between rounded-lg border p-3 cursor-pointer [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5 transition-colors">
                <span className="font-medium text-sm">Sự cố</span>
                <RadioGroupItem value="incident" id="action-incident" />
              </Label>
              <Label htmlFor="action-handover" className="flex items-center justify-between rounded-lg border p-3 cursor-pointer [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5 transition-colors">
                <span className="font-medium text-sm">Bàn giao</span>
                <RadioGroupItem value="handover" id="action-handover" />
              </Label>
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={handleConfirm} disabled={!date}>Xác nhận</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CashierReportsViewProps {
  isStandalone?: boolean;
}

export default function CashierReportsView({ isStandalone = true }: CashierReportsViewProps) {
  const { openLightbox } = useLightbox();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const routerRef = useRef(router);
  const searchParams = useSearchParams();
  const isInitialLoad = useRef(true);
  const isMobile = useIsMobile();

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const handleDataRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const [revenueStats, setRevenueStats] = useState<RevenueStats[]>([]);
  const [expenseSlips, setExpenseSlips] = useState<ExpenseSlip[]>([]);
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [otherCostCategories, setOtherCostCategories] = useState<OtherCostCategory[]>([]);
  const [incidentCategories, setIncidentCategories] = useState<IncidentCategory[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [cashHandoverReports, setCashHandoverReports] = useState<CashHandoverReport[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [processingItemId, setProcessingItemId] = useState<string | null>(null);

  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isRevenueDialogOpen, setIsRevenueDialogOpen] = useState(false);
  const [isIncidentDialogOpen, setIsIncidentDialogOpen] = useState(false);
  const [isOtherCostCategoryDialogOpen, setIsOtherCostCategoryDialogOpen] = useState(false);
  const [isIncidentCategoryDialogOpen, setIsIncidentCategoryDialogOpen] = useState(false);
  const [isFinalHandoverViewOpen, setIsFinalHandoverViewOpen] = useState(false);
  const [isUnpaidSlipsDialogOpen, setIsUnpaidSlipsDialogOpen] = useState(false);
  const [isCashHandoverDialogOpen, setIsCashHandoverDialogOpen] = useState(false);
  const [isAddDocumentDialogOpen, setIsAddDocumentDialogOpen] = useState(false);

  // Track which dialog should be treated as the parent when opening child dialogs.
  // This allows opening dialogs either from the root page or from within the AddDocumentDialog.
  const [activeParentDialogTag, setActiveParentDialogTag] = useState<string>('root');

  const [slipToEdit, setSlipToEdit] = useState<ExpenseSlip | null>(null);
  const [revenueStatsToEdit, setRevenueStatsToEdit] = useState<RevenueStats | null>(null);
  const [cashHandoverToEdit, setCashHandoverToEdit] = useState<CashHandoverReport | null>(null);
  const [incidentToEdit, setIncidentToEdit] = useState<IncidentReport | null>(null);
  const [dateForNewEntry, setDateForNewEntry] = useState<string | null>(null);

  const itemRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  const [currentMonth, setCurrentMonth] = useState(new Date());

  const sortedDatesInMonth = useMemo(() => {
    const today = new Date();
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const effectiveEndDate = isSameMonth(currentMonth, today) && isBefore(today, monthEnd) ? today : monthEnd;

    const allDays = eachDayOfInterval({ start: monthStart, end: effectiveEndDate });

    return allDays.map(day => format(day, 'yyyy-MM-dd')).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [currentMonth]);

  const [openDays, setOpenDays] = useState<string[]>([]);

  const reportsByDay = useMemo(() => {
    const reports: { [date: string]: { revenue: RevenueStats[], expenses: ExpenseSlip[], incidents: IncidentReport[], cashHandovers: CashHandoverReport[] } } = {};
    const processItems = (items: (RevenueStats | ExpenseSlip | IncidentReport | CashHandoverReport)[]) => {
      items.forEach(item => {
        if (isSameMonth(parseISO(item.date), currentMonth)) {
          reports[item.date] = reports[item.date] || { revenue: [], expenses: [], incidents: [], cashHandovers: [] };
          if ('netRevenue' in item) reports[item.date].revenue.push(item);
          else if ('expenseType' in item) reports[item.date].expenses.push(item);
          else if ('content' in item) reports[item.date].incidents.push(item);
          else if ('actualCashCounted' in item) reports[item.date].cashHandovers.push(item as CashHandoverReport);
        }
      });
    };
    processItems([...revenueStats, ...expenseSlips, ...incidents, ...cashHandoverReports]);
    for (const date in reports) {
      reports[date].revenue?.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
      reports[date].expenses?.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
      reports[date].incidents?.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
      reports[date].cashHandovers?.sort((a, b) => {
        const timeA = (a.createdAt as any)?.toMillis?.() || 0;
        const timeB = (b.createdAt as any)?.toMillis?.() || 0;
        return timeB - timeA;
      });
    }
    return reports;
  }, [currentMonth, revenueStats, expenseSlips, incidents, cashHandoverReports]);

  // State for CashHandoverDialog
  const [linkedRevenueForDialog, setLinkedRevenueForDialog] = useState<RevenueStats | null>(null);
  const [linkedExpensesForDialog, setLinkedExpensesForDialog] = useState<ExpenseSlip[]>([]);
  const [expectedCashForDialog, setExpectedCashForDialog] = useState(0);

  const [finalHandoverToView, setFinalHandoverToView] = useState<CashHandoverReport | null>(null);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    if (isCashHandoverDialogOpen) {
      const relevantDate = dateForNewEntry || cashHandoverToEdit?.date;

      if (cashHandoverToEdit) {
        // Case 1: Editing an existing report.
        // Reconstruct the historical state from the report's linked data.
        const revenue = revenueStats.find(stat => stat.id === cashHandoverToEdit.linkedRevenueStatsId) || null;
        const expenses = expenseSlips.filter(slip => cashHandoverToEdit.linkedExpenseSlipIds?.includes(slip.id));

        setLinkedRevenueForDialog(revenue);
        setLinkedExpensesForDialog(expenses);

        const historicalCashRevenue = revenue?.revenueByPaymentMethod.cash || 0;
        const historicalTotalCashExpense = expenses
          .filter(slip => slip.paymentMethod === 'cash')
          .reduce((sum, slip) => sum + (slip.actualPaidAmount ?? slip.totalAmount), 0);
        const historicalStartOfDayCash = cashHandoverToEdit.startOfDayCash;

        const historicalExpectedCash = historicalCashRevenue - historicalTotalCashExpense + historicalStartOfDayCash;
        setExpectedCashForDialog(historicalExpectedCash);
      } else if (relevantDate) {
        // Case 2: Creating a new report for a specific (past) date.
        // Find the latest revenue and all expenses for that date.
        const reportsForDate = reportsByDay[relevantDate] || { revenue: [], expenses: [], incidents: [], cashHandovers: [] };
        const latestRevenue = reportsForDate.revenue[0] || null;
        const expensesForDate = reportsForDate.expenses;

        setLinkedRevenueForDialog(latestRevenue);
        setLinkedExpensesForDialog(expensesForDate);

        const cashRevenue = latestRevenue?.revenueByPaymentMethod.cash || 0;
        const totalCashExpense = expensesForDate
          .filter(slip => slip.paymentMethod === 'cash')
          .reduce((sum, slip) => sum + (slip.actualPaidAmount ?? slip.totalAmount), 0);

        setExpectedCashForDialog(cashRevenue - totalCashExpense + 1_500_000); // Assume default start of day cash
      }
    }
  }, [isCashHandoverDialogOpen, cashHandoverToEdit, dateForNewEntry, revenueStats, expenseSlips, reportsByDay]);


  useEffect(() => {
    if (!authLoading && user?.role !== 'Chủ nhà hàng' && user?.role !== 'Quản lý' && user?.role !== 'Thu ngân') {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    const subscriptions = [
      dataStore.subscribeToAllExpenseSlips(setExpenseSlips),
      dataStore.subscribeToAllIncidents(setIncidents),
      dataStore.subscribeToAllRevenueStats(setRevenueStats),
      dataStore.subscribeToInventoryList(setInventoryList),
      dataStore.subscribeToOtherCostCategories(setOtherCostCategories),
      dataStore.subscribeToIncidentCategories(setIncidentCategories),
      dataStore.subscribeToUsers(setUsers),
      dataStore.subscribeToAllCashHandoverReports(setCashHandoverReports),
    ];
    return () => {
      subscriptions.forEach(unsub => unsub());
    };
  }, [user, refreshTrigger]);

  useDataRefresher(handleDataRefresh);

  useEffect(() => {
    if (isLoading && (revenueStats.length > 0 || expenseSlips.length > 0 || incidents.length > 0 || inventoryList.length > 0 || otherCostCategories.length > 0 || incidentCategories.length > 0 || users.length > 0 || cashHandoverReports.length > 0)) {
      setIsLoading(false);
    }
  }, [revenueStats, expenseSlips, incidents, inventoryList, otherCostCategories, incidentCategories, users, cashHandoverReports]);

  const allMonthsWithData = useMemo(() => {
    const monthSet = new Set<string>();
    [...revenueStats, ...expenseSlips, ...incidents, ...cashHandoverReports].forEach(item => {
      monthSet.add(format(parseISO(item.date), 'yyyy-MM'));
    });
    return Array.from(monthSet).sort().reverse();
  }, [revenueStats, expenseSlips, incidents, cashHandoverReports]);

  useEffect(() => {
    const highlightId = getQueryParamWithMobileHashFallback({
      param: 'highlight',
      searchParams,
      hash: typeof window !== 'undefined' ? window.location.hash : '',
    });
    if (!highlightId || sortedDatesInMonth.length === 0 || processingItemId) return;
    const [type, id] = highlightId.split('-');
    let itemDate: string | undefined;

    if (type === 'expense') itemDate = expenseSlips.find(s => s.id === id)?.date;
    else if (type === 'revenue') itemDate = revenueStats.find(s => s.id === id)?.date;
    else if (type === 'incident') itemDate = incidents.find(i => i.id === id)?.date;
    else if (type === 'handover') itemDate = cashHandoverReports.find(h => h.id === id)?.date;

    if (!itemDate) return;

    if (!openDays.includes(itemDate)) {
      setOpenDays(prev => [...prev, itemDate]);
    }

    const tryScroll = () => {
      const el = itemRefs.current.get(highlightId);
      if (!el) return false;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-animation');
      setTimeout(() => {
        el.classList.remove('highlight-animation');
      }, 2500);
      if (!isMobile)
        routerRef.current.replace('/reports/cashier', { scroll: false });
      return true;
    };

    if (tryScroll()) return;

    let attempts = 0;
    const maxAttempts = 20;
    const interval = setInterval(() => {
      attempts += 1;
      if (tryScroll() || attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 100);
  }, [searchParams, sortedDatesInMonth, processingItemId, openDays, expenseSlips, revenueStats, incidents, cashHandoverReports]);

  useEffect(() => {
    if (allMonthsWithData.length > 0 && isInitialLoad.current) {
      setCurrentMonth(parseISO(`${allMonthsWithData[0]}-01`));
      isInitialLoad.current = false;
    }
  }, [allMonthsWithData]);

  useEffect(() => {
    if (sortedDatesInMonth.length > 0) {
      setOpenDays(sortedDatesInMonth.slice(0, 1));
    } else {
      setOpenDays([]);
    }
  }, [sortedDatesInMonth]);

  useEffect(() => {
    if (!isAddDocumentDialogOpen) setActiveParentDialogTag('root');
    else setActiveParentDialogTag('add-document-dialog');
  }, [isAddDocumentDialogOpen]);

  const monthlyRevenueStats = useMemo(() => revenueStats.filter(stat => isSameMonth(parseISO(stat.date), currentMonth)), [revenueStats, currentMonth]);
  const monthlyExpenseSlips = useMemo(() => expenseSlips.filter(slip => isSameMonth(parseISO(slip.date), currentMonth)), [expenseSlips, currentMonth]);
  const monthlyIncidents = useMemo(() => incidents.filter(i => isSameMonth(parseISO(i.date), currentMonth)), [incidents, currentMonth]);

  const handleToggleAllAccordions = () => {
    if (openDays.length === sortedDatesInMonth.length) {
      // If all are open, close all
      setOpenDays([]);
    } else {
      // Otherwise, open all
      setOpenDays(sortedDatesInMonth);
    }
  };

  const handleMonthChange = (direction: 'prev' | 'next') => setCurrentMonth(prev => direction === 'next' ? addMonths(prev, 1) : subMonths(prev, 1));
  const isNextMonthButtonDisabled = useMemo(() => allMonthsWithData.length > 0 && format(currentMonth, 'yyyy-MM') === allMonthsWithData[0], [currentMonth, allMonthsWithData]);

  const handleEditExpense = useCallback((slip: ExpenseSlip) => { setDateForNewEntry(null); setSlipToEdit(slip); setIsExpenseDialogOpen(true); }, []);
  const handleEditRevenue = useCallback((stats: RevenueStats) => { setDateForNewEntry(null); setRevenueStatsToEdit(stats); setIsRevenueDialogOpen(true); }, []);
  const handleEditIncident = useCallback((incident: IncidentReport) => { setDateForNewEntry(null); setIncidentToEdit(incident); setIsIncidentDialogOpen(true); }, []);
  const handleEditCashHandover = useCallback((handover: CashHandoverReport) => { setDateForNewEntry(null); setCashHandoverToEdit(handover); setIsCashHandoverDialogOpen(true); }, []);

  // Ensure top-level opens use root as parent
  const handleEditExpenseWithRoot = useCallback((slip: ExpenseSlip) => { setActiveParentDialogTag('root'); handleEditExpense(slip); }, [handleEditExpense]);
  const handleEditRevenueWithRoot = useCallback((stats: RevenueStats) => { setActiveParentDialogTag('root'); handleEditRevenue(stats); }, [handleEditRevenue]);
  const handleEditIncidentWithRoot = useCallback((incident: IncidentReport) => { setActiveParentDialogTag('root'); handleEditIncident(incident); }, [handleEditIncident]);
  const handleEditCashHandoverWithRoot = useCallback((handover: CashHandoverReport) => { setActiveParentDialogTag('root'); handleEditCashHandover(handover); }, [handleEditCashHandover]);

  const handleViewFinalHandover = useCallback((handover: CashHandoverReport) => {
    setFinalHandoverToView(handover);
    setIsFinalHandoverViewOpen(true);
  }, []);

  const handleAddDocumentConfirm = (date: Date, action: 'revenue' | 'expense' | 'incident' | 'handover') => {
    setDateForNewEntry(format(date, 'yyyy-MM-dd'));
    switch (action) {
      case 'revenue':
        // When opened via the Add Document dialog, set parent tag accordingly so nested dialogs use it
        setActiveParentDialogTag('add-document-dialog');
        setRevenueStatsToEdit(null);
        setIsRevenueDialogOpen(true);
        break;
      case 'expense':
        setActiveParentDialogTag('add-document-dialog');
        setSlipToEdit(null);
        setIsExpenseDialogOpen(true);
        break;
      case 'incident':
        setActiveParentDialogTag('add-document-dialog');
        setIncidentToEdit(null);
        setIsIncidentDialogOpen(true);
        break;
      case 'handover': // Mở dialog bàn giao cuối ca
        setActiveParentDialogTag('add-document-dialog');
        setFinalHandoverToView(null);
        setIsFinalHandoverViewOpen(true);
        break;
    }
  };

  const handleSaveSlip = useCallback(async (data: any, id?: string) => {
    if (!user) return;
    setProcessingItemId(id || 'new');
    try {
      const slipDate = dateForNewEntry || slipToEdit?.date;
      if (!slipDate) throw new Error("Date for slip is not defined.");

      const createdBy = id ? slipToEdit?.createdBy : { userId: user.uid, userName: user.displayName };

      await dataStore.addOrUpdateExpenseSlip({ ...data, date: slipDate, createdBy }, id);
      toast.success(`Đã ${id ? 'cập nhật' : 'tạo'} phiếu chi.`);
      setIsExpenseDialogOpen(false);
    } catch (error) { toast.error("Không thể lưu phiếu chi."); console.error(error) }
    finally { setProcessingItemId(null); }
  }, [user, slipToEdit, dateForNewEntry]);

  const handleSaveRevenue = useCallback(async (data: Omit<RevenueStats, 'id' | 'createdAt' | 'createdBy' | 'isEdited' | 'date'>, isEdited: boolean, id?: string) => {
    if (!user) return;
    const docId = id || revenueStatsToEdit?.id;
    setProcessingItemId(docId || 'new-revenue');
    try {
      const revenueDate = dateForNewEntry || revenueStatsToEdit?.date;
      if (!revenueDate) throw new Error("Date for revenue is not defined.");

      const revenueData = {
        ...data,
        date: revenueDate,
      };

      const newDocId = await dataStore.addOrUpdateRevenueStats(revenueData, user, isEdited, docId);
      toast.success(`Đã ${docId ? 'cập nhật' : 'tạo'} doanh thu.`);
      setIsRevenueDialogOpen(false);

      // Always open the CashHandoverDialog after saving a revenue stat.
      // This applies to both creating a new stat and editing an existing one.
      const relevantDate = revenueDate;

      // Find if a cash handover already exists for this revenue stat.
      const reportsForDate = reportsByDay[relevantDate] || { revenue: [], expenses: [], incidents: [], cashHandovers: [] };
      const handoverToEdit = reportsForDate.cashHandovers.find(report => report.linkedRevenueStatsId === (docId || newDocId));

      // Set the state needed for the CashHandoverDialog and open it.
      setCashHandoverToEdit(handoverToEdit || null);
      setDateForNewEntry(format(relevantDate, 'yyyy-MM-dd')); // Pass the date context
      setIsCashHandoverDialogOpen(true);

    } catch (error) { toast.error("Không thể lưu doanh thu."); console.error(error); }
    finally { setProcessingItemId(null); }
  }, [user, revenueStatsToEdit, dateForNewEntry, reportsByDay]);

  const handleSaveIncident = useCallback(async (data: any, id?: string) => {
    if (!user) return;
    setProcessingItemId(id || 'new');
    try {
      const incidentDate = dateForNewEntry || incidentToEdit?.date;
      if (!incidentDate) throw new Error("Date for incident is not defined.");

      await dataStore.addOrUpdateIncident({ ...data, date: incidentDate }, id, user);
      toast.success(id ? "Đã cập nhật sự cố." : "Đã ghi nhận sự cố.");
      if (data.cost > 0 && data.paymentMethod !== 'intangible_cost') {
        toast.info("Một phiếu chi tương ứng đã được tạo/cập nhật tự động.", { icon: 'ℹ️' });
      }
      setIsIncidentDialogOpen(false);
    } catch (error) { toast.error('Không thể lưu báo cáo sự cố.'); }
    finally { setProcessingItemId(null); }
  }, [user, incidentToEdit, dateForNewEntry]);

  const handleSaveCashHandover = useCallback(async (data: any, id?: string) => {
    if (!user) return;
    setProcessingItemId(id || 'new-cash-handover');
    try {
      if (id) {
        await dataStore.updateCashHandoverReport(id, data, user);
        toast.success('Đã cập nhật biên bản kiểm kê.');
      } else {
        // Creating a new report for a specific date (past or present)
        const relevantDate = dateForNewEntry || cashHandoverToEdit?.date;
        if (!relevantDate) {
          toast.error("Không xác định được ngày để tạo biên bản.");
          return;
        }
        const reportsForDate = reportsByDay[relevantDate] || { revenue: [], expenses: [], incidents: [], cashHandovers: [] };
        const latestRevenueForDate = reportsForDate.revenue[0] || null;

        await dataStore.addCashHandoverReport({
          ...data,
          date: relevantDate,
          startOfDayCash: 1_500_000, // Default for past entries, can be adjusted
          linkedExpenseSlipIds: reportsForDate.expenses.map(s => s.id),
          linkedRevenueStatsId: latestRevenueForDate?.id || null,
        }, user);
        toast.success(`Đã tạo biên bản kiểm kê cho ngày ${format(parseISO(relevantDate), 'dd/MM/yyyy')}.`);
      }
      setDateForNewEntry(null);
      setIsCashHandoverDialogOpen(false);
    } catch (error) { toast.error('Không thể lưu biên bản kiểm kê.'); console.error(error); }
    finally { setProcessingItemId(null); }
  }, [user, dateForNewEntry, cashHandoverToEdit, reportsByDay]);

  const handleSaveFinalHandover = useCallback(async (data: any, id?: string) => {
    if (!user) return;
    setProcessingItemId(id || 'new-final-handover');
    try {
      await dataStore.saveFinalHandoverDetails(data, user, id, dateForNewEntry ?? undefined);
      toast.success(id ? 'Đã cập nhật biên bản bàn giao.' : 'Đã bổ sung biên bản bàn giao.');
      setIsFinalHandoverViewOpen(false);
      setFinalHandoverToView(null);
      setDateForNewEntry(null);
    } catch (error) {
      toast.error(`Lỗi: Không thể lưu biên bản. ${(error as Error).message}`);
      console.error("Failed to save final handover:", error);
    } finally {
      setProcessingItemId(null);
    }
  }, [user, dateForNewEntry]);

  const handleDeleteExpense = useCallback((id: string) => {
    const expense = expenseSlips.find(e => e.id === id);
    if (expense && user) {
      setProcessingItemId(id);
      dataStore.deleteExpenseSlip(expense).then(() => toast.success(`Đã xóa phiếu chi.`))
        .catch((e) => toast.error(`Lỗi: Không thể xóa phiếu chi.`))
        .finally(() => setProcessingItemId(null));
    }
  }, [expenseSlips, user]);

  const handleDeleteRevenue = useCallback((id: string) => {
    if (!user) return;
    setProcessingItemId(id);
    dataStore.deleteRevenueStats(id, user).then(() => toast.success(`Đã xóa phiếu thống kê.`))
      .catch((e) => toast.error(`Lỗi: Không thể xóa phiếu thống kê.`))
      .finally(() => setProcessingItemId(null));
  }, [user]);

  const handleDeleteIncident = useCallback((id: string) => {
    const incidentToDelete = incidents.find(i => i.id === id);
    if (!incidentToDelete || !user) return;
    setProcessingItemId(id);
    dataStore.deleteIncident(incidentToDelete).then(() => toast.success('Đã xóa báo cáo sự cố.'))
      .catch(() => toast.error('Không thể xóa báo cáo sự cố.'))
      .finally(() => setProcessingItemId(null));
  }, [incidents, user]);

  const handleDeleteCashHandover = useCallback((id: string) => {
    if (!user) return;
    setProcessingItemId(id);
    dataStore.deleteCashHandoverReport(id, user).then(() => toast.success(`Đã xóa biên bản kiểm kê.`))
      .catch(() => toast.error(`Lỗi: Không thể xóa biên bản.`))
      .finally(() => setProcessingItemId(null));
  }, [user]);

  const handleCategoriesChange = useCallback(async (newCategories: IncidentCategory[]) => {
    await dataStore.updateIncidentCategories(newCategories);
  }, []);

  const handleMarkDebtsAsPaid = useCallback(async (items: { slipId: string, supplier: string }[]) => {
    try {
      await dataStore.markSupplierDebtsAsPaid(items);
      // The UI will update automatically because `subscribeToAllExpenseSlips` is listening for changes.
    } catch (error) {
      console.error("Failed to mark debts as paid:", error);
      toast.error("Lỗi: Không thể cập nhật trạng thái thanh toán.");
      throw error; // Re-throw to allow the dialog to handle its loading state.
    }
  }, []);

  const handleUndoDebtPayment = useCallback(async (slipId: string, supplier: string) => {
    try {
      await dataStore.undoSupplierDebtPayment(slipId, supplier);
    } catch (error) {
      console.error("Failed to undo debt payment:", error);
      toast.error("Lỗi: Không thể hoàn tác thanh toán.");
      throw error; // Re-throw to allow the dialog to handle its loading state.
    }
  }, []);

  if (isLoading || authLoading || !user) {
    return <LoadingPage />;
  }

  return (
    <>
      <div className={cn("container mx-auto p-1 sm:p-6 md:p-8", !isStandalone && "p-0 sm:p-0 md:p-0")}>
        {isStandalone && (
          <header className="mb-4 sm:mb-6">
            <Button variant="ghost" size="sm" className="-ml-2 mb-2 sm:mb-4" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />Quay lại
            </Button>
            <div className="flex flex-col lg:flex-row justify-between lg:items-start gap-4 sm:gap-6">
              <div className="flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold font-headline flex items-center gap-3"><Banknote className="h-8 w-8 text-primary" /> Báo cáo Thu ngân</h1>
                <p className="text-muted-foreground mt-1 text-sm sm:text-base">Tổng hợp báo cáo doanh thu, phiếu chi và sự cố do thu ngân gửi.</p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <div className="flex items-center justify-between sm:justify-center gap-2 bg-muted/50 p-1 rounded-lg">
                  <Button variant="ghost" size="icon" onClick={() => handleMonthChange('prev')}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="text-base font-semibold w-24 text-center">{format(currentMonth, 'MM/yyyy')}</span>
                  <Button variant="ghost" size="icon" onClick={() => handleMonthChange('next')} disabled={isNextMonthButtonDisabled}><ChevronRight className="h-4 w-4" /></Button>
                </div>

                <Card className="shadow-sm border-primary/20">
                  <CardHeader className="p-2 px-3 pb-1">
                    <CardTitle className="text-[10px] font-bold flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
                      <Settings className="h-3 w-3" /> Công cụ quản lý
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 px-3 pt-0 flex flex-row sm:flex-col gap-2 overflow-x-auto no-scrollbar">
                    <Button variant="outline" size="sm" onClick={() => setIsAddDocumentDialogOpen(true)} className="whitespace-nowrap h-8 text-xs flex-1 sm:flex-none"><FilePlus className="mr-2 h-3.5 w-3.5" />Bổ sung</Button>
                    <Button variant="outline" size="sm" onClick={() => setIsOtherCostCategoryDialogOpen(true)} className="whitespace-nowrap h-8 text-xs flex-1 sm:flex-none">Chi phí khác</Button>
                    <Button variant="outline" size="sm" onClick={() => setIsIncidentCategoryDialogOpen(true)} className="whitespace-nowrap h-8 text-xs flex-1 sm:flex-none">Loại sự cố</Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </header>
        )}

        {!isStandalone && (
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold font-headline flex items-center gap-2"><Banknote className="h-6 w-6" /> Thu ngân</h1>
              <div className="flex items-center gap-2">
                <Button variant="tile" size="icon" onClick={() => handleMonthChange('prev')}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-sm font-medium w-20 text-center">{format(currentMonth, 'MM/yyyy')}</span>
                <Button variant="tile" size="icon" onClick={() => handleMonthChange('next')} disabled={isNextMonthButtonDisabled}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 pb-2">
              <Button variant="tile" size="sm" onClick={() => setIsAddDocumentDialogOpen(true)} className="h-auto py-2 px-1 text-xs flex flex-col gap-1 items-center justify-center whitespace-normal text-center">
                <FilePlus className="h-4 w-4" />
                <span>Bổ sung</span>
              </Button>
              <Button variant="tile" size="sm" onClick={() => setIsOtherCostCategoryDialogOpen(true)} className="h-auto py-2 px-1 text-xs flex flex-col gap-1 items-center justify-center whitespace-normal text-center">
                <Settings className="h-4 w-4" />
                <span>Chi phí khác</span>
              </Button>
              <Button variant="tile" size="sm" onClick={() => setIsIncidentCategoryDialogOpen(true)} className="h-auto py-2 px-1 text-xs flex flex-col gap-1 items-center justify-center whitespace-normal text-center">
                <Settings className="h-4 w-4" />
                <span>Loại sự cố</span>
              </Button>
            </div>
          </div>
        )}

        {sortedDatesInMonth.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">Chưa có báo cáo nào trong tháng {format(currentMonth, 'MM/yyyy')}.</CardContent></Card>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            <MonthlySummary
              currentMonth={currentMonth}
              revenueStats={monthlyRevenueStats}
              expenseSlips={monthlyExpenseSlips}
              incidents={monthlyIncidents}
              onOpenUnpaidDialog={() => setIsUnpaidSlipsDialogOpen(true)}
            />

            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={handleToggleAllAccordions} disabled={sortedDatesInMonth.length === 0}>
                <ChevronsUpDown className="mr-2 h-4 w-4" />
                {openDays.length === sortedDatesInMonth.length ? 'Thu gọn tất cả' : 'Mở rộng tất cả'}
              </Button>
            </div>

            <Accordion type="multiple" value={openDays} onValueChange={setOpenDays} className="space-y-4">
              {sortedDatesInMonth.map(date => {
                const dayReports = reportsByDay[date] || { revenue: [], expenses: [], incidents: [], cashHandovers: [] };

                return (
                  <DailyReportAccordionItem
                    key={date}
                    date={date}
                    dayReports={dayReports}
                    onEditRevenue={handleEditRevenueWithRoot}
                    onDeleteRevenue={handleDeleteRevenue}
                    onEditExpense={handleEditExpenseWithRoot}
                    onDeleteExpense={handleDeleteExpense}
                    onEditIncident={handleEditIncidentWithRoot}
                    onDeleteIncident={handleDeleteIncident}
                    onOpenLightbox={(photos: string[], index?: number) => openLightbox(photos.map((p: string) => ({ src: p })), index ?? 0)}
                    onEditCashHandover={handleEditCashHandover}
                    onViewFinalHandover={handleViewFinalHandover}
                    onDeleteCashHandover={handleDeleteCashHandover}
                    processingItemId={processingItemId}
                    inventoryList={inventoryList}
                    itemRefs={itemRefs}
                  />
                );
              })}
            </Accordion>
          </div>
        )}
      </div>

      <OtherCostCategoryDialog open={isOtherCostCategoryDialogOpen} onOpenChange={setIsOtherCostCategoryDialogOpen} parentDialogTag="root" />
      <IncidentCategoryDialog open={isIncidentCategoryDialogOpen} onOpenChange={setIsIncidentCategoryDialogOpen} parentDialogTag="root" />
      <AddDocumentDialog
        isOpen={isAddDocumentDialogOpen}
        onOpenChange={setIsAddDocumentDialogOpen}
        onConfirm={handleAddDocumentConfirm}
        parentDialogTag='root'
      />

      <UnpaidSlipsDialog
        isOpen={isUnpaidSlipsDialogOpen}
        onClose={() => setIsUnpaidSlipsDialogOpen(false)}
        bankTransferSlips={expenseSlips.filter(s => s.paymentMethod === 'bank_transfer')}
        inventoryList={inventoryList}
        onMarkAsPaid={handleMarkDebtsAsPaid}
        onUndoPayment={handleUndoDebtPayment}
        parentDialogTag="root"
      />

      <OwnerCashierDialogs
        inventoryList={inventoryList}
        isExpenseDialogOpen={isExpenseDialogOpen}
        setIsExpenseDialogOpen={setIsExpenseDialogOpen}
        handleSaveSlip={handleSaveSlip}
        isProcessing={!!processingItemId}
        processingItemId={processingItemId}
        slipToEdit={slipToEdit}
        isRevenueDialogOpen={isRevenueDialogOpen}
        setIsRevenueDialogOpen={setIsRevenueDialogOpen}
        handleSaveRevenue={(data: any, isEdited: boolean) => handleSaveRevenue(data, isEdited, revenueStatsToEdit?.id)}
        revenueStatsToEdit={revenueStatsToEdit}
        isIncidentDialogOpen={isIncidentDialogOpen}
        setIsIncidentDialogOpen={setIsIncidentDialogOpen}
        handleSaveIncident={handleSaveIncident}
        incidentToEdit={incidentToEdit}
        isCashHandoverDialogOpen={isCashHandoverDialogOpen}
        setIsCashHandoverDialogOpen={setIsCashHandoverDialogOpen}
        handleSaveCashHandover={handleSaveCashHandover}
        cashHandoverToEdit={cashHandoverToEdit}
        expectedCashForDialog={expectedCashForDialog}
        linkedRevenueForDialog={linkedRevenueForDialog}
        linkedExpensesForDialog={linkedExpensesForDialog}
        isFinalHandoverViewOpen={isFinalHandoverViewOpen}
        setIsFinalHandoverViewOpen={setIsFinalHandoverViewOpen}
        handleSaveFinalHandover={(data: any, id?: string) => handleSaveFinalHandover(data, id)}
        finalHandoverToView={finalHandoverToView as any}
        otherCostCategories={otherCostCategories}
        incidentCategories={incidentCategories}
        handleCategoriesChange={handleCategoriesChange}
        canManageCategories={user?.role === 'Chủ nhà hàng'}
        dateForNewEntry={dateForNewEntry}
        reporter={user}
        parentDialogTag={activeParentDialogTag}
      />

    </>
  );
}
