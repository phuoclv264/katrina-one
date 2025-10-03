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
import type { Product, ProductIngredient, InventoryItem, UnitDefinition } from '@/lib/types';
import { Plus, Trash2, Box, Beaker, Loader2, X, Settings, SlidersHorizontal, ToggleRight, Star, ChevronsRight, Search, ArrowLeft } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';


import isEqual from 'lodash.isequal';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

function UnitEditor({ units, onUnitsChange }: { units: UnitDefinition[], onUnitsChange: (newUnits: UnitDefinition[]) => void }) {
    
    const handleAddUnit = () => {
        const newUnit: UnitDefinition = { name: 'Đơn vị mới', isBaseUnit: false, conversionRate: 1 };
        onUnitsChange([...units, newUnit]);
    }

    const handleUpdateUnit = (index: number, field: keyof UnitDefinition, value: string | number | boolean) => {
        let newUnits = [...units];
        const unitToUpdate = { ...newUnits[index] };

        if (field === 'isBaseUnit' && value === true) {
            const newBaseUnitName = unitToUpdate.name;
            const oldBaseUnit = newUnits.find(u => u.isBaseUnit);
            
            if (oldBaseUnit && oldBaseUnit.name !== newBaseUnitName) {
                const newBaseConversionRate = unitToUpdate.conversionRate;
                newUnits = newUnits.map(u => ({
                    ...u,
                    isBaseUnit: u.name === newBaseUnitName,
                    conversionRate: u.conversionRate / newBaseConversionRate
                }));
            } else {
                 newUnits = newUnits.map(u => ({
                    ...u,
                    isBaseUnit: u.name === newBaseUnitName,
                }));
                 const newBase = newUnits.find(u => u.isBaseUnit);
                 if(newBase) newBase.conversionRate = 1;
            }
        } else {
            (unitToUpdate as any)[field] = value;
            newUnits[index] = unitToUpdate;
        }

        onUnitsChange(newUnits);
    }
    
    const handleDeleteUnit = (index: number) => {
        if(units[index].isBaseUnit && units.length > 1) {
            toast.error("Không thể xóa đơn vị cơ sở. Vui lòng đặt một đơn vị khác làm cơ sở trước.");
            return;
        }
        if(units.length === 1){
            toast.error("Phải có ít nhất một đơn vị.");
            return;
        }
        const newUnits = units.filter((_, i) => i !== index);
        onUnitsChange(newUnits);
    }

    const baseUnitName = units.find(u => u.isBaseUnit)?.name || 'N/A';

    return (
        <div className="space-y-3">
             {units.map((unit, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center p-2 border rounded-md">
                    <div className="col-span-4">
                        <Label htmlFor={`unit-name-${index}`} className="text-xs text-muted-foreground">Tên đơn vị</Label>
                        <Input id={`unit-name-${index}`} value={unit.name} onChange={e => handleUpdateUnit(index, 'name', e.target.value)} />
                    </div>
                     <div className="col-span-5">
                        <Label htmlFor={`unit-rate-${index}`} className="text-xs text-muted-foreground">1 {unit.name} = ? {baseUnitName}</Label>
                        <Input id={`unit-rate-${index}`} type="number" value={unit.conversionRate} onChange={e => handleUpdateUnit(index, 'conversionRate', Number(e.target.value))} disabled={unit.isBaseUnit} />
                    </div>
                     <div className="col-span-2 flex flex-col items-center justify-center pt-4">
                        <Switch id={`unit-isBase-${index}`} checked={unit.isBaseUnit} onCheckedChange={c => handleUpdateUnit(index, 'isBaseUnit', c)} />
                        <Label htmlFor={`unit-isBase-${index}`} className="text-xs mt-1">Cơ sở</Label>
                    </div>
                    <div className="col-span-1 flex items-center justify-center pt-5">
                         <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteUnit(index)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                </div>
            ))}
            <div className='flex gap-2'>
              <Button variant="outline" size="sm" onClick={handleAddUnit}><Plus className="mr-2 h-4 w-4"/> Thêm ĐV (Đơn giản)</Button>
            </div>
            <AddUnitAdvanced onAdd={(newUnit) => onUnitsChange([...units, newUnit])} existingUnits={units} />
        </div>
    )
}

