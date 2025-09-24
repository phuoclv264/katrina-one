
'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SupplierCombobox } from '@/components/supplier-combobox';
import { toast } from 'react-hot-toast';
import isEqual from 'lodash.isequal';
import type { InventoryItem, UnitDefinition } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { Box, Settings, SlidersHorizontal, ToggleRight, Trash2, Plus, Star } from 'lucide-react';


function UnitEditor({ units, onUnitsChange }: { units: UnitDefinition[], onUnitsChange: (newUnits: UnitDefinition[]) => void }) {
    
    const handleAddUnit = () => {
        const newUnit: UnitDefinition = { name: 'Đơn vị mới', isBaseUnit: false, conversionRate: 1 };
        onUnitsChange([...units, newUnit]);
    }

    const handleUpdateUnit = (index: number, field: keyof UnitDefinition, value: string | number | boolean) => {
        const newUnits = [...units];
        const unitToUpdate = { ...newUnits[index] };

        if (field === 'isBaseUnit' && value === true) {
            // If setting a new base unit, unset the old one
            newUnits.forEach((u, i) => {
                if(u.isBaseUnit) newUnits[i] = {...u, isBaseUnit: false};
            });
            unitToUpdate.isBaseUnit = true;
            unitToUpdate.conversionRate = 1; // Base unit always has rate of 1
        } else {
             (unitToUpdate as any)[field] = value;
        }

        newUnits[index] = unitToUpdate;
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
            <Button variant="outline" size="sm" onClick={handleAddUnit}><Plus className="mr-2 h-4 w-4"/> Thêm đơn vị</Button>
        </div>
    )
}


