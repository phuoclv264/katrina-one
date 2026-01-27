
'use client';
import React, { useState, useEffect, useMemo, Suspense, useRef, useCallback } from 'react';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import Image from '@/components/ui/image';
import { useAuth } from '@/hooks/use-auth';
import { dataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { InventoryItem, InventoryReport, InventoryStockRecord, OrderBySupplier, OrderItem } from '@/lib/types';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { ArrowLeft, ShoppingCart, CheckCircle, AlertCircle, Star, Clock, User, History, ChevronsDownUp, Copy, Trash2, Loader2, RefreshCw, Search, Filter, X } from 'lucide-react';
import { toast } from '@/components/ui/pro-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogIcon, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, } from "@/components/ui/dialog"
import { useLightbox } from '@/contexts/lightbox-context';
import { useRouter } from 'nextjs-toploader/app';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';


type ItemStatus = 'ok' | 'low' | 'out';

type CategorizedList = {
    category: string;
    items: InventoryItem[];
}[];

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

const getStatusInfo = (status: ItemStatus) => {
    switch (status) {
        case 'low': return { label: 'Còn đủ (Sắp hết)', color: 'text-yellow-600 bg-yellow-100 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-900/30 dark:border-yellow-800' };
        case 'out': return { label: 'Gần hết / Hết', color: 'text-red-600 bg-red-100 border-red-200 dark:text-red-400 dark:bg-red-900/30 dark:border-red-800' };
        case 'ok': return { label: 'Bình thường / Dư', color: 'text-green-600 bg-green-100 border-green-200 dark:text-green-400 dark:bg-green-900/30 dark:border-green-800' };
        default: return { label: 'N/A', color: 'text-gray-600 bg-gray-100 border-gray-200' };
    }
};

function InventoryReportView() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const suggestionsCardRef = useRef<HTMLDivElement>(null);

    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const handleDataRefresh = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
    }, []);

    const [allReports, setAllReports] = useState<InventoryReport[]>([]);
    const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const { openLightbox } = useLightbox();

    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [selectedReport, setSelectedReport] = useState<InventoryReport | null>(null);
    const [openCategories, setOpenCategories] = useState<string[]>([]);

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<ItemStatus | 'all'>('all');
    const [categoryFilter, setCategoryFilter] = useState<string | 'all'>('all');


    useEffect(() => {
        if (!authLoading && (!user || (user.role !== 'Chủ nhà hàng' && user.role !== 'Quản lý'))) {
            router.replace('/');
            return;
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (!user) return;

        let isMounted = true;
        const unsubInventoryList = dataStore.subscribeToInventoryList((items) => {
            if (isMounted) setInventoryList(items);
        });
        const unsubReports = dataStore.subscribeToAllInventoryReports((reports) => {
            if (isMounted) {
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
    }, [user, selectedReport, refreshTrigger]);

    useDataRefresher(handleDataRefresh);

    const reportToView = selectedReport;

    const categories = useMemo(() => {
        const cats = new Set<string>();
        inventoryList.forEach(item => {
            if (item.category) cats.add(item.category);
        });
        return Array.from(cats).sort();
    }, [inventoryList]);

    const { checkedItems, uncheckedItems, filteredCheckedItems } = useMemo(() => {
        if (!inventoryList || !reportToView) return { checkedItems: [], uncheckedItems: [], filteredCheckedItems: [] };
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

        const filtered = checked.filter(item => {
            const status = getItemStatus(item, reportToView.stockLevels[item.id]?.stock);
            const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'all' || status === statusFilter;
            const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
            return matchesSearch && matchesStatus && matchesCategory;
        });

        return { checkedItems: checked, uncheckedItems: unchecked, filteredCheckedItems: filtered };
    }, [inventoryList, reportToView, searchTerm, statusFilter, categoryFilter]);

    const categorizedFilteredList = useMemo((): CategorizedList => {
        const categoryOrder: string[] = [];
        const grouped: { [key: string]: InventoryItem[] } = {};
        filteredCheckedItems.forEach(item => {
            const category = item.category || 'CHƯA PHÂN LOẠI';
            if (!grouped[category]) {
                grouped[category] = [];
                categoryOrder.push(category);
            }
            grouped[category].push(item);
        });
        return categoryOrder.map(category => ({ category, items: grouped[category] }));
    }, [filteredCheckedItems]);

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
        if (categorizedFilteredList.length > 0 && searchTerm) {
            setOpenCategories(categorizedFilteredList.map(c => c.category));
        } else if (categorizedFilteredList.length > 0 && openCategories.length === 0) {
            setOpenCategories(categorizedFilteredList.map(c => c.category));
        }
    }, [categorizedFilteredList, openCategories.length, searchTerm]);


    const groupedHistory = useMemo(() => {
        return allReports.reduce((acc, report) => {
            const date = format(new Date(report.submittedAt as string), "dd/MM/yyyy");
            if (!acc[date]) {
                acc[date] = [];
            }
            acc[date].push(report);
            return acc;
        }, {} as { [key: string]: InventoryReport[] })
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
        if (openCategories.length === categorizedFilteredList.length) {
            setOpenCategories([]);
        } else {
            setOpenCategories(categorizedFilteredList.map(c => c.category));
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
        } catch (error) {
            console.error("Error deleting inventory report:", error);
            toast.error('Lỗi: Không thể xóa báo cáo.');
        } finally {
            setIsProcessing(false);
        }
    };

    const clearFilters = () => {
        setSearchTerm('');
        setStatusFilter('all');
        setCategoryFilter('all');
    };

    if (isLoading || authLoading) {
        return <LoadingPage />;
    }

    const areAllCategoriesOpen = categorizedFilteredList.length > 0 && openCategories.length === categorizedFilteredList.length;
    const isFiltered = searchTerm !== '' || statusFilter !== 'all' || categoryFilter !== 'all';

    return (
        <div className="container mx-auto px-4 py-6 md:py-8 lg:px-8 max-w-7xl animate-in fade-in duration-500 pb-24">
            {/* Header Section */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold font-headline tracking-tight text-primary">Kiểm kê Tồn kho</h1>
                    {reportToView && (
                        <p className="text-muted-foreground flex items-center gap-2 mt-1 text-sm">
                            <Clock className="h-3.5 w-3.5" />
                            Đã nộp: <span className="font-medium text-foreground">{format(new Date(reportToView.submittedAt as string), "HH:mm, dd/MM/yyyy")}</span>
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button variant="outline" size="sm" onClick={() => setIsHistoryOpen(true)} className="flex-1 sm:flex-none shadow-sm h-10 border-primary/20 hover:border-primary/50">
                        <History className="mr-2 h-4 w-4 text-primary" />
                        Lịch sử
                    </Button>
                </div>
            </header>

            {!reportToView ? (
                <div className="flex flex-col items-center justify-center p-12 text-center bg-muted/30 rounded-2xl border-2 border-dashed border-muted">
                    <History className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                    <h3 className="text-xl font-semibold">Hiện không có báo cáo nào</h3>
                    <p className="text-muted-foreground mt-2 max-w-xs">Hãy để nhân viên nộp báo cáo kiểm kê trước khi bạn có thể xem chi tiết.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Main Content Area */}
                    <div className="lg:col-span-8 flex flex-col gap-6">
                        
                        {/* Summary & Filters Header */}
                        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
                            <div className="p-4 bg-muted/20 border-b flex flex-col md:flex-row justify-between items-center gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20">
                                        <User className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Người báo cáo</p>
                                        <p className="font-bold text-base leading-none">{reportToView.staffName}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 w-full md:w-auto">
                                    <Button variant="ghost" size="sm" onClick={handleToggleAll} className="h-9 text-xs font-semibold">
                                        <ChevronsDownUp className="mr-1.5 h-3.5 w-3.5" />
                                        {areAllCategoriesOpen ? "Thu gọn hết" : "Mở rộng hết"}
                                    </Button>
                                </div>
                            </div>
                            
                            {/* Filter Section */}
                            <div className="p-4 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                    <div className="md:col-span-5 relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                        <Input 
                                            placeholder="Tìm tên hàng hóa..." 
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-9 h-10 bg-muted/5 border-muted-foreground/20 focus:bg-background"
                                        />
                                        {searchTerm && (
                                            <button 
                                                onClick={() => setSearchTerm('')} 
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                    <div className="md:col-span-3">
                                        <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as any)}>
                                            <SelectTrigger className="h-10 bg-muted/5">
                                                <div className="flex items-center gap-2">
                                                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <SelectValue placeholder="Tình trạng" />
                                                </div>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Tất cả tình trạng</SelectItem>
                                                <SelectItem value="ok">Bình thường / Dư</SelectItem>
                                                <SelectItem value="low">Sắp hết hàng</SelectItem>
                                                <SelectItem value="out">Cần đặt gấp (Hết)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="md:col-span-4">
                                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                            <SelectTrigger className="h-10 bg-muted/5">
                                                <div className="flex items-center gap-2">
                                                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <SelectValue placeholder="Danh mục" />
                                                </div>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Tất cả danh mục</SelectItem>
                                                {categories.map(cat => (
                                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {isFiltered && (
                                    <div className="flex items-center justify-between pt-2 border-t border-dashed">
                                        <p className="text-xs text-muted-foreground italic">
                                            Tìm thấy <span className="font-bold text-foreground">{filteredCheckedItems.length}</span> mặt hàng phù hợp
                                        </p>
                                        <Button variant="link" size="sm" onClick={clearFilters} className="h-auto p-0 text-xs text-primary font-bold">
                                            Xoá bộ lọc
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <Tabs defaultValue="checked" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted/50 p-1 rounded-lg h-12">
                                <TabsTrigger value="checked" className="rounded-md font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                    Đã kiểm kê ({checkedItems.length})
                                </TabsTrigger>
                                <TabsTrigger value="unchecked" className="rounded-md font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                    Chưa kiểm kê ({uncheckedItems.length})
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="checked" className="space-y-4 m-0">
                                {categorizedFilteredList.length === 0 ? (
                                    <div className="p-12 text-center bg-muted/20 border-2 border-dashed rounded-2xl">
                                        <Search className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                                        <p className="text-muted-foreground">Không tìm thấy mặt hàng nào khớp với tìm kiếm.</p>
                                    </div>
                                ) : (
                                    <Accordion type="multiple" value={openCategories} onValueChange={setOpenCategories} className="w-full space-y-4">
                                        {categorizedFilteredList.map(({ category, items }) => (
                                            <AccordionItem value={category} key={category} className="border bg-card rounded-xl overflow-hidden shadow-sm">
                                                <AccordionTrigger className="text-base md:text-lg font-bold hover:no-underline px-5 py-4 bg-primary/5 data-[state=open]:bg-primary/5 border-b border-transparent data-[state=open]:border-muted">
                                                    <div className="flex items-center gap-3 text-left">
                                                        <span className="h-6 w-1.5 bg-primary rounded-full"></span>
                                                        <span>{category}</span>
                                                        <Badge variant="secondary" className="ml-2 bg-background border-primary/10 text-primary">
                                                            {items.length}
                                                        </Badge>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="p-0">
                                                    <div className="divide-y divide-muted/50">
                                                        {items.map(item => {
                                                            const stockValue = reportToView.stockLevels[item.id]?.stock;
                                                            const status = getItemStatus(item, stockValue);
                                                            const statusInfo = getStatusInfo(status);
                                                            const photos = reportToView.stockLevels[item.id]?.photos ?? [];
                                                            return (
                                                                <div key={item.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:bg-muted/5">
                                                                    <div className="flex-1 space-y-1">
                                                                        <div className="flex items-center gap-2">
                                                                            {item.requiresPhoto && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 shrink-0" />}
                                                                            <h4 className="font-bold text-foreground leading-tight">{item.name}</h4>
                                                                        </div>
                                                                        <div className="flex flex-wrap items-center gap-3 text-xs md:text-sm text-muted-foreground">
                                                                            <span className="flex items-center gap-1.5"><Badge variant="outline" className="font-normal border-muted-foreground/30 capitalize">{item.unit}</Badge></span>
                                                                            <span className="flex items-center gap-1">Tối thiểu: <span className="font-semibold text-foreground">{item.minStock}</span></span>
                                                                            <Badge className={cn("px-2 py-0 h-5 border font-semibold", statusInfo.color)}>
                                                                                {statusInfo.label}
                                                                            </Badge>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center md:items-end flex-row md:flex-col justify-between md:justify-center gap-4">
                                                                        <div className="text-right">
                                                                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-tighter">Tồn thực tế</p>
                                                                            <p className="text-xl md:text-2xl font-black text-primary leading-none">
                                                                                {stockValue ?? '0'}
                                                                            </p>
                                                                        </div>

                                                                        {photos.length > 0 && (
                                                                            <div className="flex gap-1.5">
                                                                                {photos.map((photo, index) => (
                                                                                    <button
                                                                                        key={index}
                                                                                        onClick={() => openLightbox(photos.map(p => ({ src: p })), index)}
                                                                                        className="relative w-12 h-12 rounded-lg overflow-hidden border-2 border-card ring-1 ring-muted transition-transform active:scale-95"
                                                                                    >
                                                                                        <Image src={photo} alt={`Photo for ${item.name}`} fill className="object-cover" />
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                )}
                            </TabsContent>

                            <TabsContent value="unchecked" className="m-0">
                                {uncheckedItems.length === 0 ? (
                                    <div className="p-12 text-center bg-green-500/5 border-2 border-dashed border-green-500/20 rounded-2xl">
                                        <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
                                        <p className="text-green-600 font-semibold mb-1">Tất cả đã được kiểm kê!</p>
                                        <p className="text-muted-foreground text-sm">Không còn mặt hàng nào bị bỏ sót.</p>
                                    </div>
                                ) : (
                                    <Card className="rounded-xl overflow-hidden shadow-sm">
                                        <CardHeader className="bg-muted/30 pb-4 border-b">
                                            <CardTitle className="text-lg">Danh sách mặt hàng bỏ sót</CardTitle>
                                            <CardDescription>Các mặt hàng có trong danh mục nhưng chưa có số liệu kiểm kê.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 divide-x divide-y divide-muted/50 border-b">
                                                {categorizedUncheckedList.map(({ category, items }) => (
                                                    <div key={category} className="p-5">
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <div className="h-5 w-1.5 bg-muted-foreground/30 rounded-full" />
                                                            <h4 className="font-bold text-primary">{category}</h4>
                                                            <Badge variant="outline" className="text-[10px] h-4 px-1">{items.length}</Badge>
                                                        </div>
                                                        <ul className="space-y-2">
                                                            {items.map(item => (
                                                                <li key={item.id} className="text-sm flex items-center gap-2 text-muted-foreground group">
                                                                    <div className="h-1 w-1 rounded-full bg-muted-foreground/40 group-hover:bg-primary transition-colors" />
                                                                    {item.name}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* Order Suggestions Column */}
                    <aside className="lg:col-span-4" ref={suggestionsCardRef}>
                        <Card className="sticky top-6 rounded-2xl shadow-lg border-2 border-primary/10 overflow-hidden">
                            <div className="bg-primary/5 p-5 border-b flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-primary rounded-lg text-primary-foreground shadow-sm">
                                        <ShoppingCart className="h-5 w-5" />
                                    </div>
                                    <CardTitle className="text-lg">Đề xuất đặt hàng</CardTitle>
                                </div>
                                <div className="flex gap-1">
                                    <Button size="icon" variant="ghost" onClick={handleRegenerateSuggestions} disabled={isGenerating} className="h-10 w-10 text-primary">
                                        {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
                                    </Button>
                                    {reportToView.suggestions && reportToView.suggestions.ordersBySupplier && reportToView.suggestions.ordersBySupplier.length > 0 && (
                                        <Button size="icon" variant="ghost" onClick={handleCopySuggestions} className="h-10 w-10 text-primary">
                                            <Copy className="h-5 w-5" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                            
                            <CardContent className="p-5">
                                {reportToView.suggestions && reportToView.suggestions.ordersBySupplier.length > 0 ? (
                                    <div className="space-y-6">
                                        <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
                                            <p className="text-sm font-bold text-primary leading-relaxed">{reportToView.suggestions.summary}</p>
                                        </div>
                                        
                                        <div className="space-y-5">
                                            {reportToView.suggestions.ordersBySupplier.map((orderBySupplier) => (
                                                <div key={orderBySupplier.supplier} className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <h5 className="font-bold text-foreground text-sm uppercase tracking-wide flex items-center gap-2">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                                            {orderBySupplier.supplier}
                                                        </h5>
                                                        <Badge variant="outline" className="font-normal text-[10px]">
                                                            {orderBySupplier.itemsToOrder.length} món
                                                        </Badge>
                                                    </div>
                                                    <div className="bg-muted/10 rounded-xl border border-muted divide-y divide-muted overflow-hidden">
                                                        {orderBySupplier.itemsToOrder.map((orderItem) => {
                                                            const fullItem = inventoryList.find(i => i.id === orderItem.itemId);
                                                            return (
                                                                <div key={orderItem.itemId} className="p-3 flex justify-between items-center gap-4 hover:bg-muted/30 transition-colors">
                                                                    <span className="text-sm font-medium">{fullItem?.name || 'Không rõ'}</span>
                                                                    <span className="text-sm font-black text-primary bg-primary/5 px-2 py-1 rounded">
                                                                        {orderItem.quantityToOrder}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        
                                        <Button className="w-full h-11 shadow-md font-bold" onClick={handleCopySuggestions}>
                                            <Copy className="mr-2 h-4 w-4" /> Sao chép tất cả
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-center py-12 gap-4">
                                        <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-2">
                                            {reportToView.suggestions ? (
                                                <CheckCircle className="text-green-500 h-10 w-10" />
                                            ) : (
                                                <AlertCircle className="text-yellow-500 h-10 w-10" />
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-base">
                                                {reportToView.suggestions ? 'Tất cả hàng hoá đã đủ!' : 'Chưa có đề xuất nào'}
                                            </h4>
                                            <p className="text-muted-foreground text-sm mt-1 max-w-[200px] mx-auto">
                                                {reportToView.suggestions ? 'Kiểm kê cho thấy kho vẫn còn đủ hàng cho vận hành.' : 'Nhấn nút làm mới ở phía trên để tạo đề xuất đặt hàng mới.'}
                                            </p>
                                        </div>
                                        {!reportToView.suggestions && (
                                            <Button variant="outline" size="sm" onClick={handleRegenerateSuggestions} disabled={isGenerating}>
                                                Tạo đề xuất ngay
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </aside>
                </div>
            )}

            {/* Floating Action Button for Mobile */}
            <div className="fixed bottom-6 right-6 z-40 lg:hidden">
                <Button
                    className="rounded-full shadow-2xl h-14 w-14 p-0 bg-primary hover:bg-primary/90"
                    onClick={scrollToSuggestions}
                    aria-label="Xem đề xuất đặt hàng"
                >
                    <ShoppingCart className="h-6 w-6" />
                </Button>
            </div>

            {/* History Dialog & AlertDialog - Keeping existing implementations */}
            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen} dialogTag="inventory-history-dialog" parentDialogTag="root">
                <DialogContent className="max-w-xl p-0 overflow-hidden sm:rounded-2xl">
                    <div className="bg-primary/5 px-6 py-5 border-b flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <History className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold">Lịch sử Báo báo</DialogTitle>
                            <DialogDescription className="text-sm">Danh sách báo cáo gần đây</DialogDescription>
                        </div>
                    </div>
                    
                    <div className="max-h-[60vh] overflow-y-auto px-1 relative pb-6">
                        {isProcessing && (
                            <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center z-10 animate-in fade-in">
                                <Loader2 className="h-10 w-10 animate-spin text-primary mb-2" />
                                <p className="text-sm font-bold text-primary">Đang xử lý...</p>
                            </div>
                        )}
                        
                        <div className="p-5 space-y-6">
                            {Object.entries(groupedHistory).map(([date, reports]) => (
                                <div key={date} className="space-y-3">
                                    <h4 className="font-black text-xs uppercase tracking-widest text-muted-foreground/70 bg-muted/50 py-1 px-3 rounded-md w-fit">Ngày {date}</h4>
                                    <div className="space-y-2">
                                        {reports.map(report => (
                                            <div key={report.id} className={cn(
                                                "flex justify-between items-center p-4 border rounded-xl transition-all hover:border-primary/30 group",
                                                report.id === selectedReport?.id ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20" : "bg-card"
                                            )}>
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-black group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                                        {report.staffName.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm">{report.staffName}</p>
                                                        <p className="text-xs text-muted-foreground">Lúc {format(new Date(report.submittedAt as string), "HH:mm")}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant={report.id === selectedReport?.id ? 'default' : 'ghost'}
                                                        size="sm"
                                                        className="h-8 rounded-lg font-bold text-xs"
                                                        onClick={() => {
                                                            setSelectedReport(report);
                                                            setIsHistoryOpen(false);
                                                        }}
                                                    >
                                                        Xem
                                                    </Button>
                                                    
                                                    {user?.role === 'Chủ nhà hàng' && (
                                                        <AlertDialog dialogTag="alert-dialog" parentDialogTag="root" variant="destructive">
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg">
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent className="rounded-2xl">
                                                                <AlertDialogHeader>
                                                                    <AlertDialogIcon icon={Trash2} />
                                                                    <div className="space-y-2 text-center sm:text-left">
                                                                        <AlertDialogTitle>Xóa báo cáo này?</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            Xóa báo cáo của <span className="font-bold text-foreground">{report.staffName}</span> vào lúc <span className="font-bold text-foreground">{format(new Date(report.submittedAt as string), "HH:mm, dd/MM/yyyy")}</span>? Hành động này không thể hoàn tác.
                                                                        </AlertDialogDescription>
                                                                    </div>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter className="mt-6">
                                                                    <AlertDialogCancel className="rounded-xl">Hủy</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleDeleteReport(report.id)} className="rounded-xl bg-destructive text-destructive-foreground">Xóa vĩnh viễn</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}


export default function InventoryReportPage() {
    return (
        <Suspense fallback={<LoadingPage />}>
            <InventoryReportView />
        </Suspense>
    )
}
