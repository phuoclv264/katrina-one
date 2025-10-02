
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, type AuthUser } from '@/hooks/use-auth';
import { dataStore } from '@/lib/data-store';
import type { ExpenseSlip, IncidentReport, RevenueStats, InventoryItem, OtherCostCategory, ExpenseItem, IncidentCategory, ManagedUser, HandoverReport } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ArrowLeft, Banknote, Receipt, AlertTriangle, Wallet, Calendar, Settings, ChevronLeft, ChevronRight, ClipboardCheck, ClipboardX } from 'lucide-react';
import { format, startOfMonth, endOfMonth, isSameMonth, parseISO, addMonths, subMonths } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from 'react-hot-toast';
import { Separator } from '@/components/ui/separator';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import OtherCostCategoryDialog from './_components/other-cost-category-dialog';
import IncidentCategoryDialog from '../../cashier/_components/incident-category-dialog';
import UnpaidSlipsDialog from './_components/unpaid-slips-dialog';
import OwnerCashierDialogs from './_components/owner-cashier-dialogs';
import RevenueStatsList from './_components/RevenueStatsList';
import ExpenseList from './_components/ExpenseList';
import IncidentList from './_components/IncidentList';
import HandoverReportCard from './_components/HandoverReportCard';
import OwnerHandoverReportDialog from './_components/owner-handover-report-dialog';
import IncidentReportDialog from '../../cashier/_components/incident-report-dialog';
import { Badge } from '@/components/ui/badge';


