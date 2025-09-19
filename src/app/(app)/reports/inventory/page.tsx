
'use client';
import React, { useState, useEffect, useMemo, Suspense, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { dataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { InventoryItem, InventoryReport, InventoryStockRecord, OrderBySupplier, OrderItem } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ShoppingCart, CheckCircle, AlertCircle, Star, Clock, User, History, ChevronsDownUp, Copy, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { format } from "date-fns";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, } from "@/components/ui/dialog"


type ItemStatus = 'ok' | 'low' | 'out';

type CategorizedList = {
    category: string;
    items: InventoryItem[];
}[];

function InventoryReportView() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const suggestionsCardRef = useRef<HTMLDivElement>(null);
  
  const [allReports, setAllReports] = useState<InventoryReport[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxSlides, setLightboxSlides] = useState<{ src: string }[]>([]);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<InventoryReport | null>(null);
  const [openCategories, setOpenCategories] = useState<string[]>([]);

  // --- Back button handling for Lightbox ---
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (lightboxOpen) {
        event.preventDefault();
        setLightboxOpen(false);
      }
    };

    if (lightboxOpen) {
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [lightboxOpen]);


  useEffect(() => {
    if (!authLoading && (!user || (user.role !== 'Chủ nhà hàng' && user.role !== 'Quản lý'))) {
      router.replace('/');
      return;
    }
  }, [user, authLoading, router]);

  useEffect(() => {
     let isMounted = true;
     const unsubInventoryList = dataStore.subscribeToInventoryList((items) => {
         if (isMounted) setInventoryList(items);
     });
     const unsubReports = dataStore.subscribeToAllInventoryReports((reports) => {
        if(isMounted) {
            setAllReports(reports);
            if (reports.length > 0) {
                if (selectedReport && !reports.some(r => r.id === selectedReport.id)) {
                    setSelectedReport(reports[0]);
                } else if (!selectedReport) {
                    setSelectedReport(reports[0]);
                }
            } else {
                setSelectedReport(null);
            }
            setIsLoading(false);
        }
    });

     return () => { isMounted = false; unsubInventoryList(); unsubReports(); };
  }, [selectedReport])
  
  const reportToView = selectedReport;

  const { checkedItems, uncheckedItems } = useMemo(() => {
    if (!inventoryList || !reportToView) return { checkedItems: [], uncheckedItems: [] };
    const checked: InventoryItem[] = [];
    const unchecked: InventoryItem[] = [];
    inventoryList.forEach(item => {
        const record = reportToView.stockLevels[item.id];
        if (record && (record.stock !== undefined && record.stock !== '')) {
            checked.push(item);
        } else {
            unchecked.push(item);
        }
    });
    return { checkedItems: checked, uncheckedItems: unchecked };
  }, [inventoryList, reportToView]);

  const categorizedCheckedList = useMemo((): CategorizedList => {
      const categoryOrder: string[] = [];
      const grouped: { [key: string]: InventoryItem[] } = {};
      checkedItems.forEach(item => {
          const category = item.category || 'CHƯA PHÂN LOẠI';
          if (!grouped[category]) {
              grouped[category] = [];
              categoryOrder.push(category);
          }
          grouped[category].push(item);
      });
      return categoryOrder.map(category => ({ category, items: grouped[category] }));
  }, [checkedItems]);
  
  const categorizedUncheckedList = useMemo((): CategorizedList => {
      const categoryOrder: string[] = [];
      const grouped: { [key: string]: InventoryItem[] } = {};
      uncheckedItems.forEach(item => {
          const category = item.category || 'CHƯA PHÂN LOẠI';
          if (!grouped[category]) {
              grouped[category] = [];
              categoryOrder.push(category);
          }
          grouped[category].push(item);
      });
      return categoryOrder.map(category => ({ category, items: grouped[category] }));
  }, [uncheckedItems]);

  useEffect(() => {
      if (categorizedCheckedList.length > 0 && openCategories.length === 0) {
          setOpenCategories(categorizedCheckedList.map(c => c.category));
      }
  }, [categorizedCheckedList, openCategories.length]);


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
      if (stockString.includes('hết') || stockString.includes('gần hết')) return 'out'; // Hết hàng & Gần hết -> Đỏ
      if (stockString.includes('còn đủ')) return 'low'; // Còn đủ -> Vàng
      if (stockString.includes('dư')) return 'ok'; // Dư xài -> Xanh
      return 'ok';
    }
  };

  const getStatusColorClass = (status: ItemStatus) => {
    switch (status) {
      case 'low': return 'bg-yellow-100/50 dark:bg-yellow-900/30';
      case 'out': return 'bg-red-100/50 dark:bg-red-900/30';
      case 'ok': return 'bg-green-100/40 dark:bg-green-900/20';
      default: return 'bg-transparent';
    }
  };

   const groupedHistory = useMemo(() => {
    return allReports.reduce((acc, report) => {
        const date = format(new Date(report.submittedAt as string), "dd/MM/yyyy");
        if(!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(report);
        return acc;
    }, {} as {[key: string]: InventoryReport[]})
  }, [allReports]);

    const handleCopySuggestions = () => {
        if (!reportToView?.suggestions || !reportToView.suggestions.ordersBySupplier || reportToView.suggestions.ordersBySupplier.length === 0) return;

        const textToCopy = reportToView.suggestions.ordersBySupplier
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

    const generateSuggestionsFromLogic = (): OrderBySupplier[] => {
        if (!reportToView) return [];

        const ordersBySupplier: { [supplier: string]: OrderItem[] } = {};

        inventoryList.forEach(item => {
            const stockRecord = reportToView.stockLevels[item.id];
            const status = getItemStatus(item, stockRecord?.stock);

            if (status === 'low' || status === 'out') {
                if (!ordersBySupplier[item.supplier]) {
                    ordersBySupplier[item.supplier] = [];
                }

                let quantityToOrder = item.orderSuggestion;
                const isNumericSuggestion = /^\d+(\.\d+)?$/.test(item.orderSuggestion);

                if (isNumericSuggestion) {
                    quantityToOrder = `${item.orderSuggestion} ${item.unit}`;
                }

                ordersBySupplier[item.supplier].push({
                    itemId: item.id,
                    quantityToOrder: quantityToOrder,
                });
            }
        });
        
        return Object.entries(ordersBySupplier).map(([supplier, itemsToOrder]) => ({
            supplier,
            itemsToOrder,
        }));
    };

    const handleRegenerateSuggestions = async () => {
        if (!reportToView) return;
        setIsGenerating(true);
        toast.loading("Đang tạo lại đề xuất...");

        try {
            const orders = generateSuggestionsFromLogic();
            const totalItemsToOrder = orders.reduce((acc, curr) => acc + curr.itemsToOrder.length, 0);
            const totalSuppliers = orders.length;

            const summary = totalItemsToOrder > 0
                ? `Cần đặt ${totalItemsToOrder} mặt hàng từ ${totalSuppliers} nhà cung cấp.`
                : 'Tất cả hàng hoá đã đủ. Không cần đặt thêm.';
            
            const newSuggestions = { summary, ordersBySupplier: orders };
            
            await dataStore.updateInventoryReportSuggestions(reportToView.id, newSuggestions);

            setSelectedReport(prev => prev ? { ...prev, suggestions: newSuggestions } : null);

            toast.success("Đã tạo lại và cập nhật đề xuất đặt hàng.");
        } catch (error) {
            console.error("Error regenerating suggestions:", error);
            toast.error("Lỗi: Không thể tạo lại đề xuất.");
        } finally {
            setIsGenerating(false);
            toast.dismiss();
        }
    };

  const handleToggleAll = () => {
    if (openCategories.length === categorizedCheckedList.length) {
      setOpenCategories([]);
    } else {
      setOpenCategories(categorizedCheckedList.map(c => c.category));
    }
  };

   const scrollToSuggestions = () => {
      suggestionsCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  
    const handleDeleteReport = async (reportId: string) => {
        if (user?.role !== 'Chủ nhà hàng') return;
        setIsProcessing(true);
        try {
            await dataStore.deleteInventoryReport(reportId);
            toast.success('Đã xóa báo cáo kiểm kê.');
        } catch(error) {
            console.error("Error deleting inventory report:", error);
            toast.error('Lỗi: Không thể xóa báo cáo.');
        } finally {
            setIsProcessing(false);
        }
    };

  if (isLoading || authLoading) {
    return (
      <div className="container mx-auto p-4 sm:p-6 md:p-8">
        <header className="mb-8">
            <Skeleton className="h-8 w-48 mb-4" />
            <Skeleton className="h-10 w-3/4" />
        </header>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-4">
                <Skeleton className="h-96 w-full" />
            </div>
            <div className="lg:col-span-1 space-y-4">
                 <Skeleton className="h-64 w-full" />
            </div>
        </div>
      </div>
    );
  }

  const areAllCategoriesOpen = categorizedCheckedList.length > 0 && openCategories.length === categorizedCheckedList.length;

  return (
    <>
    <div className="container mx-auto p-4 sm:p-6 md:p-8 pb-32">
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
            </div>
          </div>
      </header>

      {!reportToView ? (
        <Card>
            <CardHeader><CardTitle>Không có báo cáo</CardTitle></CardHeader>
            <CardContent><p className="text-muted-foreground">Không có báo cáo kiểm kê nào được nộp.</p></CardContent>
        </Card>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2">
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div>
                            <CardTitle>Báo cáo chi tiết ({checkedItems.length} mặt hàng đã kiểm kê)</CardTitle>
                            <CardDescription className="mt-2 flex items-center gap-4 text-sm">
                                <span className="flex items-center gap-1.5"><User className="h-4 w-4"/> {reportToView.staffName}</span>
                                <span className="flex items-center gap-1.5"><Clock className="h-4 w-4"/> {format(new Date(reportToView.submittedAt as string), "HH:mm, dd/MM/yyyy")}</span>
                            </CardDescription>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                            <Button variant="outline" onClick={() => setIsHistoryOpen(true)} className="w-full">
                                <History className="mr-2 h-4 w-4"/>
                                Xem lịch sử
                            </Button>
                             {categorizedCheckedList.length > 0 && (
                                <Button variant="outline" onClick={handleToggleAll} size="sm" className="w-full">
                                    <ChevronsDownUp className="mr-2 h-4 w-4"/>
                                    {areAllCategoriesOpen ? "Thu gọn" : "Mở rộng"}
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Accordion type="multiple" value={openCategories} onValueChange={setOpenCategories} className="w-full space-y-4">
                         {categorizedCheckedList.map(({ category, items }) => (
                            <AccordionItem value={category} key={category} className="border-2 rounded-lg border-primary/50">
                                <AccordionTrigger className="text-lg font-semibold flex-1 hover:no-underline p-4">
                                    {category}
                                </AccordionTrigger>
                                <AccordionContent className="p-4 border-t">
                                     <div className="md:hidden space-y-3">
                                        {items.map(item => {
                                            const stockValue = reportToView.stockLevels[item.id]?.stock;
                                            const status = getItemStatus(item, stockValue);
                                            const photos = reportToView.stockLevels[item.id]?.photos ?? [];
                                            return (
                                                <div key={item.id} className={`rounded-lg border p-3 ${stockValue !== undefined && stockValue !== '' ? getStatusColorClass(status) : ''}`}>
                                                    <div className="flex items-center gap-2 font-semibold">
                                                        {item.requiresPhoto && <Star className="h-4 w-4 text-yellow-500 shrink-0" />}
                                                        <p>{item.name}</p>
                                                    </div>
                                                    <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                                                        <div className="text-muted-foreground">Đơn vị: <span className="font-medium text-foreground">{item.unit}</span></div>
                                                        <div className="text-muted-foreground">Tối thiểu: <span className="font-medium text-foreground">{item.minStock}</span></div>
                                                        <div className="text-muted-foreground">Thực tế: <span className="font-bold text-lg text-primary">{stockValue ?? 'N/A'}</span></div>
                                                    </div>
                                                    {item.requiresPhoto && photos.length > 0 && (
                                                        <div className="mt-2 flex gap-2 flex-wrap">
                                                            {photos.map((photo, index) => (
                                                                <button
                                                                    key={index}
                                                                    onClick={() => { setLightboxSlides(photos.map(p => ({ src: p }))); setLightboxOpen(true); }}
                                                                    className="relative w-16 h-16 rounded-md overflow-hidden"
                                                                >
                                                                    <Image src={photo} alt={`Photo for ${item.name}`} fill className="object-cover" />
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                     </div>
                                    <div className="overflow-x-auto hidden md:block">
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
                                                    const stockValue = reportToView.stockLevels[item.id]?.stock;
                                                    const status = getItemStatus(item, stockValue);
                                                    const photos = reportToView.stockLevels[item.id]?.photos ?? [];
                                                    return (
                                                        <TableRow key={item.id} className={`${stockValue !== undefined && stockValue !== '' ? getStatusColorClass(status) : ''}`}>
                                                            <TableCell className="font-medium align-top">
                                                                <div className="flex flex-col gap-2">
                                                                    <div className="flex items-center gap-2">
                                                                        {item.requiresPhoto && <Star className="h-4 w-4 text-yellow-500 shrink-0" />}
                                                                        {item.name}
                                                                    </div>
                                                                    {item.requiresPhoto && photos.length > 0 && (
                                                                        <div className="flex gap-2 flex-wrap pl-6 mt-2">
                                                                            {photos.map((photo, index) => (
                                                                                <button
                                                                                    key={index}
                                                                                    onClick={() => { setLightboxSlides(photos.map(p => ({ src: p }))); setLightboxOpen(true); }}
                                                                                    className="relative w-16 h-16 rounded-md overflow-hidden"
                                                                                >
                                                                                    <Image src={photo} alt={`Photo for ${item.name}`} fill className="object-cover" />
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="align-top">{item.unit}</TableCell>
                                                            <TableCell className="align-top">{item.minStock}</TableCell>
                                                            <TableCell className="text-right font-medium align-top">
                                                                {stockValue ?? 'N/A'}
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

            {uncheckedItems.length > 0 && (
                <Accordion type="single" collapsible className="w-full mt-4">
                    <AccordionItem value="unchecked-items" className="border-2 rounded-lg border-muted">
                        <AccordionTrigger className="p-4 text-base font-semibold hover:no-underline">
                            Xem {uncheckedItems.length} mặt hàng chưa được kiểm kê
                        </AccordionTrigger>
                        <AccordionContent className="p-4 border-t">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-6">
                                {categorizedUncheckedList.map(({category, items}) => (
                                    <div key={category}>
                                        <h4 className="font-semibold text-primary mb-2 pb-1 border-b">{category}</h4>
                                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                                            {items.map(item => <li key={item.id}>{item.name}</li>)}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            )}

        </div>
        <div className="lg:col-span-1 space-y-8" ref={suggestionsCardRef}>
            <Card className="sticky top-4">
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2"><ShoppingCart/> Đề xuất Đặt hàng</span>
                        <div className="flex items-center gap-1">
                            {reportToView.suggestions && reportToView.suggestions.ordersBySupplier && reportToView.suggestions.ordersBySupplier.length > 0 && (
                                <Button size="sm" variant="ghost" onClick={handleCopySuggestions}>
                                    <Copy className="mr-2 h-4 w-4"/> Sao chép
                                </Button>
                            )}
                            <Button size="icon" variant="ghost" onClick={handleRegenerateSuggestions} disabled={isGenerating}>
                                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4" />}
                            </Button>
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                     {reportToView.suggestions && reportToView.suggestions.ordersBySupplier.length > 0 ? (
                        <div className="space-y-4">
                            <p className="text-sm font-semibold text-primary">{reportToView.suggestions.summary}</p>
                            <Accordion type="multiple" defaultValue={reportToView.suggestions.ordersBySupplier.map(s => s.supplier)} className="w-full space-y-2">
                                {reportToView.suggestions.ordersBySupplier.map((orderBySupplier) => (
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
                     ) : (
                         <div className="flex items-center justify-center text-center text-sm text-muted-foreground py-4 gap-2">
                            {reportToView.suggestions ? (
                                <>
                                 <CheckCircle className="text-green-500 h-4 w-4"/>
                                 <p>{reportToView.suggestions.summary || 'Tất cả hàng hoá đã đủ.'}</p>
                                </>
                            ) : (
                                <>
                                 <AlertCircle className="text-yellow-500 h-4 w-4" />
                                 <p>Không có đề xuất nào được tạo.</p>
                                </>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>
    )}
    </div>
    <div className="fixed bottom-4 right-4 z-50 md:bottom-6 md:right-6">
      <Button 
        className="rounded-full shadow-lg h-12 px-4" 
        onClick={scrollToSuggestions} 
        aria-label="Xem đề xuất đặt hàng"
      >
        <ShoppingCart className="mr-2 h-5 w-5" />
        <span className="hidden sm:inline">Xem đề xuất</span>
      </Button>
    </div>
    <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-xl">
            <DialogHeader>
                <DialogTitle>Lịch sử Kiểm kê Tồn kho</DialogTitle>
                <DialogDescription>
                    Danh sách các báo cáo đã được nộp, sắp xếp theo ngày gần nhất.
                </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto -mx-6 px-6 relative">
                 {isProcessing && <div className="absolute inset-0 bg-white/70 dark:bg-black/70 flex items-center justify-center z-10"><Loader2 className="h-8 w-8 animate-spin"/></div>}
                <Accordion type="multiple" defaultValue={Object.keys(groupedHistory)} className="w-full space-y-4">
                    {Object.entries(groupedHistory).map(([date, reports]) => (
                        <AccordionItem value={date} key={date}>
                            <AccordionTrigger className="text-base font-semibold">Ngày {date}</AccordionTrigger>
                            <AccordionContent>
                                <ul className="space-y-3">
                                {reports.map(report => (
                                    <li key={report.id} className="flex justify-between items-center p-3 border rounded-md">
                                        <div>
                                            <p className="font-medium">{report.staffName}</p>
                                            <p className="text-sm text-muted-foreground">
                                                Lúc {format(new Date(report.submittedAt as string), "HH:mm")}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button 
                                                variant={report.id === selectedReport?.id ? 'default' : 'secondary'} 
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedReport(report);
                                                    setIsHistoryOpen(false);
                                                }}
                                            >
                                                Xem
                                            </Button>
                                            {user?.role === 'Chủ nhà hàng' && (
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="text-destructive h-9 w-9" disabled={isProcessing}>
                                                            <Trash2 className="h-4 w-4"/>
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Xóa báo cáo này?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Hành động này sẽ xóa vĩnh viễn báo cáo của <span className="font-semibold">{report.staffName}</span> vào lúc <span className="font-semibold">{format(new Date(report.submittedAt as string), "HH:mm, dd/MM/yyyy")}</span> và tất cả hình ảnh liên quan. Hành động này không thể được hoàn tác.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteReport(report.id)}>Xóa vĩnh viễn</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            )}
                                        </div>
                                    </li>
                                ))}
                                </ul>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>
        </DialogContent>
    </Dialog>
    <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={lightboxSlides}
        carousel={{ finite: true }}
    />
    </>
  );
}


export default function InventoryReportPage() {
    return (
        <Suspense fallback={<Skeleton className="w-full h-screen" />}>
            <InventoryReportView />
        </Suspense>
    )
}
