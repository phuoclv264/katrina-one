'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { useRouter } from 'nextjs-toploader/app';
import { dataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import type { InventoryItem, InventoryReport, InventoryOrderSuggestion, InventoryStockRecord, OrderBySupplier, OrderItem } from '@/lib/types';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { toast } from '@/components/ui/pro-toast';
import { ArrowLeft, Loader2, Send, ShoppingCart, ChevronsDownUp, Copy, Search, Filter, Star, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import CameraDialog from '@/components/camera-dialog';
import { photoStore } from '@/lib/photo-store';
import { TooltipProvider } from '@/components/ui/tooltip';
import { InventoryItemRow } from './_components/inventory-item-row';
import { InventorySectionView, getCategoryIcon } from './_components/inventory-section-view';
import { SuggestionsDialog } from './_components/suggestions-dialog';
import WorkShiftGuard from '@/components/work-shift-guard';
import { UncheckedItemsDialog } from './_components/unchecked-items-dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ChevronLeft, ChevronRight, LayoutGrid, ListChecks, Package, UtensilsCrossed, GlassWater } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';


type ItemStatus = 'ok' | 'low' | 'out';

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

type CategorizedList = {
    category: string;
    items: InventoryItem[];
}[];

function InventoryPageComponent() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const suggestionsCardRef = useRef<HTMLDivElement>(null);
    const itemRowRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

    const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
    const [report, setReport] = useState<InventoryReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [suggestions, setSuggestions] = useState<InventoryOrderSuggestion | null>(null);
    const [isSuggestionsDialogOpen, setIsSuggestionsDialogOpen] = useState(false);
    const [initialSuggestions, setInitialSuggestions] = useState<InventoryOrderSuggestion | null>(null);

    const [hasUnsubmittedChanges, setHasUnsubmittedChanges] = useState(false);

    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [activeItemId, setActiveItemId] = useState<string | null>(null);
    const [showUncheckedWarning, setShowUncheckedWarning] = useState(false);
    const [uncheckedItems, setUncheckedItems] = useState<InventoryItem[]>([]);

    const [searchQuery, setSearchQuery] = useState('');
    const [filterTab, setFilterTab] = useState('all');
    const [activeCategory, setActiveCategory] = useState<string | null>(null);

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

        let filteredItems = inventoryList;

        // Apply Search
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filteredItems = filteredItems.filter(item => 
                item.name.toLowerCase().includes(query) || 
                (item.category && item.category.toLowerCase().includes(query))
            );
        }

        // Apply Tab Filter
        if (filterTab === 'important') {
            filteredItems = filteredItems.filter(item => item.isImportant);
        } else if (report && filterTab === 'missing') {
            filteredItems = filteredItems.filter(item => {
                const stock = report.stockLevels[item.id]?.stock;
                return stock === undefined || stock === '';
            });
        } else if (report && filterTab === 'low') {
            filteredItems = filteredItems.filter(item => {
                const stock = report.stockLevels[item.id]?.stock;
                const status = getItemStatus(item, stock);
                return status === 'low' || status === 'out';
            });
        }

        const categoryOrder: string[] = [];
        const grouped: { [key: string]: InventoryItem[] } = {};

        filteredItems.forEach(item => {
            const category = item.category || 'CHƯA PHÂN LOẠI';
            if (!grouped[category]) {
                grouped[category] = [];
                categoryOrder.push(category);
            }
            grouped[category].push(item);
        });

        return categoryOrder.map(category => ({ category, items: grouped[category] }));

    }, [inventoryList, searchQuery, filterTab, report]);

    // Cleanup active category if it's no longer in the list (e.g. filtered out)
    useEffect(() => {
        if (activeCategory && !categorizedList.find(c => c.category === activeCategory)) {
            setActiveCategory(null);
        }
    }, [categorizedList, activeCategory]);

    const stats = useMemo(() => {
        if (!inventoryList || !report) return { total: 0, checked: 0, percentage: 0 };
        const total = inventoryList.length;
        const checked = inventoryList.filter(item => {
            const stock = report.stockLevels[item.id]?.stock;
            return stock !== undefined && stock !== '';
        }).length;
        return {
            total,
            checked,
            percentage: total > 0 ? Math.round((checked / total) * 100) : 0
        };
    }, [inventoryList, report]);

    const [localPhotoUrls, setLocalPhotoUrls] = useState<Map<string, string>>(new Map());

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


    const handleReconnect = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
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
    }, [user, refreshTrigger]);

    useDataRefresher(handleReconnect);

    const handleLocalSave = useCallback((reportUpdater: (prevReport: InventoryReport | null) => InventoryReport) => {
        setReport(prevReport => {
            // The updater function now handles the null case for prevReport
            const newReport = reportUpdater(prevReport);

            (async () => {
                await dataStore.saveLocalInventoryReport(newReport);
                setHasUnsubmittedChanges(true);
            })();

            return newReport;
        });
    }, []);

    const debouncedSave = useDebouncedCallback((newReport: InventoryReport) => {
        dataStore.saveLocalInventoryReport(newReport);
        setHasUnsubmittedChanges(true);
    }, 400);

    const handleStockChange = useCallback((itemId: string, value: string) => {
        setReport(prevReport => {
            if (!prevReport) return prevReport;

            const newStockLevels = { ...prevReport.stockLevels };
            const itemDefinition = inventoryList.find(i => i.id === itemId);
            let stockValue: string | number = value;

            if (itemDefinition?.dataType === 'number') {
                stockValue = value.trim() === '' ? '' : (isNaN(parseFloat(value)) ? '' : parseFloat(value));
            }

            const existingRecord = newStockLevels[itemId] || {};
            newStockLevels[itemId] = { ...existingRecord, stock: stockValue };

            const newReport = { ...prevReport, stockLevels: newStockLevels };
            // Debounce the expensive save operation
            debouncedSave(newReport);

            // Return the new state immediately for a responsive UI
            return newReport;
        });
    }, [inventoryList, debouncedSave]);

    const handleCapturePhotos = useCallback(async (media: { id: string; type: 'photo' | 'video' }[]) => {
        const photoIds = media.filter(m => m.type === 'photo').map(m => m.id);
        if (!activeItemId || photoIds.length === 0) return;

        const newPhotoUrls = await photoStore.getPhotosAsUrls(photoIds);
        setLocalPhotoUrls(prev => new Map([...prev, ...newPhotoUrls]));

        const itemId = activeItemId;
        handleLocalSave(prevReport => {
            const reportToUpdate = prevReport || dataStore.createEmptyInventoryReport(user!.uid, user!.displayName || 'Nhân viên');
            const newStockLevels = { ...reportToUpdate.stockLevels };
            const record = { ...(newStockLevels[itemId] || { stock: '' }) };

            record.photoIds = [...(record.photoIds || []), ...photoIds];
            newStockLevels[itemId] = record;
            return { ...reportToUpdate, stockLevels: newStockLevels };
        });

        setIsCameraOpen(false);
        setActiveItemId(null);
    }, [activeItemId, handleLocalSave]);


    const handleDeletePhoto = useCallback(async (itemId: string, photoId: string, isLocal: boolean) => {
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
            await dataStore.deletePhotoFromStorage(photoId);
        }

        handleLocalSave(prevReport => {
            if (!prevReport) return dataStore.createEmptyInventoryReport(user!.uid, user!.displayName || 'Nhân viên');
            const newStockLevels = { ...prevReport.stockLevels };
            const record = { ...newStockLevels[itemId] };

            if (isLocal) {
                record.photoIds = (record.photoIds ?? []).filter(p => p !== photoId);
            } else {
                record.photos = (record.photos ?? []).filter(p => p !== photoId);
            }

            if ((record.photoIds?.length || 0) === 0 && (record.photos?.length || 0) === 0 && (record.stock === undefined || record.stock === '')) {
                delete newStockLevels[itemId];
            } else {
                newStockLevels[itemId] = record;
            }

            return { ...prevReport, stockLevels: newStockLevels };
        });
    }, [handleLocalSave, localPhotoUrls, user]);

    const handleOpenCamera = useCallback((itemId: string) => {
        setActiveItemId(itemId); setIsCameraOpen(true);
    }, []);

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

            return new Promise<InventoryOrderSuggestion | null>((resolve) => {
                const result = generateSuggestionsFromLogic();
                setInitialSuggestions(result);
                setIsSuggestionsDialogOpen(true);

                // The onSubmit of the dialog will call this function
                const handleDialogSubmit = (finalSuggestions: InventoryOrderSuggestion) => {
                    setIsSuggestionsDialogOpen(false);
                    resolve(finalSuggestions);
                };
                (window as any).handleDialogSubmit = handleDialogSubmit;
            });

        } catch (error) {
            console.error("Error generating suggestions:", error);
            toast.error("Lỗi: Không thể tạo đề xuất đặt hàng.");
            return null;
        } finally {
            setIsGenerating(false);
            toast.dismiss();
        }
    }

    const handleSuggestionDialogSubmit = (finalSuggestions: InventoryOrderSuggestion) => {
        setIsSuggestionsDialogOpen(false);
        setSuggestions(finalSuggestions);

        setTimeout(() => {
            suggestionsCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);

        // Now proceed with the actual submission
        proceedToSubmit(finalSuggestions);
    };

    const proceedToSubmit = async (suggestionsToSubmit: InventoryOrderSuggestion | null) => {
        if (!report || !user) return;
        const startTime = Date.now();
        setIsSubmitting(true);
        const toastId = toast.loading("Đang gửi báo cáo tồn kho...");

        try {
            const finalReport = {
                ...report,
                suggestions: suggestionsToSubmit,
                status: 'submitted' as const,
            };

            await dataStore.saveInventoryReport(finalReport);
            // After successful submission, we can update the local state to reflect the submitted version.
            const submittedReport = { ...finalReport, submittedAt: new Date().toISOString() };
            setReport(submittedReport);
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

    const handleSubmit = () => {
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
            handleGenerateSuggestions();
        }
    }

    const setItemRowRef = useCallback((itemId: string, el: HTMLDivElement | null) => {
        if (el) {
            itemRowRefs.current.set(itemId, el);
        }
    }, []);

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


    if (isLoading || authLoading || !report) {
        return <LoadingPage />;
    }

    const isSubmitted = report.status === 'submitted';
    const isProcessing = isSubmitting || isGenerating;
    const hasSuggestions = suggestions && suggestions.ordersBySupplier && suggestions.ordersBySupplier.length > 0;

    const handleBackToOverview = () => {
        setActiveCategory(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handlePrevCategory = () => {
        const currentIndex = categorizedList.findIndex(c => c.category === activeCategory);
        if (currentIndex > 0) {
            setActiveCategory(categorizedList[currentIndex - 1].category);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleNextCategory = () => {
        const currentIndex = categorizedList.findIndex(c => c.category === activeCategory);
        if (currentIndex < categorizedList.length - 1) {
            setActiveCategory(categorizedList[currentIndex + 1].category);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };


    return (
        <TooltipProvider>
            <div className="container mx-auto p-4 sm:p-6 md:p-8 pb-32">
                <header className="mb-6">
                    <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center">
                        <div className="flex items-center gap-4">
                            {activeCategory && (
                                <Button variant="ghost" size="icon" onClick={handleBackToOverview} className="rounded-full h-10 w-10 shrink-0">
                                    <ArrowLeft className="h-6 w-6" />
                                </Button>
                            )}
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold font-headline">Báo cáo Kiểm kê</h1>
                                <p className="text-muted-foreground text-sm">Nhập số lượng thực tế. Dữ liệu tự động lưu.</p>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="md:col-span-1 border-primary/20 bg-primary/5">
                        <CardContent className="pt-6">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium">Tiến độ tổng</span>
                                <span className="text-sm font-bold text-primary">{stats.checked}/{stats.total}</span>
                            </div>
                            <Progress value={stats.percentage} className="h-2" />
                        </CardContent>
                    </Card>

                    <div className="md:col-span-3 space-y-4 sticky top-0 z-20 bg-background/95 backdrop-blur-sm pb-4 pt-1">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input
                                placeholder="Tìm kiếm tên món..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 h-10 shadow-sm border-primary/20"
                            />
                            {searchQuery && (
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                                    onClick={() => setSearchQuery('')}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>

                        <Tabs value={filterTab} onValueChange={setFilterTab} className="w-full">
                            <TabsList className="grid grid-cols-4 w-full h-10">
                                <TabsTrigger value="all" className="text-xs sm:text-sm">Tất cả</TabsTrigger>
                                <TabsTrigger value="missing" className="text-xs sm:text-sm">Thiếu</TabsTrigger>
                                <TabsTrigger value="important" className="text-xs sm:text-sm">Sao</TabsTrigger>
                                <TabsTrigger value="low" className="text-xs sm:text-sm">Hết</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    <div className="lg:col-span-2">
                        {!activeCategory || (searchQuery.trim() && !categorizedList.find(c => c.category === activeCategory)) ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {categorizedList.length === 0 ? (
                                    <Card className="col-span-full py-12">
                                        <CardContent className="text-center space-y-3">
                                            <div className="bg-muted w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                                                <Search className="h-6 w-6 text-muted-foreground" />
                                            </div>
                                            <p className="text-muted-foreground font-medium">Không tìm thấy món nào.</p>
                                            <Button variant="outline" size="sm" onClick={() => {setSearchQuery(''); setFilterTab('all');}}>Xóa lọc</Button>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    categorizedList.map(({ category, items }) => {
                                        const categoryCheckedCount = items.filter(item => report.stockLevels[item.id]?.stock !== undefined && report.stockLevels[item.id]?.stock !== '').length;
                                        const categoryTotalCount = items.length;
                                        const categoryProgress = categoryTotalCount > 0 ? Math.round((categoryCheckedCount / categoryTotalCount) * 100) : 0;
                                        const missingCount = categoryTotalCount - categoryCheckedCount;

                                        return (
                                            <motion.div
                                                key={category}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => setActiveCategory(category)}
                                                className="group relative p-4 rounded-2xl border bg-card shadow-sm cursor-pointer hover:border-primary/50 hover:shadow-md transition-all flex flex-col gap-3"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                                        {getCategoryIcon(category)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="text-sm font-black uppercase tracking-tight text-card-foreground group-hover:text-primary transition-colors flex items-center justify-between">
                                                            <span className="truncate">{category}</span>
                                                            {missingCount > 0 && (
                                                                <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-none px-1.5 h-5 shrink-0">
                                                                    {missingCount}
                                                                </Badge>
                                                            )}
                                                        </h3>
                                                        <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mt-0.5">
                                                            {categoryCheckedCount} / {categoryTotalCount} món
                                                        </p>
                                                    </div>
                                                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                                </div>
                                                <div className="mt-auto">
                                                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                                        <motion.div 
                                                            className="h-full bg-primary"
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${categoryProgress}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })
                                )}
                            </div>
                        ) : (
                            <InventorySectionView 
                                category={activeCategory}
                                items={categorizedList.find(c => c.category === activeCategory)?.items || []}
                                report={report}
                                localPhotoUrls={localPhotoUrls}
                                isProcessing={isProcessing}
                                onStockChange={handleStockChange}
                                onOpenCamera={handleOpenCamera}
                                onDeletePhoto={handleDeletePhoto}
                                onBack={handleBackToOverview}
                                onPrev={handlePrevCategory}
                                onNext={handleNextCategory}
                                canPrev={categorizedList.findIndex(c => c.category === activeCategory) > 0}
                                canNext={categorizedList.findIndex(c => c.category === activeCategory) < categorizedList.length - 1}
                                setItemRowRef={setItemRowRef}
                            />
                        )}
                    </div>
                    <div className="lg:col-span-1 space-y-8 sticky top-4" ref={suggestionsCardRef}>
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><ShoppingCart /> Đề xuất Đặt hàng</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {isGenerating && !suggestions && (
                                    <div className="space-y-2 p-4 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                        <p className="text-sm text-muted-foreground">Đang tính toán...</p>
                                    </div>
                                )}
                                {!isGenerating && hasSuggestions && (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <p className="text-sm font-semibold text-primary">{suggestions.summary}</p>
                                            <Button size="sm" variant="ghost" onClick={handleCopySuggestions}>
                                                <Copy className="mr-2 h-4 w-4" />
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
                                {!isGenerating && !suggestions && (
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
                            <span className="ml-2">{isProcessing ? 'Đang xử lý...' : 'Gửi & Nhận đề xuất'}</span>
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
                    captureMode="photo"
                    parentDialogTag="root"
                />
                {initialSuggestions && (
                    <SuggestionsDialog
                        isOpen={isSuggestionsDialogOpen}
                        onClose={() => setIsSuggestionsDialogOpen(false)}
                        initialSuggestions={initialSuggestions}
                        inventoryList={inventoryList}
                        onSubmit={handleSuggestionDialogSubmit}
                        parentDialogTag="root"
                    />
                )}
                <UncheckedItemsDialog
                    isOpen={showUncheckedWarning}
                    onOpenChange={setShowUncheckedWarning}
                    uncheckedItems={uncheckedItems}
                    onContinue={() => {
                        setShowUncheckedWarning(false);
                        handleGenerateSuggestions();
                    }}
                    itemRowRefs={itemRowRefs}
                />
            </div>
        </TooltipProvider>
    );
}

export default function InventoryPage() {
    return (
        <WorkShiftGuard redirectPath="/bartender">
            <InventoryPageComponent />
        </WorkShiftGuard>
    )
}
