'use client';

import React from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, MessageSquare, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { photoStore } from '@/lib/photo-store';
import type { CompletionRecord } from '@/lib/types';
import { cn } from '@/lib/utils';
import Image from 'next/image';

export type OtherStaffCompletion = {
  staffName: string;
  userId: string;
  completions: CompletionRecord[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  otherStaffCompletions: OtherStaffCompletion[];
  taskName: string;
  taskType: 'photo' | 'boolean' | 'opinion';
  onOpenLightbox: (photos: { src: string }[], startIndex: number) => void;
  currentStaffName?: string;
  currentCompletions?: CompletionRecord[];
  onDeleteCurrentCompletion?: (index: number) => void;
  onDeleteCurrentPhoto?: (completionIndex: number, photoId: string) => void;
  parentDialogTag: string;
};

export default function CompletionsDialog({ open, onOpenChange, otherStaffCompletions, taskType, onOpenLightbox, taskName, currentStaffName = 'Bạn', currentCompletions = [], onDeleteCurrentCompletion, onDeleteCurrentPhoto, parentDialogTag }: Props) {
  const flattened = React.useMemo(() => {
    const out: { staffName: string; userId?: string; completion: CompletionRecord; origin?: 'self' | 'other'; selfIndex?: number }[] = [];

    // current user's completions (mark origin and index)
    (currentCompletions || []).forEach((c, i) => out.push({ staffName: currentStaffName, completion: c, origin: 'self', selfIndex: i }));

    // other staff
    otherStaffCompletions.forEach(s => {
      (s.completions || []).forEach(c => out.push({ staffName: s.staffName, userId: s.userId, completion: c, origin: 'other' }));
    });

    // Sort most recent first (timestamps are 'HH:mm')
    out.sort((a, b) => (b.completion.timestamp || '').localeCompare(a.completion.timestamp || ''));
    return out;
  }, [otherStaffCompletions, currentCompletions, currentStaffName]);

  // local photo urls for current user's photoIds
  const [localPhotoUrls, setLocalPhotoUrls] = React.useState<Map<string, string>>(new Map());

  React.useEffect(() => {
    if (!open) return; // only fetch when dialog is open
    let isMounted = true;
    const urlsToRevoke: string[] = [];

    const fetchLocalPhotos = async () => {
      const allLocalIds = (currentCompletions || []).flatMap(c => c.photoIds || []);
      if (allLocalIds.length === 0) {
        if (isMounted) setLocalPhotoUrls(new Map());
        return;
      }

      const urlsMap = await photoStore.getPhotosAsUrls(allLocalIds);
      if (isMounted) {
        const newMap = new Map(urlsMap);
        setLocalPhotoUrls(newMap);
        newMap.forEach(u => urlsToRevoke.push(u));
      } else {
        urlsMap.forEach(u => URL.revokeObjectURL(u));
      }
    };

    fetchLocalPhotos();

    return () => {
      isMounted = false;
      urlsToRevoke.forEach(u => URL.revokeObjectURL(u));
      localPhotoUrls.forEach(u => URL.revokeObjectURL(u));
    };
  }, [open, currentCompletions]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange} parentDialogTag={parentDialogTag}>
      <AlertDialogContent className="rounded-3xl max-w-2xl border-none shadow-2xl p-0 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white text-center sm:text-left">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold flex items-center gap-2">
              {taskName}
            </AlertDialogTitle>
          </AlertDialogHeader>
        </div>

        <div className="p-2 sm:p-5">
          <ScrollArea className="h-[420px] pr-3">
            <div className="space-y-4 py-2">
              {flattened.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground italic">
                  Chưa có ai hoàn thành công việc này.
                </div>
              ) : (
                flattened.map((entry, idx) => (
                  <div
                    key={`${entry.userId || 'self'}-${idx}`}
                    className="group relative bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-50 p-2 rounded-xl">
                          <Clock className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-[12px] font-medium text-slate-400 uppercase tracking-wider">
                            {entry.completion.timestamp}
                          </p>
                          <p className="text-[15px] font-bold text-slate-800">
                            {entry.staffName}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {taskType === 'boolean' && entry.completion.value !== undefined && (
                          <Badge
                            variant={entry.completion.value ? 'default' : 'secondary'}
                            className={cn(
                              "px-3 py-1 rounded-full text-[11px] font-bold border-none",
                              entry.completion.value ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"
                            )}
                          >
                            {entry.completion.value ? (
                              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3" /> Đã làm</span>
                            ) : (
                              <span className="flex items-center gap-1.5"><XCircle className="h-3 w-3" /> Chưa làm</span>
                            )}
                          </Badge>
                        )}

                        {/* Delete for current user's completions */}
                        {entry.origin === 'self' && typeof entry.selfIndex === 'number' && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => {
                              if (!onDeleteCurrentCompletion) return;
                              if (confirm('Xóa lần hoàn thành này? Hành động này không thể hoàn tác.')) {
                                onDeleteCurrentCompletion(entry.selfIndex!);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="space-y-3">
                      {taskType === 'opinion' && entry.completion.opinion && (
                        <div className="flex gap-2">
                          <MessageSquare className="h-4 w-4 text-emerald-500 mt-1 shrink-0" />
                          <div className="bg-slate-50 rounded-xl p-3 text-[14px] text-slate-700 leading-relaxed border border-slate-100 w-full">
                            {entry.completion.opinion}
                          </div>
                        </div>
                      )}

                      {/* Photo Grid (include local photos for current user's completions) */}
                      {((entry.completion.photos?.length || 0) > 0 || (entry.origin === 'self' && (entry.completion.photoIds || []).length > 0)) && (
                        <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 mt-2">
                          {(() => {
                            const permanent = entry.completion.photos || [];
                            const local = (entry.origin === 'self' && entry.completion.photoIds) ? entry.completion.photoIds.map(id => ({ id, url: localPhotoUrls.get(id) })).filter(x => x.url) as { id: string, url: string }[] : [];
                            const all = [...permanent.map(url => ({ id: undefined as string | undefined, url })), ...local.map(x => ({ id: x.id, url: x.url }))];
                            return all.map((item, pIdx) => (
                              <div
                                key={`${item.url}-${pIdx}`}
                                className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all shadow-sm"
                                role="button"
                                tabIndex={0}
                                onClick={() => onOpenLightbox(all.map(a => ({ src: a.url })), pIdx)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenLightbox(all.map(a => ({ src: a.url })), pIdx); } }}
                              >
                                <Image
                                  src={item.url!}
                                  alt={`${entry.staffName} photo`}
                                  fill
                                  className="object-cover"
                                  sizes="100px"
                                />
                                {/* Show delete overlay for local photos (unsent) */}
                                {item.id && typeof onDeleteCurrentPhoto === 'function' && (
                                  <div className="absolute top-1 right-1">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-destructive bg-white/60 hover:bg-white"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!confirm('Xóa ảnh chưa gửi này? Hành động này không thể hoàn tác.')) return;
                                        onDeleteCurrentPhoto(entry.selfIndex!, item.id!);
                                      }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ));
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <AlertDialogFooter className="p-4 bg-slate-100/50 border-t items-center sm:justify-end">
          <AlertDialogCancel className="rounded-xl border-slate-200 text-slate-600 px-6 font-semibold hover:bg-slate-100 transition-colors">
            Đóng
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
