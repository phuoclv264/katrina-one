'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { InventoryOrderSuggestion, OrderItem, InventoryItem } from '@/lib/types';
import { Combobox } from "@/components/combobox";

type SuggestionsDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    initialSuggestions: InventoryOrderSuggestion;
    inventoryList: InventoryItem[];
    onSubmit: (finalSuggestions: InventoryOrderSuggestion) => void;
    parentDialogTag: string;
};

type EditedOrderItem = {
    itemId: string;
    quantity: string;
    unit: string;
};

export function SuggestionsDialog({
    isOpen,
    onClose,
    initialSuggestions,
    inventoryList,
    onSubmit,
    parentDialogTag,
}: SuggestionsDialogProps) {
    const [editedOrders, setEditedOrders] = useState<Record<string, EditedOrderItem[]>>({});
    const [openSuppliers, setOpenSuppliers] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen) {
            // Reset state on open: all items are unchecked and inputs are empty
            setEditedOrders({});
            setOpenSuppliers(initialSuggestions.ordersBySupplier.map(s => s.supplier));
        }
    }, [isOpen, initialSuggestions]);

    const handleItemToggle = useCallback((supplier: string, item: InventoryItem, checked: boolean) => {
        setEditedOrders(prev => {
            const supplierOrders = prev[supplier] ? [...prev[supplier]] : [];
            if (checked) {
                if (!supplierOrders.some(order => order.itemId === item.id)) {
                    const suggestion = item.orderSuggestion || '';
                    let quantity = '';
                    let unit = item.baseUnit;

                    // Regex to separate number and unit from a string like "5kg" or "1.5 thùng"
                    const match = suggestion.trim().match(/^(\d*\.?\d+)\s*(\S+)?$/);

                    if (match) {
                        quantity = match[1];
                        const parsedUnit = match[2];
                        // Check if the parsed unit is valid for this item
                        if (parsedUnit && item.units.some(u => u.name.toLowerCase() === parsedUnit.toLowerCase())) {
                            unit = item.units.find(u => u.name.toLowerCase() === parsedUnit.toLowerCase())!.name;
                        }
                    } else {
                        // If no match (e.g., suggestion is just a number), find the largest unit.
                        const largestUnit = item.units.reduce((largest, current) =>
                            (current.conversionRate > largest.conversionRate) ? current : largest,
                            { name: item.baseUnit, conversionRate: 1 }
                        );
                        unit = largestUnit.name;
                    }
                    return { ...prev, [supplier]: [...supplierOrders, { itemId: item.id, quantity, unit }] };
                }
            } else {
                return { ...prev, [supplier]: supplierOrders.filter(i => i.itemId !== item.id) };
            }
            return prev;
        });
    }, []);

    const handleFieldChange = useCallback((supplier: string, itemId: string, field: 'quantity' | 'unit', value: string) => {
        setEditedOrders(prev => {
            const supplierOrders = prev[supplier] ? [...prev[supplier]] : [];
            const itemIndex = supplierOrders.findIndex(item => item.itemId === itemId);
            if (itemIndex > -1) {
                const updatedItem = { ...supplierOrders[itemIndex], [field]: value };
                supplierOrders[itemIndex] = updatedItem;
                return { ...prev, [supplier]: supplierOrders };
            }
            return prev;
        });
    }, []);

    const handleSubmit = () => {
        const finalOrdersBySupplier = Object.entries(editedOrders)
            .map(([supplier, items]) => {
                const validItems: OrderItem[] = items
                    .filter(item => {
                        const quantity = parseFloat(item.quantity);
                        return !isNaN(quantity) && quantity > 0;
                    })
                    .map(item => {
                        const fullItem = inventoryList.find(i => i.id === item.itemId);
                        const unitDef = fullItem?.units.find(u => u.name === item.unit);

                        // If the unit is not the base unit, convert the quantity for the suggestion text
                        if (unitDef && !unitDef.isBaseUnit && unitDef.conversionRate > 1) {
                            const quantityInBase = parseFloat(item.quantity) * unitDef.conversionRate;
                            const baseUnitName = fullItem?.baseUnit || '';
                            return {
                                itemId: item.itemId,
                                quantityToOrder: `${item.quantity} ${item.unit} (${quantityInBase.toLocaleString()}${baseUnitName})`
                            };
                        }

                        return {
                            itemId: item.itemId,
                            quantityToOrder: `${item.quantity} ${item.unit}`
                        };
                    });

                return {
                    supplier,
                    itemsToOrder: validItems,
                };
            })
            .filter(supplierOrder => supplierOrder.itemsToOrder.length > 0);

        const totalItems = finalOrdersBySupplier.reduce((acc, s) => acc + s.itemsToOrder.length, 0);
        const summary = totalItems > 0
            ? `Cần đặt ${totalItems} mặt hàng từ ${finalOrdersBySupplier.length} nhà cung cấp.`
            : 'Không có mặt hàng nào được chọn để đặt hàng.';

        onSubmit({ summary, ordersBySupplier: finalOrdersBySupplier });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} dialogTag="inventory-suggestions-dialog" parentDialogTag={parentDialogTag}>
            <DialogContent className="max-w-2xl h-full md:h-auto md:max-h-[90vh] flex flex-col">
                <DialogHeader className="shrink-0">
                    <DialogTitle>Xác nhận Đề xuất Đặt hàng</DialogTitle>
                    <DialogDescription>
                        Kiểm tra và chỉnh sửa danh sách các mặt hàng cần đặt. Chỉ những mục được chọn mới được đưa vào báo cáo.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-grow overflow-y-auto">
                    <ScrollArea className="h-full pr-6">
                        <Accordion type="multiple" value={openSuppliers} onValueChange={setOpenSuppliers} className="w-full space-y-2">
                            {initialSuggestions.ordersBySupplier.map(({ supplier, itemsToOrder }) => {
                                return (
                                    <AccordionItem value={supplier} key={supplier}>
                                        <AccordionTrigger className="text-base font-medium hover:no-underline p-3 bg-muted rounded-md">
                                            {supplier}
                                        </AccordionTrigger>
                                        <AccordionContent className="p-2 pt-3 space-y-3">
                                            {itemsToOrder.map(({ itemId }) => {
                                                const fullItem = inventoryList.find(i => i.id === itemId);
                                                if (!fullItem) return null;

                                                const editedItem = editedOrders[supplier]?.find(item => item.itemId === itemId);
                                                const isChecked = !!editedItem;
                                                const currentQuantity = editedItem?.quantity ?? '';
                                                const currentUnit = editedItem?.unit ?? fullItem.baseUnit;

                                                return (
                                                    <Label
                                                        key={itemId}
                                                        htmlFor={`item-${itemId}`}
                                                        className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer"
                                                    >
                                                        <Checkbox
                                                            id={`item-${itemId}`}
                                                            checked={isChecked}
                                                            onCheckedChange={(checked) => handleItemToggle(supplier, fullItem, !!checked)}
                                                        />
                                                        <span className="flex-1 text-sm font-bold">
                                                            {fullItem.name}
                                                            <span className="text-xs font-thin text-muted-foreground whitespace-nowrap"> (Gợi ý: {fullItem.orderSuggestion})</span>
                                                        </span>
                                                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                            <Input
                                                                type="number"
                                                                value={currentQuantity}
                                                                onChange={(e) => handleFieldChange(supplier, itemId, 'quantity', e.target.value)}
                                                                className="h-8 w-20 text-center"
                                                                disabled={!isChecked}
                                                                placeholder="SL"
                                                                onFocus={(e) => e.target.select()}
                                                            />
                                                            <Combobox
                                                                value={currentUnit}
                                                                onChange={(value) => handleFieldChange(supplier, itemId, 'unit', value)}
                                                                disabled={!isChecked}
                                                                options={fullItem.units.map(u => ({ value: u.name, label: u.name }))}
                                                                className="h-8 w-[80px]"
                                                                compact
                                                                searchable={false}
                                                            />
                                                        </div>
                                                    </Label>
                                                );
                                            })}
                                        </AccordionContent>
                                    </AccordionItem>
                                );
                            })}
                        </Accordion>
                    </ScrollArea>
                </div>
                <DialogFooter className="shrink-0">
                    <Button variant="outline" onClick={onClose}>Hủy</Button>
                    <Button onClick={handleSubmit}>Xác nhận và Gửi</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}