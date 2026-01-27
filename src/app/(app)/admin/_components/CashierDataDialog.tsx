import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { AlertTriangle, Banknote, Camera, Eye, Receipt, User, X } from 'lucide-react';
import type { RevenueStats, ExpenseSlip, IncidentReport, InventoryItem, CashHandoverReport } from '@/lib/types';
import { cn, generateShortName } from '@/lib/utils';
import { useLightbox } from '@/contexts/lightbox-context';

interface CashierDataDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    dateLabel: string;
    revenueStats: RevenueStats[];
    expenseSlips: ExpenseSlip[];
    incidents: IncidentReport[];
    inventoryList: InventoryItem[];
    handoverByDate?: Record<string, CashHandoverReport[] | null>;
}

export function CashierDataDialog({
    isOpen,
    onOpenChange,
    dateLabel,
    revenueStats,
    expenseSlips,
    incidents,
    inventoryList,
    handoverByDate,
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
        <Dialog open={isOpen} onOpenChange={onOpenChange} dialogTag="cashier-data-dialog" parentDialogTag="root">
            <DialogContent
                className="max-w-4xl h-[92vh] sm:h-[85vh] flex flex-col p-0 gap-0 bg-gray-50 dark:bg-gray-950 sm:rounded-[2.5rem] overflow-hidden"
            >
                <DialogHeader iconkey="wallet" variant="premium">
                    <DialogTitle>Dữ liệu Thu ngân - {dateLabel}</DialogTitle>
                    <DialogDescription>Chi tiết doanh thu, chi phí và sự cố trong khoảng thời gian này.</DialogDescription>
                </DialogHeader>

                <DialogBody className="flex-1 overflow-hidden flex flex-col p-0 bg-transparent">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden min-h-0">
                        <div className="px-4 py-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b sticky top-0 z-10">
                            <TabsList className="grid w-full grid-cols-3 bg-gray-100/50 dark:bg-gray-800/50 p-1 rounded-xl">
                                <TabsTrigger 
                                    value="revenue" 
                                    className="flex items-center gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-700"
                                >
                                    <Banknote className="h-4 w-4" />
                                    <span className="hidden sm:inline">Doanh thu</span>
                                    <Badge variant="secondary" className="ml-0.5 px-1.5 py-0 text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-none">{revenueStats.length}</Badge>
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="expense" 
                                    className="flex items-center gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-700"
                                >
                                    <Receipt className="h-4 w-4" />
                                    <span className="hidden sm:inline">Chi phí</span>
                                    <Badge variant="secondary" className="ml-0.5 px-1.5 py-0 text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-none">{expenseSlips.length}</Badge>
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="incident" 
                                    className="flex items-center gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-700"
                                >
                                    <AlertTriangle className="h-4 w-4" />
                                    <span className="hidden sm:inline">Sự cố</span>
                                    <Badge variant="secondary" className="ml-0.5 px-1.5 py-0 text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-none">{incidents.length}</Badge>
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <ScrollArea className="flex-1 px-3 sm:px-6 py-4">
                            <TabsContent value="revenue" className="mt-0 space-y-4 pb-8">
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

                                        // Find associated handover report (prefer linked report) for this stat's date (provided via prop)
                                        const handoversForDate = handoverByDate?.[stat.date] ?? null;
                                        const associatedHandover = handoversForDate
                                            ? (handoversForDate.find(h => h.linkedRevenueStatsId === stat.id) ?? handoversForDate[handoversForDate.length - 1])
                                            : null;

                                        // Compute expected cash: prefer explicit expectedCash, otherwise derive from linked revenue stat and linked expense slips, fallback to receipt-derived values
                                        const receipt = associatedHandover?.finalHandoverDetails?.receiptData;

                                        // linked revenue stat referenced by the handover report (if any)
                                        const linkedRevenueStat = associatedHandover?.linkedRevenueStatsId ? revenueStats.find((s) => s.id === associatedHandover.linkedRevenueStatsId) : null;

                                        // collect linked expense slips using the slip IDs stored on the handover report
                                        const linkedExpenseSlips = Array.isArray(associatedHandover?.linkedExpenseSlipIds) ? associatedHandover!.linkedExpenseSlipIds.map((id) => expenseSlips.find((s) => s.id === id)).filter(Boolean) as ExpenseSlip[] : [];

                                        // sum only cash-paid amounts from linked slips
                                        const totalLinkedExpenseCash = linkedExpenseSlips.reduce((sum, slip) => {
                                            const amt = (slip.actualPaidAmount ?? slip.totalAmount ?? 0);
                                            return sum + (slip.paymentMethod === 'cash' ? amt : 0);
                                        }, 0);

                                        const expectedFromLinked = linkedRevenueStat ? ((linkedRevenueStat.revenueByPaymentMethod?.cash ?? 0) - totalLinkedExpenseCash + (associatedHandover?.startOfDayCash ?? 0)) : null;

                                        const expectedCash: number | null = receipt?.expectedCash ?? (expectedFromLinked !== null ? expectedFromLinked : (receipt ? ((receipt.cashRevenue ?? 0) - (receipt.cashExpense ?? 0)) : null));

                                        const diff: number | null = (expectedCash !== null && associatedHandover) ? (associatedHandover.actualCashCounted - expectedCash) : null;
                                        const diffClass = diff === null ? 'text-muted-foreground' : diff > 0 ? 'text-green-700 dark:text-green-400' : diff < 0 ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground';

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
                                                <Card className="overflow-hidden border-none shadow-soft bg-white/70 dark:bg-gray-900/40 backdrop-blur-sm rounded-2xl ring-1 ring-black/5 dark:ring-white/5">
                                                    <CardHeader className="p-4 bg-gradient-to-r from-green-500/10 to-transparent dark:from-green-500/5 flex flex-row items-start justify-between space-y-0">
                                                        <div className="flex flex-col gap-1.5">
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="outline" className="bg-white dark:bg-gray-800 border-green-200 dark:border-green-900/50 text-green-700 dark:text-green-400 font-bold px-2 py-0">
                                                                    {formatDay(stat.date)}
                                                                </Badge>
                                                                {updatedAt && (
                                                                    <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60">
                                                                        {updatedAt}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400">
                                                                <User className="h-3 w-3" />
                                                                <span>{createdByName}</span>
                                                            </div>
                                                        </div>
                                                        <div className="text-right flex flex-col items-end gap-1">
                                                            <div className="font-black text-green-700 dark:text-green-400 text-xl tracking-tight leading-none">
                                                                {formatCurrency(stat.netRevenue)}
                                                            </div>
                                                            {delta !== null && (
                                                                <div className={cn("text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-white/50 dark:bg-black/20", deltaClass)}>
                                                                    {delta >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(delta))}
                                                                </div>
                                                            )}
                                                            {stat.invoiceImageUrl && (
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="mt-1 h-7 px-2 rounded-full hover:bg-green-100 dark:hover:bg-green-900/40 text-green-700 dark:text-green-300 flex items-center gap-1.5 transition-colors"
                                                                    onClick={() => openLightbox([{ src: stat.invoiceImageUrl! }], 0)}
                                                                >
                                                                    <Eye className="h-3.5 w-3.5" />
                                                                    <span className="text-[10px] font-bold uppercase tracking-wider">Xem ảnh</span>
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="p-4 pt-0">
                                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pb-4 border-b border-gray-100 dark:border-gray-800">
                                                            <div className="space-y-0.5">
                                                                <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">Tiền mặt</p>
                                                                <p className="font-semibold text-sm">{formatCurrency(stat.revenueByPaymentMethod?.cash || 0)}</p>
                                                            </div>
                                                            <div className="space-y-0.5">
                                                                <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">Chuyển khoản</p>
                                                                <p className="font-semibold text-sm">{formatCurrency(stat.revenueByPaymentMethod?.bankTransfer || 0)}</p>
                                                            </div>
                                                            <div className="space-y-0.5">
                                                                <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">GrabFood</p>
                                                                <p className="font-semibold text-sm">{formatCurrency(stat.revenueByPaymentMethod?.grabFood || 0)}</p>
                                                            </div>
                                                            <div className="space-y-0.5">
                                                                <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">ShopeeFood</p>
                                                                <p className="font-semibold text-sm">{formatCurrency(stat.revenueByPaymentMethod?.shopeeFood || 0)}</p>
                                                            </div>
                                                            <div className="space-y-0.5">
                                                                <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">TCB VietQR</p>
                                                                <p className="font-semibold text-sm">{formatCurrency(stat.revenueByPaymentMethod?.techcombankVietQrPro || 0)}</p>
                                                            </div>
                                                        </div>

                                                        <div className="mt-4 pt-0">
                                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                                                                <div className="space-y-1">
                                                                    <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">Tiền mặt thực tế</p>
                                                                    {associatedHandover ? (
                                                                        <div className="flex items-baseline gap-2">
                                                                            <span className="text-lg font-black tracking-tight">{formatCurrency(associatedHandover.actualCashCounted)}</span>
                                                                            {diff !== null && (
                                                                                <Badge variant="secondary" className={cn("text-[10px] font-bold py-0 h-5 border-none", diff === 0 ? "bg-gray-100 text-gray-500" : diff > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                                                                                    {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-sm font-medium text-muted-foreground italic">Chưa có thông tin bàn giao</span>
                                                                    )}
                                                                </div>

                                                                {associatedHandover && (
                                                                    <div className="flex flex-col gap-1 sm:items-end">
                                                                        {associatedHandover.discrepancyReason && (
                                                                            <p className="text-[11px] text-muted-foreground leading-snug max-w-[200px] sm:text-right">
                                                                                <span className="font-bold">Lý do:</span> {associatedHandover.discrepancyReason}
                                                                            </p>
                                                                        )}
                                                                        {associatedHandover.discrepancyProofPhotos && associatedHandover.discrepancyProofPhotos.length > 0 && (
                                                                            <Button
                                                                                type="button"
                                                                                variant="secondary"
                                                                                size="sm"
                                                                                className="h-6 px-2 rounded-lg bg-white dark:bg-gray-700/50 hover:bg-gray-50 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors self-start sm:self-auto"
                                                                                onClick={() => openLightbox(associatedHandover.discrepancyProofPhotos!.map(p => ({ src: p })), 0)}
                                                                            >
                                                                                <Camera className="h-3 w-3" />
                                                                                <span>Xem chứng từ ({associatedHandover.discrepancyProofPhotos.length})</span>
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
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
                                                <Card className="overflow-hidden border-none shadow-soft bg-white/70 dark:bg-gray-900/40 backdrop-blur-sm rounded-2xl ring-1 ring-black/5 dark:ring-white/5">
                                                    <CardHeader className="p-4 bg-gradient-to-r from-orange-500/10 to-transparent dark:from-orange-500/5 flex flex-row items-start justify-between space-y-0">
                                                        <div className="flex flex-col gap-1.5 min-w-0 pr-2">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <Badge variant="outline" className="bg-white dark:bg-gray-800 border-orange-200 dark:border-orange-900/50 text-orange-700 dark:text-orange-400 font-bold px-2 py-0">
                                                                    {formatDay(slip.date)}
                                                                </Badge>
                                                                {formatTime(slip.createdAt) && (
                                                                    <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60">
                                                                        {formatTime(slip.createdAt)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="font-bold text-gray-900 dark:text-gray-100 text-sm line-clamp-2 leading-tight">
                                                                {slip.items
                                                                    .map((i) => {
                                                                        const invShortName = getInventoryShortNameById(i.itemId);
                                                                        const label = invShortName ?? getShortItemName(i.name);
                                                                        return `${label} (${formatQty(i.quantity)})`;
                                                                    })
                                                                    .join(', ')}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                                                                <User className="h-3 w-3" />
                                                                <span>{slip.createdBy?.userName || 'Không rõ'}</span>
                                                            </div>
                                                        </div>
                                                        <div className="text-right flex flex-col items-end gap-1 shrink-0">
                                                            <div className="font-black text-orange-700 dark:text-orange-400 text-lg tracking-tight leading-none">
                                                                {formatCurrency(slip.actualPaidAmount ?? slip.totalAmount)}
                                                            </div>
                                                            {!!slip.attachmentPhotos?.length && (
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="mt-1 h-7 px-2 rounded-full hover:bg-orange-100 dark:hover:bg-orange-900/40 text-orange-700 dark:text-orange-300 flex items-center gap-1.5 transition-colors"
                                                                    onClick={() => openLightbox(slip.attachmentPhotos!.map((p) => ({ src: p })), 0)}
                                                                >
                                                                    <Camera className="h-3.5 w-3.5" />
                                                                    <span className="text-[10px] font-bold uppercase tracking-wider">{slip.attachmentPhotos.length} ảnh</span>
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="p-4 pt-0 space-y-3">
                                                        <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">
                                                            <div className="flex items-center gap-1.5">
                                                                <Receipt className="h-3 w-3" />
                                                                <span>{slip.paymentMethod === 'cash' ? 'Tiền mặt' : slip.paymentMethod === 'bank_transfer' ? 'Chuyển khoản' : 'Khác'}</span>
                                                            </div>
                                                            <div className="h-1 w-1 rounded-full bg-gray-300 dark:bg-gray-700" />
                                                            <span>Loại: {slip.expenseType === "goods_import" ? 'Nguyên liệu' : 'Chi phí khác'}</span>
                                                        </div>

                                                        {(slip.notes || slip.items.some(i => i.description?.trim())) && (
                                                            <div className="rounded-xl bg-gray-50/80 dark:bg-gray-800/50 p-3 space-y-2 border border-gray-100 dark:border-gray-800">
                                                                {slip.items
                                                                    .filter(i => !!i.description?.trim())
                                                                    .map((i, idx) => (
                                                                        <div key={idx} className="text-xs">
                                                                            <span className="font-bold text-gray-400 uppercase tracking-tighter mr-1.5">Chi tiết:</span>
                                                                            <span className="text-gray-700 dark:text-gray-300 leading-relaxed">{i.description}</span>
                                                                        </div>
                                                                    ))}
                                                                {slip.notes && (
                                                                    <div className="text-xs">
                                                                        <span className="font-bold text-gray-400 uppercase tracking-tighter mr-1.5">Ghi chú:</span>
                                                                        <span className="text-gray-700 dark:text-gray-300 leading-relaxed">{slip.notes}</span>
                                                                    </div>
                                                                )}
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
                                                <Card className="overflow-hidden border-none shadow-soft bg-white/70 dark:bg-gray-900/40 backdrop-blur-sm rounded-2xl ring-1 ring-black/5 dark:ring-white/5">
                                                    <CardHeader className="p-4 bg-gradient-to-r from-red-500/10 to-transparent dark:from-red-500/5 flex flex-row items-start justify-between space-y-0">
                                                        <div className="flex flex-col gap-1.5 min-w-0 pr-2">
                                                            <div className="flex items-center gap-2">
                                                                <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-none font-bold px-2 py-0">
                                                                    {incident.category}
                                                                </Badge>
                                                                {formatTime(incident.createdAt) && (
                                                                    <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60">
                                                                        {formatTime(incident.createdAt)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                                                                <User className="h-3 w-3" />
                                                                <span>{incident.createdBy?.userName || 'Không rõ'}</span>
                                                            </div>
                                                        </div>
                                                        <div className="text-right flex flex-col items-end gap-1 shrink-0">
                                                            {incident.cost > 0 && (
                                                                <div className="font-black text-red-700 dark:text-red-400 text-lg tracking-tight leading-none">
                                                                    -{formatCurrency(incident.cost)}
                                                                </div>
                                                            )}
                                                            {!!incident.photos?.length && (
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="mt-1 h-7 px-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40 text-red-700 dark:text-red-300 flex items-center gap-1.5 transition-colors"
                                                                    onClick={() => openLightbox(incident.photos.map((p) => ({ src: p })), 0)}
                                                                >
                                                                    <Camera className="h-3.5 w-3.5" />
                                                                    <span className="text-[10px] font-bold uppercase tracking-wider">{incident.photos.length} ảnh</span>
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="p-4 pt-0">
                                                        <div className="rounded-xl bg-red-50/30 dark:bg-red-950/20 p-3 border border-red-100/50 dark:border-red-900/20">
                                                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-relaxed">
                                                                {incident.content}
                                                            </p>
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
                </DialogBody>
            </DialogContent>
        </Dialog>
    );
}
