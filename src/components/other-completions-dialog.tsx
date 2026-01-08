'use client';

import React from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Eye, MessageSquare, CheckCircle2, XCircle } from 'lucide-react';
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
};

export default function OtherCompletionsDialog({ open, onOpenChange, otherStaffCompletions, taskType, onOpenLightbox, taskName }: Props) {
  const flattened = React.useMemo(() => {
    const out: { staffName: string; userId: string; completion: CompletionRecord }[] = [];
    otherStaffCompletions.forEach(s => {
      (s.completions || []).forEach(c => out.push({ staffName: s.staffName, userId: s.userId, completion: c }));
    });
    out.sort((a, b) => (b.completion.timestamp || '').localeCompare(a.completion.timestamp || ''));
    return out;
  }, [otherStaffCompletions]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
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
                  Chưa có ai khác hoàn thành công việc này.
                </div>
              ) : (
                flattened.map((entry, idx) => (
                  <div 
                    key={`${entry.userId}-${idx}`} 
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
                              entry.completion.value 
                                ? "bg-emerald-500 hover:bg-emerald-600 text-white" 
                                : "bg-slate-100 text-slate-500"
                            )}
                          >
                            {entry.completion.value ? (
                              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3" /> Đã làm</span>
                            ) : (
                              <span className="flex items-center gap-1.5"><XCircle className="h-3 w-3" /> Chưa làm</span>
                            )}
                          </Badge>
                        )}
                        
                        {(taskType === 'photo' || entry.completion.photos?.length) && (
                           <Button 
                             size="sm" 
                             variant="ghost" 
                             className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-full h-8 w-8 p-0"
                             onClick={() => entry.completion.photos && onOpenLightbox(entry.completion.photos.map(url => ({ src: url })), 0)}
                           >
                              <Eye className="h-4 w-4" />
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

                      {/* Photo Grid */}
                      {(entry.completion.photos?.length || 0) > 0 && (
                        <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 mt-2">
                          {entry.completion.photos!.map((url, pIdx) => (
                            <div 
                              key={`${url}-${pIdx}`}
                              className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all shadow-sm"
                              onClick={() => onOpenLightbox(entry.completion.photos!.map(src => ({ src })), pIdx)}
                            >
                              <Image 
                                src={url} 
                                alt={`${entry.staffName} photo`}
                                fill
                                className="object-cover"
                                sizes="100px"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              ))}
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
