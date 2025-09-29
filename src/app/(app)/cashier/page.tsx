
'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, ArrowRight, Receipt, AlertTriangle, Banknote, Edit, Trash2, Loader2, ArrowUpCircle, ArrowDownCircle, Wallet, Lock, Edit2, LandPlot, Settings, Eye } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ExpenseSlip, HandoverReport, IncidentReport, RevenueStats, ManagedUser, InventoryItem, OtherCostCategory, ExtractHandoverDataOutput, ExpenseItem, IncidentCategory } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, } from '@/components/ui/alert-dialog';
import ExpenseSlipDialog from './_components/expense-slip-dialog';
import IncidentReportDialog from './_components/incident-report-dialog';
import RevenueStatsDialog from './_components/revenue-stats-dialog';
import OwnerRevenueStatsDialog from '../reports/cashier/_components/owner-revenue-stats-dialog';
import HandoverDialog from './_components/handover-dialog';
import HandoverComparisonDialog from './_components/handover-comparison-dialog';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import IncidentCategoryDialog from './_components/incident-category-dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Image from 'next/image';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

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
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
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

const getSlipContentName = (item: ExpenseItem): string => {
    if (item.name?.startsWith('Chi phí sự cố')) return item.name;
    if (item.itemId === 'other_cost') {
      if (item.name === 'Khác' && item.description) {
          return item.description;
      }
      return item.name;
  }
  return item.name;
}


