'use client';

import React from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useLightbox } from '@/contexts/lightbox-context';
import { ImageIcon, Maximize2 } from 'lucide-react';

type CompletionGalleryDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
};

export default function CompletionGalleryDialog({ isOpen, onClose, images }: CompletionGalleryDialogProps) {
  const { openLightbox } = useLightbox();
  if (!images || images.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[80vh] rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight">Bộ sưu tập ảnh</DialogTitle>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                {images.length} hình ảnh đã chụp
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-4">
          <ScrollArea className="max-h-[60vh]">
            <div className="grid grid-cols-3 gap-3">
              {images.map((src, idx) => (
                <button
                  key={idx}
                  onClick={() => openLightbox(images.map(s => ({ src: s })), idx)}
                  className={cn(
                    'group relative aspect-square rounded-2xl overflow-hidden bg-slate-100 border-2 border-transparent transition-all duration-300',
                    'hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 active:scale-95',
                    'focus:outline-none focus:ring-2 focus:ring-primary/20'
                  )}
                >
                  <Image 
                    src={src} 
                    alt={`Ảnh ${idx + 1}`} 
                    fill 
                    className="object-cover transition-transform duration-500 group-hover:scale-110" 
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <Maximize2 className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-all transform scale-50 group-hover:scale-100" />
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="px-6 py-6 bg-slate-50/50 border-t mt-2">
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="w-full h-12 rounded-2xl font-bold text-slate-600 hover:bg-slate-200/50 transition-all active:scale-[0.98]"
          >
            Đóng bộ sưu tập
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
