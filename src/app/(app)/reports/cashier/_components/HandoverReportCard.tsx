
'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Edit, Trash2, Loader2, ClipboardCheck } from 'lucide-react';
import type { HandoverReport } from '@/lib/types';

const HandoverReportCard = React.memo(({ handover, onEdit, onDelete, processingItemId }: { handover: HandoverReport, onEdit: (handover: HandoverReport) => void, onDelete: (id: string) => void, processingItemId: string | null }) => {
    const isProcessing = processingItemId === handover.id;
    return (
        <Card className="border-slate-500/50 rounded-lg shadow-sm">
            <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-slate-800 dark:text-slate-300"><ClipboardCheck /> Bàn giao ca</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 relative">
                <div className="flex justify-between items-center mt-1">
                    <p className="text-sm text-muted-foreground">Bàn giao bởi: <span className="font-semibold text-foreground">{handover.createdBy.userName}</span></p>
                    <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => onEdit(handover)} className="h-8">Chi tiết</Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive h-8 w-8"><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Xóa Báo cáo Bàn giao?</AlertDialogTitle></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(handover.id)}>Xóa</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
                {isProcessing && (<div className="absolute inset-0 bg-white/80 dark:bg-black/80 flex items-center justify-center rounded-lg"><Loader2 className="h-6 w-6 animate-spin text-destructive"/><span className="ml-2 text-sm font-medium text-destructive">Đang xóa...</span></div>)}
            </CardContent>
        </Card>
    );
});
HandoverReportCard.displayName = 'HandoverReportCard';

export default HandoverReportCard;
