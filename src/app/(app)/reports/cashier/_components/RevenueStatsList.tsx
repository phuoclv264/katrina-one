'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Loader2, TrendingUp, TrendingDown, Wand2 } from 'lucide-react';
import type { RevenueStats } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

const ChangeIndicator = ({ value, isRevenue = true }: { value: number, isRevenue?: boolean }) => {
    if (isNaN(value) || !isFinite(value) || value === 0) return null;

    const isPositive = value > 0;
    const colorClass = isPositive ? (isRevenue ? 'text-green-600' : 'text-red-600') : (isRevenue ? 'text-red-600' : 'text-green-600');

    return (
        <span className={cn("text-xs font-semibold flex items-center gap-0.5", colorClass)}>
            {isPositive ? <TrendingUp className="h-3 w-3"/> : <TrendingDown className="h-3 w-3"/>}
            {Math.abs(value).toLocaleString('vi-VN')}đ
        </span>
    );
};

const RevenueStatsList = React.memo(({ stats, onEdit, onDelete, processingItemId }: { stats: RevenueStats[], onEdit: (stat: RevenueStats) => void, onDelete: (id: string) => void, processingItemId: string | null }) => {
    if (stats.length === 0) return <p className="text-sm text-center text-muted-foreground py-2">Chưa có báo cáo.</p>;

    return (
        <div className="space-y-4">
            {stats.map((stat, index) => {
                const prevStat = stats[index + 1];
                const difference = prevStat ? stat.netRevenue - prevStat.netRevenue : 0;
                const isProcessing = processingItemId === stat.id;
                const displayTime = stat.reportTimestamp 
                    ? format(parseISO(stat.reportTimestamp), 'HH:mm')
                    : format(new Date(stat.createdAt as string), 'HH:mm');

                return (
                    <div key={stat.id} className="border-t first:border-t-0 pt-3 first:pt-0 relative">
                        <div className="flex justify-between items-start">
                            <p className="text-sm text-muted-foreground">Lúc {displayTime} bởi {stat.createdBy.userName}</p>
                            <div className="flex items-center gap-2">
                                {stat.isAiGenerated && <Badge className="bg-blue-100 text-blue-800"><Wand2 className="h-3 w-3 mr-1"/>AI</Badge>}
                                {stat.isEdited && <Badge variant="secondary" className="text-xs">Đã sửa</Badge>}
                            </div>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                            <div className="flex items-baseline gap-2 flex-wrap">
                                <p className="text-xl font-bold text-green-700 dark:text-green-200">{stat.netRevenue.toLocaleString('vi-VN')}đ</p>
                                {difference !== 0 && <ChangeIndicator value={difference} />}
                            </div>
                            <div className="flex gap-1">
                                <Button variant="outline" size="sm" onClick={() => onEdit(stat)} className="h-8">Chi tiết</Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive h-8 w-8" disabled={isProcessing}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader><AlertDialogTitle>Xóa phiếu thống kê?</AlertDialogTitle><AlertDialogDescription>Hành động này sẽ xóa vĩnh viễn phiếu và không thể hoàn tác.</AlertDialogDescription></AlertDialogHeader>
                                        <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(stat.id)}>Xóa</AlertDialogAction></AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                        {isProcessing && (
                          <div className="absolute inset-0 bg-white/80 dark:bg-black/80 flex items-center justify-center rounded-md">
                            <Loader2 className="h-6 w-6 animate-spin text-destructive"/>
                            <span className="ml-2 text-sm font-medium text-destructive">Đang xóa...</span>
                          </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
});
RevenueStatsList.displayName = 'RevenueStatsList';

export default RevenueStatsList;
