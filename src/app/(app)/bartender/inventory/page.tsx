
'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { ArrowLeft, Loader2, Send, Wand2, ShoppingCart, Info, ChevronsDownUp, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { generateInventoryOrderSuggestion } from '@/ai/flows/generate-inventory-order-suggestion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type ItemStatus = 'ok' | 'low' | 'out';

type CategorizedList = {
    category: string;
    items: InventoryItem[];
}[];

export default function InventoryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const suggestionsCardRef = useRef<HTMLDivElement>(null);

  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [report, setReport] = useState<InventoryReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<InventoryOrderSuggestion | null>(null);
  const [openCategories, setOpenCategories] = useState<string[]>([]);
  const [hasUnsubmittedChanges, setHasUnsubmittedChanges] = useState(false);


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

  // Set accordion to open all by default
  useEffect(() => {
      if (categorizedList.length > 0) {
          setOpenCategories(categorizedList.map(c => c.category));
      }
  }, [categorizedList]);


  useEffect(() => {
    if (!user || inventoryList.length === 0) return;

    const loadReport = async () => {
      setIsLoading(true);
      const todayReport = await dataStore.getOrCreateInventoryReport(user.uid, user.displayName || 'Nhân viên');
      setReport(todayReport);
      
      if (todayReport.suggestions) {
        setSuggestions(todayReport.suggestions);
      }
      setIsLoading(false);
    };

    loadReport();
  }, [user, inventoryList]);
  
  const handleLocalSave = useCallback(async (updatedReport: InventoryReport) => {
      await dataStore.saveLocalInventoryReport(updatedReport);
      setHasUnsubmittedChanges(true);
  }, []);

  const handleStockChange = (itemId: string, value: string) => {
    if (!report) return;
    
    // Determine if the value is purely numeric
    const isNumeric = value.trim() !== '' && !isNaN(Number(value));
    const stockValue = isNumeric ? Number(value) : value;

    const newReport = { ...report, stockLevels: { ...report.stockLevels, [itemId]: stockValue } };
    setReport(newReport);
    handleLocalSave(newReport);
  };
  
  const handleGenerateSuggestions = async () => {
      if(!report || !user) return;
      setIsGenerating(true);
      
      try {
        toast({
            title: "Đang phân tích tồn kho...",
            description: "AI đang tính toán các mặt hàng cần đặt. Vui lòng đợi trong giây lát."
        });

        // Filter for items that have been checked (stock level is not null/undefined/empty string)
        const itemsWithCurrentStock = inventoryList
            .filter(item => {
                const stock = report.stockLevels[item.id];
                return stock !== undefined && stock !== null && String(stock).trim() !== '';
            })
            .map(item => ({
                ...item,
                currentStock: report.stockLevels[item.id] as (string | number),
            }));

        if (itemsWithCurrentStock.length === 0) {
            toast({
                title: "Chưa có dữ liệu",
                description: "Vui lòng nhập số lượng tồn kho trước khi nhận đề xuất.",
                variant: "default"
            });
            setSuggestions({ summary: 'Chưa có mặt hàng nào được kiểm kê.', itemsToOrder: [] });
            setIsGenerating(false);
            return;
        }
        
        const result = await generateInventoryOrderSuggestion({
            items: itemsWithCurrentStock
        });
        
        setSuggestions(result);
        
        const updatedReport = { ...report, suggestions: result, lastUpdated: new Date().toISOString() };
        await dataStore.saveInventoryReport(updatedReport);
        setReport(updatedReport);

        toast({
            title: "Đã có đề xuất đặt hàng!",
            description: "Danh sách các mặt hàng cần đặt đã được tạo."
        });

        // Scroll to suggestions
        setTimeout(() => {
            suggestionsCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);


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
    const startTime = Date.now();
    setIsSubmitting(true);
     toast({
        title: "Đang gửi báo cáo tồn kho...",
    });

    try {
        const finalReport = { ...report, status: 'submitted' as const, submittedAt: new Date().toISOString() };
        await dataStore.saveInventoryReport(finalReport);
        setReport(finalReport);
        setHasUnsubmittedChanges(false);
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        toast({
            title: "Gửi báo cáo thành công!",
            description: `Báo cáo đã được lưu. (Thời gian: ${duration} giây). Đang tạo đề xuất...`
        });
        
        // After submitting, automatically generate suggestions
        await handleGenerateSuggestions();
        
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

      if (typeof currentStock !== 'number') {
        return 'ok';
      }

      if (currentStock <= 0) return 'out';
      if (currentStock < minStock) return 'low';
      return 'ok';
  }
  const getStatusColorClass = (status: ItemStatus) => {
      switch(status) {
          case 'low': return 'bg-yellow-100/50 dark:bg-yellow-900/30';
          case 'out': return 'bg-red-100/50 dark:bg-red-900/30';
          default: return 'bg-transparent';
      }
  }
  
  const handleToggleAll = () => {
    if (openCategories.length === categorizedList.length) {
      setOpenCategories([]);
    } else {
      setOpenCategories(categorizedList.map(c => c.category));
    }
  };

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
  const areAllCategoriesOpen = categorizedList.length > 0 && openCategories.length === categorizedList.length;

  return (
    <div className="container mx-auto p-4 sm:p-6 md:p-8 pb-32">
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
              <p className="text-muted-foreground">Nhập số lượng tồn kho thực tế. Mọi thay đổi sẽ được tự động lưu.</p>
            </div>
          </div>
      </header>
       {isSubmitted && report.submittedAt && (
            <Alert className="mb-8 border-green-500 text-green-700 bg-green-50">
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Báo cáo đã được gửi</AlertTitle>
                <AlertDescription>
                    Bạn đã gửi báo cáo này lúc {new Date(report.submittedAt as string).toLocaleTimeString('vi-VN')}. Bạn có thể gửi lại để cập nhật và nhận đề xuất mới.
                </AlertDescription>
            </Alert>
        )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2">
            <Card>
                <CardHeader className="flex-row items-center justify-between">
                    <div>
                        <CardTitle>Danh sách nguyên vật liệu</CardTitle>
                        <CardDescription>
                            Trạng thái sẽ tự động cập nhật khi bạn nhập số lượng tồn kho.
                        </CardDescription>
                    </div>
                    {categorizedList.length > 0 && (
                        <Button variant="outline" onClick={handleToggleAll} size="sm">
                            <ChevronsDownUp className="mr-2 h-4 w-4"/>
                            {areAllCategoriesOpen ? "Thu gọn" : "Mở rộng"}
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    <Accordion type="multiple" value={openCategories} onValueChange={setOpenCategories} className="w-full space-y-4">
                        {categorizedList.map(({ category, items }) => (
                            <AccordionItem value={category} key={category} className="border-2 rounded-lg border-primary/50">
                                <AccordionTrigger className="text-lg font-semibold flex-1 hover:no-underline p-4">
                                    {category}
                                </AccordionTrigger>
                                <AccordionContent className="p-4 border-t">
                                     {/* Mobile View: List of cards */}
                                    <div className="space-y-3 md:hidden">
                                        {items.map(item => {
                                            const status = getItemStatus(item.id, item.minStock);
                                            return (
                                                <div key={item.id} className={`rounded-lg border p-4 ${getStatusColorClass(status)}`}>
                                                    <p className="font-semibold">{item.name.split(' - ')[1] || item.name}</p>
                                                    <p className="text-sm text-muted-foreground mb-2">Đơn vị: {item.unit}</p>
                                                     <Input
                                                        type="text"
                                                        value={report.stockLevels[item.id] ?? ''}
                                                        onChange={e => handleStockChange(item.id, e.target.value)}
                                                        className="text-left"
                                                        placeholder="Nhập tồn thực tế..."
                                                        disabled={isSubmitting || isGenerating}
                                                    />
                                                </div>
                                            )
                                        })}
                                    </div>
                                    
                                     {/* Desktop View: Table */}
                                    <div className="overflow-x-auto hidden md:block">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="min-w-[250px]">Tên nguyên liệu</TableHead>
                                                    <TableHead>Đơn vị</TableHead>
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
                                                            <TableCell className="text-right">
                                                                <Input
                                                                    type="text"
                                                                    value={report.stockLevels[item.id] ?? ''}
                                                                    onChange={e => handleStockChange(item.id, e.target.value)}
                                                                    className="text-right"
                                                                    placeholder="Nhập..."
                                                                    disabled={isSubmitting || isGenerating}
                                                                />
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
        <div className="lg:col-span-1 space-y-8 sticky top-4" ref={suggestionsCardRef}>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ShoppingCart/> Đề xuất Đặt hàng</CardTitle>
                </CardHeader>
                <CardContent>
                    {(isSubmitting || isGenerating) && (
                        <div className="space-y-2 p-4 text-center">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground"/>
                            <p className="text-sm text-muted-foreground">AI đang phân tích...</p>
                        </div>
                    )}
                    {!(isSubmitting || isGenerating) && suggestions && suggestions.itemsToOrder.length > 0 && (
                        <div className="space-y-4">
                            <p className="text-sm font-semibold text-primary">{suggestions.summary}</p>
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
                                            <TableCell className="text-right font-bold">{item.quantityToOrder}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                    {!(isSubmitting || isGenerating) && suggestions && suggestions.itemsToOrder.length === 0 && (
                        <p className="text-center text-sm text-muted-foreground py-4">{suggestions.summary || 'Tất cả hàng hoá đã đủ. Không cần đặt thêm.'}</p>
                    )}
                    {!(isSubmitting || isGenerating) && !suggestions &&(
                        <div className="text-center space-y-4 py-4">
                            <p className="text-sm text-muted-foreground">Sau khi nhập xong tồn kho, nhấn nút bên dưới để gửi báo cáo và nhận đề xuất từ AI.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>
       <div className="fixed bottom-4 right-4 z-50 md:bottom-6 md:right-6">
        <div className="relative">
          <Button 
              size="lg"
              className="rounded-full shadow-lg h-16 w-auto px-6" 
              onClick={handleSubmit} 
              disabled={isSubmitting || isGenerating}
              aria-label="Gửi báo cáo và nhận đề xuất"
          >
              {(isSubmitting || isGenerating) ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              <span className="ml-2">{ (isSubmitting || isGenerating) ? 'Đang xử lý...' : 'Gửi & Nhận đề xuất'}</span>
          </Button>
          {hasUnsubmittedChanges && (
            <span className="absolute top-0 right-0 block h-3 w-3 rounded-full bg-red-500 ring-2 ring-background" />
          )}
        </div>
      </div>
    </div>
  );
}

    
