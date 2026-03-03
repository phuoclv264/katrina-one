'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogBody, DialogCancel } from '@/components/ui/dialog';
import { Loader2, AlertTriangle, Calendar, ClipboardCheck, Star, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export type PendingWorkItem = {
    category: 'monthly' | 'daily' | 'checklist';
    title: string;
    items: string[];
    isStared?: boolean;
};

interface PendingWorkDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pendingWorkItems: PendingWorkItem[];
    loading: boolean;
    onProceed: (violate: boolean) => void;
}

export default function PendingWorkDialog({
    open,
    onOpenChange,
    pendingWorkItems,
    loading,
    onProceed,
}: PendingWorkDialogProps) {
    const hasHighPriority = pendingWorkItems.some(item => 
        item.category === 'monthly' || 
        item.category === 'daily' || 
        item.isStared
    );

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'monthly': return <Calendar className="h-4 w-4" />;
            case 'daily': return <ClipboardCheck className="h-4 w-4" />;
            default: return <AlertTriangle className="h-4 w-4" />;
        }
    };

    const getCategoryStyles = (category: string, isStared?: boolean) => {
        if (isStared) return "border-amber-200 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-900/10";
        switch (category) {
            case 'monthly': return "border-purple-200 bg-purple-50/50 dark:border-purple-900/30 dark:bg-purple-900/10";
            case 'daily': return "border-blue-200 bg-blue-50/50 dark:border-blue-900/30 dark:bg-blue-900/10";
            default: return "border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-muted/30";
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange} dialogTag="pending-work-dialog" parentDialogTag="root">
            <DialogContent className="max-w-lg">
                <DialogHeader variant="premium" iconkey="tasks">
                    <div>
                        <DialogTitle>Còn đầu việc chưa xong</DialogTitle>
                        <DialogDescription>Kiểm tra nhanh các công việc trước khi chấm công ra.</DialogDescription>
                    </div>
                </DialogHeader>

                <DialogBody className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <div className="relative">
                                <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                                <Loader2 className="absolute inset-0 m-auto h-5 w-5 text-primary animate-pulse" />
                            </div>
                            <span className="text-sm font-bold text-muted-foreground animate-pulse">Đang kiểm kê nhiệm vụ...</span>
                        </div>
                    ) : pendingWorkItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                            <div className="h-16 w-16 rounded-full bg-green-50 flex items-center justify-center text-green-500">
                                <ClipboardCheck className="h-8 w-8" />
                            </div>
                            <p className="text-sm font-bold text-slate-600">Tuyệt vời! Bạn đã hoàn thành tất cả công việc.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {hasHighPriority && (
                                <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-100 dark:bg-red-950/20 dark:border-red-900/30">
                                    <ShieldAlert className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                                    <div className="space-y-1">
                                        <p className="text-xs font-black uppercase tracking-wider text-red-700">Cảnh báo nghiêm trọng</p>
                                        <p className="text-xs font-medium text-red-600/80 leading-relaxed">
                                            Việc bỏ qua các nhiệm vụ <span className="font-bold underline">bên dưới</span> sẽ dẫn đến vi phạm "Không hoàn thành nhiệm vụ" được tạo tự động. Nếu thực hiện qua loa để né vi phạm có thể sẽ bị phạt gấp đôi. Ghi nhận có thể sai sót, liên hệ chủ quán để giải trình.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                {pendingWorkItems.map((block, idx) => (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        key={`${block.category}-${idx}`} 
                                        className={cn(
                                            "relative overflow-hidden rounded-2xl border p-4 transition-all",
                                            getCategoryStyles(block.category, block.isStared)
                                        )}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className={cn(
                                                    "p-1.5 rounded-lg",
                                                    block.category === 'monthly' ? "bg-purple-100 text-purple-600" :
                                                    block.category === 'daily' ? "bg-blue-100 text-blue-600" :
                                                    block.isStared ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-600"
                                                )}>
                                                    {block.isStared ? <Star className="h-3.5 w-3.5 fill-current" /> : getCategoryIcon(block.category)}
                                                </div>
                                                <p className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">{block.title}</p>
                                            </div>
                                            <Badge variant="secondary" className="bg-white/50 dark:bg-black/20 text-[10px] font-black pointer-events-none">
                                                {block.items.length} VIỆC
                                            </Badge>
                                        </div>
                                        <ul className="space-y-2">
                                            {block.items.map((item, itemIdx) => {
                                                const isCritical = item.startsWith('_CRITICAL_');
                                                const displayItem = isCritical ? item.replace('_CRITICAL_', '') : item;
                                                
                                                return (
                                                    <li key={itemIdx} className={cn(
                                                        "flex items-start gap-2 text-[13px] font-medium leading-tight",
                                                        isCritical ? "text-amber-600 dark:text-amber-400" : "text-slate-600 dark:text-slate-400"
                                                    )}>
                                                        <div className={cn(
                                                            "mt-1.5 h-1.5 w-1.5 rounded-full shrink-0",
                                                            isCritical ? "bg-amber-400 animate-pulse" : "bg-slate-300"
                                                        )} />
                                                        {displayItem}
                                                        {isCritical && <Star className="h-3 w-3 inline ml-1 fill-current" />}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    )}
                </DialogBody>

                <DialogFooter className="flex flex-col sm:flex-row gap-2 p-6 bg-slate-50 dark:bg-slate-900/50 border-t">
                    <DialogCancel className="w-full sm:flex-1 h-11 rounded-xl font-bold border-slate-200" onClick={() => onOpenChange(false)}>
                        Quay lại làm tiếp
                    </DialogCancel>
                    <Button 
                        className={cn(
                            "w-full sm:flex-1 h-11 rounded-xl font-black uppercase tracking-wider text-xs shadow-lg transition-all active:scale-95",
                            hasHighPriority ? "bg-red-600 hover:bg-red-700 shadow-red-200" : "bg-primary shadow-primary/20"
                        )}
                        disabled={loading} 
                        onClick={() => { 
                            onOpenChange(false); 
                            onProceed(hasHighPriority); 
                        }}
                    >
                        {hasHighPriority ? 'Chấp nhận vi phạm' : 'Vẫn muốn Checkout'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
