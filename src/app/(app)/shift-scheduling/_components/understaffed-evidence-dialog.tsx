'use client';

import { useState, useMemo, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
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
  Clock,
  CheckCircle2,
  Info,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  ListFilter,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AssignedShift, ManagedUser, Schedule, ShiftBusyEvidence, BusyReportRequest } from '@/lib/types';
import { subscribeToBusyReportRequestsForWeek } from '@/lib/schedule-store';
import { cn } from '@/lib/utils';
import { getRoleColor, userMatchesRole, getRelevantUnderstaffedShifts, getShiftMissingDetails } from './understaffed-evidence-utils';
import { ShiftDetailView } from './shift-detail-view';

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

  const [currentShiftId, setCurrentShiftId] = useState<string | null>(null);

  const currentShift = useMemo(() => {
    if (!currentShiftId) return null;
    return [...understaffedShifts, ...shiftsWithEvidences].find(s => s.id === currentShiftId) || null;
  }, [currentShiftId, understaffedShifts, shiftsWithEvidences]);

  // Reset shift selection when dialog closes
  useEffect(() => {
    if (!open) setCurrentShiftId(null);
  }, [open]);

  const [busyRequests, setBusyRequests] = useState<BusyReportRequest[]>([]);

  const { unrequestedShifts, requestedShifts } = useMemo(() => {
    const allRelevantIds = new Set([
      ...understaffedShifts.map(s => s.id),
      ...shiftsWithEvidences.map(s => s.id)
    ]);
    
    const allRelevantShifts = (schedule?.shifts || []).filter(s => allRelevantIds.has(s.id));
    
    const requested: AssignedShift[] = [];
    const unrequested: AssignedShift[] = [];
    
    for (const s of allRelevantShifts) {
      const hasRequest = busyRequests.some(r => r.shiftId === s.id && r.active);
      if (hasRequest) {
        requested.push(s);
      } else {
        unrequested.push(s);
      }
    }
    
    const sortFn = (a: AssignedShift, b: AssignedShift) => {
      if (a.date === b.date) return a.timeSlot.start.localeCompare(b.timeSlot.start);
      return a.date.localeCompare(b.date);
    };
    
    return {
      requestedShifts: requested.sort(sortFn),
      unrequestedShifts: unrequested.sort(sortFn)
    };
  }, [understaffedShifts, shiftsWithEvidences, busyRequests, schedule]);

  useEffect(() => {
    const weekId = schedule?.weekId || '';
    if (!open || !weekId) return;
    const unsub = subscribeToBusyReportRequestsForWeek(weekId, setBusyRequests);
    return () => unsub();
  }, [open, schedule?.weekId]);

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

  const renderShiftCard = (shift: AssignedShift) => {
    const shiftEvidences = evidences.filter((entry) => entry.shiftId === shift.id);
    const missingDetails = getShiftMissingDetails(shift, allUsers);
    const totalMissing = missingDetails.totalMissing;
    const isActuallyUnderstaffed = totalMissing > 0;
    const shiftDate = parseISO(shift.date);
    const status = getShiftStatus(shift, shiftEvidences);

    return (
      <button
        key={shift.id}
        onClick={() => setCurrentShiftId(shift.id)}
        className="w-full border-2 border-transparent hover:border-primary/20 rounded-[2rem] bg-card overflow-hidden shadow-soft hover:shadow-xl transition-all duration-300 mb-4 px-0 text-left group animate-in fade-in slide-in-from-bottom-2 duration-500 relative"
      >
        <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-primary/30 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        
        <div className="px-5 sm:px-8 py-5 sm:py-7 flex items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-black text-lg sm:text-xl tracking-tight text-foreground/90 leading-tight">{shift.label}</span>
              <Badge variant="secondary" className={cn("text-[10px] sm:text-[11px] px-3 h-6 font-black uppercase tracking-widest border-2 shadow-sm", getRoleColor(shift.role))}>
                {shift.role}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] sm:text-xs text-muted-foreground font-bold">
              <div className="flex items-center gap-2" title="Ngày">
                <Clock className="h-4 w-4 text-primary/40" />
                <span className="capitalize">{format(shiftDate, 'EEEE, dd/MM', { locale: vi })}</span>
              </div>
              <div className="h-1 w-1 rounded-full bg-muted-foreground/20" />
              <div className="flex items-center gap-2">
                <span className="text-secondary-foreground font-black bg-secondary/20 px-2 py-0.5 rounded-lg border border-secondary/10">
                  {shift.timeSlot.start} - {shift.timeSlot.end}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden md:flex items-center gap-2">
              {isActuallyUnderstaffed && (
                <Badge variant="destructive" className="h-8 px-4 text-[11px] font-black rounded-xl shadow-soft border-2 border-background">
                  {missingDetails.text}
                </Badge>
              )}
              <Badge variant="secondary" className={cn("h-8 px-4 text-[11px] font-black rounded-xl border-2 shadow-sm", status.color)}>
                {status.label}
              </Badge>
            </div>
            
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-muted/40 flex items-center justify-center text-muted-foreground/30 group-hover:bg-primary/10 group-hover:text-primary transition-all duration-300 border border-transparent group-hover:border-primary/20 shadow-inner">
              <ChevronRight className="h-6 w-6 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>

        {/* Status badges for mobile/tablet */}
        <div className="flex md:hidden px-5 sm:px-8 pb-5 gap-2">
          {isActuallyUnderstaffed && (
            <Badge variant="destructive" className="h-7 px-3 text-[10px] font-black rounded-lg">
              {missingDetails.text}
            </Badge>
          )}
          <Badge variant="secondary" className={cn("h-7 px-3 text-[10px] font-black rounded-lg", status.color)}>
            {status.label}
          </Badge>
        </div>
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} dialogTag="understaffed-evidence-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col min-h-0 p-0 overflow-hidden sm:rounded-[2.5rem] border-none shadow-2xl">
        {currentShiftId && currentShift ? (
          <ShiftDetailView
            shift={currentShift}
            allUsers={allUsers}
            evidences={evidences}
            busyRequests={busyRequests}
            schedule={schedule}
            dialogTag='understaffed-evidence-dialog'
            onBack={() => setCurrentShiftId(null)}
          />
        ) : (
          <>
            <DialogHeader iconkey="alert">
              <DialogTitle>Chi tiết báo bận</DialogTitle>
              <DialogDescription>
                {understaffedShifts.length} ca đang thiếu nhân sự cần xử lý.
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="p-0 flex flex-col min-h-0">
              <Tabs defaultValue="unrequested" className="flex-1 flex flex-col min-h-0">
                <div className="border-b bg-muted/20">
                  <TabsList className="h-14 bg-transparent p-0 grid grid-cols-2 w-full rounded-none">
                    <TabsTrigger
                      value="unrequested"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary h-14 px-1 text-[11px] sm:text-xs font-bold transition-all uppercase tracking-wider w-full"
                    >
                      Chưa yêu cầu ({unrequestedShifts.length})
                    </TabsTrigger>
                    <TabsTrigger
                      value="requested"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary h-14 px-1 text-[11px] sm:text-xs font-bold transition-all uppercase tracking-wider w-full"
                    >
                      Đã yêu cầu ({requestedShifts.length})
                    </TabsTrigger>
                  </TabsList>
                </div>

                <ScrollArea className="flex-1 min-h-0 overflow-auto">
                  <div className="p-6 pb-24">
                    <TabsContent value="unrequested" className="m-0 focus-visible:outline-none ring-0 outline-none">
                      {unrequestedShifts.length > 0 && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-amber-500/[0.04] p-5 rounded-[2rem] border border-amber-200/30">
                          <div className="flex items-center gap-4">
                            <div className="h-11 w-11 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">
                              <ListFilter className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                              <h3 className="text-sm font-extrabold text-amber-900 tracking-tight">Ca chưa yêu cầu báo bận</h3>
                              <p className="text-[11px] text-amber-700/60 font-bold">Chọn một ca để xem chi tiết và phản hồi</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {unrequestedShifts.length === 0 ? (
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
                        <div className="space-y-4">
                          {unrequestedShifts.map(shift => renderShiftCard(shift))}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="requested" className="m-0 focus-visible:outline-none ring-0 outline-none">
                      {requestedShifts.length > 0 && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-primary/[0.03] p-5 rounded-[2rem] border border-primary/10 border-dashed">
                          <div className="flex items-center gap-4">
                            <div className="h-11 w-11 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                              <MessageSquare className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <h3 className="text-sm font-extrabold text-foreground tracking-tight">Ca đã yêu cầu báo bận</h3>
                              <p className="text-[11px] text-muted-foreground font-bold">{requestedShifts.length} ca có nhân sự xin nghỉ bận</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {requestedShifts.length === 0 ? (
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
                        <div className="space-y-4">
                          {requestedShifts.map(shift => renderShiftCard(shift))}
                        </div>
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
