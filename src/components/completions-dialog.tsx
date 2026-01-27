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
  DialogCancel,
  DialogAction
} from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogIcon } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { History, Clock, MessageSquare, CheckCircle2, XCircle, Trash2, User } from 'lucide-react';
import { photoStore } from '@/lib/photo-store';
import type { CompletionRecord } from '@/lib/types';
import { cn } from '@/lib/utils';
import Image from '@/components/ui/image';

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

    const fetchTimeout = setTimeout(fetchLocalPhotos, 100);

    return () => {
      isMounted = false;
      clearTimeout(fetchTimeout);
      urlsToRevoke.forEach(u => URL.revokeObjectURL(u));
      localPhotoUrls.forEach(u => URL.revokeObjectURL(u));
    };
  }, [open, currentCompletions]);

  const [confirmDeleteIndex, setConfirmDeleteIndex] = React.useState<number | null>(null);
  const [confirmDeletePhoto, setConfirmDeletePhoto] = React.useState<{ index: number; id: string } | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} dialogTag="completions-view" parentDialogTag={parentDialogTag}>
      <DialogContent className="max-w-2xl">
        <DialogHeader variant="success" iconkey="check">
          <DialogTitle>Lịch sử hoàn thành</DialogTitle>
          <DialogDescription className="line-clamp-2 sm:truncate">{taskName}</DialogDescription>
        </DialogHeader>

        <DialogBody className="bg-zinc-50/30">
          <div className="space-y-4 pb-10">
            {flattened.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-16 w-16 rounded-full bg-zinc-100 flex items-center justify-center mb-4 text-zinc-300">
                  <User className="h-8 w-8" />
                </div>
                <p className="text-zinc-500 font-medium italic text-sm">Chưa có ai thực hiện công việc này</p>
              </div>
            ) : (
                flattened.map((entry, idx) => (
                  <div
                    key={`${entry.userId || 'self'}-${idx}`}
                    className={cn(
                      "group relative border rounded-2xl p-4 shadow-sm transition-all duration-300",
                      entry.origin === 'self' 
                        ? "bg-white border-blue-100/50" 
                        : "bg-white/80 border-zinc-100 opacity-90 grayscale-[0.2] hover:grayscale-0 hover:bg-white"
                    )}
                  >
                    {/* Header of Item */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className={cn(
                          "h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center font-bold text-base sm:text-lg border transition-colors shrink-0",
                          entry.origin === 'self' 
                            ? "bg-zinc-900 text-white border-zinc-800" 
                            : "bg-zinc-100 text-zinc-500 border-zinc-200"
                        )}>
                          {entry.staffName === 'Bạn' ? 'B' : entry.staffName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                             <p className="text-sm sm:text-base font-bold text-zinc-900 leading-none truncate">
                              {entry.staffName}
                            </p>
                            {entry.origin === 'self' && (
                              <Badge className="bg-blue-50 text-blue-600 border-blue-100/30 px-2 py-0 h-5 text-[10px] font-black uppercase">Bạn</Badge>
                            )}
                            {entry.origin === 'self' && typeof entry.selfIndex === 'number' && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors ml-auto sm:ml-0"
                                onClick={() => {
                                  if (!onDeleteCurrentCompletion) return;
                                  setConfirmDeleteIndex(entry.selfIndex!);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              </Button>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Clock className="h-3 w-3 text-zinc-400" />
                            <span className="text-[10px] font-bold text-zinc-400 tracking-wide uppercase">{entry.completion.timestamp}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 ml-auto sm:ml-0 shrink-0">
                        {taskType === 'boolean' && entry.completion.value !== undefined && (
                          <div className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-wider",
                            entry.completion.value 
                              ? "bg-emerald-50 text-emerald-600" 
                              : "bg-red-50 text-red-600"
                          )}>
                             {entry.completion.value ? <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : <XCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
                             {entry.completion.value ? 'Đã làm' : 'Chưa làm'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="space-y-4">
                      {entry.completion.note && (
                        <div className="relative">
                          <div className="absolute left-4 top-4 text-amber-500">
                             <MessageSquare className="h-4 w-4" />
                          </div>
                        <div className="bg-amber-50/50 rounded-xl p-4 pl-11 text-[15px] font-medium text-amber-800 leading-relaxed border border-amber-100/50 italic">
                            "{entry.completion.note}"
                          </div>
                        </div>
                      )}

                      {taskType === 'opinion' && entry.completion.opinion && (
                        <div className="relative">
                          <div className="absolute left-4 top-4 text-slate-300">
                             <MessageSquare className="h-4 w-4" />
                          </div>
                        <div className="bg-zinc-50/80 rounded-xl p-4 pl-11 text-[15px] font-medium text-zinc-700 leading-relaxed border border-zinc-100/50 italic">
                            "{entry.completion.opinion}"
                          </div>
                        </div>
                      )}

                      {/* Photo Grid */}
                      {((entry.completion.photos?.length || 0) > 0 || (entry.origin === 'self' && (entry.completion.photoIds || []).length > 0)) && (
                        <div className="grid grid-cols-3 min-[400px]:grid-cols-4 sm:grid-cols-5 gap-2 mt-3">
                          {(() => {
                            const permanent = entry.completion.photos || [];
                            const local = (entry.origin === 'self' && entry.completion.photoIds) ? entry.completion.photoIds.map(id => ({ id, url: localPhotoUrls.get(id) })).filter(x => x.url) as { id: string, url: string }[] : [];
                            const all = [...permanent.map(url => ({ id: undefined as string | undefined, url })), ...local.map(x => ({ id: x.id, url: x.url }))];
                            return all.map((item, pIdx) => (
                              <div
                                key={`${item.url}-${pIdx}`}
                                className="group/photo relative aspect-square rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-zinc-900 transition-all shadow-sm active:scale-95"
                                role="button"
                                tabIndex={0}
                                onClick={() => onOpenLightbox(all.map(a => ({ src: a.url })), pIdx)}
                              >
                                <Image
                                  src={item.url!}
                                  alt={`${entry.staffName} photo`}
                                  fill
                                  className="object-cover"
                                  sizes="100px"
                                />
                                {item.id && (
                                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity">
                                    <Badge className="bg-amber-400 text-white font-black text-[9px] uppercase border-none">Chưa gửi</Badge>
                                  </div>
                                )}
                                
                                {item.id && typeof onDeleteCurrentPhoto === 'function' && (
                                  <div className="absolute top-1 right-1 lg:opacity-0 group-hover/photo:opacity-100 transition-opacity">
                                    <Button
                                      size="icon"
                                      variant="destructive"
                                      className="h-7 w-7 rounded-lg shadow-lg"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                      setConfirmDeletePhoto({ index: entry.selfIndex!, id: item.id! });
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
        </DialogBody>

        {/* Confirm deletion using the shared AlertDialog (replaces window.confirm) */}
        <AlertDialog 
          open={confirmDeleteIndex !== null} 
          onOpenChange={(v) => { if (!v) setConfirmDeleteIndex(null); }}
        >
          <AlertDialogContent className="rounded-[32px] border-none p-0 overflow-hidden shadow-2xl max-w-[400px]">
            <div className="bg-red-50 p-8 flex justify-center">
              <AlertDialogIcon variant="destructive" />
            </div>
            <div className="p-8 pt-6 text-center">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-2xl font-black text-zinc-900 text-center">Xóa hoàn thành?</AlertDialogTitle>
                <AlertDialogDescription className="text-zinc-500 text-base font-medium text-center mt-2">
                  Hành động này sẽ xóa vĩnh viễn mục hoàn thành này khỏi hệ thống.
                </AlertDialogDescription>
              </AlertDialogHeader>
            </div>
            <AlertDialogFooter className="p-6 bg-zinc-50 gap-3 sm:gap-0">
              <AlertDialogCancel className="h-12 rounded-2xl flex-1 border-zinc-200 font-bold text-zinc-600" disabled={isDeleting}>
                Hủy
              </AlertDialogCancel>
              <AlertDialogAction
                className="h-12 rounded-2xl flex-1 bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg shadow-red-200"
                isLoading={isDeleting}
                disabled={isDeleting}
                onClick={async () => {
                  if (confirmDeleteIndex === null || !onDeleteCurrentCompletion || isDeleting) return;
                  setIsDeleting(true);
                  try {
                    await Promise.resolve(onDeleteCurrentCompletion(confirmDeleteIndex));
                    setConfirmDeleteIndex(null);
                  } catch (err) {
                    console.error('Failed to delete completion', err);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
              >
                Xóa
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Confirm delete unsent photo */}
        <AlertDialog 
          open={confirmDeletePhoto !== null} 
          onOpenChange={(open) => !open && setConfirmDeletePhoto(null)}
        >
          <AlertDialogContent className="rounded-[32px] border-none p-0 overflow-hidden shadow-2xl max-w-[400px]">
             <div className="bg-red-50 p-8 flex justify-center">
                <AlertDialogIcon variant="destructive" />
             </div>
             <div className="p-8 pt-6 text-center">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-2xl font-black text-zinc-900 text-center">Xóa ảnh chưa gửi?</AlertDialogTitle>
                  <AlertDialogDescription className="text-zinc-500 text-base font-medium text-center mt-2">
                    Bạn có chắc chắn muốn xóa ảnh này không? Ảnh chưa được gửi lên máy chủ.
                  </AlertDialogDescription>
                </AlertDialogHeader>
             </div>
             <AlertDialogFooter className="p-6 bg-zinc-50 gap-3 sm:gap-0">
                <AlertDialogCancel className="h-12 rounded-2xl flex-1 border-zinc-200 font-bold text-zinc-600">Hủy</AlertDialogCancel>
                <AlertDialogAction 
                  className="h-12 rounded-2xl flex-1 bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg shadow-red-200"
                  onClick={() => {
                    if (confirmDeletePhoto && onDeleteCurrentPhoto) {
                      onDeleteCurrentPhoto(confirmDeletePhoto.index, confirmDeletePhoto.id);
                      setConfirmDeletePhoto(null);
                    }
                  }}
                >
                  Xóa
                </AlertDialogAction>
             </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <DialogFooter className="border-t bg-white">
          <DialogAction variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto px-10">
            Đóng
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
