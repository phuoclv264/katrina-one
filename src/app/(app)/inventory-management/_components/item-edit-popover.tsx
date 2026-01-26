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
    DialogBody,
    DialogAction,
    DialogCancel,
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Combobox } from '@/components/combobox';
import { toast } from '@/components/ui/pro-toast';
import { cn } from '@/lib/utils';
import isEqual from 'lodash.isequal';
import type { InventoryItem, UnitDefinition, GlobalUnit } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { Box, Settings, SlidersHorizontal, ToggleRight, Trash2, Plus, Star, ChevronsRight } from 'lucide-react';


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
        <div className="pt-6 mt-6 border-t border-dashed border-primary/20">
            <div className="bg-primary/[0.03] rounded-[1.5rem] p-5 border border-primary/10">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    <p className="text-xs font-bold uppercase tracking-widest text-primary/80">Thêm quy đổi mới</p>
                </div>
                
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-[1fr_2fr] gap-3">
                        <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-muted-foreground ml-1">Số lượng</Label>
                            <Input type="number" placeholder="SL" value={newUnitQty} onChange={e => setNewUnitQty(Number(e.target.value))} className="h-11 rounded-xl bg-background border-primary/10" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-muted-foreground ml-1">Đơn vị mới</Label>
                            <Combobox
                                options={unitOptions}
                                value={newUnitName}
                                onChange={setNewUnitName}
                                onCreate={canManageUnits ? handleCreateUnit : undefined}
                                onDelete={canManageUnits ? handleDeleteUnitGlobal : undefined}
                                confirmDelete
                                deleteMessage="Bạn có chắc chắn muốn xóa đơn vị này không?"
                                placeholder="Chọn ĐV..."
                                searchPlaceholder="Tìm đơn vị..."
                                emptyText="N/A"
                                className="h-11 rounded-xl bg-background border-primary/10"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-4 py-1">
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                        <span className="text-xl font-black text-primary/40">=</span>
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                    </div>

                    <div className="grid grid-cols-[1fr_2fr] gap-3 items-end">
                        <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-muted-foreground ml-1 text-nowrap">Bằng bao nhiêu</Label>
                            <Input type="number" placeholder="SL" value={baseUnitQty} onChange={e => setBaseUnitQty(Number(e.target.value))} className="h-11 rounded-xl bg-background border-primary/10" />
                        </div>
                        <div className="space-y-1 overflow-hidden">
                            <Label className="text-[10px] font-bold text-muted-foreground ml-1">Đơn vị gốc</Label>
                            <div className="h-11 px-4 rounded-xl bg-muted/30 border border-primary/5 flex items-center font-bold text-sm text-muted-foreground" title={baseUnitName}>
                                {baseUnitName}
                            </div>
                        </div>
                    </div>

                    <Button 
                        onClick={handleAdd} 
                        className="w-full h-11 mt-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md shadow-primary/20 transition-all active:scale-[0.98]"
                    >
                        <Plus className="h-4 w-4 mr-2" /> 
                        Thêm quy đổi
                    </Button>
                </div>
            </div>
        </div>
    );
}

