'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogBody, DialogCancel } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/pro-toast';

export type PendingWorkItem = {
    category: 'monthly' | 'daily' | 'checklist';
    title: string;
    items: string[];
};

interface PendingWorkDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pendingWorkItems: PendingWorkItem[];
    loading: boolean;
    onProceed: () => void;
}

export default function PendingWorkDialog({
    open,
    onOpenChange,
    pendingWorkItems,
    loading,
    onProceed,
}: PendingWorkDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange} dialogTag="pending-work-dialog" parentDialogTag="root">
            <DialogContent className="max-w-lg">
                <DialogHeader variant="premium" iconkey="tasks">
                    <div>
                        <DialogTitle>Còn đầu việc chưa xong</DialogTitle>
                        <DialogDescription>Kiểm tra nhanh các công việc trước khi chấm công ra.</DialogDescription>
                    </div>
                </DialogHeader>
                <DialogBody>
                    {loading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Đang kiểm tra công việc...</span>
                        </div>
                    ) : pendingWorkItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Không tìm thấy đầu việc nào còn lại.</p>
                    ) : (
                        <div className="space-y-3">
                            {pendingWorkItems.map((block, idx) => (
                                <div key={`${block.category}-${idx}`} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-muted/30">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{block.title}</p>
                                        <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest">
                                            {block.items.length}
                                        </Badge>
                                    </div>
                                    <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                                        {block.items.map((item, itemIdx) => (
                                            <li key={`${block.category}-${idx}-${itemIdx}`}>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )}
                </DialogBody>
                <DialogFooter>
                    <DialogCancel className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>Để sau</DialogCancel>
                    <Button className="w-full sm:w-auto" disabled={loading} onClick={() => { onOpenChange(false); onProceed(); }}>
                        Tiếp tục chấm công ra
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
