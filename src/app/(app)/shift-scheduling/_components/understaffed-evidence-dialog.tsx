'use client';

import { useMemo } from 'react';
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
import { AlertTriangle, Clock, CheckCircle2, Info, MessageSquare, ChevronRight, Video, ListFilter, ClipboardCheck } from 'lucide-react';
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
import type { AssignedShift, ManagedUser, Schedule, ShiftBusyEvidence } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getRoleColor, userMatchesRole, toDate, buildSlides } from './understaffed-evidence-utils';

export function UnderstaffedEvidenceDialog({
  open,
  onOpenChange,
  schedule,
  allUsers,
  evidences,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: Schedule | null;
  allUsers: ManagedUser[];
  evidences: ShiftBusyEvidence[];
}) {
  const { openLightbox } = useLightbox();

  const understaffedShifts = useMemo<AssignedShift[]>(() => {
    if (!schedule) return [];
    return (schedule.shifts || [])
      .filter((shift) => {
        const minUsers = shift.minUsers ?? 0;
        const lackingMin = minUsers > 0 && shift.assignedUsers.length < minUsers;
        const reqs = shift.requiredRoles || [];
        const lackingReq = reqs.some(req => {
          const assignedOfRole = shift.assignedUsers.filter(au => {
            const user = allUsers.find(u => u.uid === au.userId);
            const effectiveRole = au.assignedRole ?? user?.role;
            return effectiveRole === req.role;
          }).length;
          return assignedOfRole < req.count;
        });
        return lackingMin || lackingReq;
      })
      .sort((a, b) => {
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
    const reqs = shift.requiredRoles || [];
    const missingByRole = reqs.map(req => {
      const assignedOfRole = shift.assignedUsers.filter(au => {
        const user = allUsers.find(u => u.uid === au.userId);
        const effectiveRole = au.assignedRole ?? user?.role;
        return effectiveRole === req.role;
      }).length;
      return { role: req.role, missing: Math.max(0, req.count - assignedOfRole) };
    });
    
    const totalMissing = missingByRole.reduce((s, r) => s + r.missing, 0) || Math.max(0, (shift.minUsers ?? 0) - shift.assignedUsers.length);
    const isActuallyUnderstaffed = totalMissing > 0;
    
    const eligibleUsers = reqs.length > 0 
      ? allUsers.filter(user => reqs.some(r => userMatchesRole(user, r.role))) 
      : allUsers.filter((user) => userMatchesRole(user, shift.role));
    
    const pendingUsers = eligibleUsers.filter((user) => !shiftEvidences.some((entry) => entry.submittedBy.userId === user.uid));
    const shiftDate = parseISO(shift.date);
    const status = getShiftStatus(shift, shiftEvidences);

    return (
      <AccordionItem key={shift.id} value={shift.id} className="border rounded-xl px-4 bg-card overflow-hidden shadow-sm mb-4">
        <AccordionTrigger className="hover:no-underline py-4">
          <div className="flex flex-1 flex-col sm:flex-row sm:items-center justify-between text-left gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base">{shift.label}</span>
                <Badge variant="outline" className={cn("text-[10px] px-1.5 h-5", getRoleColor(shift.role))}>{shift.role}</Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {format(shiftDate, 'eeee, dd/MM', { locale: vi })} · {shift.timeSlot.start} - {shift.timeSlot.end}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pr-4">
              {isActuallyUnderstaffed && (
                <Badge variant="destructive" className="h-6 font-semibold">
                  Thiếu {totalMissing} người
                </Badge>
              )}
              <Badge variant="secondary" className={cn("h-6 border", status.color)}>
                {status.label}
              </Badge>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pb-6 pt-2">
          <Separator className="mb-6" />
          
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
                <div className="space-y-4">
                  {shiftEvidences.map((entry) => {
                    const submittedAt = toDate(entry.submittedAt);
                    const mediaSlides = entry.media ? buildSlides(entry.media) : [];
                    return (
                      <div key={entry.id} className="relative bg-muted/20 rounded-2xl p-5 border border-border/50 shadow-sm">
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
                        
                        <div className="pl-0 space-y-4">
                          <div className="bg-background/50 rounded-xl p-3 border border-border/30">
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
                    Chưa phản hồi ({pendingUsers.length})
                  </h4>
                  {pendingUsers.length === 0 ? (
                    <div className="flex items-center gap-2 text-green-600 text-xs font-medium bg-green-50 p-2.5 rounded-xl border border-green-100">
                      <ClipboardCheck className="h-4 w-4" />
                      Tất cả đã phản hồi
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {pendingUsers.map((user) => (
                        <Badge key={user.uid} variant="secondary" className="bg-background text-[10px] py-0 px-2.5 h-7 border-dashed border font-medium">
                          {user.displayName}
                        </Badge>
                      ))}
                    </div>
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
    <Dialog open={open} onOpenChange={onOpenChange}>
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

          <ScrollArea aria-label="Understaffed evidence list" className="flex-1 min-h-0 max-h-[72vh] px-6 pb-6 overflow-auto">
            <div className="p-8 flex-1 min-h-0 flex flex-col">
              <TabsContent value="understaffed" className="m-0 focus-visible:outline-none flex-1">
                {understaffedShifts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in duration-300">
                    <div className="bg-green-100 dark:bg-green-900/30 p-6 rounded-full mb-6">
                      <CheckCircle2 className="h-14 w-14 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-xl font-bold">Lịch làm việc đã ổn định!</h3>
                    <p className="text-muted-foreground max-w-sm mx-auto mt-2">
                      Hiện tại không còn ca nào đang ở trạng thái thiếu nhân sự. Bạn có thể yên tâm với tiến độ vận hành.
                    </p>
                  </div>
                ) : (
                  <Accordion type="multiple" className="space-y-0" defaultValue={understaffedShifts.map(s => s.id)}>
                    {understaffedShifts.map(shift => renderShiftItem(shift))}
                  </Accordion>
                )}
              </TabsContent>

              <TabsContent value="all" className="m-0 focus-visible:outline-none flex-1">
                {shiftsWithEvidences.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="bg-muted p-6 rounded-full mb-6">
                      <MessageSquare className="h-14 w-14 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-bold">Chưa có báo báo nào</h3>
                    <p className="text-muted-foreground max-w-sm mx-auto mt-2">
                      Nhân viên chưa gửi bất kỳ báo cáo bận nào cho lịch làm việc tuần này.
                    </p>
                  </div>
                ) : (
                  <Accordion type="single" collapsible className="space-y-0">
                    {shiftsWithEvidences.map(shift => renderShiftItem(shift))}
                  </Accordion>
                )}
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
        
        <DialogFooter className="p-6 border-t bg-muted/20 flex flex-col sm:flex-row gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl px-8 order-2 sm:order-1">
            Đóng
          </Button>
          <div className="flex-1 order-1 sm:order-2" />
          <Button className="rounded-xl px-10 gap-3 font-bold shadow-xl shadow-primary/10 order-0 sm:order-3">
             Gửi thông báo nhắc nhở <ChevronRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
