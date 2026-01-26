'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogAction, DialogCancel } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AttendanceRecord } from '@/lib/types';
import { toast } from '@/components/ui/pro-toast';
import { format, parseISO } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { FileEdit, Calendar, Banknote, AlertTriangle } from 'lucide-react';

export default function EditAttendanceDialog({
  isOpen,
  onClose,
  record,
  onSave,
  parentDialogTag,
}: {
  isOpen: boolean;
  onClose: () => void;
  record: AttendanceRecord | null;
  onSave: (id: string, data: { checkInTime: Date, checkOutTime?: Date, hourlyRate?: number }) => void;
  parentDialogTag: string;
}) {
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [hourlyRate, setHourlyRate] = useState<number | string>('');

  useEffect(() => {
    if (record) {
      if (record.checkInTime) {
        const checkInDate = (record.checkInTime as Timestamp).toDate();
        setCheckIn(format(checkInDate, "yyyy-MM-dd'T'HH:mm"));
      }

      if (record.checkOutTime) {
        const checkOutDate = (record.checkOutTime as Timestamp).toDate();
        setCheckOut(format(checkOutDate, "yyyy-MM-dd'T'HH:mm"));
      } else {
        setCheckOut('');
      }
      setHourlyRate(record.hourlyRate || '');
    }
  }, [record]);

  const handleSave = () => {
    if (!record) return;

    try {
      const checkInDate = parseISO(checkIn);
      const checkOutDate = checkOut ? parseISO(checkOut) : undefined;
      const rate = Number(hourlyRate);

      if (checkOutDate && checkOutDate < checkInDate) {
        toast.error('Giờ ra không thể sớm hơn giờ vào.');
        return;
      }

      onSave(record.id, { checkInTime: checkInDate, checkOutTime: checkOutDate, hourlyRate: rate });
      onClose();
    } catch (error) {
      toast.error('Định dạng ngày giờ không hợp lệ.');
    }
  };

  if (!record) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose} dialogTag="edit-attendance-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="max-w-md">
        <DialogHeader variant="premium" iconkey="layeditout" className="text-left">
          <div className="flex flex-col">
            <DialogTitle className="mb-0">Hiệu chỉnh công</DialogTitle>
            <DialogDescription className="text-zinc-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-2">Thay đổi mốc thời gian và mức lương</DialogDescription>
          </div>
        </DialogHeader>

        <DialogBody className="p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2.5">
              <Label htmlFor="check-in-time" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Giờ vào</Label>
              <div className="relative">
                <Input
                  id="check-in-time"
                  type="datetime-local"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="h-12 rounded-2xl bg-zinc-50 border-none font-bold text-xs pl-10 focus-visible:ring-emerald-500/20"
                />
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-300" />
              </div>
            </div>
            <div className="space-y-2.5">
              <Label htmlFor="check-out-time" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Giờ ra</Label>
              <div className="relative">
                <Input
                  id="check-out-time"
                  type="datetime-local"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="h-12 rounded-2xl bg-zinc-50 border-none font-bold text-xs pl-10 focus-visible:ring-emerald-500/20"
                />
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-300" />
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="hourly-rate" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Mức lương mỗi giờ (VNĐ)</Label>
            <div className="relative">
              <Input
                id="hourly-rate"
                type="number"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="Nhập mức lương..."
                className="h-12 rounded-2xl bg-zinc-50 border-none font-bold text-xs pl-10 focus-visible:ring-emerald-500/20"
              />
              <Banknote className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-300" />
            </div>
          </div>

          <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100/50 flex gap-3">
            <div className="shrink-0 w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <p className="text-[10px] font-bold text-rose-700 leading-relaxed italic">
              Việc thay đổi dữ liệu chấm công đã chốt sẽ ảnh hưởng trực tiếp đến kết quả tính toán lương tháng này. Hãy đảm bảo bạn có thẩm quyền để thực hiện.
            </p>
          </div>
        </DialogBody>

        <DialogFooter variant="muted" className="px-8 py-6">
          <DialogCancel onClick={onClose}>Hủy</DialogCancel>
          <DialogAction onClick={handleSave}>
            Lưu thay đổi
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}