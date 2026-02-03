'use client';

import React, { useRef, useState, useEffect } from 'react';
import type { InventoryItem, InventoryStockRecord } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDebouncedCallback } from 'use-debounce';
import { Camera, X, AlertTriangle } from 'lucide-react';
import Image from '@/components/ui/image';
import { Combobox } from "@/components/combobox";
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';

type ItemStatus = 'ok' | 'low' | 'out';

const getStatusColorClass = (status: ItemStatus) => {
    switch(status) {
        case 'out': return 'bg-red-100/50 dark:bg-red-900/30';
        case 'low': return 'bg-yellow-100/50 dark:bg-yellow-900/30';
        case 'ok': return 'bg-green-100/40 dark:bg-green-900/20';
        default: return 'bg-transparent';
    }
}

type InventoryItemRowProps = {
    item: InventoryItem;
    record: InventoryStockRecord | undefined;
    localPhotoUrls: Map<string, string>;
    isProcessing: boolean;
    onStockChange: (itemId: string, value: string) => void;
    onOpenCamera: (itemId: string) => void;
    onDeletePhoto: (itemId: string, photoId: string, isLocal: boolean) => void;
    rowRef: (el: HTMLDivElement | null) => void;
};

const InventoryItemRowComponent = ({
    item,
    record,
    localPhotoUrls,
    isProcessing,
    onStockChange,
    onOpenCamera,
    onDeletePhoto,
    rowRef,
}: InventoryItemRowProps) => {
    const [localStockValue, setLocalStockValue] = useState(record?.stock ?? '');
    const localInputRef = useRef<HTMLInputElement>(null);

    // Debounce the call to the parent component's state update function
    const debouncedOnStockChange = useDebouncedCallback((value: string | number) => {
        onStockChange(item.id, String(value));
    }, 300);

    // Sync local state if the prop from parent changes
    useEffect(() => {
        const parentValue = record?.stock ?? '';
        if (parentValue !== localStockValue) {
            setLocalStockValue(parentValue);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [record?.stock]);

    const photoIds = record?.photoIds || [];
    const photoUrls = photoIds.map(id => localPhotoUrls.get(id)).filter(Boolean) as string[];
     const getItemStatus = (item: InventoryItem, stockValue: number | string | undefined): ItemStatus => {
        if (stockValue === undefined || stockValue === '') return 'ok';
        if (item.dataType === 'number') {
            const stock = typeof stockValue === 'number' ? stockValue : parseFloat(String(stockValue));
            if (isNaN(stock)) return 'ok';
            if (stock < item.minStock * 0.3) return 'out';
            if (stock < item.minStock) return 'low';
            return 'ok';
        } else { // 'list' type
            const stockString = String(stockValue).toLowerCase();
            if (stockString.includes('hết') || stockString.includes('gần hết')) return 'out'; // Hết hàng & Gần hết -> Đỏ
            if (stockString.includes('còn đủ')) return 'low'; // Còn đủ -> Vàng
            if (stockString.includes('dư')) return 'ok'; // Dư xài -> Xanh
            return 'ok';
        }
    };

    const status = getItemStatus(item, localStockValue);
    const showBackground = localStockValue !== '' && localStockValue !== undefined;


    const handleContainerClick = () => {
        if (item.dataType === 'number' && localInputRef.current) {
            localInputRef.current.focus();
            localInputRef.current.select();
        }
    };
    
    const handleNumericChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
            setLocalStockValue(value);
            debouncedOnStockChange(value);
        }
    };

    const handleSelectChange = (value: string) => {
        setLocalStockValue(value);
        debouncedOnStockChange(value);
    };

    return (
        <div 
            ref={rowRef}
            className={cn(
                "p-4 rounded-2xl border transition-all duration-300 flex flex-col gap-4 shadow-sm",
                showBackground ? getStatusColorClass(status) : "bg-card hover:border-primary/40 hover:shadow-md"
            )}
            onClick={handleContainerClick}
        >
            <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-bold text-card-foreground leading-tight">{item.name}</h3>
                        {item.isImportant && (
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 shrink-0" />
                        )}
                        {item.requiresPhoto && (
                            <Camera className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                        <Badge variant="outline" className="text-[10px] uppercase font-black tracking-widest bg-background/50 border-primary/10 py-0 h-5">
                            {item.baseUnit || item.unit}
                        </Badge>
                        {item.dataType === 'number' && (
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                Định mức: {item.minStock}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                    {item.dataType === 'number' ? (
                        <div className="relative group/input">
                            <Input
                                ref={localInputRef}
                                type="text"
                                inputMode="decimal"
                                value={localStockValue}
                                onChange={handleNumericChange}
                                placeholder="0"
                                disabled={isProcessing}
                                className="w-24 h-11 text-right text-lg font-black bg-background/80 border-primary/20 focus:ring-primary focus:border-primary transition-all rounded-xl shadow-inner group-hover/input:border-primary/40"
                            />
                            {localStockValue !== '' && status !== 'ok' && (
                                <div className="absolute -top-1.5 -left-1.5 bg-background rounded-full p-0.5 shadow-sm border">
                                    <AlertTriangle className={cn(
                                        "h-3.5 w-3.5",
                                        status === 'out' ? "text-red-500" : "text-yellow-500"
                                    )} />
                                </div>
                            )}
                        </div>
                    ) : (
                        <Combobox
                            options={(item.listOptions || ['Hết', 'Gần hết', 'Còn đủ', 'Dư xài']).map(opt => ({ label: opt, value: opt }))}
                            value={String(localStockValue)}
                            onChange={(val) => {
                                const newVal = Array.isArray(val) ? val[0] : val;
                                setLocalStockValue(newVal);
                                onStockChange(item.id, newVal);
                            }}
                            placeholder="Chọn..."
                            className="w-32 h-11 font-bold rounded-xl border-primary/20 bg-background/80 shadow-sm"
                        />
                    )}
                </div>
            </div>

            {/* Photos Section - Only show if important or already has photos */}
            {(item.requiresPhoto || photoUrls.length > 0) && (
                <div className="pt-2 border-t border-primary/5 flex flex-wrap gap-2 items-center">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); onOpenCamera(item.id); }}
                        className="h-8 rounded-lg bg-primary/5 text-primary hover:bg-primary hover:text-white border-primary/10 transition-all text-[11px] font-bold px-3 gap-2"
                    >
                        <Camera className="h-3.5 w-3.5" />
                        Ảnh thực tế
                    </Button>
                    
                    <div className="flex flex-wrap gap-1.5 ml-auto">
                        {photoUrls.map((photoUrl, index) => (
                            <div key={`${item.id}-photo-${index}`} className="relative aspect-square rounded-md overflow-hidden w-9 h-9">
                                <Image src={photoUrl} alt="Inventory photo" fill className="object-cover" />
                                <Button
                                    variant="destructive"
                                    size="icon"
                                    className="absolute -top-1 -right-1 h-4 w-4 rounded-full z-10 p-0"
                                    onClick={(e) => { e.stopPropagation(); onDeletePhoto(item.id, photoIds[index], true);}}
                                >
                                    <X className="h-2 w-2" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export const InventoryItemRow = React.memo(InventoryItemRowComponent);
