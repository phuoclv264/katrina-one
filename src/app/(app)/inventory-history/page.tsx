

'use client';
import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { dataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { InventoryItem, ExpenseSlip, InventoryReport } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Filter, History, ShoppingCart, TestTube2, ArrowUp, ArrowDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SupplierCombobox } from '@/components/supplier-combobox';
import { Input } from '@/components/ui/input';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';

type CombinedHistoryEntry = {
    date: string | Date;
    itemName: string;
    itemUnit: string;
    itemSupplier: string;
    type: 'Nhập hàng' | 'Kiểm kê';
    change: string; // e.g., "+5", "-2.5", "10 -> 8"
    newStock: string;
    priceInfo: string; // e.g., "100,000đ" or "-"
    sourceId: string;
};


function InventoryHistoryView() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
    const [expenseSlips, setExpenseSlips] = useState<ExpenseSlip[]>([]);
    const [inventoryReports, setInventoryReports] = useState<InventoryReport[]>([]);
    const [suppliers, setSuppliers] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [filterItemName, setFilterItemName] = useState<string>('');
    const [filterSupplier, setFilterSupplier] = useState<string>('');
    const [filterType, setFilterType] = useState<string>('all');
    
    const [sortColumn, setSortColumn] = useState<'date' | 'itemName'>('date');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');


    useEffect(() => {
        if (!authLoading && (!user || user.role !== 'Chủ nhà hàng')) {
            router.replace('/');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (!user) return;
        
        const unsubInventory = dataStore.subscribeToInventoryList(setInventoryList);
        const unsubSuppliers = dataStore.subscribeToSuppliers(setSuppliers);
        const unsubExpenses = dataStore.subscribeToAllExpenseSlips(setExpenseSlips);
        const unsubReports = dataStore.subscribeToAllInventoryReports(setInventoryReports);

        Promise.all([
            getDocs(collection(db, 'app-data')),
            getDocs(collection(db, 'expense_slips')),
            getDocs(collection(db, 'inventory-reports')),
        ]).then(() => setIsLoading(false));

        return () => {
            unsubInventory();
            unsubSuppliers();
            unsubExpenses();
            unsubReports();
        };
    }, [user]);

    const combinedHistory = useMemo((): CombinedHistoryEntry[] => {
        const history: CombinedHistoryEntry[] = [];
        const itemMap = new Map(inventoryList.map(item => [item.id, item]));

        // Process Expense Slips
        expenseSlips.forEach(slip => {
            slip.items.forEach(item => {
                const inventoryItem = itemMap.get(item.itemId);
                if (!inventoryItem) return;

                history.push({
                    date: slip.createdAt as string,
                    itemName: inventoryItem.name,
                    itemUnit: inventoryItem.unit,
                    itemSupplier: inventoryItem.supplier,
                    type: 'Nhập hàng',
                    change: `+${item.quantity}`,
                    newStock: ``, // Can't know new stock without processing all history
                    priceInfo: `${item.unitPrice.toLocaleString('vi-VN')}đ`,
                    sourceId: slip.id,
                });
            });
        });
        
        // This part becomes tricky without pre-calculated stock.
        // We can only show the reported stock, not the change.
        inventoryReports.forEach(report => {
            for (const itemId in report.stockLevels) {
                const record = report.stockLevels[itemId];
                const inventoryItem = itemMap.get(itemId);
                if (!inventoryItem) continue;

                history.push({
                    date: report.submittedAt as string,
                    itemName: inventoryItem.name,
                    itemUnit: inventoryItem.unit,
                    itemSupplier: inventoryItem.supplier,
                    type: 'Kiểm kê',
                    change: ``, // Can't calculate change easily
                    newStock: `${record.stock}`,
                    priceInfo: `-`,
                    sourceId: report.id,
                });
            }
        });

        // Filter
        let filtered = history.filter(entry => {
             if (filterItemName && !entry.itemName.toLowerCase().includes(filterItemName.toLowerCase())) {
                return false;
            }
            if (filterSupplier && entry.itemSupplier !== filterSupplier) {
                return false;
            }
            if (filterType !== 'all' && entry.type !== filterType) {
                return false;
            }
            return true;
        });

        // Sort
        filtered.sort((a, b) => {
            if (sortColumn === 'date') {
                const dateA = new Date(a.date).getTime();
                const dateB = new Date(b.date).getTime();
                return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
            }
            if (sortColumn === 'itemName') {
                 const comparison = a.itemName.localeCompare(b.itemName, 'vi');
                 return sortDirection === 'asc' ? comparison : -comparison;
            }
            return 0;
        });

        return filtered;
    }, [inventoryList, expenseSlips, inventoryReports, filterItemName, filterSupplier, filterType, sortColumn, sortDirection]);
    
    const handleSort = (column: 'date' | 'itemName') => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('desc');
        }
    }
    
    const SortIndicator = ({ column }: { column: 'date' | 'itemName' }) => {
        if (sortColumn !== column) return null;
        return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4 ml-1" /> : <ArrowDown className="h-4 w-4 ml-1" />;
    };


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
                        <Input 
                            placeholder="Lọc theo tên mặt hàng..."
                            value={filterItemName}
                            onChange={(e) => setFilterItemName(e.target.value)}
                        />
                        <SupplierCombobox suppliers={suppliers} value={filterSupplier} onChange={setFilterSupplier} />
                        <Select value={filterType} onValueChange={setFilterType}>
                            <SelectTrigger><SelectValue placeholder="Lọc theo loại sự kiện..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tất cả sự kiện</SelectItem>
                                <SelectItem value="Nhập hàng">Nhập hàng</SelectItem>
                                <SelectItem value="Kiểm kê">Kiểm kê</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="outline" onClick={() => { setFilterItemName(''); setFilterSupplier(''); setFilterType('all'); }}>Xóa bộ lọc</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('date')}>
                                        <div className="flex items-center">Thời gian <SortIndicator column="date" /></div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('itemName')}>
                                         <div className="flex items-center">Tên mặt hàng <SortIndicator column="itemName" /></div>
                                    </TableHead>
                                    <TableHead>Sự kiện</TableHead>
                                    <TableHead>Thay đổi</TableHead>
                                    <TableHead>Tồn kho mới</TableHead>
                                    <TableHead>Đơn giá</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {combinedHistory.length > 0 ? combinedHistory.map((entry, index) => (
                                    <TableRow key={`${entry.sourceId}-${index}`}>
                                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{format(parseISO(entry.date as string), 'dd/MM/yyyy HH:mm', { locale: vi })}</TableCell>
                                        <TableCell className="font-semibold">{entry.itemName}</TableCell>
                                        <TableCell>
                                            <Badge variant={entry.type === 'Nhập hàng' ? 'default' : 'secondary'}>
                                                {entry.type === 'Nhập hàng' ? <ShoppingCart className="h-3 w-3 mr-1.5"/> : <TestTube2 className="h-3 w-3 mr-1.5"/>}
                                                {entry.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className={entry.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}>
                                            {entry.change || '-'}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {entry.newStock || '-'}
                                        </TableCell>
                                        <TableCell className="font-mono">
                                            {entry.priceInfo}
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">Không có dữ liệu lịch sử nào khớp.</TableCell>
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


export default function InventoryHistoryPage() {
    return (
        <Suspense fallback={<div className="h-screen w-full flex items-center justify-center"><Skeleton className="w-full h-full" /></div>}>
            <InventoryHistoryView />
        </Suspense>
    )
}
