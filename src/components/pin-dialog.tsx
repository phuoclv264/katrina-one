
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
  DialogBody,
  DialogAction,
  DialogCancel,
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
  parentDialogTag: string;
};

export default function PinDialog({ isOpen, onClose, onSubmit, parentDialogTag }: Props) {
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
    <Dialog open={isOpen} onOpenChange={onClose} dialogTag="pin-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent>
        <DialogHeader variant="premium" iconkey="lock" className="pb-10 text-left">
          <div className="flex items-center gap-4 relative z-10">
            <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-2xl">
              <KeyRound className="h-6 w-6 text-zinc-400" />
            </div>
            <div>
              <DialogTitle className="mb-1">
                Xác thực nhân viên
              </DialogTitle>
              <DialogDescription className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em]">
                Vui lòng nhập mã PIN 4 số của bạn
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody>
          <div className="flex flex-col items-center justify-center py-6">
            <InputOTP
              maxLength={4}
              value={pin}
              onChange={(value) => setPin(value)}
            >
              <InputOTPGroup className="gap-2">
                <InputOTPSlot index={0} className="w-14 h-16 rounded-2xl border-2 text-2xl font-black border-zinc-100 bg-zinc-50 focus:ring-zinc-900" />
                <InputOTPSlot index={1} className="w-14 h-16 rounded-2xl border-2 text-2xl font-black border-zinc-100 bg-zinc-50 focus:ring-zinc-900" />
                <InputOTPSlot index={2} className="w-14 h-16 rounded-2xl border-2 text-2xl font-black border-zinc-100 bg-zinc-50 focus:ring-zinc-900" />
                <InputOTPSlot index={3} className="w-14 h-16 rounded-2xl border-2 text-2xl font-black border-zinc-100 bg-zinc-50 focus:ring-zinc-900" />
              </InputOTPGroup>
            </InputOTP>
          </div>
        </DialogBody>

        <DialogFooter>
          <DialogCancel onClick={onClose}>Hủy</DialogCancel>
          <DialogAction onClick={handleSubmit} disabled={pin.length < 4}>
            Đăng nhập
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
