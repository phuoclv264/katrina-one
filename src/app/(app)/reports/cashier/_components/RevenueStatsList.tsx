'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(value).toLocaleString('vi-VN')}đ
        </span>
    );
};

type RevenueStatsListProps = {
    stats: RevenueStats[];
    onEdit: (stat: RevenueStats) => void;
    onDelete: (id: string) => void;
    processingItemId: string | null;
    itemRefs: React.MutableRefObject<Map<string, HTMLDivElement | null>>;
};

const RevenueStatsList = React.memo(({ stats, onEdit, onDelete, processingItemId, itemRefs }: RevenueStatsListProps) => {
    if (stats.length === 0) return <p className="text-sm text-center text-muted-foreground py-2">Chưa có báo cáo.</p>;

    return (
        <div className="space-y-3">
            {stats.map((stat, index) => {
                const prevStat = stats[index + 1];
                const difference = prevStat ? stat.netRevenue - prevStat.netRevenue : 0;
                const isProcessing = processingItemId === stat.id;
                const highlightKey = `revenue-${stat.id}`;

                const displayTime = stat.reportTimestamp
                    ? format(parseISO(stat.reportTimestamp), 'HH:mm')
                    : format(new Date(stat.createdAt as string), 'HH:mm');

                return (
                    <Card 
                        key={stat.id}
                        ref={el => {
                            if (el) itemRefs.current.set(highlightKey, el);
                            else itemRefs.current.delete(highlightKey);
                        }}
                        className="bg-card relative shadow-sm border-slate-200 dark:border-slate-800 overflow-hidden"
                    >
                        <CardContent className="p-3">
                            <div className="flex justify-between items-start gap-3 mb-2">
                                <div className="space-y-1 min-w-0 flex-1">
                                    <div className="font-semibold text-sm leading-tight">
                                        Báo cáo doanh thu
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {stat.isAiGenerated && <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50 text-[10px] h-5 px-1.5 font-normal border-blue-100"><Wand2 className="h-3 w-3 mr-1" />AI</Badge>}
                                        {stat.isEdited && <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal text-muted-foreground">Đã sửa</Badge>}
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="font-bold text-base text-green-700 dark:text-green-400">{stat.netRevenue.toLocaleString('vi-VN')}đ</p>
                                    {difference !== 0 && <div className="flex justify-end"><ChangeIndicator value={difference} /></div>}
                                </div>
                            </div>

                            <div className="flex items-center justify-between mt-3 pt-2 border-t border-dashed border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span className="font-medium">{stat.createdBy.userName}</span>
                                    <span>•</span>
                                    <span>{displayTime}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => onEdit(stat)}><Edit className="h-4 w-4" /></Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10" disabled={isProcessing}><Trash2 className="h-4 w-4" /></Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader><AlertDialogTitle>Xóa phiếu thống kê?</AlertDialogTitle><AlertDialogDescription>Hành động này sẽ xóa vĩnh viễn phiếu và không thể hoàn tác.</AlertDialogDescription></AlertDialogHeader>
                                            <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(stat.id)}>Xóa</AlertDialogAction></AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </div>
                        </CardContent>
                        {isProcessing && (
                            <div className="absolute inset-0 bg-white/80 dark:bg-black/80 flex items-center justify-center z-10">
                                <Loader2 className="h-6 w-6 animate-spin text-destructive" />
                                <span className="ml-2 text-sm font-medium text-destructive">Đang xóa...</span>
                            </div>
                        )}
                    </Card>
                );
            })}
        </div>
    );
});
RevenueStatsList.displayName = 'RevenueStatsList';

export default RevenueStatsList;
