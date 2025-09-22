

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, ArrowRight, Upload, Receipt, AlertTriangle, FileBox, Banknote, Edit, Trash2, Loader2, DollarSign, ArrowUpCircle, ArrowDownCircle, Edit2, Wallet } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ExpenseSlip, HandoverReport, IncidentReport, RevenueStats, ManagedUser, InventoryItem, ExpenseItem, OtherCostCategory } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, } from '@/components/ui/alert-dialog';
import ExpenseSlipDialog from './_components/expense-slip-dialog';
import IncidentReportDialog from './_components/incident-report-dialog';
import RevenueStatsDialog from './_components/revenue-stats-dialog';
import HandoverDialog from './_components/handover-dialog';
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
                    <Edit2 className="h-4 w-4" />
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

  const [dailySlips, setDailySlips] = useState<ExpenseSlip[]>([]);
  const [dailyIncidents, setDailyIncidents] = useState<IncidentReport[]>([]);
  const [revenueStats, setRevenueStats] = useState<RevenueStats | null>(null);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [otherCostCategories, setOtherCostCategories] = useState<OtherCostCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [startOfDayCash, setStartOfDayCash] = useState(1_500_000);

  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isIncidentDialogOpen, setIsIncidentDialogOpen] = useState(false);
  const [isRevenueDialogOpen, setIsRevenueDialogOpen] = useState(false);
  const [isHandoverDialogOpen, setIsHandoverDialogOpen] = useState(false);

  const [slipToEdit, setSlipToEdit] = useState<ExpenseSlip | null>(null);

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
        const unsubRevenue = dataStore.subscribeToRevenueStats(date, setRevenueStats);
        const unsubInventory = dataStore.subscribeToInventoryList(setInventoryList);
        const unsubOtherCostCategories = dataStore.subscribeToOtherCostCategories(setOtherCostCategories);

        // Fetch initial data to set loading state correctly
        const fetchInitialData = async () => {
            try {
                const [slips, incidents, revenue, inventory, costCategories] = await Promise.all([
                    dataStore.getDailyExpenseSlips(date),
                    dataStore.subscribeToAllIncidents((all) => setDailyIncidents(all.filter(i => i.date === date))),
                    dataStore.getRevenueStats(date),
                    dataStore.getInventoryList(),
                    dataStore.getOtherCostCategories(),
                ]);
            } catch (error) {
                console.error("Failed to fetch initial cashier data:", error);
                toast.error("Không thể tải dữ liệu ban đầu.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialData();
        
        return () => {
            unsubSlips();
            unsubIncidents(() => {});
            unsubRevenue();
            unsubInventory();
            unsubOtherCostCategories();
        };
    }
  }, [user]);

  const { totalCashExpense, totalBankExpense, cashRevenue, expectedCashOnHand } = useMemo(() => {
    const { totalCashExpense, totalBankExpense } = dailySlips.reduce((acc, slip) => {
      if (slip.paymentMethod === 'cash') {
        acc.totalCashExpense += slip.totalAmount;
      } else if (slip.paymentMethod === 'bank_transfer') {
        acc.totalBankExpense += slip.totalAmount;
      }
      return acc;
    }, { totalCashExpense: 0, totalBankExpense: 0 });

    const cashRevenue = revenueStats?.revenueByPaymentMethod.cash || 0;
    const expectedCashOnHand = cashRevenue - totalCashExpense + startOfDayCash;

    return { totalCashExpense, totalBankExpense, cashRevenue, expectedCashOnHand };
  }, [dailySlips, revenueStats, startOfDayCash]);

  const handleSaveSlip = useCallback(async (data: any, id?: string) => {
    if (!user) return;
    setIsProcessing(true);
    try {
        const slipData = { ...data, createdBy: { userId: user.uid, userName: user.displayName }};
        await dataStore.addOrUpdateExpenseSlip(slipData, id);
        toast.success(`Đã ${id ? 'cập nhật' : 'tạo'} phiếu chi.`);
        setIsExpenseDialogOpen(false);
    } catch (error) {
        console.error("Failed to save expense slip", error);
        toast.error("Không thể lưu phiếu chi.");
    } finally {
        setIsProcessing(false);
    }
  }, [user]);
  
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
  
  const handleSaveRevenue = useCallback(async (data: Omit<RevenueStats, 'id' | 'date' | 'createdAt' | 'createdBy' | 'isEdited'>, isEdited: boolean) => {
    if(!user) return;
    setIsProcessing(true);
    try {
        await dataStore.addOrUpdateRevenueStats(data, user, isEdited);
        toast.success("Đã cập nhật doanh thu.");
        setIsRevenueDialogOpen(false);
    } catch(error) {
        console.error("Failed to save revenue stats", error);
        toast.error("Không thể lưu doanh thu.");
    } finally {
        setIsProcessing(false);
    }
  }, [user]);
  
  const handleEditClick = (slip: ExpenseSlip) => {
      setSlipToEdit(slip);
      setIsExpenseDialogOpen(true);
  }

    const handleSaveHandover = async (data: Partial<HandoverReport>) => {
        if (!user) return;
        setIsProcessing(true);
        try {
            await dataStore.addHandoverReport(data, user);
            // On success, the dialog handles its own 'success' step.
            // No need to close it from here.
            toast.success("Đã gửi báo cáo bàn giao thành công!");
        } catch (error) {
            console.error("Failed to save handover report:", error);
            toast.error("Không thể lưu báo cáo bàn giao.");
            // Don't close the dialog on error, let user retry.
        } finally {
            setIsProcessing(false);
        }
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
             <Card>
                <CardHeader>
                    <CardTitle>Thống kê Doanh thu</CardTitle>
                    <CardDescription>
                        Nhập số liệu từ bill tổng kết trên máy POS.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button className="w-full" onClick={() => setIsRevenueDialogOpen(true)}>
                        <Receipt className="mr-2 h-4 w-4" />
                        {revenueStats ? 'Cập nhật' : 'Nhập'} Doanh thu
                    </Button>
                </CardContent>
            </Card>

            <Card>
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
                                       <TableHead className="text-right">Hành động</TableHead>
                                   </TableRow>
                               </TableHeader>
                               <TableBody>
                                   {dailySlips.map(slip => (
                                       <TableRow key={slip.id}>
                                           <TableCell className="font-medium">
                                                {getSlipContentName(slip.items[0])}
                                                {slip.items.length > 1 && ` và ${slip.items.length - 1} mục khác`}
                                                <p className="text-xs text-muted-foreground font-normal">{slip.notes || 'Không có ghi chú'}</p>
                                           </TableCell>
                                           <TableCell>{slip.totalAmount.toLocaleString('vi-VN')}đ</TableCell>
                                           <TableCell>{slip.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}</TableCell>
                                           <TableCell className="text-right">
                                               <Button variant="ghost" size="icon" onClick={() => handleEditClick(slip)} disabled={isProcessing}>
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
                                           </TableCell>
                                       </TableRow>
                                   ))}
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
                    <CardDescription>Thực hiện kiểm đếm và bàn giao tiền mặt cho ca sau hoặc quản lý.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button className="w-full" onClick={() => setIsHandoverDialogOpen(true)}>
                        <ArrowRight className="mr-2 h-4 w-4" />
                        Thực hiện bàn giao
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
        onSave={handleSaveRevenue}
        isProcessing={isProcessing}
        existingStats={revenueStats}
    />
    <HandoverDialog
        open={isHandoverDialogOpen}
        onOpenChange={setIsHandoverDialogOpen}
        onSave={handleSaveHandover}
        isProcessing={isProcessing}
        reporter={user}
        dailyCashExpense={totalCashExpense}
        dailyCardExpense={totalBankExpense}
        dailyRevenueStats={revenueStats}
        startOfDayCash={startOfDayCash}
    />
    </>
  );
}

