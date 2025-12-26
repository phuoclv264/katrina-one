import React, { useMemo, useState } from 'react';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { AlertTriangle, Banknote, Eye, Receipt, X } from 'lucide-react';
import type { RevenueStats, ExpenseSlip, IncidentReport, InventoryItem } from '@/lib/types';
import { generateShortName } from '@/lib/utils';
import { useLightbox } from '@/contexts/lightbox-context';

interface CashierDataDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    dateLabel: string;
    revenueStats: RevenueStats[];
    expenseSlips: ExpenseSlip[];
    incidents: IncidentReport[];
    inventoryList: InventoryItem[];
}

export function CashierDataDialog({
    isOpen,
    onOpenChange,
    dateLabel,
    revenueStats,
    expenseSlips,
    incidents,
    inventoryList,
}: CashierDataDialogProps) {
    const [activeTab, setActiveTab] = useState('revenue');
    const { openLightbox } = useLightbox();

    const toMs = (v: unknown) => {
        if (!v) return 0;
        if (typeof (v as any)?.toDate === 'function') {
            const d = (v as any).toDate();
            return d instanceof Date && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
        }
        const d = new Date(String(v));
        return Number.isNaN(d.getTime()) ? 0 : d.getTime();
    };

    const sortedExpenseSlips = useMemo(() => {
        const copy = [...expenseSlips];
        copy.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
        return copy;
    }, [expenseSlips]);

    const sortedIncidents = useMemo(() => {
        const copy = [...incidents];
        copy.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
        return copy;
    }, [incidents]);

    const revenueSnapshotMeta = useMemo(() => {
        const statMs = (s: RevenueStats) => {
            const createdAtMs = toMs(s.createdAt);
            if (createdAtMs) return createdAtMs;
            return toMs(s.reportTimestamp);
        };

        const sorted = [...revenueStats].sort((a, b) => statMs(b) - statMs(a));

        // For each stat, find the immediately previous (older) snapshot within the same day.
        const prevWithinDayById = new Map<string, RevenueStats | null>();
        const lastOlderByDate = new Map<string, RevenueStats>();
        for (let i = sorted.length - 1; i >= 0; i--) {
            const stat = sorted[i];
            const dateKey = stat.date || stat.id;
            const older = lastOlderByDate.get(dateKey) ?? null;
            prevWithinDayById.set(stat.id, older);
            lastOlderByDate.set(dateKey, stat);
        }

        return { sortedRevenueStats: sorted, prevWithinDayById, statMs };
    }, [revenueStats]);

    const getShortItemName = (name: string) => {
        const base = name.split('(')[0]?.split(' - ')[0]?.trim() || name.trim();
        if (base.length <= 18) return base;
        return `${base.slice(0, 18).trim()}…`;
    };

    const getInventoryShortNameById = (itemId: string) => {
        const inv = inventoryList.find((i) => i.id === itemId);
        if (!inv) return null;
        const short = (inv.shortName || inv.name || '').trim();
        return short.length ? short : null;
    };

    const formatQty = (qty: number) => {
        if (!Number.isFinite(qty)) return String(qty);
        if (Number.isInteger(qty)) return String(qty);
        return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(qty);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    const formatDay = (dateString: string) => {
        try {
            return format(parseISO(dateString), 'dd/MM/yyyy', { locale: vi });
        } catch (e) {
            return dateString;
        }
    };

    const formatTime = (value: unknown) => {
        try {
            if (!value) return null;
            const d = typeof (value as any)?.toDate === 'function' ? (value as any).toDate() : new Date(String(value));
            if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
            return format(d, 'HH:mm', { locale: vi });
        } catch {
            return null;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0 bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden"
                // Prevent interacting with outside elements while dialog is open
                onInteractOutside={(e: any) => e.preventDefault()}
                onPointerDownOutside={(e: any) => e.preventDefault()}
                onFocusOutside={(e: any) => e.preventDefault()}
            >
                <DialogClose asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 z-20"
                        aria-label="Đóng"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </DialogClose>

                <DialogHeader className="p-4 pb-2 bg-white dark:bg-gray-800 border-b sticky top-0 z-10">
                    <DialogTitle>Dữ liệu Thu ngân - {dateLabel}</DialogTitle>
                    <DialogDescription>Chi tiết doanh thu, chi phí và sự cố trong khoảng thời gian này.</DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden min-h-0">
                        <div className="px-4 pt-2 bg-white dark:bg-gray-800 border-b">
                            <TabsList className="grid w-full grid-cols-3 mb-2">
                                <TabsTrigger value="revenue" className="flex items-center gap-2">
                                    <Banknote className="h-4 w-4" />
                                    <span className="hidden sm:inline">Doanh thu</span>
                                    <Badge variant="secondary" className="ml-1">{revenueStats.length}</Badge>
                                </TabsTrigger>
                                <TabsTrigger value="expense" className="flex items-center gap-2">
                                    <Receipt className="h-4 w-4" />
                                    <span className="hidden sm:inline">Chi phí</span>
                                    <Badge variant="secondary" className="ml-1">{expenseSlips.length}</Badge>
                                </TabsTrigger>
                                <TabsTrigger value="incident" className="flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4" />
                                    <span className="hidden sm:inline">Sự cố</span>
                                    <Badge variant="secondary" className="ml-1">{incidents.length}</Badge>
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <ScrollArea className="flex-1 p-4">
                            <TabsContent value="revenue" className="mt-0 space-y-4">
                                {revenueSnapshotMeta.sortedRevenueStats.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">Không có dữ liệu doanh thu.</div>
                                ) : (
                                    revenueSnapshotMeta.sortedRevenueStats.map((stat, index) => {
                                        const prevStat = index > 0 ? revenueSnapshotMeta.sortedRevenueStats[index - 1] : null;
                                        const isNewDay = !prevStat || prevStat.date !== stat.date;

                                        const prev = revenueSnapshotMeta.prevWithinDayById.get(stat.id) ?? null;
                                        const delta = prev ? (stat.netRevenue || 0) - (prev.netRevenue || 0) : null;

                                        const deltaClass = delta === null
                                            ? 'text-muted-foreground'
                                            : delta > 0
                                                ? 'text-green-700 dark:text-green-400'
                                                : delta < 0
                                                    ? 'text-red-700 dark:text-red-400'
                                                    : 'text-muted-foreground';
                                        const updatedAt = formatTime(stat.createdAt) || formatTime(stat.reportTimestamp);
                                        const createdByName = stat.createdBy?.userName || '';

                                        return (
                                        <React.Fragment key={stat.id}>
                                            {isNewDay && (
                                                <div className="flex items-center gap-2 py-2 pt-4 first:pt-0">
                                                    <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                                                        {formatDay(stat.date)}
                                                    </span>
                                                    <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
                                                </div>
                                            )}
                                            <Card className="overflow-hidden border-l-4 border-l-green-500">
                                                <CardHeader className="p-3 bg-green-50/50 dark:bg-green-900/10 flex flex-row items-center justify-between space-y-0">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="bg-white dark:bg-gray-800">{formatDay(stat.date)}</Badge>
                                                        <span className="text-sm text-muted-foreground">
                                                            <span className="sm:hidden">{generateShortName(createdByName) || createdByName}</span>
                                                            <span className="hidden sm:inline">{createdByName}</span>
                                                            {updatedAt ? ` • ${updatedAt}` : ''}
                                                        </span>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-bold text-green-700 dark:text-green-400 text-lg">
                                                            {formatCurrency(stat.netRevenue)}
                                                        </div>
                                                        {delta !== null && (
                                                            <div className={`text-xs ${deltaClass}`}>
                                                                {delta >= 0 ? '+' : '-'}{formatCurrency(Math.abs(delta))}
                                                            </div>
                                                        )}
                                                        {stat.invoiceImageUrl && (
                                                            <Button
                                                                type="button"
                                                                variant="secondary"
                                                                size="sm"
                                                                className="mt-1.5 h-7 px-2.5 rounded-full bg-green-100/80 hover:bg-green-200 dark:bg-green-900/40 dark:hover:bg-green-900/60 text-green-800 dark:text-green-300 border-none flex items-center gap-1.5 transition-colors"
                                                                onClick={() => openLightbox([{ src: stat.invoiceImageUrl! }], 0)}
                                                            >
                                                                <Eye className="h-3.5 w-3.5" />
                                                                <span className="text-[10px] font-bold uppercase tracking-wider">Xem ảnh</span>
                                                            </Button>
                                                        )}
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                                                    <div>
                                                        <p className="text-muted-foreground text-xs">Tiền mặt</p>
                                                        <p className="font-medium">{formatCurrency(stat.revenueByPaymentMethod?.cash || 0)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground text-xs">Chuyển khoản</p>
                                                        <p className="font-medium">{formatCurrency(stat.revenueByPaymentMethod?.bankTransfer || 0)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground text-xs">GrabFood</p>
                                                        <p className="font-medium">{formatCurrency(stat.revenueByPaymentMethod?.grabFood || 0)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground text-xs">ShopeeFood</p>
                                                        <p className="font-medium">{formatCurrency(stat.revenueByPaymentMethod?.shopeeFood || 0)}</p>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </React.Fragment>
                                        );
                                    })
                                )}
                            </TabsContent>

                            <TabsContent value="expense" className="mt-0 space-y-4">
                                {expenseSlips.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">Không có phiếu chi nào.</div>
                                ) : (
                                    sortedExpenseSlips.map((slip, index) => {
                                        const prevSlip = index > 0 ? sortedExpenseSlips[index - 1] : null;
                                        const isNewDay = !prevSlip || prevSlip.date !== slip.date;

                                        return (
                                        <React.Fragment key={slip.id}>
                                            {isNewDay && (
                                                <div className="flex items-center gap-2 py-2 pt-4 first:pt-0">
                                                    <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                                                        {formatDay(slip.date)}
                                                    </span>
                                                    <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
                                                </div>
                                            )}
                                            <Card className="overflow-hidden border-l-4 border-l-orange-500">
                                                <CardHeader className="p-3 bg-orange-50/50 dark:bg-orange-900/10 flex flex-row items-center justify-between space-y-0">
                                                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                                        <span className="font-semibold text-sm">
                                                            {slip.items
                                                                .map((i) => {
                                                                    const invShortName = getInventoryShortNameById(i.itemId);
                                                                    const label = invShortName ?? getShortItemName(i.name);
                                                                    return `${label} × ${formatQty(i.quantity)}`;
                                                                })
                                                                .join(' • ')}
                                                        </span>
                                                        <Badge variant="outline" className="w-fit text-[10px]">{formatDay(slip.date)}</Badge>
                                                        {formatTime(slip.createdAt) && (
                                                            <span className="text-[10px] text-muted-foreground">• {formatTime(slip.createdAt)}</span>
                                                        )}
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-bold text-orange-700 dark:text-orange-400">
                                                            {formatCurrency(slip.actualPaidAmount ?? slip.totalAmount)}
                                                        </div>
                                                        {!!slip.attachmentPhotos?.length && (
                                                            <Button
                                                                type="button"
                                                                variant="secondary"
                                                                size="sm"
                                                                className="mt-1.5 h-7 px-2.5 rounded-full bg-orange-100/80 hover:bg-orange-200 dark:bg-orange-900/40 dark:hover:bg-orange-900/60 text-orange-800 dark:text-orange-300 border-none flex items-center gap-1.5 transition-colors"
                                                                onClick={() => openLightbox(slip.attachmentPhotos!.map((p) => ({ src: p })), 0)}
                                                            >
                                                                <Eye className="h-3.5 w-3.5" />
                                                                <span className="text-[10px] font-bold uppercase tracking-wider">{slip.attachmentPhotos.length} ảnh</span>
                                                            </Button>
                                                        )}
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="p-3 text-sm space-y-2">
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Người chi:</span>
                                                        <span>
                                                            <span className="sm:hidden">{generateShortName(slip.createdBy?.userName || '') || slip.createdBy?.userName}</span>
                                                            <span className="hidden sm:inline">{slip.createdBy?.userName}</span>
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Hình thức:</span>
                                                        <span className="capitalize">{slip.paymentMethod === 'cash' ? 'Tiền mặt' : slip.paymentMethod === 'bank_transfer' ? 'Chuyển khoản' : slip.paymentMethod}</span>
                                                    </div>
                                                    {slip.expenseType === 'other_cost' && slip.items.some((i) => {
                                                        const cat = (i.name || '').trim().toLowerCase();
                                                        return (cat === 'khác' || cat === 'khac') && !!i.description?.trim();
                                                    }) && (
                                                        <div className="rounded-md bg-muted/50 p-2 text-xs">
                                                            <div className="font-semibold text-muted-foreground">Chi tiết (Khác)</div>
                                                            <div className="mt-0.5 space-y-1">
                                                                {slip.items
                                                                    .filter((i) => {
                                                                        const cat = (i.name || '').trim().toLowerCase();
                                                                        return (cat === 'khác' || cat === 'khac') && !!i.description?.trim();
                                                                    })
                                                                    .map((i, idx) => (
                                                                        <div key={`${i.itemId}-${idx}`} className="whitespace-pre-wrap">
                                                                            {i.description}
                                                                        </div>
                                                                    ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {slip.notes && (
                                                        <div className="rounded-md bg-muted/50 p-2 text-xs">
                                                            <div className="font-semibold text-muted-foreground">Ghi chú</div>
                                                            <div className="mt-0.5 whitespace-pre-wrap">{slip.notes}</div>
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </React.Fragment>
                                        );
                                    })
                                )}
                            </TabsContent>

                            <TabsContent value="incident" className="mt-0 space-y-4">
                                {incidents.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">Không có sự cố nào.</div>
                                ) : (
                                    sortedIncidents.map((incident, index) => {
                                        const prevIncident = index > 0 ? sortedIncidents[index - 1] : null;
                                        const isNewDay = !prevIncident || prevIncident.date !== incident.date;

                                        return (
                                        <React.Fragment key={incident.id}>
                                            {isNewDay && (
                                                <div className="flex items-center gap-2 py-2 pt-4 first:pt-0">
                                                    <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                                                        {formatDay(incident.date)}
                                                    </span>
                                                    <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
                                                </div>
                                            )}
                                            <Card className="overflow-hidden border-l-4 border-l-red-500">
                                                <CardHeader className="p-3 bg-red-50/50 dark:bg-red-900/10 flex flex-row items-center justify-between space-y-0">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="secondary">
                                                            {incident.category}
                                                        </Badge>
                                                        <span className="text-xs text-muted-foreground">{formatDay(incident.date)}</span>
                                                        {formatTime(incident.createdAt) && (
                                                            <span className="text-xs text-muted-foreground">• {formatTime(incident.createdAt)}</span>
                                                        )}
                                                    </div>
                                                    <div className="text-right">
                                                        {incident.cost > 0 && (
                                                            <div className="font-bold text-red-700 dark:text-red-400">
                                                                -{formatCurrency(incident.cost)}
                                                            </div>
                                                        )}
                                                        {!!incident.photos?.length && (
                                                            <Button
                                                                type="button"
                                                                variant="secondary"
                                                                size="sm"
                                                                className="mt-1.5 h-7 px-2.5 rounded-full bg-red-100/80 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 text-red-800 dark:text-red-300 border-none flex items-center gap-1.5 transition-colors"
                                                                onClick={() => openLightbox(incident.photos.map((p) => ({ src: p })), 0)}
                                                            >
                                                                <Eye className="h-3.5 w-3.5" />
                                                                <span className="text-[10px] font-bold uppercase tracking-wider">{incident.photos.length} ảnh</span>
                                                            </Button>
                                                        )}
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="p-3 text-sm space-y-2">
                                                    <p className="font-medium">{incident.content}</p>
                                                    <div className="flex justify-between text-xs text-muted-foreground">
                                                        <span>
                                                            Người báo cáo:{' '}
                                                            <span className="sm:hidden">{generateShortName(incident.createdBy?.userName || '') || incident.createdBy?.userName}</span>
                                                            <span className="hidden sm:inline">{incident.createdBy?.userName}</span>
                                                        </span>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </React.Fragment>
                                        );
                                    })
                                )}
                            </TabsContent>
                        </ScrollArea>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
}
