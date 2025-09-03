
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { InventoryItem, InventoryReport, InventoryOrderSuggestion } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Send, Wand2, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { generateInventoryOrderSuggestion } from '@/ai/flows/generate-inventory-order-suggestion';

type ItemStatus = 'ok' | 'low' | 'out';

export default function InventoryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [report, setReport] = useState<InventoryReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<InventoryOrderSuggestion | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'Pha chế')) {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const unsubscribe = dataStore.subscribeToInventoryList((items) => {
      setInventoryList(items);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || inventoryList.length === 0) return;

    const loadReport = async () => {
      setIsLoading(true);
      const todayReport = await dataStore.getOrCreateInventoryReport(user.uid, user.displayName || 'Nhân viên');
      setReport(todayReport);
      
      // If there are suggestions in the loaded report, display them
      if (todayReport.suggestions) {
        setSuggestions(todayReport.suggestions);
      }
      setIsLoading(false);
    };

    loadReport();
  }, [user, inventoryList]);

  const handleStockChange = (itemId: string, currentStock: number) => {
    if (!report) return;

    setReport(prev => {
      if (!prev) return null;
      const newStockLevels = { ...prev.stockLevels, [itemId]: currentStock };
      return { ...prev, stockLevels: newStockLevels };
    });
  };
  
  const handleSaveAndGenerate = async () => {
      if(!report || !user) return;
      setIsGenerating(true);
      
      try {
        await dataStore.saveInventoryReport(report);
        
        toast({
            title: "Đang phân tích tồn kho...",
            description: "AI đang tính toán các mặt hàng cần đặt. Vui lòng đợi trong giây lát."
        });

        const itemsWithCurrentStock = inventoryList.map(item => ({
            ...item,
            currentStock: report.stockLevels[item.id] ?? 0,
        }));
        
        const result = await generateInventoryOrderSuggestion({
            items: itemsWithCurrentStock
        });
        
        setSuggestions(result);
        
        // Save suggestions to the report
        const updatedReport = { ...report, suggestions: result, lastUpdated: new Date().toISOString() };
        await dataStore.saveInventoryReport(updatedReport);
        setReport(updatedReport);

        toast({
            title: "Đã có đề xuất đặt hàng!",
            description: "Danh sách các mặt hàng cần đặt đã được tạo."
        });

      } catch (error) {
          console.error("Error generating suggestions:", error);
          toast({
              title: "Lỗi",
              description: "Không thể tạo đề xuất đặt hàng. Vui lòng thử lại.",
              variant: "destructive"
          });
      } finally {
          setIsGenerating(false);
      }
  }

  const handleSubmit = async () => {
    if (!report || !user) return;
    setIsSubmitting(true);
     toast({
        title: "Đang gửi báo cáo tồn kho...",
    });

    try {
        const finalReport = { ...report, status: 'submitted' as const, submittedAt: new Date().toISOString() };
        await dataStore.saveInventoryReport(finalReport);
        setReport(finalReport);
        toast({
            title: "Gửi báo cáo thành công!",
            description: "Báo cáo kiểm kê tồn kho đã được lưu lại."
        });
        
    } catch (error) {
         console.error("Error submitting inventory report:", error);
         toast({
              title: "Lỗi",
              description: "Không thể gửi báo cáo. Vui lòng thử lại.",
              variant: "destructive"
          });
    } finally {
        setIsSubmitting(false);
    }
  }
  
  const getItemStatus = (itemId: string, minStock: number): ItemStatus => {
      const currentStock = report?.stockLevels[itemId];
      if (currentStock === undefined || currentStock === null) return 'ok';
      if (currentStock <= 0) return 'out';
      if (currentStock < minStock) return 'low';
      return 'ok';
  }
  const getStatusColorClass = (status: ItemStatus) => {
      switch(status) {
          case 'low': return 'bg-yellow-100/50';
          case 'out': return 'bg-red-100/50';
          default: return 'bg-transparent';
      }
  }

  if (isLoading || authLoading || !report) {
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

  const isSubmitted = report.status === 'submitted';

  return (
    <div className="container mx-auto p-4 sm:p-6 md:p-8">
       <header className="mb-8">
          <Button asChild variant="ghost" className="-ml-4 mb-4">
              <Link href="/bartender">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Quay lại
              </Link>
          </Button>
          <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center">
            <div>
              <h1 className="text-3xl font-bold font-headline">Báo cáo Kiểm kê Tồn kho</h1>
              <p className="text-muted-foreground">Nhập số lượng tồn kho thực tế của các mặt hàng.</p>
            </div>
            <Button onClick={handleSaveAndGenerate} disabled={isGenerating || isSubmitted}>
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Wand2 className="mr-2 h-4 w-4"/>}
                Lưu & Tạo đề xuất đặt hàng
            </Button>
          </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2">
            <Card>
                <CardHeader>
                    <CardTitle>Danh sách nguyên vật liệu</CardTitle>
                    <CardDescription>
                        Trạng thái sẽ tự động cập nhật khi bạn nhập số lượng tồn kho.
                    </CardDescription>
                </CardHeader>
                <CardContent>
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
                                {inventoryList.map(item => {
                                    const status = getItemStatus(item.id, item.minStock);
                                    return (
                                        <TableRow key={item.id} className={getStatusColorClass(status)}>
                                            <TableCell className="font-medium">{item.name}</TableCell>
                                            <TableCell>{item.unit}</TableCell>
                                            <TableCell>{item.minStock}</TableCell>
                                            <TableCell className="text-right">
                                                <Input
                                                type="number"
                                                value={report.stockLevels[item.id] ?? ''}
                                                onChange={e => handleStockChange(item.id, parseFloat(e.target.value) || 0)}
                                                className="text-right"
                                                placeholder="Nhập..."
                                                disabled={isSubmitted}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-1 space-y-8">
            <Card className="sticky top-4">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ShoppingCart/> Đề xuất Đặt hàng</CardTitle>
                    <CardDescription>
                        Dựa trên tồn kho bạn đã nhập, AI đề xuất các mặt hàng cần đặt thêm.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isGenerating && (
                        <div className="space-y-2">
                            <Skeleton className="h-6 w-full"/>
                            <Skeleton className="h-6 w-3/4"/>
                            <Skeleton className="h-6 w-full"/>
                        </div>
                    )}
                    {!isGenerating && suggestions && suggestions.itemsToOrder.length > 0 && (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">{suggestions.summary}</p>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Mặt hàng</TableHead>
                                        <TableHead className="text-right">Số lượng</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {suggestions.itemsToOrder.map((item) => (
                                        <TableRow key={item.itemId}>
                                            <TableCell className="font-medium">{inventoryList.find(i => i.id === item.itemId)?.name || 'Không rõ'}</TableCell>
                                            <TableCell className="text-right font-bold">{item.quantityToOrder} {inventoryList.find(i => i.id === item.itemId)?.unit}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                    {!isGenerating && suggestions && suggestions.itemsToOrder.length === 0 && (
                        <p className="text-center text-sm text-muted-foreground py-4">Tất cả hàng hoá đã đủ. Không cần đặt thêm.</p>
                    )}
                    {!isGenerating && !suggestions && (
                        <p className="text-center text-sm text-muted-foreground py-4">Nhấn nút "Lưu & Tạo đề xuất" để nhận danh sách đặt hàng từ AI.</p>
                    )}
                </CardContent>
            </Card>
            <Card className="border-green-500/50">
                <CardHeader>
                    <CardTitle>Gửi Báo cáo</CardTitle>
                    <CardDescription>Sau khi kiểm tra, hãy gửi báo cáo để lưu lại.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button className="w-full" size="lg" onClick={handleSubmit} disabled={isSubmitting || isSubmitted}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                        {isSubmitted ? 'Đã gửi' : 'Gửi báo cáo'}
                    </Button>
                    {isSubmitted && (
                         <p className="text-xs text-muted-foreground mt-2 text-center">Báo cáo cho ngày hôm nay đã được gửi.</p>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
