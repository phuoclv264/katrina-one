
'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { dataStore } from '@/lib/data-store';
import type { InventoryItem, ParsedInventoryItem, UpdateInventoryItemsOutput, UserRole } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Package, ArrowUp, ArrowDown, ChevronsDownUp, Shuffle, Check, Pencil, History, Search, Edit, Filter } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import isEqual from 'lodash.isequal';
import InventoryTools from './_components/inventory-tools';
import ItemEditPopover from './_components/item-edit-popover';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


type CategorizedList = {
    category: string;
    items: InventoryItem[];
}[];


export default function InventoryManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [inventoryList, setInventoryList] = useState<InventoryItem[] | null>(null);
  const [suppliers, setSuppliers] = useState<string[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [openCategories, setOpenCategories] = useState<string[]>([]);
  const [isSorting, setIsSorting] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ oldName: string; newName: string } | null>(null);
  const hasInitializedOpenState = useRef(false);
  const [filter, setFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | 'all'>('all');


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
    let list = inventoryList;
    if (filter) {
        list = list.filter(item => item.name.toLowerCase().includes(filter.toLowerCase()));
    }
    if (categoryFilter !== 'all') {
        list = list.filter(item => item.category === categoryFilter);
    }
    return list;
  }, [inventoryList, filter, categoryFilter]);


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

  const handleUpdate = (updatedItem: InventoryItem) => {
    if (!inventoryList) return;
    const newList = inventoryList.map(item => item.id === updatedItem.id ? updatedItem : item);
    handleUpdateAndSave(newList);
  };
  
  const handleSupplierChange = (newSupplier: string) => {
    if (!suppliers) return;

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
      id: `item-${Date.now()}`, name: 'Mặt hàng mới', shortName: 'MHM', category: categoryFilter !== 'all' ? categoryFilter : 'CHƯA PHÂN LOẠI',
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
  
  const handleExport = () => {
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

  const allCategories = useMemo(() => {
      if(!inventoryList) return [];
      return [...new Set(inventoryList.map(item => item.category))].sort();
  }, [inventoryList]);


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
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                                <CardTitle>Danh sách kho hiện tại</CardTitle>
                                <CardDescription className="mt-2">
                                   Hiển thị {filteredInventoryList.length} / {inventoryList.length} mặt hàng.
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                                <Button asChild variant="outline" size="sm" className="h-10 px-3 rounded-md inline-flex items-center gap-2 transition-colors"><Link href="/inventory-history"><History className="mr-2 h-4 w-4" />Lịch sử Kho</Link></Button>
                                <Button variant="outline" size="sm" onClick={handleExport} className="h-10 px-3 rounded-md">Xuất văn bản</Button>
                                {isSorting ? (
                                    <Button variant="default" size="sm" onClick={toggleSortMode} className="h-10 px-3 rounded-md inline-flex items-center gap-2 transition-colors active:scale-95"><Check className="mr-2 h-4 w-4"/>Lưu thứ tự</Button>
                                ) : (
                                    <Button variant="outline" size="sm" onClick={toggleSortMode} className="h-10 px-3 rounded-md inline-flex items-center gap-2 transition-colors"><Shuffle className="mr-2 h-4 w-4"/>Sắp xếp</Button>
                                )}
                                {categorizedList && categorizedList.length > 0 && (<Button variant="outline" onClick={handleToggleAll} size="sm" className="h-10 px-3 rounded-md inline-flex items-center gap-2 transition-colors"><ChevronsDownUp className="mr-2 h-4 w-4"/>{areAllCategoriesOpen ? "Thu gọn" : "Mở rộng"}</Button>)}
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 mt-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Tìm theo tên mặt hàng..." className="pl-8" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Tìm kiếm mặt hàng" />
                            </div>
                            <div className="flex-1 sm:flex-initial sm:w-56">
                                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                    <SelectTrigger className="w-full">
                                        <div className="flex items-center gap-2">
                                            <Filter className="h-4 w-4" />
                                            <SelectValue placeholder="Lọc theo nhóm..." />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tất cả các nhóm</SelectItem>
                                        {allCategories.map(cat => (
                                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <Accordion type="multiple" value={openCategories} onValueChange={setOpenCategories} className="space-y-4">
                        {categorizedList.map(({category, items}, categoryIndex) => (
                            <AccordionItem value={category} key={category} className="border-none">
                                <div className={cn("flex items-center p-2 rounded-lg bg-muted/80 sticky top-0 z-10", openCategories.includes(category) && "rounded-b-none")}>
                                    <AccordionTrigger className="text-lg font-semibold flex-1 hover:no-underline p-2" disabled={isSorting}>
                                        <div className="flex items-center gap-3 w-full">
                                            <span className="flex-1 text-left">{category} ({items.length})</span>
                                        </div>
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
                                <AccordionContent className="p-4 border border-t-0 rounded-b-lg">
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {items.map((item, index) => {
                                            const globalIndex = inventoryList.findIndex(i => i.id === item.id);
                                            return (
                                            <Card key={item.id} className="flex flex-col justify-between hover:bg-muted/50 transition-colors">
                                                <CardContent className="p-4 space-y-3">
                                                    <div className="flex justify-between items-start gap-2">
                                                        <div>
                                                            <p className="font-bold text-base leading-tight">{item.name}</p>
                                                            <p className="text-xs text-muted-foreground">{item.shortName}</p>
                                                        </div>
                                                         <div className="flex items-center shrink-0">
                                                            <ItemEditPopover item={item} suppliers={suppliers || []} onUpdate={handleUpdate} onSupplierChange={handleSupplierChange}>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><Edit className="h-4 w-4"/></Button>
                                                            </ItemEditPopover>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id)}}><Trash2 className="h-4 w-4" /></Button>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 text-center text-xs border-t pt-3">
                                                        <div><p className="text-muted-foreground">Nhà CC</p><p className="font-semibold truncate">{item.supplier}</p></div>
                                                        <div><p className="text-muted-foreground">Đơn vị</p><p className="font-semibold">{item.unit}</p></div>
                                                        <div><p className="text-muted-foreground">ĐV Đặt</p><p className="font-semibold">{item.orderUnit}</p></div>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                                        <div><p className="text-muted-foreground">Tồn Min</p><p className="font-semibold">{item.minStock}</p></div>
                                                        <div><p className="text-muted-foreground">Gợi ý Đặt</p><p className="font-semibold">{item.orderSuggestion}</p></div>
                                                        <div><p className="text-muted-foreground">Tỷ lệ</p><p className="font-semibold">{item.conversionRate}</p></div>
                                                    </div>
                                                </CardContent>
                                                <CardFooter className="p-3 bg-muted/50 rounded-b-lg flex justify-between items-center">
                                                    <div className="flex gap-2">
                                                        {item.isImportant && <Badge variant="destructive">Bắt buộc</Badge>}
                                                        {item.requiresPhoto && <Badge variant="secondary">Cần ảnh</Badge>}
                                                    </div>
                                                    {isSorting && (
                                                        <div className="flex"><Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => {e.stopPropagation(); handleMoveItem(globalIndex, 'up')}} disabled={index === 0}><ArrowUp className="h-3 w-3" /></Button><Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => {e.stopPropagation(); handleMoveItem(globalIndex, 'down')}} disabled={index === items.length - 1}><ArrowDown className="h-3 w-3" /></Button></div>
                                                    )}
                                                </CardFooter>
                                            </Card>
                                        )})}
                                    </div>
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
