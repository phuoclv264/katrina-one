
'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, type AuthUser } from '@/hooks/use-auth';
import { dataStore } from '@/lib/data-store';
import type { ExpenseSlip, IncidentReport, RevenueStats, InventoryItem, OtherCostCategory, ExpenseItem, IncidentCategory, ManagedUser, HandoverReport } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion } from '@/components/ui/accordion';
import { ArrowLeft, Banknote, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, isSameMonth, parseISO, addMonths, subMonths } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from 'react-hot-toast';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Image from 'next/image';

import UnpaidSlipsDialog from './_components/unpaid-slips-dialog';
import OwnerCashierDialogs from './_components/owner-cashier-dialogs';
import OwnerHandoverReportDialog from './_components/owner-handover-report-dialog';
import IncidentDetailsDialog from './_components/IncidentDetailsDialog';
import IncidentCategoryDialog from '../../cashier/_components/incident-category-dialog';
import IncidentReportDialog from '../../cashier/_components/incident-report-dialog';
import OtherCostCategoryDialog from '../../cashier/_components/other-cost-category-dialog';
import MonthlySummary from './_components/MonthlySummary';
import DailyReportAccordionItem from './_components/DailyReportAccordionItem';


export default function CashierReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const initialMonthSet = useRef(false);

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
  const [isIncidentDetailsDialogOpen, setIsIncidentDetailsDialogOpen] = useState(false);
  
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
    if (allMonthsWithData.length > 0 && !initialMonthSet.current) {
      setCurrentMonth(parseISO(`${allMonthsWithData[0]}-01`));
      initialMonthSet.current = true;
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
  
  const monthlyRevenueStats = useMemo(() => revenueStats.filter(stat => isSameMonth(parseISO(stat.date), currentMonth)), [revenueStats, currentMonth]);
  const monthlyExpenseSlips = useMemo(() => expenseSlips.filter(slip => isSameMonth(parseISO(slip.date), currentMonth)), [expenseSlips, currentMonth]);
  const monthlyIncidents = useMemo(() => incidents.filter(i => isSameMonth(parseISO(i.date), currentMonth)), [incidents, currentMonth]);


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
    setProcessingItemId(id || 'new');
    try {
        await dataStore.addOrUpdateIncident(data, id, user);
        toast.success(id ? "Đã cập nhật sự cố." : "Đã ghi nhận sự cố.");
        if (data.cost > 0 && data.paymentMethod !== 'intangible_cost') {
          toast("Một phiếu chi tương ứng đã được tạo/cập nhật tự động.", { icon: 'ℹ️' });
        }
        setIsIncidentDialogOpen(false);
    } catch (error) { toast.error('Không thể lưu báo cáo sự cố.'); }
    finally {
        setProcessingItemId(null);
    }
  }, [user]);

  const handleSaveHandover = useCallback(async (data: any, id: string) => {
    if (!user) return;
    try {
        await dataStore.updateHandoverReport(id, data, user);
        toast.success('Đã cập nhật báo cáo bàn giao.');
        setIsHandoverReportDialogOpen(false);
    } catch (error) { toast.error('Không thể cập nhật báo cáo bàn giao.'); }
  }, [user]);
  
  const handleDeleteExpense = useCallback((id: string) => {
    const expense = expenseSlips.find(e => e.id === id);
    if (expense && user) {
        setProcessingItemId(id);
        dataStore.deleteExpenseSlip(expense).then(() => {
            toast.success(`Đã xóa phiếu chi.`);
        }).catch((e) => {
            console.error(e);
            toast.error(`Lỗi: Không thể xóa phiếu chi.`);
        }).finally(() => {
            setProcessingItemId(null);
        })
    }
  }, [expenseSlips, user]);

  const handleDeleteRevenue = useCallback((id: string) => {
      if (!user) return;
      setProcessingItemId(id);
      dataStore.deleteRevenueStats(id, user).then(() => {
          toast.success(`Đã xóa phiếu thống kê.`);
      }).catch((e) => {
          console.error(e);
          toast.error(`Lỗi: Không thể xóa phiếu thống kê.`);
      }).finally(() => {
          setProcessingItemId(null);
      })
  }, [user]);
  
  const handleDeleteIncident = useCallback((id: string) => {
    const incidentToDelete = incidents.find(i => i.id === id);
    if (!incidentToDelete || !user) return;
    setProcessingItemId(id);
    dataStore.deleteIncident(incidentToDelete).then(() => {
        toast.success('Đã xóa báo cáo sự cố.');
    }).catch((error) => {
        console.error("Failed to delete incident:", error);
        toast.error('Không thể xóa báo cáo sự cố.');
    }).finally(() => {
        setProcessingItemId(null);
    });
  }, [incidents, user]);

  const handleDeleteHandover = useCallback((id: string) => {
      if (!user) return;
      setProcessingItemId(id);
      dataStore.deleteHandoverReport(id).then(() => {
          toast.success(`Đã xóa báo cáo bàn giao.`);
      }).catch((e) => {
          console.error(e);
          toast.error(`Lỗi: Không thể xóa báo cáo bàn giao.`);
      }).finally(() => {
          setProcessingItemId(null);
      })
  }, [user]);

  const openPhotoLightbox = useCallback((photos: string[], index = 0) => { 
    setLightboxSlides(photos.map(p => ({ src: p }))); 
    setLightboxIndex(index);
    setLightboxOpen(true); 
  }, []);
  
  const handleCategoriesChange = useCallback(async (newCategories: IncidentCategory[]) => {
    await dataStore.updateViolationCategories(newCategories.map(c => c.name));
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
            <MonthlySummary 
              currentMonth={currentMonth}
              revenueStats={monthlyRevenueStats}
              expenseSlips={monthlyExpenseSlips}
              incidents={monthlyIncidents}
              onOpenUnpaidDialog={() => setIsUnpaidSlipsDialogOpen(true)}
            />

            <Accordion type="multiple" defaultValue={sortedDatesInMonth.slice(0, 1)} className="space-y-4">
              {sortedDatesInMonth.map(date => (
                 <DailyReportAccordionItem
                    key={date}
                    date={date}
                    dayReports={reportsForCurrentMonth[date]}
                    onEditRevenue={handleEditRevenue}
                    onDeleteRevenue={handleDeleteRevenue}
                    onEditExpense={handleEditExpense}
                    onDeleteExpense={handleDeleteExpense}
                    onEditIncident={handleEditIncident}
                    onDeleteIncident={handleDeleteIncident}
                    onOpenLightbox={openPhotoLightbox}
                    onEditHandover={handleEditHandover}
                    onDeleteHandover={handleDeleteHandover}
                    processingItemId={processingItemId}
                    inventoryList={inventoryList}
                 />
              ))}
            </Accordion>
          </div>
        )}
      </div>
      
      <OtherCostCategoryDialog open={isOtherCostCategoryDialogOpen} onOpenChange={setIsOtherCostCategoryDialogOpen} />

      <IncidentCategoryDialog open={isIncidentCategoryDialogOpen} onOpenChange={setIsIncidentCategoryDialogOpen} />
      
      <UnpaidSlipsDialog 
        isOpen={isUnpaidSlipsDialogOpen}
        onClose={() => setIsUnpaidSlipsDialogOpen(false)}
        bankTransferSlips={expenseSlips.filter(s => s.paymentMethod === 'bank_transfer')}
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

      {user && (
        <IncidentReportDialog
          open={isIncidentDialogOpen}
          onOpenChange={setIsIncidentDialogOpen}
          onSave={handleSaveIncident}
          isProcessing={!!processingItemId}
          categories={incidentCategories}
          onCategoriesChange={() => {}}
          canManageCategories={user.role === 'Chủ nhà hàng'}
          reporter={incidentToEdit?.createdBy as AuthUser ?? user}
          violationToEdit={incidentToEdit}
        />
      )}
      
      {user && handoverToEdit && (
          <OwnerHandoverReportDialog
            open={isHandoverReportDialogOpen}
            onOpenChange={setIsHandoverReportDialogOpen}
            onSave={handleSaveHandover}
            isProcessing={!!processingItemId}
            reportToEdit={handoverToEdit}
            reporter={handoverToEdit?.createdBy as AuthUser}
          />
      )}

      <IncidentDetailsDialog
        isOpen={isIncidentDetailsDialogOpen}
        onClose={() => setIsIncidentDetailsDialogOpen(false)}
        incidents={monthlyIncidents}
        onOpenLightbox={openPhotoLightbox}
        currentMonth={currentMonth}
      />

      <Lightbox open={lightboxOpen} close={() => setLightboxOpen(false)} index={lightboxIndex} slides={lightboxSlides} carousel={{ finite: true }} />
    </>
  );
}
