'use client';

import Image from '@/components/ui/image';
import { Video } from 'lucide-react';
import { useLightbox } from '@/contexts/lightbox-context';
import type { MediaAttachment } from '@/lib/types';

export default function MediaPreview({ media }: { media?: MediaAttachment[] }) {
  const { openLightbox } = useLightbox();
  if (!media || media.length === 0) return null;

  const slides = media.map((att) => {
    if (att.type === 'video') {
      return {
        type: 'video' as const,
        sources: [
          { src: att.url, type: 'video/mp4' },
          { src: att.url, type: 'video/webm' },
        ],
      };
    }
    return { src: att.url };
  });

  const handleOpen = (index: number) => {
    openLightbox(slides, index);
  };

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {media.map((item, idx) => (
        <button
          key={`${item.url}-${idx}`}
          onClick={() => handleOpen(idx)}
          className="relative h-20 w-20 overflow-hidden rounded-lg border bg-black/5 dark:bg-white/5"
        >
          {item.type === 'photo' ? (
            <Image src={item.url || '/placeholder.svg'} alt="attachment" fill className="object-cover" />
          ) : (
            <>
              <video src={`${item.url}#t=0.1`} className="h-full w-full object-cover" muted playsInline />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                <Video className="h-4 w-4" />
              </div>
            </>
          )}
        </button>
      ))}
    </div>
  );
}
