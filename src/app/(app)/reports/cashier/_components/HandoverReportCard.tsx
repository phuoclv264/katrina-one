
'use client';
import React from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogIcon, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
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
        <Card className="border-slate-500/50 rounded-lg shadow-none bg-transparent">
            <CardHeader className="p-3 sm:p-4 pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-slate-800 dark:text-slate-300"><ClipboardCheck /> Bàn giao ca</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0 relative">
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
                            <Card
                                key={handover.id}
                                ref={el => {
                                    if (el) itemRefs.current.set(highlightKey, el); else itemRefs.current.delete(highlightKey);
                                }}
                                className="bg-card relative shadow-sm border-slate-200 dark:border-slate-800 overflow-hidden"
                            >
                                <CardContent className="p-3">
                                    <div className="flex justify-between items-start gap-3 mb-2">
                                        <div className="space-y-1 min-w-0 flex-1">
                                            <div className="font-semibold text-sm leading-tight">
                                                Kiểm kê bởi {handover.createdBy.userName}
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {handover.finalHandoverDetails && <Badge variant="default" className="bg-primary/100 text-[10px] h-5 px-1.5 font-normal"><FileSignature className="h-3 w-3 mr-1" />Bàn giao</Badge>}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-base sm:text-lg font-bold">{handover.actualCashCounted.toLocaleString('vi-VN')}đ</p>
                                            {discrepancy !== 0 && <p className={cn("text-[11px] sm:text-sm font-semibold", discrepancy > 0 ? "text-green-600" : "text-red-600")}>{discrepancy > 0 ? '+' : ''}{discrepancy.toLocaleString('vi-VN')}đ</p>}
                                        </div>
                                    </div>

                                    {discrepancy !== 0 && (
                                        <div className="px-3 py-2 bg-red-50 dark:bg-red-900/10 -mx-3 border-t border-red-100 dark:border-red-900/30 text-xs text-red-600 dark:text-red-400">
                                            <span className="font-semibold">Lệch: </span>{handover.discrepancyReason || 'Không có lý do'}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-dashed border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span className="font-medium">{handover.createdBy.userName}</span>
                                            <span>•</span>
                                            <span>{format((handover.createdAt as Timestamp).toDate(), 'HH:mm')}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {handover.finalHandoverDetails && (
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10" onClick={() => onViewFinalHandover(handover)}><FileSignature className="h-4 w-4" /></Button>
                                            )}
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => onEditCashHandover(handover)}><Edit className="h-4 w-4" /></Button>
                                            <AlertDialog dialogTag="alert-dialog" parentDialogTag="root" variant="destructive">
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10" disabled={isProcessing}><Trash2 className="h-4 w-4" /></Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogIcon icon={Trash2} />
                                                        <div className="space-y-2 text-center sm:text-left">
                                                            <AlertDialogTitle>Xóa biên bản này?</AlertDialogTitle>
                                                            <AlertDialogDescription>Hành động này sẽ xóa vĩnh viễn biên bản bàn giao và không thể hoàn tác.</AlertDialogDescription>
                                                        </div>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => onDeleteCashHandover(handover.id)}>Xóa</AlertDialogAction></AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>
                                </CardContent>
                                {isProcessing && (<div className="absolute inset-0 bg-white/80 dark:bg-black/80 flex items-center justify-center z-10"><Loader2 className="h-6 w-6 animate-spin text-destructive" /><span className="ml-2 text-sm font-medium text-destructive">Đang xóa...</span></div>)}
                            </Card>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    );
});
HandoverReportCard.displayName = 'HandoverReportCard';

export default HandoverReportCard;
