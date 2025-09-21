
'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { dataStore } from '@/lib/data-store';
import type { InventoryItem, ParsedInventoryItem, UpdateInventoryItemsOutput, UserRole } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Package, ArrowUp, ArrowDown, ChevronsDownUp, Shuffle, Check, Pencil, History, Search, Edit } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SupplierCombobox } from '@/components/supplier-combobox';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import isEqual from 'lodash.isequal';
import InventoryTools from './_components/inventory-tools';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


type CategorizedList = {
    category: string;
    items: InventoryItem[];
}[];


function ItemEditPopover({
    item: initialItem,
    suppliers,
    onUpdate,
    onSupplierChange,
    children
}: {
    item: InventoryItem;
    suppliers: string[];
    onUpdate: (id: string, field: keyof InventoryItem, value: any) => void;
    onSupplierChange: (id: string, newSupplier: string) => void;
    children: React.ReactNode;
}) {
    const isMobile = useIsMobile();
    const [isOpen, setIsOpen] = useState(false);
    const [item, setItem] = useState(initialItem);

    useEffect(() => {
        if (isOpen) {
            setItem(initialItem);
        }
    }, [isOpen, initialItem]);

    const handleFieldChange = (field: keyof InventoryItem, value: string | number | boolean) => {
        setItem(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = () => {
        // Find fields that have changed
        (Object.keys(item) as Array<keyof InventoryItem>).forEach(key => {
            if (!isEqual(item[key], initialItem[key])) {
                if (key === 'supplier') {
                    onSupplierChange(item.id, item.supplier);
                } else {
                    onUpdate(item.id, key, item[key]);
                }
            }
        });
        toast.success(`Đã cập nhật mặt hàng "${item.name}".`);
        setIsOpen(false);
    };

    const content = (
         <ScrollArea className={isMobile ? "h-[70vh]" : "max-h-[60vh]"}>
            <div className="grid gap-4 p-1">
                <div className="space-y-2">
                    <Label htmlFor={`name-${item.id}`}>Tên mặt hàng</Label>
                    <Input id={`name-${item.id}`} value={item.name} onChange={e => handleFieldChange('name', e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`shortName-${item.id}`}>Tên viết tắt</Label>
                    <Input id={`shortName-${item.id}`} value={item.shortName} onChange={e => handleFieldChange('shortName', e.target.value)} />
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor={`category-${item.id}`}>Nhóm</Label>
                        <Input id={`category-${item.id}`} value={item.category} onChange={e => handleFieldChange('category', e.target.value.toUpperCase())} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`supplier-${item.id}`}>Nhà cung cấp</Label>
                        <SupplierCombobox suppliers={suppliers} value={item.supplier} onChange={(val) => handleFieldChange('supplier', val)} />
                    </div>
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor={`unit-${item.id}`}>Đơn vị tính</Label>
                        <Input id={`unit-${item.id}`} value={item.unit} onChange={e => handleFieldChange('unit', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`orderUnit-${item.id}`}>Đơn vị đặt</Label>
                        <Input id={`orderUnit-${item.id}`} value={item.orderUnit} onChange={e => handleFieldChange('orderUnit', e.target.value)} />
                    </div>
                </div>
                {item.orderUnit !== item.unit && (
                    <div className="space-y-2">
                        <Label htmlFor={`conversionRate-${item.id}`}>Tỷ lệ quy đổi (1 {item.orderUnit} = ? {item.unit})</Label>
                        <Input id={`conversionRate-${item.id}`} type="number" value={item.conversionRate} onChange={e => handleFieldChange('conversionRate', Number(e.target.value) || 1)} />
                    </div>
                )}
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor={`minStock-${item.id}`}>Tồn kho tối thiểu</Label>
                        <Input id={`minStock-${item.id}`} type="number" value={item.minStock} onChange={e => handleFieldChange('minStock', Number(e.target.value) || 0)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`orderSuggestion-${item.id}`}>Gợi ý đặt hàng</Label>
                        <Input id={`orderSuggestion-${item.id}`} value={item.orderSuggestion} onChange={e => handleFieldChange('orderSuggestion', e.target.value)} />
                    </div>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor={`dataType-${item.id}`}>Kiểu dữ liệu tồn kho</Label>
                    <Select value={item.dataType} onValueChange={(v) => handleFieldChange('dataType', v as 'number' | 'list')}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="number">Số lượng (Number)</SelectItem>
                            <SelectItem value="list">Danh sách (List)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                {item.dataType === 'list' && (
                     <div className="space-y-2">
                        <Label htmlFor={`listOptions-${item.id}`}>Các lựa chọn (phân cách bởi dấu phẩy)</Label>
                        <Input id={`listOptions-${item.id}`} value={(item.listOptions || []).join(', ')} onChange={e => handleFieldChange('listOptions', e.target.value.split(',').map(s => s.trim()))} />
                    </div>
                )}
                <div className="flex justify-between items-center mt-4">
                    <div className="flex items-center space-x-2">
                         <Switch id={`isImportant-${item.id}`} checked={item.isImportant} onCheckedChange={c => handleFieldChange('isImportant', c)} />
                        <Label htmlFor={`isImportant-${item.id}`}>Bắt buộc kiểm kê</Label>
                    </div>
                     <div className="flex items-center space-x-2">
                         <Switch id={`requiresPhoto-${item.id}`} checked={item.requiresPhoto} onCheckedChange={c => handleFieldChange('requiresPhoto', c)} />
                        <Label htmlFor={`requiresPhoto-${item.id}`}>Yêu cầu ảnh</Label>
                    </div>
                </div>
            </div>
         </ScrollArea>
    );

    if (isMobile) {
        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>{children}</DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Chỉnh sửa: {initialItem.name}</DialogTitle>
                    </DialogHeader>
                    {content}
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Hủy</Button></DialogClose>
                        <Button onClick={handleSave}>Lưu thay đổi</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }
    
    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent className="w-96 p-4" align="end">
                 {content}
                 <div className="flex justify-end gap-2 mt-4">
                    <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>Hủy</Button>
                    <Button size="sm" onClick={handleSave}>Lưu</Button>
                 </div>
            </PopoverContent>
        </Popover>
    );
}


export default function InventoryManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [inventoryList, setInventoryList] = useState<InventoryItem[] | null>(null);
  const [suppliers, setSuppliers] = useState<string[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [openCategories, setOpenCategories] = useState<string[]>([]);
  const [isSorting, setIsSorting] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ oldName: string; newName: string } | null>(null);
  const hasInitializedOpenState = useRef(false);
  const [filter, setFilter] = useState('');

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

    const checkLoadingDone = () => { if (inventorySubscribed && suppliersSubscribed) { setIsLoading(false); } }

    const unsubSuppliers = dataStore.subscribeToSuppliers((supplierList) => { setSuppliers(supplierList); suppliersSubscribed = true; checkLoadingDone(); });
    const unsubInventory = dataStore.subscribeToInventoryList((items) => { setInventoryList(items); inventorySubscribed = true; checkLoadingDone(); });
    return () => { unsubSuppliers(); unsubInventory(); };
  }, [user]);
  
  const filteredInventoryList = useMemo(() => {
    if (!inventoryList) return [];
    if (!filter) return inventoryList;
    return inventoryList.filter(item => item.name.toLowerCase().includes(filter.toLowerCase()));
  }, [inventoryList, filter]);


  const categorizedList = useMemo((): CategorizedList => {
      if (!filteredInventoryList) return [];
      const categoryOrder: string[] = [];
      const grouped: { [key: string]: InventoryItem[] } = {};
      filteredInventoryList.forEach(item => {
          const category = item.category || 'CHƯA PHÂN LOẠI';
          if (!grouped[category]) {
              grouped[category] = [];
              categoryOrder.push(category);
          }
          grouped[category].push(item);
      });
      return categoryOrder.map(category => ({ category, items: grouped[category] }));
  }, [filteredInventoryList]);

  useEffect(() => {
      if (categorizedList.length > 0 && !hasInitializedOpenState.current) {
          setOpenCategories(categorizedList.map(c => c.category));
          hasInitializedOpenState.current = true;
      }
  }, [categorizedList]);

  const handleUpdateAndSave = useCallback((newList: InventoryItem[]) => {
    setInventoryList(newList);
    dataStore.updateInventoryList(newList);
  }, []);

  const handleUpdate = (id: string, field: keyof InventoryItem, value: string | number | boolean | string[]) => {
    if (!inventoryList) return;
    const newList = inventoryList.map(item => item.id === id ? { ...item, [field]: value } : item);
    handleUpdateAndSave(newList);
  };
  
  const handleSupplierChange = (id: string, newSupplier: string) => {
    if (!inventoryList || !suppliers) return;
    const newList = inventoryList.map(item => item.id === id ? { ...item, supplier: newSupplier } : item);
    handleUpdateAndSave(newList);

    if (!suppliers.includes(newSupplier)) {
        const newSuppliers = [...suppliers, newSupplier].sort();
        setSuppliers(newSuppliers);
        dataStore.updateSuppliers(newSuppliers);
        toast.success(`Đã thêm nhà cung cấp mới: "${newSupplier}"`);
    }
  };

  const handleMoveItem = (indexToMove: number, direction: 'up' | 'down') => {
    if (!inventoryList) return;
    const newList = [...inventoryList];
    const newIndex = direction === 'up' ? indexToMove - 1 : indexToMove + 1;
    if (newIndex < 0 || newIndex >= newList.length) return;
    const itemToMove = newList[indexToMove];
    const itemToSwap = newList[newIndex];
    if (itemToMove.category === itemToSwap.category) {
        [newList[indexToMove], newList[newIndex]] = [newList[newIndex], newList[indexToMove]];
        setInventoryList(newList);
    } else {
        toast.error("Chỉ có thể sắp xếp các mục trong cùng một chủng loại.");
    }
  };

  const handleAddItem = () => {
    if (!inventoryList) return;
    const newItem: InventoryItem = {
      id: `item-${Date.now()}`, name: 'Mặt hàng mới', shortName: 'MHM', category: 'CHƯA PHÂN LOẠI',
      supplier: 'Chưa xác định', unit: 'cái', orderUnit: 'cái', conversionRate: 1, minStock: 1,
      unitPrice: 0, stock: 0, orderSuggestion: '1', dataType: 'number',
      listOptions: ['hết', 'gần hết', 'còn đủ', 'dư xài'], isImportant: false, requiresPhoto: false,
      priceHistory: [], stockHistory: [],
    };
    const newList = [...inventoryList, newItem];
    handleUpdateAndSave(newList);
  };

  const onItemsGenerated = (items: InventoryItem[]) => {
      if (inventoryList && suppliers) {
          const newList = [...inventoryList, ...items];
          handleUpdateAndSave(newList);
          const newSuppliers = new Set(suppliers);
          items.forEach(item => newSuppliers.add(item.supplier));
          const sortedNewSuppliers = Array.from(newSuppliers).sort();
          setSuppliers(sortedNewSuppliers);
          dataStore.updateSuppliers(sortedNewSuppliers);
      }
  }

   const onItemsUpdated = (updatedItems: InventoryItem[]) => {
        handleUpdateAndSave(updatedItems);
  };

  const handleDeleteItem = (id: string) => {
    if (!inventoryList) return;
    const newList = inventoryList.filter(item => item.id !== id);
    handleUpdateAndSave(newList);
  };

  const handleMoveCategory = (categoryIndex: number, direction: 'up' | 'down') => {
      if (!inventoryList || !categorizedList) return;
      const newCategoryOrder = [...categorizedList];
      const targetIndex = direction === 'up' ? categoryIndex - 1 : categoryIndex + 1;
      if (targetIndex < 0 || targetIndex >= newCategoryOrder.length) return;
      [newCategoryOrder[categoryIndex], newCategoryOrder[targetIndex]] = [newCategoryOrder[targetIndex], newCategoryOrder[categoryIndex]];
      const newFlatList = newCategoryOrder.flatMap(category => category.items);
      setInventoryList(newFlatList);
  };

  const handleRenameCategory = () => {
    if (!editingCategory || !inventoryList || !editingCategory.newName.trim()) { setEditingCategory(null); return; }
    const { oldName, newName } = editingCategory;
    const newTrimmedName = newName.trim().toUpperCase();
    const categoryExists = categorizedList.some(c => c.category.toUpperCase() === newTrimmedName && c.category.toUpperCase() !== oldName.toUpperCase());
    if (categoryExists) { toast.error(`Nhóm sản phẩm "${newTrimmedName}" đã tồn tại.`); return; }
    const newList = inventoryList.map(item => item.category === oldName ? { ...item, category: newTrimmedName } : item);
    handleUpdateAndSave(newList);
    setEditingCategory(null);
    setOpenCategories(prev => [...prev.filter(c => c !== oldName), newTrimmedName]);
  };

   const handleToggleAll = () => {
    if (!categorizedList) return;
    if (openCategories.length === categorizedList.length) {
      setOpenCategories([]);
    } else {
      setOpenCategories(categorizedList.map(c => c.category));
    }
  };

  const toggleSortMode = () => {
    const newSortState = !isSorting;
    setIsSorting(newSortState);
    if (!newSortState && inventoryList) {
        dataStore.updateInventoryList(inventoryList);
        toast.success("Đã lưu thứ tự mới!");
    }
  };
  
  const handleExport = (type: 'table' | 'text') => {
    if (!inventoryList) return;
    let textToCopy = '';
    const headers = ['Tên mặt hàng', 'Tên viết tắt', 'Nhóm', 'Nhà cung cấp', 'Đơn vị', 'ĐV Đặt hàng', 'Tỷ lệ quy đổi', 'Tồn tối thiểu', 'Gợi ý đặt hàng', 'Yêu cầu ảnh', 'Bắt buộc nhập'];
    const rows = inventoryList.map(item => 
        [item.name, item.shortName, item.category, item.supplier, item.unit, item.orderUnit, item.conversionRate, item.minStock, item.orderSuggestion, item.requiresPhoto ? 'CÓ' : 'KHÔNG', item.isImportant ? 'CÓ' : 'KHÔNG'].join('|')
    );
    textToCopy = [headers.join('|'), ...rows].join('\n');
    
    navigator.clipboard.writeText(textToCopy).then(() => {
        toast.success("Danh sách đã được sao chép vào bộ nhớ tạm.");
    }).catch(err => {
        toast.error("Không thể sao chép danh sách.");
        console.error("Copy to clipboard failed:", err);
    });
  };


  if (isLoading || authLoading || !inventoryList || !suppliers) {
    return (
      <div className="container mx-auto max-w-7xl p-4 sm:p-6 md:p-8">
        <header className="mb-8">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-5 w-1/2 mt-2" />
        </header>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }
   const areAllCategoriesOpen = categorizedList && categorizedList.length > 0 && openCategories.length === categorizedList.length;

  return (
    <div className="container mx-auto max-w-7xl p-4 sm:p-6 md:p-8">
        <header className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold font-headline flex items-center gap-3"><Package/> Quản lý Hàng tồn kho</h1>
            <p className="text-muted-foreground mt-2">Mọi thay đổi sẽ được lưu tự động. Chế độ sắp xếp sẽ lưu khi bạn nhấn "Lưu thứ tự".</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
            <div className="lg:col-span-1 lg:sticky lg:top-4 order-2 lg:order-1">
                <InventoryTools
                    inventoryList={inventoryList}
                    onItemsGenerated={onItemsGenerated}
                    onItemsUpdated={onItemsUpdated}
                />
            </div>
            <div className="lg:col-span-3 order-1 lg:order-2">
                <Card className="rounded-xl shadow-sm border bg-white dark:bg-card">
                    <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <CardTitle>Danh sách kho hiện tại</CardTitle>
                            <div className="relative mt-2">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Tìm theo tên mặt hàng..." className="pl-8" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Tìm kiếm mặt hàng" />
                            </div>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                            <Button asChild variant="outline" size="sm" className="h-10 px-3 rounded-md inline-flex items-center gap-2 transition-colors"><Link href="/inventory-history"><History className="mr-2 h-4 w-4" />Lịch sử Kho</Link></Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-10 px-3 rounded-md inline-flex items-center gap-2 transition-colors">Xuất dữ liệu</Button></DropdownMenuTrigger>
                                <DropdownMenuContent><DropdownMenuItem onClick={() => handleExport('table')}>Sao chép (dạng bảng)</DropdownMenuItem></DropdownMenuContent>
                            </DropdownMenu>
                            {isSorting ? (
                                <Button variant="default" size="sm" onClick={toggleSortMode} className="h-10 px-3 rounded-md inline-flex items-center gap-2 transition-colors active:scale-95"><Check className="mr-2 h-4 w-4"/>Lưu thứ tự</Button>
                            ) : (
                                <Button variant="outline" size="sm" onClick={toggleSortMode} className="h-10 px-3 rounded-md inline-flex items-center gap-2 transition-colors"><Shuffle className="mr-2 h-4 w-4"/>Sắp xếp</Button>
                            )}
                            {categorizedList && categorizedList.length > 0 && (<Button variant="outline" onClick={handleToggleAll} size="sm" className="h-10 px-3 rounded-md inline-flex items-center gap-2 transition-colors"><ChevronsDownUp className="mr-2 h-4 w-4"/>{areAllCategoriesOpen ? "Thu gọn" : "Mở rộng"}</Button>)}
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <Accordion type="multiple" value={openCategories} onValueChange={setOpenCategories} className="space-y-4">
                        {categorizedList.map(({category, items}, categoryIndex) => (
                            <AccordionItem value={category} key={category} className="border rounded-lg bg-white dark:bg-card">
                                <div className="flex items-center p-2">
                                    <AccordionTrigger className="text-lg font-semibold flex-1 hover:no-underline p-2" disabled={isSorting}>
                                        {editingCategory?.oldName === category ? (<Input value={editingCategory.newName} onChange={(e) => setEditingCategory({ ...editingCategory, newName: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleRenameCategory()} onBlur={handleRenameCategory} autoFocus className="text-lg font-semibold h-9" onClick={(e) => e.stopPropagation()} />) : (category)}
                                    </AccordionTrigger>
                                    {isSorting ? (
                                        <div className="flex items-center gap-1 pl-4">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleMoveCategory(categoryIndex, 'up')} disabled={categoryIndex === 0}><ArrowUp className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleMoveCategory(categoryIndex, 'down')} disabled={categorizedList.length - 1 === categoryIndex}><ArrowDown className="h-4 w-4" /></Button>
                                        </div>
                                    ) : (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setEditingCategory({ oldName: category, newName: category })}><Pencil className="h-4 w-4" /></Button>
                                    )}
                                </div>
                                <AccordionContent className="border-t">
                                    {!isMobile ? (
                                    <div className="overflow-x-auto -mx-4 px-4">
                                        <Table>
                                            <TableHeader className="sticky top-0 bg-white/95 dark:bg-card/95 backdrop-blur-sm z-10"><TableRow><TableHead className="min-w-[250px] p-3 sm:p-4">Tên</TableHead><TableHead className="min-w-[150px] p-3 sm:p-4">Tên VT</TableHead><TableHead className="min-w-[180px] p-3 sm:p-4">Nhà CC</TableHead><TableHead className="p-3 sm:p-4">Đơn vị</TableHead><TableHead className="p-3 sm:p-4">ĐV Đặt</TableHead><TableHead className="p-3 sm:p-4">Tỷ lệ</TableHead><TableHead className="p-3 sm:p-4">Tồn min</TableHead><TableHead className="p-3 sm:p-4">Gợi ý</TableHead><TableHead className="p-3 sm:p-4">Trạng thái</TableHead><TableHead className="w-[100px] text-right p-3 sm:p-4">Hành động</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {items.map((item, index) => {
                                                    const globalIndex = inventoryList.findIndex(i => i.id === item.id);
                                                    return (
                                                    <TableRow key={item.id} className="transition-colors hover:bg-muted/50">
                                                        <TableCell className="font-semibold p-3 sm:p-4"><div className="whitespace-normal">{item.name}</div></TableCell>
                                                        <TableCell className="p-3 sm:p-4">{item.shortName}</TableCell>
                                                        <TableCell className="p-3 sm:p-4">{item.supplier}</TableCell>
                                                        <TableCell className="p-3 sm:p-4">{item.unit}</TableCell>
                                                        <TableCell className="p-3 sm:p-4">{item.orderUnit}</TableCell>
                                                        <TableCell className="p-3 sm:p-4">{item.conversionRate}</TableCell>
                                                        <TableCell className="p-3 sm:p-4">{item.minStock}</TableCell>
                                                        <TableCell className="p-3 sm:p-4">{item.orderSuggestion}</TableCell>
                                                        <TableCell className="p-3 sm:p-4">
                                                            <div className="flex flex-col gap-1 items-start">
                                                                {item.isImportant && <Badge variant="destructive">Bắt buộc</Badge>}
                                                                {item.requiresPhoto && <Badge variant="secondary">Cần ảnh</Badge>}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right p-3 sm:p-4">
                                                            {isSorting ? (
                                                                <div className="flex flex-col"><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMoveItem(globalIndex, 'up')} disabled={index === 0}><ArrowUp className="h-3 w-3" /></Button><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMoveItem(globalIndex, 'down')} disabled={index === items.length - 1}><ArrowDown className="h-3 w-3" /></Button></div>
                                                            ) : (
                                                                <div className="flex items-center justify-end">
                                                                     <ItemEditPopover item={item} suppliers={suppliers || []} onUpdate={handleUpdate} onSupplierChange={handleSupplierChange}>
                                                                        <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                                                                    </ItemEditPopover>
                                                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteItem(item.id)}><Trash2 className="h-4 w-4" /></Button>
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                )})}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    ) : (
                                        <div className="space-y-3 p-2">
                                            {items.map(item => (
                                                <Card key={item.id} className="bg-white dark:bg-card rounded-lg shadow-sm p-4 flex flex-col gap-2">
                                                    <div className="flex justify-between items-start">
                                                        <p className="font-semibold pr-2">{item.name}</p>
                                                        <div className="flex items-center -mt-2 -mr-2">
                                                            <ItemEditPopover item={item} suppliers={suppliers || []} onUpdate={handleUpdate} onSupplierChange={handleSupplierChange}>
                                                                <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                                                            </ItemEditPopover>
                                                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteItem(item.id)}><Trash2 className="h-4 w-4" /></Button>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">{item.supplier}</p>
                                                    <div className="grid grid-cols-3 gap-2 text-center text-sm pt-2 border-t"><div><Label>Đơn vị</Label><p className="font-medium">{item.unit}</p></div><div><Label>Tồn min</Label><p className="font-medium">{item.minStock}</p></div><div><Label>Gợi ý</Label><p className="font-medium">{item.orderSuggestion}</p></div></div>
                                                </Card>
                                            ))}
                                        </div>
                                    )}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                        </Accordion>
                        <div className="mt-6 flex justify-start items-center">
                            <Button variant="outline" onClick={handleAddItem} className="h-10 px-3 rounded-md inline-flex items-center gap-2 transition-colors"><Plus className="mr-2 h-4 w-4" />Thêm mặt hàng mới</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
  );
}
