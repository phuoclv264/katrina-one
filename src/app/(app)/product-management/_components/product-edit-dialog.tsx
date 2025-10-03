'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Product, ProductIngredient, InventoryItem, UnitDefinition } from '@/lib/types';
import { Plus, Trash2, Box, Beaker, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import isEqual from 'lodash.isequal';
import { toast } from 'react-hot-toast';

// New Component for Adding Ingredients
function AddIngredientDialog({
  isOpen,
  onClose,
  onAddIngredient,
  inventoryList,
  allProducts,
  currentProductId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAddIngredient: (item: InventoryItem | Product, type: 'inventory' | 'product', unit: string) => void;
  inventoryList: InventoryItem[];
  allProducts: Product[];
  currentProductId?: string;
}) {
  const [ingredientSource, setIngredientSource] = useState<'inventory' | 'product'>('inventory');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | Product | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string>('');

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setSelectedItem(null);
      setSelectedUnit('');
      setIngredientSource('inventory');
    }
  }, [isOpen]);
  
  const handleSelect = (item: InventoryItem | Product) => {
    setSelectedItem(item);
    if ('baseUnit' in item) { // It's an InventoryItem
        setSelectedUnit(item.baseUnit);
    } else if ('yield' in item && item.yield) { // It's a Product
        setSelectedUnit(item.yield.unit);
    } else {
        setSelectedUnit('phần');
    }
  }
  
  const handleAdd = () => {
    if (selectedItem && selectedUnit) {
        onAddIngredient(selectedItem, ingredientSource, selectedUnit);
        onClose();
    }
  };

  const filteredItems = useMemo(() => {
    const searchLower = search.toLowerCase();
    if (ingredientSource === 'inventory') {
      return inventoryList.filter(item => item.name.toLowerCase().includes(searchLower));
    } else {
      return allProducts.filter(p =>
        p.id !== currentProductId &&
        p.isIngredient === true &&
        p.name.toLowerCase().includes(searchLower)
      );
    }
  }, [search, ingredientSource, inventoryList, allProducts, currentProductId]);
  
  const availableUnits = useMemo(() => {
      if (!selectedItem) return [];
      if ('units' in selectedItem) { // InventoryItem
          return selectedItem.units.map(u => u.name);
      }
      if ('yield' in selectedItem && selectedItem.yield) { // Product
          return [selectedItem.yield.unit];
      }
      return ['phần'];
  }, [selectedItem]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Thêm nguyên liệu</DialogTitle>
          <DialogDescription>Tìm kiếm và chọn một nguyên liệu từ kho hoặc một sản phẩm khác.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[50vh]">
          {/* Left Panel: Search and Select */}
          <div className="flex flex-col gap-4">
            <RadioGroup defaultValue="inventory" value={ingredientSource} onValueChange={(v) => { setIngredientSource(v as any); setSelectedItem(null); }} className="flex gap-2">
                <Label htmlFor="source-inventory" className="flex items-center gap-2 border rounded-md p-2 flex-1 cursor-pointer [&:has([data-state=checked])]:border-primary">
                    <RadioGroupItem value="inventory" id="source-inventory" /><Box className="h-4 w-4" /> Kho
                </Label>
                <Label htmlFor="source-product" className="flex items-center gap-2 border rounded-md p-2 flex-1 cursor-pointer [&:has([data-state=checked])]:border-primary">
                    <RadioGroupItem value="product" id="source-product" /><Beaker className="h-4 w-4" /> SP Khác
                </Label>
            </RadioGroup>
             <Command className="border rounded-lg">
              <CommandInput placeholder="Tìm kiếm..." value={search} onValueChange={setSearch} />
              <ScrollArea className="h-full">
                <CommandList>
                  <CommandEmpty>Không tìm thấy.</CommandEmpty>
                  <CommandGroup>
                    {filteredItems.map((item) => (
                      <CommandItem key={item.id} onSelect={() => handleSelect(item)}>
                        {item.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </ScrollArea>
            </Command>
          </div>

          {/* Right Panel: Details and Unit Selection */}
          <div className="flex flex-col gap-4">
             {selectedItem ? (
                <Card className="flex-1">
                    <CardHeader>
                        <CardTitle>{selectedItem.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="space-y-2">
                            <Label>Chọn đơn vị sử dụng</Label>
                             <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Chọn đơn vị..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableUnits.map(unit => (
                                        <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                                    ))}
                                </SelectContent>
                             </Select>
                         </div>
                    </CardContent>
                </Card>
             ) : (
                <div className="flex-1 flex items-center justify-center border-2 border-dashed rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Chọn một nguyên liệu để xem chi tiết</p>
                </div>
             )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={handleAdd} disabled={!selectedItem || !selectedUnit}>Thêm vào công thức</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


type ProductEditDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Product, isNew: boolean) => void;
  productToEdit: Product | null;
  inventoryList: InventoryItem[];
  allProducts: Product[];
};

export default function ProductEditDialog({ isOpen, onClose, onSave, productToEdit, inventoryList, allProducts }: ProductEditDialogProps) {
  const [product, setProduct] = useState<Partial<Product>>({});
  const [isAddIngredientOpen, setIsAddIngredientOpen] = useState(false);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isConfirmCloseOpen, setIsConfirmCloseOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const initialProduct = productToEdit || {
        id: `prod_${uuidv4()}`,
        name: '',
        category: '',
        ingredients: [],
        note: '',
        isIngredient: false,
        yield: { quantity: 1, unit: 'phần' },
      };
      setProduct(initialProduct);
      setHasUnsavedChanges(false);
    }
  }, [isOpen, productToEdit]);
  
  useEffect(() => {
    const originalProduct = productToEdit || { id: product.id, name: '', category: '', ingredients: [], note: '', isIngredient: false, yield: { quantity: 1, unit: 'phần' } };
    setHasUnsavedChanges(!isEqual(product, originalProduct));
  }, [product, productToEdit]);


  const handleFieldChange = (field: keyof Product, value: any) => {
    setProduct(prev => ({ ...prev, [field]: value }));
  };

  const handleIngredientChange = (index: number, field: keyof ProductIngredient, value: any) => {
    const newIngredients = [...(product.ingredients || [])];
    (newIngredients[index] as any)[field] = value;
    handleFieldChange('ingredients', newIngredients);
  };

 const handleAddIngredient = (item: InventoryItem | Product, type: 'inventory' | 'product', unit: string) => {
    const newIngredient: Partial<ProductIngredient> = {
        name: item.name,
        quantity: 1,
        unit: unit,
        isMatched: true,
    };
    if (type === 'inventory') {
        newIngredient.inventoryItemId = item.id;
    } else {
        newIngredient.productId = item.id;
    }

    const newIngredients = [...(product.ingredients || []), newIngredient as ProductIngredient];
    handleFieldChange('ingredients', newIngredients);
  };


  const handleRemoveIngredient = (index: number) => {
    const newIngredients = (product.ingredients || []).filter((_, i) => i !== index);
    handleFieldChange('ingredients', newIngredients);
  };

  const handleSave = async () => {
    if (!product.name || !product.category) {
        toast.error('Vui lòng nhập tên và danh mục cho mặt hàng.');
        return;
    }
    setIsProcessing(true);
    await onSave(product as Product, !productToEdit);
    setIsProcessing(false);
  };

  const handleAttemptClose = () => {
      if (hasUnsavedChanges) {
          setIsConfirmCloseOpen(true);
      } else {
          onClose();
      }
  }

  const handleConfirmClose = () => {
      setIsConfirmCloseOpen(false);
      onClose();
  }

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleAttemptClose()}>
      <DialogContent className="max-w-3xl flex flex-col h-[90vh] p-0 bg-white dark:bg-card">
        <DialogHeader className="p-6 pb-4 border-b bg-muted/30">
          <DialogTitle>{productToEdit ? 'Chỉnh sửa mặt hàng' : 'Thêm mặt hàng mới'}</DialogTitle>
          <DialogDescription>
            Quản lý công thức và thông tin chi tiết của sản phẩm.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow">
          <div className="p-6 space-y-6">
          {/* Section: Basic Info */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="product-name" className="text-xs text-muted-foreground">Tên mặt hàng</Label>
                <Input id="product-name" value={product.name || ''} onChange={(e) => handleFieldChange('name', e.target.value)} placeholder="VD: Cà phê sữa đá"/>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="product-category" className="text-xs text-muted-foreground">Danh mục</Label>
                <Input id="product-category" value={product.category || ''} onChange={(e) => handleFieldChange('category', e.target.value)} placeholder="VD: CÀ PHÊ TRUYỀN THỐNG" />
              </div>
            </div>
          </div>
          
          <Separator />

          {/* Section: Sub-recipe options */}
           <div className="space-y-4">
                <Label htmlFor="is-ingredient-switch" className="flex items-center justify-between cursor-pointer rounded-lg border p-3 shadow-sm">
                    <div>
                        <span className="font-medium text-sm">Dùng làm nguyên liệu cho món khác</span>
                        <p className="text-xs text-muted-foreground">Bật nếu đây là công thức con (ví dụ: kem nền, trà ủ sẵn).</p>
                    </div>
                    <Switch 
                        id="is-ingredient-switch" 
                        checked={product.isIngredient}
                        onCheckedChange={(checked) => handleFieldChange('isIngredient', checked)}
                    />
                </Label>
          
                {product.isIngredient && (
                <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 ml-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="yield-qty" className="text-xs text-muted-foreground">Số lượng thành phẩm</Label>
                        <Input id="yield-qty" type="number" placeholder="Số lượng" value={product.yield?.quantity || ''} onChange={(e) => handleFieldChange('yield', { ...product.yield, quantity: Number(e.target.value) })} />
                    </div>
                     <div className="space-y-1.5">
                        <Label htmlFor="yield-unit" className="text-xs text-muted-foreground">Đơn vị thành phẩm</Label>
                        <Input id="yield-unit" placeholder="ml, g,..." value={product.yield?.unit || ''} onChange={(e) => handleFieldChange('yield', { ...product.yield, unit: e.target.value })}/>
                    </div>
                </div>
                )}
          </div>
          
          <Separator />
          
          {/* Section: Ingredients */}
          <div className="space-y-2">
            <Label className="font-semibold">Công thức</Label>
            <div className="border rounded-md">
                 <ScrollArea className="h-60">
                    <Table>
                        <TableHeader className="sticky top-0 bg-muted z-10">
                        <TableRow>
                            <TableHead className="w-[45%]">Nguyên liệu</TableHead>
                            <TableHead className="w-[20%] text-right">Số lượng</TableHead>
                            <TableHead className="w-[25%]">Đơn vị</TableHead>
                            <TableHead className="w-[10%]"></TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {(product.ingredients || []).length > 0 ? (
                            (product.ingredients || []).map((ing, index) => {
                                const item = ing.inventoryItemId
                                    ? inventoryList.find(i => i.id === ing.inventoryItemId)
                                    : allProducts.find(p => p.id === ing.productId);
                                const isSubProduct = !!ing.productId;

                                return (
                                <TableRow key={`${ing.inventoryItemId || ing.productId}-${index}`}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            {isSubProduct ? <Beaker className="h-4 w-4 text-purple-500"/> : <Box className="h-4 w-4 text-blue-500" />}
                                            <span>{item?.name || 'Không rõ'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                    <Input
                                        type="number"
                                        value={ing.quantity}
                                        onChange={(e) => handleIngredientChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                                        className="h-8 text-right"
                                    />
                                    </TableCell>
                                    <TableCell>
                                        <Select value={ing.unit} onValueChange={(val) => handleIngredientChange(index, 'unit', val)}>
                                            <SelectTrigger className="h-8">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(item as InventoryItem)?.units?.map(u => (
                                                    <SelectItem key={u.name} value={u.name}>{u.name}</SelectItem>
                                                ))}
                                                {isSubProduct && (item as Product)?.yield?.unit && (
                                                    <SelectItem value={(item as Product).yield!.unit}>{(item as Product).yield!.unit}</SelectItem>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                     <Button variant="ghost" size="icon" onClick={() => handleRemoveIngredient(index)} className="h-8 w-8">
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent><p>Xóa nguyên liệu</p></TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </TableCell>
                                </TableRow>
                                )
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Chưa có nguyên liệu nào.</TableCell>
                            </TableRow>
                        )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setIsAddIngredientOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />Thêm nguyên liệu
            </Button>
          </div>

          <Separator />

          {/* Section: Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="product-note" className="text-xs text-muted-foreground">Ghi chú pha chế</Label>
            <Textarea id="product-note" value={product.note || ''} onChange={(e) => handleFieldChange('note', e.target.value)} rows={3} placeholder="VD: Lắc đều trước khi phục vụ..."/>
          </div>
        </div>
        </ScrollArea>
        <DialogFooter className="p-6 pt-4 border-t bg-muted/30">
          <Button variant="outline" onClick={handleAttemptClose} disabled={isProcessing}>Hủy</Button>
          <Button onClick={handleSave} disabled={isProcessing}>
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isProcessing ? 'Đang lưu...' : 'Lưu mặt hàng'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
    <AddIngredientDialog
        isOpen={isAddIngredientOpen}
        onClose={() => setIsAddIngredientOpen(false)}
        onAddIngredient={handleAddIngredient}
        inventoryList={inventoryList}
        allProducts={allProducts}
        currentProductId={product.id}
    />

    <AlertDialog open={isConfirmCloseOpen} onOpenChange={setIsConfirmCloseOpen}>
        <AlertDialogContent>
        <AlertDialogHeader>
            <AlertDialogTitle>Hủy các thay đổi?</AlertDialogTitle>
            <AlertDialogDescription>
            Bạn có một số thay đổi chưa được lưu. Bạn có chắc chắn muốn hủy không?
            </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
            <AlertDialogCancel>Ở lại</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClose}>Hủy thay đổi</AlertDialogAction>
        </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
