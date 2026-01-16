'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/combobox';
import type { ManagedUser } from '@/lib/types';
import { toast } from '@/components/ui/pro-toast';
import { format, parseISO } from 'date-fns';

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chấm công thủ công</DialogTitle>
          <DialogDescription>
            Tạo một bản ghi chấm công mới cho nhân viên. Hành động này sẽ được ghi lại.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <Label htmlFor="employee-select">Nhân viên</Label>
            <Combobox
              value={selectedUserId}
              onChange={setSelectedUserId}
              placeholder="Chọn nhân viên..."
              options={users.map(user => ({
                value: user.uid,
                label: user.displayName
              }))}
            />
          </div>
          <div>
            <Label htmlFor="check-in-time">Giờ vào</Label>
            <Input
              id="check-in-time"
              type="datetime-local"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="check-out-time">Giờ ra</Label>
            <Input
              id="check-out-time"
              type="datetime-local"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Hủy</Button>
          <Button onClick={handleSave} disabled={isSaving}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}