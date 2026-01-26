
'use client';
import { useState, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogBody,
    DialogFooter,
    DialogAction,
    DialogCancel,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Users, UserCheck, Send, Loader2, Replace, CheckCircle2 } from 'lucide-react';
import type { ManagedUser, Schedule, AssignedShift, Availability, AuthUser, Notification, ShiftTemplate, UserRole } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { isUserAvailable } from '@/lib/schedule-utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/use-auth';
import { hasTimeConflict } from '@/lib/schedule-utils';
import { toast } from '@/components/ui/pro-toast';

import { UserAvatar } from '@/components/user-avatar';
import { Badge } from '@/components/ui/badge';
import { cn, getInitials } from '@/lib/utils';

type ShiftInfoDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    shift: AssignedShift;
    schedule: Schedule;
    allUsers: ManagedUser[];
    availability: Availability[];
    onDirectPassRequest: (shift: AssignedShift, targetUser: ManagedUser, isSwap: boolean, targetUserShift: AssignedShift | null) => Promise<void>;
    isProcessing: boolean;
    notifications: Notification[];
    parentDialogTag: string;
};

type ColleagueInfo = {
    user: ManagedUser;
    shift: AssignedShift;
    assignedRole?: UserRole | null;
}

export default function ShiftInfoDialog({
    isOpen,
    onClose,
    shift,
    schedule,
    allUsers,
    availability,
    onDirectPassRequest,
    isProcessing,
    notifications,
    parentDialogTag
}: ShiftInfoDialogProps) {
    const { user: currentUser } = useAuth();
    const [processingUserId, setProcessingUserId] = useState<string | null>(null);


    const parseTime = (time: string): number => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    };

    const { colleagues, availableStaff } = useMemo(() => {
        if (!shift || !currentUser) return { colleagues: [], availableStaff: [] };

        const shiftDate = shift.date;
        const shiftStart = parseTime(shift.timeSlot.start);
        const shiftEnd = parseTime(shift.timeSlot.end);

        const colleagueMap = new Map<string, ColleagueInfo>();

        const overlappingShifts = schedule.shifts.filter(s =>
            s.date === shiftDate &&
            parseTime(s.timeSlot.start) < shiftEnd &&
            shiftStart < parseTime(s.timeSlot.end)
        );

        overlappingShifts.forEach(overlappingShift => {
            overlappingShift.assignedUsers.forEach(u => {
                if (u.userId !== currentUser.uid && !colleagueMap.has(u.userId)) {
                    const user = allUsers.find(au => au.uid === u.userId);
                    if (user) {
                        const assignedRole = (overlappingShift.assignedUsers.find(x => x.userId === u.userId)?.assignedRole) ?? null;
                        colleagueMap.set(u.userId, { user, shift: overlappingShift, assignedRole });
                    }
                }
            });
        });

        const colleagues = Array.from(colleagueMap.values());

        const availabilityForDay = availability.filter(a => a.date === shiftDate);
        const assignedUserIdsInPeriod = new Set(colleagues.map(c => c.user.uid));
        shift.assignedUsers.forEach(u => assignedUserIdsInPeriod.add(u.userId));


        const availableStaff = allUsers.filter(u => {
            if (assignedUserIdsInPeriod.has(u.uid)) {
                return false;
            }
            return isUserAvailable(u.uid, shift.timeSlot, availabilityForDay);
        });

        return { colleagues, availableStaff };
    }, [shift, schedule, allUsers, currentUser, availability]);

    const existingPendingRequests = useMemo(() => {
        return notifications.filter(n =>
            n.type === 'pass_request' &&
            n.payload.shiftId === shift.id &&
            (n.status === 'pending' || n.status === 'pending_approval')
        );
    }, [notifications, shift.id]);


    if (!shift) return null;

    const handlePassRequest = async (targetUser: ManagedUser, isSwap: boolean) => {
        setProcessingUserId(targetUser.uid);
        try {
            let targetUserShift: AssignedShift | null = null;
            if (isSwap) {
                const colleagueInfo = colleagues.find(c => c.user.uid === targetUser.uid);
                if (colleagueInfo) {
                    targetUserShift = colleagueInfo.shift;
                } else {
                    toast.error(`${targetUser.displayName} không có ca làm việc phù hợp để đổi.`);
                    setProcessingUserId(null);
                    return;
                }
            }
            await onDirectPassRequest(shift, targetUser, isSwap, targetUserShift);
        } catch (error: any) {
            toast.error(error.message || "Không thể gửi yêu cầu.");
        } finally {
            setProcessingUserId(null);
        }
    }


    return (
        <Dialog open={isOpen} onOpenChange={onClose} dialogTag="shift-info-dialog" parentDialogTag={parentDialogTag}>
            <DialogContent>
                <DialogHeader variant="premium" iconkey="info">
                    <DialogTitle>{shift.label}</DialogTitle>
                    <DialogDescription className="font-bold text-[10px] uppercase tracking-[0.2em] mt-1.5 opacity-80">
                        {format(parseISO(shift.date), 'eeee, dd/MM', { locale: vi })} | {shift.timeSlot.start} - {shift.timeSlot.end}
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="colleagues" className="w-full">
                    <div className="px-4 sm:px-8 py-4">
                        <TabsList className="grid w-full grid-cols-2 h-11 sm:h-12 p-1.5 bg-muted/50 rounded-[20px] border border-muted-foreground/5">
                            <TabsTrigger
                                value="colleagues"
                                className="rounded-[14px] text-[10px] sm:text-[11px] font-black uppercase tracking-tight sm:tracking-wider data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all whitespace-nowrap overflow-hidden text-ellipsis"
                            >
                                Nhân viên ({colleagues.length})
                            </TabsTrigger>
                            <TabsTrigger
                                value="available"
                                className="rounded-[14px] text-[10px] sm:text-[11px] font-black uppercase tracking-tight sm:tracking-wider data-[state=active]:bg-background data-[state=active]:text-emerald-500 data-[state=active]:shadow-sm transition-all whitespace-nowrap overflow-hidden text-ellipsis"
                            >
                                Đang rảnh ({availableStaff.length})
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <DialogBody className="bg-muted/5 py-2">
                        <TabsContent value="colleagues" className="mt-0 focus-visible:outline-none space-y-3 px-1 pb-4">
                            {colleagues.length > 0 ? (
                                <div className="space-y-2.5">
                                    {colleagues.map(({ user, shift: colleagueShift, assignedRole }) => {
                                        const canSwap = shift.label !== colleagueShift.label || (shift.timeSlot.start !== colleagueShift.timeSlot.start || shift.timeSlot.end !== colleagueShift.timeSlot.end);
                                        const alreadyRequested = existingPendingRequests.some(r => r.payload.targetUserId === user.uid);
                                        const isThisUserProcessing = processingUserId === user.uid;
                                        return (
                                            <div key={user.uid} className="flex items-center justify-between p-3 sm:p-4 rounded-[22px] bg-background border border-muted-foreground/5 shadow-sm transition-all hover:border-primary/20 hover:shadow-md group">
                                                <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
                                                    <div className="relative shrink-0">
                                                        <UserAvatar user={user} size="h-9 w-9 sm:h-11 sm:w-11" rounded="xl" />
                                                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 sm:w-5 sm:h-5 bg-background rounded-full flex items-center justify-center border border-muted-foreground/10 shadow-sm">
                                                            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-500" />
                                                        </div>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-[13px] sm:text-sm text-foreground tracking-tight leading-none mb-1.5 group-hover:text-primary transition-colors">{user.displayName}</p>
                                                        <div className="flex items-center gap-1.5 sm:gap-2">
                                                            <Badge variant="outline" className="text-[8px] sm:text-[9px] h-4 sm:h-4.5 px-1 sm:px-1.5 font-black border-muted-foreground/10 bg-muted/30 text-muted-foreground/80 uppercase tracking-widest rounded-[6px]">
                                                                {assignedRole || colleagueShift.role || 'NHÂN VIÊN'}
                                                            </Badge>
                                                            <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground/50 tabular-nums bg-muted/20 px-1 sm:px-1.5 py-0.5 rounded-[6px] whitespace-nowrap">
                                                                {colleagueShift.timeSlot.start}-{colleagueShift.timeSlot.end}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {canSwap && (
                                                    <Button
                                                        size="sm"
                                                        variant={alreadyRequested ? "ghost" : "outline"}
                                                        onClick={() => handlePassRequest(user, true)}
                                                        disabled={isProcessing || isThisUserProcessing || alreadyRequested}
                                                        className={cn(
                                                            "h-9 sm:h-10 rounded-[14px] font-black text-[9px] sm:text-[10px] uppercase tracking-wider px-3 sm:px-4 transition-all active:scale-95 shrink-0 ml-2",
                                                            !alreadyRequested && "border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary shadow-sm"
                                                        )}
                                                    >
                                                        {isProcessing || isThisUserProcessing ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-1.5" />
                                                        ) : alreadyRequested ? (
                                                            <CheckCircle2 className="sm:mr-1.5 h-3.5 w-3.5 text-primary" />
                                                        ) : (
                                                            <Replace className="sm:mr-1.5 h-3.5 w-3.5" />
                                                        )}
                                                        <span className="hidden sm:inline">{alreadyRequested ? 'Đã nhờ' : 'Đổi ca'}</span>
                                                        <span className="sm:hidden">{alreadyRequested ? 'Đã nhờ' : 'Đổi'}</span>
                                                    </Button>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 sm:py-16 text-center">
                                    <div className="h-12 w-12 sm:h-16 sm:w-16 bg-muted/50 rounded-[22px] sm:rounded-[28px] flex items-center justify-center mb-4 border border-muted-foreground/5 shadow-inner">
                                        <Users className="h-5 w-5 sm:h-7 sm:w-7 text-muted-foreground/30" />
                                    </div>
                                    <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em]">Không có đồng nghiệp</p>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="available" className="mt-0 focus-visible:outline-none space-y-3 px-1 pb-4">
                            {availableStaff.length > 0 ? (
                                <div className="space-y-2.5">
                                    {availableStaff.map(user => {
                                        const alreadyRequested = existingPendingRequests.some(r => r.payload.targetUserId === user.uid);
                                        const isThisUserProcessing = processingUserId === user.uid;
                                        return (
                                            <div key={user.uid} className="flex items-center justify-between p-3 sm:p-4 rounded-[22px] bg-background border border-muted-foreground/5 shadow-sm transition-all hover:border-emerald-500/20 hover:shadow-md group">
                                                <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
                                                    <div className="relative shrink-0">
                                                        <UserAvatar user={user} size="h-9 w-9 sm:h-11 sm:w-11" rounded="xl" />
                                                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 sm:w-5 sm:h-5 bg-background rounded-full flex items-center justify-center border border-muted-foreground/10 shadow-sm">
                                                            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-500/50" />
                                                        </div>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-[13px] sm:text-sm text-foreground tracking-tight leading-none mb-1.5 group-hover:text-emerald-500 transition-colors">{user.displayName}</p>
                                                        <p className="text-[8px] sm:text-[9px] font-black text-emerald-500/60 uppercase tracking-widest bg-emerald-500/5 px-2 py-0.5 rounded-[6px] w-fit">{user.role}</p>
                                                    </div>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant={alreadyRequested ? "ghost" : "outline"}
                                                    onClick={() => handlePassRequest(user, false)}
                                                    disabled={isProcessing || isThisUserProcessing || alreadyRequested}
                                                    className={cn(
                                                        "h-9 sm:h-10 rounded-[14px] font-black text-[9px] sm:text-[10px] uppercase tracking-wider px-3 sm:px-4 transition-all active:scale-95 shrink-0 ml-2",
                                                        !alreadyRequested && "border-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 shadow-sm"
                                                    )}
                                                >
                                                    {isProcessing || isThisUserProcessing ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-1.5" />
                                                    ) : alreadyRequested ? (
                                                        <CheckCircle2 className="sm:mr-1.5 h-3.5 w-3.5 text-emerald-500" />
                                                    ) : (
                                                        <Send className="sm:mr-1.5 h-3.5 w-3.5" />
                                                    )}
                                                    <span className="hidden sm:inline">{alreadyRequested ? 'Đã nhờ' : 'Nhờ nhận'}</span>
                                                    <span className="sm:hidden">{alreadyRequested ? 'Đã nhờ' : 'Nhờ'}</span>
                                                </Button>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 sm:py-16 text-center">
                                    <div className="h-12 w-12 sm:h-16 sm:w-16 bg-muted/50 rounded-[22px] sm:rounded-[28px] flex items-center justify-center mb-4 border border-muted-foreground/5 shadow-inner">
                                        <UserCheck className="h-5 w-5 sm:h-7 sm:w-7 text-muted-foreground/30" />
                                    </div>
                                    <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em]">Không có nhân viên rảnh</p>
                                </div>
                            )}
                        </TabsContent>
                    </DialogBody>
                </Tabs>

                <DialogFooter variant="muted" className="p-6">
                    <DialogCancel onClick={onClose} className="w-full h-12 rounded-[18px] font-black uppercase tracking-widest text-xs">
                        Đóng cửa sổ
                    </DialogCancel>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