export default function CashierDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const expenseSlipsRef = useRef<HTMLDivElement>(null);
  const revenueStatsRef = useRef<HTMLDivElement>(null);
  
  const isMobile = useIsMobile();

  const [dailySlips, setDailySlips] = useState<ExpenseSlip[]>([]);
  const [dailyIncidents, setDailyIncidents] = useState<IncidentReport[]>([]);
  const [dailyRevenueStats, setDailyRevenueStats] = useState<RevenueStats[]>([]);
  const [handoverReport, setHandoverReport] = useState<HandoverReport | null>(null);

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
  
  const [isComparisonDialogOpen, setIsComparisonDialogOpen] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<any[] | null>(null);
  const [handoverReceiptData, setHandoverReceiptData] = useState<any | null>(null);

  const [slipToEdit, setSlipToEdit] = useState<ExpenseSlip | null>(null);
  const [revenueStatsToEdit, setRevenueStatsToEdit] = useState<RevenueStats | null>(null);
  const [incidentToEdit, setIncidentToEdit] = useState<IncidentReport | null>(null);

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxSlides, setLightboxSlides] = useState<{ src: string }[]>([]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
        if (isLightboxOpen) {
            event.preventDefault();
            setIsLightboxOpen(false);
        }
    };

    if (isLightboxOpen) {
        window.history.pushState(null, '', window.location.href);
        window.addEventListener('popstate', handlePopState);
    }
    return () => {
        window.removeEventListener('popstate', handlePopState);
    };
  }, [isLightboxOpen]);


  useEffect(() => {
    // Load start of day cash from local storage
    const savedCash = localStorage.getItem(`startOfDayCash-${format(new Date(), 'yyyy-MM-dd')}`);
    if (savedCash) {
      setStartOfDayCash(JSON.parse(savedCash).value);
    }
  }, []);

  const handleSaveStartOfDayCash = (newValue: number, reason: string) => {
    const data = { value: newValue, reason: reason, timestamp: new Date().toISOString() };
    localStorage.setItem(`startOfDayCash-${format(new Date(), 'yyyy-MM-dd')}`, JSON.stringify(data));
    setStartOfDayCash(newValue);
    toast.success("Đã cập nhật tiền mặt đầu ca.");
  };

  useEffect(() => {
    if (!authLoading && user && user.role !== 'Thu ngân' && !user.secondaryRoles?.includes('Thu ngân')) {
      router.replace('/');
    }
  }, [user, authLoading, router]);
  
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
        const unsubHandover = dataStore.subscribeToHandoverReport(date, setHandoverReport);

        Promise.all([
            dataStore.getDailyExpenseSlips(date),
            dataStore.getDailyRevenueStats(date),
            dataStore.getInventoryList(),
            dataStore.getOtherCostCategories(),
            dataStore.getIncidentCategories(),
            dataStore.getHandoverReport(date),
        ]).catch(error => {
            console.error("Failed to fetch cashier data:", error);
            toast.error("Không thể tải dữ liệu.");
        }).finally(() => {
            setIsLoading(false);
        });
        
        return () => {
            unsubSlips();
            unsubIncidents(() => {});
            unsubRevenue();
            unsubInventory();
            unsubOtherCostCategories();
            unsubIncidentCategories();
            unsubHandover();
        };
    }
  }, [user]);

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
    } catch(error) {
        console.error("Failed to delete expense slip", error);
        toast.error("Không thể xóa phiếu chi.");
    } finally {
        setIsProcessing(false);
    }
  }

  const handleSaveIncident = useCallback(async (data: Omit<IncidentReport, 'id' | 'createdAt' | 'createdBy' | 'date'> & { photoIds: string[], photosToDelete: string[] }, id?: string) => {
      if (!user) return;
      setIsProcessing(true);
      try {
          await dataStore.addOrUpdateIncident(data, id, user);
          toast.success(`Đã ${id ? 'cập nhật' : 'ghi nhận'} sự cố.`);
          if(data.cost > 0) {
              toast("Một phiếu chi tương ứng đã được tạo/cập nhật tự động.", { icon: 'ℹ️' });
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
    if(!user) return;
    setIsProcessing(true);
    try {
        await dataStore.addOrUpdateRevenueStats(data, user, isEdited, revenueStatsToEdit?.id);
        toast.success(`Đã ${revenueStatsToEdit ? 'cập nhật' : 'tạo'} phiếu thống kê.`);
        setIsRevenueDialogOpen(false);
        setRevenueStatsToEdit(null);
    } catch(error) {
        console.error("Failed to save revenue stats", error);
        toast.error("Không thể lưu thống kê doanh thu.");
    } finally {
        setIsProcessing(false);
    }
  }, [user, revenueStatsToEdit]);

   const handleDeleteRevenue = async (id: string) => {
    if (!user) return;
    setIsProcessing(true);
    try {
        await dataStore.deleteRevenueStats(id, user);
        toast.success("Đã xóa phiếu thống kê doanh thu.");
    } catch(error) {
        console.error("Failed to delete revenue stats:", error);
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

  const handleEditRevenue = (stats: RevenueStats) => {
      setRevenueStatsToEdit(stats);
      setIsRevenueDialogOpen(true);
  }

  const handleHandoverSubmit = (data: ExtractHandoverDataOutput & {imageDataUri: string}) => {
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
        deliveryPartnerPayout: Math.abs(receiptData.deliveryPartnerPayout), // Use receipt data for comparison
        revenueByCard: revenueByCardFromApp,
    };
    
    const comparison = [
        { field: 'expectedCash', label: 'Tiền mặt dự kiến', appValue: appData.expectedCash, receiptValue: receiptData.expectedCash },
        { field: 'startOfDayCash', label: 'Tiền mặt đầu ca', appValue: appData.startOfDayCash, receiptValue: receiptData.startOfDayCash },
        { field: 'cashExpense', label: 'Chi tiền mặt', appValue: appData.cashExpense, receiptValue: receiptData.cashExpense },
        { field: 'cashRevenue', label: 'Doanh thu tiền mặt', appValue: appData.cashRevenue, receiptValue: receiptData.cashRevenue },
        { field: 'deliveryPartnerPayout', label: 'Trả ĐTGH', appValue: appData.deliveryPartnerPayout, receiptValue: Math.abs(receiptData.deliveryPartnerPayout) },
        { field: 'techcombankVietQrPro', label: 'DT: TCB VietQR', appValue: appData.revenueByCard.techcombankVietQrPro, receiptValue: receiptData.revenueByCard.techcombankVietQrPro },
        { field: 'shopeeFood', label: 'DT: ShopeeFood', appValue: appData.revenueByCard.shopeeFood, receiptValue: receiptData.revenueByCard.shopeeFood },
        { field: 'grabFood', label: 'DT: GrabFood', appValue: appData.revenueByCard.grabFood, receiptValue: receiptData.revenueByCard.grabFood },
        { field: 'bankTransfer', label: 'DT: Chuyển Khoản', appValue: appData.revenueByCard.bankTransfer, receiptValue: receiptData.revenueByCard.bankTransfer },
    ].map(item => ({ ...item, isMatch: Math.abs(item.appValue - item.receiptValue) < 1 })); // Allow for rounding errors

    setComparisonResult(comparison);
    setHandoverReceiptData(data); // Store the full data including image URI
    setIsComparisonDialogOpen(true);
  };
  
    const handleFinalHandoverSubmit = async (finalData: any) => {
        if (!user || !handoverReceiptData) return;
        
        setIsProcessing(true);
        try {
            const reportData = {
                ...handoverReceiptData, // Includes image URI, AI data, edited status etc.
                ...finalData, // Includes actualCash, discrepancy, reason, and photo IDs
            };
            await dataStore.addHandoverReport(reportData, user);
            toast.success("Báo cáo bàn giao đã được gửi thành công!");
            setIsComparisonDialogOpen(false);
        } catch (error) {
            console.error("Failed to submit final handover report:", error);
            toast.error("Lỗi: Không thể gửi báo cáo bàn giao.");
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleNavigateToExpenses = () => {
        setIsComparisonDialogOpen(false);
        setTimeout(() => expenseSlipsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }
    
    const handleNavigateToRevenue = () => {
        setIsComparisonDialogOpen(false);
        setTimeout(() => revenueStatsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }

   const openPhotoLightbox = (photos: string[], index: number = 0) => {
        setLightboxSlides(photos.map(p => ({ src: p })));
        setIsLightboxOpen(true);
   };


  if (authLoading || isLoading || !user) {
    return (
      <div className="container mx-auto p-4 sm:p-6 md:p-8">
        <header className="mb-8">
            <Skeleton className="h-10 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
        </header>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
        </div>
        <div className="mt-6">
            <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  return (
    <>
    <div className="container mx-auto p-4 sm:p-6 md:p-8">
        <header className="mb-8">
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
            <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle>Tổng quan trong ngày</CardTitle>
                </CardHeader>
                 <CardContent className="space-y-2 text-base">
                     <div className="flex justify-between items-center">
                        <p className="text-muted-foreground flex items-center gap-2"><ArrowUpCircle className="h-5 w-5 text-green-500"/> Doanh thu tiền mặt</p>
                        <p className="font-bold text-green-700 dark:text-green-300">{cashRevenue.toLocaleString('vi-VN')}đ</p>
                    </div>
                    <div className="flex justify-between items-center">
                        <p className="text-muted-foreground flex items-center gap-2"><ArrowDownCircle className="h-5 w-5 text-red-500"/> Tổng chi tiền mặt</p>
                        <p className="font-bold text-red-700 dark:text-red-300">{totalCashExpense.toLocaleString('vi-VN')}đ</p>
                    </div>
                    <div className="flex justify-between items-center">
                        <p className="text-muted-foreground">Tổng chi chuyển khoản</p>
                        <p className="font-semibold">{totalBankExpense.toLocaleString('vi-VN')}đ</p>
                    </div>
                    <div className="flex justify-between items-center">
                        <div className="text-muted-foreground flex items-center gap-2">Tiền mặt đầu ca <StartOfDayCashDialog currentValue={startOfDayCash} onSave={handleSaveStartOfDayCash} /></div>
                        <p className="font-semibold">{startOfDayCash.toLocaleString('vi-VN')}đ</p>
                    </div>
                    <Separator className="my-2"/>
                    <div className="flex justify-between items-center pt-2">
                       <p className="font-semibold flex items-center gap-2"><Wallet className="h-5 w-5 text-blue-500"/>Tiền mặt dự kiến cuối ca</p>
                       <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">{expectedCashOnHand.toLocaleString('vi-VN')}đ</p>
                    </div>
                </CardContent>
            </Card>
            <Card className="border-yellow-500/50">
                <CardHeader>
                    <CardTitle className="text-yellow-800 dark:text-yellow-300">Báo cáo Sự cố</CardTitle>
                    <CardDescription className="text-yellow-700 dark:text-yellow-400">Ghi nhận các sự cố làm hư hỏng, thất thoát tài sản.</CardDescription>
                </CardHeader>
                <CardContent>
                    {dailyIncidents.length > 0 && (
                        <Accordion type="single" collapsible className="w-full mb-4">
                        <AccordionItem value="item-1">
                            <AccordionTrigger>Xem {dailyIncidents.length} sự cố đã ghi nhận</AccordionTrigger>
                            <AccordionContent>
                                <div className="space-y-3 mt-2">
                                {dailyIncidents.map(incident => {
                                    const canEdit = incident.createdBy.userId === user.uid;
                                    return (
                                        <div key={incident.id} className="p-2 bg-background rounded-md text-sm">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-medium">{incident.content}</p>
                                                    <p className="text-xs text-muted-foreground">Chi phí: {incident.cost.toLocaleString('vi-VN')}đ</p>
                                                </div>
                                                {canEdit && (
                                                    <div className="flex">
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditIncident(incident)}><Edit className="h-4 w-4"/></Button>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger>
                                                            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Xóa sự cố?</AlertDialogTitle><AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteIncident(incident)}>Xóa</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                )}
                                            </div>
                                            {incident.photos && incident.photos.length > 0 && (
                                                <div className="mt-2 flex gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => openPhotoLightbox(incident.photos)}>
                                                        <Eye className="h-4 w-4 mr-2"/> Xem {incident.photos.length} ảnh
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                        </Accordion>
                    )}
                    <Button variant="outline" className="w-full border-yellow-500/50 hover:bg-yellow-500/20" onClick={() => { setIncidentToEdit(null); setIsIncidentDialogOpen(true); }}>
                        <AlertTriangle className="mr-2 h-4 w-4 text-yellow-600" />
                        Tạo Báo cáo Sự cố
                    </Button>
                </CardContent>
            </Card>
        </div>
        
        <div className="grid grid-cols-1 gap-6">
             <Card ref={revenueStatsRef} className="border-green-500/50 bg-white dark:bg-card">
                <CardHeader>
                    <CardTitle className="text-green-800 dark:text-green-300">Thống kê Doanh thu</CardTitle>
                    <CardDescription className="text-green-700 dark:text-green-400">
                        Nhập số liệu từ bill tổng kết trên máy POS. Phiếu mới nhất sẽ được dùng để tính toán tổng quan.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {dailyRevenueStats.length > 0 && (
                        isMobile ? (
                            <div className="space-y-3">
                                {dailyRevenueStats.map((stat, index) => {
                                    const canEdit = stat.createdBy.userId === user.uid;
                                    const isLatest = index === 0;
                                    return (
                                        <Card key={stat.id} className={cn(isLatest && "border-primary bg-card")}>
                                            <CardContent className="p-3">
                                                <div className="flex justify-between items-start">
                                                    <div className="space-y-1">
                                                        <div className="font-semibold flex items-center gap-2">
                                                            {isLatest && <Badge>Mới nhất</Badge>}
                                                            <p>Phiếu của {stat.createdBy.userName}</p>
                                                        </div>
                                                         <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                            <span>{format(new Date(stat.createdAt as string), 'HH:mm')}</span>
                                                            {stat.isEdited && <Badge variant="secondary" className="text-xs">Đã sửa</Badge>}
                                                         </div>
                                                    </div>
                                                    <p className="font-bold text-lg text-primary">{(stat.netRevenue || 0).toLocaleString('vi-VN')}đ</p>
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
                        <Table>
                            <TableHeader><TableRow><TableHead>Người tạo</TableHead><TableHead>Thời gian</TableHead><TableHead>Doanh thu Net</TableHead><TableHead className="text-right">Hành động</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {dailyRevenueStats.map((stat, index) => {
                                    const canEdit = stat.createdBy.userId === user.uid;
                                    const isLatest = index === 0;
                                    return (
                                        <TableRow key={stat.id} className={cn(isLatest && "bg-primary/5")}>
                                            <TableCell className="font-medium">{stat.createdBy.userName} {stat.isEdited && <Badge variant="secondary" className="ml-2 text-xs">Đã sửa</Badge>}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{format(new Date(stat.createdAt as string), 'HH:mm')}</TableCell>
                                            <TableCell className="font-bold text-lg text-green-600">{(stat.netRevenue || 0).toLocaleString('vi-VN')}đ {isLatest && <Badge variant="outline" className="ml-2">Mới nhất</Badge>}</TableCell>
                                            <TableCell className="text-right">
                                                {canEdit && (
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
                        )
                    )}
                     <div className="mt-4">
                        <Button className="w-full bg-green-500 hover:bg-green-600" onClick={() => { setRevenueStatsToEdit(null); setIsRevenueDialogOpen(true); }}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Nhập Thống kê Doanh thu
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card ref={expenseSlipsRef} className="border-red-500/50 bg-white dark:bg-card">
                <CardHeader>
                    <CardTitle className="text-red-800 dark:text-red-300">Quản lý Phiếu chi</CardTitle>
                    <CardDescription className="text-red-700 dark:text-red-400">Lịch sử các khoản chi trong ngày. Dữ liệu sẽ được làm mới vào ngày hôm sau.</CardDescription>
                </CardHeader>
                <CardContent>
                    {dailySlips.length > 0 ? (
                       isMobile ? (
                            <div className="space-y-3">
                                {dailySlips.map(slip => {
                                    const canEdit = slip.createdBy.userId === user.uid && !slip.associatedHandoverReportId;
                                    const actualAmount = slip.paymentMethod === 'cash' ? slip.actualPaidAmount ?? slip.totalAmount : slip.totalAmount;
                                    return (
                                        <Card key={slip.id} className="bg-background">
                                            <CardContent className="p-3">
                                                <div className="flex justify-between items-start">
                                                    <div className="space-y-1 pr-2">
                                                        <div className="font-semibold text-sm flex items-center gap-2">
                                                            {slip.associatedHandoverReportId && <Badge variant="outline" className="font-normal">Tự động</Badge>}
                                                            <p>{getSlipContentName(slip.items[0])}{slip.items.length > 1 && ` và ${slip.items.length - 1} mục khác`}</p>
                                                        </div>
                                                        <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
                                                            <span>{slip.createdBy.userName}</span>
                                                            <span>•</span>
                                                            <span>{slip.lastModified ? format(new Date(slip.lastModified as string), 'HH:mm') : format(new Date(slip.createdAt as string), 'HH:mm')}</span>
                                                            {slip.lastModifiedBy && <Badge variant="secondary" className="text-xs">Sửa</Badge>}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-bold text-base text-red-600">-{actualAmount.toLocaleString('vi-VN')}đ</p>
                                                        <div className="flex items-center justify-end gap-2 text-sm mt-1">
                                                            {slip.paymentMethod === 'cash' ? <Wallet className="h-4 w-4"/> : <LandPlot className="h-4 w-4"/>}
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
                       <div className="overflow-x-auto">
                           <Table>
                               <TableHeader>
                                   <TableRow>
                                       <TableHead>Nội dung</TableHead>
                                       <TableHead>Thời gian</TableHead>
                                       <TableHead>Tổng tiền / Thực trả</TableHead>
                                       <TableHead>Hình thức</TableHead>
                                       <TableHead>Người tạo</TableHead>
                                       <TableHead className="text-right">Hành động</TableHead>
                                   </TableRow>
                               </TableHeader>
                               <TableBody>
                                   {dailySlips.map(slip => {
                                      const canEdit = slip.createdBy.userId === user.uid && !slip.associatedHandoverReportId;
                                      return (
                                       <TableRow key={slip.id}>
                                           <TableCell className="font-medium">
                                                {getSlipContentName(slip.items[0])}
                                                {slip.items.length > 1 && ` và ${slip.items.length - 1} mục khác`}
                                                {slip.associatedHandoverReportId && <Badge variant="outline" className="ml-2 font-normal">Tự động</Badge>}
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
                                           <TableCell>
                                                <div className='flex flex-col items-start'>
                                                    <span>{slip.totalAmount.toLocaleString('vi-VN')}đ</span>
                                                    {(slip.paymentMethod === 'cash' && typeof slip.actualPaidAmount === 'number' && slip.actualPaidAmount !== slip.totalAmount) && (
                                                         <span className='text-xs text-red-600'>({(slip.actualPaidAmount).toLocaleString('vi-VN')}đ)</span>
                                                    )}
                                                </div>
                                           </TableCell>
                                           <TableCell>
                                             <div className="flex items-center gap-2 text-sm">
                                                {slip.paymentMethod === 'cash' ? <Wallet className="h-4 w-4"/> : <LandPlot className="h-4 w-4"/>}
                                                {slip.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                                            </div>
                                           </TableCell>
                                           <TableCell>{slip.createdBy.userName}</TableCell>
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
                         <p className="text-center text-sm text-muted-foreground py-8">Chưa có phiếu chi nào trong hôm nay.</p>
                    )}
                    {isProcessing && <div className="absolute inset-0 bg-white/70 dark:bg-black/70 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin"/></div>}
                     <div className="mt-4">
                        <Button className="w-full bg-red-500 hover:bg-red-600" onClick={() => { setSlipToEdit(null); setIsExpenseDialogOpen(true); }}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Tạo phiếu chi
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-blue-500/50 bg-white dark:bg-card">
                <CardHeader>
                    <CardTitle className="text-blue-800 dark:text-blue-300">Bàn giao cuối ca</CardTitle>
                    {handoverReport ? (
                        <CardDescription className="text-blue-700 dark:text-blue-400">Ca hôm nay đã được bàn giao bởi <span className="font-semibold">{handoverReport.createdBy.userName}</span>.</CardDescription>
                    ) : (
                        <CardDescription className="text-blue-700 dark:text-blue-400">Thực hiện kiểm đếm và bàn giao tiền mặt cho ca sau hoặc quản lý.</CardDescription>
                    )}
                </CardHeader>
                <CardContent>
                    <Button className="w-full bg-blue-500 hover:bg-blue-600" onClick={() => setIsHandoverDialogOpen(true)} disabled={dailyRevenueStats.length === 0 || !!handoverReport}>
                       {handoverReport ? <Lock className="mr-2 h-4 w-4" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                       {handoverReport ? 'Đã Bàn Giao' : 'Thực hiện bàn giao'}
                    </Button>
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
        onCategoriesChange={handleCategoriesChange}
        canManage={user.role === 'Chủ nhà hàng'}
        reporter={user}
        violationToEdit={incidentToEdit}
    />
     <RevenueStatsDialog
        open={isRevenueDialogOpen && !revenueStatsToEdit}
        onOpenChange={setIsRevenueDialogOpen}
        onSave={handleSaveRevenue}
        isProcessing={isProcessing}
        existingStats={null}
    />
    <OwnerRevenueStatsDialog
        open={isRevenueDialogOpen && !!revenueStatsToEdit}
        onOpenChange={setIsRevenueDialogOpen}
        onSave={(data, isEdited) => handleSaveRevenue(data, isEdited)}
        isProcessing={isProcessing}
        existingStats={revenueStatsToEdit}
    />
    <HandoverDialog
        open={isHandoverDialogOpen}
        onOpenChange={setIsHandoverDialogOpen}
        onSubmit={handleHandoverSubmit}
        isProcessing={isProcessing}
    />
    {handoverReceiptData && (
        <HandoverComparisonDialog
            open={isComparisonDialogOpen}
            onOpenChange={setIsComparisonDialogOpen}
            onFinalSubmit={handleFinalHandoverSubmit}
            isProcessing={isProcessing}
            comparisonResult={comparisonResult}
            handoverData={handoverReceiptData.handoverData}
            onNavigateToExpenses={handleNavigateToExpenses}
            onNavigateToRevenue={handleNavigateToRevenue}
        />
    )}
     <Lightbox
        open={isLightboxOpen}
        close={() => setIsLightboxOpen(false)}
        slides={lightboxSlides}
        carousel={{ finite: true }}
    />
    </>
  );
}

