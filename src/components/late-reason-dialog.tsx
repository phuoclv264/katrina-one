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
  DialogCancel,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import Image from '@/components/ui/image';
import { CheckCircle, Camera, Upload, X, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
import type { Slide } from 'yet-another-react-lightbox';

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
      <DialogContent>
        <DialogHeader variant="warning" icon={<Camera />} className="pb-10">
          <div>
            <DialogTitle className="mb-0">Báo cáo Đi trễ</DialogTitle>
            <DialogDescription className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mt-2 italic">Vui lòng cung cấp lý do & minh chứng</DialogDescription>
          </div>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-6 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 ml-1">Lý do đi trễ</Label>
                <Input
                  placeholder="Ví dụ: Kẹt xe, hỏng xe..."
                  className="h-14 rounded-2xl border-zinc-200 bg-zinc-50/50 px-4 font-bold focus-visible:ring-primary shadow-sm"
                  value={lateReason}
                  onChange={(e) => setLateReason(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 ml-1">Số phút trễ dự kiến</Label>
                <div className="relative">
                  <Input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="0"
                    className="h-14 rounded-2xl border-zinc-200 bg-zinc-50/50 pl-4 pr-16 font-black text-lg focus-visible:ring-primary shadow-sm"
                    value={String(estimatedLateMinutes)}
                    onChange={(e) => setEstimatedLateMinutes(e.target.value.replace(/\D/g, ''))}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-zinc-400 mr-1 uppercase">phút</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 ml-1">
                Minh chứng <span className="text-rose-600 font-black tracking-tighter ml-1">(*)</span>
              </Label>

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

              {lateReasonPhotoId || lateReasonPhotoUrl ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 rounded-[24px] bg-green-50/50 border border-green-200 group transition-all">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-2xl flex items-center justify-center bg-green-100 text-green-600 shadow-sm border border-green-200">
                        <CheckCircle className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-green-900">Đã kèm minh chứng</p>
                        <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider">{lateReasonMediaType === 'video' ? 'Video' : 'Hình ảnh'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-xl hover:bg-green-100 text-green-600 shadow-sm transition-all"
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
                        disabled={!lateReasonPhotoUrl}
                      >
                        <Eye className="h-5 w-5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-xl hover:bg-rose-50 hover:text-rose-600 shadow-sm transition-colors"
                        onClick={() => {
                          onRemoveMedia();
                          setShowMediaError(false);
                        }}
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => {
                      onPickFromCamera();
                      setShowMediaError(false);
                    }}
                    className="h-28 rounded-3xl border-2 border-dashed border-zinc-200 bg-white flex flex-col items-center justify-center gap-2 transition-all hover:bg-zinc-50 hover:border-zinc-300 active:scale-95 shadow-sm"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center">
                      <Camera className="h-6 w-6 text-zinc-600" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-wider text-zinc-600">Chụp ảnh/Video</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMediaError(false);
                      fileInputRef.current?.click();
                    }}
                    className="h-28 rounded-3xl border-2 border-dashed border-zinc-200 bg-white flex flex-col items-center justify-center gap-2 transition-all hover:bg-zinc-50 hover:border-zinc-300 active:scale-95 shadow-sm"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center">
                      <Upload className="h-6 w-6 text-zinc-600" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-wider text-zinc-600">Tải lên</span>
                  </button>
                </div>
              )}

              <p
                id="late-reason-media-hint"
                className={`text-[10px] font-bold uppercase tracking-wider mt-2 ml-1 ${showMediaError ? 'text-rose-600 font-black' : 'text-zinc-400'}`}
              >
                {showMediaError ? 'Bạn phải đính kèm hình bằng chứng.' : 'Vui lòng đính kèm hình ảnh hoặc video làm bằng chứng.'}
              </p>
            </div> 
          </div>
        </DialogBody>

        <DialogFooter variant="muted">
          <DialogCancel onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Hủy
          </DialogCancel>
          <DialogAction
            onClick={async () => {
              if (!lateReasonPhotoId && !lateReasonPhotoUrl) {
                setShowMediaError(true);
                fileInputRef.current?.focus();
                return;
              }
              setShowMediaError(false);
              await onSubmit();
            }}
            disabled={!lateReason || !String(estimatedLateMinutes).trim() || isProcessing || (!lateReasonPhotoId && !lateReasonPhotoUrl)}
            isLoading={isProcessing}
            className="disabled:bg-zinc-200 disabled:text-zinc-500 disabled:shadow-none disabled:cursor-not-allowed"
          >
            Gửi báo cáo
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