function AddUnitAdvanced({ 
    onAdd,
    existingUnits 
}: { 
    onAdd: (newUnit: UnitDefinition) => void,
    existingUnits: UnitDefinition[]
}) {
    const [unitA_qty, setUnitA_qty] = useState('1');
    const [unitA_name, setUnitA_name] = useState('');
    const [unitB_qty, setUnitB_qty] = useState('');
    const [unitB_name, setUnitB_name] = useState('');

    const handleAddUnit = () => {
        const qtyA = parseFloat(unitA_qty);
        const qtyB = parseFloat(unitB_qty);
        const nameA = unitA_name.trim();
        const nameB = unitB_name.trim();

        if (isNaN(qtyA) || isNaN(qtyB) || !nameA || !nameB) {
            toast.error("Vui lòng điền đầy đủ thông tin quy đổi.");
            return;
        }

        const unitA_exists = existingUnits.find(u => u.name === nameA);
        const unitB_exists = existingUnits.find(u => u.name === nameB);

        if (!unitA_exists && !unitB_exists) {
            toast.error("Ít nhất một trong hai đơn vị phải là đơn vị đã tồn tại.");
            return;
        }
        if (unitA_exists && unitB_exists) {
            toast.error("Không thể tạo mối quan hệ giữa hai đơn vị đã có. Vui lòng chỉnh sửa trực tiếp.");
            return;
        }

        const newUnitName = unitA_exists ? nameB : nameA;
        const knownUnit = unitA_exists ? unitA_exists : unitB_exists!;
        
        let newConversionRate = 1;

        if (unitA_exists) { // Known unit is A, new unit is B
            // qtyA of A = qtyB of B  => 1 B = (qtyA / qtyB) A
            newConversionRate = (qtyA / qtyB) * knownUnit.conversionRate;
        } else { // Known unit is B, new unit is A
            // qtyA of A = qtyB of B => 1 A = (qtyB / qtyA) B
            newConversionRate = (qtyB / qtyA) * knownUnit.conversionRate;
        }
        
        onAdd({ name: newUnitName, conversionRate: newConversionRate, isBaseUnit: false });
        
        // Reset form
        setUnitA_qty('1'); setUnitA_name('');
        setUnitB_qty(''); setUnitB_name('');
        toast.success(`Đã thêm quy đổi cho đơn vị "${newUnitName}".`);
    }

    return (
        <div className="space-y-2 pt-4 mt-4 border-t border-dashed">
            <p className="text-sm font-medium">Thêm đơn vị (Nâng cao)</p>
            <p className="text-xs text-muted-foreground">Điền vào mối quan hệ quy đổi. Ít nhất một trong hai đơn vị phải là đơn vị đã tồn tại.</p>
            <div className="flex items-center gap-2">
                <Input type="number" value={unitA_qty} onChange={e => setUnitA_qty(e.target.value)} className="w-1/4 h-9"/>
                <Input placeholder="Tên ĐV 1..." value={unitA_name} onChange={e => setUnitA_name(e.target.value)} className="h-9" />
                <span className="font-bold">=</span>
                <Input type="number" value={unitB_qty} onChange={e => setUnitB_qty(e.target.value)} className="w-1/4 h-9"/>
                <Input placeholder="Tên ĐV 2..." value={unitB_name} onChange={e => setUnitB_name(e.target.value)} className="h-9"/>
            </div>
            <Button size="sm" onClick={handleAddUnit} className="w-full h-9">Thêm quy đổi này</Button>
        </div>
    )
}

