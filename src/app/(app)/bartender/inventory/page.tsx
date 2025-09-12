
'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { InventoryItem, InventoryReport, InventoryOrderSuggestion, InventoryStockRecord } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Send, Wand2, ShoppingCart, Info, ChevronsDownUp, CheckCircle, Copy, Star, Camera, X, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { generateInventoryOrderSuggestion } from '@/ai/flows/generate-inventory-order-suggestion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import CameraDialog from '@/components/camera-dialog';
import { photoStore } from '@/lib/photo-store';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';

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
  const inputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const itemRowRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [report, setReport] = useState<InventoryReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<InventoryOrderSuggestion | null>(null);
  const [openCategories, setOpenCategories] = useState<string[]>([]);
  const [hasUnsubmittedChanges, setHasUnsubmittedChanges] = useState(false);
  
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [localPhotoUrls, setLocalPhotoUrls] = useState<Map<string, string>>(new Map());

  // --- Back button handling for Dialogs ---
  useEffect(() => {
    const handler = (e: PopStateEvent) => {
      if (isCameraOpen) {
        e.preventDefault();
        setIsCameraOpen(false);
      }
    };

    if (isCameraOpen) {
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', handler);
    }

    return () => {
      window.removeEventListener('popstate', handler);
    };
  }, [isCameraOpen]);


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
          const category = item.category || 'CHƯA PHÂN LOẠI';
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
  
  const fetchLocalPhotos = useCallback(async (currentReport: InventoryReport | null) => {
    if (!currentReport) return;
    const allPhotoIds = new Set<string>();
    for (const itemId in currentReport.stockLevels) {
        const record = currentReport.stockLevels[itemId];
        if (record.photoIds) {
            record.photoIds.forEach(id => allPhotoIds.add(id));
        }
    }
    if (allPhotoIds.size > 0) {
        const urls = await photoStore.getPhotosAsUrls(Array.from(allPhotoIds));
        setLocalPhotoUrls(urls);
    } else {
        setLocalPhotoUrls(new Map());
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const loadReport = async () => {
      setIsLoading(true);
      const { report: loadedReport, isLocal } = await dataStore.getOrCreateInventoryReport(user.uid, user.displayName || 'Nhân viên');
      setReport(loadedReport);
      await fetchLocalPhotos(loadedReport);
      
      if (isLocal) {
          setHasUnsubmittedChanges(true);
      }
      
      if (loadedReport.suggestions) {
        setSuggestions(loadedReport.suggestions);
      }
      setIsLoading(false);
    };

    loadReport();
  }, [user, fetchLocalPhotos]);
  
  const handleLocalSave = useCallback(async (updatedReport: InventoryReport) => {
      await dataStore.saveLocalInventoryReport(updatedReport);
      setHasUnsubmittedChanges(true);
      await fetchLocalPhotos(updatedReport);
  }, [fetchLocalPhotos]);

  const handleStockChange = (itemId: string, value: string) => {
    if (!report) return;
    
    const isNumeric = value.trim() !== '' && !isNaN(Number(value));
    const stockValue = isNumeric ? Number(value) : value;

    const newReport = JSON.parse(JSON.stringify(report));
    const existingRecord = newReport.stockLevels[itemId] || {};
    newReport.stockLevels[itemId] = { ...existingRecord, stock: stockValue };

    setReport(newReport);
    handleLocalSave(newReport);
  };
  
  const handleCapturePhotos = useCallback(async (photoIds: string[]) => {
    if (!activeItemId || !report || photoIds.length === 0) return;
    
    const newPhotoId = photoIds[0]; // We only care about the latest photo

    const newReport = { ...report, stockLevels: { ...report.stockLevels } };
    const record = newReport.stockLevels[activeItemId] || { stock: '' };
    
    // --- New Logic: Delete old photo from IndexedDB before replacing ID ---
    if (record.photoIds && record.photoIds.length > 0) {
      const oldPhotoId = record.photoIds[0];
      if (oldPhotoId) {
        await photoStore.deletePhoto(oldPhotoId);
      }
    }
    // --- End New Logic ---
    
    // Replace old photoId with the new one
    record.photoIds = [newPhotoId]; 
    newReport.stockLevels[activeItemId] = record;

    setReport(newReport);
    await handleLocalSave(newReport);

    setIsCameraOpen(false);
    setActiveItemId(null);
  }, [activeItemId, report, handleLocalSave]);


    const handleDeletePhoto = async (itemId: string, photoId: string, isLocal: boolean) => {
        if (!report) return;
        const newReport = { ...report, stockLevels: { ...report.stockLevels } };
        const record = newReport.stockLevels[itemId];

        if (!record) return;

        if (isLocal) {
            record.photoIds = (record.photoIds ?? []).filter(p => p !== photoId);
            await photoStore.deletePhoto(photoId);
        } else {
            record.photos = (record.photos ?? []).filter(p => p !== photoId);
            await dataStore.deletePhotoFromStorage(photoId);
        }

        newReport.stockLevels[itemId] = record;
        setReport(newReport);
        await handleLocalSave(newReport);
    };

  const handleGenerateSuggestions = async () => {
      if(!report || !user) return null;
      setIsGenerating(true);
      
      try {
        toast({
            title: "Đang phân tích tồn kho...",
            description: "AI đang tính toán các mặt hàng cần đặt. Vui lòng đợi trong giây lát."
        });

        const itemsWithCurrentStock = inventoryList
            .map(item => ({ item, stockRecord: report.stockLevels[item.id] }))
            .filter(({ stockRecord }) => stockRecord && (stockRecord.stock !== undefined && String(stockRecord.stock).trim() !== ''))
            .map(({ item, stockRecord }) => ({ ...item, currentStock: stockRecord! }));

        if (itemsWithCurrentStock.length === 0) {
            const noItemsSuggestion = { summary: 'Chưa có mặt hàng nào được kiểm kê hợp lệ.', ordersBySupplier: [] };
            setSuggestions(noItemsSuggestion);
            return noItemsSuggestion;
        }
        
        const result = await generateInventoryOrderSuggestion({ items: itemsWithCurrentStock });
        
        setSuggestions(result);
        
        setTimeout(() => {
            suggestionsCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);

        return result;

      } catch (error) {
          console.error("Error generating suggestions:", error);
          toast({
              title: "Lỗi",
              description: "Không thể tạo đề xuất đặt hàng. Vui lòng thử lại.",
              variant: "destructive"
          });
          return null;
      } finally {
          setIsGenerating(false);
      }
  }

  const handleSubmit = async () => {
    if (!report || !user) return;
    
    // --- Validation for required fields and photos ---
    for (const item of inventoryList) {
        if (item.requiresPhoto) {
            const record = report.stockLevels[item.id];
            const stockValue = record?.stock;
            const hasStockValue = stockValue !== undefined && String(stockValue).trim() !== '';
            
            if (!hasStockValue) {
                 toast({
                    title: "Thiếu thông tin tồn kho",
                    description: `Vui lòng nhập số lượng tồn kho cho mặt hàng "${item.name}".`,
                    variant: "destructive",
                });
                const element = itemRowRefs.current.get(item.id);
                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element?.focus();
                return;
            }

            const hasLocalPhoto = record.photoIds && record.photoIds.length > 0;
            const hasServerPhoto = record.photos && record.photos.length > 0;
            if (!hasLocalPhoto && !hasServerPhoto) {
                 toast({
                    title: "Thiếu ảnh bằng chứng",
                    description: `Vui lòng chụp ảnh bằng chứng cho mặt hàng "${item.name}".`,
                    variant: "destructive",
                });
                const element = itemRowRefs.current.get(item.id);
                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element?.focus();
                return;
            }
        }
    }
    // --- End Validation ---

    const startTime = Date.now();
    setIsSubmitting(true);
    toast({
        title: "Đang gửi báo cáo tồn kho...",
        description: "Vui lòng đợi trong giây lát."
    });

    try {
        const generatedSuggestions = await handleGenerateSuggestions();
        
        const finalReport = { 
            ...report, 
            suggestions: generatedSuggestions,
            status: 'submitted' as const, 
            submittedAt: new Date().toISOString() 
        };
        
        await dataStore.saveInventoryReport(finalReport);
        setReport(finalReport);
        setHasUnsubmittedChanges(false);

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        toast({
            title: "Gửi và đề xuất thành công!",
            description: `Quá trình hoàn tất trong ${duration} giây.`
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
      const stockValue = report?.stockLevels[itemId]?.stock;

      if (typeof stockValue !== 'number') {
        return 'ok';
      }

      if (stockValue <= 0) return 'out';
      if (stockValue < minStock) return 'low';
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
  
    const handleCopySuggestions = () => {
        if (!suggestions || suggestions.ordersBySupplier.length === 0) return;

        const textToCopy = suggestions.ordersBySupplier
            .map(orderBySupplier => {
                const header = `Katrina Coffee đặt hàng ${orderBySupplier.supplier.toUpperCase()}:`;
                const items = orderBySupplier.itemsToOrder
                    .map(orderItem => {
                        const fullItem = inventoryList.find(i => i.id === orderItem.itemId);
                        return `⬤ ${fullItem ? fullItem.name : 'Không rõ'} - SL: ${orderItem.quantityToOrder}`;
                    })
                    .join('\n');
                return `${header}\n${items}`;
            })
            .join('\n\n');
            
        navigator.clipboard.writeText(textToCopy).then(() => {
            toast({
                title: "Thành công",
                description: "Đã sao chép danh sách đặt hàng vào bộ nhớ tạm."
            });
        }, (err) => {
            console.error('Could not copy text: ', err);
            toast({
                title: "Lỗi",
                description: "Không thể sao chép danh sách.",
                variant: "destructive"
            });
        });
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
  const isProcessing = isSubmitting || isGenerating;
  const hasSuggestions = suggestions && suggestions.ordersBySupplier && suggestions.ordersBySupplier.length > 0;

  return (
    <TooltipProvider>
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
                                     <div className="space-y-3">
                                        {items.map(item => {
                                            const status = getItemStatus(item.id, item.minStock);
                                            const record = report.stockLevels[item.id];
                                            const stockValue = record?.stock ?? '';
                                            const latestPhotoId = record?.photoIds?.[record.photoIds.length - 1];
                                            return (
                                                <div 
                                                    key={item.id} 
                                                    ref={(el) => itemRowRefs.current.set(item.id, el)}
                                                    tabIndex={-1}
                                                    className={`rounded-lg border p-3 grid grid-cols-2 gap-4 items-start ${getStatusColorClass(status)} cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2`}
                                                    onClick={() => inputRefs.current.get(item.id)?.focus()}
                                                >
                                                    <div className="col-span-1">
                                                        <p className="font-semibold flex items-center gap-2">
                                                            {item.requiresPhoto && <Star className="h-4 w-4 text-yellow-500 shrink-0" />}
                                                            {item.name}
                                                        </p>
                                                        <p className="text-sm text-muted-foreground">Đơn vị: {item.unit}</p>
                                                    </div>
                                                    <div className="col-span-1 flex flex-col items-end gap-2">
                                                        <Input
                                                            ref={el => inputRefs.current.set(item.id, el)}
                                                            type="text"
                                                            value={stockValue}
                                                            onChange={e => handleStockChange(item.id, e.target.value)}
                                                            className="text-center h-9 w-24"
                                                            placeholder="Tồn kho..."
                                                            disabled={isProcessing}
                                                        />
                                                         {item.requiresPhoto && (
                                                            <div className="flex gap-2 items-center">
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="h-9 w-9"
                                                                    onClick={(e) => { e.stopPropagation(); setActiveItemId(item.id); setIsCameraOpen(true); }}
                                                                    disabled={isProcessing}
                                                                >
                                                                    <Camera className="h-4 w-4" />
                                                                </Button>
                                                                {latestPhotoId && localPhotoUrls.get(latestPhotoId) && (
                                                                    <div className="relative aspect-square rounded-md overflow-hidden w-9 h-9">
                                                                        <Image src={localPhotoUrls.get(latestPhotoId)!} alt="Inventory photo" fill className="object-cover" />
                                                                        <Button
                                                                            variant="destructive"
                                                                            size="icon"
                                                                            className="absolute -top-1 -right-1 h-4 w-4 rounded-full z-10 p-0"
                                                                            onClick={(e) => { e.stopPropagation(); handleDeletePhoto(item.id, latestPhotoId, true);}}
                                                                        >
                                                                            <X className="h-2 w-2" />
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                         )}
                                                    </div>
                                                </div>
                                            )
                                        })}
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
                    {isProcessing && !suggestions && (
                        <div className="space-y-2 p-4 text-center">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground"/>
                            <p className="text-sm text-muted-foreground">AI đang phân tích...</p>
                        </div>
                    )}
                    {!isProcessing && hasSuggestions && (
                        <div className="space-y-4">
                             <div className="flex justify-between items-center">
                                <p className="text-sm font-semibold text-primary">{suggestions.summary}</p>
                                <Button size="sm" variant="ghost" onClick={handleCopySuggestions}>
                                    <Copy className="mr-2 h-4 w-4"/>
                                    Sao chép
                                </Button>
                             </div>
                            
                             <Accordion type="multiple" defaultValue={suggestions.ordersBySupplier.map(s => s.supplier)} className="w-full space-y-2">
                                {suggestions.ordersBySupplier.map((orderBySupplier) => (
                                    <AccordionItem value={orderBySupplier.supplier} key={orderBySupplier.supplier} className="border-b-0">
                                        <AccordionTrigger className="text-base font-medium hover:no-underline p-2 bg-muted rounded-md">
                                            {orderBySupplier.supplier}
                                        </AccordionTrigger>
                                        <AccordionContent className="p-0 pt-2">
                                            <Table>
                                                <TableBody>
                                                    {orderBySupplier.itemsToOrder.map((orderItem) => {
                                                        const fullItem = inventoryList.find(i => i.id === orderItem.itemId);
                                                        return (
                                                            <TableRow key={orderItem.itemId}>
                                                                <TableCell className="font-normal text-sm p-2">{fullItem?.name || 'Không rõ'}</TableCell>
                                                                <TableCell className="text-right font-semibold text-sm p-2">{orderItem.quantityToOrder}</TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </div>
                    )}
                    {!isProcessing && suggestions && !hasSuggestions && (
                        <p className="text-center text-sm text-muted-foreground py-4">{suggestions.summary || 'Tất cả hàng hoá đã đủ. Không cần đặt thêm.'}</p>
                    )}
                    {!isProcessing && !suggestions &&(
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
              disabled={isProcessing}
              aria-label="Gửi báo cáo và nhận đề xuất"
          >
              {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              <span className="ml-2">{ isProcessing ? 'Đang xử lý...' : 'Gửi & Nhận đề xuất'}</span>
          </Button>
            {hasUnsubmittedChanges && (
                <div className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-background"></span>
                </div>
            )}
        </div>
      </div>
      <CameraDialog 
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onSubmit={handleCapturePhotos}
        singlePhotoMode={true}
      />
    </div>
    </TooltipProvider>
  );
}
