
'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Camera, Clock, X, Trash2, AlertCircle, FilePlus2, ThumbsDown, ThumbsUp, FilePen, ChevronDown, ChevronUp, Star } from 'lucide-react';
import type { Task, CompletionRecord } from '@/lib/types';
import { cn } from '@/lib/utils';
import { photoStore } from '@/lib/photo-store';


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
  onOpenLightbox: (photos: {src: string}[], startIndex: number) => void;
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
}: TaskItemProps) => {
  const isCompletedOnce = completions.length > 0;
  const isDisabledForNew = (isSingleCompletion && isCompletedOnce && task.type !== 'opinion') || isReadonly;

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
         if(isMounted) {
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

  const handleOpenLightbox = (allPhotosInTask: {src: string}[], currentPhotoUrl: string) => {
      const startIndex = allPhotosInTask.findIndex(p => p.src === currentPhotoUrl);
      onOpenLightbox(allPhotosInTask, startIndex >= 0 ? startIndex : 0);
  };
  
  const allPhotosInTask = completions.flatMap(c => 
    [...(c.photos || []), ...(c.photoIds || []).map(id => localPhotoUrls.get(id) || '')]
    .filter(Boolean)
    .map(url => ({ src: url }))
  );

  return (
    <div className={cn('rounded-md border p-4 transition-colors', isCompletedOnce ? 'bg-accent/20' : '')}>
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
        <p className="font-semibold flex-1 flex items-center gap-2">
            {task.isCritical && <Star className="h-4 w-4 text-yellow-500 shrink-0" />}
            {task.text}
        </p>
        <div className="flex items-center gap-2 w-full sm:w-auto flex-shrink-0">
          {task.type === 'photo' && (
            <Button
              size="sm"
              className="w-full active:scale-95 transition-transform"
              onClick={() => onPhotoAction(task)}
              disabled={isDisabledForNew}
            >
              <Camera className="mr-2 h-4 w-4" />
              Đã hoàn thành
            </Button>
          )}
          {task.type === 'boolean' && (
            <div className="flex flex-col sm:flex-row w-full gap-2">
              <Button
                size="sm"
                variant={"outline"}
                className="w-full"
                onClick={() => onBooleanAction(task.id, true)}
                disabled={isDisabledForNew}
              >
                <ThumbsUp className="mr-2 h-4 w-4" /> Đảm bảo
              </Button>
              <Button
                size="sm"
                variant={"outline"}
                className="w-full"
                onClick={() => onBooleanAction(task.id, false)}
                disabled={isDisabledForNew}
              >
                <ThumbsDown className="mr-2 h-4 w-4" /> Không đảm bảo
              </Button>
            </div>
          )}
          {task.type === 'opinion' && (
            <Button
              size="sm"
              className="w-full"
              onClick={() => onOpinionAction(task)}
              disabled={isReadonly}
            >
              <FilePen className="mr-2 h-4 w-4" /> Ghi nhận ý kiến
            </Button>
          )}
        </div>
      </div>

      {isCompletedOnce && (
        <div className="mt-4 space-y-3">
          {(isExpanded ? completions : completions.slice(0, 1)).map((completion, cIndex) => (
            <div key={cIndex} className="rounded-md border bg-card p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 flex-shrink-0" />
                  <span>Thực hiện lúc: {completion.timestamp}</span>
                </div>
                <div className="flex items-center gap-1">
                  {completion.value !== undefined && (
                    <Badge variant={completion.value ? "default" : "destructive"}>
                      {completion.value ? "Đảm bảo" : "Không đảm bảo"}
                    </Badge>
                  )}
                  {!isReadonly && task.type === 'photo' && (
                    <TooltipProvider>
                        <Tooltip>
                        <TooltipTrigger asChild>
                             <Button size="xs" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => onPhotoAction(task, cIndex)}>
                                <FilePlus2 className="h-3 w-3" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Thêm ảnh</p>
                        </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                  )}
                  {!isReadonly && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild disabled={isReadonly}>
                      <Button size="xs" variant="ghost" className="text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertCircle className="text-destructive" />
                          Bạn có chắc chắn không?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Hành động này sẽ xóa lần hoàn thành công việc này và tất cả các ảnh liên quan.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDeleteCompletion(task.id, cIndex)}>Xóa</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {(completion.photos || []).map((photoUrl, pIndex) => (
                  <div key={photoUrl} className="relative z-0 overflow-hidden aspect-square rounded-md group bg-muted">
                    <button onClick={() => handleOpenLightbox(allPhotosInTask, photoUrl)} className="w-full h-full block">
                      <Image src={photoUrl} alt={`Ảnh bằng chứng ${pIndex + 1}`} fill className="object-cover" />
                    </button>
                  </div>
                ))}
                {(completion.photoIds || []).map((photoId) => {
                  const photoUrl = localPhotoUrls.get(photoId);
                  if (!photoUrl) return null;
                  return (
                    <div key={photoId} className="relative z-0 overflow-hidden aspect-square rounded-md group bg-muted">
                       <button onClick={() => handleOpenLightbox(allPhotosInTask, photoUrl)} className="w-full h-full block">
                        <Image src={photoUrl} alt={`Ảnh bằng chứng chưa gửi`} fill className="object-cover" />
                      </button>
                       {!isReadonly && (
                        <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full z-10"
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                onDeletePhoto(task.id, cIndex, photoId, true); 
                            }}
                        >
                            <X className="h-3 w-3" />
                            <span className="sr-only">Xóa ảnh</span>
                        </Button>
                        )}
                    </div>
                  );
                })}
              </div>
              {completion.opinion && (
                <p className="text-sm italic bg-muted p-3 rounded-md border">"{completion.opinion}"</p>
              )}
            </div>
          ))}
          {completions.length > 1 && (
            <Button variant="link" size="sm" onClick={() => onToggleExpand(task.id)} className="w-full text-muted-foreground">
              {isExpanded ? 'Thu gọn' : `Xem thêm (${completions.length - 1})`}
              {isExpanded ? <ChevronUp className="ml-1.5 h-4 w-4" /> : <ChevronDown className="ml-1.5 h-4 w-4" />}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export const TaskItem = React.memo(TaskItemComponent);
