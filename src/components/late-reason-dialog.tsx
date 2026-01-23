'use client';

import React from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import Image from '@/components/ui/image';
import { CheckCircle, Camera, Upload, X, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
import type { Slide } from 'yet-another-react-lightbox';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lateReason: string;
  setLateReason: (v: string) => void;
  estimatedLateMinutes: number | string;
  setEstimatedLateMinutes: (v: number | string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  lateReasonPhotoId: string | null;
  lateReasonPhotoUrl: string | null;
  lateReasonMediaType: 'photo' | 'video' | null;
  /** If provided, will be called with slides and index when the Eye button is clicked. */
  onOpenLightbox?: (slides: Slide[], index?: number) => void;
  onPickFromCamera: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveMedia: () => void;
  onSubmit: () => Promise<void> | void;
  isProcessing: boolean;
  parentDialogTag?: string;
};

export default function LateReasonDialog({
  open,
  onOpenChange,
  lateReason,
  setLateReason,
  estimatedLateMinutes,
  setEstimatedLateMinutes,
  fileInputRef,
  lateReasonPhotoId,
  lateReasonPhotoUrl,
  lateReasonMediaType,
  onOpenLightbox,
  onPickFromCamera,
  onFileSelect,
  onRemoveMedia,
  onSubmit,
  isProcessing,
  parentDialogTag = 'root',
}: Props) {
  const [showMediaError, setShowMediaError] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} dialogTag="late-reason-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl">
        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-6 text-white text-center space-y-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-24 h-24 bg-indigo-400/20 rounded-full blur-xl" />

          <div className="relative inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md mb-2">
            <Camera className="h-6 w-6 text-white" />
          </div>
          <DialogTitle className="text-2xl font-bold tracking-tight text-white mb-1">Báo Cáo Đi Trễ</DialogTitle>
          <DialogDescription className="text-indigo-100 font-medium">Vui lòng cho biết lý do và thời gian bạn dự kiến đến trễ.</DialogDescription>
        </div>

        <div className="p-6 space-y-6 bg-white dark:bg-zinc-900">
          <div className="space-y-4">
            <div className="space-y-2.5">
              <Label className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">Lý do đi trễ</Label>
              <div className="relative group">
                <Input
                  placeholder="Ví dụ: Kẹt xe, hỏng xe, việc gia đình..."
                  className="pl-4 h-12 rounded-xl border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-zinc-50/50 dark:bg-zinc-800/50"
                  value={lateReason}
                  onChange={(e) => setLateReason(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <Label className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">Số phút trễ dự kiến</Label>
              <div className="relative group">
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-zinc-400">phút</span>
                <Input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="0"
                  className="pl-4 pr-16 h-12 rounded-xl border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-zinc-50/50 dark:bg-zinc-800/50"
                  value={String(estimatedLateMinutes)}
                  onChange={(e) => setEstimatedLateMinutes(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <Label className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">Hình ảnh minh chứng <span className="text-rose-600">(bắt buộc)</span></Label>

              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,video/*"
                onChange={(e) => {
                  onFileSelect(e);
                  setShowMediaError(false);
                }}
                aria-describedby="late-reason-media-hint"
              />

              {lateReasonPhotoId ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-green-50/50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 group transition-all hover:bg-green-50 dark:hover:bg-green-900/20">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-green-100 dark:bg-green-900/20 text-green-600 shadow-sm border border-green-200/50 dark:border-green-800/50">
                        <CheckCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Đã kèm minh chứng</p>
                        <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 capitalize">{lateReasonMediaType === 'video' ? 'Video' : 'Hình ảnh'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-xl text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
                        onClick={() => {
                          if (typeof onOpenLightbox === 'function' && lateReasonPhotoUrl) {
                            if (lateReasonMediaType === 'video') {
                              const slide: Slide = { type: 'video', sources: [{ src: lateReasonPhotoUrl, type: 'video/mp4' }] } as Slide;
                              onOpenLightbox([slide], 0);
                              return;
                            }

                            const slide: Slide = { src: lateReasonPhotoUrl } as Slide;
                            onOpenLightbox([slide], 0);
                          }
                        }}
                        title={lateReasonPhotoUrl ? 'Xem minh chứng (toàn màn hình)' : 'Chưa có minh chứng'}
                        aria-label="Xem minh chứng"
                        disabled={!lateReasonPhotoUrl}
                      >
                        <Eye className="h-5 w-5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-xl text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                        onClick={() => {
                          onRemoveMedia();
                          setShowMediaError(false);
                        }}
                        title="Xóa tệp"
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      onPickFromCamera();
                      setShowMediaError(false);
                    }}
                    className="h-24 rounded-2xl border-dashed border-2 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/50 dark:hover:bg-zinc-800 text-zinc-500 flex flex-col items-center justify-center gap-2 transition-all"
                  >
                    <div className="w-10 h-10 rounded-full bg-white dark:bg-zinc-900 shadow-sm flex items-center justify-center">
                      <Camera className="h-5 w-5 text-indigo-600" />
                    </div>
                    <span className="text-sm font-medium">Chụp ảnh/Video</span>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowMediaError(false);
                      fileInputRef.current?.click();
                    }}
                    className="h-24 rounded-2xl border-dashed border-2 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/50 dark:hover:bg-zinc-800 text-zinc-500 flex flex-col items-center justify-center gap-2 transition-all"
                  >
                    <div className="w-10 h-10 rounded-full bg-white dark:bg-zinc-900 shadow-sm flex items-center justify-center">
                      <Upload className="h-5 w-5 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium">Tải lên</span>
                  </Button>
                </div>
              )}

              <p
                id="late-reason-media-hint"
                className={`text-sm mt-2 ${showMediaError ? 'text-rose-600' : 'text-zinc-500 dark:text-zinc-400'}`}
                aria-live="polite"
              >
                {showMediaError ? 'Bạn phải đính kèm hình ảnh hoặc video làm bằng chứng.' : 'Vui lòng đính kèm hình ảnh hoặc video làm bằng chứng (bắt buộc).'}
              </p>
            </div> 
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button variant="outline" className="flex-1 h-12 rounded-xl font-semibold border-zinc-200 dark:border-zinc-800" onClick={() => onOpenChange(false)}>
              Đóng
            </Button>

            <Button
              className="flex-[2] h-12 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/40 transition-all hover:-translate-y-0.5"
              onClick={async () => {
                if (!lateReasonPhotoId && !lateReasonPhotoUrl) {
                  setShowMediaError(true);
                  // focus the hidden file input to surface the file picker for keyboard users
                  fileInputRef.current?.focus();
                  return;
                }
                setShowMediaError(false);
                await onSubmit();
              }}
              disabled={!lateReason || !String(estimatedLateMinutes).trim() || isProcessing || (!lateReasonPhotoId && !lateReasonPhotoUrl)}
            >
              {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ArrowRight className="mr-2 h-5 w-5" />}
              Gửi yêu cầu
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
