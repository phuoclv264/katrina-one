
'use client';

import React, { useState, useEffect } from 'react';
import Image from '@/components/ui/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTrigger,
  DialogClose,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Camera, Clock, X, Trash2, AlertCircle, FilePlus2, ThumbsDown, ThumbsUp, FilePen, ChevronDown, ChevronUp, Star, MapPin, CheckCircle2, MessageSquareText, Image as ImageIcon, Info, HelpCircle } from 'lucide-react';
import CompletionsDialog from '@/components/completions-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Task, CompletionRecord, ShiftReport } from '@/lib/types';
import { cn, generateShortName } from '@/lib/utils';
import { photoStore } from '@/lib/photo-store';
import { useLightbox } from '@/contexts/lightbox-context';
import { differenceInMinutes } from 'date-fns';
// Avatar not needed for flattened other-staff completions
import { Users } from 'lucide-react';

type OtherStaffCompletion = {
  staffName: string;
  userId: string;
  completions: CompletionRecord[];
};

type TaskItemProps = {
  task: Task;
  completions: CompletionRecord[];
  isReadonly: boolean;
  isExpanded: boolean;
  isSingleCompletion: boolean;
  onPhotoAction: (task: Task, completionIndex?: number | null) => void;
  onBooleanAction: (taskId: string, value: boolean) => void;
  onOpinionAction: (task: Task) => void;
  onNoteAction: (task: Task) => void;
  onDeleteCompletion: (taskId: string, completionIndex: number) => void;
  onDeletePhoto: (taskId: string, completionIndex: number, photoId: string, isLocal: boolean) => void;
  onToggleExpand: (taskId: string) => void;
  onOpenLightbox: (photos: { src: string }[], startIndex: number) => void;
  otherStaffCompletions?: OtherStaffCompletion[];
  className?: string;
};

