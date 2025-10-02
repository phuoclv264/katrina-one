
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
import type { Product, ProductIngredient, InventoryItem } from '@/lib/types';
import { Plus, Trash2, Box, Beaker, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import isEqual from 'lodash.isequal';
import { toast } from 'react-hot-toast';


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
  const [isIngredientPopoverOpen, setIsIngredientPopoverOpen] = useState(false);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [ingredientSource, setIngredientSource] = useState<'inventory' | 'product'>('inventory');
  
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
      setIngredientSource('inventory');
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

  const handleAddIngredient = (item: InventoryItem | Product, type: 'inventory' | 'product') => {
    const newIngredient: Partial<ProductIngredient> = {
        name: item.name,
        quantity: 1,
        isMatched: true,
    };
    if (type === 'inventory') {
        newIngredient.inventoryItemId = item.id;
        newIngredient.unit = (item as InventoryItem).baseUnit;
    } else {
        newIngredient.productId = item.id;
        newIngredient.unit = (item as Product).yield?.unit || 'phần'; // Default unit for sub-products
    }

    const newIngredients = [...(product.ingredients || []), newIngredient as ProductIngredient];
    handleFieldChange('ingredients', newIngredients);
    setIsIngredientPopoverOpen(false);
    setIngredientSearch('');
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
  
  const filteredInventory = useMemo(() => {
    const searchLower = ingredientSearch.toLowerCase();
    if (ingredientSource === 'inventory') {
        return inventoryList.filter(item =>
            item.name.toLowerCase().includes(searchLower)
        );
    } else {
        return allProducts.filter(p => 
            p.id !== product.id && 
            p.isIngredient === true && 
            p.name.toLowerCase().includes(searchLower)
        );
    }
  }, [ingredientSearch, inventoryList, allProducts, ingredientSource, product.id]);

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleAttemptClose()}>
      <DialogContent className="max-w-3xl flex flex-col h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>{productToEdit ? 'Chỉnh sửa mặt hàng' : 'Thêm mặt hàng mới'}</DialogTitle>
          <DialogDescription>
            Quản lý công thức và thông tin chi tiết của sản phẩm.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow -mt-4 px-6">
          <div className="py-4 space-y-6">
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
                                <TableRow key={index}>
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
             <Popover open={isIngredientPopoverOpen} onOpenChange={setIsIngredientPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full"><Plus className="mr-2 h-4 w-4" />Thêm nguyên liệu</Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <Command>
                    <div className="p-2 border-b">
                         <RadioGroup defaultValue="inventory" value={ingredientSource} onValueChange={(v) => setIngredientSource(v as any)} className="flex gap-2">
                            <Label htmlFor="source-inventory" className="flex items-center gap-2 border rounded-md p-2 flex-1 cursor-pointer [&:has([data-state=checked])]:border-primary">
                                <RadioGroupItem value="inventory" id="source-inventory" />
                                Kho
                            </Label>
                             <Label htmlFor="source-product" className="flex items-center gap-2 border rounded-md p-2 flex-1 cursor-pointer [&:has([data-state=checked])]:border-primary">
                                <RadioGroupItem value="product" id="source-product" />
                                SP Khác
                            </Label>
                         </RadioGroup>
                    </div>
                    <CommandInput placeholder="Tìm kiếm..." value={ingredientSearch} onValueChange={setIngredientSearch} />
                    <CommandList>
                        <CommandEmpty>Không tìm thấy.</CommandEmpty>
                        <CommandGroup>
                            {filteredInventory.map((item) => (
                                <CommandItem key={item.id} onSelect={() => handleAddIngredient(item, ingredientSource)}>
                                    {item.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <Separator />

          {/* Section: Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="product-note" className="text-xs text-muted-foreground">Ghi chú pha chế</Label>
            <Textarea id="product-note" value={product.note || ''} onChange={(e) => handleFieldChange('note', e.target.value)} rows={3} placeholder="VD: Lắc đều trước khi phục vụ..."/>
          </div>
        </div>
        </ScrollArea>
        <DialogFooter className="p-6 pt-2 border-t">
          <Button variant="outline" onClick={handleAttemptClose} disabled={isProcessing}>Hủy</Button>
          <Button onClick={handleSave} disabled={isProcessing}>
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isProcessing ? 'Đang lưu...' : 'Lưu mặt hàng'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

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
