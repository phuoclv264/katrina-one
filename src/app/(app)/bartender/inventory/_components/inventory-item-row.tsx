'use client';

import type { InventoryItem, InventoryStockRecord } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Star, Camera, X } from 'lucide-react';
import Image from 'next/image';

type ItemStatus = 'ok' | 'low' | 'out';

const getStatusColorClass = (status: ItemStatus) => {
    switch(status) {
        case 'low': return 'bg-yellow-100/50 dark:bg-yellow-900/30';
        case 'out': return 'bg-red-100/50 dark:bg-red-900/30';
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
    inputRef: (el: HTMLInputElement | null) => void;
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
    inputRef,
    rowRef,
}: InventoryItemRowProps) {
    const stockValue = record?.stock ?? '';
    const photoIds = record?.photoIds || [];
    const photoUrls = photoIds.map(id => localPhotoUrls.get(id)).filter(Boolean) as string[];

    const getItemStatus = (stock: number | string, minStock: number): ItemStatus => {
      if (typeof stock !== 'number') {
        return 'ok';
      }
      if (stock <= 0) return 'out';
      if (stock < minStock) return 'low';
      return 'ok';
    };

    const status = getItemStatus(stockValue, item.minStock);

    return (
        <div 
            ref={rowRef}
            tabIndex={-1}
            className={`rounded-lg border p-3 grid grid-cols-2 gap-4 items-start ${getStatusColorClass(status)} cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2`}
            onClick={() => (inputRef as any)?.focus()}
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
                <Input
                    ref={inputRef}
                    type="text"
                    value={stockValue}
                    onChange={e => onStockChange(item.id, e.target.value)}
                    className="text-center h-9 w-24"
                    placeholder="Tồn kho..."
                    disabled={isProcessing}
                />
            </div>
        </div>
    );
}
