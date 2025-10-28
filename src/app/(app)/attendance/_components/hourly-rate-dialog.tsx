
'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ManagedUser } from '@/lib/types';
import { toast } from 'react-hot-toast';

export default function HourlyRateDialog({
  isOpen,
  onClose,
  user,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  user: ManagedUser;
  onSave: (newRate: number) => void;
}) {
  const [rate, setRate] = useState(user.hourlyRate || 0);

  useEffect(() => {
    if (isOpen) {
      setRate(user.hourlyRate || 0);
    }
  }, [isOpen, user]);

  const handleSave = () => {
    if (rate <= 0) {
      toast.error('Mức lương phải lớn hơn 0.');
      return;
    }
    onSave(rate);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chỉnh sửa lương theo giờ</DialogTitle>
          <DialogDescription>
            Cập nhật mức lương cho nhân viên: <span className="font-semibold">{user.displayName}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="hourly-rate">Lương/giờ (VNĐ)</Label>
          <Input
            id="hourly-rate"
            type="number"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            placeholder="Nhập mức lương..."
            onFocus={(e) => e.target.select()}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={handleSave}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    