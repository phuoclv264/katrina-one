'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from '@/components/ui/image';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogBody,
  DialogAction,
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
import { cn, generateShortName } from '@/lib/utils';
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
      <AccordionItem key={shift.id} value={shift.id} className="border rounded-[1.5rem] bg-card overflow-hidden shadow-soft transition-all duration-200 mb-4 px-0">
        <AccordionTrigger className="hover:no-underline px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex flex-1 flex-col sm:flex-row sm:items-center justify-between text-left gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-base sm:text-lg tracking-tight">{shift.label}</span>
                <Badge variant="outline" className={cn("text-[10px] px-2 h-5 font-bold uppercase tracking-wider", getRoleColor(shift.role))}>{shift.role}</Badge>
              </div>
              <div className="flex items-center gap-3 text-[10px] sm:text-xs text-muted-foreground/80 font-medium">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary/60" />
                  {format(shiftDate, 'EEEE, dd/MM', { locale: vi })}
                </div>
                <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                <span className="text-secondary-foreground font-semibold">{shift.timeSlot.start} - {shift.timeSlot.end}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:pr-8">
              {isActuallyUnderstaffed && (
                <Badge variant="destructive" className="h-7 sm:h-8 px-3 sm:px-4 text-[10px] sm:text-xs font-bold rounded-full">
                  {missingDetails.text}
                </Badge>
              )}
              <Badge variant="secondary" className={cn("h-7 sm:h-8 px-3 sm:px-4 text-[10px] sm:text-xs font-bold rounded-full", status.color)}>
                {status.label}
              </Badge>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 sm:px-6 pb-6 pt-0">
          <Separator className="mb-4 sm:mb-6 opacity-30" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-1.5 bg-primary/10 rounded-lg">
                  <MessageSquare className="h-4 w-4 text-primary" />
                </div>
                <h4 className="font-bold text-[11px] uppercase tracking-widest text-muted-foreground/80">Phản hồi từ nhân viên ({shiftEvidences.length})</h4>
              </div>

              {shiftEvidences.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 sm:p-10 bg-muted/20 rounded-[1.5rem] border border-dashed border-muted-foreground/20">
                  <div className="p-3 bg-muted/30 rounded-full mb-3">
                    <Info className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm text-muted-foreground font-medium text-center">Chưa có nhân viên nào gửi minh chứng bận.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {shiftEvidences.map((entry) => {
                    const submittedAt = toDate(entry.submittedAt);
                    const mediaSlides = entry.media ? buildSlides(entry.media) : [];
                    return (
                      <div key={entry.id} className="relative bg-muted/20 rounded-[1.5rem] p-4 sm:p-5 border border-border/30 group hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 sm:h-11 w-10 sm:w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20 shadow-sm">
                              {entry.submittedBy.userName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-extrabold text-sm">{entry.submittedBy.userName}</p>
                              {submittedAt && (
                                <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1 mt-0.5">
                                  <Clock className="h-2.5 w-2.5 text-primary/40" />
                                  {formatDistanceToNow(submittedAt, { addSuffix: true, locale: vi })}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="bg-background/80 backdrop-blur-sm rounded-2xl p-3 sm:p-4 border border-border/20 shadow-sm">
                            <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap italic font-semibold">
                              "{entry.message}"
                            </p>
                          </div>

                          {entry.media && entry.media.length > 0 && (
                            <div className="flex flex-wrap gap-2 sm:gap-3">
                              {entry.media.map((attachment, idx) => (
                                <button
                                  key={attachment.url}
                                  className="group relative h-20 sm:h-24 w-20 sm:w-24 rounded-2xl overflow-hidden border-2 border-background shadow-md hover:scale-105 transition-all duration-300 ring-1 ring-border/50"
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
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition-colors">
                                        <div className="bg-white/30 backdrop-blur-md p-2 rounded-full ring-1 ring-white/50">
                                          <Video className="h-5 w-5 text-white shadow-sm" />
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

            <div className="space-y-5 sm:space-y-6">
              <div className="bg-muted/30 rounded-[1.5rem] p-4 sm:p-6 border shadow-sm space-y-5">
                <div className="space-y-3 sm:space-y-4">
                  <h4 className="font-bold text-[11px] uppercase tracking-widest text-muted-foreground/80 flex items-center gap-2">
                    <ListFilter className="h-3.5 w-3.5" /> Nhân sự yêu cầu
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {reqs.length > 0 ? (
                      reqs.map(r => (
                        <div key={r.role} className="flex items-center gap-2 bg-background border px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl shadow-sm">
                          <span className="text-xs font-extrabold text-primary">{r.count}</span>
                          <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground tracking-tight">{r.role}</span>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center gap-2 bg-background border px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl shadow-sm">
                        <span className="text-xs font-extrabold text-primary">{shift.minUsers || 0}</span>
                        <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground tracking-tight">Hệ thống</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="h-px bg-border/40" />

                <div className="space-y-3">
                  <h4 className="font-bold text-[11px] uppercase tracking-widest text-muted-foreground/80">
                    Chưa phản hồi ({displayedPendingUsers.length})
                  </h4>
                  {displayedPendingUsers.length === 0 ? (
                    <div className="flex items-center gap-2 text-green-600 text-[11px] font-bold py-2 bg-green-500/[0.03] px-3 rounded-xl border border-green-500/10">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Tất cả đã gửi bận
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 py-0.5">
                      {displayedPendingUsers.map((user, idx) => (
                        <div key={user.uid} className="flex items-center gap-2.5">
                          <span className="text-[11px] font-bold text-foreground/80 tracking-tight">
                            {generateShortName(user.displayName)}
                          </span>
                          {idx < displayedPendingUsers.length - 1 && (
                            <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-background rounded-[1.5rem] p-5 sm:p-6 border shadow-soft space-y-5">
                <h4 className="font-bold text-[11px] uppercase tracking-widest text-muted-foreground/80">Yêu cầu báo bận</h4>
                
                <div className="bg-primary/[0.03] rounded-xl p-3 sm:p-4 border border-primary/10">
                  <p className="text-[11px] font-semibold text-primary/80 leading-relaxed">
                    {busyRequests.find(r => r.shiftId === shift.id && r.active) ? (
                      <span>Đang yêu cầu: {(() => {
                        const r = busyRequests.find(x => x.shiftId === shift.id && x.active)!;
                        if (r.targetMode === 'all') return 'Tất cả nhân viên';
                        if (r.targetMode === 'roles') return `Theo vai trò (${(r.targetRoles || []).join(', ')})`;
                        if (r.targetMode === 'users') return `Người cụ thể (${(r.targetUserIds || []).length})`;
                        return '';
                      })()}</span>
                    ) : (
                      <span className="text-muted-foreground/60 italic font-medium">Chưa cấu hình yêu cầu mới.</span>
                    )}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="flex flex-wrap gap-2">
                    {(['all', 'roles', 'users'] as const).map(mode => (
                      <Button
                        key={mode}
                        variant={editTargets[shift.id]?.mode === mode ? 'default' : 'outline'}
                        size="sm"
                        className="h-8 sm:h-9 px-2 sm:px-3 rounded-xl text-[10px] font-bold flex-1"
                        onClick={() => handleTargetModeChange(shift.id, mode)}
                      >
                        {mode === 'all' ? 'Tất cả' : mode === 'roles' ? 'Vai trò' : 'Chọn người'}
                      </Button>
                    ))}
                  </div>
                  
                  {editTargets[shift.id]?.mode === 'roles' && (
                    <div className="flex flex-wrap gap-2 p-3 bg-muted/20 rounded-xl border border-dashed">
                      {(['Phục vụ', 'Pha chế', 'Thu ngân', 'Quản lý'] as UserRole[]).map(role => (
                        <Badge
                          key={role}
                          variant="outline"
                          className={cn('text-[10px] py-1 sm:py-1.5 px-2.5 sm:px-3 border-2 font-bold cursor-pointer transition-all', editTargets[shift.id]?.roles.includes(role) ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-background hover:bg-muted')}
                          onClick={() => handleToggleRole(shift.id, role)}
                        >
                          {role}
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  {editTargets[shift.id]?.mode === 'users' && (
                    <div className="flex flex-wrap gap-2 p-2 sm:p-3 bg-muted/20 rounded-xl border border-dashed max-h-40 overflow-y-auto">
                      {eligibleUsers.map(u => (
                        <Badge
                          key={u.uid}
                          variant="secondary"
                          className={cn('text-[10px] py-1 sm:py-1.5 px-2.5 sm:px-3 border font-extrabold cursor-pointer transition-all', editTargets[shift.id]?.userIds.includes(u.uid) ? 'bg-primary/20 border-primary/50 text-primary' : 'bg-background hover:bg-muted-foreground/10')}
                          onClick={() => handleToggleUser(shift.id, u.uid)}
                        >
                          {u.displayName}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2.5 pt-2">
                  <Button size="sm" className="rounded-xl h-9 sm:h-10 px-4 font-bold shadow-soft" onClick={() => handleSaveTargets(shift)}>
                    Lưu cấu hình
                  </Button>
                  {busyRequests.find(r => r.shiftId === shift.id && r.active) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-xl h-9 sm:h-10 px-3 font-extrabold text-destructive hover:bg-destructive/10 hover:text-destructive transition-all"
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
                      Dừng yêu cầu
                    </Button>
                  )}
                </div>
              </div>

              <div className="bg-amber-50/50 border border-amber-100 rounded-[1.5rem] p-4 sm:p-5 flex gap-3 text-amber-900 shadow-sm">
                <div className="h-5 w-5 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Info className="h-3 w-3 text-amber-600" />
                </div>
                <p className="text-[11px] leading-relaxed font-semibold opacity-80">
                  Hệ thống đề xuất bạn nên liên hệ trực tiếp những nhân viên chưa phản hồi để hỗ trợ kịp thời.
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
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col min-h-0 p-0 overflow-hidden sm:rounded-[2.5rem] border-none shadow-2xl">
        <DialogHeader iconkey="alert">
          <DialogTitle>Chi tiết báo bận</DialogTitle>
          <DialogDescription>
            {understaffedShifts.length} ca đang thiếu nhân sự cần xử lý.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="p-0 flex flex-col min-h-0">
          <Tabs defaultValue="understaffed" className="flex-1 flex flex-col min-h-0">
            <div className="px-6 border-b bg-muted/20">
              <TabsList className="h-14 bg-transparent p-0 gap-4 sm:gap-8 overflow-x-auto no-scrollbar justify-start sm:justify-center">
                <TabsTrigger
                  value="understaffed"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary h-14 px-1 sm:px-2 text-[11px] sm:text-xs font-bold transition-all uppercase tracking-wider"
                >
                  Thiếu nhân sự ({understaffedShifts.length})
                </TabsTrigger>
                <TabsTrigger
                  value="all"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary h-14 px-1 sm:px-2 text-[11px] sm:text-xs font-bold transition-all uppercase tracking-wider"
                >
                  Tất cả báo bận ({shiftsWithEvidences.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1 min-h-0 overflow-auto">
              <div className="p-6 pb-24">
                <TabsContent value="understaffed" className="m-0 focus-visible:outline-none ring-0 outline-none">
                  {understaffedShifts.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-amber-500/[0.04] p-5 rounded-[2rem] border border-amber-200/30">
                      <div className="flex items-center gap-4">
                        <div className="h-11 w-11 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">
                          <ListFilter className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <h3 className="text-sm font-extrabold text-amber-900 tracking-tight">Ca đang thiếu nhân sự</h3>
                          <p className="text-[11px] text-amber-700/60 font-bold">Cần sớm bổ sung nhân viên cho {understaffedShifts.length} ca</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="bg-background/80 hover:bg-background h-10 px-4 rounded-xl text-[10px] font-extrabold gap-2 border shadow-soft transition-all"
                          onClick={() => setExpandedUnderstaffed(understaffedShifts.map(s => s.id))}
                        >
                          <ChevronsUpDown className="h-3.5 w-3.5 text-amber-500" />
                          Mở hết
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="bg-background/80 hover:bg-background h-10 px-4 rounded-xl text-[10px] font-extrabold gap-2 border shadow-soft transition-all"
                          onClick={() => setExpandedUnderstaffed([])}
                        >
                          <ChevronsDownUp className="h-3.5 w-3.5 text-muted-foreground" />
                          Thu hết
                        </Button>
                      </div>
                    </div>
                  )}

                  {understaffedShifts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                      <div className="bg-green-500/10 p-10 rounded-full mb-6 border border-green-500/20 animate-pulse">
                        <CheckCircle2 className="h-20 w-20 text-green-500" />
                      </div>
                      <h3 className="text-2xl font-extrabold tracking-tight">Lịch làm việc đã ổn định!</h3>
                      <p className="text-muted-foreground/80 max-w-xs mx-auto mt-4 text-sm font-medium leading-relaxed">
                        Tất cả các ca đều đã đủ nhân sự hoặc có phương án thay thế phù hợp.
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

                <TabsContent value="all" className="m-0 focus-visible:outline-none ring-0 outline-none">
                  {shiftsWithEvidences.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-primary/[0.03] p-5 rounded-[2rem] border border-primary/10 border-dashed">
                      <div className="flex items-center gap-4">
                        <div className="h-11 w-11 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                          <MessageSquare className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-sm font-extrabold text-foreground tracking-tight">Tất cả báo bận</h3>
                          <p className="text-[11px] text-muted-foreground font-bold">{shiftsWithEvidences.length} ca có nhân sự xin nghỉ bận</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="bg-background/80 hover:bg-background h-10 px-4 rounded-xl text-[10px] font-extrabold gap-2 border shadow-soft transition-all"
                          onClick={() => setExpandedAll(shiftsWithEvidences.map(s => s.id))}
                        >
                          <ChevronsUpDown className="h-3.5 w-3.5 text-primary" />
                          Mở hết
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="bg-background/80 hover:bg-background h-10 px-4 rounded-xl text-[10px] font-extrabold gap-2 border shadow-soft transition-all"
                          onClick={() => setExpandedAll([])}
                        >
                          <ChevronsDownUp className="h-3.5 w-3.5 text-muted-foreground" />
                          Thu hết
                        </Button>
                      </div>
                    </div>
                  )}

                  {shiftsWithEvidences.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                      <div className="bg-muted p-10 rounded-full mb-6 border border-dashed border-muted-foreground/20">
                        <MessageSquare className="h-16 w-16 text-muted-foreground/30" />
                      </div>
                      <h3 className="text-2xl font-extrabold tracking-tight">Chưa có dữ liệu</h3>
                      <p className="text-muted-foreground/80 max-w-xs mx-auto mt-4 text-sm font-medium leading-relaxed">
                        Tuần này chưa ghi nhận bất kỳ phản hồi báo bận nào từ nhân viên.
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
        </DialogBody>

        <DialogFooter variant="muted" className="p-4 sm:p-6">
          <DialogAction variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl px-12 font-bold h-11 border-2 w-full sm:w-auto">
            Đóng
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
