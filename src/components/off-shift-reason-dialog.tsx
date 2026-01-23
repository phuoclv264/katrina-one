'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Clock, Info } from 'lucide-react';

interface OffShiftReasonDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    value: string;
    onValueChange: (value: string) => void;
    onCancel: () => void;
    onSubmit: () => void;
    parentDialogTag?: string;
}

export default function OffShiftReasonDialog({
    open,
    onOpenChange,
    value,
    onValueChange,
    onCancel,
    onSubmit,
    parentDialogTag = 'root'
}: OffShiftReasonDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange} dialogTag="off-shift-reason-dialog" parentDialogTag={parentDialogTag}>
            <DialogContent className="max-w-md p-0 overflow-hidden border-none">
                <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-6 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
                    <div className="absolute bottom-0 left-0 -mb-6 -ml-6 w-32 h-32 bg-black/10 rounded-full blur-3xl"></div>
                    
                    <div className="relative flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
                            <Clock className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold text-white">Chấm công ngoài giờ</DialogTitle>
                            <DialogDescription className="text-amber-100 text-sm mt-1">
                                Bạn đang chấm công ngoài ca làm được phân công.
                            </DialogDescription>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-1">
                            <Info className="h-4 w-4" />
                            <span className="text-xs font-semibold uppercase tracking-wider">Lý do chấm công</span>
                        </div>
                        <Textarea
                            placeholder="Ví dụ: Làm thay bạn A, Tăng ca đột xuất, Quên chấm công ca trước..."
                            value={value}
                            onChange={(e) => onValueChange(e.target.value)}
                            className="min-h-[120px] resize-none bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:ring-amber-500 focus:border-amber-500 rounded-xl"
                        />
                        <p className="text-[10px] text-zinc-400 text-right italic">
                            * Vui lòng cung cấp lý do chi tiết để Quản lý dễ dàng đối soát.
                        </p>
                    </div>
                </div>

                <DialogFooter className="p-4 sm:p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex flex-row gap-3">
                    <Button 
                        variant="outline" 
                        onClick={onCancel}
                        className="flex-1 rounded-xl h-11 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium"
                    >
                        Hủy bỏ
                    </Button>
                    <Button 
                        onClick={onSubmit}
                        className="flex-1 rounded-xl h-11 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/20 font-bold"
                    >
                        Tiếp tục
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
