'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogBody,
    DialogFooter,
    DialogAction,
} from "@/components/ui/dialog"
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Separator } from '@/components/ui/separator'
import { UserAvatar } from '@/components/user-avatar';
import type { Schedule, ManagedUser, UserRole, Availability, AssignedShift, AssignedUser } from '@/lib/types';
import { calculateTotalHours } from '@/lib/schedule-utils';
import { Users, Search, AlertCircle, Clock, ChevronLeft, ChevronRight, Loader2, Calendar, History as HistoryIcon, Hourglass, CalendarDays, LayoutGrid, User, TrendingUp, Filter, ArrowRight, Plus, Trash2, CalendarCheck, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, advancedSearch } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { dataStore } from '@/lib/data-store';

type TotalHoursDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: Schedule | null;
  availability: Availability[];
  allUsers: ManagedUser[];
  currentUserRole: UserRole | null;
  onUpdateSchedule?: (data: Partial<Schedule>) => void;
  daysOfWeek?: Date[];
  dialogTag: string;
  parentDialogTag: string;
};

const roleOrder: Record<UserRole, number> = {
  'Phục vụ': 1,
  'Pha chế': 2,
  'Quản lý': 3,
  'Chủ nhà hàng': 4,
  'Thu ngân': 5
};

const getRoleColors = (role: UserRole) => {
    switch (role) {
        case 'Quản lý': return 'from-purple-500/10 to-purple-600/5 text-purple-600 dark:text-purple-400 border-purple-200/50 dark:border-purple-800/50';
        case 'Phục vụ': return 'from-blue-500/10 to-blue-600/5 text-blue-600 dark:text-blue-400 border-blue-200/50 dark:border-blue-800/50';
        case 'Pha chế': return 'from-emerald-500/10 to-emerald-600/5 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/50';
        case 'Thu ngân': return 'from-orange-500/10 to-orange-600/5 text-orange-600 dark:text-orange-400 border-orange-200/50 dark:border-orange-800/50';
        default: return 'from-slate-500/10 to-slate-600/5 text-slate-600 dark:text-slate-400 border-slate-200/50 dark:border-slate-800/50';
    }
};

