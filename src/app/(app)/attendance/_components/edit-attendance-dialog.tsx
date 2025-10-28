'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AttendanceRecord } from '@/lib/types';
import { toast } from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

export default function EditAttendanceDialog({
  isOpen,
  onClose,
  record,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  record: AttendanceRecord | null;
  onSave: (id: string, data: { checkInTime: Date, checkOutTime?: Date }) => void;
}) {
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');

  useEffect(() => {
    if (record) {
      const checkInDate = (record.checkInTime as Timestamp).toDate();
      setCheckIn(format(checkInDate, "yyyy-MM-dd'T'HH:mm"));

      if (record.checkOutTime) {
        const checkOutDate = (record.checkOutTime as Timestamp).toDate();
        setCheckOut(format(checkOutDate, "yyyy-MM-dd'T'HH:mm"));
      } else {
        setCheckOut('');
      }
    }
  }, [record]);

  const handleSave = () => {
    if (!record) return;

    try {
      const checkInDate = parseISO(checkIn);
      const checkOutDate = checkOut ? parseISO(checkOut) : undefined;

      if (checkOutDate && checkOutDate < checkInDate) {
        toast.error('Giờ ra không thể sớm hơn giờ vào.');
        return;
      }

      onSave(record.id, { checkInTime: checkInDate, checkOutTime: checkOutDate });
      onClose();
    } catch (error) {
      toast.error('Định dạng ngày giờ không hợp lệ.');
    }
  };

  if (!record) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chỉnh sửa Chấm công</DialogTitle>
          <DialogDescription>
            Điều chỉnh thời gian vào/ra cho bản ghi chấm công.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
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
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={handleSave}>Lưu thay đổi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}