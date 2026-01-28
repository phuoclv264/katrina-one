'use client';

import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import Image from '@/components/ui/image';
import { Clock, Video, MessageSquare, Info } from 'lucide-react';
import { useLightbox } from '@/contexts/lightbox-context';
import type { ShiftBusyEvidence } from '@/lib/types';
import { toDate, buildSlides } from './understaffed-evidence-utils';

interface ShiftEvidenceReportsProps {
  evidences: ShiftBusyEvidence[];
}

export function ShiftEvidenceReports({ evidences }: ShiftEvidenceReportsProps) {
  const { openLightbox } = useLightbox();

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 bg-primary/10 rounded-[1.75rem] flex items-center justify-center shadow-inner ring-8 ring-primary/[0.03]">
            <MessageSquare className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h4 className="font-black text-lg sm:text-xl tracking-tight text-foreground/90">Phản hồi từ nhân viên</h4>
            <p className="text-xs sm:text-sm font-bold text-muted-foreground/60">{evidences.length} báo cáo minh chứng đã nhận</p>
          </div>
        </div>
      </div>

      {evidences.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-8 bg-muted/10 rounded-[3rem] border-2 border-dashed border-muted-foreground/10">
          <div className="h-20 w-20 bg-muted/20 rounded-[2rem] flex items-center justify-center mb-6 ring-8 ring-muted/5">
            <Info className="h-10 w-10 text-muted-foreground/20" />
          </div>
          <h5 className="text-lg font-black text-foreground/40 text-center tracking-tight">Chưa có phản hồi</h5>
          <p className="text-xs text-muted-foreground/50 font-bold text-center mt-2 max-w-[240px]">
            Nhân viên chưa gửi bất kỳ minh chứng bận nào cho ca này.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
          {evidences.map((entry) => {
            const submittedAt = toDate(entry.submittedAt);
            const mediaSlides = entry.media ? buildSlides(entry.media) : [];
            return (
              <div key={entry.id} className="group relative bg-white rounded-[2.5rem] p-7 border border-border/50 hover:border-primary/20 transition-all duration-500 shadow-md hover:shadow-2xl">
                <div className="flex items-center gap-5 mb-8">
                  <div className="h-16 w-16 rounded-[1.5rem] bg-gradient-to-br from-primary/20 via-primary/5 to-transparent flex items-center justify-center text-primary font-black border-2 border-primary/10 shadow-lg text-2xl ring-8 ring-primary/[0.03] group-hover:scale-110 transition-transform duration-500">
                    {entry.submittedBy.userName.charAt(0)}
                  </div>
                  <div className="space-y-1">
                    <p className="font-black text-lg text-foreground tracking-tight leading-none">{entry.submittedBy.userName}</p>
                    {submittedAt && (
                      <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1.5 font-bold uppercase tracking-wider">
                        <Clock className="h-3 w-3 text-primary/40" />
                        {formatDistanceToNow(submittedAt, { addSuffix: true, locale: vi })}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-background/60 backdrop-blur-md rounded-[2rem] p-6 border border-border/30 shadow-inner group-hover:bg-background/90 transition-colors duration-500">
                    <p className="text-sm sm:text-base leading-relaxed text-foreground/80 whitespace-pre-wrap italic font-bold">
                      "{entry.message}"
                    </p>
                  </div>

                  {entry.media && entry.media.length > 0 && (
                    <div className="flex flex-wrap gap-4 pt-2">
                      {entry.media.map((attachment, idx) => (
                        <button
                          key={attachment.url}
                          className="group/media relative h-28 w-28 rounded-[2rem] overflow-hidden border-[6px] border-background shadow-2xl hover:scale-105 transition-all duration-500 active:scale-95 ring-1 ring-border/20"
                          onClick={() => openLightbox(mediaSlides, idx)}
                        >
                          {attachment.type === 'photo' ? (
                            <Image
                              src={attachment.url}
                              alt="Bằng chứng"
                              fill
                              className="object-cover transition-transform duration-700 group-hover/media:scale-110"
                            />
                          ) : (
                            <div className="relative h-full w-full bg-black">
                              <video src={`${attachment.url}#t=0.1`} className="h-full w-full object-cover opacity-80" muted playsInline />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover/media:bg-black/20 transition-colors">
                                <div className="bg-white/20 backdrop-blur-md p-4 rounded-full ring-2 ring-white/40 shadow-2xl scale-90 group-hover/media:scale-100 transition-transform duration-500">
                                  <Video className="h-6 w-6 text-white shadow-sm" />
                                </div>
                              </div>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover/media:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
