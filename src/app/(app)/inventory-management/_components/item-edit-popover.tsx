
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
import { Separator } from '@/components/ui/separator';
import { Box, Settings, SlidersHorizontal, ToggleRight } from 'lucide-react';


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

    useEffect(() => {
        if (isOpen) {
            setItem(initialItem);
            setHasUnsavedChanges(false);
        }
    }, [isOpen, initialItem]);
    
    useEffect(() => {
      setHasUnsavedChanges(!isEqual(item, initialItem));
    }, [item, initialItem]);

    const handleFieldChange = (field: keyof InventoryItem, value: string | number | boolean | string[]) => {
        setItem(prev => ({ ...prev, [field]: value }));
    };

    const handleTimeChange = (field: 'start' | 'end', value: string) => {
        // This function seems to be a leftover from another component, but we'll keep it in case it's used elsewhere implicitly.
        // Or we can remove it if it's confirmed to be unused. For now, let's assume it might be needed by a prop.
    };

    const handleSave = () => {
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
        if (confirm("Bạn có thay đổi chưa được lưu. Bạn có chắc muốn đóng?")) {
          setIsOpen(false);
        }
      } else {
        setIsOpen(open);
      }
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
                        
                        {/* Basic Info */}
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

                        {/* Units & Conversion */}
                        <div className="space-y-4">
                             <h4 className="text-sm font-semibold flex items-center gap-2 text-primary"><SlidersHorizontal className="h-4 w-4"/>Đơn vị & Quy đổi</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               <div className="space-y-1">
                                    <Label htmlFor={`unit-${item.id}`} className="text-xs text-muted-foreground">Đơn vị tính (tồn kho)</Label>
                                    <Input id={`unit-${item.id}`} value={item.unit} onChange={e => handleFieldChange('unit', e.target.value)} className="rounded-lg"/>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor={`orderUnit-${item.id}`} className="text-xs text-muted-foreground">Đơn vị đặt hàng</Label>
                                    <Input id={`orderUnit-${item.id}`} value={item.orderUnit} onChange={e => handleFieldChange('orderUnit', e.target.value)} className="rounded-lg"/>
                                </div>
                            </div>
                             {item.orderUnit !== item.unit && (
                                <div className="space-y-1">
                                    <Label htmlFor={`conversionRate-${item.id}`} className="text-xs text-muted-foreground">Tỷ lệ quy đổi (1 {item.orderUnit || 'ĐV Đặt'} = ? {item.unit || 'ĐV Tính'})</Label>
                                    <Input id={`conversionRate-${item.id}`} type="number" value={item.conversionRate} onChange={e => handleFieldChange('conversionRate', Number(e.target.value) || 1)} className="rounded-lg"/>
                                </div>
                            )}
                        </div>
                        
                         <Separator/>

                        {/* Stock Management */}
                         <div className="space-y-4">
                             <h4 className="text-sm font-semibold flex items-center gap-2 text-primary"><Settings className="h-4 w-4"/>Quản lý tồn kho</h4>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor={`minStock-${item.id}`} className="text-xs text-muted-foreground">Tồn kho tối thiểu</Label>
                                    <Input id={`minStock-${item.id}`} type="number" value={item.minStock} onChange={e => handleFieldChange('minStock', Number(e.target.value) || 0)} className="rounded-lg"/>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor={`orderSuggestion-${item.id}`} className="text-xs text-muted-foreground">Gợi ý đặt hàng</Label>
                                    <Input id={`orderSuggestion-${item.id}`} value={item.orderSuggestion} onChange={e => handleFieldChange('orderSuggestion', e.target.value)} className="rounded-lg"/>
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
                        
                        {/* Flags */}
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
            </DialogContent>
        </Dialog>
    );
}
