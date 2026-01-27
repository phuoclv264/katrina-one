'use client';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogBody,
    DialogAction,
    DialogCancel,
} from '@/components/ui/dialog';
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
            <DialogContent>
                <DialogHeader variant="premium" iconkey="clock">
                    <div className="flex items-center gap-4">
                        <div>
                            <DialogTitle className="mb-1">
                                Chấm công ngoài giờ
                            </DialogTitle>
                            <DialogDescription className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em]">
                                Bạn đang chấm công ngoài ca làm việc
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <DialogBody>
                    <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-zinc-500 mb-1 ml-1">
                                <Info className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase tracking-wider">Lý do chấm công</span>
                            </div>
                            <Textarea
                                placeholder="Ví dụ: Làm thay bạn Thiện, Tăng ca đột xuất,..."
                                value={value}
                                onChange={(e) => onValueChange(e.target.value)}
                                className="min-h-[160px] rounded-2xl border-zinc-200 bg-white p-4 text-base focus-visible:ring-primary transition-all resize-none shadow-sm"
                            />
                            <p className="text-[10px] text-muted-foreground text-right italic mr-1">
                                * Vui lòng cung cấp lý do chi tiết để Quản lý dễ dàng đối soát.
                            </p>
                        </div>
                    </div>
                </DialogBody>

                <DialogFooter>
                    <DialogCancel onClick={onCancel}>Hủy bỏ</DialogCancel>
                    <DialogAction onClick={onSubmit}>Tiếp tục</DialogAction>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
