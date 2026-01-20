'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Camera, ImageIcon, Send, CalendarDays, Users, Loader2, CheckCircle2, Clock, MessageSquareQuote, ChevronDown, RefreshCw, Trash2, Edit } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { parseISO, isBefore, startOfToday, isSameDay } from 'date-fns';
import MediaPreview from './MediaPreview';
import type { DailyTask, DailyTaskReport, MediaItem } from '@/lib/types';
import { cn } from '@/lib/utils';

type TaskCardProps = {
  task: DailyTask;
  reports: DailyTaskReport[];
  canSubmit: boolean;
  pendingMedia: MediaItem[];
  pendingNote: string;
  onSetPendingNote: (taskId: string, note: string) => void;
  onAddProofMedia: (taskId: string, media: MediaItem[]) => void;
  onSubmitReport: (task: DailyTask) => void;
  onSetActiveTaskForProof: (taskId: string | null) => void;
  pendingReportId?: string | null;
  // New props for expanding/collapsing reports
  reportsExpanded?: boolean;
  onToggleReports?: (taskId: string) => void;
  onRegenerate?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onEdit?: (taskId: string) => void;
};

export default function TaskCard({ task, reports, canSubmit, pendingMedia, pendingNote, onSetPendingNote, onAddProofMedia, onSubmitReport, onSetActiveTaskForProof, pendingReportId, reportsExpanded, onToggleReports, onRegenerate, onDelete, onEdit }: TaskCardProps) {
  const isCompleted = task.status === 'completed';
  const isInReview = task.status === 'in_review';

  // date-based indicators
  const assignedDateObj = task.assignedDate ? parseISO(task.assignedDate) : null;
  const isExpired = assignedDateObj ? isBefore(assignedDateObj, startOfToday()) && !isCompleted : false;
  const needsReport = assignedDateObj ? reports.length === 0 && !isCompleted && !isInReview && !isExpired && (isBefore(assignedDateObj, startOfToday()) || isSameDay(assignedDateObj, startOfToday())) : false;

  // dialog state for safer, consistent confirmations (replaces window.confirm)
  const [openDeleteDialog, setOpenDeleteDialog] = React.useState(false);
  const [openRegenerateDialog, setOpenRegenerateDialog] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isRegenerating, setIsRegenerating] = React.useState(false);

  const handleConfirmDelete = React.useCallback(async () => {
    // support sync or async parent handlers
    if (!onDelete) return setOpenDeleteDialog(false);
    setIsDeleting(true);
    try {
      // support sync or async parent handlers in a single, type-safe step
      await Promise.resolve((onDelete as any)?.(task.id));
      setOpenDeleteDialog(false);
    } catch (err) {
      // parent should surface errors; log for diagnostics
      console.error('delete failed', err);
    } finally {
      setIsDeleting(false);
    }
  }, [onDelete, task.id]);

  const handleDelete = React.useCallback(() => {
    setOpenDeleteDialog(true);
  }, []);

  const handleConfirmRegenerate = React.useCallback(async () => {
    if (!onRegenerate) return setOpenRegenerateDialog(false);
    setIsRegenerating(true);
    try {
      // support sync or async parent handlers in a single, type-safe step
      await Promise.resolve((onRegenerate as any)?.(task.id));
      setOpenRegenerateDialog(false);
    } catch (err) {
      console.error('regenerate failed', err);
    } finally {
      setIsRegenerating(false);
    }
  }, [onRegenerate, task.id]);

  const handleRegenerate = React.useCallback(() => {
    setOpenRegenerateDialog(true);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      layout
    >
      <Card key={task.id} className={cn(
        "group overflow-hidden border transition-all duration-300",
        isCompleted ? "border-green-100 bg-green-50/10" : "border-border shadow-sm"
      )}>
        <div className={cn(
          "h-1 w-full",
          isCompleted ? "bg-green-500" : isInReview ? "bg-amber-400" : "bg-primary/20"
        )} />

        <CardHeader className="space-y-4 pb-3 p-4 sm:p-6 sm:pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5 flex-1">
              <CardTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors line-clamp-2">
                {task.title}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] sm:text-xs text-muted-foreground">
                <div className="flex items-center gap-1 bg-muted/30 px-1.5 py-0.5 rounded">
                  <Clock className="h-3 w-3 text-primary/70" />
                  <span className="font-medium text-foreground/70">{task.assignedDate}</span>
                </div>
                {task.createdBy && (
                  <div className="flex items-center gap-1 opacity-80">
                    <Users className="h-3 w-3" />
                    <span>Giao bởi: <span className="font-semibold">{task.createdBy.userName}</span></span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <Badge
                variant={isCompleted ? 'default' : isInReview ? 'secondary' : 'outline'}
                className={cn(
                  "px-2 py-0.5 text-[9px] sm:text-xs font-black uppercase tracking-widest",
                  isCompleted && "bg-green-600 hover:bg-green-600 shadow-sm shadow-green-200",
                  isInReview && "bg-amber-100 text-amber-700 border-amber-200"
                )}
              >
                {isCompleted ? 'Xong' : isInReview ? 'Duyệt' : 'Mới'}
              </Badge>

              <div className="flex flex-col items-end gap-1">
                {isCompleted && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-50 text-green-700 text-[10px] font-bold border border-green-100">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    Hoàn tất
                  </span>
                )}
                {!isCompleted && isExpired && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 text-red-700 text-[10px] font-bold border border-red-100 animate-pulse">
                    Quá hạn
                  </span>
                )}
                {!isCompleted && needsReport && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100">
                    Chờ báo cáo
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <div className="absolute -left-3 top-0 bottom-0 w-1 bg-primary/20 rounded-full" />
              <p className="text-sm leading-relaxed text-foreground/80 pl-4">
                {task.description}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="bg-muted/5 font-medium text-[10px] border-muted-foreground/10 px-2 py-0.5">
                  <Users className="mr-1.5 h-3 w-3 text-muted-foreground" />
                  {task.targetMode === 'roles' ? (task.targetRoles || []).join(', ') : `${(task.targetUserIds || []).length} người`}
                </Badge>
              </div>

              {/* Collapsed Admin Actions Bar - More clean and grouped */}
              {(onEdit || onDelete || (isExpired && onRegenerate)) && (
                <div className="flex items-center gap-1">
                  {isInReview && onEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(task.id)}
                      className="h-7 px-2 text-[10px] font-bold border-primary/20 text-primary hover:bg-primary/5 shadow-none"
                    >
                      <Edit className="mr-1 h-3 w-3" />
                      Sửa
                    </Button>
                  )}

                  {isExpired && onRegenerate && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRegenerate}
                      className="h-7 px-2 text-[10px] font-bold border-primary/20 text-primary hover:bg-primary/5 shadow-none group/btn"
                    >
                      <RefreshCw className="mr-1 h-3 w-3 transition-transform group-hover/btn:rotate-180" />
                      Giao lại
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDelete}
                      className="h-7 px-2 text-[10px] font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      Xóa
                    </Button>
                  )}
                </div>
              )}
            </div>

            {task.media && task.media.length > 0 && (
              <div className="rounded-lg bg-muted/20 p-2.5 sm:p-3 space-y-2 border border-muted-foreground/5">
                <div className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/70 flex items-center gap-2">
                  <span className="h-px bg-muted-foreground/20 flex-1" />
                  Hướng dẫn mẫu
                  <span className="h-px bg-muted-foreground/20 flex-1" />
                </div>
                <MediaPreview media={task.media} />
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-5 p-4 sm:p-6 sm:pt-0">
          {reports.length > 0 && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => onToggleReports?.(task.id)}
                aria-expanded={reportsExpanded}
                className={cn(
                  "w-full flex items-center justify-between gap-2 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all",
                  "text-muted-foreground hover:text-primary py-1.5 px-2 -mx-2 rounded-md hover:bg-primary/5"
                )}
              >
                <div className="flex items-center gap-2">
                  <MessageSquareQuote className="h-3.5 w-3.5" />
                  <span>Báo cáo hoàn thành ({reports.length})</span>
                </div>
                <div className={cn(
                  "flex items-center gap-1 transition-transform duration-300",
                  reportsExpanded ? "rotate-180 text-primary" : ""
                )}>
                  <ChevronDown className="h-4 w-4" />
                </div>
              </button>
              <div className="space-y-3">
                {/* Parent renders ReportCard (parent controls visibility) */}
              </div>
            </div>
          )}

          <AnimatePresence>
            {canSubmit && !isCompleted && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border-2 border-dashed border-primary/20 bg-primary/5 p-3 sm:p-4 space-y-4">
                  <div className="flex items-center gap-2 text-[11px] sm:text-sm font-black uppercase tracking-wider text-primary">
                    <CheckCircle2 className="h-4 w-4" />
                    Gửi báo cáo của bạn
                  </div>

                  <div className="space-y-4">
                    <Textarea
                      placeholder="Ghi chú kết quả, khó khăn hoặc đề xuất..."
                      value={pendingNote}
                      onChange={(e) => onSetPendingNote(task.id, e.target.value)}
                      rows={2}
                      className="resize-none bg-background border-primary/10 focus-visible:ring-primary/20 text-xs sm:text-sm placeholder:italic"
                    />

                    <div className="grid grid-cols-2 gap-3 items-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSetActiveTaskForProof(task.id)}
                        className={cn(
                          "h-10 text-[11px] font-bold bg-background transition-all border-dashed shadow-none border-primary text-primary"
                        )}
                      >
                        <Camera className={cn("mr-2 h-4 w-4")} />
                        {pendingMedia.length > 0 ? `${pendingMedia.length} Ảnh` : "Báo cáo"}
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => onSubmitReport(task)}
                        disabled={pendingReportId === task.id || (!pendingNote.trim() && pendingMedia.length === 0)}
                        className="h-10 text-[11px] font-black uppercase tracking-widest shadow-lg shadow-primary/20"
                      >
                        {pendingReportId === task.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="mr-2 h-4 w-4" />
                        )}
                        Gửi
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>

        {/* Confirm dialogs (replace native confirm) */}
        {onDelete && (
          <AlertDialog
            open={openDeleteDialog}
            onOpenChange={(open) => { if (isDeleting) return; setOpenDeleteDialog(open); }}
          >
            <AlertDialogContent aria-busy={isDeleting}>
              <AlertDialogHeader>
                <AlertDialogTitle>Xóa nhiệm vụ</AlertDialogTitle>
                <AlertDialogDescription>Hành động này không thể hoàn tác. Bạn có chắc chắn muốn xóa nhiệm vụ này?</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Hủy</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive"
                  onClick={handleConfirmDelete}
                  isLoading={isDeleting}
                  disabled={isDeleting}
                  aria-disabled={isDeleting}
                >
                  Xóa
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {isExpired && onRegenerate && (
          <AlertDialog
            open={openRegenerateDialog}
            onOpenChange={(open) => { if (isRegenerating) return; setOpenRegenerateDialog(open); }}
          >
            <AlertDialogContent aria-busy={isRegenerating}>
              <AlertDialogHeader>
                <AlertDialogTitle>Giao lại nhiệm vụ</AlertDialogTitle>
                <AlertDialogDescription>Bạn có chắc muốn giao lại nhiệm vụ này cho hôm nay?</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isRegenerating}>Hủy</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmRegenerate} isLoading={isRegenerating} disabled={isRegenerating} aria-disabled={isRegenerating}>
                  Giao lại
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </Card>
    </motion.div>
  );
}

