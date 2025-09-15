'use client';

import { useRef, useState, useEffect } from 'react';
import type { InventoryItem, InventoryStockRecord } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Star, Camera, X } from 'lucide-react';
import Image from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


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

export function InventoryItemRow({
    item,
    record,
    localPhotoUrls,
    isProcessing,
    onStockChange,
    onOpenCamera,
    onDeletePhoto,
    rowRef,
}: InventoryItemRowProps) {
    const localInputRef = useRef<HTMLInputElement>(null);

    const stockValue = record?.stock ?? '';
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

    const status = getItemStatus(item, stockValue);
    const showBackground = stockValue !== '' && stockValue !== undefined;


    const handleContainerClick = () => {
        if (item.dataType === 'number' && localInputRef.current) {
            localInputRef.current.focus();
            localInputRef.current.select();
        }
    };
    
    const handleNumericChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
            onStockChange(item.id, value);
        }
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
                    {item.requiresPhoto && <Star className="h-4 w-4 text-yellow-500 shrink-0" />}
                    {item.name}
                </p>
                <p className="text-sm text-muted-foreground">Đơn vị: {item.unit}</p>
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
                        type="number"
                        value={stockValue}
                        onChange={handleNumericChange}
                        className="text-center h-9 w-20"
                        placeholder="Số lượng..."
                        disabled={isProcessing}
                        onClick={(e) => e.stopPropagation()}
                    />
               ) : (
                    <Select 
                        value={String(stockValue)} 
                        onValueChange={(v) => onStockChange(item.id, v === '_clear_' ? '' : v)} 
                        disabled={isProcessing}
                    >
                        <SelectTrigger className="w-full h-auto min-h-9 whitespace-normal [&>span]:flex [&>span]:items-center [&>span]:justify-end [&>span]:text-right">
                            <SelectValue placeholder="Chọn..." />
                        </SelectTrigger>
                        <SelectContent>
                             <SelectItem value="_clear_">Bỏ chọn</SelectItem>
                            {(item.listOptions || ['hết', 'gần hết', 'còn đủ', 'dư xài']).map(option => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
               )}
            </div>
        </div>
    );
}
