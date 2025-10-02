
'use client';
import React, { useState, useEffect, useMemo } from 'react';
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
import { Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

type ProductEditDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Product) => void;
  productToEdit: Product | null;
  inventoryList: InventoryItem[];
  allProducts: Product[]; // Pass all other products for sub-recipe selection
};

export default function ProductEditDialog({ isOpen, onClose, onSave, productToEdit, inventoryList, allProducts }: ProductEditDialogProps) {
  const [product, setProduct] = useState<Partial<Product>>({});
  const [isIngredientPopoverOpen, setIsIngredientPopoverOpen] = useState(false);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [ingredientSource, setIngredientSource] = useState<'inventory' | 'product'>('inventory');


  useEffect(() => {
    if (isOpen) {
      setProduct(productToEdit || {
        id: `prod_${uuidv4()}`,
        name: '',
        category: '',
        ingredients: [],
        note: '',
      });
      setIngredientSource('inventory');
    }
  }, [isOpen, productToEdit]);

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
        newIngredient.unit = (item as Product).yield?.unit || 'ml'; // Default unit for sub-products
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

  const handleSave = () => {
    if (!product.name || !product.category) {
        // Simple validation
        alert('Vui lòng nhập tên và danh mục cho mặt hàng.');
        return;
    }
    onSave(product as Product);
  };
  
  const filteredInventory = useMemo(() => {
    const searchLower = ingredientSearch.toLowerCase();
    if (ingredientSource === 'inventory') {
        return inventoryList.filter(item =>
            item.name.toLowerCase().includes(searchLower)
        );
    } else {
        // Filter out the current product to prevent self-referencing
        return allProducts.filter(p => p.id !== product.id && p.name.toLowerCase().includes(searchLower));
    }
  }, [ingredientSearch, inventoryList, allProducts, ingredientSource, product.id]);


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{productToEdit ? 'Chỉnh sửa mặt hàng' : 'Thêm mặt hàng mới'}</DialogTitle>
          <DialogDescription>
            Nhập thông tin chi tiết và công thức cho mặt hàng.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto pr-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product-name">Tên mặt hàng</Label>
              <Input id="product-name" value={product.name || ''} onChange={(e) => handleFieldChange('name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-category">Danh mục</Label>
              <Input id="product-category" value={product.category || ''} onChange={(e) => handleFieldChange('category', e.target.value)} placeholder="VD: CÀ PHÊ TRUYỀN THỐNG" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="yield-qty">Thành phẩm</Label>
                 <div className="flex gap-2">
                    <Input id="yield-qty" type="number" placeholder="Số lượng" value={product.yield?.quantity || ''} onChange={(e) => handleFieldChange('yield', { ...product.yield, quantity: Number(e.target.value) })} />
                    <Input placeholder="Đơn vị" value={product.yield?.unit || ''} onChange={(e) => handleFieldChange('yield', { ...product.yield, unit: e.target.value })}/>
                 </div>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold">Công thức</h4>
             <ScrollArea className="h-72 w-full rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-muted z-10">
                  <TableRow>
                    <TableHead className="w-[40%]">Nguyên liệu</TableHead>
                    <TableHead className="w-[20%]">Số lượng</TableHead>
                    <TableHead className="w-[30%]">Đơn vị</TableHead>
                    <TableHead className="w-[10%]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(product.ingredients || []).map((ing, index) => {
                    const item = ing.inventoryItemId
                        ? inventoryList.find(i => i.id === ing.inventoryItemId)
                        : allProducts.find(p => p.id === ing.productId);
                    const isSubProduct = !!ing.productId;

                    return (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                            {item?.name || 'Không rõ'}
                            {isSubProduct && <Badge variant="outline" className="ml-2">Công thức con</Badge>}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={ing.quantity}
                            onChange={(e) => handleIngredientChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                            className="h-8"
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
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveIngredient(index)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
             <Popover open={isIngredientPopoverOpen} onOpenChange={setIsIngredientPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline"><Plus className="mr-2 h-4 w-4" />Thêm nguyên liệu</Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0">
                <Command>
                    <div className="p-2 border-b">
                         <RadioGroup defaultValue="inventory" value={ingredientSource} onValueChange={(v) => setIngredientSource(v as any)} className="flex gap-2">
                            <Label htmlFor="source-inventory" className="flex items-center gap-2 border rounded-md p-2 flex-1 cursor-pointer [&:has([data-state=checked])]:border-primary">
                                <RadioGroupItem value="inventory" id="source-inventory" />
                                Từ Kho
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
          <div className="space-y-2">
            <Label htmlFor="product-note">Ghi chú pha chế</Label>
            <Textarea id="product-note" value={product.note || ''} onChange={(e) => handleFieldChange('note', e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={handleSave}>Lưu mặt hàng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
