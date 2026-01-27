
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
            tabIndex={-1}
            className={`rounded-lg border p-3 grid grid-cols-2 gap-4 items-start ${showBackground ? getStatusColorClass(status) : ''} cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2`}
            onClick={handleContainerClick}
        >
            <div className="col-span-1">
                <p className="font-semibold flex items-center gap-2">
                    {item.name}
                </p>
                <p className="text-sm text-muted-foreground">Đơn vị: {item.baseUnit}</p>
                {item.requiresPhoto && (
                    <div className="flex gap-2 items-center flex-wrap mt-2">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9"
                            onClick={(e) => { e.stopPropagation(); onOpenCamera(item.id); }}
                            disabled={isProcessing}
                        >
                            <Camera className="h-4 w-4" />
                        </Button>
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
                )}
            </div>
            <div className="col-span-1 flex flex-col items-end gap-2">
               {item.dataType === 'number' ? (
                     <Input
                        ref={localInputRef}
                        type="text" // Use text to allow for intermediate states like '.' or '-'
                        inputMode="decimal" // Better for mobile keyboards
                        value={localStockValue}
                        onChange={handleNumericChange}
                        onBlur={() => debouncedOnStockChange.flush()}
                        className="text-center h-9 w-20"
                        placeholder="Số lượng..."
                        disabled={isProcessing}
                        onClick={(e) => e.stopPropagation()}
                    />
               ) : (
                    <Combobox
                        value={String(localStockValue)}
                        onChange={(v) => handleSelectChange(v === '_clear_' ? '' : v)}
                        disabled={isProcessing}
                        options={[
                            { value: "_clear_", label: "Bỏ chọn" },
                            ...(item.listOptions || ['hết', 'gần hết', 'còn đủ', 'dư xài']).map(option => ({ value: option, label: option }))
                        ]}
                        className="w-full h-auto min-h-9 whitespace-normal"
                        placeholder="Chọn..."
                        compact
                        searchable={false}
                    />
               )}
            </div>
        </div>
    );
}

export const InventoryItemRow = React.memo(InventoryItemRowComponent);
