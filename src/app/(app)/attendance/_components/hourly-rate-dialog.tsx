
'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogAction, DialogCancel } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AttendanceRecord } from '@/lib/types';
import { toast } from '@/components/ui/pro-toast';
import { Banknote, CheckCircle2 } from 'lucide-react';

export default function HourlyRateDialog({
  isOpen,
  onClose,
  record,
  onSave,
  parentDialogTag,
}: {
  isOpen: boolean;
  onClose: () => void;
  record: AttendanceRecord;
  onSave: (recordId: string, newRate: number) => void;
  parentDialogTag: string;
}) {
  const [rate, setRate] = useState(record.hourlyRate || 0);

  useEffect(() => {
    if (isOpen) {
      setRate(record.hourlyRate || 0);
    }
  }, [isOpen, record]);

  const handleSave = () => {
    if (rate <= 0) {
      toast.error('Mức lương phải lớn hơn 0.');
      return;
    }
    onSave(record.id, rate);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} dialogTag="hourly-rate-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="max-w-sm">
        <DialogHeader variant="premium" icon={<Banknote className="w-6 h-6" />} className="text-left">
          <DialogTitle >Mức lương ca</DialogTitle>
          <DialogDescription className="font-bold text-[10px] uppercase tracking-[0.2em]">Cập nhật đơn giá mỗi giờ làm</DialogDescription>
        </DialogHeader>

        <DialogBody className="p-8 space-y-6">
          <div className="space-y-2.5">
            <Label htmlFor="hourly-rate" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Lương/giờ (VNĐ)</Label>
            <div className="relative">
              <Input
                id="hourly-rate"
                type="number"
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                placeholder="Nhập mức lương..."
                onFocus={(e) => e.target.select()}
                className="h-12 rounded-2xl bg-zinc-50 border-none font-bold text-lg pl-10 focus-visible:ring-emerald-500/20"
              />
              <Banknote className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            </div>
          </div>

          <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100/50 flex gap-3">
            <div className="shrink-0 w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-[10px] font-bold text-emerald-700 leading-relaxed italic">
              Hệ thống sẽ tự động cập nhật lại tổng lương cho ca làm việc này ngay sau khi bạn nhấn lưu.
            </p>
          </div>
        </DialogBody>

        <DialogFooter variant="muted">
          <DialogCancel onClick={onClose}>Hủy</DialogCancel>
          <DialogAction onClick={handleSave}>
            Cập nhật
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

