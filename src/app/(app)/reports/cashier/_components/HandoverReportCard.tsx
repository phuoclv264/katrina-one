
'use client';
import React from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Edit, Trash2, Loader2, ClipboardCheck, FileSignature } from 'lucide-react';
import type { CashHandoverReport, RevenueStats, ExpenseSlip } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';

export type HandoverReportCardProps = { 
    cashHandovers: CashHandoverReport[], 
    revenueStats: RevenueStats[],
    expenseSlips: ExpenseSlip[],
    onEditCashHandover: (handover: CashHandoverReport) => void,
    onDeleteCashHandover: (id: string) => void,
    onViewFinalHandover: (handover: CashHandoverReport) => void,
    processingItemId: string | null 
    itemRefs: React.MutableRefObject<Map<string, HTMLDivElement | null>>;
};

const HandoverReportCard = React.memo(({ 
    cashHandovers, 
    revenueStats,
    expenseSlips,
    onEditCashHandover,
    onDeleteCashHandover,
    onViewFinalHandover,
    processingItemId,
    itemRefs
}: HandoverReportCardProps) => {
    if (cashHandovers.length === 0) {
        return null;
    }

    return (
        <Card className="border-slate-500/50 rounded-lg shadow-sm">
            <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-slate-800 dark:text-slate-300"><ClipboardCheck /> Bàn giao ca</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 relative">
                <div className="space-y-3">
                    {cashHandovers.filter(handover => handover.createdAt).map(handover => {
                        const isProcessing = processingItemId === handover.id;
                        const highlightKey = `handover-${handover.id}`;

                        // Calculate expected cash dynamically
                        const linkedRevenue = revenueStats.find(r => r.id === handover.linkedRevenueStatsId);
                        const cashRevenue = linkedRevenue?.revenueByPaymentMethod.cash || 0;

                        const linkedExpenses = expenseSlips.filter(e => handover.linkedExpenseSlipIds.includes(e.id) && e.paymentMethod === 'cash');
                        const cashExpense = linkedExpenses.reduce((sum, slip) => sum + (slip.actualPaidAmount ?? slip.totalAmount), 0);
                        
                        const startOfDayCash = handover.startOfDayCash;
                        const expectedCash = cashRevenue - cashExpense + startOfDayCash;
                        const discrepancy = handover.actualCashCounted - expectedCash;

                        return (
                            <div key={handover.id} className="border-t first:border-t-0 pt-3 first:pt-0 relative" ref={el => {
                                if (el) itemRefs.current.set(highlightKey, el); else itemRefs.current.delete(highlightKey);
                            }}
                            >
                                <div className="flex justify-between items-start gap-2">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-semibold text-sm sm:text-base truncate">Kiểm kê bởi {handover.createdBy.userName}</p>
                                            {handover.finalHandoverDetails && <Badge variant="default" className="bg-primary/100 text-[10px] h-4 px-1"><FileSignature className="h-3 w-3 mr-1"/>Bàn giao</Badge>}
                                        </div>
                                        <p className="text-[10px] sm:text-xs text-muted-foreground">lúc {format((handover.createdAt as Timestamp).toDate(), 'HH:mm')}</p>
                                        {discrepancy !== 0 && <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 italic line-clamp-1">Lý do: {handover.discrepancyReason || 'Không có'}</p>}
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-base sm:text-lg font-bold">{handover.actualCashCounted.toLocaleString('vi-VN')}đ</p>
                                        {discrepancy !== 0 && <p className={cn("text-[11px] sm:text-sm font-semibold", discrepancy > 0 ? "text-green-600" : "text-red-600")}>{discrepancy > 0 ? '+' : ''}{discrepancy.toLocaleString('vi-VN')}đ</p>}
                                    </div>
                                </div>
                                <div className="flex justify-end items-center gap-1 mt-2">
                                    {handover.finalHandoverDetails && (
                                        <Button variant="default" size="sm" onClick={() => onViewFinalHandover(handover)} className="h-7 text-[10px] px-2 bg-primary/100 hover:bg-primary/80"><FileSignature className="h-3.5 w-3.5 mr-1.5"/>Xem bàn giao</Button>
                                    )}
                                    <Button variant="outline" size="sm" onClick={() => onEditCashHandover(handover)} className="h-7 text-[10px] px-2">Chi tiết</Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive h-7 w-7"><Trash2 className="h-3.5 w-3.5"/></Button></AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader><AlertDialogTitle>Xóa biên bản này?</AlertDialogTitle></AlertDialogHeader>
                                            <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => onDeleteCashHandover(handover.id)}>Xóa</AlertDialogAction></AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                                {isProcessing && (<div className="absolute inset-0 bg-white/80 dark:bg-black/80 flex items-center justify-center rounded-md"><Loader2 className="h-6 w-6 animate-spin text-destructive"/><span className="ml-2 text-sm font-medium text-destructive">Đang xóa...</span></div>)}
                            </div>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    );
});
HandoverReportCard.displayName = 'HandoverReportCard';

export default HandoverReportCard;
