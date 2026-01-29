'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { dataStore } from '@/lib/data-store';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AvatarUpload } from '@/components/avatar-upload';
import { UserAvatar } from '@/components/user-avatar';
import { toast } from '@/components/ui/pro-toast';
import { Loader2, Save, User } from 'lucide-react';

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentDialogTag: string;
}

export function ProfileDialog({ open, onOpenChange, parentDialogTag }: ProfileDialogProps) {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && user) {
      setDisplayName(user.displayName || '');
      setPhotoURL(user.photoURL || null);
    }
  }, [open, user]);

  if (!user) return null;

  const handleSave = async () => {
    if (!displayName.trim()) {
      toast.error('Vui lòng nhập tên hiển thị.');
      return;
    }

    try {
      setSaving(true);
      await dataStore.updateUserData(user.uid, {
        displayName,
        photoURL: photoURL || null,
      });
      toast.success('Đã cập nhật hồ sơ.');
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Lỗi khi cập nhật hồ sơ.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} dialogTag="profile-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent>
        <DialogHeader variant="premium" icon={<User />} className="pb-10 text-left">
          <div>
            <DialogTitle className="mb-1">Hồ sơ cá nhân</DialogTitle>
            <DialogDescription className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em]">Cập nhật thông tin cá nhân của bạn</DialogDescription>
          </div>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-6 pt-2">
            <div className="flex justify-center py-4">
              <UserAvatar user={user} className="h-24 w-24" />
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName" className="text-[10px] font-black uppercase tracking-wider text-zinc-500 ml-1">Tên hiển thị</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  disabled
                  readOnly
                  className="h-14 rounded-2xl border-zinc-100 bg-zinc-50 font-bold px-4 cursor-not-allowed opacity-75 shadow-sm"
                />
                <p className="text-[10px] text-zinc-400 italic ml-1">* Vui lòng liên hệ quản lý để thay đổi tên hiển thị.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-wider text-zinc-500 ml-1">Email / Tài khoản</Label>
                <Input
                  id="email"
                  value={user.email || ''}
                  disabled
                  readOnly
                  className="h-14 rounded-2xl border-zinc-100 bg-zinc-50 font-bold px-4 cursor-not-allowed opacity-75 shadow-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 ml-1">Vai trò hệ thống</Label>
                <div className="h-14 flex items-center px-4 rounded-2xl bg-zinc-50 border border-zinc-100 text-sm font-black uppercase tracking-wider text-zinc-600 shadow-sm">
                  {user.role}
                </div>
              </div>
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <DialogCancel onClick={() => onOpenChange(false)}>Đóng</DialogCancel>
          <DialogAction onClick={handleSave} isLoading={saving} disabled={saving}>
            Lưu thay đổi
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
