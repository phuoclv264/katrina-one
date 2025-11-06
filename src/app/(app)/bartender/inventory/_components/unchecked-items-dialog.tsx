'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, ChevronsDownUp } from 'lucide-react';
import type { InventoryItem } from '@/lib/types';

type CategorizedList = {
    category: string;
    items: InventoryItem[];
}[];

interface UncheckedItemsDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    uncheckedItems: InventoryItem[];
    onContinue: () => void;
    itemRowRefs: React.MutableRefObject<Map<string, HTMLDivElement | null>>;
}

export function UncheckedItemsDialog({ isOpen, onOpenChange, uncheckedItems, onContinue, itemRowRefs }: UncheckedItemsDialogProps) {
    const [openUncheckedCategories, setOpenUncheckedCategories] = useState<string[]>([]);

    const categorizedUncheckedItems = useMemo((): CategorizedList => {
        if (uncheckedItems.length === 0) return [];
        const grouped: { [key: string]: InventoryItem[] } = {};
        uncheckedItems.forEach(item => {
            const category = item.category || 'CHƯA PHÂN LOẠI';
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(item);
        });
        const categories = Object.keys(grouped);
        setOpenUncheckedCategories(categories); // Open all by default
        return categories.map(category => ({ category, items: grouped[category] }));
    }, [uncheckedItems]);

    const handleToggleAllUnchecked = useCallback(() => {
        if (openUncheckedCategories.length === categorizedUncheckedItems.length) {
            setOpenUncheckedCategories([]);
        } else {
            setOpenUncheckedCategories(categorizedUncheckedItems.map(c => c.category));
        }
    }, [openUncheckedCategories, categorizedUncheckedItems]);

    const areAllUncheckedOpen = categorizedUncheckedItems.length > 0 && openUncheckedCategories.length === categorizedUncheckedItems.length;

    return (
        <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
            <AlertDialogContent className="max-w-lg rounded-2xl border shadow-2xl bg-background">
                <AlertDialogHeader className="flex flex-row items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                        <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div>
                        <AlertDialogTitle className="text-lg font-bold text-amber-600 dark:text-amber-400">
                            Cảnh báo: Còn mặt hàng chưa kiểm kê
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-muted-foreground">
                            Có <span className="font-bold">{uncheckedItems.length}</span> mặt hàng chưa được kiểm kê.
                            Bạn vẫn muốn tiếp tục gửi báo cáo?
                        </AlertDialogDescription>
                    </div>
                </AlertDialogHeader>

                <div className="flex justify-end -mb-2">
                    <Button variant="outline" size="sm" onClick={handleToggleAllUnchecked}>
                        <ChevronsDownUp className="mr-2 h-4 w-4" />
                        {areAllUncheckedOpen ? "Thu gọn tất cả" : "Mở rộng tất cả"}
                    </Button>
                </div>

                <ScrollArea className="max-h-80 w-full rounded-md border bg-muted/30">
                    <div className="p-3">
                        <Accordion type="multiple" value={openUncheckedCategories} onValueChange={setOpenUncheckedCategories} className="w-full space-y-2">
                            {categorizedUncheckedItems.map(({ category, items }) => (
                                <AccordionItem value={category} key={category} className="rounded-lg border bg-card shadow-sm">
                                    <AccordionTrigger className="px-3 py-2 text-base font-semibold hover:no-underline hover:bg-accent rounded-lg">
                                        {category} ({items.length})
                                    </AccordionTrigger>
                                    <AccordionContent className="p-2 space-y-0">
                                        {items.map(item => (
                                            <button key={item.id} className="w-full text-left px-3 py-2 rounded-md hover:bg-accent text-sm transition" onClick={() => {
                                                const element = itemRowRefs.current.get(item.id);
                                                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                element?.focus();
                                                onOpenChange(false);
                                            }}>
                                                {item.name}
                                            </button>
                                        ))}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </div>
                </ScrollArea>

                <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-lg" onClick={() => onOpenChange(false)}>Hủy</AlertDialogCancel>
                    <AlertDialogAction onClick={onContinue} className="bg-amber-600 text-white hover:bg-amber-700 rounded-lg">
                        Bỏ qua và gửi
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}