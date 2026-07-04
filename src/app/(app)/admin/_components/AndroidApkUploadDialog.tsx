'use client';

import React, { useEffect, useState } from 'react';
import { dataStore } from '@/lib/data-store';
import { uploadFile } from '@/lib/data-store-helpers';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogBody, DialogAction, DialogCancel } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/pro-toast';
import { CloudUpload, FileDown, Loader2 } from 'lucide-react';
import type { AppSettings } from '@/lib/types';

interface AndroidApkUploadDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  parentDialogTag: string;
}

export function AndroidApkUploadDialog({ isOpen, onOpenChange, parentDialogTag }: AndroidApkUploadDialogProps) {
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let unsub = () => {};
    try {
      unsub = dataStore.subscribeToAppSettings((settings) => {
        setAppSettings(settings);
      });
    } catch (error) {
      console.error('Error subscribing to app settings:', error);
    }

    return () => {
      try {
        unsub();
      } catch {
        // ignore
      }
    };
  }, [isOpen]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!file.name.toLowerCase().endsWith('.apk')) {
      toast.error('Vui lòng chọn file APK hợp lệ.');
      event.target.value = '';
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Vui lòng chọn file APK trước khi tải lên.');
      return;
    }

    try {
      setUploading(true);
      const path = `apks/${Date.now()}-${selectedFile.name}`;
      const url = await uploadFile(selectedFile, path);
      await dataStore.updateAppSettings({ androidApkUrl: url });
      toast.success('APK đã được tải lên và cập nhật thành công.');
      setSelectedFile(null);
    } catch (error) {
      console.error('Failed to upload APK:', error);
      toast.error('Lỗi khi tải lên file APK. Vui lòng thử lại.');
    } finally {
      setUploading(false);
    }
  };

  const currentUrl = appSettings?.androidApkUrl ?? null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange} dialogTag="android-apk-upload-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent>
        <DialogHeader variant="premium" icon={<CloudUpload />} className="pb-10 text-left">
          <div>
            <DialogTitle>Quản lý APK Android</DialogTitle>
            <DialogDescription className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em]">
              Tải lên file APK mới để nhân viên Android có thể tải về trực tiếp từ ứng dụng.
            </DialogDescription>
          </div>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-6 pt-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apkUpload" className="text-[10px] font-black uppercase tracking-wider text-zinc-500 ml-1">File APK</Label>
                <Input
                  id="apkUpload"
                  type="file"
                  accept=".apk"
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="h-14 rounded-2xl border-zinc-100 bg-white px-4 shadow-sm"
                />
                <p className="text-xs text-muted-foreground">Chỉ chấp nhận file .apk. Dung lượng tối đa phụ thuộc vào cấu hình Firebase Storage.</p>
              </div>

              {currentUrl && (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">APK hiện tại</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 break-all">{currentUrl}</p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      asChild
                    >
                      <a href={currentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
                        <FileDown className="w-4 h-4" /> Mở liên kết
                      </a>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <DialogCancel onClick={() => onOpenChange(false)}>Đóng</DialogCancel>
          <DialogAction onClick={handleUpload} isLoading={uploading} disabled={uploading || !selectedFile}>
            {selectedFile ? 'Tải lên APK' : 'Chọn file APK'}
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
