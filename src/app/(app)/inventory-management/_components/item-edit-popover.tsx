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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Combobox } from '@/components/combobox';
import { toast } from '@/components/ui/pro-toast';
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
        <div className="space-y-2 pt-4 mt-4 border-t border-dashed">
            <p className="text-sm font-medium">Thêm quy đổi đơn vị mới</p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex items-center gap-2 flex-1">
                    <Input type="number" placeholder="SL" value={newUnitQty} onChange={e => setNewUnitQty(Number(e.target.value))} className="h-9 w-16 sm:w-20" />
                    <Combobox
                        options={unitOptions}
                        value={newUnitName}
                        onChange={setNewUnitName}
                        onCreate={canManageUnits ? handleCreateUnit : undefined}
                        onDelete={canManageUnits ? handleDeleteUnitGlobal : undefined}
                        confirmDelete
                        deleteMessage="Bạn có chắc chắn muốn xóa đơn vị này không?"
                        placeholder="Tên ĐV"
                        searchPlaceholder="Tìm đơn vị..."
                        emptyText="Không tìm thấy."
                        className="flex-1 min-w-0"
                    />
                </div>
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                    <span className="font-bold text-muted-foreground">=</span>
                    <Input type="number" placeholder="SL" value={baseUnitQty} onChange={e => setBaseUnitQty(Number(e.target.value))} className="h-9 w-16 sm:w-20" />
                    <span className="font-semibold text-sm truncate max-w-[100px]" title={baseUnitName}>{baseUnitName}</span>
                </div>
            </div>
            <Button size="sm" onClick={handleAdd} className="w-full h-9 mt-2 sm:mt-0">Thêm đơn vị</Button>
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
        <div className="space-y-3">
            {units.map((unit, index) => {
                const isBase = unit.isBaseUnit;
                let conversionDescription = `1 ${unit.name} = ${Number(unit.conversionRate.toFixed(4))} ${baseUnitName}`;

                if (!isBase && unit.conversionRate !== 0) {
                    const inverseRate = 1 / unit.conversionRate;
                    if (unit.conversionRate > 1) { // e.g., 1 thùng = 24 lon (base: lon, rate: 24)
                        conversionDescription = `1 ${unit.name} = ${unit.conversionRate.toFixed(4).replace(/\.0000$/, '').replace(/(\.\d*?[1-9])0+$/, '$1')} ${baseUnitName}`;
                    } else { // e.g., 1 ml = 0.0013 lit (base: lit, rate: 0.0013)
                        conversionDescription = `1 ${baseUnitName} = ${inverseRate.toFixed(4).replace(/\.0000$/, '').replace(/(\.\d*?[1-9])0+$/, '$1')} ${unit.name}`;
                    }
                }


                return (
                    <div key={index} className="flex flex-col sm:grid sm:grid-cols-12 gap-3 sm:gap-2 items-start sm:items-center p-3 sm:p-2 border rounded-md relative bg-card/50">
                        {units.length === 1 ? (
                            <>
                                <div className="w-full sm:col-span-8">
                                    <Label htmlFor={`unit-name-${index}`} className="text-xs text-muted-foreground mb-1.5 block">Tên đơn vị</Label>
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
                                        className="w-full"
                                    />
                                </div>
                                <div className="flex items-center justify-between w-full sm:w-auto sm:col-span-2 sm:flex-col sm:justify-center sm:pt-4">
                                    <Label htmlFor={`unit-isBase-${index}`} className="text-sm sm:text-xs sm:mt-1 order-2 sm:order-2">Cơ sở</Label>
                                    <Switch id={`unit-isBase-${index}`} checked={unit.isBaseUnit} onCheckedChange={c => handleUpdateUnit(index, 'isBaseUnit', c)} className="order-1 sm:order-1" />
                                </div>
                                <div className="absolute top-2 right-2 sm:static sm:col-span-2 sm:flex sm:items-center sm:justify-center sm:pt-5">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/90 hover:bg-destructive/10" onClick={() => handleDeleteUnit(index)}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="w-full sm:col-span-4">
                                    <Label htmlFor={`unit-name-${index}`} className="text-xs text-muted-foreground mb-1 block">Tên đơn vị</Label>
                                    <p className="font-semibold text-sm h-9 flex items-center px-1">{unit.name}</p>
                                </div>
                                <div className="w-full sm:col-span-5">
                                    <Label htmlFor={`unit-rate-${index}`} className="text-xs text-muted-foreground mb-1.5 block truncate" title={isBase ? 'Đơn vị cơ sở' : conversionDescription}>
                                        {isBase ? 'Đơn vị cơ sở' : conversionDescription}
                                    </Label>
                                    {!isBase && (
                                        <Input id={`unit-rate-${index}`} type="number" value={unit.conversionRate} onChange={e => handleUpdateUnit(index, 'conversionRate', Number(e.target.value))} className="w-full" />
                                    )}
                                </div>
                                <div className="flex items-center justify-between w-full sm:w-auto sm:col-span-2 sm:flex-col sm:justify-center sm:pt-4">
                                    <Label htmlFor={`unit-isBase-${index}`} className="text-sm sm:text-xs sm:mt-1 order-2 sm:order-2">Cơ sở</Label>
                                    <Switch id={`unit-isBase-${index}`} checked={unit.isBaseUnit} onCheckedChange={c => handleUpdateUnit(index, 'isBaseUnit', c)} className="order-1 sm:order-1" />
                                </div>
                                <div className="absolute top-2 right-2 sm:static sm:col-span-1 sm:flex sm:items-center sm:justify-center sm:pt-5">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/90 hover:bg-destructive/10" onClick={() => handleDeleteUnit(index)}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            </>
                        )}
                    </div>
                )
            })}
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
            <DialogContent className="w-full h-full max-w-none sm:max-w-2xl sm:h-auto sm:rounded-lg p-0 gap-0 bg-card flex flex-col">
                <DialogHeader className="p-6 pb-2 flex-shrink-0">
                    <DialogTitle>Chỉnh sửa: {initialItem.name}</DialogTitle>
                    <DialogDescription>
                        Kho &gt; {initialItem.category} &gt; {initialItem.name}
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-1 px-6">
                    <div className="space-y-6 py-4 px-1">

                        <div className="space-y-4">
                            <h4 className="text-sm font-semibold flex items-center gap-2 text-primary"><Box className="h-4 w-4" />Thông tin cơ bản</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor={`name-${item.id}`} className="text-xs text-muted-foreground">Tên mặt hàng</Label>
                                    <Input id={`name-${item.id}`} value={item.name} onChange={e => handleFieldChange('name', e.target.value)} className="rounded-lg" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor={`shortName-${item.id}`} className="text-xs text-muted-foreground">Tên viết tắt</Label>
                                    <Input id={`shortName-${item.id}`} value={item.shortName} onChange={e => handleFieldChange('shortName', e.target.value)} className="rounded-lg" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor={`category-${item.id}`} className="text-xs text-muted-foreground">Nhóm</Label>
                                    <Input id={`category-${item.id}`} value={item.category} onChange={e => handleFieldChange('category', e.target.value.toUpperCase())} className="rounded-lg" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor={`supplier-${item.id}`} className="text-xs text-muted-foreground">Nhà cung cấp</Label>
                                    <Combobox
                                        options={suppliers.map(s => ({ value: s, label: s }))}
                                        value={item.supplier}
                                        onChange={(val) => handleFieldChange('supplier', val as string)}
                                        placeholder="Chọn NCC"
                                        searchPlaceholder="Tìm hoặc thêm mới..."
                                        emptyText="Không tìm thấy NCC."
                                        onCreate={(val) => handleFieldChange('supplier', val)}
                                    />
                                </div>
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <h4 className="text-sm font-semibold flex items-center gap-2 text-primary"><SlidersHorizontal className="h-4 w-4" />Đơn vị & Quy đổi</h4>
                            <UnitEditor units={item.units} onUnitsChange={(newUnits) => handleFieldChange('units', newUnits)} globalUnits={globalUnits} onGlobalUnitsChange={onGlobalUnitsChange} canManageUnits={canManageUnits} />
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <h4 className="text-sm font-semibold flex items-center gap-2 text-primary"><Settings className="h-4 w-4" />Quản lý tồn kho</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor={`minStock-${item.id}`} className="text-xs text-muted-foreground">Tồn kho tối thiểu ({item.baseUnit})</Label>
                                    <Input id={`minStock-${item.id}`} type="number" value={item.minStock} onChange={e => handleFieldChange('minStock', Number(e.target.value) || 0)} className="rounded-lg" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Gợi ý đặt hàng</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            value={orderSuggestionQty}
                                            onChange={e => setOrderSuggestionQty(e.target.value)}
                                            className="rounded-lg flex-1 sm:flex-0"
                                            placeholder="SL"
                                        />
                                        <Combobox
                                            value={orderSuggestionUnit}
                                            onChange={setOrderSuggestionUnit}
                                            options={item.units.filter(u => u.name).map(u => ({ value: u.name, label: u.name }))}
                                            className="flex-1 sm:flex-0 w-full"
                                            compact
                                            searchable={false}
                                            placeholder="Đơn vị"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor={`dataType-${item.id}`} className="text-xs text-muted-foreground">Kiểu dữ liệu tồn kho</Label>
                                <Combobox
                                    value={item.dataType}
                                    onChange={(v) => handleFieldChange('dataType', v as 'number' | 'list')}
                                    options={[
                                        { value: "number", label: "Số lượng (Number)" },
                                        { value: "list", label: "Danh sách (List)" },
                                    ]}
                                    compact
                                    searchable={false}
                                />
                            </div>
                            {item.dataType === 'list' && (
                                <div className="space-y-1">
                                    <Label htmlFor={`listOptions-${item.id}`} className="text-xs text-muted-foreground">Các lựa chọn (phân cách bởi dấu phẩy)</Label>
                                    <Input id={`listOptions-${item.id}`} value={(item.listOptions || []).join(', ')} onChange={e => handleFieldChange('listOptions', e.target.value.split(',').map(s => s.trim()))} className="rounded-lg" />
                                </div>
                            )}
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <h4 className="text-sm font-semibold flex items-center gap-2 text-primary"><ToggleRight className="h-4 w-4" />Tùy chọn</h4>
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
                <DialogFooter className="p-6 pt-2 flex-shrink-0 gap-2">
                    <Button variant="outline" onClick={() => handleCloseDialog(false)}>Hủy</Button>
                    <Button onClick={handleSave}>Lưu thay đổi</Button>
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
