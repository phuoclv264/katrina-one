'use client';

import Image from '@/components/ui/image';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogAction,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2, Maximize2, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLightbox } from '@/contexts/lightbox-context';

type MediaItem = { id: string; url: string; type: 'photo' | 'video' };

type MediaGalleryDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  media: MediaItem[];
  onDelete: (id: string) => void;
  parentDialogTag: string;
};

export default function MediaGalleryDialog({
  isOpen,
  onClose,
  media,
  onDelete,
  parentDialogTag,
}: MediaGalleryDialogProps) {
  const { openLightbox } = useLightbox();

  const slides = media.map(item => {
    if (item.type === 'photo') return { src: item.url, type: 'image' as const };
    return { type: 'video' as const, sources: [{ src: item.url, type: 'video/mp4' }] };
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} dialogTag="media-gallery-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="max-w-4xl h-[90vh]">
        <DialogHeader iconkey="maximize">
          <DialogTitle>Thư viện ảnh ({media.length})</DialogTitle>
          <DialogDescription>
            Tất cả bằng chứng đã thu thập từ các báo cáo.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="bg-muted/5 pb-10">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {media.map((item, index) => (
              <div
                key={item.id}
                className="group relative aspect-square rounded-3xl overflow-hidden bg-muted/50 border border-border/50 transition-all hover:scale-[1.02] hover:shadow-xl active:scale-95 cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => openLightbox(slides, index)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(slides, index); } }}
              >
                {item.type === 'photo' ? (
                  <Image src={item.url} alt="Gallery" fill className="object-cover transition-transform group-hover:scale-110" />
                ) : (
                  <div className="relative h-full w-full">
                    <video src={item.url} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                      <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 text-white">
                        <Play className="h-6 w-6 fill-white" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute top-3 right-3 flex gap-2">
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-8 w-8 rounded-full shadow-lg scale-0 group-hover:scale-100 transition-transform duration-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="absolute bottom-3 left-3 flex items-center gap-2 text-white">
                    <Maximize2 className="h-4 w-4" />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">Phóng to</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogBody>

        <DialogFooter className="border-t">
          <DialogAction variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Đóng
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
