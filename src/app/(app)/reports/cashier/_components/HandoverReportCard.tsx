
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
};

const HandoverReportCard = React.memo(({ 
    cashHandovers, 
    revenueStats,
    expenseSlips,
    onEditCashHandover,
    onDeleteCashHandover,
    onViewFinalHandover,
    processingItemId 
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
                    {cashHandovers.map(handover => {
                        const isProcessing = processingItemId === handover.id;

                        // Calculate expected cash dynamically
                        const linkedRevenue = revenueStats.find(r => r.id === handover.linkedRevenueStatsId);
                        const cashRevenue = linkedRevenue?.revenueByPaymentMethod.cash || 0;

                        const linkedExpenses = expenseSlips.filter(e => handover.linkedExpenseSlipIds.includes(e.id) && e.paymentMethod === 'cash');
                        const cashExpense = linkedExpenses.reduce((sum, slip) => sum + (slip.actualPaidAmount ?? slip.totalAmount), 0);
                        
                        const startOfDayCash = handover.startOfDayCash;
                        const expectedCash = cashRevenue - cashExpense + startOfDayCash;
                        const discrepancy = handover.actualCashCounted - expectedCash;

                        return (
                            <div key={handover.id} className="border-t first:border-t-0 pt-3 first:pt-0 relative">
                                <div className="flex justify-between items-start gap-2">
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-semibold">Kiểm kê bởi {handover.createdBy.userName}</p>
                                            {handover.finalHandoverDetails && <Badge variant="default" className="bg-primary/100"><FileSignature className="h-3 w-3 mr-1"/>Bàn giao cuối ca</Badge>}
                                        </div>
                                        <p className="text-xs text-muted-foreground">lúc {format((handover.createdAt as Timestamp).toDate(), 'HH:mm')}</p>
                                        {discrepancy !== 0 && <p className="text-xs text-muted-foreground mt-1 italic">Lý do chênh lệch: {handover.discrepancyReason || 'Không có'}</p>}
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-bold">{handover.actualCashCounted.toLocaleString('vi-VN')}đ</p>
                                        {discrepancy !== 0 && <p className={cn("text-sm font-semibold", discrepancy > 0 ? "text-green-600" : "text-red-600")}>{discrepancy > 0 ? '+' : ''}{discrepancy.toLocaleString('vi-VN')}đ</p>}
                                    </div>
                                </div>
                                <div className="flex justify-end items-center gap-1 mt-1">
                                    {handover.finalHandoverDetails && (
                                        <Button variant="default" size="sm" onClick={() => onViewFinalHandover(handover)} className="h-8 bg-primary/100 hover:bg-primary/80"><FileSignature className="h-4 w-4 mr-2"/>Xem bàn giao</Button>
                                    )}
                                    <Button variant="outline" size="sm" onClick={() => onEditCashHandover(handover)} className="h-8">Chi tiết</Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive h-8 w-8"><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger>
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
