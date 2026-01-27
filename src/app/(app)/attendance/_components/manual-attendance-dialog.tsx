'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogAction, DialogCancel } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/combobox';
import type { ManagedUser } from '@/lib/types';
import { toast } from '@/components/ui/pro-toast';
import { format, parseISO } from 'date-fns';
import { UserPlus, Loader2, Calendar, CheckCircle2, FileWarning, FileWarningIcon, MessageCircleWarning } from 'lucide-react';

export default function ManualAttendanceDialog({
  isOpen,
  onClose,
  users,
  onSave,
  parentDialogTag,
}: {
  isOpen: boolean;
  onClose: () => void;
  users: ManagedUser[];
  onSave: (data: {
    userId: string;
    checkInTime: Date;
    checkOutTime: Date;
  }) => Promise<void>;
  parentDialogTag: string;
}) {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Reset state when dialog opens
      setSelectedUserId('');
      const now = new Date();
      setCheckIn(format(now, "yyyy-MM-dd'T'HH:mm"));
      setCheckOut(format(now, "yyyy-MM-dd'T'HH:mm"));
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!selectedUserId) {
      toast.error('Vui lòng chọn một nhân viên.');
      return;
    }
    if (!checkIn || !checkOut) {
      toast.error('Vui lòng nhập đầy đủ giờ vào và giờ ra.');
      return;
    }

    try {
      const checkInDate = parseISO(checkIn);
      const checkOutDate = parseISO(checkOut);

      if (checkOutDate < checkInDate) {
        toast.error('Giờ ra không thể sớm hơn giờ vào.');
        return;
      }

      setIsSaving(true);
      await onSave({
        userId: selectedUserId,
        checkInTime: checkInDate,
        checkOutTime: checkOutDate,
      });
      onClose();
    } catch (error) {
      toast.error('Định dạng ngày giờ không hợp lệ.');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} dialogTag="manual-attendance-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="max-w-md">
        <DialogHeader variant="premium" icon={<UserPlus className="w-6 h-6" />} className="text-left">
          <div className="flex flex-col">
            <DialogTitle className="mb-0">Chấm công bổ sung</DialogTitle>
            <DialogDescription className="text-zinc-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-2">Ghi nhận dữ liệu chấm công thủ công</DialogDescription>
          </div>
        </DialogHeader>

        <DialogBody className="p-8 space-y-6">
          <div className="space-y-2.5">
            <Label htmlFor="employee-select" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Nhân viên thực hiện</Label>
            <Combobox
              value={selectedUserId}
              onChange={setSelectedUserId}
              placeholder="Chọn nhân viên..."
              searchPlaceholder="Tìm tên..."
              options={users.map(user => ({
                value: user.uid,
                label: user.displayName
              }))}
              className="w-full h-12 rounded-2xl bg-zinc-50 border-none font-bold text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2.5">
              <Label htmlFor="check-in-time" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Giờ vào ca</Label>
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
              <Label htmlFor="check-out-time" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Giờ ra ca</Label>
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

          <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100/50 flex gap-3">
            <div className="shrink-0 w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <MessageCircleWarning className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-[10px] font-bold text-amber-700 leading-relaxed italic">
              Dữ liệu chấm công thủ công sẽ được hệ thống tính toán lương dựa trên cấu hình hiện tại của nhân viên. Hãy kiểm tra kỹ mốc thời gian trước khi lưu.
            </p>
          </div>
        </DialogBody>

        <DialogFooter variant="muted" className="px-8 py-6">
          <DialogCancel onClick={onClose} disabled={isSaving}>Hủy</DialogCancel>
          <DialogAction
            onClick={handleSave}
            disabled={isSaving}
            isLoading={isSaving}
          >
            Lưu bản ghi
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}