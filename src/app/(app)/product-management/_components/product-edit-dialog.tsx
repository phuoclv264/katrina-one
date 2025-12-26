'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import type { Product, ProductIngredient, InventoryItem, UnitDefinition, GlobalUnit } from '@/lib/types';
import { Plus, Trash2, Box, Beaker, Loader2, X, Settings, SlidersHorizontal, ToggleRight, Star, ChevronsRight, Search, ArrowLeft, AlertTriangle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';

import isEqual from 'lodash.isequal';
import { toast } from '@/components/ui/pro-toast';
import { cn, normalizeSearchString } from '@/lib/utils';
import { Combobox } from '@/components/combobox';


function AddUnitSimple({
    baseUnitName,
    onAdd,
    globalUnits,
    onGlobalUnitsChange,
    canManageUnits,
}: {
    baseUnitName: string;
    onAdd: (newUnit: UnitDefinition) => void;
    globalUnits: GlobalUnit[];
    onGlobalUnitsChange: (newUnits: GlobalUnit[]) => void;
    canManageUnits: boolean;
}) {
    const [newUnitName, setNewUnitName] = useState('');
    const [newUnitQty, setNewUnitQty] = useState<number | ''>(1);
    const [baseUnitQty, setBaseUnitQty] = useState<number | ''>('');

    const unitOptions = React.useMemo(() => globalUnits.map(u => ({ value: u.name, label: u.name })), [globalUnits]);

    const handleCreateUnit = (name: string) => {
         const newUnit: GlobalUnit = { id: `unit-${Date.now()}`, name: name };
         const newUnits = [...globalUnits, newUnit].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
         onGlobalUnitsChange(newUnits);
         setNewUnitName(name);
    }

    const handleDeleteUnitGlobal = (name: string) => {
        if (!canManageUnits) return;
        const newUnits = globalUnits.filter(u => u.name !== name);
        onGlobalUnitsChange(newUnits);
        if (newUnitName === name) setNewUnitName('');
    }

    const handleAdd = () => {
        if (!newUnitName.trim() || !newUnitQty || !baseUnitQty) {
            toast.error("Vui lòng điền đầy đủ thông tin quy đổi.");
            return;
        }

        const conversionRate = Number(baseUnitQty) / Number(newUnitQty);
        onAdd({ name: newUnitName, conversionRate, isBaseUnit: false });
        
        // Reset form
        setNewUnitName('');
        setNewUnitQty(1);
        setBaseUnitQty('');
    };

    return (
        <div className="space-y-2 pt-4 mt-4 border-t border-dashed">
            <p className="text-sm font-medium">Thêm quy đổi đơn vị mới</p>
             <div className="flex items-center gap-2">
                <Input type="number" placeholder="SL" value={newUnitQty} onChange={e => setNewUnitQty(Number(e.target.value))} className="h-9 w-20" onFocus={(e) => e.target.select()} />
                 <Combobox 
                    options={unitOptions}
                    value={newUnitName}
                    onChange={setNewUnitName}
                    onCreate={canManageUnits ? handleCreateUnit : undefined}
                    onDelete={canManageUnits ? handleDeleteUnitGlobal : undefined}
                    confirmDelete
                    deleteMessage="Bạn có chắc chắn muốn xóa đơn vị này không?"
                    placeholder="Tên ĐV mới"
                    searchPlaceholder="Tìm đơn vị..."
                    emptyText="Không tìm thấy đơn vị."
                    className="flex-1"
                />
                <span className="font-bold">=</span>
                <Input type="number" placeholder="SL" value={baseUnitQty} onChange={e => setBaseUnitQty(Number(e.target.value))} className="h-9 w-20" onFocus={(e) => e.target.select()} />
                <span className="font-semibold text-sm">{baseUnitName}</span>
             </div>
             <Button size="sm" onClick={handleAdd} className="w-full h-9">Thêm đơn vị</Button>
        </div>
    );
}

function AddIngredientDialog({
  isOpen,
  onClose,
  onAddIngredients,
  inventoryList,
  allProducts,
  currentProductId,
  onInventoryItemUpdate,
  globalUnits,
  onGlobalUnitsChange,
  canManageUnits,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAddIngredients: (ingredients: ProductIngredient[]) => void;
  inventoryList: InventoryItem[];
  allProducts: Product[];
  currentProductId?: string;
  onInventoryItemUpdate: (updatedItem: InventoryItem) => void;
  globalUnits: GlobalUnit[];
  onGlobalUnitsChange: (newUnits: GlobalUnit[]) => void;
  canManageUnits: boolean;
}) {
  const [ingredientSource, setIngredientSource] = useState<'inventory' | 'product'>('inventory');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | Product | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [stagedIngredients, setStagedIngredients] = useState<ProductIngredient[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setSelectedItem(null);
      setSelectedUnit('');
      setQuantity(1);
      setIngredientSource('inventory');
      setStagedIngredients([]);
    }
  }, [isOpen]);
  
  const handleSelect = (item: InventoryItem | Product) => {
    setSelectedItem(item);
    setQuantity(1); // Reset quantity
    if ('baseUnit' in item) {
        setSelectedUnit(item.baseUnit);
    } else if ('yield' in item && item.yield) {
        setSelectedUnit(item.yield.unit);
    } else {
        setSelectedUnit('phần');
    }
  }
  
  const handleStageIngredient = () => {
    if (selectedItem && selectedUnit) {
        const newIngredient: Partial<ProductIngredient> = {
            name: selectedItem.name,
            quantity: quantity,
            unit: selectedUnit,
        };
        if (ingredientSource === 'inventory' && 'shortName' in selectedItem) {
            newIngredient.inventoryItemId = selectedItem.id;
        } else {
            newIngredient.productId = selectedItem.id;
        }
        setStagedIngredients(prev => [...prev, newIngredient as ProductIngredient]);
        setSelectedItem(null); // Go back to selection view
        setSearch('');
    }
  };

  const handleRemoveStaged = (index: number) => {
    setStagedIngredients(prev => prev.filter((_, i) => i !== index));
  }
  
  const handleFinalSubmit = () => {
    onAddIngredients(stagedIngredients);
    onClose();
  }

  const filteredItems = useMemo(() => {
    const normalizedSearchText = normalizeSearchString(search);
    if (ingredientSource === 'inventory') {
      return inventoryList.filter(item => normalizeSearchString(item.name).includes(normalizedSearchText));
    } else {
      return allProducts.filter(p =>
        p.id !== currentProductId &&
        p.isIngredient === true &&
        normalizeSearchString(p.name).includes(normalizedSearchText)
      );
    }
  }, [search, ingredientSource, inventoryList, allProducts, currentProductId]);
  
  const availableUnits = useMemo(() => {
      if (!selectedItem) return [];
      if ('units' in selectedItem && selectedItem.units) {
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
      <DialogContent 
        className="max-w-4xl p-0 h-full md:h-[90vh] flex flex-col bg-background rounded-xl shadow-lg"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-4 sm:p-6 pb-4 border-b">
          <DialogTitle>Thêm nguyên liệu</DialogTitle>
        </DialogHeader>

        <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
          {/* Left Panel: Search & Select */}
          <div className={cn(
            "w-full md:w-1/2 flex flex-col border-r overflow-y-auto",
            selectedItem && "hidden md:flex"
          )}>
            <div className="p-4 space-y-4 sticky top-0 bg-background z-10 border-b">
              <RadioGroup defaultValue="inventory" value={ingredientSource} onValueChange={(v) => { setIngredientSource(v as any); setSelectedItem(null); }} className="grid grid-cols-2 gap-2">
                  <Label htmlFor="source-inventory" className="flex items-center justify-center gap-2 border rounded-lg p-3 h-14 text-sm font-medium cursor-pointer data-[state=checked]:border-primary data-[state=checked]:bg-primary/10">
                      <RadioGroupItem value="inventory" id="source-inventory" /><Box className="h-4 w-4" /> Kho
                  </Label>
                  <Label htmlFor="source-product" className="flex items-center justify-center gap-2 border rounded-lg p-3 h-14 text-sm font-medium cursor-pointer data-[state=checked]:border-primary data-[state=checked]:bg-primary/10">
                      <RadioGroupItem value="product" id="source-product" /><Beaker className="h-4 w-4" /> SP Khác
                  </Label>
              </RadioGroup>
              <Command>
                <CommandInput placeholder="Tìm nguyên liệu..." value={search} onValueChange={setSearch} className="h-12 text-base" />
                <CommandList>
                    <CommandEmpty>Không tìm thấy.</CommandEmpty>
                    <CommandGroup>
                        {filteredItems.map((item) => (
                        <CommandItem key={item.id} onSelect={() => handleSelect(item)} className="p-4 cursor-pointer">
                            {item.name}
                        </CommandItem>
                        ))}
                    </CommandGroup>
                </CommandList>
              </Command>
            </div>
          </div>
          
          {/* Right Panel: Details & Staging */}
          <div className={cn(
            "flex-1 flex flex-col overflow-y-auto p-4",
            !selectedItem && "items-center justify-center"
          )}>
             {!selectedItem ? (
                <div className="text-center text-muted-foreground">
                    <Box className="mx-auto h-12 w-12 opacity-50" />
                    <p className="mt-4 text-sm">Chọn một nguyên liệu để xem chi tiết.</p>
                </div>
            ) : (
              <div className="flex flex-col gap-4">
                  <Button variant="ghost" onClick={() => setSelectedItem(null)} className="self-start -ml-4 md:hidden">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Chọn nguyên liệu khác
                  </Button>
                  <Card className="flex-1 flex flex-col bg-background rounded-2xl shadow-lg">
                      <CardHeader>
                          <CardTitle className="truncate text-xl">{selectedItem.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="flex-grow space-y-4">
                           <div className="space-y-2">
                              <Label className="text-base">Số lượng</Label>
                              <Input type="number" value={quantity} onChange={e => setQuantity(parseFloat(e.target.value) || 1)} min="0.1" step="0.1" className="h-12 text-lg" onFocus={(e) => e.target.select()} />
                           </div>
                           <div className="space-y-2">
                              <Label className="text-base">Đơn vị sử dụng</Label>
                               <Combobox
                                  value={selectedUnit}
                                  onChange={(val) => setSelectedUnit(val as string)}
                                  options={availableUnits.map(unit => ({ value: unit, label: unit }))}
                                  placeholder="Chọn đơn vị..."
                                  compact
                                  searchable={false}
                                  className="h-12 text-base w-full"
                               />
                           </div>
                           {ingredientSource === 'inventory' && 'baseUnit' in selectedItem && (
                              <div className="pt-4 mt-4 border-t">
                                  <AddUnitSimple 
                                    baseUnitName={selectedItem.baseUnit} 
                                    onAdd={handleAddNewUnit}
                                    globalUnits={globalUnits}
                                    onGlobalUnitsChange={onGlobalUnitsChange}
                                    canManageUnits={canManageUnits}
                                  />
                              </div>
                           )}
                      </CardContent>
                      <CardFooter>
                           <Button onClick={handleStageIngredient} disabled={!selectedItem || !selectedUnit} className="h-12 text-base w-full">
                              Thêm
                          </Button>
                      </CardFooter>
                  </Card>
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter className="p-4 sm:p-6 bg-muted/50 border-t flex-col md:flex-row h-auto">
            {stagedIngredients.length > 0 && (
              <div className="w-full mb-2 md:mb-0 md:flex-1 overflow-hidden">
                  <ScrollArea className="w-full whitespace-nowrap">
                      <div className="flex w-max space-x-2 pb-2">
                          {stagedIngredients.map((ing, index) => {
                            const isSubProduct = !!ing.productId;
                            return (
                              <Badge key={index} variant="secondary" className="text-sm h-auto py-1 pl-3 pr-1">
                                  <div className="flex items-center gap-1.5">
                                      {isSubProduct ? <Beaker className="h-3 w-3 text-purple-500"/> : <Box className="h-3 w-3 text-blue-500" />}
                                      <span>{ing.name} <span className="font-normal text-muted-foreground">({ing.quantity} {ing.unit})</span></span>
                                  </div>
                                  <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-5 w-5 ml-1"
                                      onClick={() => handleRemoveStaged(index)}
                                  >
                                      <X className="h-3 w-3" />
                                      <span className="sr-only">Xóa</span>
                                  </Button>
                              </Badge>
                            )
                          })}
                      </div>
                      <ScrollBar orientation="horizontal" />
                  </ScrollArea>
              </div>
            )}
             <div className="flex w-full md:w-auto gap-2 justify-end">
                <Button variant="outline" onClick={onClose} className="h-11 text-base w-full sm:w-auto">Đóng</Button>
                <Button onClick={handleFinalSubmit} disabled={stagedIngredients.length === 0} className="h-11 text-base w-full sm:w-auto">
                    Thêm ({stagedIngredients.length}) nguyên liệu
                </Button>
            </div>
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
  globalUnits: GlobalUnit[];
  onGlobalUnitsChange: (newUnits: GlobalUnit[]) => void;
  canManageUnits: boolean;
};

export default function ProductEditDialog({ isOpen, onClose, onSave, productToEdit, inventoryList, allProducts, onInventoryItemUpdate, globalUnits, onGlobalUnitsChange, canManageUnits }: ProductEditDialogProps) {
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

 const handleAddIngredients = (newIngredients: ProductIngredient[]) => {
    handleFieldChange('ingredients', [...(product.ingredients || []), ...newIngredients]);
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
      <DialogContent 
        className="max-w-3xl flex flex-col h-[90vh] p-0 bg-card rounded-xl shadow-lg"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle>{productToEdit ? 'Chỉnh sửa mặt hàng' : 'Thêm mặt hàng mới'}</DialogTitle>
          <DialogDescription>
            Quản lý công thức và thông tin chi tiết của sản phẩm.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow">
            <div className="space-y-6 p-6">
            
            {/* Section: Basic Info */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-primary"><Box className="h-4 w-4"/>Thông tin cơ bản</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="product-name" className="text-xs text-muted-foreground">Tên mặt hàng</Label>
                  <Input id="product-name" value={product.name || ''} onChange={(e) => handleFieldChange('name', e.target.value)} placeholder="VD: Cà phê sữa đá" onFocus={(e) => e.target.select()} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="product-category" className="text-xs text-muted-foreground">Danh mục</Label>
                  <Input id="product-category" value={product.category || ''} onChange={(e) => handleFieldChange('category', e.target.value)} placeholder="VD: CÀ PHÊ TRUYỀN THỐNG" onFocus={(e) => e.target.select()} />
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
                          <Input id="yield-qty" type="number" placeholder="Số lượng" value={product.yield?.quantity || ''} onChange={(e) => handleFieldChange('yield', { ...product.yield, quantity: Number(e.target.value) })} onFocus={(e) => e.target.select()} />
                      </div>
                      <div className="space-y-1.5">
                          <Label htmlFor="yield-unit" className="text-xs text-muted-foreground">Đơn vị thành phẩm</Label>
                          <Input id="yield-unit" placeholder="ml, g,..." value={product.yield?.unit || ''} onChange={(e) => handleFieldChange('yield', { ...product.yield, unit: e.target.value })} onFocus={(e) => e.target.select()} />
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
                            const isSubProduct = !!ing.productId;
                            const item = isSubProduct
                                ? allProducts.find(p => p.id === ing.productId)
                                : inventoryList.find(i => i.id === ing.inventoryItemId);
                            
                            let availableUnits: string[] = [];
                            if (item) {
                                if (isSubProduct && 'yield' in item) {
                                    availableUnits = [(item as Product).yield?.unit || 'phần'];
                                } else if (!isSubProduct && 'units' in item){
                                    availableUnits = (item as InventoryItem).units.map(u => u.name);
                                }
                            } else {
                                availableUnits = [ing.unit];
                            }

                            return (
                            <TableRow key={`${ing.inventoryItemId || ing.productId}-${index}`}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        {isSubProduct ? <Beaker className="h-4 w-4 text-purple-500"/> : <Box className="h-4 w-4 text-blue-500" />}
                                        {item ? <span>{item.name}</span> : <span className="flex items-center gap-2 text-yellow-600"><AlertTriangle className="h-4 w-4"/>{ing.name || 'Không rõ'}</span>}
                                    </div>
                                </TableCell>
                                <TableCell>
                                <Input
                                    type="number"
                                    value={ing.quantity}
                                    onChange={(e) => handleIngredientChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                                    className="h-8 text-right"
                                    onFocus={(e) => e.target.select()}
                                />
                                </TableCell>
                                <TableCell>
                                    <Combobox
                                        value={ing.unit}
                                        onChange={(val) => handleIngredientChange(index, 'unit', val as string)}
                                        options={availableUnits.map(unit => ({ value: unit, label: unit }))}
                                        compact
                                        searchable={false}
                                        className="h-8 w-full"
                                    />
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
              <Textarea id="product-note" value={product.note || ''} onChange={(e) => handleFieldChange('note', e.target.value)} rows={3} placeholder="VD: Lắc đều trước khi phục vụ..." onFocus={(e) => e.target.select()} />
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
      </DialogContent>
    </Dialog>
    
    <AddIngredientDialog
        isOpen={isAddIngredientOpen}
        onClose={() => setIsAddIngredientOpen(false)}
        onAddIngredients={handleAddIngredients}
        inventoryList={inventoryList}
        allProducts={allProducts}
        currentProductId={product.id}
        onInventoryItemUpdate={onInventoryItemUpdate}
        globalUnits={globalUnits}
        onGlobalUnitsChange={onGlobalUnitsChange}
        canManageUnits={canManageUnits}
    />
    </>
  );
}
