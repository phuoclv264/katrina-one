
'use client';
import { useState, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Users, UserCheck, Send, Loader2, Replace } from 'lucide-react';
import type { ManagedUser, Schedule, AssignedShift, Availability, AuthUser, Notification, ShiftTemplate, UserRole } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { isUserAvailable } from '@/lib/schedule-utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/use-auth';
import { hasTimeConflict } from '@/lib/schedule-utils';
import { toast } from '@/components/ui/pro-toast';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
            <DialogContent className="w-[92vw] sm:max-w-lg p-0 overflow-hidden rounded-[38px] sm:rounded-[40px] border-none shadow-3xl bg-white dark:bg-slate-950">
                <div className="p-4 sm:p-5 pb-0">
                    <DialogHeader className="space-y-4">
                        <div className="flex items-center gap-3 sm:gap-4">
                            <div className="h-12 w-12 sm:h-14 sm:w-14 bg-blue-500/10 rounded-[18px] sm:rounded-[20px] flex items-center justify-center shrink-0">
                                <Users className="h-6 w-6 sm:h-7 sm:w-7 text-blue-500" />
                            </div>
                            <div className="min-w-0">
                                <DialogTitle className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-50 leading-tight">
                                    {shift.label}
                                </DialogTitle>
                                <DialogDescription className="text-sm sm:text-base font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                                    {format(parseISO(shift.date), 'eeee, dd/MM', { locale: vi }).toUpperCase()} | {shift.timeSlot.start} - {shift.timeSlot.end}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <Tabs defaultValue="colleagues" className="w-full mt-4 sm:mt-5">
                    <div className="px-5 sm:px-6">
                        <TabsList className="flex w-full h-10 sm:h-11 p-1 bg-slate-100 dark:bg-slate-900 rounded-[18px] sm:rounded-[20px] gap-1">
                            <TabsTrigger
                                value="colleagues"
                                className="flex-1 rounded-[13px] sm:rounded-[14px] text-xs sm:text-sm font-black tracking-tight data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:text-blue-500 px-2"
                            >
                                Nhân viên ca ({colleagues.length})
                            </TabsTrigger>
                            <TabsTrigger
                                value="available"
                                className="flex-1 rounded-[13px] sm:rounded-[14px] text-xs sm:text-sm font-black tracking-tight data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:text-green-500 px-2"
                            >
                                Đang rảnh ({availableStaff.length})
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="colleagues" className="mt-3">
                        <ScrollArea className="h-[36vh] sm:h-64 px-4 sm:px-5 pb-4">
                            {colleagues.length > 0 ? (
                                <div className="space-y-3">
                                    {colleagues.map(({ user, shift: colleagueShift, assignedRole }) => {
                                        const canSwap = shift.label !== colleagueShift.label || (shift.timeSlot.start !== colleagueShift.timeSlot.start || shift.timeSlot.end !== colleagueShift.timeSlot.end);
                                        const alreadyRequested = existingPendingRequests.some(r => r.payload.targetUserId === user.uid);
                                        const isThisUserProcessing = processingUserId === user.uid;
                                        return (
                                            <div key={user.uid} className="group relative flex items-center justify-between p-2.5 sm:p-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all">
                                                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                                    <Avatar className="h-9 w-9 sm:h-10 sm:w-10 rounded-[12px] sm:rounded-[14px]">
                                                        <AvatarImage src={user.photoURL || ""} />
                                                        <AvatarFallback className="bg-blue-100 text-blue-600 font-black text-[10px] sm:text-xs uppercase rounded-[12px] sm:rounded-[14px]">
                                                            {getInitials(user.displayName)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0">
                                                        <p className="font-black text-sm sm:text-base text-slate-900 dark:text-slate-100 tracking-tight break-words whitespace-normal leading-tight">{user.displayName}</p>
                                                        <div className="flex items-center gap-1 sm:gap-1.5 mt-0.5">
                                                            <Badge variant="outline" className="text-[9px] sm:text-[10px] h-4 sm:h-4 px-1 sm:px-1.5 font-black border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider rounded-md">
                                                                {assignedRole || colleagueShift.role || 'NHÂN VIÊN'}
                                                            </Badge>
                                                            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400">
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
                                                            "h-8 sm:h-9 rounded-xl font-black text-[11px] sm:text-[12px] px-3 sm:px-3.5 uppercase tracking-tighter transition-all",
                                                            !alreadyRequested && "border-blue-500/20 text-blue-500 hover:bg-blue-500 hover:text-white"
                                                        )}
                                                    >
                                                        {isProcessing || isThisUserProcessing ? <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin mr-1 sm:mr-1.5" /> : <Replace className="mr-1 sm:mr-1.5 h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-500 group-hover:text-white" />}
                                                        {alreadyRequested ? 'Đã nhờ' : 'Đổi ca'}
                                                    </Button>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 sm:py-12 text-center">
                                    <div className="h-9 w-9 sm:h-10 sm:w-10 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-3">
                                        <Users className="h-5 w-5 sm:h-6 sm:w-6 text-slate-300 dark:text-slate-700" />
                                    </div>
                                    <p className="text-sm sm:text-base font-bold text-slate-400 uppercase tracking-widest">Không có đồng nghiệp</p>
                                </div>
                            )}
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="available" className="mt-3">
                        <ScrollArea className="h-[36vh] sm:h-64 px-4 sm:px-5 pb-4">
                            {availableStaff.length > 0 ? (
                                <div className="space-y-3">
                                    {availableStaff.map(user => {
                                        const alreadyRequested = existingPendingRequests.some(r => r.payload.targetUserId === user.uid);
                                        const isThisUserProcessing = processingUserId === user.uid;
                                        return (
                                            <div key={user.uid} className="group relative flex items-center justify-between p-2.5 sm:p-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all">
                                                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                                    <Avatar className="h-9 w-9 sm:h-10 sm:w-10 rounded-[12px] sm:rounded-[14px]">
                                                        <AvatarImage src={user.photoURL || ""} />
                                                        <AvatarFallback className="bg-green-100 text-green-600 font-black text-[10px] sm:text-xs uppercase rounded-[12px] sm:rounded-[14px]">
                                                            {getInitials(user.displayName)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0">
                                                        <p className="font-black text-sm sm:text-base text-slate-900 dark:text-slate-100 tracking-tight break-words whitespace-normal leading-tight">{user.displayName}</p>
                                                        <p className="text-[10px] sm:text-[11px] font-black text-green-500/80 uppercase tracking-widest mt-0.5">{user.role}</p>
                                                    </div>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant={alreadyRequested ? "ghost" : "outline"}
                                                    onClick={() => handlePassRequest(user, false)}
                                                    disabled={isProcessing || isThisUserProcessing || alreadyRequested}
                                                    className={cn(
                                                        "h-8 sm:h-9 rounded-xl font-black text-[11px] sm:text-[12px] px-3 sm:px-3.5 uppercase tracking-tighter transition-all",
                                                        !alreadyRequested && "border-green-500/20 text-green-500 hover:bg-green-500 hover:text-white"
                                                    )}
                                                >
                                                    {isProcessing || isThisUserProcessing ? <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin mr-1 sm:mr-1.5" /> : <Send className="mr-1 sm:mr-1.5 h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-500 group-hover:text-white" />}
                                                    {alreadyRequested ? 'Đã nhờ' : 'Nhờ nhận'}
                                                </Button>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 sm:py-12 text-center">
                                    <div className="h-9 w-9 sm:h-10 sm:w-10 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-3">
                                        <UserCheck className="h-5 w-5 sm:h-6 sm:w-6 text-slate-300 dark:text-slate-700" />
                                    </div>
                                    <p className="text-sm sm:text-base font-bold text-slate-400 uppercase tracking-widest">Không có nhân viên rảnh</p>
                                </div>
                            )}
                        </ScrollArea>
                    </TabsContent>
                </Tabs>

                <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-2">
                    <Button variant="ghost" className="w-full h-11 sm:h-12 rounded-xl sm:rounded-2xl font-black text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all text-[12px] sm:text-sm uppercase tracking-widest" onClick={onClose}>
                        ĐÓNG
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
