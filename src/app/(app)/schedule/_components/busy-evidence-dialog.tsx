'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { format, addWeeks, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/pro-toast';
import { Camera, Upload, Trash2, Loader2, AlertTriangle, Check } from 'lucide-react';
import { dataStore } from '@/lib/data-store';
import { photoStore } from '@/lib/photo-store';
import { cn } from '@/lib/utils';
import type { AssignedShift, MediaAttachment, MediaItem, Schedule, ShiftBusyEvidence, UserRole, ManagedUser } from '@/lib/types';
import type { AuthUser } from '@/hooks/use-auth';
import CameraDialog from '@/components/camera-dialog';
import { v4 as uuidv4 } from 'uuid';
import { getShiftMissingDetails } from '../../shift-scheduling/_components/understaffed-evidence-utils';

const getRoleColor = (role: UserRole | 'Bất kỳ'): string => {
  switch (role) {
    case 'Phục vụ':
      return 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800/50';
    case 'Pha chế':
      return 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800/50';
    case 'Thu ngân':
      return 'bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800/50';
    case 'Quản lý':
      return 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800/50';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-100 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-800/50';
  }
};

type LocalMedia = {
  id: string;
  url: string;
  type: 'photo' | 'video';
};

type DraftState = {
  note: string;
  initialNote: string;
  existingAttachments: MediaAttachment[];
  newMedia: LocalMedia[];
  dirty: boolean;
  isSubmitting: boolean;
};

type BusyEvidenceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: Schedule | null;
  currentUser: AuthUser | null;
  weekId: string;
  evidences: ShiftBusyEvidence[];
  relevantShifts: AssignedShift[]; // Provided by WeekScheduleDialog — do not recalculate locally
  allUsers: ManagedUser[]; // required to compute effective assigned roles
  parentDialogTag: string;
};

const toDate = (value: ShiftBusyEvidence['submittedAt']) => {
  if (!value) return null;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const maybeTimestamp = value as { toDate?: () => Date } | null;
  if (maybeTimestamp?.toDate) {
    try {
      return maybeTimestamp.toDate();
    } catch (error) {
      console.warn('Failed to convert timestamp to date', error);
      return null;
    }
  }
  return null;
};

const getWeekRange = (weekId: string) => {
  const [yearStr, weekStr] = weekId.split('-W');
  const year = Number(yearStr);
  const week = Number(weekStr);
  if (!year || !week) return null;

  const jan4 = new Date(year, 0, 4);
  const weekStart = addWeeks(startOfWeek(jan4, { weekStartsOn: 1 }), week - 1);
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  return { start: weekStart, end: weekEnd };
};