const TaskItemComponent = ({
  task,
  completions,
  isReadonly,
  isExpanded,
  isSingleCompletion,
  onPhotoAction,
  onBooleanAction,
  onOpinionAction,
  onNoteAction,
  onDeleteCompletion,
  onDeletePhoto,
  onToggleExpand,
  onOpenLightbox,
  otherStaffCompletions = [],
  className,
}: TaskItemProps) => {
  const minCompletions = task.minCompletions || 1;
  const isCompleted = completions.length >= minCompletions;
  // Allow adding photos to single-completion photo tasks even if already completed.
  const isDisabledForNew = (isSingleCompletion && isCompleted && task.type !== 'opinion' && task.type !== 'photo') || isReadonly;

  const MIN_TIME_FOR_ONE_TASK = 20; // minutes

  const combinedCompletions = React.useMemo(() => {
    const out: { staffName: string; userId?: string; completion: CompletionRecord }[] = [];
    (completions || []).forEach(c => out.push({ staffName: 'Bạn', completion: c }));
    (otherStaffCompletions || []).forEach(s => (s.completions || []).forEach(c => out.push({ staffName: s.staffName, userId: s.userId, completion: c })));
    out.sort((a, b) => (b.completion.timestamp || '').localeCompare(a.completion.timestamp || ''));
    return out;
  }, [completions, otherStaffCompletions]);

  const [localPhotoUrls, setLocalPhotoUrls] = useState<Map<string, string>>(new Map());
  const { isLightboxOpen } = useLightbox();

  useEffect(() => {
    let isMounted = true;
    const urlsToRevoke: string[] = [];

    const fetchLocalPhotos = async () => {
      // Always get all photoIds from the current completions prop
      const allLocalPhotoIds = completions.flatMap(c => c.photoIds || []);

      if (allLocalPhotoIds.length > 0) {
        const urlsMap = await photoStore.getPhotosAsUrls(allLocalPhotoIds);
        if (isMounted) {
          // Create a new Map to ensure re-render
          const newUrlMap = new Map(urlsMap);
          setLocalPhotoUrls(newUrlMap);
          // Collect all newly created URLs to be revoked on cleanup
          newUrlMap.forEach(url => urlsToRevoke.push(url));
        } else {
          // If component unmounted before state update, revoke immediately
          urlsMap.forEach(url => URL.revokeObjectURL(url));
        }
      } else {
        // If there are no local photos, clear the state
        if (isMounted) {
          setLocalPhotoUrls(new Map());
        }
      }
    };

    fetchLocalPhotos();

    return () => {
      isMounted = false;
      // Revoke all URLs that were created in this effect run
      urlsToRevoke.forEach(url => URL.revokeObjectURL(url));
      // Also revoke any URLs currently in state to be safe
      localPhotoUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [completions]);

  const [showOtherCompletionsDialog, setShowOtherCompletionsDialog] = useState(false);


  const hasNote = React.useMemo(() => {
    const hasMyNote = completions.some(c => c.note);
    const hasOtherNote = otherStaffCompletions?.some(s => s.completions.some(c => c.note));
    return hasMyNote || hasOtherNote;
  }, [completions, otherStaffCompletions]);

  const renderProgressBadge = () => {
    if (completions.length === 0) return null;
    return (
      <div className="absolute -right-2 -top-1 z-10 pointer-events-none">
        {completions.length >= minCompletions ? (
          <div className="flex items-center justify-center h-5 w-5 rounded-full bg-green-500 text-white shadow-sm border border-white/50 animate-in zoom-in-50 duration-300">
            <CheckCircle2 className="w-3 h-3" />
          </div>
        ) : (
          <div className="flex items-center justify-center h-5 min-w-[22px] px-1 text-slate-600 text-[9px] font-black shadow-sm animate-in zoom-in-50 duration-300">
            {completions.length}/{minCompletions}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn(
      'group relative flex flex-col h-full min-w-0 w-full rounded-2xl transition-all duration-300 p-3',
      !className && 'bg-white border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)]',
      !isCompleted && task.isCritical && !className && 'border-amber-500/40 shadow-[0_4px_12px_rgba(245,158,11,0.1)]',
      isCompleted && !className && 'border-green-500/30 shadow-[0_2px_8px_rgba(34,197,94,0.06)]',
      className
    )}>
      {/* Header: Task Text */}
      <div className="flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className={cn(
              "text-[12.5px] font-bold leading-[1.3] transition-colors",
              isCompleted ? "text-green-700" : "text-slate-900"
            )}>
              {task.text}
              <Dialog dialogTag={`instruction-${task.id}`} parentDialogTag="root">
                <DialogTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      "ml-1.5 inline-flex items-center justify-center h-5 w-5 rounded-full transition-transform active:scale-95",
                      task.instruction 
                        ? "bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100/50 hover:bg-indigo-100" 
                        : "text-slate-300 hover:text-slate-400"
                    )}
                    aria-label="Xem hướng dẫn"
                  >
                    <HelpCircle className="w-3 h-3" />
                  </button>
                </DialogTrigger>
                <DialogContent 
                  className="w-[340px] p-0 rounded-[2.5rem] overflow-hidden border-0 shadow-[0_20px_50px_rgba(0,0,0,0.25)] z-[60] bg-white" 
                  hideClose
                  onInteractOutside={(e) => {
                    // Prevent closing if the lightbox is opening or open
                    if (isLightboxOpen) e.preventDefault();
                  }}
                >
                  <DialogHeader 
                    variant="premium"
                    icon={<HelpCircle className="w-5 h-5" />}
                  >
                    <DialogTitle className="text-[17px] font-extrabold tracking-tight leading-none">Cẩm nang tiêu chuẩn</DialogTitle>
                    <DialogDescription className="text-[12px] font-medium">Hướng dẫn thực hiện và báo cáo</DialogDescription>
                  </DialogHeader>

                  <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto outline-none">
                    {task.instruction?.text ? (
                      <div className="relative">
                        <div className="absolute -left-2 top-0 bottom-0 w-1 bg-indigo-500 rounded-full opacity-50" />
                        <p className="text-slate-600 text-[14px] leading-[1.6] whitespace-pre-wrap font-medium lowercase first-letter:uppercase pl-3">
                          {task.instruction.text}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-slate-50 rounded-2xl p-6 border border-dashed border-slate-200 text-center">
                        <p className="text-slate-400 text-[12px] font-bold leading-relaxed tracking-wide italic uppercase">
                          Chưa cập nhật hướng dẫn
                        </p>
                        <p className="text-slate-400 text-[11px] mt-1 font-medium">Vui lòng thông báo cho chủ quán để bổ sung</p>
                      </div>
                    )}

                    {task.instruction?.images && task.instruction.images.length > 0 && (
                      <div className="space-y-4 border-t border-slate-50 pt-5">
                        <div className="flex items-center gap-2 px-1">
                          <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                          <h4 className="text-slate-400 text-[11px] font-black uppercase tracking-[0.1em]">Hình ảnh minh họa</h4>
                        </div>
                        <div className="flex flex-wrap gap-3 px-1 text-center">
                          {task.instruction.images.map((img, i) => (
                            <div 
                              key={i} 
                              className="relative h-24 w-[calc(50%-6px)] rounded-2xl overflow-hidden shadow-sm border border-slate-100 bg-slate-100 shrink-0 cursor-zoom-in active:scale-[0.98] transition-all group hover:border-indigo-200"
                              onClick={() => onOpenLightbox(task.instruction!.images!.map(src => ({ src })), i)}
                            >
                              <Image 
                                src={img} 
                                alt={`HD ${i + 1}`} 
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                              />
                              <div className="absolute top-2 right-2 bg-black/40 px-2 py-0.5 backdrop-blur-md rounded-lg border border-white/20">
                                <span className="text-[9px] font-black text-white uppercase tracking-tighter">Mẫu {i + 1}</span>
                              </div>
                              <div className="absolute inset-0 bg-indigo-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="px-6 pb-6 mt-auto">
                    <div className="h-px w-full bg-slate-100 mb-5" />
                    <DialogClose asChild>
                      <button className="w-full py-4 rounded-2xl bg-slate-50 text-slate-500 text-[13px] font-bold hover:bg-indigo-50 hover:text-indigo-600 transition-all active:scale-[0.98]">
                        Đã hiểu
                      </button>
                    </DialogClose>
                  </div>
                </DialogContent>
              </Dialog>
            </h3>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-2">
          {task.type === 'boolean' && (
            <div className="relative">
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn(
                    "h-8 w-8 rounded-lg transition-all shrink-0",
                    hasNote
                      ? "text-primary bg-primary/10 shadow-sm border border-primary/20 hover:bg-primary/20"
                      : "text-slate-400 hover:text-primary hover:bg-primary/5"
                  )}
                  onClick={() => onNoteAction(task)}
                  disabled={isReadonly}
                  aria-label="Ghi chú"
                  title="Ghi chú"
                >
                  <MessageSquareText className={cn("h-4 w-4", hasNote && "fill-current")} />
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className={cn(
                    "flex-1 h-8 rounded-xl text-[11px] font-bold transition-all active:scale-95",
                    isCompleted ? "border-green-200 text-green-700 bg-green-50/30" : "border-slate-200 text-slate-600 hover:border-green-500 hover:text-green-600 hover:bg-green-50"
                  )}
                  onClick={() => onBooleanAction(task.id, true)}
                  disabled={isDisabledForNew}
                >
                  <ThumbsUp className="mr-1.5 h-3 w-3" />
                </Button>
              </div>
              {renderProgressBadge()}
            </div>
          )} 

          {task.type === 'opinion' && (
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                className="w-full h-8 rounded-xl text-[11px] font-bold border-amber-200 bg-amber-50/50 text-amber-700 hover:bg-amber-100 transition-all active:scale-95"
                onClick={() => onOpinionAction(task)}
                disabled={isReadonly}
              >
                <FilePen className="mr-1.5 h-3 w-3" />
                Ghi nhận ý kiến
              </Button>
              {renderProgressBadge()}
            </div>
          )}
        </div>
      </div>

      {/* Completions Display (Ultra Compact) */}
      {combinedCompletions.length > 0 && (
        <div className="p-1 rounded-xl bg-slate-50/60 border border-slate-100 flex flex-col gap-1">
          <div className="flex items-center justify-between px-1">
            <span className="text-[9px] font-bold uppercase tracking-tight text-slate-400/80">Nhật ký</span>
            {combinedCompletions.length > 1 && (
              <button
                onClick={() => onToggleExpand(task.id)}
                className="text-[9px] font-extrabold text-primary flex items-center gap-0.5 active:scale-95 transition-transform"
              >
                {isExpanded ? (
                  <>THU GỌN <ChevronUp className="h-2.5 w-2.5" /></>
                ) : (
                  <>+{combinedCompletions.length - 1} KHÁC <ChevronDown className="h-2.5 w-2.5" /></>
                )}
              </button>
            )}
          </div>

          <div className="space-y-1">
            {(isExpanded ? combinedCompletions : combinedCompletions.slice(0, 1)).map((entry, idx) => (
              <div
                key={`${entry.userId || 'self'}-${idx}`}
                className="flex items-center justify-between bg-white px-1.5 py-1 rounded-lg border border-slate-100/50 shadow-[0_1px_1px_rgba(0,0,0,0.01)]"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Clock className="h-2.5 w-2.5 text-slate-300 shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-slate-700 truncate leading-tight">
                        {entry.staffName === 'Bạn' ? 'Bạn' : generateShortName(entry.staffName)}
                      </span>
                      {entry.completion.photoIds && entry.completion.photoIds.length > 0 && (
                        <ImageIcon className="h-2 w-2 text-blue-400 shrink-0" />
                      )}
                    </div>
                    <span className="text-[9px] font-medium text-slate-400/80 leading-none">
                      {entry.completion.timestamp}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            className="w-full py-0.5 text-[9px] font-bold uppercase tracking-tight text-slate-400 hover:text-primary transition-colors"
            onClick={() => setShowOtherCompletionsDialog(true)}
          >
            Xem Chi tiết
          </button>
        </div>
      )}

      <CompletionsDialog
        open={showOtherCompletionsDialog}
        onOpenChange={setShowOtherCompletionsDialog}
        otherStaffCompletions={otherStaffCompletions}
        taskName={task.text}
        taskType={task.type}
        onOpenLightbox={onOpenLightbox}
        currentStaffName={'Bạn'}
        currentCompletions={completions}
        onDeleteCurrentCompletion={(index) => onDeleteCompletion(task.id, index)}
        onDeleteCurrentPhoto={(completionIndex, photoId) => onDeletePhoto(task.id, completionIndex, photoId, true)}
        parentDialogTag="root"
      />

      {/* Photo action moved to bottom (hidden for single-completion tasks after done) */}
      {task.type === 'photo' && (
        <div className="mt-2 relative">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className={cn(
                "h-8 w-8 rounded-lg transition-all shrink-0",
                hasNote
                  ? "text-primary bg-primary/10 shadow-sm border border-primary/20 hover:bg-primary/20"
                  : "text-slate-400 hover:text-primary hover:bg-primary/5"
              )}
              onClick={() => onNoteAction(task)}
              disabled={isReadonly}
              aria-label="Ghi chú"
              title="Ghi chú"
            >
              <MessageSquareText className={cn("h-4 w-4", hasNote && "fill-current")} />
            </Button>

            <Button
              size="sm"
              variant={isCompleted ? "outline" : "default"}
              className={cn(
                "flex-1 h-8 rounded-xl text-[11px] font-bold transition-all active:scale-95",
                isCompleted ? "border-green-200 text-green-700 hover:bg-green-50" : "shadow-sm shadow-primary/10"
              )}
              onClick={() => {
                // Decide whether to append to newest completion or create a new one
                // For single-completion tasks: always append to the (only) completion if it exists
                // For multi-completion tasks: append to newest completion if within 20 minutes, otherwise create new
                let completionIndex: number | null = null;

                if (isSingleCompletion) {
                  completionIndex = (completions && completions.length > 0) ? 0 : null;
                } else {
                  if (completions && completions.length > 0) {
                    const newest = completions[0];
                    if (newest?.timestamp) {
                      const [h, m] = newest.timestamp.split(':').map(Number);
                      const now = new Date();
                      const ts = new Date(now);
                      ts.setHours(h || 0, m || 0, 0, 0);

                      // If timestamp appears to be in the future (e.g., past midnight), assume previous day
                      if (ts.getTime() > now.getTime()) ts.setDate(ts.getDate() - 1);

                      const diffMinutes = Math.abs((now.getTime() - ts.getTime()) / 60000);
                      if (diffMinutes <= MIN_TIME_FOR_ONE_TASK) {
                        completionIndex = 0;
                      }
                    }
                  }
                }

                onPhotoAction(task, completionIndex);
              }}
              disabled={isDisabledForNew}
            >
              <Camera className="h-3 w-3" />
            </Button>
          </div>
          {renderProgressBadge()}
        </div>
      )}
    </div>
  );
};

export const TaskItem = React.memo(TaskItemComponent);
