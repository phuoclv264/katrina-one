'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogBody,
  DialogAction,
  DialogCancel,
} from '@/components/ui/dialog';
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogIcon, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
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
    <Dialog open={isOpen} onOpenChange={onClose} dialogTag="add-ingredient-dialog" parentDialogTag="product-edit-dialog">
      <DialogContent
        className="max-w-4xl p-0 h-[90vh] flex flex-col bg-card"
      >
        <DialogHeader iconkey="layout">
          <DialogTitle>Thêm nguyên liệu</DialogTitle>
          <DialogDescription>Chọn nguyên liệu từ kho hoặc từ các món đã pha chế sẵn.</DialogDescription>
        </DialogHeader>

        <DialogBody className="p-0 flex flex-col md:flex-row">
          {/* Left Panel: Search & Select */}
          <div className={cn(
            "w-full md:w-[45%] flex flex-col border-r bg-muted/5",
            selectedItem && "hidden md:flex"
          )}>
            <div className="p-4 space-y-4 border-b bg-background">
              <RadioGroup 
                defaultValue="inventory" 
                value={ingredientSource} 
                onValueChange={(v) => { setIngredientSource(v as any); setSelectedItem(null); }} 
                className="grid grid-cols-2 gap-2"
              >
                <Label 
                  htmlFor="source-inventory" 
                  className="flex flex-col items-center justify-center gap-1.5 border-2 rounded-xl p-3 h-20 text-xs font-bold cursor-pointer transition-all hover:bg-muted/50 data-[state=checked]:border-primary data-[state=checked]:bg-primary/[0.03] data-[state=checked]:text-primary"
                >
                  <RadioGroupItem value="inventory" id="source-inventory" className="sr-only" />
                  <Box className="h-5 w-5" /> KHO HÀNG
                </Label>
                <Label 
                  htmlFor="source-product" 
                  className="flex flex-col items-center justify-center gap-1.5 border-2 rounded-xl p-3 h-20 text-xs font-bold cursor-pointer transition-all hover:bg-muted/50 data-[state=checked]:border-primary data-[state=checked]:bg-primary/[0.03] data-[state=checked]:text-primary"
                >
                  <RadioGroupItem value="product" id="source-product" className="sr-only" />
                  <Beaker className="h-5 w-5" /> MÓN CÔNG THỨC
                </Label>
              </RadioGroup>

              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input 
                  placeholder="Tìm tên nguyên liệu..." 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-11 pl-10 rounded-xl bg-muted/20 border-transparent focus:bg-background transition-all" 
                />
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {filteredItems.length === 0 ? (
                  <div className="py-20 text-center text-muted-foreground">
                    <p className="text-sm italic">Không tìm thấy kết quả nào</p>
                  </div>
                ) : (
                  filteredItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-xl text-left hover:bg-white dark:hover:bg-slate-900 border border-transparent hover:border-border transition-all group",
                        selectedItem?.id === item.id && "bg-white dark:bg-slate-900 border-border shadow-sm ring-1 ring-primary/10"
                      )}
                    >
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                        {ingredientSource === 'inventory' ? (
                          <Box className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                        ) : (
                          <Beaker className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                        )}
                      </div>
                      <span className="text-sm font-semibold group-hover:text-primary transition-colors">
                        {item.name}
                      </span>
                      <ChevronsRight className="h-4 w-4 ml-auto text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-all" />
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Right Panel: Details & Staging */}
          <div className={cn(
            "flex-1 flex flex-col bg-muted/[0.03]",
            !selectedItem && "items-center justify-center p-8 text-center"
          )}>
            {!selectedItem ? (
              <div className="max-w-[280px] space-y-4">
                <div className="h-20 w-20 rounded-3xl bg-muted/20 flex items-center justify-center mx-auto">
                  <Plus className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground/80">Chưa chọn nguyên liệu</h3>
                  <p className="text-sm text-muted-foreground">Vui lòng chọn một nguyên liệu từ danh sách bên trái để định lượng.</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="p-4 md:p-6 border-b bg-background flex items-center gap-4">
                  <Button variant="ghost" size="icon" onClick={() => setSelectedItem(null)} className="md:hidden">
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <div className="flex-1 truncate">
                    <div className="flex items-center gap-2 mb-0.5">
                       <Badge variant="outline" className="text-[10px] uppercase font-black py-0 px-1.5 h-4 border-primary/20 bg-primary/[0.03] text-primary/70">
                         {ingredientSource === 'inventory' ? 'Kho' : 'Công thức'}
                       </Badge>
                    </div>
                    <h3 className="text-lg font-black tracking-tight truncate">{selectedItem.name}</h3>
                  </div>
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-6 space-y-8">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Định lượng sử dụng</Label>
                        <div className="flex gap-2">
                          <Input 
                            type="number" 
                            value={quantity} 
                            onChange={e => setQuantity(parseFloat(e.target.value) || 0)} 
                            min="0.001" 
                            step="0.1" 
                            className="h-12 text-lg font-bold border-2 focus-visible:ring-primary/20" 
                            onFocus={(e) => e.target.select()} 
                          />
                          <div className="w-[160px] shrink-0">
                            <Combobox
                              value={selectedUnit}
                              onChange={(val) => setSelectedUnit(val as string)}
                              options={availableUnits.map(unit => ({ value: unit, label: unit }))}
                              placeholder="Đơn vị..."
                              compact
                              searchable={false}
                              className="h-12 text-base w-full font-bold border-2"
                            />
                          </div>
                        </div>
                      </div>

                      {ingredientSource === 'inventory' && 'baseUnit' in selectedItem && (
                        <div className="rounded-2xl border-2 border-dashed p-1">
                          <AddUnitSimple
                            baseUnitName={selectedItem.baseUnit}
                            onAdd={handleAddNewUnit}
                            globalUnits={globalUnits}
                            onGlobalUnitsChange={onGlobalUnitsChange}
                            canManageUnits={canManageUnits}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollArea>

                <div className="p-6 pt-0">
                  <Button 
                    onClick={handleStageIngredient} 
                    disabled={!selectedItem || !selectedUnit || quantity <= 0} 
                    className="h-12 text-base font-bold w-full rounded-2xl shadow-lg shadow-primary/10"
                  >
                    Thêm vào danh sách tạm
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter className="p-4 sm:p-6 bg-muted/10 border-t flex flex-col gap-4">
          {stagedIngredients.length > 0 && (
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Hàng chờ thêm ({stagedIngredients.length})
                </span>
                <button 
                  onClick={() => setStagedIngredients([])} 
                  className="text-[10px] font-bold text-destructive hover:underline uppercase tracking-tighter"
                >
                  Xóa tất cả
                </button>
              </div>
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-2 pb-2 px-1">
                  {stagedIngredients.map((ing, index) => {
                    const isSubProduct = !!ing.productId;
                    return (
                      <div 
                        key={index} 
                        className="flex items-center gap-2 py-1.5 pl-3 pr-1 bg-background border rounded-xl shadow-sm animate-in fade-in zoom-in duration-200"
                      >
                        <div className="flex items-center gap-1.5">
                          {isSubProduct ? (
                            <Beaker className="h-3.5 w-3.5 text-purple-500" />
                          ) : (
                            <Box className="h-3.5 w-3.5 text-blue-500" />
                          )}
                          <span className="text-sm font-bold truncate max-w-[120px]">{ing.name}</span>
                          <span className="text-xs text-muted-foreground mr-1">{ing.quantity} {ing.unit}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-lg hover:bg-destructive/10 text-destructive/50 hover:text-destructive"
                          onClick={() => handleRemoveStaged(index)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          )}
          <div className="flex items-center justify-end gap-3 w-full">
            <DialogCancel onClick={onClose} className="flex-1 sm:flex-none">
              Đóng
            </DialogCancel>
            <DialogAction 
              onClick={handleFinalSubmit} 
              disabled={stagedIngredients.length === 0} 
              className="flex-1 sm:flex-none min-w-[160px]"
            >
              Thành công
            </DialogAction>
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
  parentDialogTag: string;
};

export default function ProductEditDialog({ isOpen, onClose, onSave, productToEdit, inventoryList, allProducts, onInventoryItemUpdate, globalUnits, onGlobalUnitsChange, canManageUnits, parentDialogTag }: ProductEditDialogProps) {
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
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleAttemptClose()} dialogTag="product-edit-dialog" parentDialogTag="root">
        <DialogContent
          className="max-w-3xl flex flex-col h-[90vh] p-0 bg-card overflow-hidden"
        >
          <DialogHeader iconkey="layout">
            <DialogTitle>{productToEdit ? 'Chỉnh sửa mặt hàng' : 'Thêm mặt hàng mới'}</DialogTitle>
            <DialogDescription>
              Quản lý công thức và thông tin chi tiết của sản phẩm để tự động hóa định lượng kho.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="bg-muted/[0.02]">
            <div className="space-y-8 py-2">
              {/* Section: Basic Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                   <div className="h-6 w-1 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                   <h4 className="text-sm font-black uppercase tracking-widest text-foreground/70">Thông tin cơ bản</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-background p-6 rounded-[2rem] border shadow-sm">
                  <div className="space-y-2">
                    <Label htmlFor="product-name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Tên mặt hàng</Label>
                    <Input 
                      id="product-name" 
                      value={product.name || ''} 
                      onChange={(e) => handleFieldChange('name', e.target.value)} 
                      placeholder="VD: Cà phê sữa đá" 
                      className="h-12 rounded-xl border-muted-foreground/20 font-bold text-base bg-muted/5 group-hover:bg-muted/10 transition-all"
                      onFocus={(e) => e.target.select()} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product-category" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Danh mục</Label>
                    <Input 
                      id="product-category" 
                      value={product.category || ''} 
                      onChange={(e) => handleFieldChange('category', e.target.value)} 
                      placeholder="VD: CÀ PHÊ TRUYỀN THỐNG" 
                      className="h-12 rounded-xl border-muted-foreground/20 font-bold text-base bg-muted/5 group-hover:bg-muted/10 transition-all"
                      onFocus={(e) => e.target.select()} 
                    />
                  </div>
                </div>
              </div>

              {/* Section: Sub-recipe options */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                   <div className="h-6 w-1 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                   <h4 className="text-sm font-black uppercase tracking-widest text-foreground/70">Cấu hình pha chế</h4>
                </div>
                
                <div className="space-y-4 bg-background p-6 rounded-[2rem] border shadow-sm">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/10 border-2 border-transparent hover:border-primary/10 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <Beaker className="h-5 w-5" />
                      </div>
                      <div>
                        <Label htmlFor="is-ingredient-switch" className="font-bold text-sm cursor-pointer block">Dùng làm nguyên liệu</Label>
                        <p className="text-xs text-muted-foreground">Bật nếu đây là công thức con (ví dụ: kem nền, trà ủ sẵn).</p>
                      </div>
                    </div>
                    <Switch
                      id="is-ingredient-switch"
                      checked={product.isIngredient}
                      onCheckedChange={(checked) => handleFieldChange('isIngredient', checked)}
                    />
                  </div>

                  {product.isIngredient && (
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-dashed mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="space-y-2">
                        <Label htmlFor="yield-qty" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Lượng thành phẩm</Label>
                        <Input 
                          id="yield-qty" 
                          type="number" 
                          placeholder="Số lượng" 
                          value={product.yield?.quantity || ''} 
                          onChange={(e) => handleFieldChange('yield', { ...product.yield, quantity: Number(e.target.value) })} 
                          className="h-11 rounded-xl font-bold"
                          onFocus={(e) => e.target.select()} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="yield-unit" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Đơn vị đo</Label>
                        <Input 
                          id="yield-unit" 
                          placeholder="ml, g,..." 
                          value={product.yield?.unit || ''} 
                          onChange={(e) => handleFieldChange('yield', { ...product.yield, unit: e.target.value })} 
                          className="h-11 rounded-xl font-bold"
                          onFocus={(e) => e.target.select()} 
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Section: Ingredients */}
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-1 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                    <h4 className="text-sm font-black uppercase tracking-widest text-foreground/70">Công thức pha chế</h4>
                  </div>
                  <Badge variant="outline" className="font-black rounded-lg">
                    {(product.ingredients || []).length} mục
                  </Badge>
                </div>

                <div className="bg-background rounded-[2rem] border shadow-sm overflow-hidden">
                  <div className="overflow-x-auto min-h-[140px]">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow className="hover:bg-transparent border-none">
                          <TableHead className="w-[45%] h-11 text-[10px] font-black uppercase tracking-widest">Nguyên liệu</TableHead>
                          <TableHead className="w-[20%] h-11 text-[10px] font-black uppercase tracking-widest text-right">Số lượng</TableHead>
                          <TableHead className="w-[25%] h-11 text-[10px] font-black uppercase tracking-widest">Đơn vị</TableHead>
                          <TableHead className="w-[10%] h-11"></TableHead>
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
                              } else if (!isSubProduct && 'units' in item) {
                                availableUnits = (item as InventoryItem).units.map(u => u.name);
                              }
                            } else {
                              availableUnits = [ing.unit];
                            }

                            return (
                              <TableRow key={`${ing.inventoryItemId || ing.productId}-${index}`} className="group hover:bg-muted/5 border-muted/10">
                                <TableCell className="py-3">
                                  <div className="flex items-center gap-2.5">
                                    <div className={cn(
                                      "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                                      isSubProduct ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                                    )}>
                                      {isSubProduct ? <Beaker className="h-4 w-4" /> : <Box className="h-4 w-4" />}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                      {item ? (
                                        <span className="text-sm font-bold truncate">{item.name}</span>
                                      ) : (
                                        <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-md">
                                          <AlertTriangle className="h-3 w-3" /> {ing.name || 'Không rõ'}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="py-3 text-right">
                                  <Input
                                    type="number"
                                    value={ing.quantity}
                                    onChange={(e) => handleIngredientChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                                    className="h-9 text-right font-black rounded-lg border-muted-foreground/10 bg-muted/10 w-20 ml-auto"
                                    onFocus={(e) => e.target.select()}
                                  />
                                </TableCell>
                                <TableCell className="py-3">
                                  <Combobox
                                    value={ing.unit}
                                    onChange={(val) => handleIngredientChange(index, 'unit', val as string)}
                                    options={availableUnits.map(unit => ({ value: unit, label: unit }))}
                                    compact
                                    searchable={false}
                                    className="h-9 w-full rounded-lg border-muted-foreground/10"
                                  />
                                </TableCell>
                                <TableCell className="py-3 text-right">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => handleRemoveIngredient(index)} 
                                    className="h-8 w-8 rounded-lg text-destructive/40 hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )
                          })
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="h-32 text-center text-muted-foreground/50 italic text-sm">
                              Chưa có nguyên liệu nào trong công thức này
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="p-4 bg-muted/5 border-t">
                    <Button 
                      variant="outline" 
                      className="w-full h-11 rounded-xl border-dashed border-2 hover:bg-background hover:border-primary/50 transition-all font-bold gap-2" 
                      onClick={() => setIsAddIngredientOpen(true)}
                    >
                      <Plus className="h-4 w-4" /> THÊM NGUYÊN LIỆU CHI TIẾT
                    </Button>
                  </div>
                </div>
              </div>

              {/* Section: Notes */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                   <div className="h-6 w-1 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                   <h4 className="text-sm font-black uppercase tracking-widest text-foreground/70">Ghi chú & Hướng dẫn</h4>
                </div>
                <div className="bg-background p-6 rounded-[2rem] border shadow-sm space-y-2">
                  <Label htmlFor="product-note" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Lưu ý khi pha chế (tùy chọn)</Label>
                  <Textarea 
                    id="product-note" 
                    value={product.note || ''} 
                    onChange={(e) => handleFieldChange('note', e.target.value)} 
                    rows={3} 
                    placeholder="VD: Lắc đều trước khi phục vụ, thêm đá sau cùng..." 
                    className="rounded-2xl border-muted-foreground/20 focus:border-primary/50 bg-muted/5 group-hover:bg-muted/10 transition-all min-h-[100px]"
                    onFocus={(e) => e.target.select()} 
                  />
                </div>
              </div>
            </div>
          </DialogBody>

          <DialogFooter className="bg-muted/10 border-t p-6">
            <DialogCancel onClick={handleAttemptClose} disabled={isProcessing} className="flex-1 sm:flex-none">
              Hủy bỏ
            </DialogCancel>
            <DialogAction 
              onClick={handleSave} 
              disabled={isProcessing} 
              isLoading={isProcessing}
              className="flex-1 sm:flex-none min-w-[180px]"
            >
              {isProcessing ? 'Đang lưu dữ liệu...' : 'Hoàn tất & Lưu'}
            </DialogAction>
          </DialogFooter>
          
          <AlertDialog open={isConfirmCloseOpen} onOpenChange={setIsConfirmCloseOpen} dialogTag="alert-dialog" parentDialogTag="root" variant="warning">
            <AlertDialogContent>
              <AlertDialogHeader>
                <div className="space-y-2">
                  <AlertDialogTitle>Hủy các thay đổi?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Mọi dữ liệu bạn vừa nhập liệu cho công thức này sẽ bị xóa bỏ hoàn toàn. Bạn có chắc chắn muốn thoát ngay bây giờ?
                  </AlertDialogDescription>
                </div>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Ở lại tiếp tục</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmClose}>Xác nhận hủy</AlertDialogAction>
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
