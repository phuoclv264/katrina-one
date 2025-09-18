
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { RevenueStats } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type RevenueStatsDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: Omit<RevenueStats, 'id' | 'date' | 'createdAt' | 'createdBy'>) => void;
    isProcessing: boolean;
    existingStats: RevenueStats | null;
};

export default function RevenueStatsDialog({
    open,
    onOpenChange,
    onSave,
    isProcessing,
    existingStats
}: RevenueStatsDialogProps) {
    const { toast } = useToast();
    const [netRevenue, setNetRevenue] = useState(0);
    const [orderCount, setOrderCount] = useState(0);
    const [deliveryPartnerPayout, setDeliveryPartnerPayout] = useState(0);
    const [revenueByPaymentMethod, setRevenueByPaymentMethod] = useState({
        cash: 0,
        techcombank: 0,
        vietQR: 0,
        shopeeFood: 0,
        grabFood: 0,
        other: 0,
    });

    useEffect(() => {
        if (open && existingStats) {
            setNetRevenue(existingStats.netRevenue);
            setOrderCount(existingStats.orderCount);
            setDeliveryPartnerPayout(existingStats.deliveryPartnerPayout || 0);
            setRevenueByPaymentMethod(existingStats.revenueByPaymentMethod);
        } else if (open) {
            // Reset for new entry
            setNetRevenue(0);
            setOrderCount(0);
            setDeliveryPartnerPayout(0);
            setRevenueByPaymentMethod({ cash: 0, techcombank: 0, vietQR: 0, shopeeFood: 0, grabFood: 0, other: 0 });
        }
    }, [open, existingStats]);

    const handlePaymentMethodChange = (key: keyof typeof revenueByPaymentMethod, value: string) => {
        setRevenueByPaymentMethod(prev => ({ ...prev, [key]: Number(value) }));
    };

    const totalPaymentMethods = useMemo(() => {
        return Object.values(revenueByPaymentMethod).reduce((sum, val) => sum + val, 0);
    }, [revenueByPaymentMethod]);

    const isRevenueMismatch = netRevenue > 0 && netRevenue !== totalPaymentMethods;

    const handleSave = () => {
        if (isRevenueMismatch) {
            toast({
                title: "Số liệu không khớp",
                description: "Tổng doanh thu theo phương thức thanh toán phải bằng Doanh thu Net.",
                variant: "destructive"
            });
            return;
        }

        const dataToSave = {
            netRevenue,
            orderCount,
            revenueByPaymentMethod,
            deliveryPartnerPayout,
        };

        onSave(dataToSave);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Nhập Thống kê Doanh thu</DialogTitle>
                    <DialogDescription>
                        Nhập số liệu từ bill tổng kết cuối ngày trên máy POS.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="netRevenue">Doanh thu Net</Label>
                            <Input id="netRevenue" type="number" value={netRevenue} onChange={e => setNetRevenue(Number(e.target.value))} placeholder="0" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="orderCount">Số lượng đơn</Label>
                            <Input id="orderCount" type="number" value={orderCount} onChange={e => setOrderCount(Number(e.target.value))} placeholder="0" />
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label>Doanh thu theo PTTT</Label>
                        <div className="p-4 border rounded-md grid grid-cols-2 gap-4">
                            {Object.entries(revenueByPaymentMethod).map(([key, value]) => (
                                <div key={key} className="space-y-1">
                                    <Label htmlFor={`pm-${key}`} className="text-xs capitalize">{key.replace('_', ' ')}</Label>
                                    <Input id={`pm-${key}`} type="number" value={value} onChange={e => handlePaymentMethodChange(key as any, e.target.value)} placeholder="0" />
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground">Tổng PTTT: {totalPaymentMethods.toLocaleString('vi-VN')}đ</p>
                    </div>

                    {isRevenueMismatch && (
                        <Alert variant="destructive">
                            <AlertTitle>Doanh thu không khớp!</AlertTitle>
                            <AlertDescription>
                                Doanh thu Net ({netRevenue.toLocaleString('vi-VN')}đ) không bằng Tổng PTTT ({totalPaymentMethods.toLocaleString('vi-VN')}đ).
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="deliveryPayout">Tiền trả cho Đối tác Giao hàng</Label>
                        <Input id="deliveryPayout" type="number" value={deliveryPartnerPayout} onChange={e => setDeliveryPartnerPayout(Number(e.target.value))} placeholder="0" />
                         <p className="text-xs text-muted-foreground">
                            Số tiền này sẽ được tự động tạo một phiếu chi.
                        </p>
                    </div>

                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
                    <Button onClick={handleSave} disabled={isProcessing}>
                        {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Lưu
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
