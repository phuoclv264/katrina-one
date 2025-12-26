import React, { useState } from 'react';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { AlertTriangle, Banknote, Receipt, X } from 'lucide-react';
import type { RevenueStats, ExpenseSlip, IncidentReport, InventoryItem } from '@/lib/types';

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

    const formatDate = (dateString: string) => {
        try {
            return format(parseISO(dateString), 'dd/MM/yyyy HH:mm', { locale: vi });
        } catch (e) {
            return dateString;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0 bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden">
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
                                {revenueStats.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">Không có dữ liệu doanh thu.</div>
                                ) : (
                                    revenueStats.map((stat) => (
                                        <Card key={stat.id} className="overflow-hidden border-l-4 border-l-green-500">
                                            <CardHeader className="p-3 bg-green-50/50 dark:bg-green-900/10 flex flex-row items-center justify-between space-y-0">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="bg-white dark:bg-gray-800">{formatDate(stat.date)}</Badge>
                                                    <span className="text-sm text-muted-foreground">Tạo bởi: {stat.createdBy?.userName}</span>
                                                </div>
                                                <span className="font-bold text-green-700 dark:text-green-400 text-lg">
                                                    {formatCurrency(stat.netRevenue)}
                                                </span>
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
                                    ))
                                )}
                            </TabsContent>

                            <TabsContent value="expense" className="mt-0 space-y-4">
                                {expenseSlips.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">Không có phiếu chi nào.</div>
                                ) : (
                                    expenseSlips.map((slip) => (
                                        <Card key={slip.id} className="overflow-hidden border-l-4 border-l-orange-500">
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
                                                    <Badge variant="outline" className="w-fit text-[10px]">{formatDate(slip.date)}</Badge>
                                                </div>
                                                <span className="font-bold text-orange-700 dark:text-orange-400">
                                                    {formatCurrency(slip.actualPaidAmount ?? slip.totalAmount)}
                                                </span>
                                            </CardHeader>
                                            <CardContent className="p-3 text-sm space-y-2">
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Người chi:</span>
                                                    <span>{slip.createdBy?.userName}</span>
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
                                    ))
                                )}
                            </TabsContent>

                            <TabsContent value="incident" className="mt-0 space-y-4">
                                {incidents.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">Không có sự cố nào.</div>
                                ) : (
                                    incidents.map((incident) => (
                                        <Card key={incident.id} className="overflow-hidden border-l-4 border-l-red-500">
                                            <CardHeader className="p-3 bg-red-50/50 dark:bg-red-900/10 flex flex-row items-center justify-between space-y-0">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="secondary">
                                                        {incident.category}
                                                    </Badge>
                                                    <span className="text-xs text-muted-foreground">{formatDate(incident.date)}</span>
                                                </div>
                                                {incident.cost > 0 && (
                                                    <span className="font-bold text-red-700 dark:text-red-400">
                                                        -{formatCurrency(incident.cost)}
                                                    </span>
                                                )}
                                            </CardHeader>
                                            <CardContent className="p-3 text-sm space-y-2">
                                                <p className="font-medium">{incident.content}</p>
                                                <div className="flex justify-between text-xs text-muted-foreground">
                                                    <span>Người báo cáo: {incident.createdBy?.userName}</span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </TabsContent>
                        </ScrollArea>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
}