function UnitEditor({ units, onUnitsChange, globalUnits, onGlobalUnitsChange, canManageUnits }: { units: UnitDefinition[], onUnitsChange: (newUnits: UnitDefinition[]) => void, globalUnits: GlobalUnit[], onGlobalUnitsChange: (newUnits: GlobalUnit[]) => void, canManageUnits: boolean }) {

    const unitOptions = React.useMemo(() => globalUnits.map(u => ({ value: u.name, label: u.name })), [globalUnits]);

    const handleCreateUnitGlobal = (name: string) => {
        const newUnit: GlobalUnit = { id: `unit-${Date.now()}`, name: name };
        const newUnits = [...globalUnits, newUnit].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
        onGlobalUnitsChange(newUnits);
    }

    const handleDeleteUnitGlobal = (name: string) => {
        if (!canManageUnits) return;
        const newUnits = globalUnits.filter(u => u.name !== name);
        onGlobalUnitsChange(newUnits);
    }

    const handleAddUnit = (newUnit: UnitDefinition) => {
        if (units.some(u => u.name.toLowerCase() === newUnit.name.toLowerCase())) {
            toast.error(`Đơn vị "${newUnit.name}" đã tồn tại.`);
            return;
        }
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
                    conversionRate: u.conversionRate / newBaseConversionRate,
                    isBaseUnit: u.name === newBaseUnitName,
                }));
            } else {
                newUnits = newUnits.map(u => ({
                    ...u,
                    isBaseUnit: u.name === newBaseUnitName,
                }));
                const newBase = newUnits.find(u => u.isBaseUnit);
                if (newBase) newBase.conversionRate = 1;
            }
        } else {
            (unitToUpdate as any)[field] = value;
            newUnits[index] = unitToUpdate;
        }

        onUnitsChange(newUnits);
    }

    const handleDeleteUnit = (index: number) => {
        if (units.length <= 1) {
            toast.error("Phải có ít nhất một đơn vị.");
            return;
        }
        const unitToDelete = units[index];
        if (unitToDelete.isBaseUnit) {
            toast.error("Không thể xóa đơn vị cơ sở. Vui lòng đặt một đơn vị khác làm cơ sở trước.");
            return;
        }
        const newUnits = units.filter((_, i) => i !== index);
        onUnitsChange(newUnits);
    }

    const baseUnitName = units.find(u => u.isBaseUnit)?.name || 'N/A';

    return (
        <div className="space-y-4">
            <div className="space-y-3">
                {units.map((unit, index) => {
                    const isBase = unit.isBaseUnit;
                    let conversionDescription = `1 ${unit.name} = ${Number(unit.conversionRate.toFixed(4))} ${baseUnitName}`;

                    if (!isBase && unit.conversionRate !== 0) {
                        const inverseRate = 1 / unit.conversionRate;
                        if (unit.conversionRate > 1) {
                            conversionDescription = `1 ${unit.name} = ${unit.conversionRate.toFixed(4).replace(/\.0000$/, '').replace(/(\.\d*?[1-9])0+$/, '$1')} ${baseUnitName}`;
                        } else {
                            conversionDescription = `1 ${baseUnitName} = ${inverseRate.toFixed(4).replace(/\.0000$/, '').replace(/(\.\d*?[1-9])0+$/, '$1')} ${unit.name}`;
                        }
                    }

                    return (
                        <div key={index} className={cn(
                            "flex flex-col sm:grid sm:grid-cols-12 gap-4 sm:gap-3 items-start sm:items-center p-4 rounded-2xl relative transition-all border shadow-sm",
                            isBase ? "bg-background border-primary/20 ring-1 ring-primary/10" : "bg-card border-border/50"
                        )}>
                            {isBase && (
                                <div className="absolute -top-2.5 left-4 px-2 py-0.5 bg-primary text-[10px] font-bold text-primary-foreground rounded-full flex items-center gap-1 shadow-sm">
                                    <Star className="h-2.5 w-2.5 fill-current" /> ĐƠN VỊ CƠ SỞ
                                </div>
                            )}

                            {units.length === 1 ? (
                                <>
                                    <div className="w-full sm:col-span-8 space-y-1.5">
                                        <Label htmlFor={`unit-name-${index}`} className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 ml-1">Tên đơn vị hiện tại</Label>
                                        <Combobox
                                            options={unitOptions}
                                            value={unit.name}
                                            onChange={(val) => handleUpdateUnit(index, 'name', val)}
                                            onCreate={canManageUnits ? (val) => {
                                                handleCreateUnitGlobal(val);
                                                handleUpdateUnit(index, 'name', val);
                                            } : undefined}
                                            onDelete={canManageUnits ? handleDeleteUnitGlobal : undefined}
                                            confirmDelete
                                            deleteMessage="Bạn có chắc chắn muốn xóa đơn vị này không?"
                                            placeholder="Chọn đơn vị..."
                                            searchPlaceholder="Tìm đơn vị..."
                                            emptyText="Không tìm thấy đơn vị."
                                            className="w-full h-11 rounded-xl"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between w-full sm:w-auto sm:col-span-3 sm:flex-col sm:justify-center sm:pt-2">
                                        <Label htmlFor={`unit-isBase-${index}`} className="text-xs font-bold sm:mt-1 order-2 sm:order-2">Thiết lập cơ sở</Label>
                                        <Switch id={`unit-isBase-${index}`} checked={unit.isBaseUnit} onCheckedChange={c => handleUpdateUnit(index, 'isBaseUnit', c)} className="order-1 sm:order-1 data-[state=checked]:bg-primary" />
                                    </div>
                                    <div className="absolute top-4 right-4 sm:static sm:col-span-1 sm:flex sm:items-center sm:justify-end">
                                        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded-xl" onClick={() => handleDeleteUnit(index)}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="w-full sm:col-span-4 space-y-1">
                                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 ml-1">Đơn vị</Label>
                                        <div className="font-bold text-sm bg-muted/30 h-11 flex items-center px-4 rounded-xl border border-transparent">
                                            {unit.name}
                                        </div>
                                    </div>
                                    <div className="w-full sm:col-span-5 space-y-1.5 min-w-0">
                                        <Label htmlFor={`unit-rate-${index}`} className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 ml-1 block" title={isBase ? 'Giá trị mặc định' : conversionDescription}>
                                            {isBase ? 'Giá trị mặc định' : conversionDescription}
                                        </Label>
                                        <div className="relative">
                                            <Input 
                                                id={`unit-rate-${index}`} 
                                                type="number" 
                                                disabled={isBase}
                                                value={unit.conversionRate} 
                                                onChange={e => handleUpdateUnit(index, 'conversionRate', Number(e.target.value))} 
                                                className={cn("h-11 rounded-xl pr-10", isBase ? "bg-muted/50 border-dashed" : "bg-background")} 
                                            />
                                            {isBase && <Settings className="absolute right-3 top-3 h-4 w-4 text-muted-foreground/30" />}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between w-full sm:col-span-2 sm:flex-col sm:justify-center sm:pt-3">
                                        <Label htmlFor={`unit-isBase-${index}`} className="text-[10px] font-bold sm:mt-1 order-2 sm:order-2 uppercase tracking-tight">Cơ sở</Label>
                                        <Switch id={`unit-isBase-${index}`} disabled={isBase} checked={unit.isBaseUnit} onCheckedChange={c => handleUpdateUnit(index, 'isBaseUnit', c)} className="order-1 sm:order-1 data-[state=checked]:bg-primary" />
                                    </div>
                                    <div className="absolute top-4 right-4 sm:static sm:col-span-1 sm:flex sm:items-center sm:justify-end sm:pt-4">
                                        {!isBase && (
                                            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded-xl" onClick={() => handleDeleteUnit(index)}><Trash2 className="h-4 w-4" /></Button>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )
                })}
            </div>

            <AddUnitSimple
                baseUnitName={baseUnitName}
                onAdd={handleAddUnit}
                globalUnits={globalUnits}
                onGlobalUnitsChange={onGlobalUnitsChange}
                canManageUnits={canManageUnits}
            />
        </div>
    )
}


export default function ItemEditPopover({
    item: initialItem,
    suppliers,
    globalUnits,
    canManageUnits,
    onUpdate,
    onSupplierChange,
    onGlobalUnitsChange,
    children
    , parentDialogTag
}: {
    item: InventoryItem;
    suppliers: string[];
    globalUnits: GlobalUnit[];
    canManageUnits: boolean;
    onUpdate: (updatedItem: InventoryItem) => void;
    onSupplierChange: (newSupplier: string) => void;
    onGlobalUnitsChange: (newUnits: GlobalUnit[]) => void;
    children: React.ReactNode;
    parentDialogTag: string;
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
    useEffect(() => {
        const qty = String(orderSuggestionQty).trim();
        const unit = orderSuggestionUnit.trim();
        const combined = `${qty}${unit ? ` ${unit}` : ''}`;
        if (item.orderSuggestion !== combined) {
            setItem(prev => ({ ...prev, orderSuggestion: combined }));
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
            toast.info('Không có thay đổi nào để lưu.');
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
        <Dialog open={isOpen} onOpenChange={handleCloseDialog} dialogTag={`item-edit-dialog-${initialItem.id}`} parentDialogTag={parentDialogTag}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-w-3xl h-[92vh] sm:h-[85vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
                <DialogHeader variant="premium" iconkey="edit">
                    <DialogTitle>Chỉnh sửa mặt hàng</DialogTitle>
                    <DialogDescription className="opacity-90">
                        {initialItem.category} • <span className="font-semibold text-foreground underline decoration-primary/30 underline-offset-4">{initialItem.name}</span>
                    </DialogDescription>
                </DialogHeader>
                
                <DialogBody className="p-0 flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                        <div className="p-6 sm:p-8 space-y-10 pb-20">

                            {/* Section: Basic Info */}
                            <section className="space-y-6">
                                <div className="flex items-center gap-3 border-b pb-3 border-primary/10">
                                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                        <Box className="h-5 w-5" />
                                    </div>
                                    <h4 className="text-base font-bold tracking-tight">Thông tin cơ bản</h4>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                                    <div className="space-y-2">
                                        <Label htmlFor={`name-${item.id}`} className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 ml-1">Tên mặt hàng</Label>
                                        <Input id={`name-${item.id}`} value={item.name} onChange={e => handleFieldChange('name', e.target.value)} className="h-12 rounded-2xl border-primary/10 bg-primary/[0.02] focus:bg-background transition-colors px-4" placeholder="Nhập tên mặt hàng..." />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={`shortName-${item.id}`} className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 ml-1">Tên viết tắt</Label>
                                        <Input id={`shortName-${item.id}`} value={item.shortName} onChange={e => handleFieldChange('shortName', e.target.value)} className="h-12 rounded-2xl border-primary/10 bg-primary/[0.02] focus:bg-background transition-colors px-4" placeholder="Ví dụ: CF, L..." />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={`category-${item.id}`} className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 ml-1">Nhóm danh mục</Label>
                                        <Input id={`category-${item.id}`} value={item.category} onChange={e => handleFieldChange('category', e.target.value.toUpperCase())} className="h-12 rounded-2xl border-primary/10 bg-primary/[0.02] focus:bg-background transition-colors px-4 font-mono text-sm" placeholder="Ví dụ: NGUYEN LIEU..." />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={`supplier-${item.id}`} className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 ml-1">Nhà cung cấp</Label>
                                        <Combobox
                                            options={suppliers.map(s => ({ value: s, label: s }))}
                                            value={item.supplier}
                                            onChange={(val) => handleFieldChange('supplier', val as string)}
                                            placeholder="Chọn nhà cung cấp..."
                                            searchPlaceholder="Tìm hoặc thêm mới..."
                                            emptyText="Không tìm thấy NCC."
                                            onCreate={(val) => handleFieldChange('supplier', val)}
                                            className="h-12 rounded-2xl border-primary/10 bg-primary/[0.02]"
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Section: Units */}
                            <section className="space-y-6">
                                <div className="flex items-center gap-3 border-b pb-3 border-primary/10">
                                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                        <SlidersHorizontal className="h-5 w-5" />
                                    </div>
                                    <h4 className="text-base font-bold tracking-tight">Đơn vị & Quy đổi</h4>
                                </div>
                                <div className="bg-primary/5 rounded-[2rem] p-4 sm:p-6 border border-primary/5">
                                    <UnitEditor units={item.units} onUnitsChange={(newUnits) => handleFieldChange('units', newUnits)} globalUnits={globalUnits} onGlobalUnitsChange={onGlobalUnitsChange} canManageUnits={canManageUnits} />
                                </div>
                            </section>

                            {/* Section: Inventory Settings */}
                            <section className="space-y-6">
                                <div className="flex items-center gap-3 border-b pb-3 border-primary/10">
                                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                        <Settings className="h-5 w-5" />
                                    </div>
                                    <h4 className="text-base font-bold tracking-tight">Quản lý tồn kho</h4>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                                    <div className="space-y-2">
                                        <Label htmlFor={`minStock-${item.id}`} className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 ml-1">
                                            Hạn mức tối thiểu ({item.baseUnit})
                                        </Label>
                                        <Input id={`minStock-${item.id}`} type="number" value={item.minStock} onChange={e => handleFieldChange('minStock', Number(e.target.value) || 0)} className="h-12 rounded-2xl border-primary/10 bg-primary/[0.02]" />
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 ml-1">Gợi ý đặt hàng</Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="number"
                                                value={orderSuggestionQty}
                                                onChange={e => setOrderSuggestionQty(e.target.value)}
                                                className="h-12 rounded-2xl border-primary/10 bg-primary/[0.02] w-24"
                                                placeholder="SL"
                                            />
                                            <Combobox
                                                value={orderSuggestionUnit}
                                                onChange={setOrderSuggestionUnit}
                                                options={item.units.filter(u => u.name).map(u => ({ value: u.name, label: u.name }))}
                                                className="flex-1 h-12 rounded-2xl border-primary/10 bg-primary/[0.02]"
                                                compact
                                                searchable={false}
                                                placeholder="Đơn vị"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2 md:col-span-2">
                                        <Label htmlFor={`dataType-${item.id}`} className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 ml-1">Phương thức nhập liệu</Label>
                                        <div className="grid grid-cols-2 gap-3 p-1 bg-primary/5 rounded-2xl border border-primary/5">
                                            <button 
                                                onClick={() => handleFieldChange('dataType', 'number')}
                                                className={cn(
                                                    "flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all",
                                                    item.dataType === 'number' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:bg-background/50"
                                                )}
                                            >
                                                Số lượng (123)
                                            </button>
                                            <button 
                                                onClick={() => handleFieldChange('dataType', 'list')}
                                                className={cn(
                                                    "flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all",
                                                    item.dataType === 'list' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:bg-background/50"
                                                )}
                                            >
                                                Danh sách (A, B, C)
                                            </button>
                                        </div>
                                    </div>

                                    {item.dataType === 'list' && (
                                        <div className="space-y-2 md:col-span-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <Label htmlFor={`listOptions-${item.id}`} className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 ml-1">Các tùy chọn danh sách</Label>
                                            <Input 
                                                id={`listOptions-${item.id}`} 
                                                value={(item.listOptions || []).join(', ')} 
                                                onChange={e => handleFieldChange('listOptions', e.target.value.split(',').map(s => s.trim()))} 
                                                className="h-12 rounded-2xl border-primary/10 bg-primary/[0.02]" 
                                                placeholder="Ví dụ: Đầy, Còn một nửa, Sắp hết..."
                                            />
                                            <p className="text-[10px] text-muted-foreground ml-2">Phân cách các lựa chọn bằng dấu phẩy (,)</p>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* Section: Quality Control */}
                            <section className="space-y-6">
                                <div className="flex items-center gap-3 border-b pb-3 border-primary/10">
                                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                        <ToggleRight className="h-5 w-5" />
                                    </div>
                                    <h4 className="text-base font-bold tracking-tight">Quy trình kiểm soát</h4>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div 
                                        onClick={() => handleFieldChange('isImportant', !item.isImportant)}
                                        className={cn(
                                            "flex items-center justify-between rounded-[1.5rem] border-2 p-5 cursor-pointer transition-all duration-300",
                                            item.isImportant ? "border-primary/40 bg-primary/[0.03] ring-4 ring-primary/5" : "border-transparent bg-muted/30 grayscale opacity-80"
                                        )}
                                    >
                                        <div className="flex flex-col gap-1 pr-4">
                                            <span className="font-bold text-sm">Bắt buộc kiểm kê</span>
                                            <p className="text-[11px] leading-relaxed text-muted-foreground">Nhân viên không được bỏ qua mục này.</p>
                                        </div>
                                        <Switch 
                                            id={`isImportant-${item.id}`} 
                                            checked={item.isImportant} 
                                            onCheckedChange={c => handleFieldChange('isImportant', c)} 
                                            onClick={(e) => e.stopPropagation()}
                                            className="data-[state=checked]:bg-primary"
                                        />
                                    </div>

                                    <div 
                                        onClick={() => handleFieldChange('requiresPhoto', !item.requiresPhoto)}
                                        className={cn(
                                            "flex items-center justify-between rounded-[1.5rem] border-2 p-5 cursor-pointer transition-all duration-300",
                                            item.requiresPhoto ? "border-primary/40 bg-primary/[0.03] ring-4 ring-primary/5" : "border-transparent bg-muted/30 grayscale opacity-80"
                                        )}
                                    >
                                        <div className="flex flex-col gap-1 pr-4 text-left">
                                            <span className="font-bold text-sm">Yêu cầu ảnh bằng chứng</span>
                                            <p className="text-[11px] leading-relaxed text-muted-foreground">Phải chụp ảnh để xác minh số liệu.</p>
                                        </div>
                                        <Switch 
                                            id={`requiresPhoto-${item.id}`} 
                                            checked={item.requiresPhoto} 
                                            onCheckedChange={c => handleFieldChange('requiresPhoto', c)} 
                                            onClick={(e) => e.stopPropagation()}
                                            className="data-[state=checked]:bg-primary"
                                        />
                                    </div>
                                </div>
                            </section>

                        </div>
                    </ScrollArea>
                </DialogBody>

                <DialogFooter variant="muted" className="p-6 shrink-0 gap-3 border-t">
                    <DialogCancel onClick={() => handleCloseDialog(false)} className="flex-1 sm:flex-none">Hủy bỏ</DialogCancel>
                    <DialogAction onClick={handleSave} className="flex-1 sm:min-w-[160px] shadow-lg shadow-primary/20">Cập nhật mặt hàng</DialogAction>
                </DialogFooter>

                <AlertDialog open={isConfirmCloseOpen} onOpenChange={setIsConfirmCloseOpen} parentDialogTag='root'>
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