export default function CashierReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [revenueStats, setRevenueStats] = useState<RevenueStats[]>([]);
  const [expenseSlips, setExpenseSlips] = useState<ExpenseSlip[]>([]);
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [otherCostCategories, setOtherCostCategories] = useState<OtherCostCategory[]>([]);
  const [incidentCategories, setIncidentCategories] = useState<IncidentCategory[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [handoverReports, setHandoverReports] = useState<HandoverReport[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [processingItemId, setProcessingItemId] = useState<string | null>(null);

  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isRevenueDialogOpen, setIsRevenueDialogOpen] = useState(false);
  const [isIncidentDialogOpen, setIsIncidentDialogOpen] = useState(false);
  const [isOtherCostCategoryDialogOpen, setIsOtherCostCategoryDialogOpen] = useState(false);
  const [isIncidentCategoryDialogOpen, setIsIncidentCategoryDialogOpen] = useState(false);
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
    if (lightboxOpen) {
      window.history.pushState(null, '', window.location.href);
      const handlePopState = (event: PopStateEvent) => {
        if (lightboxOpen) {
          event.preventDefault();
          setLightboxOpen(false);
        }
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [lightboxOpen]);

  useEffect(() => {
    if (!authLoading && user?.role !== 'Chủ nhà hàng') {
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
      dataStore.subscribeToAllHandoverReports(setHandoverReports),
    ];
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => {
      subscriptions.forEach(unsub => unsub());
      clearTimeout(timer);
    };
  }, [user]);

  const allMonthsWithData = useMemo(() => {
    const monthSet = new Set<string>();
    [...revenueStats, ...expenseSlips, ...incidents, ...handoverReports].forEach(item => {
        monthSet.add(format(parseISO(item.date), 'yyyy-MM'));
    });
    return Array.from(monthSet).sort().reverse();
  }, [revenueStats, expenseSlips, incidents, handoverReports]);

  useEffect(() => {
    if (allMonthsWithData.length > 0) {
      setCurrentMonth(parseISO(`${allMonthsWithData[0]}-01`));
    }
  }, [allMonthsWithData]);

  const reportsForCurrentMonth = useMemo(() => {
    const reports: { [date: string]: { revenue: RevenueStats[], expenses: ExpenseSlip[], incidents: IncidentReport[], handover?: HandoverReport }} = {};
    const processItems = (items: (RevenueStats | ExpenseSlip | IncidentReport | HandoverReport)[]) => {
      items.forEach(item => {
        if (isSameMonth(parseISO(item.date), currentMonth)) {
          reports[item.date] = reports[item.date] || { revenue: [], expenses: [], incidents: [] };
          if ('netRevenue' in item) reports[item.date].revenue.push(item);
          else if ('expenseType' in item) reports[item.date].expenses.push(item);
          else if ('content' in item) reports[item.date].incidents.push(item);
          else if ('handoverImageUrl' in item) reports[item.date].handover = item;
        }
      });
    };
    processItems([...revenueStats, ...expenseSlips, ...incidents, ...handoverReports]);
    for (const date in reports) {
      reports[date].revenue?.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
      reports[date].expenses?.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
      reports[date].incidents?.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
    }
    return reports;
  }, [currentMonth, revenueStats, expenseSlips, incidents, handoverReports]);

  const sortedDatesInMonth = useMemo(() => Object.keys(reportsForCurrentMonth).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()), [reportsForCurrentMonth]);
  
  const monthlyBankTransferSlips = useMemo(() => expenseSlips.filter(slip => isSameMonth(parseISO(slip.date), currentMonth) && slip.paymentMethod === 'bank_transfer'), [expenseSlips, currentMonth]);

  const monthlySummary = useMemo(() => {
    const reportsInMonth = Object.values(reportsForCurrentMonth);
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
        if (stat.revenueByPaymentMethod) Object.keys(stat.revenueByPaymentMethod).forEach(key => { acc[key] = (acc[key] || 0) + stat.revenueByPaymentMethod[key as keyof typeof stat.revenueByPaymentMethod]; });
        return acc;
    }, {} as {[key: string]: number});
    const expenseByPaymentMethod = allExpenses.reduce((acc, slip) => { acc[slip.paymentMethod] = (acc[slip.paymentMethod] || 0) + slip.totalAmount; return acc; }, {} as {[key: string]: number});
    const unpaidBankTransfer = monthlyBankTransferSlips.filter(s => s.paymentStatus === 'unpaid').reduce((sum, slip) => sum + slip.totalAmount, 0);
    const intangibleCost = allIncidents.filter(i => i.paymentMethod === 'intangible_cost' && i.cost > 0).reduce((sum, i) => sum + i.cost, 0);
    
    const expenseByType = allExpenses.reduce((acc, slip) => {
        const type = slip.expenseType === 'goods_import' ? 'Nhập hàng' : (slip.items[0]?.name || 'Khác');
        acc[type] = (acc[type] || 0) + slip.totalAmount;
        return acc;
    }, {} as {[key: string]: number});
    return { totalRevenue, totalExpense, revenueByMethod, expenseByType, expenseByPaymentMethod, intangibleCost, unpaidBankTransfer };
  }, [reportsForCurrentMonth, monthlyBankTransferSlips]);

  const handleMonthChange = (direction: 'prev' | 'next') => setCurrentMonth(prev => direction === 'next' ? addMonths(prev, 1) : subMonths(prev, 1));
  const isNextMonthButtonDisabled = useMemo(() => allMonthsWithData.length > 0 && format(currentMonth, 'yyyy-MM') === allMonthsWithData[0], [currentMonth, allMonthsWithData]);

  const handleEditExpense = useCallback((slip: ExpenseSlip) => { setSlipToEdit(slip); setIsExpenseDialogOpen(true); }, []);
  const handleEditRevenue = useCallback((stats: RevenueStats) => { setRevenueStatsToEdit(stats); setIsRevenueDialogOpen(true); }, []);
  const handleEditIncident = useCallback((incident: IncidentReport) => { setIncidentToEdit(incident); setIsIncidentDialogOpen(true); }, []);
  const handleEditHandover = useCallback((handover: HandoverReport) => { setHandoverToEdit(handover); setIsHandoverReportDialogOpen(true); }, []);

  const handleSaveSlip = useCallback(async (data: any, id?: string) => {
    if (!user || !slipToEdit) return;
    try {
        await dataStore.addOrUpdateExpenseSlip({ ...data, lastModifiedBy: { userId: user.uid, userName: user.displayName } }, id);
        toast.success("Đã cập nhật phiếu chi.");
        setIsExpenseDialogOpen(false);
    } catch (error) { toast.error("Không thể lưu phiếu chi."); }
  }, [user, slipToEdit]);

  const handleSaveRevenue = useCallback(async (data: Omit<RevenueStats, 'id' | 'date' | 'createdAt' | 'createdBy' | 'isEdited'>, isEdited: boolean) => {
    if (!user || !revenueStatsToEdit) return;
    try {
        await dataStore.addOrUpdateRevenueStats(data, user, isEdited, revenueStatsToEdit.id);
        toast.success("Đã cập nhật doanh thu.");
        setIsRevenueDialogOpen(false);
    } catch (error) { toast.error("Không thể lưu doanh thu."); }
  }, [user, revenueStatsToEdit]);

  const handleSaveIncident = useCallback(async (data: any, id?: string) => {
    if (!user) return;
    try {
        await dataStore.addOrUpdateIncident(data, id, user);
        toast.success("Đã cập nhật sự cố.");
        setIsIncidentDialogOpen(false);
    } catch (error) { toast.error('Không thể lưu báo cáo sự cố.'); }
  }, [user]);

  const handleSaveHandover = useCallback(async (data: any, id: string) => {
    if (!user) return;
    try {
        await dataStore.updateHandoverReport(id, data, user);
        toast.success('Đã cập nhật báo cáo bàn giao.');
        setIsHandoverReportDialogOpen(false);
    } catch (error) { toast.error('Không thể cập nhật báo cáo bàn giao.'); }
  }, [user]);
  
  const handleDelete = useCallback(async (id: string, deleteFunc: (id: string, user?: AuthUser) => Promise<void>, itemType: string) => {
    if (!user) return;
    setProcessingItemId(id);
    try {
      await deleteFunc(id, user);
      toast.success(`Đã xóa ${itemType}.`);
    } catch (error) {
      toast.error(`Lỗi: Không thể xóa ${itemType}.`);
    } finally {
      setProcessingItemId(null);
    }
  }, [user]);

  const handleDeleteExpense = useCallback((id: string) => handleDelete(id, dataStore.deleteExpenseSlip as any, 'phiếu chi'), [handleDelete]);
  const handleDeleteRevenue = useCallback((id: string) => handleDelete(id, dataStore.deleteRevenueStats, 'phiếu thống kê'), [handleDelete]);
  const handleDeleteIncident = useCallback((id: string) => handleDelete(id, dataStore.deleteIncident as any, 'báo cáo sự cố'), [handleDelete]);
  const handleDeleteHandover = useCallback((id: string) => handleDelete(id, dataStore.deleteHandoverReport as any, 'báo cáo bàn giao'), [handleDelete]);

  const openPhotoLightbox = useCallback((photos: string[], index = 0) => { 
    setLightboxSlides(photos.map(p => ({ src: p }))); 
    setLightboxIndex(index);
    setLightboxOpen(true); 
  }, []);

  if (isLoading || authLoading || !user) {
    return (
      <div className="container mx-auto p-4 sm:p-6 md:p-8">
        <header className="mb-8"><Skeleton className="h-10 w-1/2" /></header>
        <Card><CardContent className="p-6"><Skeleton className="h-96 w-full" /></CardContent></Card>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto p-4 sm:p-6 md:p-8">
        <header className="mb-8">
          <Button asChild variant="ghost" className="-ml-4 mb-4"><Link href="/reports"><ArrowLeft className="mr-2 h-4 w-4" />Quay lại</Link></Button>
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Banknote /> Báo cáo Thu ngân</h1>
              <p className="text-muted-foreground mt-2">Tổng hợp báo cáo doanh thu, phiếu chi và sự cố do thu ngân gửi.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => handleMonthChange('prev')}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-lg font-medium w-32 text-center">{format(currentMonth, 'MM/yyyy')}</span>
              <Button variant="outline" size="icon" onClick={() => handleMonthChange('next')} disabled={isNextMonthButtonDisabled}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <Card>
              <CardHeader className="p-3 pb-2"><CardTitle className="text-base flex items-center gap-2"><Settings className="h-4 w-4"/>Cài đặt</CardTitle></CardHeader>
              <CardContent className="p-3 pt-0 flex flex-col gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsOtherCostCategoryDialogOpen(true)}>Quản lý Loại chi phí khác</Button>
                <Button variant="outline" size="sm" onClick={() => setIsIncidentCategoryDialogOpen(true)}>Quản lý Loại sự cố</Button>
              </CardContent>
            </Card>
          </div>
        </header>

        {sortedDatesInMonth.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">Chưa có báo cáo nào trong tháng {format(currentMonth, 'MM/yyyy')}.</CardContent></Card>
        ) : (
          <div className="space-y-6">
            <Card className="border-primary">
              <CardHeader><CardTitle>Tổng quan Tháng {format(currentMonth, 'MM/yyyy')}</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-lg text-green-600">Doanh thu: {monthlySummary.totalRevenue.toLocaleString('vi-VN')}đ</h4>
                  <div className="text-sm space-y-1"><p className="font-medium">Theo phương thức thanh toán:</p>{Object.entries(monthlySummary.revenueByMethod).map(([key, value]) => (<p key={key} className="pl-4">{key}: <span className="font-medium">{value.toLocaleString('vi-VN')}đ</span></p>))}</div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-semibold text-lg text-red-600">Chi phí: {monthlySummary.totalExpense.toLocaleString('vi-VN')}đ</h4>
                  <div className="text-sm space-y-1">
                    <p className="font-medium">Theo Phương thức Thanh toán:</p>
                    <p className="pl-4">Tiền mặt: <span className="font-medium">{(monthlySummary.expenseByPaymentMethod['cash'] || 0).toLocaleString('vi-VN')}đ</span></p>
                    <div className="pl-4 flex items-center gap-2"><span>Chuyển khoản: <span className="font-medium">{(monthlySummary.expenseByPaymentMethod['bank_transfer'] || 0).toLocaleString('vi-VN')}đ</span></span>{monthlySummary.unpaidBankTransfer > 0 && (<div className='flex items-center gap-1'><Badge variant="destructive">Chưa TT: {monthlySummary.unpaidBankTransfer.toLocaleString('vi-VN')}đ</Badge><Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setIsUnpaidSlipsDialogOpen(true)}>Xem chi tiết</Button></div>)}</div>
                    <div className="pl-4 flex items-center gap-2"><span>Chi phí vô hình: <span className="font-medium">{(monthlySummary.intangibleCost || 0).toLocaleString('vi-VN')}đ</span></span></div>
                  </div>
                  <Separator/>
                  <div className="text-sm space-y-1"><p className="font-medium">Theo Loại chi phí:</p>{Object.entries(monthlySummary.expenseByType).map(([key, value]) => (<p key={key} className="pl-4">{key}: <span className="font-medium">{value.toLocaleString('vi-VN')}đ</span></p>))}</div>
                </div>
              </CardContent>
            </Card>

            <Accordion type="multiple" defaultValue={sortedDatesInMonth.slice(0, 1)} className="space-y-4">
              {sortedDatesInMonth.map(date => {
                const dayReports = reportsForCurrentMonth[date];
                const totalDailyRevenue = (dayReports.revenue || []).reduce((sum, r) => sum + r.netRevenue, 0);
                const totalDailyExpense = (dayReports.expenses || []).reduce((sum, e) => sum + e.totalAmount, 0) + (dayReports.incidents || []).reduce((sum, i) => sum + i.cost, 0);
                return (
                  <AccordionItem value={date} key={date} className="border rounded-xl shadow-md bg-white dark:bg-card">
                    <AccordionTrigger className="p-4 text-base font-semibold hover:no-underline rounded-t-xl">
                      <div className="w-full flex justify-between items-center gap-4">
                        <div className="flex flex-col text-left">
                          <div className="text-lg font-bold flex items-center gap-2">{dayReports.handover ? <ClipboardCheck className="h-5 w-5 text-green-500" /> : <ClipboardX className="h-5 w-5 text-destructive" />}{format(parseISO(date), 'eeee, dd/MM/yyyy', { locale: vi })}</div>
                          <div className="text-sm text-muted-foreground font-normal flex flex-wrap gap-x-4 gap-y-1 mt-1"><span>Thu: <span className="font-semibold text-green-600">{totalDailyRevenue.toLocaleString('vi-VN')}đ</span></span><span>Chi: <span className="font-semibold text-red-600">{totalDailyExpense.toLocaleString('vi-VN')}đ</span></span>{(dayReports.incidents?.length || 0) > 0 && <span>Sự cố: <span className="font-semibold text-amber-600">{dayReports.incidents?.length}</span></span>}</div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 bg-muted/20 rounded-b-xl">
                      <div className="space-y-6">
                        <Card className="border-green-500/50 rounded-lg shadow-sm"><CardHeader className="p-4 pb-2"><CardTitle className="text-base flex items-center gap-2 text-green-800 dark:text-green-300"><Receipt /> Doanh thu</CardTitle></CardHeader><CardContent className="p-4 pt-0"><RevenueStatsList stats={dayReports.revenue || []} onEdit={handleEditRevenue} onDelete={handleDeleteRevenue} processingItemId={processingItemId} /></CardContent></Card>
                        <Card className="border-blue-500/50 rounded-lg shadow-sm"><CardHeader className="p-4 pb-2"><CardTitle className="text-base flex items-center gap-2 text-blue-800 dark:text-blue-300"><Wallet /> Phiếu chi</CardTitle></CardHeader><CardContent className="p-4 pt-0"><ExpenseList expenses={dayReports.expenses || []} onEdit={handleEditExpense} onDelete={handleDeleteExpense} processingItemId={processingItemId} /></CardContent></Card>
                        <Card className="border-amber-500/50 rounded-lg shadow-sm"><CardHeader className="p-4 pb-2"><CardTitle className="text-base flex items-center gap-2 text-amber-800 dark:text-amber-300"><AlertTriangle /> Sự cố</CardTitle></CardHeader><CardContent className="p-4 pt-0"><IncidentList incidents={dayReports.incidents || []} onEdit={handleEditIncident} onDelete={handleDeleteIncident} onOpenLightbox={openPhotoLightbox} processingItemId={processingItemId} /></CardContent></Card>
                        {dayReports.handover && <HandoverReportCard handover={dayReports.handover} onEdit={handleEditHandover} onDelete={handleDeleteHandover} processingItemId={processingItemId} />}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        )}
      </div>
      
      <OtherCostCategoryDialog open={isOtherCostCategoryDialogOpen} onOpenChange={setIsOtherCostCategoryDialogOpen} />
      
      <IncidentCategoryDialog open={isIncidentCategoryDialogOpen} onOpenChange={setIsIncidentCategoryDialogOpen} />
      
      <UnpaidSlipsDialog 
        isOpen={isUnpaidSlipsDialogOpen}
        onClose={() => setIsUnpaidSlipsDialogOpen(false)}
        bankTransferSlips={monthlyBankTransferSlips}
        inventoryList={inventoryList}
      />
      
      <OwnerCashierDialogs 
        inventoryList={inventoryList}
        isExpenseDialogOpen={isExpenseDialogOpen}
        setIsExpenseDialogOpen={setIsExpenseDialogOpen}
        handleSaveSlip={handleSaveSlip}
        isProcessing={!!processingItemId}
        slipToEdit={slipToEdit}
        isRevenueDialogOpen={isRevenueDialogOpen}
        setIsRevenueDialogOpen={setIsRevenueDialogOpen}
        handleSaveRevenue={handleSaveRevenue}
        revenueStatsToEdit={revenueStatsToEdit}
        otherCostCategories={otherCostCategories}
      />

      <IncidentReportDialog
        open={isIncidentDialogOpen}
        onOpenChange={setIsIncidentDialogOpen}
        onSave={handleSaveIncident}
        isProcessing={!!processingItemId}
        categories={incidentCategories}
        onCategoriesChange={() => {}} // Owner manages categories in a separate dialog
        canManage={false} // On this page, only owner can view, not manage categories directly in this dialog
        reporter={incidentToEdit?.createdBy || user}
        violationToEdit={incidentToEdit}
      />
      
      {user && (
          <OwnerHandoverReportDialog
            open={isHandoverReportDialogOpen}
            onOpenChange={setIsHandoverReportDialogOpen}
            onSave={handleSaveHandover}
            isProcessing={!!processingItemId}
            reportToEdit={handoverToEdit}
            reporter={handoverToEdit?.createdBy as AuthUser}
          />
      )}

      <Lightbox open={lightboxOpen} close={() => setLightboxOpen(false)} index={lightboxIndex} slides={lightboxSlides} carousel={{ finite: true }} />
    </>
  );
}
