'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Info,
  MessageSquare,
  ChevronRight,
  Video,
  ListFilter,
  ClipboardCheck,
  ChevronsUpDown,
  ChevronsDownUp
} from 'lucide-react';
import { useLightbox } from '@/contexts/lightbox-context';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { AssignedShift, ManagedUser, Schedule, ShiftBusyEvidence, BusyReportRequest, UserRole } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { toast } from '@/components/ui/pro-toast';
import { subscribeToBusyReportRequestsForWeek, setBusyReportRecipients } from '@/lib/schedule-store';
import { cn } from '@/lib/utils';
import { getRoleColor, userMatchesRole, toDate, buildSlides, getEligibleAndPendingUsers, getRelevantUnderstaffedShifts, getShiftMissingDetails } from './understaffed-evidence-utils';

export function UnderstaffedEvidenceDialog({
  open,
  onOpenChange,
  schedule,
  allUsers,
  evidences,
  parentDialogTag
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: Schedule | null;
  allUsers: ManagedUser[];
  evidences: ShiftBusyEvidence[];
  parentDialogTag: string;
}) {
  const { openLightbox } = useLightbox();

  const understaffedShifts = useMemo<AssignedShift[]>(() => {
    const shifts = getRelevantUnderstaffedShifts(schedule, allUsers, { currentUser: null, roleAware: false });
    return shifts.sort((a, b) => {
      if (a.date === b.date) {
        return a.timeSlot.start.localeCompare(b.timeSlot.start);
      }
      return a.date.localeCompare(b.date);
    });
  }, [schedule, allUsers]);

  // Also group evidences by shift, even for those not strictly "understaffed" anymore
  const shiftsWithEvidences = useMemo(() => {
    const shiftIds = new Set(evidences.map(e => e.shiftId));
    return (schedule?.shifts || []).filter(s => shiftIds.has(s.id));
  }, [schedule, evidences]);

  const [expandedUnderstaffed, setExpandedUnderstaffed] = useState<string[]>([]);
  const [expandedAll, setExpandedAll] = useState<string[]>([]);

  // Initialize expanded state when data changes or dialog opens
  useEffect(() => {
    if (open) {
      setExpandedUnderstaffed(understaffedShifts.map(s => s.id));
      setExpandedAll([]); // Keep "All" collapsed by default to avoid clutter
    }
  }, [open, understaffedShifts]);

  const { user } = useAuth();
  const [busyRequests, setBusyRequests] = useState<BusyReportRequest[]>([]);
  const [editTargets, setEditTargets] = useState<Record<string, { mode: 'users' | 'roles' | 'all'; userIds: string[]; roles: UserRole[] }>>({});

  useEffect(() => {
    const weekId = schedule?.weekId || '';
    if (!open || !weekId) return;
    const unsub = subscribeToBusyReportRequestsForWeek(weekId, setBusyRequests);
    return () => unsub();
  }, [open, schedule?.weekId]);

  useEffect(() => {
    if (!open) return;
    setEditTargets(prev => {
      const next: Record<string, { mode: 'users' | 'roles' | 'all'; userIds: string[]; roles: UserRole[] }> = {};
      for (const shift of understaffedShifts) {
        const req = busyRequests.find(r => r.shiftId === shift.id && r.active);
        next[shift.id] = req
          ? {
            mode: req.targetMode,
            userIds: req.targetUserIds || [],
            roles: req.targetRoles || [],
          }
          : { mode: 'all', userIds: [], roles: [] };
      }
      return next;
    });
  }, [open, busyRequests, understaffedShifts]);

  const handleTargetModeChange = (shiftId: string, mode: 'users' | 'roles' | 'all') => {
    setEditTargets(prev => ({
      ...prev,
      [shiftId]: { ...prev[shiftId], mode },
    }));
  };

  const handleToggleRole = (shiftId: string, role: UserRole) => {
    setEditTargets(prev => {
      const current = prev[shiftId] || { mode: 'all', userIds: [], roles: [] };
      const exists = current.roles.includes(role);
      const roles = exists ? current.roles.filter(r => r !== role) : [...current.roles, role];
      return { ...prev, [shiftId]: { ...current, roles } };
    });
  };

  const handleToggleUser = (shiftId: string, userId: string) => {
    setEditTargets(prev => {
      const current = prev[shiftId] || { mode: 'all', userIds: [], roles: [] };
      const exists = current.userIds.includes(userId);
      const userIds = exists ? current.userIds.filter(id => id !== userId) : [...current.userIds, userId];
      return { ...prev, [shiftId]: { ...current, userIds } };
    });
  };

  const handleSaveTargets = async (shift: AssignedShift) => {
    if (!user || !schedule) return;
    const target = editTargets[shift.id];
    if (!target) return;
    try {
      await setBusyReportRecipients({
        weekId: schedule.weekId,
        shift,
        createdBy: { userId: user.uid, userName: user.displayName || 'Owner' },
        targetMode: target.mode,
        targetUserIds: target.userIds,
        targetRoles: target.roles,
        active: true,
      });
      toast.success('Đã lưu yêu cầu báo bận.');
    } catch (e) {
      console.error('Failed to set busy report targets', e);
      toast.error('Không thể lưu yêu cầu.');
    }
  };

  const getShiftStatus = (shift: AssignedShift, shiftEvidences: ShiftBusyEvidence[]) => {
    const reqs = shift.requiredRoles || [];
    const eligibleUsers = reqs.length > 0
      ? allUsers.filter(user => reqs.some(r => userMatchesRole(user, r.role)))
      : allUsers.filter((user) => userMatchesRole(user, shift.role));

    const submittedCount = shiftEvidences.length;
    const pendingCount = eligibleUsers.length - submittedCount;

    if (submittedCount > 0 && pendingCount === 0) return { label: 'Đã phản hồi đủ', color: 'text-green-600 bg-green-50 border-green-200' };
    if (submittedCount > 0) return { label: `Mới có ${submittedCount} phản hồi`, color: 'text-amber-600 bg-amber-50 border-amber-200' };
    return { label: 'Chưa có phản hồi', color: 'text-red-600 bg-red-50 border-red-200' };
  };

  const renderShiftItem = (shift: AssignedShift) => {
    const shiftEvidences = evidences.filter((entry) => entry.shiftId === shift.id);
    const missingDetails = getShiftMissingDetails(shift, allUsers);
    const totalMissing = missingDetails.totalMissing;
    const isActuallyUnderstaffed = totalMissing > 0;
    const reqs = shift.requiredRoles || [];
    const shiftActiveReq = busyRequests.find(r => r.shiftId === shift.id && r.active);
    const { pendingUsers, eligibleUsers } = getEligibleAndPendingUsers(shift, allUsers, shiftEvidences, shiftActiveReq);

    // If an owner has targeted recipients for this shift, filter the pending list to those targets
    let displayedPendingUsers = pendingUsers;
    if (shiftActiveReq) {
      if (shiftActiveReq.targetMode === 'all') {
        displayedPendingUsers = pendingUsers;
      } else if (shiftActiveReq.targetMode === 'roles') {
        const roles = shiftActiveReq.targetRoles || [];
        displayedPendingUsers = pendingUsers.filter(u => roles.includes(u.role));
      } else if (shiftActiveReq.targetMode === 'users') {
        const ids = shiftActiveReq.targetUserIds || [];
        displayedPendingUsers = pendingUsers.filter(u => ids.includes(u.uid));
      }
    }

    const shiftDate = parseISO(shift.date);
    const status = getShiftStatus(shift, shiftEvidences);

    return (
      <AccordionItem key={shift.id} value={shift.id} className="border rounded-xl px-4 bg-card overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
        <AccordionTrigger className="hover:no-underline py-4">
          <div className="flex flex-1 flex-col sm:flex-row sm:items-center justify-between text-left gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">{shift.label}</span>
                <Badge variant="outline" className={cn("text-[10px] px-2 h-5 font-bold uppercase tracking-wider", getRoleColor(shift.role))}>{shift.role}</Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary/70" />
                  {format(shiftDate, 'eeee, dd/MM', { locale: vi })}
                </div>
                <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                <span>{shift.timeSlot.start} - {shift.timeSlot.end}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:pr-6">
              {isActuallyUnderstaffed && (
                <Badge variant="destructive" className="h-7 px-3 font-bold shadow-sm shadow-destructive/20 ring-2 ring-destructive/10">
                  {missingDetails.text}
                </Badge>
              )}
              <Badge variant="secondary" className={cn("h-7 px-3 border font-semibold", status.color)}>
                {status.label}
              </Badge>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pb-4 pt-2">
          <Separator className="mb-4" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground text-[10px]">Phản hồi từ nhân viên ({shiftEvidences.length})</h4>
              </div>

              {shiftEvidences.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 bg-muted/30 rounded-lg border border-dashed">
                  <Info className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground italic text-center">Chưa có nhân viên nào gửi minh chứng bận cho ca này</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {shiftEvidences.map((entry) => {
                    const submittedAt = toDate(entry.submittedAt);
                    const mediaSlides = entry.media ? buildSlides(entry.media) : [];
                    return (
                      <div key={entry.id} className="relative bg-muted/20 rounded-2xl p-4 border border-border/50 shadow-sm">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold border border-primary/20">
                              {entry.submittedBy.userName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-sm">{entry.submittedBy.userName}</p>
                              {submittedAt && (
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-2 w-2" />
                                  {formatDistanceToNow(submittedAt, { addSuffix: true, locale: vi })}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="pl-0 space-y-3">
                          <div className="bg-background/50 rounded-xl p-2.5 border border-border/30">
                            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap italic">
                              "{entry.message}"
                            </p>
                          </div>

                          {entry.media && entry.media.length > 0 && (
                            <div className="flex flex-wrap gap-2.5">
                              {entry.media.map((attachment, idx) => (
                                <button
                                  key={attachment.url}
                                  className="group relative h-24 w-24 rounded-xl overflow-hidden border-2 border-background shadow-sm hover:scale-105 transition-all duration-300"
                                  onClick={() => openLightbox(mediaSlides, idx)}
                                >
                                  {attachment.type === 'photo' ? (
                                    <Image
                                      src={attachment.url}
                                      alt="Bằng chứng"
                                      fill
                                      className="object-cover"
                                    />
                                  ) : (
                                    <div className="relative h-full w-full bg-black">
                                      <video src={`${attachment.url}#t=0.1`} className="h-full w-full object-cover opacity-80" muted playsInline />
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                        <div className="bg-white/20 backdrop-blur-sm p-1.5 rounded-full">
                                          <Video className="h-5 w-5 text-white" />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-muted/30 rounded-2xl p-5 border shadow-sm space-y-5">
                <div className="space-y-3">
                  <h4 className="font-semibold text-[10px] uppercase tracking-[0.1em] text-muted-foreground flex items-center gap-2">
                    <ListFilter className="h-3 w-3" /> Nhân sự yêu cầu
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {reqs.length > 0 ? (
                      reqs.map(r => (
                        <div key={r.role} className="flex items-center gap-1.5 bg-background border px-2 py-1 rounded-lg">
                          <span className="text-xs font-bold text-primary">{r.count}</span>
                          <span className="text-[10px] text-muted-foreground">{r.role}</span>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center gap-1.5 bg-background border px-2 py-1 rounded-lg">
                        <span className="text-xs font-bold text-primary">{shift.minUsers || 0}</span>
                        <span className="text-[10px] text-muted-foreground">Bất kỳ</span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <h4 className="font-semibold text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                    Chưa phản hồi ({displayedPendingUsers.length})
                  </h4>
                  {displayedPendingUsers.length === 0 ? (
                    <div className="flex items-center gap-2 text-green-600 text-xs font-medium bg-green-50 p-2.5 rounded-xl border border-green-100">
                      <ClipboardCheck className="h-4 w-4" />
                      Tất cả đã phản hồi
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {displayedPendingUsers.map((user) => (
                        <Badge key={user.uid} variant="secondary" className="bg-background text-[10px] py-0 px-2.5 h-7 border-dashed border font-medium">
                          {user.displayName}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-background rounded-2xl p-5 border shadow-sm space-y-4">
                <h4 className="font-semibold text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Yêu cầu báo bận</h4>
                <div className="text-xs text-muted-foreground">
                  {busyRequests.find(r => r.shiftId === shift.id && r.active) ? (
                    <span>Đang yêu cầu: {(() => {
                      const r = busyRequests.find(x => x.shiftId === shift.id && x.active)!;
                      if (r.targetMode === 'all') return 'Tất cả nhân viên phù hợp';
                      if (r.targetMode === 'roles') return `Theo vai trò (${(r.targetRoles || []).join(', ')})`;
                      if (r.targetMode === 'users') return `Người cụ thể (${(r.targetUserIds || []).length})`;
                      return '';
                    })()}</span>
                  ) : (
                    <span>Chưa cấu hình. Chọn đối tượng nhận yêu cầu.</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(['all', 'roles', 'users'] as const).map(mode => (
                    <Button
                      key={mode}
                      variant={editTargets[shift.id]?.mode === mode ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 px-3 rounded-lg text-[11px]"
                      onClick={() => handleTargetModeChange(shift.id, mode)}
                    >
                      {mode === 'all' ? 'Tất cả' : mode === 'roles' ? 'Theo vai trò' : 'Chọn người'}
                    </Button>
                  ))}
                </div>
                {editTargets[shift.id]?.mode === 'roles' && (
                  <div className="flex flex-wrap gap-1.5">
                    {(['Phục vụ', 'Pha chế', 'Thu ngân', 'Quản lý'] as UserRole[]).map(role => (
                      <Badge
                        key={role}
                        variant="outline"
                        className={cn('text-[10px] py-0 px-2.5 h-7 border font-medium cursor-pointer', editTargets[shift.id]?.roles.includes(role) ? 'bg-primary/10 border-primary/30' : 'bg-background')}
                        onClick={() => handleToggleRole(shift.id, role)}
                      >
                        {role}
                      </Badge>
                    ))}
                  </div>
                )}
                {editTargets[shift.id]?.mode === 'users' && (
                  <div className="flex flex-wrap gap-1.5">
                    {eligibleUsers.map(u => (
                      <Badge
                        key={u.uid}
                        variant="secondary"
                        className={cn('text-[10px] py-0 px-2.5 h-7 border font-medium cursor-pointer', editTargets[shift.id]?.userIds.includes(u.uid) ? 'bg-primary/10 border-primary/30' : 'bg-background')}
                        onClick={() => handleToggleUser(shift.id, u.uid)}
                      >
                        {u.displayName}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex justify-end items-center gap-2">
                  <Button size="sm" className="rounded-lg h-8 px-4 font-bold" onClick={() => handleSaveTargets(shift)}>
                    Lưu yêu cầu
                  </Button>
                  {busyRequests.find(r => r.shiftId === shift.id && r.active) && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="rounded-lg h-8 px-3 font-bold"
                      onClick={async () => {
                        if (!user || !schedule) return;
                        const r = busyRequests.find(x => x.shiftId === shift.id && x.active)!;
                        try {
                          await setBusyReportRecipients({
                            weekId: schedule.weekId,
                            shift,
                            createdBy: { userId: user.uid, userName: user.displayName || 'Owner' },
                            targetMode: r.targetMode,
                            targetUserIds: r.targetUserIds || [],
                            targetRoles: r.targetRoles || [],
                            active: false,
                          });
                          toast.success('Đã hủy yêu cầu báo bận.');
                          setEditTargets(prev => ({ ...prev, [shift.id]: { mode: 'all', userIds: [], roles: [] } }));
                        } catch (err) {
                          console.error('Failed to cancel busy report request', err);
                          toast.error('Không thể hủy yêu cầu.');
                        }
                      }}
                    >
                      Hủy yêu cầu
                    </Button>
                  )}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3 text-amber-900 shadow-sm">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  Hệ thống đề xuất bạn nên liên hệ trực tiếp những nhân viên chưa phản hồi để hỗ trợ hoặc tìm phương án thay thế kịp thời.
                </p>
              </div>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} dialogTag="understaffed-evidence-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col min-h-0 p-0 overflow-hidden sm:rounded-3xl border-none shadow-2xl">
        <DialogHeader className="p-8 pb-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500 rounded-2xl shadow-lg shadow-amber-500/20">
                <AlertTriangle className="h-7 w-7 text-white" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-2xl font-bold tracking-tight">Chi tiết báo bận</DialogTitle>
                <DialogDescription className="text-amber-800/70 dark:text-amber-200/50">
                  {understaffedShifts.length} ca đang thiếu nhân sự cần xử lý.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="understaffed" className="flex-1 flex flex-col min-h-0">
          <div className="px-8 border-b bg-card">
            <TabsList className="h-12 bg-transparent p-0 gap-8">
              <TabsTrigger
                value="understaffed"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-12 px-0 text-sm font-semibold"
              >
                Ca đang thiếu người ({understaffedShifts.length})
              </TabsTrigger>
              <TabsTrigger
                value="all"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-12 px-0 text-sm font-semibold"
              >
                Tất cả báo bận ({shiftsWithEvidences.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea aria-label="Understaffed evidence list" className="flex-1 min-h-0 max-h-[90vh] overflow-auto">
            <div className="p-6 pb-24">
              <TabsContent value="understaffed" className="m-0 focus-visible:outline-none">
                {understaffedShifts.length > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-amber-50/50 dark:bg-amber-950/10 p-4 rounded-3xl border border-amber-100 dark:border-amber-900/30">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-amber-100 dark:bg-amber-900/40 rounded-2xl flex items-center justify-center">
                        <ListFilter className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold">Ca đang thiếu nhân sự</h3>
                        <p className="text-xs text-amber-700/70 dark:text-amber-300/50 font-medium">Tìm thấy {understaffedShifts.length} ca cần điều chỉnh lịch</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="bg-background/50 hover:bg-background h-10 px-4 rounded-xl text-xs font-bold gap-2 border shadow-sm transition-all"
                        onClick={() => setExpandedUnderstaffed(understaffedShifts.map(s => s.id))}
                      >
                        <ChevronsUpDown className="h-4 w-4 text-amber-500" />
                        Mở rộng tất cả
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="bg-background/50 hover:bg-background h-10 px-4 rounded-xl text-xs font-bold gap-2 border shadow-sm transition-all"
                        onClick={() => setExpandedUnderstaffed([])}
                      >
                        <ChevronsDownUp className="h-4 w-4 text-muted-foreground" />
                        Thu gọn tất cả
                      </Button>
                    </div>
                  </div>
                )}

                {understaffedShifts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in duration-500">
                    <div className="bg-green-100 dark:bg-green-900/30 p-8 rounded-full mb-6">
                      <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-2xl font-bold">Lịch làm việc đã ổn định!</h3>
                    <p className="text-muted-foreground max-w-sm mx-auto mt-3 leading-relaxed">
                      Hiện tại không còn ca nào đang ở trạng thái thiếu nhân sự. Bạn có thể yên tâm với tiến độ vận hành.
                    </p>
                  </div>
                ) : (
                  <Accordion
                    type="multiple"
                    className="space-y-4"
                    value={expandedUnderstaffed}
                    onValueChange={setExpandedUnderstaffed}
                  >
                    {understaffedShifts.map(shift => renderShiftItem(shift))}
                  </Accordion>
                )}
              </TabsContent>

              <TabsContent value="all" className="m-0 focus-visible:outline-none">
                {shiftsWithEvidences.length > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-muted/30 p-4 rounded-3xl border border-dashed">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-muted rounded-2xl flex items-center justify-center">
                        <MessageSquare className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold">Tất cả báo bận</h3>
                        <p className="text-xs text-muted-foreground font-medium">Tổng số {shiftsWithEvidences.length} ca có phản hồi từ nhân viên</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="bg-background/50 hover:bg-background h-10 px-4 rounded-xl text-xs font-bold gap-2 border shadow-sm transition-all"
                        onClick={() => setExpandedAll(shiftsWithEvidences.map(s => s.id))}
                      >
                        <ChevronsUpDown className="h-4 w-4 text-primary" />
                        Mở rộng tất cả
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="bg-background/50 hover:bg-background h-10 px-4 rounded-xl text-xs font-bold gap-2 border shadow-sm transition-all"
                        onClick={() => setExpandedAll([])}
                      >
                        <ChevronsDownUp className="h-4 w-4 text-muted-foreground" />
                        Thu gọn tất cả
                      </Button>
                    </div>
                  </div>
                )}

                {shiftsWithEvidences.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="bg-muted p-8 rounded-full mb-6">
                      <MessageSquare className="h-16 w-16 text-muted-foreground" />
                    </div>
                    <h3 className="text-2xl font-bold font-heading">Chưa có báo cáo nào</h3>
                    <p className="text-muted-foreground max-w-sm mx-auto mt-3 leading-relaxed">
                      Nhân viên chưa gửi bất kỳ báo cáo bận nào cho lịch làm việc tuần này.
                    </p>
                  </div>
                ) : (
                  <Accordion
                    type="multiple"
                    className="space-y-4"
                    value={expandedAll}
                    onValueChange={setExpandedAll}
                  >
                    {shiftsWithEvidences.map(shift => renderShiftItem(shift))}
                  </Accordion>
                )}
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>

        <DialogFooter className="p-4 border-t bg-muted/20 flex flex-col sm:flex-row gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl px-8 order-2 sm:order-1">
            Đóng
          </Button>
          {/* <div className="flex-1 order-1 sm:order-2" /> */}
          {/* <Button className="rounded-xl px-10 gap-3 font-bold shadow-xl shadow-primary/10 order-0 sm:order-3">
             Gửi thông báo nhắc nhở <ChevronRight className="h-4 w-4" />
          </Button> */}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