function AvailabilityTab({ 
    weekAvailability, 
    schedule, 
    user, 
    canManage, 
    onUpdateSchedule,
    daysOfWeek,
    container
}: { 
    weekAvailability: Availability[], 
    schedule: Schedule | null, 
    user: ManagedUser,
    canManage: boolean,
    onUpdateSchedule?: (data: Partial<Schedule>) => void,
    daysOfWeek?: Date[],
    container?: HTMLElement | null
}) {
    const [openDateKey, setOpenDateKey] = useState<string | null>(null);

    // 1. Get assigned shifts for this user
    const userAssignedShifts = useMemo(() => {
        if (!schedule) return [];
        return schedule.shifts.filter(shift => 
            shift.assignedUsers.some(au => au.userId === user.uid)
        );
    }, [schedule, user.uid]);

    // 2. Identify all dates in the week
    const weekDates = useMemo(() => {
        if (daysOfWeek && daysOfWeek.length > 0) {
            return daysOfWeek.map(d => format(d, 'yyyy-MM-dd'));
        }
        
        // Fallback to activity dates if daysOfWeek not provided
        const dates = new Set<string>();
        weekAvailability.forEach(a => {
            if (a.availableSlots.length > 0) dates.add(a.date as string);
        });
        userAssignedShifts.forEach(s => dates.add(s.date));
        return Array.from(dates).sort();
    }, [weekAvailability, userAssignedShifts, daysOfWeek]);

    if (weekDates.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="bg-primary/5 p-6 rounded-3xl mb-4 ring-1 ring-primary/10">
                    <Calendar className="h-10 w-10 text-primary/30" />
                </div>
                <h3 className="text-sm font-black text-foreground uppercase tracking-tight">Trống lịch</h3>
                <p className="text-[11px] text-muted-foreground/60 mt-2 max-w-[220px] font-medium leading-relaxed">
                    Không tìm thấy dữ liệu tuần làm việc.
                </p>
            </div>
        );
    }

    const handleAssign = (shiftId: string) => {
        if (!schedule || !onUpdateSchedule) return;
        
        const newShifts = schedule.shifts.map(shift => {
            if (shift.id === shiftId) {
                // Check if already assigned
                if (shift.assignedUsers.some(au => au.userId === user.uid)) return shift;
                
                return {
                    ...shift,
                    assignedUsers: [...shift.assignedUsers, { 
                        userId: user.uid, 
                        userName: user.displayName,
                        assignedRole: user.role // Default to user's main role
                    }]
                };
            }
            return shift;
        });
        
        onUpdateSchedule({ shifts: newShifts });
        setOpenDateKey(null);
    };

    const handleRemove = (shiftId: string) => {
        if (!schedule || !onUpdateSchedule) return;
        
        const newShifts = schedule.shifts.map(shift => {
            if (shift.id === shiftId) {
                return {
                    ...shift,
                    assignedUsers: shift.assignedUsers.filter(au => au.userId !== user.uid)
                };
            }
            return shift;
        });
        
        onUpdateSchedule({ shifts: newShifts });
    };

    return (
        <div className="space-y-4">
            {weekDates.map(dateKey => {
                const date = parseISO(dateKey);
                const dayAvail = weekAvailability.find(a => a.date === dateKey);
                const assignedShifts = userAssignedShifts.filter(s => s.date === dateKey);
                
                // Shifts on this day NOT assigned to this user
                const otherShiftsOnDay = schedule?.shifts.filter(s => 
                    s.date === dateKey && !s.assignedUsers.some(au => au.userId === user.uid)
                ) || [];

                return (
                    <div key={dateKey} className="group bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                        <div className="p-3.5 space-y-3">
                            {/* Date Header */}
                            <div className="flex items-center justify-between border-b border-border/30 pb-2">
                                <div className="flex items-center gap-2.5">
                                    <div className="h-8 w-8 rounded-lg bg-primary/5 flex items-center justify-center border border-primary/10">
                                        <CalendarDays className="h-4 w-4 text-primary" />
                                    </div>
                                    <div className="space-y-0">
                                        <h4 className="text-xs font-black capitalize tracking-tight leading-none">{format(date, 'eee, dd/MM', { locale: vi })}</h4>
                                        <p className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-widest">{format(date, 'eeee', { locale: vi })}</p>
                                    </div>
                                </div>

                                {canManage && otherShiftsOnDay.length > 0 && (
                                    <Popover 
                                        modal={false}
                                        open={openDateKey === dateKey} 
                                        onOpenChange={(open) => setOpenDateKey(open ? dateKey : null)}
                                    >
                                        <PopoverTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] font-black uppercase tracking-tight text-primary hover:bg-primary/5 focus:ring-0">
                                                <Plus className="h-3 w-3 mr-1" />
                                                Xếp ca
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent 
                                            className="w-56 p-1 border-border/40 shadow-xl backdrop-blur-sm" 
                                            align="end" 
                                            sideOffset={8}
                                            container={container}
                                        >
                                            <div className="p-1.5 space-y-1">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2 px-1">Ca làm trống ({format(date, 'dd/MM')})</p>
                                                <div className="max-h-[200px] overflow-y-auto pr-1 space-y-1 custom-scrollbar">
                                                    {otherShiftsOnDay.map(s => (
                                                        <Button 
                                                            key={s.id}
                                                            variant="ghost" 
                                                            className="w-full justify-start text-[10px] h-9 font-black uppercase tracking-tighter hover:bg-primary/5 hover:text-primary transition-all group/item"
                                                            onClick={() => handleAssign(s.id)}
                                                        >
                                                            <Clock className="h-3 w-3 mr-2 opacity-40 group-hover/item:opacity-100 group-hover/item:scale-110 transition-all" />
                                                            <div className="flex flex-col items-start leading-tight">
                                                                <span>{s.label}</span>
                                                                <span className="text-[8px] opacity-60 font-bold">{s.timeSlot.start}-{s.timeSlot.end}</span>
                                                            </div>
                                                            <Plus className="ml-auto h-3 w-3 opacity-0 group-hover/item:opacity-100 transition-all" />
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                )}
                            </div>

                            {/* Assigned Shifts */}
                            {assignedShifts.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-[8px] font-black uppercase tracking-[0.15em] text-blue-500/80 mb-1">Đã được xếp</p>
                                    <div className="grid grid-cols-1 gap-1.5">
                                        {assignedShifts.map(shift => (
                                            <div key={shift.id} className="flex items-center justify-between p-2 rounded-xl bg-blue-500/5 border border-blue-500/10 group/shift">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-6 w-6 rounded-md bg-blue-500/10 flex items-center justify-center">
                                                        <CalendarCheck className="h-3 w-3 text-blue-600" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-tight text-foreground/90">{shift.label}</p>
                                                        <p className="text-[9px] font-bold text-muted-foreground/70">{shift.timeSlot.start} - {shift.timeSlot.end}</p>
                                                    </div>
                                                </div>
                                                {canManage && (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-6 w-6 opacity-0 group-hover/shift:opacity-100 text-destructive/50 hover:text-destructive hover:bg-destructive/10 transition-all"
                                                        onClick={() => handleRemove(shift.id)}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Registered Availability */}
                            {dayAvail && dayAvail.availableSlots.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-[8px] font-black uppercase tracking-[0.15em] text-emerald-500/80 mb-1">Lịch rảnh đăng ký</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {dayAvail.availableSlots.map((slot, sIdx) => (
                                            <Badge key={sIdx} variant="outline" className="bg-emerald-500/5 text-[9px] py-0.5 px-2 rounded-lg font-bold border-emerald-500/20 text-emerald-700 flex items-center gap-1.5">
                                                <Clock className="h-2.5 w-2.5 opacity-60" />
                                                {slot.start} - {slot.end}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function HistoryTab({ user }: { user: ManagedUser }) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const monthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
    const monthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth]);

    useEffect(() => {
        setIsLoading(true);
        dataStore.getSchedulesForMonth(currentMonth).then(monthlySchedules => {
            setSchedules(monthlySchedules);
            setIsLoading(false);
        });
    }, [currentMonth]);

    const userShiftsByDate = useMemo(() => {
        const shiftsMap = new Map<string, { label: string; timeSlot: string; role: string }[]>();
        const publishedSchedules = schedules.filter((s: Schedule) => s.status === 'published');

        publishedSchedules.forEach((schedule: Schedule) => {
            schedule.shifts.forEach((shift: AssignedShift) => {
                const shiftDate = new Date(shift.date);
                if (shift.assignedUsers.some((u: AssignedUser) => u.userId === user.uid) && shiftDate >= monthStart && shiftDate <= monthEnd) {
                    const dateKey = shift.date;
                    if (!shiftsMap.has(dateKey)) {
                        shiftsMap.set(dateKey, []);
                    }
                    shiftsMap.get(dateKey)!.push({
                        label: shift.label,
                        timeSlot: `${shift.timeSlot.start}-${shift.timeSlot.end}`,
                        role: shift.role
                    });
                }
            });
        });
        return shiftsMap;
    }, [schedules, user.uid, monthStart, monthEnd]);

    const daysWithShifts = useMemo(() => {
        return (Array.from(userShiftsByDate.keys()) as string[]).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    }, [userShiftsByDate]);

    const totalHoursThisMonth = useMemo(() => {
        const publishedSchedules = schedules.filter((s: Schedule) => s.status === 'published');
        const shiftsThisMonth = publishedSchedules.flatMap((s: Schedule) => s.shifts)
            .filter((shift: AssignedShift) => {
                const shiftDate = new Date(shift.date);
                return shift.assignedUsers.some((u: AssignedUser) => u.userId === user.uid) &&
                    shiftDate >= monthStart && shiftDate <= monthEnd;
            });
        return calculateTotalHours(shiftsThisMonth.map((s: AssignedShift) => s.timeSlot));
    }, [schedules, user.uid, monthStart, monthEnd]);

    const handleMonthChange = (direction: 'prev' | 'next') => {
        setCurrentMonth((prev: Date) => {
            const newMonth = new Date(prev);
            newMonth.setMonth(newMonth.getMonth() + (direction === 'next' ? 1 : -1));
            return newMonth;
        });
    };

    return (
        <div className="space-y-4">
            <div className="bg-gradient-to-r from-primary/10 to-transparent border border-primary/10 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm">
                <div className="space-y-1">
                    <p className="text-[10px] font-black text-primary/70 uppercase tracking-[0.15em]">Tổng quan tháng</p>
                    <h4 className="text-sm font-black text-foreground capitalize leading-none">{format(currentMonth, 'MMMM yyyy', { locale: vi })}</h4>
                    <div className="flex items-center gap-2 mt-1 px-2 py-0.5 bg-primary text-white rounded-full w-fit">
                        <Clock className="h-2.5 w-2.5" />
                        <span className="text-[10px] font-black">{totalHoursThisMonth.toFixed(1)}h tích lũy</span>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 bg-background/50 p-0.5 rounded-xl border border-border/50">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleMonthChange('prev')}
                        className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-all"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleMonthChange('next')}
                        className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-all"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="relative min-h-[180px]">
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                            <div 
                                className="h-8 w-8 border-3 border-primary/10 border-t-primary rounded-full animate-spin"
                            />
                            <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] animate-pulse">Đang đồng bộ...</p>
                        </div>
                    </div>
                ) : daysWithShifts.length > 0 ? (
                    <div className="space-y-3.5 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-[2px] before:bg-muted/50 before:rounded-full">
                        {daysWithShifts.map((dateKey: string, idx: number) => {
                            const shiftsForDay = userShiftsByDate.get(dateKey) || [];
                            const timeSlotsForDay = shiftsForDay.map(s => {
                                const [start, end] = s.timeSlot.split('-');
                                return { start, end };
                            });
                            const dailyTotalHours = calculateTotalHours(timeSlotsForDay);
                            const date = new Date(dateKey);

                            return (
                                <div
                                    key={dateKey}
                                    className="relative pl-10"
                                >
                                    <div className="absolute left-[12.5px] top-3 w-3 h-3 rounded-full border-3 border-background bg-orange-500 shadow-sm z-10" />
                                    
                                    <div className="bg-card border border-border/50 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                                        <div className="p-3.5 space-y-2.5">
                                            <div className="flex items-center justify-between border-b border-border/40 pb-2">
                                                <div className="space-y-0.5">
                                                    <h4 className="text-xs font-black capitalize tracking-tight">
                                                        {format(date, 'eeee', { locale: vi })}
                                                    </h4>
                                                    <p className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-widest leading-none">
                                                        {format(date, 'dd/MM/yyyy')}
                                                    </p>
                                                </div>
                                                <div className="px-2 py-0.5 bg-orange-500/10 text-orange-600 rounded-lg text-[9px] font-black border border-orange-500/10">
                                                    {dailyTotalHours.toFixed(1)} Giờ
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                {shiftsForDay.map((shift, sIdx) => (
                                                    <div 
                                                        key={sIdx} 
                                                        className="bg-muted/30 rounded-lg p-2.5 border border-border/5 flex items-center justify-between gap-3 group/item border-l-4 border-orange-500/30"
                                                    >
                                                        <div className="space-y-0.5">
                                                            <p className="text-[10px] font-black tracking-tight leading-none uppercase text-foreground/80 group-hover/item:text-primary transition-colors">{shift.label}</p>
                                                            <p className="text-[9px] text-muted-foreground/70 font-bold tracking-tight flex items-center gap-1.5">
                                                                <Clock className="h-2.5 w-2.5" />
                                                                {shift.timeSlot}
                                                            </p>
                                                        </div>
                                                        <Badge variant="secondary" className="text-[8px] h-4.5 px-1.5 rounded-md font-black uppercase tracking-wider bg-background/80 shadow-sm border-border/40">
                                                            {shift.role}
                                                        </Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div 
                        className="flex flex-col items-center justify-center py-16 text-center"
                    >
                        <div className="bg-muted/30 p-6 rounded-3xl mb-4">
                            <Hourglass className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                        <h3 className="text-xs font-black uppercase tracking-tight">Chưa có dữ liệu</h3>
                        <p className="text-[10px] text-muted-foreground/60 mt-2 max-w-[200px] font-medium leading-relaxed">
                            Hệ thống chưa ghi nhận ca làm nào của nhân sự trong tháng này.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function TotalHoursDialog({ open, onOpenChange, schedule, availability, allUsers, currentUserRole, onUpdateSchedule, daysOfWeek, dialogTag, parentDialogTag }: TotalHoursDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const canManage = useMemo(() => currentUserRole === 'Chủ nhà hàng', [currentUserRole]);

  const totalHoursByUser = useMemo(() => {
    if (!schedule) return new Map<string, number>();

    const hoursMap = new Map<string, number>();
    schedule.shifts.forEach(shift => {
      const shiftDuration = calculateTotalHours([shift.timeSlot]);
      shift.assignedUsers.forEach(user => {
        hoursMap.set(user.userId, (hoursMap.get(user.userId) || 0) + shiftDuration);
      });
    });
    return hoursMap;
  }, [schedule]);

  const availableHoursByUser = useMemo(() => {
    if (!availability) return new Map<string, number>();

    const hoursMap = new Map<string, number>();
    availability.forEach(avail => {
        const userHours = calculateTotalHours(avail.availableSlots);
        hoursMap.set(avail.userId, (hoursMap.get(avail.userId) || 0) + userHours);
    });
    return hoursMap;
  }, [availability]);
  
  const sortedUsers = useMemo(() => {
    let activeUsers = allUsers;

    if (currentUserRole && currentUserRole === 'Quản lý') {
        activeUsers = allUsers.filter(u => u.role !== 'Chủ nhà hàng' && !u.displayName.includes('Không chọn'));
    }

    return activeUsers.sort((a,b) => {
        const roleA = roleOrder[a.role] || 99;
        const roleB = roleOrder[b.role] || 99;
        if (roleA !== roleB) {
            return roleA - roleB;
        }
        return a.displayName.localeCompare(b.displayName);
    })
  }, [allUsers, currentUserRole]);

  const filteredUsers = useMemo(() => {
    return advancedSearch(sortedUsers, searchTerm, ['displayName', 'role']);
  }, [sortedUsers, searchTerm]);

  const stats = useMemo(() => {
    let totalScheduled = 0;
    totalHoursByUser.forEach(h => totalScheduled += h);
    return {
        totalEmployees: sortedUsers.length,
        totalHours: totalScheduled
    };
  }, [sortedUsers, totalHoursByUser]);

  const weekAvailabilityForSelectedUser = useMemo(() => {
    if (!selectedUser) return [];
    return availability.filter(a => a.userId === selectedUser.uid);
  }, [availability, selectedUser]);

  if (!schedule) return null;

  const handleClose = () => {
    setSelectedUser(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
        if (!val) setSelectedUser(null);
        onOpenChange(val);
    }} dialogTag={dialogTag} parentDialogTag={parentDialogTag}>
      <DialogContent 
        ref={containerRef}
        className="p-0 overflow-hidden sm:rounded-3xl border-none shadow-2xl bg-background/95 backdrop-blur-xl max-w-lg"
      >
            {!selectedUser ? (
                <div 
                    key="user-list"
                    className="flex flex-col h-full max-h-[80vh]"
                >
                    <DialogHeader className="p-4 pb-1 space-y-1 relative" icon={<Users className="h-5 w-5 text-primary" />}>
                        <DialogTitle className="text-lg font-black tracking-tight flex items-center gap-2">
                            Tổng Giờ Làm
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground/60 font-bold uppercase text-[8px] tracking-[0.15em] mt-0 flex items-center gap-1.5">
                            <TrendingUp className="h-2 w-2 text-emerald-500" />
                            Tuần này
                        </DialogDescription>
                    </DialogHeader>

                    <DialogBody className="p-0 flex flex-col min-h-0">
                        <div className="px-4 py-2 space-y-2.5">
                            <div className="grid grid-cols-2 gap-2">
                                <div className="p-2.5 bg-gradient-to-br from-primary via-primary/90 to-primary/80 rounded-xl shadow-lg shadow-primary/20 text-white relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:scale-110 transition-transform duration-500">
                                        <Users className="h-8 w-8" />
                                    </div>
                                    <p className="text-[8px] font-black uppercase tracking-widest text-white/70">Nhân sự</p>
                                    <div className="flex items-baseline gap-1 mt-0">
                                        <p className="text-xl font-black">{stats.totalEmployees}</p>
                                        <p className="text-[9px] font-bold text-white/60">người</p>
                                    </div>
                                </div>
                                <div className="p-2.5 bg-card border border-border/60 rounded-xl shadow-sm relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:scale-110 transition-transform duration-500">
                                        <Clock className="h-8 w-8" />
                                    </div>
                                    <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60">Tổng giờ</p>
                                    <div className="flex items-baseline gap-1 mt-0">
                                        <p className="text-xl font-black text-foreground">{stats.totalHours.toFixed(1)}h</p>
                                    </div>
                                    <div className="h-0.5 w-6 bg-primary rounded-full mt-1" />
                                </div>
                            </div>

                            <div className="relative group">
                                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                    <Search className="h-3.5 w-3.5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                                </div>
                                <Input
                                    placeholder="Tìm theo tên hoặc vai trò..."
                                    className="pl-9 h-9 bg-muted/20 border-none hover:bg-muted/30 focus:bg-background focus:ring-1 focus:ring-primary/20 rounded-lg transition-all font-semibold text-[11px] placeholder:text-muted-foreground/40"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <ScrollArea className="flex-1 px-4 pb-4 mt-0.5">
                            <div className="grid grid-cols-1 gap-1.5 pr-2">
                                {filteredUsers.map((user, idx) => {
                                    const workedHours = totalHoursByUser.get(user.uid) || 0;
                                    const availableHours = availableHoursByUser.get(user.uid) || 0;
                                    const progressValue = availableHours > 0 ? (workedHours / availableHours) * 100 : 0;
                                    const isOverworked = workedHours > availableHours && availableHours > 0;
                                    const roleStyles = getRoleColors(user.role);
                                    
                                    return (
                                        <div 
                                            key={user.uid}
                                            className="group relative flex flex-col p-2.5 rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 cursor-pointer transition-all duration-300"
                                            onClick={() => setSelectedUser(user)}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-3">
                                                    <UserAvatar user={user} rounded="xl" className={cn("shadow-inner border bg-gradient-to-br transition-transform group-hover:scale-105 duration-300", roleStyles)} />
                                                    <div className="space-y-0 text-left">
                                                        <p className="font-bold text-xs text-foreground group-hover:text-primary transition-colors leading-tight">{user.displayName}</p>
                                                        <Badge variant="outline" className={cn("text-[7px] px-1 py-0 h-3.5 border-none font-black uppercase tracking-wider rounded-md bg-gradient-to-r mt-0.5", roleStyles)}>
                                                            {user.role}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <div className="flex items-baseline gap-0.5 bg-muted/40 px-2 py-0.5 rounded-full group-hover:bg-primary/10 transition-colors">
                                                        <span className={cn("text-sm font-black tracking-tight", isOverworked ? "text-destructive" : "text-primary")}>
                                                            {workedHours.toFixed(1)}
                                                        </span>
                                                        <span className="text-[8px] font-bold text-muted-foreground uppercase">h</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <div className="flex justify-between items-center text-[7px] font-black uppercase tracking-widest text-muted-foreground/50 px-0.5">
                                                    <div className="flex items-center gap-1">
                                                        <span>Tỷ lệ được xếp</span>
                                                        {isOverworked && <AlertCircle className="h-2 w-2 text-destructive animate-pulse" />}
                                                    </div>
                                                    <span className={isOverworked ? "text-destructive" : "text-primary"}>
                                                        {Math.round(progressValue)}%
                                                    </span>
                                                </div>
                                                <div className="relative h-1 w-full bg-muted/30 rounded-full overflow-hidden border border-border/5">
                                                    <div 
                                                        style={{ width: `${Math.min(progressValue, 100)}%` }}
                                                        className={cn(
                                                            "h-full rounded-full shadow-sm", 
                                                            isOverworked ? "bg-destructive" : (progressValue > 85 ? "bg-amber-500" : "bg-primary")
                                                        )}
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300">
                                                <ChevronRight className="h-3 w-3 text-primary" />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </ScrollArea>
                    </DialogBody>
                </div>
            ) : (
                <div 
                    key="user-detail"
                    className="flex flex-col h-full max-h-[85vh]"
                >
                    <DialogHeader className="space-y-4 relative" hideicon>
                        <div className="flex items-center gap-3">
                            <Button 
                                variant="secondary" 
                                size="icon" 
                                className="h-7 w-7 rounded-lg shadow-sm border border-border/40 hover:bg-background hover:scale-105 active:scale-95 transition-all flex-shrink-0" 
                                onClick={() => setSelectedUser(null)}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div className="flex items-center gap-3">
                                <UserAvatar user={selectedUser} size="h-10 w-10 text-lg" rounded="xl" className={cn("shadow-md bg-gradient-to-br", getRoleColors(selectedUser.role))} />
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <DialogTitle className="text-lg font-black tracking-tight leading-none">{selectedUser.displayName}</DialogTitle>
                                        <Badge variant="outline" className={cn("text-[7px] px-1.5 py-0 border-none font-black uppercase tracking-widest bg-gradient-to-r shadow-sm h-3.5 rounded-md", getRoleColors(selectedUser.role))}>
                                            {selectedUser.role}
                                        </Badge>
                                    </div>
                                    <DialogDescription className="text-[8px] text-muted-foreground/60 font-bold uppercase tracking-widest flex items-center gap-1.5 leading-none">
                                        <User className="h-2 w-2" />
                                        Hồ sơ & Hoạt động
                                    </DialogDescription>
                                </div>
                            </div>
                        </div>
                    </DialogHeader>

                    <DialogBody className="p-0 flex flex-col min-h-0">
                        <Tabs defaultValue="availability" className="w-full h-full flex flex-col">
                            <div className="px-4 border-b border-border/40 flex items-center justify-between">
                                <TabsList className="h-9 bg-transparent p-0 gap-6">
                                    <TabsTrigger 
                                        value="availability" 
                                        className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 text-[10px] font-black uppercase tracking-widest opacity-40 data-[state=active]:opacity-100 transition-all font-bold"
                                    >
                                        Đăng ký
                                    </TabsTrigger>
                                    <TabsTrigger 
                                        value="history" 
                                        className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 text-[10px] font-black uppercase tracking-widest opacity-40 data-[state=active]:opacity-100 transition-all font-bold"
                                    >
                                        Lịch sử
                                    </TabsTrigger>
                                </TabsList>
                                <div className="h-5 w-px bg-border/40" />
                                <div className="flex items-center gap-1">
                                    <Filter className="h-2.5 w-2.5 text-muted-foreground/40" />
                                    <span className="text-[8px] font-black uppercase tracking-tighter text-muted-foreground/40">Bộ lọc</span>
                                </div>
                            </div>
                            
                            <ScrollArea className="flex-1">
                                <div className="p-4">
                                    <TabsContent value="availability" className="mt-0 focus-visible:outline-none outline-none ring-0">
                                        <AvailabilityTab 
                                            weekAvailability={weekAvailabilityForSelectedUser} 
                                            schedule={schedule}
                                            user={selectedUser}
                                            canManage={canManage}
                                            onUpdateSchedule={onUpdateSchedule}
                                            daysOfWeek={daysOfWeek}
                                            container={containerRef.current}
                                        />
                                    </TabsContent>
                                    <TabsContent value="history" className="mt-0 focus-visible:outline-none outline-none ring-0">
                                        <HistoryTab user={selectedUser} />
                                    </TabsContent>
                                </div>
                            </ScrollArea>
                        </Tabs>
                    </DialogBody>
                </div>
            )}
      </DialogContent>
    </Dialog>
  );
}

