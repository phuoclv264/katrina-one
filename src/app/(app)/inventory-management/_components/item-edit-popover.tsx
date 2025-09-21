'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SupplierCombobox } from '@/components/supplier-combobox';
import { toast } from 'react-hot-toast';
import isEqual from 'lodash.isequal';
import type { InventoryItem } from '@/lib/types';
import { useIsMobile } from '@/hooks/use-mobile';


export default function ItemEditPopover({
    item: initialItem,
    suppliers,
    onUpdate,
    onSupplierChange,
    children
}: {
    item: InventoryItem;
    suppliers: string[];
    onUpdate: (id: string, field: keyof InventoryItem, value: any) => void;
    onSupplierChange: (id: string, newSupplier: string) => void;
    children: React.ReactNode;
}) {
    const isMobile = useIsMobile();
    const [isOpen, setIsOpen] = useState(false);
    const [item, setItem] = useState(initialItem);

    useEffect(() => {
        if (isOpen) {
            setItem(initialItem);
        }
    }, [isOpen, initialItem]);

    const handleFieldChange = (field: keyof InventoryItem, value: string | number | boolean | string[]) => {
        setItem(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = () => {
        // Find fields that have changed
        (Object.keys(item) as Array<keyof InventoryItem>).forEach(key => {
            if (!isEqual(item[key], initialItem[key])) {
                if (key === 'supplier') {
                    onSupplierChange(item.id, item.supplier);
                } else {
                    onUpdate(item.id, key, item[key]);
                }
            }
        });
        toast.success(`Đã cập nhật mặt hàng "${item.name}".`);
        setIsOpen(false);
    };

    const content = (
         <ScrollArea className={isMobile ? "h-[70vh]" : "max-h-[60vh]"}>
            <div className="grid gap-4 p-1">
                <div className="space-y-2">
                    <Label htmlFor={`name-${item.id}`}>Tên mặt hàng</Label>
                    <Input id={`name-${item.id}`} value={item.name} onChange={e => handleFieldChange('name', e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`shortName-${item.id}`}>Tên viết tắt</Label>
                    <Input id={`shortName-${item.id}`} value={item.shortName} onChange={e => handleFieldChange('shortName', e.target.value)} />
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor={`category-${item.id}`}>Nhóm</Label>
                        <Input id={`category-${item.id}`} value={item.category} onChange={e => handleFieldChange('category', e.target.value.toUpperCase())} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`supplier-${item.id}`}>Nhà cung cấp</Label>
                        <SupplierCombobox suppliers={suppliers} value={item.supplier} onChange={(val) => handleFieldChange('supplier', val)} />
                    </div>
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor={`unit-${item.id}`}>Đơn vị tính</Label>
                        <Input id={`unit-${item.id}`} value={item.unit} onChange={e => handleFieldChange('unit', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`orderUnit-${item.id}`}>Đơn vị đặt</Label>
                        <Input id={`orderUnit-${item.id}`} value={item.orderUnit} onChange={e => handleFieldChange('orderUnit', e.target.value)} />
                    </div>
                </div>
                {item.orderUnit !== item.unit && (
                    <div className="space-y-2">
                        <Label htmlFor={`conversionRate-${item.id}`}>Tỷ lệ quy đổi (1 {item.orderUnit} = ? {item.unit})</Label>
                        <Input id={`conversionRate-${item.id}`} type="number" value={item.conversionRate} onChange={e => handleFieldChange('conversionRate', Number(e.target.value) || 1)} />
                    </div>
                )}
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor={`minStock-${item.id}`}>Tồn kho tối thiểu</Label>
                        <Input id={`minStock-${item.id}`} type="number" value={item.minStock} onChange={e => handleFieldChange('minStock', Number(e.target.value) || 0)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`orderSuggestion-${item.id}`}>Gợi ý đặt hàng</Label>
                        <Input id={`orderSuggestion-${item.id}`} value={item.orderSuggestion} onChange={e => handleFieldChange('orderSuggestion', e.target.value)} />
                    </div>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor={`dataType-${item.id}`}>Kiểu dữ liệu tồn kho</Label>
                    <Select value={item.dataType} onValueChange={(v) => handleFieldChange('dataType', v as 'number' | 'list')}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="number">Số lượng (Number)</SelectItem>
                            <SelectItem value="list">Danh sách (List)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                {item.dataType === 'list' && (
                     <div className="space-y-2">
                        <Label htmlFor={`listOptions-${item.id}`}>Các lựa chọn (phân cách bởi dấu phẩy)</Label>
                        <Input id={`listOptions-${item.id}`} value={(item.listOptions || []).join(', ')} onChange={e => handleFieldChange('listOptions', e.target.value.split(',').map(s => s.trim()))} />
                    </div>
                )}
                <div className="flex justify-between items-center mt-4">
                    <div className="flex items-center space-x-2">
                         <Switch id={`isImportant-${item.id}`} checked={item.isImportant} onCheckedChange={c => handleFieldChange('isImportant', c)} />
                        <Label htmlFor={`isImportant-${item.id}`}>Bắt buộc kiểm kê</Label>
                    </div>
                     <div className="flex items-center space-x-2">
                         <Switch id={`requiresPhoto-${item.id}`} checked={item.requiresPhoto} onCheckedChange={c => handleFieldChange('requiresPhoto', c)} />
                        <Label htmlFor={`requiresPhoto-${item.id}`}>Yêu cầu ảnh</Label>
                    </div>
                </div>
            </div>
         </ScrollArea>
    );

    if (isMobile) {
        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>{children}</DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Chỉnh sửa: {initialItem.name}</DialogTitle>
                    </DialogHeader>
                    {content}
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Hủy</Button></DialogClose>
                        <Button onClick={handleSave}>Lưu thay đổi</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }
    
    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent className="w-96 p-4" align="end">
                 {content}
                 <div className="flex justify-end gap-2 mt-4">
                    <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>Hủy</Button>
                    <Button size="sm" onClick={handleSave}>Lưu</Button>
                 </div>
            </PopoverContent>
        </Popover>
    );
}