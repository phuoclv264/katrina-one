

'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { dataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { InventoryItem, PriceHistoryEntry, StockHistoryEntry } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Filter, History } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SupplierCombobox } from '@/components/supplier-combobox';

type CombinedHistoryEntry = (StockHistoryEntry | PriceHistoryEntry) & {
    itemName: string;
    itemUnit: string;
    supplier: string;
    type: 'stock' | 'price';
};

export default function InventoryHistoryPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
    const [suppliers, setSuppliers] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [filterItemId, setFilterItemId] = useState<string>('all');
    const [filterSupplier, setFilterSupplier] = useState<string>('');
    const [filterType, setFilterType] = useState<string>('all');

    useEffect(() => {
        if (!authLoading) {
            if (!user || user.role !== 'Chủ nhà hàng') {
                router.replace('/');
            }
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (!user) return;
        let inventorySubscribed = false;
        let suppliersSubscribed = false;

        const checkLoadingDone = () => {
            if (inventorySubscribed && suppliersSubscribed) {
                setIsLoading(false);
            }
        };

        const unsubSuppliers = dataStore.subscribeToSuppliers((supplierList) => {
            setSuppliers(supplierList);
            suppliersSubscribed = true;
            checkLoadingDone();
        });
        const unsubInventory = dataStore.subscribeToInventoryList((items) => {
            setInventoryList(items);
            inventorySubscribed = true;
            checkLoadingDone();
        });

        return () => {
            unsubSuppliers();
            unsubInventory();
        };
    }, [user]);

    const combinedHistory = useMemo(() => {
        const history: CombinedHistoryEntry[] = [];
        inventoryList.forEach(item => {
            (item.stockHistory || []).forEach(entry => {
                history.push({ ...entry, itemName: item.name, itemUnit: item.unit, supplier: item.supplier, type: 'stock' });
            });
            (item.priceHistory || []).forEach(entry => {
                history.push({ ...entry, itemName: item.name, itemUnit: item.unit, supplier: item.supplier, type: 'price' });
            });
        });
        return history.sort((a, b) => new Date(b.date as string).getTime() - new Date(a.date as string).getTime());
    }, [inventoryList]);

    const filteredHistory = useMemo(() => {
        return combinedHistory.filter(entry => {
            if (filterItemId !== 'all' && entry.itemName !== inventoryList.find(i => i.id === filterItemId)?.name) {
                return false;
            }
            if (filterSupplier && entry.supplier !== filterSupplier) {
                return false;
            }
            if (filterType !== 'all' && entry.source !== filterType) {
                return false;
            }
            return true;
        });
    }, [combinedHistory, filterItemId, filterSupplier, filterType, inventoryList]);

    const formatTimestamp = (timestamp: any) => {
        if (!timestamp) return 'N/A';
        try {
            const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp.toDate();
            return format(date, 'dd/MM/yyyy HH:mm', { locale: vi });
        } catch (error) {
            return 'Invalid Date';
        }
    };
    
    const getSourceTypeLabel = (source: string) => {
        switch(source) {
            case 'expense_slip': return 'Nhập hàng (Phiếu chi)';
            case 'inventory_check': return 'Kiểm kê kho';
            case 'manual_adjustment': return 'Điều chỉnh thủ công';
            default: return source;
        }
    }


    if (isLoading || authLoading) {
        return (
            <div className="container mx-auto p-4 sm:p-6 md:p-8">
                <header className="mb-8"><Skeleton className="h-10 w-1/2" /></header>
                <Card><CardContent><Skeleton className="h-96 w-full" /></CardContent></Card>
            </div>
        );
    }
    
    return (
        <div className="container mx-auto max-w-7xl p-4 sm:p-6 md:p-8">
            <header className="mb-8">
                <Button asChild variant="ghost" className="-ml-4 mb-4">
                    <Link href="/inventory-management">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Quay lại QL Hàng tồn kho
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><History/> Lịch sử Kho</h1>
                <p className="text-muted-foreground mt-2">
                    Truy vết mọi thay đổi về giá cả và số lượng tồn kho của tất cả mặt hàng.
                </p>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Filter/> Bộ lọc</CardTitle>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
                        <Select value={filterItemId} onValueChange={setFilterItemId}>
                            <SelectTrigger><SelectValue placeholder="Lọc theo mặt hàng..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tất cả mặt hàng</SelectItem>
                                {inventoryList.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <SupplierCombobox suppliers={suppliers} value={filterSupplier} onChange={setFilterSupplier} />
                        <Select value={filterType} onValueChange={setFilterType}>
                            <SelectTrigger><SelectValue placeholder="Lọc theo loại sự kiện..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tất cả sự kiện</SelectItem>
                                <SelectItem value="expense_slip">Nhập hàng</SelectItem>
                                <SelectItem value="inventory_check">Kiểm kê</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="outline" onClick={() => { setFilterItemId('all'); setFilterSupplier(''); setFilterType('all'); }}>Xóa bộ lọc</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Thời gian</TableHead>
                                    <TableHead>Tên mặt hàng</TableHead>
                                    <TableHead>Sự kiện</TableHead>
                                    <TableHead>Chi tiết</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredHistory.length > 0 ? filteredHistory.map((entry, index) => (
                                    <TableRow key={`${entry.sourceId}-${index}`}>
                                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatTimestamp(entry.date)}</TableCell>
                                        <TableCell className="font-semibold">{entry.itemName}</TableCell>
                                        <TableCell>{getSourceTypeLabel(entry.source)}</TableCell>
                                        <TableCell>
                                            {entry.type === 'stock' ? (
                                                <p className={ (entry as StockHistoryEntry).change >= 0 ? "text-green-600" : "text-red-600"}>
                                                    {(entry as StockHistoryEntry).change > 0 ? '+' : ''}{(entry as StockHistoryEntry).change} {entry.itemUnit}
                                                    <span className="text-muted-foreground ml-2">(còn {(entry as StockHistoryEntry).newStock})</span>
                                                </p>
                                            ) : (
                                                <p className="text-blue-600">
                                                    Đơn giá mới: {(entry as PriceHistoryEntry).price.toLocaleString('vi-VN')}đ
                                                </p>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">Không có dữ liệu lịch sử nào khớp.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
