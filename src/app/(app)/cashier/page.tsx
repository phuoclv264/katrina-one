
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, ArrowRight, Upload, Receipt, AlertTriangle, FileBox, Banknote, Edit, Trash2, Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ExpenseSlip, HandoverReport, IncidentReport, RevenueStats, ManagedUser } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import ExpenseSlipDialog from './_components/expense-slip-dialog';
import IncidentReportDialog from './_components/incident-report-dialog';
import RevenueStatsDialog from './_components/revenue-stats-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, } from '@/components/ui/alert-dialog';


export default function CashierDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [dailySlips, setDailySlips] = useState<ExpenseSlip[]>([]);
  const [revenueStats, setRevenueStats] = useState<RevenueStats | null>(null);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isIncidentDialogOpen, setIsIncidentDialogOpen] = useState(false);
  const [isRevenueDialogOpen, setIsRevenueDialogOpen] = useState(false);

  const [slipToEdit, setSlipToEdit] = useState<ExpenseSlip | null>(null);


  useEffect(() => {
    if (!authLoading && user && user.role !== 'Thu ngân' && !user.secondaryRoles?.includes('Thu ngân')) {
      router.replace('/');
    }
  }, [user, authLoading, router]);
  
  useEffect(() => {
      if (user) {
          const date = format(new Date(), 'yyyy-MM-dd');
          const unsubSlips = dataStore.subscribeToDailyExpenseSlips(date, setDailySlips);
          const unsubSuppliers = dataStore.subscribeToSuppliers(setSuppliers);
          const unsubRevenue = dataStore.subscribeToRevenueStats(date, setRevenueStats);
          
          Promise.all([
              dataStore.getDailyExpenseSlips(date),
              dataStore.getSuppliers(),
              dataStore.getRevenueStats(date),
          ]).then(([slips, supplierList, revenue]) => {
              setDailySlips(slips);
              setSuppliers(supplierList);
              setRevenueStats(revenue);
              setIsLoading(false);
          });
          
          return () => {
              unsubSlips();
              unsubSuppliers();
              unsubRevenue();
          };
      }
  }, [user]);

  const { totalCashExpense, totalBankExpense } = useMemo(() => {
    return dailySlips.reduce((acc, slip) => {
      if (slip.paymentMethod === 'cash') {
        acc.totalCashExpense += slip.amount;
      } else if (slip.paymentMethod === 'bank_transfer') {
        acc.totalBankExpense += slip.amount;
      }
      return acc;
    }, { totalCashExpense: 0, totalBankExpense: 0 });
  }, [dailySlips]);

  const handleSaveSlip = async (data: any, id?: string) => {
    if (!user) return;
    setIsProcessing(true);
    try {
        const slipData = { ...data, createdBy: { userId: user.uid, userName: user.displayName }};
        await dataStore.addOrUpdateExpenseSlip(slipData, id);
        toast({ title: "Thành công", description: `Đã ${id ? 'cập nhật' : 'tạo'} phiếu chi.` });
        setIsExpenseDialogOpen(false);
    } catch (error) {
        console.error("Failed to save expense slip", error);
        toast({ title: "Lỗi", description: "Không thể lưu phiếu chi.", variant: "destructive" });
    } finally {
        setIsProcessing(false);
    }
  }
  
  const handleDeleteSlip = async (slipId: string) => {
    setIsProcessing(true);
    try {
        await dataStore.deleteExpenseSlip(slipId);
        toast({ title: "Đã xóa", description: "Phiếu chi đã được xóa." });
    } catch(error) {
        console.error("Failed to delete expense slip", error);
        toast({ title: "Lỗi", description: "Không thể xóa phiếu chi.", variant: "destructive" });
    } finally {
        setIsProcessing(false);
    }
  }

  const handleSaveIncident = async (data: Omit<IncidentReport, 'id' | 'createdAt' | 'createdBy' | 'date'>) => {
      if (!user) return;
      setIsProcessing(true);
      try {
          await dataStore.addIncidentReport(data, user);
          toast({ title: "Thành công", description: "Đã ghi nhận sự cố." });
          if(data.cost > 0) {
              toast({ title: "Thông báo", description: "Một phiếu chi tương ứng đã được tạo tự động." });
          }
          setIsIncidentDialogOpen(false);
      } catch (error) {
          console.error("Failed to save incident report", error);
          toast({ title: "Lỗi", description: "Không thể lưu báo cáo sự cố.", variant: "destructive" });
      } finally {
          setIsProcessing(false);
      }
  }
  
  const handleSaveRevenue = async (data: Omit<RevenueStats, 'id' | 'date' | 'createdAt' | 'createdBy' | 'isEdited'>, isEdited: boolean) => {
    if(!user) return;
    setIsProcessing(true);
    try {
        await dataStore.addOrUpdateRevenueStats(data, user, isEdited);
        toast({ title: "Thành công", description: "Đã cập nhật doanh thu." });
        setIsRevenueDialogOpen(false);
    } catch(error) {
        console.error("Failed to save revenue stats", error);
        toast({ title: "Lỗi", description: "Không thể lưu doanh thu.", variant: "destructive" });
    } finally {
        setIsProcessing(false);
    }
  }
  
  const handleEditClick = (slip: ExpenseSlip) => {
      setSlipToEdit(slip);
      setIsExpenseDialogOpen(true);
  }

  if (authLoading || isLoading || !user) {
    return (
      <div className="container mx-auto p-4 sm:p-6 md:p-8">
        <header className="mb-8">
            <Skeleton className="h-10 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
        </header>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
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
                Bảng điều khiển Thu ngân
            </h1>
            <p className="text-muted-foreground mt-2">
                Quản lý chi tiêu, bàn giao và các báo cáo tài chính trong ngày.
            </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
            {/* Summary Cards */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tổng chi tiền mặt</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalCashExpense.toLocaleString('vi-VN')}đ</div>
                    <p className="text-xs text-muted-foreground">trong hôm nay</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tổng chi chuyển khoản</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalBankExpense.toLocaleString('vi-VN')}đ</div>
                    <p className="text-xs text-muted-foreground">trong hôm nay</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Doanh thu (POS)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{(revenueStats?.netRevenue || 0).toLocaleString('vi-VN')}đ</div>
                    <p className="text-xs text-muted-foreground">{revenueStats ? `Cập nhật lúc ${format(new Date(revenueStats.createdAt as string), 'HH:mm')}` : 'Chưa nhập liệu'}</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tiền mặt thực tế</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">Chưa khớp</div>
                     <p className="text-xs text-muted-foreground">Cần thực hiện bàn giao</p>
                </CardContent>
            </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
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
                                           <TableHead>Số tiền</TableHead>
                                           <TableHead>Hình thức</TableHead>
                                           <TableHead className="text-right">Hành động</TableHead>
                                       </TableRow>
                                   </TableHeader>
                                   <TableBody>
                                       {dailySlips.map(slip => (
                                           <TableRow key={slip.id}>
                                               <TableCell className="font-medium">
                                                   {slip.type === 'goods_import' ? `Nhập hàng: ${slip.itemName}` : `Chi phí: ${slip.otherCostCategory}`}
                                                    <p className="text-xs text-muted-foreground font-normal">{slip.notes}</p>
                                               </TableCell>
                                               <TableCell>{slip.amount.toLocaleString('vi-VN')}đ</TableCell>
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
                                                                <AlertDialogDescription>Hành động này không thể được hoàn tác.</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteSlip(slip.id)}>Xóa</AlertDialogAction>
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
            </div>

            <div className="space-y-6">
                 <Card className="bg-primary/5 text-primary-foreground border-primary/20 shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-primary">Thống kê Doanh thu</CardTitle>
                        <CardDescription className="text-primary/80">Nhập số liệu từ bill tổng kết trên máy POS.</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <Button variant="outline" className="w-full bg-background/80 text-primary hover:bg-background" onClick={() => setIsRevenueDialogOpen(true)}>
                            <Receipt className="mr-2 h-4 w-4" />
                            {revenueStats ? 'Cập nhật' : 'Nhập'} Doanh thu
                        </Button>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Phiếu bàn giao cuối ngày</CardTitle>
                        <CardDescription>Đối soát và bàn giao tiền mặt cuối ngày.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Button className="w-full">
                            <ArrowRight className="mr-2 h-4 w-4" />
                            Thực hiện bàn giao
                        </Button>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>Báo cáo Sự cố</CardTitle>
                        <CardDescription>Ghi nhận các sự cố làm hư hỏng, thất thoát tài sản hoặc nguyên vật liệu.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button variant="outline" className="w-full" onClick={() => setIsIncidentDialogOpen(true)}>
                            <AlertTriangle className="mr-2 h-4 w-4" />
                            Tạo Báo cáo Sự cố
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
    {user && (
        <>
            <ExpenseSlipDialog
                open={isExpenseDialogOpen}
                onOpenChange={setIsExpenseDialogOpen}
                onSave={handleSaveSlip}
                isProcessing={isProcessing}
                slipToEdit={slipToEdit}
                suppliers={suppliers}
                onSuppliersChange={setSuppliers}
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
        </>
    )}
    </>
  );
}
