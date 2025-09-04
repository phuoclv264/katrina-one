
'use client';
import { useState, useEffect } from 'react';
import { dataStore } from '@/lib/data-store';
import type { InventoryItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function InventoryManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [inventoryList, setInventoryList] = useState<InventoryItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'Chủ nhà hàng') {
        router.replace('/');
      } else {
        const unsubscribe = dataStore.subscribeToInventoryList((items) => {
          setInventoryList(items);
          setIsLoading(false);
        });
        return () => unsubscribe();
      }
    }
  }, [user, authLoading, router]);

  const handleUpdate = (index: number, field: keyof InventoryItem, value: string | number) => {
    if (!inventoryList) return;
    const newList = [...inventoryList];
    (newList[index] as any)[field] = value;
    setInventoryList(newList);
  };
  
  const handleSaveChanges = () => {
      if(!inventoryList) return;
      dataStore.updateInventoryList(inventoryList).then(() => {
          toast({
              title: "Đã lưu thay đổi!",
              description: "Danh sách hàng tồn kho đã được cập nhật.",
          });
      }).catch(err => {
          toast({
              title: "Lỗi!",
              description: "Không thể lưu thay đổi. Vui lòng thử lại.",
              variant: "destructive"
          });
          console.error(err);
      });
  }

  const handleAddItem = () => {
    if (!inventoryList) return;
    const newItem: InventoryItem = {
      id: `item-${Date.now()}`,
      name: 'Mặt hàng mới',
      unit: 'cái',
      minStock: 1,
      orderSuggestion: '1'
    };
    setInventoryList([...inventoryList, newItem]);
  };

  const handleDeleteItem = (id: string) => {
    if (!inventoryList) return;
    const newList = inventoryList.filter(item => item.id !== id);
    setInventoryList(newList);
  };
  

  if (isLoading || authLoading) {
    return (
      <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">
        <header className="mb-8">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-4 w-1/2 mt-2" />
        </header>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (!inventoryList) {
    return <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">Không thể tải danh sách hàng tồn kho.</div>;
  }

  return (
    <div className="container mx-auto max-w-5xl p-4 sm:p-6 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Package/> Quản lý Hàng tồn kho</h1>
        <p className="text-muted-foreground">Thêm, sửa, xóa các mặt hàng trong danh sách kiểm kê kho.</p>
      </header>

      <Card>
        <CardContent className="pt-6">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="min-w-[300px]">Tên mặt hàng</TableHead>
                            <TableHead>Đơn vị</TableHead>
                            <TableHead>Tồn tối thiểu</TableHead>
                            <TableHead>Gợi ý đặt hàng</TableHead>
                            <TableHead className="text-right">Hành động</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {inventoryList.map((item, index) => (
                            <TableRow key={item.id}>
                                <TableCell>
                                    <Input value={item.name} onChange={e => handleUpdate(index, 'name', e.target.value)} />
                                </TableCell>
                                <TableCell>
                                    <Input value={item.unit} onChange={e => handleUpdate(index, 'unit', e.target.value)} className="w-24" />
                                </TableCell>
                                <TableCell>
                                    <Input type="number" value={item.minStock} onChange={e => handleUpdate(index, 'minStock', parseInt(e.target.value) || 0)} className="w-24" />
                                </TableCell>
                                <TableCell>
                                    <Input value={item.orderSuggestion} onChange={e => handleUpdate(index, 'orderSuggestion', e.target.value)} className="w-28"/>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDeleteItem(item.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <div className="mt-6 flex justify-between items-center">
                <Button variant="outline" onClick={handleAddItem}>
                    <Plus className="mr-2 h-4 w-4" />
                    Thêm mặt hàng
                </Button>
                <Button onClick={handleSaveChanges}>Lưu tất cả thay đổi</Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}

