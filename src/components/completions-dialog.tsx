'use client';

import React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, MessageSquare, CheckCircle2, XCircle, Trash2, User } from 'lucide-react';
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange} dialogTag="completions-view" parentDialogTag={parentDialogTag}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl p-0 overflow-hidden border-none shadow-2xl rounded-[32px] sm:rounded-[40px] bg-slate-50/95 backdrop-blur-xl">
        {/* Beautiful Header */}
        <div className="relative bg-gradient-to-br from-blue-600 to-indigo-700 pt-4 pb-6 px-4 sm:px-6 text-white overflow-hidden">
          {/* Abstract Decorations */}
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-48 h-48 bg-blue-400/20 rounded-full blur-2xl pointer-events-none" />
          
          <div className="relative flex flex-col sm:flex-row items-center sm:items-center gap-4 text-center sm:text-left">
            <div className="h-14 w-14 rounded-3xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-md transform hover:scale-105 transition-transform duration-300">
              <CheckCircle2 className="h-8 w-8 text-white drop-shadow" />
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-blue-100 text-sm font-bold uppercase tracking-[0.2em]">Lịch sử hoàn thành</p>
              <DialogTitle className="text-2xl sm:text-3xl font-black text-white leading-tight">
                {taskName}
              </DialogTitle>
            </div>
          </div>
        </div>

        <div className="relative -mt-6 rounded-t-[32px] bg-slate-50 border-t border-white/20 p-3 sm:p-4">
          <ScrollArea className="h-[60vh] sm:h-[68vh] max-h-[72vh] w-full pr-4">
            <div className="space-y-4 pb-6">
              {flattened.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                    <User className="h-10 w-10 text-slate-300" />
                  </div>
                  <p className="text-slate-400 font-medium italic">Chưa có ai thực hiện công việc này</p>
                </div>
              ) : (
                flattened.map((entry, idx) => (
                  <div
                    key={`${entry.userId || 'self'}-${idx}`}
                    className={cn(
                      "group relative border rounded-[24px] p-4 shadow-sm transition-all duration-300",
                      entry.origin === 'self' 
                        ? "bg-white border-blue-100 hover:border-blue-200 hover:shadow-md" 
                        : "bg-white/80 border-slate-100 opacity-90 grayscale-[0.2] hover:grayscale-0 hover:bg-white"
                    )}
                  >
                    {/* Header of Item */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "h-12 w-12 rounded-2xl flex items-center justify-center font-bold text-lg border shadow-sm transition-colors",
                          entry.origin === 'self' 
                            ? "bg-blue-600 text-white border-blue-400" 
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        )}>
                          {entry.staffName === 'Bạn' ? 'B' : entry.staffName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                             <p className="text-[17px] font-extrabold text-slate-900 leading-none">
                              {entry.staffName}
                            </p>
                            {entry.origin === 'self' && (
                              <Badge className="bg-blue-50 text-blue-600 border-blue-100 px-2 py-0 h-5 text-[10px] font-black uppercase">Bạn</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <span className="text-xs font-bold text-slate-400 tracking-wide uppercase">{entry.completion.timestamp}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {taskType === 'boolean' && entry.completion.value !== undefined && (
                          <div className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider",
                            entry.completion.value 
                              ? "bg-emerald-50 text-emerald-600" 
                              : "bg-red-50 text-red-600"
                          )}>
                             {entry.completion.value ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                             {entry.completion.value ? 'Đã làm' : 'Chưa làm'}
                          </div>
                        )}

                        {entry.origin === 'self' && typeof entry.selfIndex === 'number' && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-10 w-10 rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                            onClick={() => {
                              if (!onDeleteCurrentCompletion) return;
                              if (window.confirm('Bạn có chắc muốn xóa lần hoàn thành này?')) {
                                onDeleteCurrentCompletion(entry.selfIndex!);
                              }
                            }}
                          >
                            <Trash2 className="h-5 w-5" />
                          </Button>
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
                          <div className="bg-amber-50/50 rounded-2xl p-4 pl-11 text-[15px] font-medium text-amber-800 leading-relaxed border border-amber-100/50 italic">
                            "{entry.completion.note}"
                          </div>
                        </div>
                      )}

                      {taskType === 'opinion' && entry.completion.opinion && (
                        <div className="relative">
                          <div className="absolute left-4 top-4 text-slate-300">
                             <MessageSquare className="h-4 w-4" />
                          </div>
                          <div className="bg-slate-50/80 rounded-2xl p-4 pl-11 text-[15px] font-medium text-slate-700 leading-relaxed border border-slate-100/50 italic">
                            "{entry.completion.opinion}"
                          </div>
                        </div>
                      )}

                      {/* Photo Grid */}
                      {((entry.completion.photos?.length || 0) > 0 || (entry.origin === 'self' && (entry.completion.photoIds || []).length > 0)) && (
                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mt-3">
                          {(() => {
                            const permanent = entry.completion.photos || [];
                            const local = (entry.origin === 'self' && entry.completion.photoIds) ? entry.completion.photoIds.map(id => ({ id, url: localPhotoUrls.get(id) })).filter(x => x.url) as { id: string, url: string }[] : [];
                            const all = [...permanent.map(url => ({ id: undefined as string | undefined, url })), ...local.map(x => ({ id: x.id, url: x.url }))];
                            return all.map((item, pIdx) => (
                              <div
                                key={`${item.url}-${pIdx}`}
                                className="group/photo relative aspect-square rounded-[18px] overflow-hidden cursor-pointer hover:ring-4 hover:ring-blue-100 transition-all shadow-sm active:scale-95"
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
                                        if (window.confirm('Xóa ảnh chưa gửi này?')) {
                                          onDeleteCurrentPhoto(entry.selfIndex!, item.id!);
                                        }
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
                    
                    {/* Background indicator for self */}
                    {entry.origin === 'self' && (
                      <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden pointer-events-none">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rotate-45 translate-x-16 -translate-y-16" />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="p-5 bg-white border-t border-slate-100 sm:justify-center">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-48 h-12 rounded-2xl font-black text-slate-600 border-slate-200 hover:bg-slate-50 transition-all active:scale-95 text-base shadow-sm"
            >
              Đóng
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
