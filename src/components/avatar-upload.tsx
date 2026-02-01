'use client';

import React, { useRef, useState } from 'react';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Camera, Loader2, Upload, X } from 'lucide-react';
import { uploadFile, deleteFileByUrl } from '@/lib/data-store-helpers';
import { getInitials } from '@/lib/utils';
import { toast } from '@/components/ui/pro-toast';

interface AvatarUploadProps {
  currentPhotoURL?: string | null;
  onUploadComplete: (url: string | null) => void;
  uid: string;
  displayName: string;
}

export function AvatarUpload({ currentPhotoURL, onUploadComplete, uid, displayName }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn tệp hình ảnh.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Kích thước ảnh không được vượt quá 2MB.');
      return;
    }

    try {
      setUploading(true);
      
      // Delete old photo if it exists
      if (currentPhotoURL) {
        await deleteFileByUrl(currentPhotoURL);
      }

      const path = `avatars/${uid}/${Date.now()}-${file.name}`;
      const url = await uploadFile(file, path);
      
      onUploadComplete(url);
      toast.success('Tải ảnh đại diện thành công.');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Lỗi khi tải ảnh lên. Vui lòng thử lại.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (!currentPhotoURL) return;
    
    try {
      setUploading(true);
      await deleteFileByUrl(currentPhotoURL);
      onUploadComplete(null);
      toast.success('Đã xóa ảnh đại diện.');
    } catch (error) {
      console.error('Error removing avatar:', error);
      toast.error('Lỗi khi xóa ảnh. Vui lòng thử lại.');
    } finally {
      setUploading(false);
    }
  };

  // use getInitials from utils

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative group">
        <UserAvatar
          avatarUrl={currentPhotoURL}
          nameOverride={displayName || 'U'}
          size="h-24 w-24"
          className="border-2 border-primary/20 shadow-sm"
          rounded="full"
          fallbackClassName="bg-primary/10 text-primary text-xl font-bold"
        />
        
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2"
        >
          <Upload className="h-4 w-4" />
          Tải ảnh lên
        </Button>
        
        {currentPhotoURL && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={uploading}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <X className="h-4 w-4" />
            Xóa
          </Button>
        )}
      </div>
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
    </div>
  );
}
