
'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Camera, Clock, X, Trash2, AlertCircle, FilePlus2, ThumbsDown, ThumbsUp, FilePen, ChevronDown, ChevronUp, Star, MapPin, CheckCircle2, MessageSquareText, Image as ImageIcon, Eye } from 'lucide-react';
import CompletionGalleryDialog from '@/components/completion-gallery-dialog';
import type { Task, CompletionRecord } from '@/lib/types';
import { cn } from '@/lib/utils';
import { photoStore } from '@/lib/photo-store';
import { differenceInMinutes } from 'date-fns';


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
  className,
}: TaskItemProps) => {
  const isCompletedOnce = completions.length > 0;
  const isDisabledForNew = (isSingleCompletion && isCompletedOnce && task.type !== 'opinion') || isReadonly;

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

  const handleOpenLightbox = (allPhotosInTask: { src: string }[], currentPhotoUrl: string) => {
    const startIndex = allPhotosInTask.findIndex(p => p.src === currentPhotoUrl);
    onOpenLightbox(allPhotosInTask, startIndex >= 0 ? startIndex : 0);
  };

  const allPhotosInTask = completions.flatMap(c =>
    [...(c.photos || []), ...(c.photoIds || []).map(id => localPhotoUrls.get(id) || '')]
      .filter(Boolean)
      .map(url => ({ src: url }))
  );

  const [isGalleryOpen, setIsGalleryOpen] = React.useState(false);
  const [galleryImages, setGalleryImages] = React.useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = React.useState(0);


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

      {/* Completions Display */}
      {isCompletedOnce && (
        <div className="mt-2 space-y-2 border-t border-dashed pt-2">
          {(isExpanded ? completions : completions.slice(0, 1)).map((completion, cIndex) => (
            <div key={cIndex} className="relative group/item">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center gap-1 text-sm font-semibold text-foreground">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{completion.timestamp}</span>
                  </div>
                </div>

                {!isReadonly && (
                  <div className="flex items-center gap-1">
                    {(() => {
                      // Prepare photos for this specific completion
                      const completionPhotos = [
                        ...(completion.photos || []),
                        ...((completion.photoIds || []).map((id) => localPhotoUrls.get(id)).filter(Boolean) as string[])
                      ];

                      const [h, m] = completion.timestamp.split(":").map(Number);
                      const compDate = new Date(); compDate.setHours(h, m);

                      return (
                        <>
                          {task.type === 'photo' && completionPhotos.length > 0 && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-primary relative"
                              onClick={() => { setGalleryImages(completionPhotos); setGalleryIndex(0); setIsGalleryOpen(true); }}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center text-[10px] font-bold bg-primary text-white rounded-full h-4 w-4">
                                {completionPhotos.length}
                              </span>
                            </Button>
                          )}

                          {task.type === 'photo' && (() => {
                            if (differenceInMinutes(currentTime, compDate) < 10 || isSingleCompletion) {
                              return (
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-primary" onClick={() => onPhotoAction(task, cIndex)}>
                                  <FilePlus2 className="h-3 w-3" />
                                </Button>
                              );
                            }
                            return null;
                          })()}

                          {/* Gallery dialog */}
                          <CompletionGalleryDialog
                            isOpen={isGalleryOpen}
                            onClose={() => setIsGalleryOpen(false)}
                            images={galleryImages}
                          />

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-2xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-base">Xóa lần thực hiện này?</AlertDialogTitle>
                                <AlertDialogDescription className="text-sm">Hành động này không thể hoàn tác.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl">Hủy</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDeleteCompletion(task.id, cIndex)} className="rounded-xl bg-destructive text-destructive-foreground">Xóa</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>



              {/* Opinion Text */}
              {completion.opinion && (
                <div className="mt-1.5 flex gap-2 p-2 bg-muted/50 rounded-lg border border-dashed">
                  <MessageSquareText className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-[11px] italic text-muted-foreground leading-tight">{completion.opinion}</p>
                </div>
              )}
            </div>
          ))}

          {completions.length > 1 && (
            <button
              onClick={() => onToggleExpand(task.id)}
              className="w-full py-1 text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1"
            >
              {isExpanded ? 'THU GỌN' : `XEM THÊM (${completions.length - 1})`}
              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
        </div>
      )}

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
