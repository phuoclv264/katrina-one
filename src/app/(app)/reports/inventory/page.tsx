
'use client';
import { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { dataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { InventoryItem, InventoryReport } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ShoppingCart, Users, CheckCircle, AlertCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type ItemStatus = 'ok' | 'low' | 'out';

type CategorizedList = {
    category: string;
    items: InventoryItem[];
}[];

function InventoryReportView() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const date = searchParams.get('date');

  const [reports, setReports] = useState<InventoryReport[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'Chủ nhà hàng')) {
      router.replace('/shifts');
      return;
    }

    if (authLoading || !user || !date) {
      setIsLoading(false);
      return;
    }
    
    let unsubscribeInventoryList: (() => void) | null = null;
    try {
        unsubscribeInventoryList = dataStore.subscribeToInventoryList((items) => {
            setInventoryList(items);
        });

        dataStore.getInventoryReportForDate(date).then(fetchedReports => {
            setReports(fetchedReports);
            if (fetchedReports.length > 0 && !selectedReportId) {
                setSelectedReportId(fetchedReports[0].id);
            }
            setIsLoading(false);
        });
    } catch (error) {
        console.error("Error loading inventory report data:", error);
        toast({
            title: "Lỗi tải dữ liệu",
            description: "Không thể tải báo cáo tồn kho. Đang chuyển hướng bạn về trang chính.",
            variant: "destructive",
        });
        router.replace('/reports');
    }

    return () => {
        if(unsubscribeInventoryList) unsubscribeInventoryList();
    }
  }, [date, selectedReportId, user, authLoading, router, toast]);
  
  const report = useMemo(() => {
    return reports.find(r => r.id === selectedReportId) || null;
  }, [reports, selectedReportId]);
  
  const categorizedList = useMemo((): CategorizedList => {
      if (!inventoryList) return [];
      
      const categoryOrder: string[] = [];
      const grouped: { [key: string]: InventoryItem[] } = {};

      inventoryList.forEach(item => {
          const category = item.name.includes(' - ') ? item.name.split(' - ')[0].trim().toUpperCase() : 'CHƯA PHÂN LOẠI';
          if (!grouped[category]) {
              grouped[category] = [];
              categoryOrder.push(category);
          }
          grouped[category].push(item);
      });
      
      return categoryOrder.map(category => ({ category, items: grouped[category] }));

  }, [inventoryList]);

  const getItemStatus = (itemId: string, minStock: number): ItemStatus => {
    const currentStock = report?.stockLevels[itemId];
    if (currentStock === undefined || currentStock === null) return 'ok';
    if (currentStock <= 0) return 'out';
    if (currentStock < minStock) return 'low';
    return 'ok';
  };

  const getStatusColorClass = (status: ItemStatus) => {
    switch (status) {
      case 'low': return 'bg-yellow-100/50 dark:bg-yellow-900/30';
      case 'out': return 'bg-red-100/50 dark:bg-red-900/30';
      default: return 'bg-transparent';
    }
  };

  if (isLoading || authLoading) {
    return (
      <div className="container mx-auto p-4 sm:p-6 md:p-8">
        <header className="mb-8">
            <Skeleton className="h-8 w-48 mb-4" />
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-5 w-1/2 mt-2" />
        </header>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!date || reports.length === 0) {
    return (
        <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">
            <h1 className="text-2xl font-bold">Không tìm thấy báo cáo.</h1>
            <p className="text-muted-foreground">Không có báo cáo kiểm kê nào được nộp vào ngày đã chọn.</p>
             <Button asChild variant="link" className="mt-4 -ml-4">
                <Link href="/reports">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Quay lại tất cả báo cáo
                </Link>
            </Button>
        </div>
    );
  }
  
  return (
    <div className="container mx-auto p-4 sm:p-6 md:p-8">
       <header className="mb-8">
          <Button asChild variant="ghost" className="-ml-4 mb-4">
              <Link href="/reports">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Quay lại
              </Link>
          </Button>
          <div className="flex flex-col md:flex-row gap-4 justify-between md:items-start">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold font-headline">Báo cáo Kiểm kê Tồn kho</h1>
              <p className="text-muted-foreground">Ngày {new Date(date).toLocaleDateString('vi-VN')}</p>
            </div>
            <Card className="w-full md:w-auto md:min-w-[250px]">
                <CardHeader className="p-3">
                     <CardTitle className="text-sm font-medium flex items-center gap-2"><Users className="h-4 w-4"/>Chọn nhân viên</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                    <Select onValueChange={setSelectedReportId} value={selectedReportId || ''}>
                        <SelectTrigger>
                            <SelectValue placeholder="Chọn một nhân viên..." />
                        </SelectTrigger>
                        <SelectContent>
                            {reports.map(r => (
                                <SelectItem key={r.id} value={r.id}>{r.staffName}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>
          </div>
      </header>

       {!report ? (
        <div className="text-center py-16 text-muted-foreground">
            <p>Vui lòng chọn một nhân viên để xem báo cáo.</p>
        </div>
    ) : (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2">
            <Card>
                <CardHeader>
                    <CardTitle>Chi tiết Tồn kho</CardTitle>
                    <CardDescription>
                        Báo cáo từ <span className="font-semibold">{report.staffName}</span>, nộp lúc <span className="font-semibold">{new Date(report.submittedAt as string).toLocaleString('vi-VN')}</span>.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Accordion type="multiple" defaultValue={categorizedList.map(c => c.category)} className="w-full space-y-4">
                         {categorizedList.map(({ category, items }) => (
                            <AccordionItem value={category} key={category} className="border-2 rounded-lg border-primary/50">
                                <AccordionTrigger className="text-lg font-semibold flex-1 hover:no-underline p-4">
                                    {category}
                                </AccordionTrigger>
                                <AccordionContent className="p-4 border-t">
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="min-w-[250px]">Tên nguyên liệu</TableHead>
                                                    <TableHead>Đơn vị</TableHead>
                                                    <TableHead>Tồn tối thiểu</TableHead>
                                                    <TableHead className="text-right w-[150px]">Tồn thực tế</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {items.map(item => {
                                                    const status = getItemStatus(item.id, item.minStock);
                                                    return (
                                                        <TableRow key={item.id} className={getStatusColorClass(status)}>
                                                            <TableCell className="font-medium">{item.name.split(' - ')[1] || item.name}</TableCell>
                                                            <TableCell>{item.unit}</TableCell>
                                                            <TableCell>{item.minStock}</TableCell>
                                                            <TableCell className="text-right font-medium">
                                                                {report.stockLevels[item.id] ?? 'N/A'}
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-1 space-y-8">
            <Card className="sticky top-4">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ShoppingCart/> Đề xuất Đặt hàng của AI</CardTitle>
                </CardHeader>
                <CardContent>
                    {report.suggestions && report.suggestions.itemsToOrder.length > 0 && (
                        <div className="space-y-4">
                            <p className="text-sm font-semibold text-primary">{report.suggestions.summary}</p>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Mặt hàng</TableHead>
                                        <TableHead className="text-right">Số lượng</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {report.suggestions.itemsToOrder.map((item) => (
                                        <TableRow key={item.itemId}>
                                            <TableCell className="font-medium">{inventoryList.find(i => i.id === item.itemId)?.name || 'Không rõ'}</TableCell>
                                            <TableCell className="text-right font-bold">{item.quantityToOrder}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                    {report.suggestions && report.suggestions.itemsToOrder.length === 0 && (
                         <div className="flex items-center justify-center text-center text-sm text-muted-foreground py-4 gap-2">
                            <CheckCircle className="text-green-500 h-4 w-4"/>
                            <p>Tất cả hàng hoá đã đủ.</p>
                        </div>
                    )}
                    {!report.suggestions && (
                         <div className="flex items-center justify-center text-center text-sm text-muted-foreground py-4 gap-2">
                           <AlertCircle className="text-yellow-500 h-4 w-4" />
                           <p>Không có đề xuất nào được tạo.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>
    )}
    </div>
  );
}


export default function InventoryReportPage() {
    return (
        <Suspense fallback={<div>Đang tải...</div>}>
            <InventoryReportView />
        </Suspense>
    )
}
