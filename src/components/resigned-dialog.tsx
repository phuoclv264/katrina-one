'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogBody,
  DialogAction,
} from '@/components/ui/dialog';
import { AlertCircle, LogOut } from 'lucide-react';

type ResignedDialogProps = {
  isOpen: boolean;
  onLogout: () => void;
};

export const ResignedDialog = ({ isOpen, onLogout }: ResignedDialogProps) => {
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await onLogout();
    } finally {
      // The component will unmount as user becomes null in useAuth,
      // but we set this for stability during the transition.
      setIsLoggingOut(false);
    }
  };

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={() => {}} // Prevent manual closing
      dialogTag="resigned-dialog" 
      parentDialogTag="root"
    >
      <DialogContent hideClose>
        <DialogHeader variant="destructive" icon={<AlertCircle className="h-6 w-6" />} className="pb-10">
          <div className="flex flex-col gap-1">
            <DialogTitle>Tài khoản bị vô hiệu hóa</DialogTitle>
            <DialogDescription className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mt-1">
              Thông báo quan trọng
            </DialogDescription>
          </div>
        </DialogHeader>

        <DialogBody>
          <div className="py-6 text-center space-y-4">
            <div className="bg-red-50 p-4 rounded-2xl border border-red-100/50">
              <p className="text-sm font-medium text-red-900 leading-relaxed">
                Bạn đã <span className="font-bold underline text-red-600">Nghỉ việc</span>. 
                Bạn không còn quyền truy cập vào hệ thống này.
              </p>
            </div>
            <p className="text-xs text-zinc-500 px-4">
              Nếu bạn cho rằng đây là sai sót, hãy liên hệ với chủ quán.
            </p>
          </div>
        </DialogBody>

        <DialogFooter className="sm:justify-center">
          <DialogAction 
            onClick={handleLogout}
            isLoading={isLoggingOut}
            className="w-full h-14 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold flex items-center justify-center gap-2 group transition-all active:scale-95"
          >
            {!isLoggingOut && <LogOut className="h-5 w-5 group-hover:translate-x-1 transition-transform" />}
            {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất ngay'}
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
