
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
import type { InventoryItem, InventoryReport, InventoryOrderSuggestion, InventoryStockRecord, OrderBySupplier, OrderItem } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Loader2, Send, Wand2, ShoppingCart, Info, ChevronsDownUp, CheckCircle, Copy, Camera, X, RefreshCw, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import CameraDialog from '@/components/camera-dialog';
import { photoStore } from '@/lib/photo-store';
import { Tooltip, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { InventoryItemRow } from './_components/inventory-item-row';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

type ItemStatus = 'ok' | 'low' | 'out';

type CategorizedList = {
    category: string;
    items: InventoryItem[];
}[];

export default function InventoryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const suggestionsCardRef = useRef<HTMLDivElement>(null);
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

  const [showUncheckedWarning, setShowUncheckedWarning] = useState(false);
  const [uncheckedItems, setUncheckedItems] = useState<InventoryItem[]>([]);
  const [openUncheckedCategories, setOpenUncheckedCategories] = useState<string[]>([]);

  useEffect(() => {
    if (!authLoading && user && (user.role !== 'Pha chế' && !user.secondaryRoles?.includes('Pha chế'))) {
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
    
    const allPhotoIdsInReport = new Set<string>();
    for (const itemId in currentReport.stockLevels) {
        const record = currentReport.stockLevels[itemId];
        if (record.photoIds) {
            record.photoIds.forEach(id => allPhotoIdsInReport.add(id));
        }
    }

    if (allPhotoIdsInReport.size > 0) {
        const urls = await photoStore.getPhotosAsUrls(Array.from(allPhotoIdsInReport));
        setLocalPhotoUrls(prev => {
            const newMap = new Map(prev);
            urls.forEach((url, id) => newMap.set(id, url));
            return newMap;
        });
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
  // The dependency array is correct. We only want this to run when the user changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  
  const handleLocalSave = useCallback((reportUpdater: (prevReport: InventoryReport) => InventoryReport) => {
    setReport(prevReport => {
        if (!prevReport) return null;
        const newReport = reportUpdater(prevReport);

        (async () => {
            await dataStore.saveLocalInventoryReport(newReport);
            setHasUnsubmittedChanges(true);
        })();

        return newReport;
    });
  }, []);

  const handleStockChange = useCallback((itemId: string, value: string) => {
    handleLocalSave(prevReport => {
        const newReport = { ...prevReport };
        const newStockLevels = { ...newReport.stockLevels };
        
        const itemDefinition = inventoryList.find(i => i.id === itemId);
        let stockValue: string | number = value;

        if (itemDefinition?.dataType === 'number') {
            if (value.trim() === '') {
                stockValue = ''; 
            } else {
                const numValue = parseFloat(value);
                stockValue = isNaN(numValue) ? '' : numValue;
            }
        }

        const existingRecord = newStockLevels[itemId] || {};
        newStockLevels[itemId] = { ...existingRecord, stock: stockValue };
        newReport.stockLevels = newStockLevels;
        return newReport;
    });
}, [handleLocalSave, inventoryList]);
  
  const handleCapturePhotos = useCallback(async (photoIds: string[]) => {
    if (!activeItemId || photoIds.length === 0) return;
    
    const newPhotoUrls = await photoStore.getPhotosAsUrls(photoIds);
    setLocalPhotoUrls(prev => new Map([...prev, ...newPhotoUrls]));
    
    const itemId = activeItemId;

    handleLocalSave(prevReport => {
        const newReport = { ...prevReport };
        const newStockLevels = { ...newReport.stockLevels };
        const record = { ...(newStockLevels[itemId] || { stock: '' }) };
        
        record.photoIds = [...(record.photoIds || []), ...photoIds];
        newStockLevels[itemId] = record;
        newReport.stockLevels = newStockLevels;
        return newReport;
    });

    setIsCameraOpen(false);
    setActiveItemId(null);
  }, [activeItemId, handleLocalSave]);


    const handleDeletePhoto = async (itemId: string, photoId: string, isLocal: boolean) => {
        if (!report) return;

        if (isLocal) {
            const photoUrl = localPhotoUrls.get(photoId);
            if (photoUrl) URL.revokeObjectURL(photoUrl);
            setLocalPhotoUrls(prev => {
                const newMap = new Map(prev);
                newMap.delete(photoId);
                return newMap;
            });
            await photoStore.deletePhoto(photoId);
        } else {
            // This part is for photos already on server, which is not the primary use case here, but good to have
            await dataStore.deletePhotoFromStorage(photoId);
        }

        handleLocalSave(prevReport => {
            const newReport = { ...prevReport };
            const newStockLevels = { ...newReport.stockLevels };
            const record = { ...newStockLevels[itemId] };

            if (isLocal) {
                record.photoIds = (record.photoIds ?? []).filter(p => p !== photoId);
            } else {
                record.photos = (record.photos ?? []).filter(p => p !== photoId);
            }
            newStockLevels[itemId] = record;
            newReport.stockLevels = newStockLevels;
            return newReport;
        });
    };

    const getItemStatus = (item: InventoryItem, stockValue: number | string | undefined): ItemStatus => {
        if (stockValue === undefined || stockValue === '') return 'ok'; 
        if (item.dataType === 'number') {
            const stock = typeof stockValue === 'number' ? stockValue : parseFloat(String(stockValue));
            if (isNaN(stock)) return 'ok';
            if (stock < item.minStock * 0.3) return 'out';
            if (stock < item.minStock) return 'low';
            return 'ok';
        } else { // 'list' type
            const stockString = String(stockValue).toLowerCase();
            if (stockString.includes('hết')) return 'out';
            if (stockString.includes('còn đủ') || stockString.includes('gần hết')) return 'low';
            if (stockString.includes('dư')) return 'ok';
            return 'ok';
        }
    };

    const generateSuggestionsFromLogic = (): InventoryOrderSuggestion => {
        if (!report) return { summary: 'Không có báo cáo để xử lý.', ordersBySupplier: [] };

        const ordersBySupplier: { [supplier: string]: OrderItem[] } = {};

        inventoryList.forEach(item => {
            const stockRecord = report.stockLevels[item.id];
            const status = getItemStatus(item, stockRecord?.stock);

            if (status === 'low' || status === 'out') {
                if (!ordersBySupplier[item.supplier]) {
                    ordersBySupplier[item.supplier] = [];
                }
                ordersBySupplier[item.supplier].push({
                    itemId: item.id,
                    quantityToOrder: item.orderSuggestion,
                });
            }
        });
        
        const finalOrders: OrderBySupplier[] = Object.entries(ordersBySupplier).map(([supplier, itemsToOrder]) => ({
            supplier,
            itemsToOrder,
        }));
        
        const totalItemsToOrder = finalOrders.reduce((acc, curr) => acc + curr.itemsToOrder.length, 0);
        const totalSuppliers = finalOrders.length;
        
        const summary = totalItemsToOrder > 0
            ? `Cần đặt ${totalItemsToOrder} mặt hàng từ ${totalSuppliers} nhà cung cấp.`
            : 'Tất cả hàng hoá đã đủ. Không cần đặt thêm.';

        return { summary, ordersBySupplier: finalOrders };
    };

    const handleGenerateSuggestions = async () => {
      setIsGenerating(true);
      
      try {
        toast.loading("Đang tính toán đề xuất...");

        // Use the local logic function instead of an AI call
        const result = generateSuggestionsFromLogic();
        
        setSuggestions(result);
        
        setTimeout(() => {
            suggestionsCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);

        return result;

      } catch (error) {
          console.error("Error generating suggestions:", error);
          toast.error("Lỗi: Không thể tạo đề xuất đặt hàng.");
          return null;
      } finally {
          setIsGenerating(false);
          toast.dismiss();
      }
  }

  const proceedToSubmit = async () => {
    if (!report || !user) return;
    const startTime = Date.now();
    setIsSubmitting(true);
    const toastId = toast.loading("Đang gửi báo cáo tồn kho...");

    try {
        const generatedSuggestions = await handleGenerateSuggestions();
        
        const finalReport = { 
            ...report, 
            suggestions: generatedSuggestions,
            status: 'submitted' as const, 
        };
        
        await dataStore.saveInventoryReport(finalReport);
        setReport(prev => prev ? { ...prev, ...finalReport, submittedAt: new Date().toISOString() } : null);
        setHasUnsubmittedChanges(false);

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        toast.success(`Gửi và đề xuất thành công! (${duration} giây)`, { id: toastId });
        
    } catch (error) {
         console.error("Error submitting inventory report:", error);
         toast.error("Lỗi: Không thể gửi báo cáo.", { id: toastId });
    } finally {
        setIsSubmitting(false);
    }
  }
  
  const handleSubmit = async () => {
    if (!report) return;

    const unEnteredItems: InventoryItem[] = [];
    
    // --- Validation for required fields and photos ---
    for (const item of inventoryList) {
        const record = report.stockLevels[item.id];
        const stockValue = record?.stock;
        const hasStockValue = stockValue !== undefined && String(stockValue).trim() !== '';

        if (item.isImportant && !hasStockValue) {
            toast.error(`Vui lòng nhập số lượng tồn kho cho mặt hàng "${item.name}".`);
            const element = itemRowRefs.current.get(item.id);
            element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element?.focus();
            return;
        }

        if (item.requiresPhoto) {
            const hasLocalPhoto = record?.photoIds && record.photoIds.length > 0;
            const hasServerPhoto = record?.photos && record.photos.length > 0;
            if (!hasLocalPhoto && !hasServerPhoto) {
                toast.error(`Vui lòng chụp ảnh bằng chứng cho mặt hàng "${item.name}".`);
                const element = itemRowRefs.current.get(item.id);
                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element?.focus();
                return;
            }
        }

        if (!hasStockValue) {
            unEnteredItems.push(item);
        }
    }
    // --- End Validation ---
    
    if (unEnteredItems.length > 0) {
        setUncheckedItems(unEnteredItems);
        setShowUncheckedWarning(true);
    } else {
        await proceedToSubmit();
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
            toast.success("Đã sao chép danh sách đặt hàng.");
        }, (err) => {
            console.error('Could not copy text: ', err);
            toast.error("Không thể sao chép danh sách.");
        });
    };

    const categorizedUncheckedItems = useMemo((): CategorizedList => {
        if (uncheckedItems.length === 0) return [];
        const grouped: { [key: string]: InventoryItem[] } = {};
        uncheckedItems.forEach(item => {
            const category = item.category || 'CHƯA PHÂN LOẠI';
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(item);
        });
        return Object.entries(grouped).map(([category, items]) => ({ category, items }));
    }, [uncheckedItems]);

    const handleToggleAllUnchecked = () => {
        if (openUncheckedCategories.length === categorizedUncheckedItems.length) {
            setOpenUncheckedCategories([]);
        } else {
            setOpenUncheckedCategories(categorizedUncheckedItems.map(c => c.category));
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
  const isProcessing = isSubmitting || isGenerating;
  const hasSuggestions = suggestions && suggestions.ordersBySupplier && suggestions.ordersBySupplier.length > 0;
  const areAllUncheckedOpen = categorizedUncheckedItems.length > 0 && openUncheckedCategories.length === categorizedUncheckedItems.length;


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
                            Nhập số lượng tồn kho thực tế của các mặt hàng.
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
                                        {items.map(item => (
                                            <InventoryItemRow
                                                key={item.id}
                                                item={item}
                                                record={report.stockLevels[item.id]}
                                                localPhotoUrls={localPhotoUrls}
                                                isProcessing={isProcessing}
                                                onStockChange={handleStockChange}
                                                onOpenCamera={(itemId) => { setActiveItemId(itemId); setIsCameraOpen(true); }}
                                                onDeletePhoto={handleDeletePhoto}
                                                rowRef={(el) => itemRowRefs.current.set(item.id, el)}
                                            />
                                        ))}
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
                    {isGenerating && !suggestions && (
                        <div className="space-y-2 p-4 text-center">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground"/>
                            <p className="text-sm text-muted-foreground">Đang tính toán...</p>
                        </div>
                    )}
                    {!isGenerating && hasSuggestions && (
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
                    {!isGenerating && suggestions && !hasSuggestions && (
                        <p className="text-center text-sm text-muted-foreground py-4">{suggestions.summary || 'Tất cả hàng hoá đã đủ. Không cần đặt thêm.'}</p>
                    )}
                    {!isGenerating && !suggestions &&(
                        <div className="text-center space-y-4 py-4">
                            <p className="text-sm text-muted-foreground">Sau khi nhập xong tồn kho, nhấn nút bên dưới để gửi báo cáo và nhận đề xuất.</p>
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
      />
    <AlertDialog open={showUncheckedWarning} onOpenChange={setShowUncheckedWarning}>
    <AlertDialogContent className="max-w-lg rounded-2xl border shadow-2xl bg-background">
        <AlertDialogHeader className="flex flex-row items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
            <AlertTriangle className="h-6 w-6" />
        </div>
        <div>
            <AlertDialogTitle className="text-lg font-bold text-amber-600 dark:text-amber-400">
            Cảnh báo: Còn mặt hàng chưa kiểm kê
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
            Có <span className="font-bold">{uncheckedItems.length}</span> mặt hàng chưa được kiểm kê. 
            Bạn vẫn muốn tiếp tục gửi báo cáo?
            </AlertDialogDescription>
        </div>
        </AlertDialogHeader>

        {/* Một nút điều khiển mở/thu gọn tất cả */}
        <div className="flex justify-end -mb-2">
        <Button
            variant="outline"
            size="sm"
            onClick={handleToggleAllUnchecked}
        >
            <ChevronsDownUp className="mr-2 h-4 w-4" />
            {areAllUncheckedOpen ? "Thu gọn tất cả" : "Mở rộng tất cả"}
        </Button>
        </div>

        <ScrollArea className="max-h-60 w-full rounded-md border bg-muted/30">
        <div className="p-3">
            <Accordion 
                type="multiple" 
                value={openUncheckedCategories} 
                onValueChange={setOpenUncheckedCategories} 
                className="w-full space-y-2"
            >
                {categorizedUncheckedItems.map(({ category, items }) => (
                <AccordionItem value={category} key={category} className="rounded-lg border bg-card shadow-sm">
                    <AccordionTrigger className="px-3 py-2 text-base font-semibold hover:no-underline hover:bg-accent rounded-lg">
                    {category} ({items.length})
                    </AccordionTrigger>
                    <AccordionContent className="p-2 space-y-2">
                    {items.map(item => (
                        <button
                        key={item.id}
                        className="w-full text-left px-3 py-2 rounded-md hover:bg-accent text-sm transition"
                        onClick={() => {
                            const element = itemRowRefs.current.get(item.id)
                            element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                            element?.focus()
                            setShowUncheckedWarning(false)
                        }}
                        >
                        {item.name}
                        </button>
                    ))}
                    </AccordionContent>
                </AccordionItem>
                ))}
            </Accordion>
        </div>
        </ScrollArea>

        <AlertDialogFooter>
        <AlertDialogCancel className="rounded-lg">Hủy</AlertDialogCancel>
        <AlertDialogAction 
            onClick={proceedToSubmit} 
            className="bg-amber-600 text-white hover:bg-amber-700 rounded-lg"
        >
            Bỏ qua và gửi
        </AlertDialogAction>
        </AlertDialogFooter>
    </AlertDialogContent>
    </AlertDialog>
    </div>
    </TooltipProvider>
  );
}
