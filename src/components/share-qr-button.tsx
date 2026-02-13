'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Share2 } from 'lucide-react';
import { toast } from '@/components/ui/pro-toast';

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
    
    // Check if Web Share API is available
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: text,
          url: url,
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Error sharing:', error);
          toast.error('Không thể chia sẻ nội dung này.');
        }
      }
    } else {
      // Fallback: Copy URL to clipboard
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Duyệt web này không hỗ trợ chia sẻ trực tiếp. Đã sao chép liên kết vào bộ nhớ tạm.');
      } catch (err) {
        console.error('Failed to copy fallback:', err);
        toast.error('Trình duyệt không hỗ trợ chia sẻ và không thể sao chép liên kết.');
      }
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