function AddIngredientDialog({
  isOpen,
  onClose,
  onAddIngredient,
  inventoryList,
  allProducts,
  currentProductId,
  onInventoryItemUpdate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAddIngredient: (item: InventoryItem | Product, type: 'inventory' | 'product', unit: string, quantity: number) => void;
  inventoryList: InventoryItem[];
  allProducts: Product[];
  currentProductId?: string;
  onInventoryItemUpdate: (updatedItem: InventoryItem) => void;
}) {
  const [ingredientSource, setIngredientSource] = useState<'inventory' | 'product'>('inventory');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | Product | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setSelectedItem(null);
      setSelectedUnit('');
      setQuantity(1);
      setIngredientSource('inventory');
    }
  }, [isOpen]);
  
  const handleSelect = (item: InventoryItem | Product) => {
    setSelectedItem(item);
    if ('baseUnit' in item) {
        setSelectedUnit(item.baseUnit);
    } else if ('yield' in item && item.yield) {
        setSelectedUnit(item.yield.unit);
    } else {
        setSelectedUnit('phần');
    }
  }
  
  const handleAdd = () => {
    if (selectedItem && selectedUnit) {
        onAddIngredient(selectedItem, ingredientSource, selectedUnit, quantity);
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
      if ('units' in selectedItem) {
          return selectedItem.units.map(u => u.name);
      }
      if ('yield' in selectedItem && selectedItem.yield) {
          return [selectedItem.yield.unit];
      }
      return ['phần'];
  }, [selectedItem]);
  
  const handleAddNewUnit = (newUnit: UnitDefinition) => {
      if (!selectedItem || !('units' in selectedItem)) return;

      const updatedItem = { ...selectedItem, units: [...selectedItem.units, newUnit] };
      
      setSelectedItem(updatedItem as InventoryItem);
      setSelectedUnit(newUnit.name);
      onInventoryItemUpdate(updatedItem as InventoryItem);

      toast.success(`Đã thêm đơn vị "${newUnit.name}" cho "${updatedItem.name}".`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 sm:p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle>Thêm nguyên liệu</DialogTitle>
          <DialogDescription>Tìm kiếm và chọn một nguyên liệu từ kho hoặc một sản phẩm khác.</DialogDescription>
        </DialogHeader>
        <div className="p-6 pt-0 h-[70vh] md:h-auto flex flex-col">
          {!selectedItem ? (
            // VIEW 1: SELECTION LIST
            <div className="flex flex-col gap-4 flex-grow">
                <RadioGroup defaultValue="inventory" value={ingredientSource} onValueChange={(v) => { setIngredientSource(v as any); setSelectedItem(null); }} className="flex gap-2">
                    <Label htmlFor="source-inventory" className="flex items-center gap-2 border rounded-md p-3 h-14 flex-1 cursor-pointer [&:has([data-state=checked])]:border-primary">
                        <RadioGroupItem value="inventory" id="source-inventory" /><Box className="h-4 w-4" /> Kho
                    </Label>
                    <Label htmlFor="source-product" className="flex items-center gap-2 border rounded-md p-3 h-14 flex-1 cursor-pointer [&:has([data-state=checked])]:border-primary">
                        <RadioGroupItem value="product" id="source-product" /><Beaker className="h-4 w-4" /> SP Khác
                    </Label>
                </RadioGroup>
                 <Command className="border rounded-lg flex-grow">
                  <div className="flex items-center border-b px-4">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <CommandInput placeholder="Tìm kiếm..." value={search} onValueChange={setSearch} className="h-12" />
                  </div>
                  <ScrollArea className="h-[calc(100%-60px)]">
                    <CommandList>
                      <CommandEmpty>Không tìm thấy.</CommandEmpty>
                      <CommandGroup>
                        {filteredItems.map((item) => (
                          <CommandItem key={item.id} onSelect={() => handleSelect(item)} className="p-3">
                            {item.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </ScrollArea>
                </Command>
            </div>
          ) : (
            // VIEW 2: DETAILS
            <div className="flex flex-col gap-4 flex-grow">
                <Button variant="ghost" onClick={() => setSelectedItem(null)} className="self-start -ml-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Chọn nguyên liệu khác
                </Button>
                <Card className="flex-1 flex flex-col bg-muted/30 rounded-2xl shadow-lg">
                    <CardHeader>
                        <CardTitle className="truncate">{selectedItem.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-grow space-y-4">
                         <div className="space-y-2">
                            <Label>Số lượng</Label>
                            <Input type="number" value={quantity} onChange={e => setQuantity(parseFloat(e.target.value) || 1)} min="0.1" step="0.1" className="h-11 text-lg" />
                         </div>
                         <div className="space-y-2">
                            <Label>Đơn vị sử dụng</Label>
                             <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                                <SelectTrigger className="h-11 text-base">
                                    <SelectValue placeholder="Chọn đơn vị..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableUnits.map(unit => (
                                        <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                                    ))}
                                </SelectContent>
                             </Select>
                         </div>
                         {ingredientSource === 'inventory' && (
                            <AddUnitAdvanced onAdd={handleAddNewUnit} existingUnits={(selectedItem as InventoryItem).units} />
                         )}
                    </CardContent>
                </Card>
            </div>
          )}
        </div>
        <DialogFooter className="p-6 pt-0 border-t flex-col-reverse sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} className="h-12 text-base sm:h-10 sm:text-sm">Hủy</Button>
          <Button onClick={handleAdd} disabled={!selectedItem || !selectedUnit} className="h-12 text-base sm:h-10 sm:text-sm">Thêm vào công thức</Button>
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
  onInventoryItemUpdate: (updatedItem: InventoryItem) => void;
};

export default function ProductEditDialog({ isOpen, onClose, onSave, productToEdit, inventoryList, allProducts, onInventoryItemUpdate }: ProductEditDialogProps) {
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

 const handleAddIngredient = (item: InventoryItem | Product, type: 'inventory' | 'product', unit: string, quantity: number) => {
    const newIngredient: Partial<ProductIngredient> = {
        name: item.name,
        quantity: quantity,
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
      <DialogContent className="max-w-3xl flex flex-col h-[90vh] p-0 bg-white dark:bg-card rounded-xl shadow-lg">
        <DialogHeader className="p-6 pb-4 border-b bg-muted/30 dark:bg-card/50">
          <DialogTitle>{productToEdit ? 'Chỉnh sửa mặt hàng' : 'Thêm mặt hàng mới'}</DialogTitle>
          <DialogDescription>
            Quản lý công thức và thông tin chi tiết của sản phẩm.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow -mx-6 px-6">
          <div className="space-y-6 py-4 px-1">
            
            {/* Section: Basic Info */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-primary"><Box className="h-4 w-4"/>Thông tin cơ bản</h4>
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
                <h4 className="text-sm font-semibold flex items-center gap-2 text-primary"><Settings className="h-4 w-4"/>Tùy chọn</h4>
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
                <Table>
                    <TableHeader>
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
        onInventoryItemUpdate={onInventoryItemUpdate}
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
