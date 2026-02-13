'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Share2 } from 'lucide-react';
import { toast } from '@/components/ui/pro-toast';
import { Capacitor } from '@capacitor/core';

interface ShareQrButtonProps {
  url: string;
  title: string;
  text: string;
  className?: string;
  variant?: "link" | "default" | "destructive" | "outline" | "secondary" | "ghost" | null | undefined;
}

export function ShareQrButton({ url, title, text, className, variant = "outline" }: ShareQrButtonProps) {
  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Prefer the modern Web Share API (supports files on capable browsers)
    try {
      // If the URL points to an image, try to share the image file when the browser supports it
      const isImage = /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url) || url.includes('vietqr.io');

      if (navigator.share) {
        if (isImage) {
          try {
            const resp = await fetch(url);
            const blob = await resp.blob();
            const file = new File([blob], 'qr.png', { type: blob.type });

            if ((navigator as any).canShare && (navigator as any).canShare({ files: [file] })) {
              await (navigator as any).share({ files: [file], title, text });
              toast.success('Đã chia sẻ ảnh mã QR.');
              return;
            }
          } catch (err) {
            // fall back to sharing url/text below
            console.warn('Image share via Web Share API failed, falling back to url share', err);
          }
        }

        await navigator.share({ title, text, url });
        toast.success('Đã mở hộp chia sẻ.');
        return;
      }
    } catch (err) {
      console.warn('Web Share API failed or was rejected', err);
      // continue to other fallbacks
    }

      if (Capacitor.isNativePlatform()) {
        try {
          // @ts-ignore - optional Capacitor plugin (may not be present in web builds)
          const { Share } = await import('@capacitor/share');
          await Share.share({ title, text, url });
          toast.success('Đã mở hộp chia sẻ.');
          return;
        } catch (err) {
          console.warn('Capacitor Share failed or @capacitor/share not present', err);
        }
      }

    // Best-effort clipboard fallback: if image, try to copy image; otherwise copy URL
    try {
      const isImage = /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url) || url.includes('vietqr.io');
      if (isImage && navigator.clipboard && (window as any).ClipboardItem) {
        try {
          const resp = await fetch(url);
          const blob = await resp.blob();
          await navigator.clipboard.write([new (window as any).ClipboardItem({ [blob.type]: blob })]);
          toast.success('Đã sao chép ảnh mã QR vào clipboard.');
          return;
        } catch (err) {
          console.warn('Clipboard image write failed', err);
          // fallthrough to URL copy
        }
      }

      await navigator.clipboard.writeText(url);
      toast.success('Đã sao chép liên kết mã QR vào clipboard.');
      return;
    } catch (err) {
      console.error('All share fallbacks failed', err);
      toast.error('Không thể chia sẻ mã QR trên thiết bị này.');
    }
  };

  return (
    <Button
      variant={variant}
      size="icon"
      className={className}
      onClick={handleShare}
      title="Chia sẻ mã QR"
    >
      <Share2 className="h-4 w-4" />
    </Button>
  );
}