export default function ItemEditPopover({
    item: initialItem,
    suppliers,
    onUpdate,
    onSupplierChange,
    children
}: {
    item: InventoryItem;
    suppliers: string[];
    onUpdate: (updatedItem: InventoryItem) => void;
    onSupplierChange: (newSupplier: string) => void;
    children: React.ReactNode;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [item, setItem] = useState(initialItem);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isConfirmCloseOpen, setIsConfirmCloseOpen] = useState(false);
    
    // State for orderSuggestion UI
    const [orderSuggestionQty, setOrderSuggestionQty] = useState<number | string>('');
    const [orderSuggestionUnit, setOrderSuggestionUnit] = useState<string>('');


    useEffect(() => {
        if (isOpen) {
            setItem(initialItem);
            setHasUnsavedChanges(false);

            // Parse orderSuggestion when dialog opens
            const suggestion = initialItem.orderSuggestion || '';
            const match = suggestion.match(/^(\d*\.?\d+)\s*(.*)$/);
            if (match) {
                setOrderSuggestionQty(parseFloat(match[1]));
                setOrderSuggestionUnit(match[2] || initialItem.baseUnit);
            } else {
                setOrderSuggestionQty(suggestion || '');
                setOrderSuggestionUnit(initialItem.baseUnit);
            }

        }
    }, [isOpen, initialItem]);
    
    useEffect(() => {
      setHasUnsavedChanges(!isEqual(item, initialItem));
    }, [item, initialItem]);
    
    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
        if (isOpen) {
            event.preventDefault();
            handleCloseDialog(false);
        }
        };

        if (isOpen) {
        window.history.pushState({ dialogOpen: true }, '');
        window.addEventListener('popstate', handlePopState);
        }

        return () => {
        window.removeEventListener('popstate', handlePopState);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, hasUnsavedChanges]);


    const handleFieldChange = (field: keyof InventoryItem, value: any) => {
        setItem(prev => {
            if (field === 'units') {
                const newUnits = value as UnitDefinition[];
                const newBaseUnit = newUnits.find(u => u.isBaseUnit)?.name || prev.baseUnit;
                return { ...prev, units: newUnits, baseUnit: newBaseUnit };
            }
            return { ...prev, [field]: value }
        });
    };

    // Combine qty and unit back into orderSuggestion string before saving
    const combineOrderSuggestion = () => {
        const qty = String(orderSuggestionQty).trim();
        const unit = orderSuggestionUnit.trim();
        if (!qty) {
            handleFieldChange('orderSuggestion', '');
            return;
        }
        const combined = `${qty}${unit ? ` ${unit}` : ''}`;
        handleFieldChange('orderSuggestion', combined);
    };

    // Use an effect to update the main item state when the suggestion parts change
    useEffect(() => {
        const qty = String(orderSuggestionQty).trim();
        const unit = orderSuggestionUnit.trim();
        const combined = `${qty}${unit ? ` ${unit}` : ''}`;
        if (item.orderSuggestion !== combined) {
             setItem(prev => ({...prev, orderSuggestion: combined}));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderSuggestionQty, orderSuggestionUnit]);


    const handleSave = () => {
        const baseUnitCount = item.units.filter(u => u.isBaseUnit).length;
        if (baseUnitCount === 0) {
            toast.error("Phải có một đơn vị được chọn làm đơn vị cơ sở.");
            return;
        }
        if (baseUnitCount > 1) {
            toast.error("Chỉ có thể có một đơn vị cơ sở.");
            return;
        }

        if (hasUnsavedChanges) {
            onUpdate(item);
            if (item.supplier && !suppliers.includes(item.supplier)) {
                 onSupplierChange(item.supplier);
            }
             toast.success(`Đã cập nhật mặt hàng "${item.name}".`);
        } else {
            toast('Không có thay đổi nào để lưu.');
        }
        setIsOpen(false);
    };
    
    const handleCloseDialog = (open: boolean) => {
      if (!open && hasUnsavedChanges) {
        setIsConfirmCloseOpen(true);
      } else {
        setIsOpen(open);
      }
    };
    
    const handleConfirmClose = () => {
        setIsConfirmCloseOpen(false);
        setIsOpen(false);
    };


    return (
        <Dialog open={isOpen} onOpenChange={handleCloseDialog}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-w-2xl bg-card">
                <DialogHeader>
                    <DialogTitle>Chỉnh sửa: {initialItem.name}</DialogTitle>
                    <DialogDescription>
                        Kho &gt; {initialItem.category} &gt; {initialItem.name}
                    </DialogDescription>
                </DialogHeader>
                 <ScrollArea className="max-h-[70vh] -mx-6 px-6">
                    <div className="space-y-6 py-4 px-1">
                        
                        <div className="space-y-4">
                            <h4 className="text-sm font-semibold flex items-center gap-2 text-primary"><Box className="h-4 w-4"/>Thông tin cơ bản</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor={`name-${item.id}`} className="text-xs text-muted-foreground">Tên mặt hàng</Label>
                                    <Input id={`name-${item.id}`} value={item.name} onChange={e => handleFieldChange('name', e.target.value)} className="rounded-lg"/>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor={`shortName-${item.id}`} className="text-xs text-muted-foreground">Tên viết tắt</Label>
                                    <Input id={`shortName-${item.id}`} value={item.shortName} onChange={e => handleFieldChange('shortName', e.target.value)} className="rounded-lg"/>
                                </div>
                                 <div className="space-y-1">
                                    <Label htmlFor={`category-${item.id}`} className="text-xs text-muted-foreground">Nhóm</Label>
                                    <Input id={`category-${item.id}`} value={item.category} onChange={e => handleFieldChange('category', e.target.value.toUpperCase())} className="rounded-lg"/>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor={`supplier-${item.id}`} className="text-xs text-muted-foreground">Nhà cung cấp</Label>
                                    <SupplierCombobox suppliers={suppliers} value={item.supplier} onChange={(val) => handleFieldChange('supplier', val)} />
                                </div>
                            </div>
                        </div>

                        <Separator/>

                        <div className="space-y-4">
                             <h4 className="text-sm font-semibold flex items-center gap-2 text-primary"><SlidersHorizontal className="h-4 w-4"/>Đơn vị & Quy đổi</h4>
                            <UnitEditor units={item.units} onUnitsChange={(newUnits) => handleFieldChange('units', newUnits)} />
                        </div>
                        
                         <Separator/>

                         <div className="space-y-4">
                             <h4 className="text-sm font-semibold flex items-center gap-2 text-primary"><Settings className="h-4 w-4"/>Quản lý tồn kho</h4>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor={`minStock-${item.id}`} className="text-xs text-muted-foreground">Tồn kho tối thiểu ({item.baseUnit})</Label>
                                    <Input id={`minStock-${item.id}`} type="number" value={item.minStock} onChange={e => handleFieldChange('minStock', Number(e.target.value) || 0)} className="rounded-lg"/>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Gợi ý đặt hàng</Label>
                                    <div className="flex gap-2">
                                        <Input 
                                            type="number" 
                                            value={orderSuggestionQty}
                                            onChange={e => setOrderSuggestionQty(e.target.value)}
                                            className="rounded-lg w-2/3"
                                            placeholder="Số lượng"
                                        />
                                        <Select value={orderSuggestionUnit} onValueChange={setOrderSuggestionUnit}>
                                            <SelectTrigger className="w-1/3 rounded-lg">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {item.units.map(u => (
                                                    <SelectItem key={u.name} value={u.name}>{u.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor={`dataType-${item.id}`} className="text-xs text-muted-foreground">Kiểu dữ liệu tồn kho</Label>
                                <Select value={item.dataType} onValueChange={(v) => handleFieldChange('dataType', v as 'number' | 'list')}>
                                    <SelectTrigger className="rounded-lg"><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="number">Số lượng (Number)</SelectItem>
                                        <SelectItem value="list">Danh sách (List)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {item.dataType === 'list' && (
                                <div className="space-y-1">
                                    <Label htmlFor={`listOptions-${item.id}`} className="text-xs text-muted-foreground">Các lựa chọn (phân cách bởi dấu phẩy)</Label>
                                    <Input id={`listOptions-${item.id}`} value={(item.listOptions || []).join(', ')} onChange={e => handleFieldChange('listOptions', e.target.value.split(',').map(s => s.trim()))} className="rounded-lg"/>
                                </div>
                            )}
                        </div>
                        
                        <Separator/>
                        
                        <div className="space-y-4">
                            <h4 className="text-sm font-semibold flex items-center gap-2 text-primary"><ToggleRight className="h-4 w-4"/>Tùy chọn</h4>
                             <div className="space-y-4">
                                <Label htmlFor={`isImportant-${item.id}`} className="flex items-center justify-between rounded-lg border p-3 shadow-sm cursor-pointer">
                                    <div>
                                        <span className="font-medium">Bắt buộc kiểm kê</span>
                                        <p className="text-[0.8rem] text-muted-foreground">Nhân viên phải nhập số liệu cho mục này khi báo cáo.</p>
                                    </div>
                                    <Switch id={`isImportant-${item.id}`} checked={item.isImportant} onCheckedChange={c => handleFieldChange('isImportant', c)} />
                                </Label>
                                <Label htmlFor={`requiresPhoto-${item.id}`} className="flex items-center justify-between rounded-lg border p-3 shadow-sm cursor-pointer">
                                     <div>
                                        <span className="font-medium">Yêu cầu ảnh bằng chứng</span>
                                        <p className="text-[0.8rem] text-muted-foreground">Nhân viên phải chụp ảnh khi kiểm kê mục này.</p>
                                     </div>
                                    <Switch id={`requiresPhoto-${item.id}`} checked={item.requiresPhoto} onCheckedChange={c => handleFieldChange('requiresPhoto', c)} />
                                </Label>
                            </div>
                        </div>

                    </div>
                 </ScrollArea>
                <DialogFooter>
                    <Button variant="outline" onClick={() => handleCloseDialog(false)}>Hủy</Button>
                    <Button onClick={handleSave}>Lưu thay đổi</Button>
                </DialogFooter>

                <AlertDialog open={isConfirmCloseOpen} onOpenChange={setIsConfirmCloseOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Hủy bỏ các thay đổi?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Bạn có một số thay đổi chưa được lưu. Bạn có chắc muốn đóng hộp thoại và hủy bỏ các thay đổi này không?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Ở lại</AlertDialogCancel>
                            <AlertDialogAction onClick={handleConfirmClose}>Hủy bỏ thay đổi</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

            </DialogContent>
        </Dialog>
    );
}
