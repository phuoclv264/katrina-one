'use client';

import { useState, useMemo, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Clock,
  ChevronLeft,
  ListFilter,
  Users,
  CheckCircle2,
  Info,
  Search,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { 
  AssignedShift, 
  ManagedUser, 
  Schedule, 
  ShiftBusyEvidence, 
  BusyReportRequest, 
  UserRole 
} from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { toast } from '@/components/ui/pro-toast';
import { setBusyReportRecipients, addStaffToShift } from '@/lib/schedule-store';
import { cn, advancedSearch } from '@/lib/utils';
import { 
  getRoleColor, 
  getEligibleAndPendingUsers, 
  getShiftMissingDetails 
} from './understaffed-evidence-utils';
import { ShiftEvidenceReports } from './shift-evidence-reports';
import { LuckyWheelDialog } from './lucky-wheel-dialog';

interface ShiftDetailViewProps {
  shift: AssignedShift;
  allUsers: ManagedUser[];
  evidences: ShiftBusyEvidence[];
  busyRequests: BusyReportRequest[];
  schedule: Schedule | null;
  dialogTag: string;
  onBack: () => void;
}

export function ShiftDetailView({
  shift,
  allUsers,
  evidences,
  busyRequests,
  schedule,
  dialogTag,
  onBack
}: ShiftDetailViewProps) {
  const { user } = useAuth();
  
  const shiftEvidences = useMemo(() => 
    evidences.filter((entry) => entry.shiftId === shift.id),
    [evidences, shift.id]
  );
  
  const missingDetails = useMemo(() => 
    getShiftMissingDetails(shift, allUsers),
    [shift, allUsers]
  );
  
  const isActuallyUnderstaffed = missingDetails.totalMissing > 0;
  const reqs = shift.requiredRoles || [];
  
  const shiftActiveReq = useMemo(() => 
    busyRequests.find(r => r.shiftId === shift.id && r.active),
    [busyRequests, shift.id]
  );

  const { pendingUsers, eligibleUsers } = useMemo(() => 
    getEligibleAndPendingUsers(shift, allUsers, shiftEvidences, shiftActiveReq),
    [shift, allUsers, shiftEvidences, shiftActiveReq]
  );

  const displayedPendingUsers = useMemo(() => {
    if (!shiftActiveReq) return pendingUsers;
    if (shiftActiveReq.targetMode === 'all') return pendingUsers;
    if (shiftActiveReq.targetMode === 'roles') {
      const roles = shiftActiveReq.targetRoles || [];
      return pendingUsers.filter(u => roles.includes(u.role));
    }
    if (shiftActiveReq.targetMode === 'users') {
      const ids = shiftActiveReq.targetUserIds || [];
      return pendingUsers.filter(u => ids.includes(u.uid));
    }
    return pendingUsers;
  }, [pendingUsers, shiftActiveReq]);

  const [editTarget, setEditTarget] = useState<{ mode: 'users' | 'roles' | 'all'; userIds: string[]; roles: UserRole[] }>({
    mode: 'all',
    userIds: [],
    roles: [],
  });

  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<UserRole | 'All'>('All');
  const [isWheelOpen, setIsWheelOpen] = useState(false);

  const filteredUsers = useMemo(() => {
    let users = allUsers;
    
    // Apply role filter first
    if (userRoleFilter !== 'All') {
      users = users.filter(u => u.role === userRoleFilter);
    }

    // Apply search
    if (userSearch) {
      users = advancedSearch(users, userSearch, ['displayName', 'role']);
    }

    return users;
  }, [allUsers, userSearch, userRoleFilter]);

  // Sync state with active request when shift or busyRequests change
  useEffect(() => {
    if (shiftActiveReq) {
      setEditTarget({
        mode: shiftActiveReq.targetMode,
        userIds: shiftActiveReq.targetUserIds || [],
        roles: shiftActiveReq.targetRoles || [],
      });
    } else {
      setEditTarget({ mode: 'all', userIds: [], roles: [] });
    }
  }, [shiftActiveReq]);

  const handleTargetModeChange = (mode: 'users' | 'roles' | 'all') => {
    setEditTarget(prev => ({ ...prev, mode }));
  };

  const handleToggleRole = (role: UserRole) => {
    setEditTarget(prev => {
      const exists = prev.roles.includes(role);
      const roles = exists ? prev.roles.filter(r => r !== role) : [...prev.roles, role];
      return { ...prev, roles };
    });
  };

  const handleToggleUser = (userId: string) => {
    setEditTarget(prev => {
      const exists = prev.userIds.includes(userId);
      const userIds = exists ? prev.userIds.filter(id => id !== userId) : [...prev.userIds, userId];
      return { ...prev, userIds };
    });
  };

  const handleSaveTargets = async () => {
    if (!user || !schedule) return;
    try {
      await setBusyReportRecipients({
        weekId: schedule.weekId,
        shift,
        createdBy: { userId: user.uid, userName: user.displayName || 'Owner' },
        targetMode: editTarget.mode,
        targetUserIds: editTarget.userIds,
        targetRoles: editTarget.roles,
        active: true,
      });
      toast.success('Đã lưu yêu cầu báo bận.');
    } catch (e) {
      console.error('Failed to set busy report targets', e);
      toast.error('Không thể lưu yêu cầu.');
    }
  };

  const handleCancelRequest = async () => {
    if (!user || !schedule || !shiftActiveReq) return;
    try {
      await setBusyReportRecipients({
        weekId: schedule.weekId,
        shift,
        createdBy: { userId: user.uid, userName: user.displayName || 'Owner' },
        targetMode: shiftActiveReq.targetMode,
        targetUserIds: shiftActiveReq.targetUserIds || [],
        targetRoles: shiftActiveReq.targetRoles || [],
        active: false,
      });
      toast.success('Đã hủy yêu cầu báo bận.');
      setEditTarget({ mode: 'all', userIds: [], roles: [] });
    } catch (err) {
      console.error('Failed to cancel busy report request', err);
      toast.error('Không thể hủy yêu cầu.');
    }
  };

  const handleWheelWinner = async (chosenUser: ManagedUser) => {
    if (!schedule) return;
    try {
      await addStaffToShift(schedule.weekId, shift.id, chosenUser);
      toast.success(`Đã điều động ${chosenUser.displayName} tham gia ca làm việc.`);
    } catch (err) {
      console.error('Failed to assign user from wheel', err);
      toast.error('Không thể điều động nhân sự.');
    }
  };

  const shiftDate = parseISO(shift.date);

  return (
    <div className="flex flex-col h-full bg-background animate-in slide-in-from-right-4 duration-300 overflow-hidden">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-4 sm:px-6 py-4 pr-16 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-2xl h-10 w-10 shrink-0 bg-muted/40 hover:bg-muted/60 transition-all border border-transparent hover:border-border shadow-sm"
            onClick={onBack}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div className="flex flex-col min-w-0">
            <DialogTitle className="font-black text-base sm:text-lg tracking-tight truncate leading-tight">
              {shift.label}
            </DialogTitle>
            <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <span className="text-secondary-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(shiftDate, 'EEEE, dd/MM', { locale: vi })} • {shift.timeSlot.start} - {shift.timeSlot.end}
              </span>
            </div>
          </div>
        </div>
        {isActuallyUnderstaffed && (
          <Badge variant="destructive" className="hidden sm:flex h-8 px-4 lg:mr-8 text-xs font-black rounded-full animate-pulse shadow-soft border-2 border-background">
            {missingDetails.text}
          </Badge>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 sm:p-6 pb-24 sm:pb-32">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 max-w-7xl mx-auto">
            {/* Evidence Section (Left Colony) */}
            <div className="lg:col-span-12 space-y-8">
              <ShiftEvidenceReports evidences={shiftEvidences} />

              <div className="h-px bg-gradient-to-r from-transparent via-border/60 to-transparent my-4" />

              {/* Targets Management Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-7">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-amber-500/10 rounded-xl flex items-center justify-center shadow-inner">
                      <Users className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <h4 className="font-black text-base tracking-tight text-foreground/80 leading-none">Cấu hình nhân sự</h4>
                      <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-1">Đang yêu cầu / Còn thiếu</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-[1.5rem] p-6 border border-border/20 shadow-md space-y-6">
                    <div className="space-y-4">
                      <h4 className="font-black text-[9px] uppercase tracking-[0.2em] text-muted-foreground/50 flex items-center gap-2">
                        <ListFilter className="h-3 w-3" /> Chỉ tiêu yêu cầu
                      </h4>
                      <div className="flex flex-wrap gap-2.5">
                        {reqs.length > 0 ? (
                          reqs.map(r => (
                            <div key={r.role} className="flex items-center gap-2.5 bg-muted/5 border px-4 py-2 rounded-xl shadow-sm transform hover:-translate-y-1 transition-transform duration-300">
                              <span className="text-base font-black text-primary leading-none">{r.count}</span>
                              <div className="w-px h-3 bg-border/40" />
                              <span className="text-[10px] font-black text-muted-foreground uppercase">{r.role}</span>
                            </div>
                          ))
                        ) : (
                          <div className="flex items-center gap-2.5 bg-muted/5 border px-4 py-2 rounded-xl shadow-sm">
                            <span className="text-base font-black text-primary leading-none">{shift.minUsers || 0}</span>
                            <div className="w-px h-3 bg-border/40" />
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Hệ thống</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="h-px bg-border/40" />

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-black text-[9px] uppercase tracking-[0.2em] text-muted-foreground/50">
                          Chưa phản hồi ({displayedPendingUsers.length})
                        </h4>
                        
                        {displayedPendingUsers.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg border-2 border-primary/20 text-primary hover:bg-primary/5 font-black text-[10px] uppercase tracking-wider transition-all"
                            onClick={() => setIsWheelOpen(true)}
                          >
                            <RefreshCw className="h-3 w-3 mr-1.5" />
                            Vòng quay may mắn
                          </Button>
                        )}
                      </div>

                      {displayedPendingUsers.length === 0 ? (
                        <div className="flex items-center gap-3 text-green-600 text-[10px] font-black py-3 bg-green-500/[0.04] px-5 rounded-xl border border-green-500/10 shadow-sm">
                          <CheckCircle2 className="h-4 w-4 animate-bounce" />
                          Tất cả nhân viên đã gửi phản hồi
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          {displayedPendingUsers.map((user) => (
                            <Badge key={user.uid} variant="secondary" className="bg-muted/5 hover:bg-muted font-bold text-[10px] py-1.5 px-3 rounded-lg border-border/20 shadow-sm transition-all">
                              {user.displayName}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-[2.5rem] p-6 sm:p-7 border-2 border-primary/10 shadow-[0_15px_30px_rgb(0,0,0,0.05)] space-y-6 relative overflow-hidden group/target">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary/[0.03] rounded-full -mr-12 -mt-12 group-hover/target:scale-125 transition-transform duration-700" />
                  
                  <div className="flex items-center gap-4">
                    <div className="h-11 w-11 bg-primary/10 rounded-2xl flex items-center justify-center shadow-inner">
                      <ListFilter className="h-6 w-6 text-primary" />
                    </div>
                    <h4 className="font-black text-lg tracking-tight text-foreground/80">Cài đặt báo bận</h4>
                  </div>
                  
                  <div className="bg-muted/5 rounded-[1.5rem] p-4 border border-border/5 flex items-start gap-3">
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary/40 animate-pulse" />
                    <div className="space-y-0.5">
                      <p className="text-[9px] uppercase tracking-[0.15em] font-black text-primary/40 leading-none">Trạng thái hiện tại</p>
                      <p className="text-xs font-black text-primary leading-tight">
                        {shiftActiveReq ? (
                          <span className="flex flex-wrap gap-x-1.5 items-center">
                            Đang yêu cầu: 
                            <span className="text-foreground/70 bg-primary/10 px-1.5 py-0.5 rounded-md text-[10px]">
                              {(() => {
                                if (shiftActiveReq.targetMode === 'all') return 'Tất cả nhân viên';
                                if (shiftActiveReq.targetMode === 'roles') return `Theo vai trò (${(shiftActiveReq.targetRoles || []).join(', ')})`;
                                if (shiftActiveReq.targetMode === 'users') return `Người cụ thể (${(shiftActiveReq.targetUserIds || []).length})`;
                                return '';
                              })()}
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40 italic font-bold">Không có yêu cầu nào.</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="flex gap-2 p-1 bg-muted/20 rounded-2xl border border-border/10">
                      {(['all', 'roles', 'users'] as const).map(mode => (
                        <button
                          key={mode}
                          className={cn(
                            "flex-1 h-10 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300",
                            editTarget.mode === mode 
                              ? "bg-white text-primary shadow-sm ring-1 ring-border/20" 
                              : "text-muted-foreground hover:text-foreground"
                          )}
                          onClick={() => handleTargetModeChange(mode)}
                        >
                          {mode === 'all' ? 'Tất cả' : mode === 'roles' ? 'Vai trò' : 'Chọn người'}
                        </button>
                      ))}
                    </div>
                    
                    {editTarget.mode === 'roles' && (
                      <div className="flex flex-wrap gap-2 p-4 bg-muted/5 rounded-[1.5rem] border border-dashed border-primary/20 animate-in fade-in slide-in-from-top-2 duration-300 shadow-inner">
                        {(['Phục vụ', 'Pha chế', 'Quản lý'] as UserRole[]).map(role => (
                          <Badge
                            key={role}
                            variant="outline"
                            className={cn(
                              'text-[10px] py-1.5 px-3 border-2 font-black cursor-pointer transition-all rounded-lg', 
                              editTarget.roles.includes(role) 
                                ? 'bg-primary text-primary-foreground border-primary shadow-md scale-105' 
                                : 'bg-white hover:bg-primary/5 hover:border-primary/20'
                            )}
                            onClick={() => handleToggleRole(role)}
                          >
                            {role}
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    {editTarget.mode === 'users' && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex flex-col gap-3 p-4 bg-muted/5 rounded-[1.5rem] border border-border/10 shadow-inner">
                          <div className="relative group/search">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within/search:text-primary transition-colors" />
                            <Input
                              placeholder="Tìm tên nhân viên..."
                              className="h-9 pl-10 pr-4 bg-white/50 border-none rounded-xl text-[11px] font-bold focus-visible:ring-1 focus-visible:ring-primary/20 shadow-sm"
                              value={userSearch}
                              onChange={(e) => setUserSearch(e.target.value)}
                            />
                          </div>
                          
                          <div className="flex flex-wrap gap-1.5">
                            {(['All', 'Phục vụ', 'Pha chế', 'Quản lý'] as const).map(role => (
                              <button
                                key={role}
                                onClick={() => setUserRoleFilter(role as any)}
                                className={cn(
                                  "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all",
                                  userRoleFilter === role 
                                    ? "bg-primary/10 border-primary/20 text-primary shadow-sm" 
                                    : "bg-white border-border/40 text-muted-foreground hover:bg-muted"
                                )}
                              >
                                {role === 'All' ? 'Tất cả' : role}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 p-4 bg-white/40 rounded-[1.5rem] border border-dashed border-primary/10 max-h-48 overflow-y-auto custom-scrollbar shadow-inner">
                          {filteredUsers.map(u => (
                            <Badge
                              key={u.uid}
                              variant="secondary"
                              className={cn(
                                'text-[10px] py-1.5 px-3 border-2 font-black cursor-pointer transition-all rounded-lg', 
                                editTarget.userIds.includes(u.uid) 
                                  ? 'bg-primary/20 border-primary/40 text-primary shadow-sm scale-105' 
                                  : 'bg-white hover:bg-primary/5'
                              )}
                              onClick={() => handleToggleUser(u.uid)}
                            >
                              {u.displayName}
                            </Badge>
                          ))}
                          {filteredUsers.length === 0 && (
                            <div className="w-full py-6 text-center">
                              <p className="text-[10px] font-bold text-muted-foreground italic">Không tìm thấy nhân viên phù hợp</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 pt-2">
                    <Button 
                      size="lg" 
                      className="rounded-[1.25rem] w-full font-black shadow-lg shadow-primary/20 text-sm tracking-tight hover:scale-[1.01] active:translate-y-0.5 transition-all bg-primary hover:bg-primary/95" 
                      onClick={handleSaveTargets}
                    >
                      Gửi yêu cầu báo bận
                    </Button>
                    {shiftActiveReq && (
                      <button
                        className="px-6 font-black text-destructive hover:text-destructive/80 transition-all text-[10px] uppercase tracking-widest text-center"
                        onClick={handleCancelRequest}
                      >
                        Dừng yêu cầu hiện tại
                      </button>
                    )}
                  </div>
                </div>
                </div>
              </div>
            </div>
          </div>
      </ScrollArea>

      <LuckyWheelDialog
        open={isWheelOpen}
        onOpenChange={(open) => setIsWheelOpen(open)}
        users={displayedPendingUsers}
        onWinner={handleWheelWinner}
        parentDialogTag={dialogTag}
      />
    </div>
  );
}
