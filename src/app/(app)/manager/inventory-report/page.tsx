
'use client';
import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { dataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { InventoryItem, InventoryReport } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ShoppingCart, Users, CheckCircle, AlertCircle, Calendar as CalendarIcon, Star, Camera } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

type ItemStatus = 'ok' | 'low' | 'out';

type CategorizedList = {
    category: string;
    items: InventoryItem[];
}[];

function ManagerInventoryReportView() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const getTodaysDateKey = () => {
    const now = new Date();
    const year = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric' });
    const month = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', month: '2-digit' });
    const day = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit' });
    return `${year}-${month}-${day}`;
  };

  const [date, setDate] = useState<Date | undefined>(new Date());
  const dateKey = date ? format(date, 'yyyy-MM-dd') : getTodaysDateKey();

  const [reports, setReports] = useState<InventoryReport[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxSlides, setLightboxSlides] = useState<{ src: string }[]>([]);


  useEffect(() => {
    if (!authLoading && (!user || (user.role !== 'Quản lý' && user.role !== 'Chủ nhà hàng'))) {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    let isMounted = true;
    const unsubscribeInventoryList = dataStore.subscribeToInventoryList((items) => {
        if(isMounted) setInventoryList(items);
    });
     return () => { isMounted = false; unsubscribeInventoryList() };
  }, []);

  useEffect(() => {
      if (!dateKey) return;
      setIsLoading(true);
      dataStore.getInventoryReportForDate(dateKey).then(fetchedReports => {
          setReports(fetchedReports);
          if (fetchedReports.length > 0) {
              setSelectedReportId(fetchedReports[0].id);
          } else {
              setSelectedReportId(null);
          }
          setIsLoading(false);
      }).catch(error => {
          console.error("Error fetching inventory reports for manager:", error);
          toast({ title: "Lỗi", description: "Không thể tải báo cáo.", variant: "destructive" });
          setIsLoading(false);
      });
  }, [dateKey, toast]);
  
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
    const stockValue = report?.stockLevels[itemId]?.stock;
    if (stockValue === undefined || stockValue === null || typeof stockValue !== 'number') {
      return 'ok';
    }
    if (stockValue <= 0) return 'out';
    if (stockValue < minStock) return 'low';
    return 'ok';
  };

  const getStatusColorClass = (status: ItemStatus) => {
    switch (status) {
      case 'low': return 'bg-yellow-100/50 dark:bg-yellow-900/30';
      case 'out': return 'bg-red-100/50 dark:bg-red-900/30';
      default: return 'bg-transparent';
    }
  };

  if (authLoading || !inventoryList) {
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

  return (
    <>
    <div className="container mx-auto p-4 sm:p-6 md:p-8">
       <header className="mb-8">
          <Button asChild variant="ghost" className="-ml-4 mb-4">
              <Link href="/manager">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Quay lại
              </Link>
          </Button>
          <div className="flex flex-col md:flex-row gap-4 justify-between md:items-start">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold font-headline">Xem Báo cáo Tồn kho</h1>
            </div>
            <Popover>
                <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                    "w-full md:w-[280px] justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Chọn ngày</span>}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                />
                </PopoverContent>
            </Popover>
          </div>
      </header>

       {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-4">
                <Skeleton className="h-96 w-full" />
            </div>
            <div className="lg:col-span-1 space-y-4">
                 <Skeleton className="h-64 w-full" />
            </div>
        </div>
      ) : reports.length === 0 ? (
         <Card>
            <CardHeader><CardTitle>Không có báo cáo</CardTitle></CardHeader>
            <CardContent><p className="text-muted-foreground">Không có báo cáo tồn kho nào được nộp vào ngày đã chọn.</p></CardContent>
        </Card>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2">
            <Card>
                <CardHeader>
                    <CardTitle>Chi tiết Tồn kho</CardTitle>
                    <CardDescription>
                       <div className="flex items-center gap-4">
                            <span>Báo cáo ngày {format(date!, "dd/MM/yyyy")}</span>
                            <Select onValueChange={setSelectedReportId} value={selectedReportId || ''}>
                                <SelectTrigger className="w-full md:w-[200px]">
                                    <SelectValue placeholder="Chọn nhân viên..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {reports.map(r => (
                                        <SelectItem key={r.id} value={r.id}>{r.staffName}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                       </div>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                {report ? (
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
                                                    const record = report.stockLevels[item.id];
                                                    const stockValue = record?.stock ?? 'N/A';
                                                    const photos = record?.photos ?? [];
                                                    return (
                                                        <React.Fragment key={item.id}>
                                                            <TableRow className={getStatusColorClass(status)}>
                                                                <TableCell className="font-medium">
                                                                    <div className="flex items-center gap-2">
                                                                    {item.requiresPhoto && <Star className="h-4 w-4 text-yellow-500 shrink-0" />}
                                                                    {item.name.split(' - ')[1] || item.name}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell>{item.unit}</TableCell>
                                                                <TableCell>{item.minStock}</TableCell>
                                                                <TableCell className="text-right font-medium">
                                                                    {stockValue}
                                                                </TableCell>
                                                            </TableRow>
                                                            {item.requiresPhoto && photos.length > 0 && (
                                                                <TableRow className={getStatusColorClass(status)}>
                                                                    <TableCell colSpan={4}>
                                                                        <div className="flex gap-2 flex-wrap p-2 bg-muted/50 rounded-md">
                                                                            {photos.map((photo, index) => (
                                                                                <button
                                                                                    key={index}
                                                                                    onClick={() => { setLightboxSlides(photos.map(p => ({src: p}))); setLightboxOpen(true); }}
                                                                                    className="relative w-20 h-20 rounded-md overflow-hidden"
                                                                                >
                                                                                    <Image src={photo} alt={`Photo for ${item.name}`} fill className="object-cover" />
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </TableCell>
                                                                </TableRow>
                                                            )}
                                                        </React.Fragment>
                                                    )
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                    ) : (
                         <p className="text-muted-foreground text-center py-4">Vui lòng chọn một nhân viên để xem báo cáo.</p>
                    )}
                </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-1 space-y-8 sticky top-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ShoppingCart/> Đề xuất Đặt hàng của AI</CardTitle>
                </CardHeader>
                <CardContent>
                    {report && report.suggestions && report.suggestions.ordersBySupplier.length > 0 ? (
                        <div className="space-y-4">
                            <p className="text-sm font-semibold text-primary">{report.suggestions.summary}</p>
                             <Accordion type="multiple" defaultValue={report.suggestions.ordersBySupplier.map(s => s.supplier)} className="w-full space-y-2">
                                {report.suggestions.ordersBySupplier.map((orderBySupplier) => (
                                    <AccordionItem value={orderBySupplier.supplier} key={orderBySupplier.supplier} className="border-b-0">
                                        <AccordionTrigger className="text-base font-medium hover:no-underline p-2 bg-muted rounded-md">
                                            {orderBySupplier.supplier}
                                        </AccordionTrigger>
                                        <AccordionContent className="p-0 pt-2">
                                            <Table>
                                                <TableBody>
                                                    {orderBySupplier.itemsToOrder.map((orderItem) => {
                                                        const fullItem = inventoryList.find(i => i.id === orderItem.itemId);
                                                        const displayName = fullItem ? (fullItem.name.split(' - ')[1] || fullItem.name) : 'Không rõ';
                                                        return (
                                                            <TableRow key={orderItem.itemId}>
                                                                <TableCell className="font-normal text-sm p-2">{displayName}</TableCell>
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
                    ) : report && report.suggestions ? (
                         <div className="flex items-center justify-center text-center text-sm text-muted-foreground py-4 gap-2">
                            <CheckCircle className="text-green-500 h-4 w-4"/>
                            <p>{report.suggestions.summary || 'Tất cả hàng hoá đã đủ.'}</p>
                        </div>
                    ) : (
                         <div className="flex items-center justify-center text-center text-sm text-muted-foreground py-4 gap-2">
                           <AlertCircle className="text-yellow-500 h-4 w-4" />
                           <p>Không có đề xuất nào được tạo hoặc chưa chọn báo cáo.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>
    )}
    </div>
    <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={lightboxSlides}
    />
    </>
  );
}


export default function ManagerInventoryReportPage() {
    return (
        <Suspense fallback={<Skeleton className="w-full h-screen" />}>
            <ManagerInventoryReportView />
        </Suspense>
    )
}

    