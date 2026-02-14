'use client';

import React, { useMemo, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { AlertCircle, ArrowRight, Check, Trash2, Loader2, Users, Calendar, Clock, UserCheck } from 'lucide-react';
import type { Schedule, ManagedUser, UserRole, AssignedShift, AssignedUser, ShiftApplicant } from '@/lib/types';
import { cn } from '@/lib/utils';
import { dataStore } from '@/lib/data-store';
import { toast } from '@/components/ui/pro-toast';
import { hasTimeConflict } from '@/lib/schedule-utils';
import { UserAvatar } from '@/components/user-avatar';

const roleOrder: Record<UserRole, number> = {
  'Phục vụ': 1,
  'Pha chế': 2,
  'Thu ngân': 3,
  'Quản lý': 4,
  'Chủ nhà hàng': 5,
};

type Props = {
  schedule: Schedule | null;
  allUsers: ManagedUser[];
  container?: HTMLElement | null;
  currentUserRole?: UserRole | null;
  onUpdateSchedule?: (data: Partial<Schedule>) => void;
};

export default function LackingShiftApplicantsTab({ schedule, allUsers, container, currentUserRole, onUpdateSchedule }: Props) {
  const [processing, setProcessing] = useState<Record<string, boolean>>({});

  const canManage = useMemo(() => currentUserRole === 'Chủ nhà hàng' || currentUserRole === 'Quản lý', [currentUserRole]);

  const lackingShiftItems = useMemo(() => {
    if (!schedule) return [];

    const getRoleCount = (users: AssignedUser[], role: UserRole) => users.filter(u => u.assignedRole === role).length;

    const items = schedule.shifts.reduce((acc: any[], shift) => {
      const assignedCount = shift.assignedUsers.length;
      const minUsersLack = Math.max(0, shift.minUsers - assignedCount);
      const requiredRoles = shift.requiredRoles || [];
      const missingRoles = requiredRoles
        .map(req => {
          const count = getRoleCount(shift.assignedUsers, req.role);
          const deficit = Math.max(0, req.count - count);
          return deficit > 0 ? { role: req.role, current: count, target: req.count, deficit } : null;
        })
        .filter(Boolean);

      const totalLack = minUsersLack + missingRoles.reduce((s: number, it: any) => s + it.deficit, 0);
      if (totalLack <= 0) return acc;

      const applicants = shift.applicants || [];
      const applicantsWithProfile = applicants
        .map(a => ({ 
            ...a, 
            profile: allUsers.find(u => u.uid === a.userId) 
        }))
        .sort((a, b) => (a.profile?.displayName || '').localeCompare(b.profile?.displayName || ''));

      const sameDayShifts = schedule.shifts.filter(s => s.date === shift.date).sort((a, b) => a.timeSlot.start.localeCompare(b.timeSlot.start));

      acc.push({ 
        shift, 
        assignedCount,
        minUsersLack, 
        missingRoles, 
        applicantsWithProfile, 
        sameDayShifts,
        fillPercentage: Math.min(100, (assignedCount / (shift.minUsers || 1)) * 100)
      });
      return acc;
    }, [] as any[]);

    return items.sort((a, b) => (a.shift.date !== b.shift.date ? a.shift.date.localeCompare(b.shift.date) : a.shift.timeSlot.start.localeCompare(b.shift.timeSlot.start)));
  }, [schedule, allUsers]);

  const handleAccept = async (shiftId: string, applicantId: string) => {
    if (!schedule) return;
    const key = `${shiftId}:${applicantId}`;
    setProcessing(prev => ({ ...prev, [key]: true }));

    try {
      const shift = schedule.shifts.find(s => s.id === shiftId);
      const applicantProfile = allUsers.find(u => u.uid === applicantId);
      if (!shift || !applicantProfile) throw new Error('Dữ liệu không hợp lệ');

      // Conflict check
      const conflict = hasTimeConflict(applicantId, shift, schedule.shifts.filter(s => s.date === shift.date));
      if (conflict) {
        toast.error(`Trùng giờ với ca "${conflict.label}"`);
        return;
      }

      const assignedRole = (shift.role && shift.role !== 'Bất kỳ') ? (shift.role as UserRole) : applicantProfile.role;

      const updatedShifts = schedule.shifts.map(s => {
        if (s.id !== shiftId) return s;
        const alreadyAssigned = s.assignedUsers.some(u => u.userId === applicantId);
        const newAssigned = alreadyAssigned ? s.assignedUsers : [...s.assignedUsers, { userId: applicantId, userName: applicantProfile.displayName, assignedRole }];
        const newApplicants = (s.applicants || []).filter(a => a.userId !== applicantId);
        return { ...s, assignedUsers: newAssigned, applicants: newApplicants };
      });

      const toastId = toast.loading('Đang ghi nhận...');
      await dataStore.updateSchedule(schedule.weekId, { shifts: updatedShifts });
      onUpdateSchedule?.({ shifts: updatedShifts });
      toast.success('Đã xếp vào ca', { id: toastId });
    } catch (err) {
      toast.error('Lỗi: ' + (err as Error).message);
    } finally {
      setProcessing(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleDecline = async (shiftId: string, applicantId: string) => {
    if (!schedule) return;
    const key = `${shiftId}:${applicantId}`;
    setProcessing(prev => ({ ...prev, [key]: true }));

    try {
      const toastId = toast.loading('Đang xóa...');
      await dataStore.cancelShiftApplication(schedule.weekId, shiftId, applicantId);
      const updatedShifts = schedule.shifts.map(s => s.id === shiftId ? { ...s, applicants: (s.applicants || []).filter(a => a.userId !== applicantId) } : s);
      onUpdateSchedule?.({ shifts: updatedShifts });
      toast.success('Đã từ chối', { id: toastId });
    } catch (err) {
      toast.error('Cập nhật thất bại');
    } finally {
      setProcessing(prev => ({ ...prev, [key]: false }));
    }
  };

  if (!schedule) return null;

  // If there are no understaffed shifts at all, show the "all filled" state
  if (lackingShiftItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-8 text-center bg-emerald-50/10 h-full">
        <div className="bg-emerald-500/10 p-7 rounded-full mb-5 ring-4 ring-emerald-500/5 animate-pulse">
          <Check className="h-12 w-12 text-emerald-600" />
        </div>
        <h3 className="text-base font-black text-foreground uppercase tracking-wider">Mọi ca đã đủ người!</h3>
        <p className="text-[11px] text-muted-foreground/60 mt-3 max-w-[260px] font-medium leading-relaxed">
            Hệ thống không ghi nhận bất kỳ nhân sự nào bị thiếu hụt trong tuần này.
        </p>
      </div>
    );
  }

  // Only show understaffed shifts that currently have applicants
  const itemsWithApplicants = lackingShiftItems.filter(i => (i.applicantsWithProfile || []).length > 0);

  // If there are understaffed shifts but none have applicants, show a different empty state
  if (itemsWithApplicants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center h-full">
        <div className="bg-muted/10 p-6 rounded-3xl mb-4">
          <AlertCircle className="h-10 w-10 text-muted-foreground/40" />
        </div>
        <h3 className="text-sm font-black text-foreground uppercase tracking-tight">Chưa có ứng tuyển</h3>
        <p className="text-[11px] text-muted-foreground/60 mt-2 max-w-[260px] font-medium leading-relaxed">
          Có ca thiếu người nhưng hiện không có ứng viên đăng ký. Bạn có thể thông báo hoặc khởi tạo lời mời trực tiếp.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4 pb-20">
        {itemsWithApplicants.map(({ shift, assignedCount, minUsersLack, missingRoles, applicantsWithProfile, sameDayShifts, fillPercentage }) => (
          <div key={shift.id} className="group relative rounded-3xl border border-border/40 bg-card overflow-hidden shadow-sm hover:shadow-xl hover:border-amber-500/20 transition-all duration-300">
            {/* Header / Shift Info */}
            <div className="p-4 bg-gradient-to-br from-card to-muted/10">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="bg-amber-500 h-1.5 w-1.5 rounded-full animate-pulse" />
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-600/80">{format(parseISO(shift.date), 'EEEE, dd/MM', { locale: vi })}</p>
                  </div>
                  <h4 className="text-sm font-black tracking-tight leading-none uppercase text-foreground/90">{shift.label}</h4>
                  <div className="flex items-center gap-3 mt-1 text-muted-foreground/60">
                    <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        <span className="text-[10px] font-bold">{shift.timeSlot.start} - {shift.timeSlot.end}</span>
                    </div>
                  </div>
                </div>

                <Popover modal={false}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent container={container} align="end" sideOffset={12} className="w-80 p-0 border-border/40 shadow-2xl overflow-hidden rounded-2xl">
                    <div className="p-3 bg-muted/30 border-b border-border/40">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                           <Calendar className="h-3 w-3" />
                           Lịch ngày {format(parseISO(shift.date), 'dd/MM')}
                        </p>
                    </div>
                    <div className="p-2 space-y-1.5 max-h-72 overflow-y-auto">
                      {sameDayShifts.map((ds: AssignedShift) => (
                        <div key={ds.id} className={cn("p-2.5 rounded-xl border transition-colors", ds.id === shift.id ? "bg-amber-500/5 border-amber-500/20" : "bg-background border-border/30")}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-black uppercase truncate max-w-[140px]">{ds.label}</span>
                            <Badge variant="outline" className="text-[9px] font-bold h-4 py-0 border-none bg-muted/60">{ds.timeSlot.start}-{ds.timeSlot.end}</Badge>
                          </div>
                          {ds.assignedUsers.length > 0 ? (
                            <div className="flex flex-col gap-2">
                              {(() => {
                                const grouped: Record<string, AssignedUser[]> = {};
                                ds.assignedUsers.forEach((u: AssignedUser) => {
                                  const r = u.assignedRole || 'Khác';
                                  if (!grouped[r]) grouped[r] = [];
                                  grouped[r].push(u);
                                });

                                const roles = Object.keys(grouped).sort((a, b) => {
                                  const pa = roleOrder[a as UserRole] || 99;
                                  const pb = roleOrder[b as UserRole] || 99;
                                  return pa - pb || a.localeCompare(b);
                                });

                                return roles.map((role) => (
                                  <div key={role} className="flex items-start gap-3">
                                    <div className="w-20 text-[9px] font-black uppercase tracking-wide text-muted-foreground/50">{role}</div>
                                    <div className="flex flex-wrap gap-1">
                                      {grouped[role].map(u => (
                                        <Badge key={u.userId} variant="secondary" className="text-[8px] h-3.5 px-1 py-0 border-none font-bold bg-muted/40">{u.userName}</Badge>
                                      ))}
                                    </div>
                                  </div>
                                ));
                              })()}
                            </div>
                          ) : (
                            <span className="text-[9px] text-muted-foreground italic mt-0.5">Chưa có người trực</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Progress / Shortage Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-muted-foreground/50">
                    <div className="flex items-center gap-1.5">
                        <Users className="h-2.5 w-2.5" />
                        <span>Tỷ lệ lấp đầy</span>
                    </div>
                    <span className="text-amber-600">{assignedCount}/{shift.minUsers}</span>
                </div>
                <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden border border-border/5">
                    <div 
                        style={{ width: `${fillPercentage}%` }}
                        className="h-full bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.3)] transition-all duration-700 ease-out"
                    />
                </div>
              </div>
            </div>

            <div className="px-4 py-3 bg-card/50">
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {minUsersLack > 0 && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-destructive/5 text-destructive border border-destructive/10">
                        <AlertCircle className="h-3 w-3" />
                        <span className="text-[10px] font-black">Thiếu {minUsersLack} người</span>
                    </div>
                  )}
                  {missingRoles.map((item: any, idx: number) => (
                    <div key={`${item.role}-${idx}`} className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-primary/5 text-primary border border-primary/10">
                        <UserCheck className="h-3 w-3" />
                        <span className="text-[10px] font-black">Thiếu {item.role} ({item.current}/{item.target})</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Ứng tuyển ({applicantsWithProfile.length})</p>
                    {applicantsWithProfile.length > 0 && <div className="h-px flex-1 mx-3 bg-border/40" />}
                  </div>

                  {applicantsWithProfile.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2">
                      {applicantsWithProfile.map(({ profile, userId }: any) => {
                        const key = `${shift.id}:${userId}`;
                        const isProcessing = !!processing[key];
                        
                        return (
                          <div key={userId} className="group/item relative flex items-center justify-between p-2.5 rounded-2xl border border-border/40 bg-background/40 hover:bg-background hover:shadow-md hover:border-primary/20 transition-all duration-300">
                            <div className="flex items-center gap-3 min-w-0">
                              <UserAvatar user={profile} size="h-9 w-9" rounded="xl" />
                              <div className="min-w-0 text-left">
                                <p className="text-[11px] font-black tracking-tight truncate leading-tight">{profile?.displayName || 'Ẩn danh'}</p>
                                <p className="text-[9px] text-muted-foreground/70 font-bold truncate">{profile?.role || 'Nhân viên'}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {canManage ? (
                                <>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-8 w-8 rounded-xl bg-emerald-500/5 hover:bg-emerald-500 hover:text-white transition-all duration-300 group/btn" 
                                    onClick={() => handleAccept(shift.id, userId)} 
                                    disabled={isProcessing}
                                  >
                                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-emerald-600 group-hover/btn:text-white transition-colors" />}
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-8 w-8 rounded-xl bg-destructive/5 hover:bg-destructive hover:text-white transition-all duration-300 group/btn" 
                                    onClick={() => handleDecline(shift.id, userId)} 
                                    disabled={isProcessing}
                                  >
                                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive group-hover/btn:text-white transition-colors" />}
                                  </Button>
                                </>
                              ) : (
                                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover/item:translate-x-1 transition-transform" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-6 flex flex-col items-center justify-center border-2 border-dashed border-border/20 rounded-2xl">
                        <Users className="h-6 w-6 text-muted-foreground/20 mb-2" />
                        <p className="text-[10px] text-muted-foreground/40 font-bold uppercase tracking-tight">Chưa có ai ứng tuyển</p>
                    </div>
                  )}
                </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
