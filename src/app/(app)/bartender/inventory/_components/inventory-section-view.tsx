'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronLeft, ChevronRight, GlassWater, LayoutGrid, Package, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InventoryItemRow } from './inventory-item-row';
import type { InventoryItem, InventoryReport } from '@/lib/types';

interface InventorySectionViewProps {
    category: string;
    items: InventoryItem[];
    report: InventoryReport;
    localPhotoUrls: Map<string, string>;
    isProcessing: boolean;
    onStockChange: (itemId: string, value: string) => void;
    onOpenCamera: (itemId: string) => void;
    onDeletePhoto: (itemId: string, photoId: string, isLocal: boolean) => void;
    onBack: () => void;
    onPrev: () => void;
    onNext: () => void;
    canPrev: boolean;
    canNext: boolean;
    setItemRowRef: (itemId: string, el: HTMLDivElement | null) => void;
}

export const getCategoryIcon = (category: string) => {
    const lower = category.toLowerCase();
    if (lower.includes('uống') || lower.includes('nước') || lower.includes('trà') || lower.includes('cà phê')) return <GlassWater className="h-5 w-5" />;
    if (lower.includes('ăn') || lower.includes('đồ khô') || lower.includes('gia vị')) return <UtensilsCrossed className="h-5 w-5" />;
    if (lower.includes('dùng') || lower.includes('vật dụng') || lower.includes('bao bì')) return <Package className="h-5 w-5" />;
    return <LayoutGrid className="h-5 w-5" />;
};

export const InventorySectionView = ({
    category,
    items,
    report,
    localPhotoUrls,
    isProcessing,
    onStockChange,
    onOpenCamera,
    onDeletePhoto,
    onBack,
    onPrev,
    onNext,
    canPrev,
    canNext,
    setItemRowRef
}: InventorySectionViewProps) => {
    const checkedCount = items.filter(item => report.stockLevels[item.id]?.stock !== undefined && report.stockLevels[item.id]?.stock !== '').length;
    const totalCount = items.length;

    return (
        <Card className="border-primary/20 shadow-md overflow-visible">
            {/* Sticky Header - Adjusted top for possible parent headers */}
            <CardHeader className="sticky top-[100px] sm:top-[120px] z-30 border-b bg-background/95 backdrop-blur-sm py-4 rounded-t-xl px-4 sm:px-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={onBack} 
                            className="rounded-full h-9 w-9 shrink-0 hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
                                {getCategoryIcon(category)}
                            </div>
                            <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-primary italic truncate max-w-[150px] sm:max-w-none">
                                {category}
                            </h2>
                        </div>
                    </div>
                    <Badge className="font-mono bg-primary text-primary-foreground border-none px-3 py-1 shadow-sm">
                        {checkedCount} / {totalCount}
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="pt-6 px-4 sm:px-6">
                <div className="space-y-4">
                    {items.map(item => (
                        <InventoryItemRow
                            key={item.id}
                            item={item}
                            record={report.stockLevels[item.id]}
                            localPhotoUrls={localPhotoUrls}
                            isProcessing={isProcessing}
                            onStockChange={onStockChange}
                            onOpenCamera={onOpenCamera}
                            onDeletePhoto={onDeletePhoto}
                            rowRef={(el) => setItemRowRef(item.id, el)}
                        />
                    ))}
                </div>

                {/* Section Navigation Buttons */}
                <div className="flex items-center justify-between mt-10 pt-6 border-t">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onPrev}
                        disabled={!canPrev}
                        className="gap-2 rounded-xl h-12 px-5 font-bold border-primary/20 hover:bg-primary/5 transition-all disabled:opacity-30"
                    >
                        <ChevronLeft className="h-5 w-5" />
                        <span className="hidden sm:inline">Khu vực trước</span>
                        <span className="sm:hidden">Trước</span>
                    </Button>
                    
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onBack}
                        className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors hidden sm:flex"
                    >
                        Thoát khu vực
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onNext}
                        disabled={!canNext}
                        className="gap-2 rounded-xl h-12 px-5 font-bold border-primary/20 hover:bg-primary/5 transition-all disabled:opacity-30"
                    >
                        <span className="hidden sm:inline">Khu vực tiếp</span>
                        <span className="sm:hidden">Tiếp</span>
                        <ChevronRight className="h-5 w-5" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};
