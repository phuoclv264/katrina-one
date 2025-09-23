
'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, ArrowRight, Receipt, AlertTriangle, Banknote, Edit, Trash2, Loader2, ArrowUpCircle, ArrowDownCircle, Wallet, Lock } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ExpenseSlip, HandoverReport, IncidentReport, RevenueStats, ManagedUser, InventoryItem, ExpenseItem, OtherCostCategory, ExtractHandoverDataOutput } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, } from '@/components/ui/alert-dialog';
import ExpenseSlipDialog from './_components/expense-slip-dialog';
import IncidentReportDialog from './_components/incident-report-dialog';
import RevenueStatsDialog from './_components/revenue-stats-dialog';
import HandoverDialog from './_components/handover-dialog';
import HandoverComparisonDialog from './_components/handover-comparison-dialog';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';


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

export default function CashierDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const expenseSlipsRef = useRef<HTMLDivElement>(null);
  const revenueStatsRef = useRef<HTMLDivElement>(null);

  const [dailySlips, setDailySlips] = useState<ExpenseSlip[]>([]);
  const [dailyIncidents, setDailyIncidents] = useState<IncidentReport[]>([]);
  const [dailyRevenueStats, setDailyRevenueStats] = useState<RevenueStats[]>([]);
  const [handoverReport, setHandoverReport] = useState<HandoverReport | null>(null);

  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [otherCostCategories, setOtherCostCategories] = useState<OtherCostCategory[]>([]);
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
        const unsubHandover = dataStore.subscribeToHandoverReport(date, setHandoverReport);

        Promise.all([
            dataStore.getDailyExpenseSlips(date),
            dataStore.subscribeToAllIncidents((all) => setDailyIncidents(all.filter(i => i.date === date))),
            dataStore.getDailyRevenueStats(date),
            dataStore.getInventoryList(),
            dataStore.getOtherCostCategories(),
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
            unsubHandover();
        };
    }
  }, [user]);

  const { totalCashExpense, totalBankExpense, cashRevenue, expectedCashOnHand, totalNetRevenue, totalDeliveryPayout } = useMemo(() => {
    const { totalCashExpense, totalBankExpense } = dailySlips.reduce((acc, slip) => {
      if (slip.paymentMethod === 'cash') {
        acc.totalCashExpense += slip.totalAmount;
      } else if (slip.paymentMethod === 'bank_transfer') {
        acc.totalBankExpense += slip.totalAmount;
      }
      return acc;
    }, { totalCashExpense: 0, totalBankExpense: 0 });

    const totalNetRevenue = dailyRevenueStats.reduce((sum, stat) => sum + (stat.netRevenue || 0), 0);
    const totalDeliveryPayout = dailyRevenueStats.reduce((sum, stat) => sum + (stat.deliveryPartnerPayout || 0), 0);
    const cashRevenue = dailyRevenueStats.reduce((sum, stat) => sum + (stat.revenueByPaymentMethod.cash || 0), 0);
    
    const expectedCashOnHand = cashRevenue - totalCashExpense + startOfDayCash;

    return { totalCashExpense, totalBankExpense, cashRevenue, expectedCashOnHand, totalNetRevenue, totalDeliveryPayout };
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
        await dataStore.deleteExpenseSlip(slip);
        toast.success("Phiếu chi đã được xóa.");
    } catch(error) {
        console.error("Failed to delete expense slip", error);
        toast.error("Không thể xóa phiếu chi.");
    } finally {
        setIsProcessing(false);
    }
  }

  const handleSaveIncident = useCallback(async (data: Omit<IncidentReport, 'id' | 'createdAt' | 'createdBy' | 'date'>) => {
      if (!user) return;
      setIsProcessing(true);
      try {
          await dataStore.addIncidentReport(data, user);
          toast.success("Đã ghi nhận sự cố.");
          if(data.cost > 0) {
              toast("Một phiếu chi tương ứng đã được tạo tự động.", { icon: 'ℹ️' });
          }
          setIsIncidentDialogOpen(false);
      } catch (error) {
          console.error("Failed to save incident report", error);
          toast.error("Không thể lưu báo cáo sự cố.");
      } finally {
          setIsProcessing(false);
      }
  }, [user]);
  
  const handleSaveRevenue = useCallback(async (data: Omit<RevenueStats, 'id' | 'date' | 'createdAt' | 'createdBy' | 'isEdited'>, isEdited: boolean, id?: string) => {
    if(!user) return;
    setIsProcessing(true);
    try {
        await dataStore.addOrUpdateRevenueStats(data, user, isEdited, id);
        toast.success(`Đã ${id ? 'cập nhật' : 'tạo'} phiếu thống kê.`);
        setIsRevenueDialogOpen(false);
    } catch(error) {
        console.error("Failed to save revenue stats", error);
        toast.error("Không thể lưu thống kê doanh thu.");
    } finally {
        setIsProcessing(false);
    }
  }, [user]);

   const handleDeleteRevenue = async (id: string) => {
    setIsProcessing(true);
    try {
        await dataStore.deleteRevenueStats(id);
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

  const handleEditRevenue = (stats: RevenueStats) => {
      setRevenueStatsToEdit(stats);
      setIsRevenueDialogOpen(true);
  }

  const handleHandoverSubmit = (data: ExtractHandoverDataOutput & {imageDataUri: string}) => {
    setIsHandoverDialogOpen(false); // Close the input dialog
    
    const receiptData = data.handoverData;
    
    const revenueByCardFromApp = dailyRevenueStats.reduce((acc, stat) => {
        acc.techcombankVietQrPro += stat.revenueByPaymentMethod.techcombankVietQrPro || 0;
        acc.shopeeFood += stat.revenueByPaymentMethod.shopeeFood || 0;
        acc.grabFood += stat.revenueByPaymentMethod.grabFood || 0;
        acc.bankTransfer += stat.revenueByPaymentMethod.bankTransfer || 0;
        return acc;
    }, { techcombankVietQrPro: 0, shopeeFood: 0, grabFood: 0, bankTransfer: 0 });

    const appData = {
        expectedCash: expectedCashOnHand,
        startOfDayCash: startOfDayCash,
        cashExpense: totalCashExpense,
        cashRevenue: cashRevenue,
        deliveryPartnerPayout: totalDeliveryPayout,
        revenueByCard: revenueByCardFromApp,
    };
    
    const comparison = [
        { field: 'expectedCash', label: 'Tiền mặt dự kiến', appValue: appData.expectedCash, receiptValue: receiptData.expectedCash },
        { field: 'startOfDayCash', label: 'Tiền mặt đầu ca', appValue: appData.startOfDayCash, receiptValue: receiptData.startOfDayCash },
        { field: 'cashExpense', label: 'Chi tiền mặt', appValue: appData.cashExpense, receiptValue: receiptData.cashExpense },
        { field: 'cashRevenue', label: 'Doanh thu tiền mặt', appValue: appData.cashRevenue, receiptValue: receiptData.cashRevenue },
        { field: 'deliveryPartnerPayout', label: 'Trả ĐTGH', appValue: appData.deliveryPartnerPayout, receiptValue: receiptData.deliveryPartnerPayout },
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


  const getSlipContentName = (item: ExpenseItem): string => {
      if (item.itemId === 'other_cost') {
        if (item.name === 'Khác' && item.description) {
            return item.description;
        }
        return item.name;
    }
    return item.name;
  }

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
            <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                <Banknote />
                Báo cáo Thu ngân
            </h1>
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
            <Card>
                <CardHeader>
                    <CardTitle>Báo cáo Sự cố</CardTitle>
                    <CardDescription>Ghi nhận các sự cố làm hư hỏng, thất thoát tài sản.</CardDescription>
                </CardHeader>
                <CardContent>
                    {dailyIncidents.length > 0 && (
                        <div className="mb-4 space-y-2 text-sm">
                            {dailyIncidents.map(incident => (
                                <div key={incident.id} className="p-2 bg-muted rounded-md">
                                    <p className="font-medium">{incident.content}</p>
                                    <p className="text-xs text-muted-foreground">Chi phí: {incident.cost.toLocaleString('vi-VN')}đ</p>
                                </div>
                            ))}
                        </div>
                    )}
                    <Button variant="outline" className="w-full" onClick={() => setIsIncidentDialogOpen(true)}>
                        <AlertTriangle className="mr-2 h-4 w-4" />
                        Tạo Báo cáo Sự cố
                    </Button>
                </CardContent>
            </Card>
        </div>
        
        <div className="grid grid-cols-1 gap-6">
             <Card ref={revenueStatsRef}>
                <CardHeader>
                    <CardTitle>Thống kê Doanh thu</CardTitle>
                    <CardDescription>
                        Nhập số liệu từ bill tổng kết trên máy POS. Mỗi lần nhập sẽ tạo một phiếu riêng.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {dailyRevenueStats.length > 0 && (
                        <Table>
                            <TableHeader><TableRow><TableHead>Người tạo</TableHead><TableHead>Doanh thu Net</TableHead><TableHead className="text-right">Hành động</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {dailyRevenueStats.map(stat => {
                                    const canEdit = stat.createdBy.userId === user.uid;
                                    return (
                                        <TableRow key={stat.id}>
                                            <TableCell className="font-medium">{stat.createdBy.userName}</TableCell>
                                            <TableCell>{(stat.netRevenue || 0).toLocaleString('vi-VN')}đ</TableCell>
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
                    )}
                    <Button className="w-full" onClick={() => { setRevenueStatsToEdit(null); setIsRevenueDialogOpen(true); }}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Nhập Thống kê Doanh thu
                    </Button>
                </CardContent>
            </Card>

            <Card ref={expenseSlipsRef}>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Quản lý Phiếu chi</CardTitle>
                        <Button size="sm" onClick={() => { setSlipToEdit(null); setIsExpenseDialogOpen(true); }}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Tạo phiếu chi
                        </Button>
                    </div>
                    <CardDescription>Lịch sử các khoản chi trong ngày. Dữ liệu sẽ được làm mới vào ngày hôm sau.</CardDescription>
                </CardHeader>
                <CardContent>
                    {dailySlips.length > 0 ? (
                       <div className="overflow-x-auto">
                           <Table>
                               <TableHeader>
                                   <TableRow>
                                       <TableHead>Nội dung</TableHead>
                                       <TableHead>Tổng tiền</TableHead>
                                       <TableHead>Hình thức</TableHead>
                                       <TableHead>Người tạo</TableHead>
                                       <TableHead className="text-right">Hành động</TableHead>
                                   </TableRow>
                               </TableHeader>
                               <TableBody>
                                   {dailySlips.map(slip => {
                                      const canEdit = slip.createdBy.userId === user.uid;
                                      return (
                                       <TableRow key={slip.id}>
                                           <TableCell className="font-medium">
                                                {getSlipContentName(slip.items[0])}
                                                {slip.items.length > 1 && ` và ${slip.items.length - 1} mục khác`}
                                                <p className="text-xs text-muted-foreground font-normal">{slip.notes || 'Không có ghi chú'}</p>
                                           </TableCell>
                                           <TableCell>{slip.totalAmount.toLocaleString('vi-VN')}đ</TableCell>
                                           <TableCell>{slip.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}</TableCell>
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
                    ) : (
                         <p className="text-center text-sm text-muted-foreground py-8">Chưa có phiếu chi nào trong hôm nay.</p>
                    )}
                    {isProcessing && <div className="absolute inset-0 bg-white/70 dark:bg-black/70 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin"/></div>}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Bàn giao cuối ca</CardTitle>
                    {handoverReport ? (
                        <CardDescription>Ca hôm nay đã được bàn giao bởi <span className="font-semibold">{handoverReport.createdBy.userName}</span>.</CardDescription>
                    ) : (
                        <CardDescription>Thực hiện kiểm đếm và bàn giao tiền mặt cho ca sau hoặc quản lý.</CardDescription>
                    )}
                </CardHeader>
                <CardContent>
                    <Button className="w-full" onClick={() => setIsHandoverDialogOpen(true)} disabled={dailyRevenueStats.length === 0 || !!handoverReport}>
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
    />
    <RevenueStatsDialog
        open={isRevenueDialogOpen}
        onOpenChange={setIsRevenueDialogOpen}
        onSave={(data, isEdited) => handleSaveRevenue(data, isEdited, revenueStatsToEdit?.id)}
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
    </>
  );
}