export function BusyEvidenceDialog({ open, onOpenChange, schedule, currentUser, weekId, evidences, relevantShifts, allUsers, parentDialogTag }: BusyEvidenceDialogProps) {
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [activeCameraShiftId, setActiveCameraShiftId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const cleanupMediaList = useCallback((items: LocalMedia[]) => {
    items.forEach((item) => {
      URL.revokeObjectURL(item.url);
      photoStore.deletePhoto(item.id).catch(() => null);
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setDrafts((prev) => {
        Object.values(prev).forEach((draft) => cleanupMediaList(draft.newMedia));
        return {};
      });
      setActiveCameraShiftId(null);
    }
  }, [open, cleanupMediaList]);



  useEffect(() => {
    if (!open || !currentUser) return;

    setDrafts((prev) => {
      const next: Record<string, DraftState> = {};

      (relevantShifts || []).forEach((shift) => {
        const existing = evidences.find((entry) => entry.shiftId === shift.id && entry.submittedBy.userId === currentUser.uid);
        const serverNote = existing?.message ?? '';
        const serverMedia = existing?.media ? [...existing.media] : [];
        const previousDraft = prev[shift.id];

        if (previousDraft) {
          next[shift.id] = {
            ...previousDraft,
            existingAttachments: serverMedia,
            initialNote: serverNote,
            note: previousDraft.dirty ? previousDraft.note : serverNote,
            isSubmitting: false,
          };
        } else {
          next[shift.id] = {
            note: serverNote,
            initialNote: serverNote,
            existingAttachments: serverMedia,
            newMedia: [],
            dirty: false,
            isSubmitting: false,
          };
        }
      });

      Object.keys(prev).forEach((shiftId) => {
        if (!next[shiftId]) {
          cleanupMediaList(prev[shiftId].newMedia);
        }
      });

      return next;
    });
  }, [open, relevantShifts, evidences, currentUser, cleanupMediaList]);

  const pendingCount = useMemo(() => {
    if (!currentUser) return 0;
    return relevantShifts.reduce((count, shift) => {
      const hasSubmitted = evidences.some((entry) => entry.shiftId === shift.id && entry.submittedBy.userId === currentUser.uid);
      return hasSubmitted ? count : count + 1;
    }, 0);
  }, [relevantShifts, evidences, currentUser]);

  const weekRange = useMemo(() => getWeekRange(weekId), [weekId]);

  const handleNoteChange = (shiftId: string, value: string) => {
    setDrafts((prev) => {
      const draft = prev[shiftId];
      if (!draft) return prev;
      return {
        ...prev,
        [shiftId]: {
          ...draft,
          note: value,
          dirty: value.trim() !== draft.initialNote.trim(),
        },
      };
    });
  };

  const handleRemoveExistingAttachment = (shiftId: string, url: string) => {
    setDrafts((prev) => {
      const draft = prev[shiftId];
      if (!draft) return prev;
      return {
        ...prev,
        [shiftId]: {
          ...draft,
          existingAttachments: draft.existingAttachments.filter((att) => att.url !== url),
        },
      };
    });
  };

  const handleRemoveNewMedia = (shiftId: string, mediaId: string) => {
    setDrafts((prev) => {
      const draft = prev[shiftId];
      if (!draft) return prev;
      const target = draft.newMedia.find((item) => item.id === mediaId);
      if (target) {
        URL.revokeObjectURL(target.url);
        photoStore.deletePhoto(target.id).catch(() => null);
      }
      return {
        ...prev,
        [shiftId]: {
          ...draft,
          newMedia: draft.newMedia.filter((item) => item.id !== mediaId),
        },
      };
    });
  };

  const handleCameraSubmit = async (media: { id: string; type: 'photo' | 'video' }[]) => {
    if (!activeCameraShiftId || media.length === 0) {
      setActiveCameraShiftId(null);
      return;
    }

    const urlMap = await photoStore.getPhotosAsUrls(media.map((item) => item.id));
    const newItems: LocalMedia[] = media
      .map((item) => {
        const url = urlMap.get(item.id);
        if (!url) return null;
        return { id: item.id, type: item.type, url };
      })
      .filter(Boolean) as LocalMedia[];

    if (newItems.length === 0) {
      setActiveCameraShiftId(null);
      return;
    }

    setDrafts((prev) => {
      const draft = prev[activeCameraShiftId];
      if (!draft) return prev;
      return {
        ...prev,
        [activeCameraShiftId]: {
          ...draft,
          newMedia: [...draft.newMedia, ...newItems],
        },
      };
    });
    setActiveCameraShiftId(null);
  };

  const handleFileUpload = async (shiftId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newItems: LocalMedia[] = [];
    for (const file of Array.from(files)) {
      const id = uuidv4();
      await photoStore.addPhoto(id, file);
      const url = URL.createObjectURL(file);
      const type: 'photo' | 'video' = file.type.startsWith('video') ? 'video' : 'photo';
      newItems.push({ id, url, type });
    }

    setDrafts((prev) => {
      const draft = prev[shiftId];
      if (!draft) return prev;
      return {
        ...prev,
        [shiftId]: {
          ...draft,
          newMedia: [...draft.newMedia, ...newItems],
        },
      };
    });

    event.target.value = '';
  };

  const handleSubmitEvidence = async (shiftId: string) => {
    if (!currentUser) return;
    const draft = drafts[shiftId];
    const shift = relevantShifts.find((item) => item.id === shiftId);
    if (!draft || !shift) return;

    const totalAttachments = draft.existingAttachments.length + draft.newMedia.length;
    if (!draft.note.trim()) {
      toast.error('Vui lòng mô tả lý do bạn bận trong ca này.');
      return;
    }
    if (totalAttachments === 0) {
      toast.error('Vui lòng bổ sung ít nhất một ảnh hoặc video minh chứng.');
      return;
    }

    setDrafts((prev) => ({
      ...prev,
      [shiftId]: {
        ...draft,
        isSubmitting: true,
      },
    }));

    const payloadMedia: MediaItem[] = draft.newMedia.map((item) => ({ id: item.id, type: item.type }));

    try {
      await dataStore.submitShiftBusyEvidence({
        weekId,
        shift,
        user: { userId: currentUser.uid, userName: currentUser.displayName || 'Không tên' },
        message: draft.note,
        newMedia: payloadMedia,
        existingAttachments: draft.existingAttachments,
      });

      cleanupMediaList(draft.newMedia);

      const trimmedNote = draft.note.trim();
      setDrafts((prev) => ({
        ...prev,
        [shiftId]: {
          ...prev[shiftId],
          newMedia: [],
          initialNote: trimmedNote,
          note: trimmedNote,
          dirty: false,
          isSubmitting: false,
        },
      }));

      toast.success('Đã gửi báo bận thành công.');
    } catch (error: any) {
      console.error('submitShiftBusyEvidence failed', error);
      toast.error(error?.message || 'Không thể gửi báo bận.');
      setDrafts((prev) => ({
        ...prev,
        [shiftId]: {
          ...prev[shiftId],
          isSubmitting: false,
        },
      }));
    }
  };

  const handleOpenAttachment = (url: string) => {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} dialogTag="busy-evidence-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden border-none sm:rounded-2xl">
        <DialogHeader className="p-4 pb-0 space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg sm:text-xl font-bold font-headline">Báo bận cho ca thiếu người</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm line-clamp-1">
                {weekRange
                  ? `Tuần ${format(weekRange.start, 'dd/MM')} - ${format(weekRange.end, 'dd/MM/yyyy')}`
                  : 'Vui lòng cung cấp lý do và bằng chứng bạn bận.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!currentUser ? (
          <div className="p-8 text-center text-muted-foreground italic flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
            Đang xác định tài khoản...
          </div>
        ) : relevantShifts.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground italic text-sm">
            Không có ca thiếu người phù hợp vai trò của bạn.
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-4 py-2">
              <div className={cn(
                'flex items-center gap-3 rounded-xl border px-4 py-2.5 text-xs sm:text-sm transition-all duration-300',
                pendingCount > 0
                  ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-900/10'
                  : 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-900/10'
              )}>
                <div className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  pendingCount > 0 ? 'bg-amber-100 dark:bg-amber-800/40 text-amber-600' : 'bg-emerald-100 dark:bg-emerald-800/40 text-emerald-600'
                )}>
                  {pendingCount > 0 ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-bold leading-tight">
                    {pendingCount > 0 ? 'Yêu cầu báo bận' : 'Đã hoàn thành'}
                  </p>
                  <p className="text-muted-foreground text-[11px] sm:text-xs leading-tight">
                    {pendingCount > 0 ? (
                      <>Còn <strong>{pendingCount}</strong>/{relevantShifts.length} ca cần bạn xác nhận.</>
                    ) : (
                      'Bạn đã xác nhận toàn bộ ca thiếu người.'
                    )}
                  </p>
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1 px-4 pb-4 overflow-auto">
              <div className="space-y-4">
                {relevantShifts.map((shift) => {
                  const draft = drafts[shift.id];
                  if (!draft) return null;

                  const missingCount = Math.max(0, (shift.minUsers ?? 0) - shift.assignedUsers.length);
                  const submitted = evidences.find((entry) => entry.shiftId === shift.id && entry.submittedBy.userId === currentUser.uid);
                  const submittedAt = submitted ? toDate(submitted.submittedAt) : null;
                  const shiftDate = parseISO(shift.date);
                  const isSubmitted = !!submitted;

                  return (
                    <div
                      key={shift.id}
                      className={cn(
                        "group relative overflow-hidden rounded-xl border transition-all duration-300",
                        isSubmitted ? "border-emerald-100 bg-emerald-50/20 dark:border-emerald-900/30 dark:bg-emerald-900/5 shadow-none" : "bg-card border-slate-200 dark:border-slate-800 shadow-sm"
                      )}
                    >
                      {/* Accent Bar */}
                      <div className={cn(
                        "absolute top-0 left-0 w-1 h-full transition-all duration-300",
                        isSubmitted ? "bg-emerald-500" : "bg-primary/20 group-hover:bg-primary/40"
                      )} />

                      <div className="p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex gap-3">
                            <div className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-base font-bold",
                              getRoleColor(shift.role)
                            )}>
                              {shift.label.slice(0, 1)}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <h3 className="text-base font-bold tracking-tight">{shift.label}</h3>
                                <Badge variant="outline" className={cn('text-[9px] px-1 py-0 h-3.5 font-bold uppercase leading-none', getRoleColor(shift.role))}>{shift.role}</Badge>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">
                                  {format(shiftDate, 'EEE, dd/MM', { locale: vi })}
                                </span>
                                <span className="text-muted-foreground/30">•</span>
                                <span className="font-semibold text-primary">
                                  {shift.timeSlot.start} - {shift.timeSlot.end}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 self-start shrink-0">
                            <Badge variant="destructive" className="rounded-md font-bold text-[10px] h-5">
                              {getShiftMissingDetails(shift, allUsers).text}
                            </Badge>
                            {submittedAt && (
                              <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/40 dark:border-emerald-800 dark:text-emerald-400 text-[10px] h-5">
                                {format(submittedAt, 'HH:mm dd/MM')}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 space-y-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-foreground inline-flex items-center gap-1.5">
                              Lý do bận
                              <span className="text-rose-500">*</span>
                            </label>
                            <Textarea
                              value={draft.note}
                              onChange={(event) => handleNoteChange(shift.id, event.target.value)}
                              placeholder="Mô tả cụ thể lịch bận (học, gia đình...)"
                              className="min-h-[80px] text-sm resize-none border-slate-200 focus:border-primary/50 focus:ring-primary/20 rounded-xl px-3 py-2"
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-xs font-bold text-foreground inline-flex items-center gap-1.5">
                                Minh chứng bằng hình ảnh/video
                                <span className="text-rose-500">*</span>
                              </label>
                              <div className="flex items-center gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-2.5 text-[11px] rounded-lg border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                                  onClick={() => setActiveCameraShiftId(shift.id)}
                                >
                                  <Camera className="mr-1.5 h-3.5 w-3.5 text-primary" />
                                  Chụp
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-2.5 text-[11px] rounded-lg border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                                  onClick={() => fileInputRefs.current[shift.id]?.click()}
                                >
                                  <Upload className="mr-1.5 h-3.5 w-3.5 text-primary" />
                                  Tải lên
                                </Button>
                                <input
                                  ref={(element) => {
                                    fileInputRefs.current[shift.id] = element;
                                  }}
                                  type="file"
                                  accept="image/*,video/*"
                                  multiple
                                  className="hidden"
                                  onChange={(event) => handleFileUpload(shift.id, event)}
                                />
                              </div>
                            </div>

                            <div className="min-h-[80px] rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 p-2.5 transition-all duration-300">
                              {(draft.existingAttachments.length > 0 || draft.newMedia.length > 0) ? (
                                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-1.5">
                                  {draft.existingAttachments.map((attachment) => (
                                    <div key={attachment.url} className="group/media relative aspect-square overflow-hidden rounded-lg border-2 border-white dark:border-slate-800 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
                                      {attachment.type === 'photo' ? (
                                        <Image
                                          src={attachment.url}
                                          alt="Đính kèm"
                                          fill
                                          className="cursor-pointer object-cover"
                                          onClick={() => handleOpenAttachment(attachment.url)}
                                        />
                                      ) : (
                                        <video
                                          src={`${attachment.url}#t=0.1`}
                                          className="h-full w-full cursor-pointer object-cover"
                                          muted
                                          playsInline
                                          onClick={() => handleOpenAttachment(attachment.url)}
                                        />
                                      )}
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center">
                                        <Button
                                          variant="destructive"
                                          size="icon"
                                          className="h-7 w-7 rounded-full"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveExistingAttachment(shift.id, attachment.url);
                                          }}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                  {draft.newMedia.map((item) => (
                                    <div key={item.id} className="group/media relative aspect-square overflow-hidden rounded-lg border-2 border-dashed border-primary/40 shadow-sm ring-1 ring-primary/20 bg-primary/5">
                                      {item.type === 'photo' ? (
                                        <Image
                                          src={item.url}
                                          alt="Mới"
                                          fill
                                          className="cursor-pointer object-cover"
                                          onClick={() => handleOpenAttachment(item.url)}
                                        />
                                      ) : (
                                        <video
                                          src={`${item.url}#t=0.1`}
                                          className="h-full w-full cursor-pointer object-cover"
                                          muted
                                          playsInline
                                          onClick={() => handleOpenAttachment(item.url)}
                                        />
                                      )}
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center">
                                        <Button
                                          variant="destructive"
                                          size="icon"
                                          className="h-7 w-7 rounded-full"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveNewMedia(shift.id, item.id);
                                          }}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="h-[80px] flex flex-col items-center justify-center text-muted-foreground gap-1">
                                  <Camera className="h-6 w-6 text-muted-foreground/30" />
                                  <p className="text-[11px] italic">Chưa có ảnh/video minh chứng.</p>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                            <Button
                              onClick={() => handleSubmitEvidence(shift.id)}
                              disabled={draft.isSubmitting || (isSubmitted && !draft.dirty)}
                              size="sm"
                              className={cn(
                                "h-9 px-5 rounded-lg font-bold transition-all duration-300 text-xs",
                                isSubmitted && !draft.dirty ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100" : "shadow-md shadow-primary/20"
                              )}
                            >
                              {draft.isSubmitting ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : isSubmitted && !draft.dirty ? (
                                <Check className="mr-1.5 h-3.5 w-3.5" />
                              ) : null}
                              {isSubmitted && !draft.dirty ? 'Đã gửi' : (isSubmitted && draft.dirty ? 'Cập nhật' : 'Gửi báo bận')}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
      <CameraDialog
        isOpen={Boolean(activeCameraShiftId)}
        onClose={() => setActiveCameraShiftId(null)}
        onSubmit={handleCameraSubmit}
        captureMode="both"
        parentDialogTag="busy-evidence-dialog"
      />
    </Dialog>
  );
}
