
'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Camera, Clock, X, Trash2, AlertCircle, FilePlus2, ThumbsDown, ThumbsUp, FilePen, ChevronDown, ChevronUp, Star, MapPin, CheckCircle2, MessageSquareText, Image as ImageIcon } from 'lucide-react';
import CompletionsDialog from '@/components/completions-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Task, CompletionRecord, ShiftReport } from '@/lib/types';
import { cn, generateShortName } from '@/lib/utils';
import { photoStore } from '@/lib/photo-store';
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
  onDeleteCompletion,
  onDeletePhoto,
  onToggleExpand,
  onOpenLightbox,
  otherStaffCompletions = [],
  className,
}: TaskItemProps) => {
  const isCompletedOnce = completions.length > 0;
  const isDisabledForNew = (isSingleCompletion && isCompletedOnce && task.type !== 'opinion') || isReadonly;

  const combinedCompletions = React.useMemo(() => {
    const out: { staffName: string; userId?: string; completion: CompletionRecord }[] = [];
    (completions || []).forEach(c => out.push({ staffName: 'Bạn', completion: c }));
    (otherStaffCompletions || []).forEach(s => (s.completions || []).forEach(c => out.push({ staffName: s.staffName, userId: s.userId, completion: c })));
    out.sort((a, b) => (b.completion.timestamp || '').localeCompare(a.completion.timestamp || ''));
    return out;
  }, [completions, otherStaffCompletions]);

  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    // Update the current time every minute to re-evaluate time-based conditions
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // 1 minute
    return () => clearInterval(timer);
  }, []);

  const [localPhotoUrls, setLocalPhotoUrls] = useState<Map<string, string>>(new Map());

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


  return (
    <div className={cn(
      'group relative flex flex-col h-full rounded-2xl transition-all duration-300 p-4',
      !className && 'bg-white border-slate-200 shadow-[0_4px_12px_rgba(0,0,0,0.05)]',
      !isCompletedOnce && task.isCritical && !className && 'border-amber-500/40 shadow-[0_8px_20px_rgba(245,158,11,0.12)]',
      isCompletedOnce && !className && 'border-green-500/30 shadow-[0_4px_12px_rgba(34,197,94,0.08)]',
      className
    )}>
      {/* Header: Task Text & Area */}
      <div className="flex-1 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              {task.area && (
                <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-widest text-slate-500 bg-slate-100 px-2 py-1 rounded-md mb-1">
                  <MapPin className="mr-1 h-2.5 w-2.5" />
                  {task.area}
                </span>
              )}
            </div>
            <h3 className={cn(
              "text-[13px] font-bold leading-snug line-clamp-3 transition-colors",
              isCompletedOnce ? "text-green-700" : "text-slate-900"
            )}>
              {task.text}
            </h3>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2">
          {task.type === 'boolean' && (
            <div className="grid">
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => onBooleanAction(task.id, true)}
                disabled={isDisabledForNew}
              >
                <ThumbsUp className="w-full" /> Đảm bảo
              </Button>
            </div>
          )}

          {task.type === 'opinion' && (
            <Button
              size="sm"
              variant="outline"
              className="w-full h-9 rounded-xl text-xs font-bold border-amber-200 bg-amber-50/50 text-amber-700 hover:bg-amber-100"
              onClick={() => onOpinionAction(task)}
              disabled={isReadonly}
            >
              <FilePen className="mr-2 h-3.5 w-3.5" />
              Ghi nhận ý kiến
            </Button>
          )}
        </div>
      </div>

      {/* Completions Display (compact) */}
      {combinedCompletions.length > 0 && (
        <div className="mt-2 space-y-2 border-t border-dashed pt-2">
          {(isExpanded ? combinedCompletions : combinedCompletions.slice(0, 1)).map((entry, idx) => (
            <div key={`${entry.userId || 'self'}-${idx}`} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">{entry.completion.timestamp}</span>
                <span className="text-sm font-bold text-slate-800 ml-2">{generateShortName(entry.staffName)}</span>
              </div>
            </div>
          ))}

          {combinedCompletions.length > 1 && (
            <button
              onClick={() => onToggleExpand(task.id)}
              className="w-full py-1 text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1"
            >
              {isExpanded ? 'THU GỌN' : `XEM THÊM (${combinedCompletions.length - 1})`}
              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}

          <div className="pt-1">
            <Button size="sm" variant="ghost" className="w-full text-[12px] font-bold" onClick={() => setShowOtherCompletionsDialog(true)}>
              Chi tiết
            </Button>
          </div>
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
      />

      {/* Photo action moved to bottom (hidden for single-completion tasks after done) */}
      {task.type === 'photo' && !(isSingleCompletion && isCompletedOnce) && (
        <div className="mt-3">
          <Button
            size="sm"
            variant={isCompletedOnce ? "outline" : "default"}
            className={cn(
              "w-full h-9 rounded-xl text-xs font-bold transition-all active:scale-95",
              isCompletedOnce ? "border-green-200 text-green-700 hover:bg-green-50" : "shadow-md shadow-primary/20"
            )}
            onClick={() => onPhotoAction(task)}
            disabled={isDisabledForNew}
          >
            <Camera className="mr-2 h-3.5 w-3.5" />
            Hoàn thành
          </Button>
        </div>
      )}
    </div>
  );
};

export const TaskItem = React.memo(TaskItemComponent);
