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
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AvatarUpload } from '@/components/avatar-upload';
import { toast } from '@/components/ui/pro-toast';
import { Loader2, Save } from 'lucide-react';

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Hồ sơ cá nhân</DialogTitle>
          <DialogDescription>
            Cập nhật thông tin cá nhân của bạn tại đây.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-6 py-4">
          <AvatarUpload
            currentPhotoURL={photoURL}
            onUploadComplete={setPhotoURL}
            uid={user.uid}
            displayName={user.displayName || ''}
          />
          
          <div className="grid gap-2">
            <Label htmlFor="displayName">Tên hiển thị</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Nhập tên của bạn"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="email" className="text-muted-foreground">Email (Không thể thay đổi)</Label>
            <Input
              id="email"
              value={user.email || ''}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="grid gap-2">
            <Label className="text-muted-foreground">Vai trò</Label>
            <div className="px-3 py-2 border rounded-md bg-muted text-sm text-muted-foreground">
              {user.role}
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Hủy
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang lưu...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Lưu thay đổi
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
