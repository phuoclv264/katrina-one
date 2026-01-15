
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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"

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
    if (pin.length === 4) {
      onSubmit(pin);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} dialogTag="pin-dialog" parentDialogTag="root">
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Xác thực nhân viên
          </DialogTitle>
          <DialogDescription>
            Vui lòng nhập mã PIN 4 số của bạn để bắt đầu ca làm việc.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col items-center justify-center gap-4">
            <InputOTP
              maxLength={4}
              value={pin}
              onChange={(value) => setPin(value)}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
              </InputOTPGroup>
            </InputOTP>
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit} disabled={pin.length < 4}>Đăng nhập</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
