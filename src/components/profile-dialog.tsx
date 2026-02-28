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
import { toast } from '@/components/ui/pro-toast';
import { Loader2, Save, User, CreditCard } from 'lucide-react';
import { Combobox } from '@/components/combobox';
import { VIETQR_BANKS } from '@/lib/vietqr-banks';
import { Badge } from '@/components/ui/badge';
import { Trophy, Zap, Heart, Star, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentDialogTag: string;
}

export function ProfileDialog({ open, onOpenChange, parentDialogTag }: ProfileDialogProps) {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [bankId, setBankId] = useState<string>('');
  const [bankAccountNumber, setBankAccountNumber] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && user) {
      setDisplayName(user.displayName || '');
      setPhotoURL(user.photoURL || null);
      setBankId(user.bankId || '');
      setBankAccountNumber(user.bankAccountNumber || '');
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
        bankId: bankId || null,
        bankAccountNumber: bankAccountNumber || null,
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

  const bankOptions = VIETQR_BANKS.map(bank => ({
    value: bank.bin, // Store BIN as the ID
    label: `${bank.shortName} - ${bank.name}`,
  }));

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
              <AvatarUpload
                currentPhotoURL={photoURL}
                onUploadComplete={setPhotoURL}
                uid={user.uid}
                displayName={displayName}
              />
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

              {user.badges && user.badges.length > 0 && (
                <div className="space-y-3 pt-2">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 ml-1">Huy hiệu</Label>
                  <div className="flex flex-wrap gap-2">
                    {user.badges.map((badge) => (
                      <Badge 
                        key={badge.id} 
                        variant="secondary" 
                        className={cn(
                          "h-10 px-3 rounded-xl text-white border-none flex items-center gap-2 transition-all",
                          badge.color ? `${badge.color} hover:brightness-110` : "bg-primary hover:bg-primary/90"
                        )}
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span className="font-bold text-[11px]">{badge.label}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-zinc-100">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="w-4 h-4 text-zinc-400" />
                  <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">Thông tin thanh toán</span>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 ml-1">Ngân hàng thụ hưởng</Label>
                    <Combobox
                      options={bankOptions}
                      value={bankId}
                      onChange={(val) => setBankId(val as string)}
                      placeholder="Chọn ngân hàng"
                      searchPlaceholder="Tìm kiếm..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bankAccountNumber" className="text-[10px] font-black uppercase tracking-wider text-zinc-500 ml-1">Số tài khoản</Label>
                    <Input
                      id="bankAccountNumber"
                      value={bankAccountNumber}
                      onChange={(e) => setBankAccountNumber(e.target.value)}
                      placeholder="Nhập số tài khoản"
                      className="h-14 rounded-2xl border-zinc-100 bg-white font-bold px-4 shadow-sm"
                    />
                  </div>
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
