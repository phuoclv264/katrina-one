
'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { IncidentReport } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';


type IncidentReportDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: Omit<IncidentReport, 'id' | 'date' | 'createdAt' | 'createdBy'>) => void;
    isProcessing: boolean;
};

export default function IncidentReportDialog({
    open,
    onOpenChange,
    onSave,
    isProcessing,
}: IncidentReportDialogProps) {
    const [content, setContent] = useState('');
    const [cost, setCost] = useState(0);

    useEffect(() => {
        if (open) {
            setContent('');
            setCost(0);
        }
    }, [open]);

    const handleSave = () => {
        if (!content) {
            toast.error('Vui lòng nhập nội dung sự cố.');
            return;
        }

        onSave({ content, cost });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Tạo Báo cáo Sự cố</DialogTitle>
                    <DialogDescription>Ghi nhận sự cố phát sinh trong ca làm việc.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="content">Nội dung sự cố</Label>
                        <Textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} placeholder="VD: Làm vỡ ly thuỷ tinh Ocean..." />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="cost">Chi phí phát sinh (nếu có)</Label>
                        <Input id="cost" type="number" value={cost} onChange={e => setCost(Number(e.target.value))} placeholder="0" />
                        <p className="text-xs text-muted-foreground">
                            Nếu có chi phí, một phiếu chi tương ứng sẽ được tạo tự động.
                        </p>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
                    <Button onClick={handleSave} disabled={isProcessing}>
                        {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Lưu Báo cáo
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
