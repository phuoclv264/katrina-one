
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound } from 'lucide-react';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (pin: string) => void;
};

export default function PinDialog({ isOpen, onClose, onSubmit }: Props) {
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (!isOpen) {
      // Reset PIN when dialog is closed
      setPin('');
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (pin.trim()) {
      onSubmit(pin.trim());
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Xác thực nhân viên
          </DialogTitle>
          <DialogDescription>
            Vui lòng nhập mã PIN của bạn để bắt đầu ca làm việc.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="pin" className="text-right">
              Mã PIN
            </Label>
            <Input
              id="pin"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="col-span-3"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              pattern="\d*"
              maxLength={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit}>Đăng nhập</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
