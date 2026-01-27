

'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogBody,
    DialogFooter,
    DialogAction,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/combobox';
import { Calendar } from '@/components/ui/calendar';
import type { ManagedUser, Schedule, AssignedShift, Notification } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { eachDayOfInterval, format, startOfMonth, endOfMonth, getMonth, getYear, isSameDay, addMonths } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { calculateTotalHours } from '@/lib/schedule-utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowRight, Loader2, Trash2, ChevronLeft, ChevronRight, User, Clock, Calendar as CalendarIcon } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, } from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/pro-toast';
import { useIsMobile } from '@/hooks/use-mobile';


function MonthlyUserReport({ userId, allUsers }: { userId: string, allUsers: ManagedUser[] }) {
    const [date, setDate] = useState<Date>(new Date());
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const isMobile = useIsMobile();

    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);

    useEffect(() => {
        setIsLoading(true);
        dataStore.getSchedulesForMonth(date).then(monthlySchedules => {
            setSchedules(monthlySchedules);
            setIsLoading(false);
        });
    }, [date]);

    const userShifts = useMemo(() => {
        const shiftsMap = new Map<string, string[]>(); // date -> shift labels
        schedules.forEach(schedule => {
            schedule.shifts.forEach(shift => {
                if (shift.assignedUsers.some(u => u.userId === userId)) {
                    if (!shiftsMap.has(shift.date)) {
                        shiftsMap.set(shift.date, []);
                    }
                    shiftsMap.get(shift.date)!.push(`${shift.label} (${shift.timeSlot.start}-${shift.timeSlot.end})`);
                }
            });
        });
        return shiftsMap;
    }, [schedules, userId]);

    const totalHours = useMemo(() => {
        const userShiftsForMonth = schedules.flatMap(s => s.shifts).filter(shift =>
            shift.assignedUsers.some(u => u.userId === userId)
        );
        return calculateTotalHours(userShiftsForMonth.map(s => s.timeSlot));
    }, [schedules, userId]);

    const daysWithShifts = useMemo(() => {
        const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
        return days.filter(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            return userShifts.has(dateKey) && userShifts.get(dateKey)!.length > 0;
        });
    }, [monthStart, monthEnd, userShifts]);

    const selectedUser = allUsers.find(u => u.uid === userId);

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 rounded-[2rem] border border-primary/10 shadow-sm relative overflow-hidden">
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h4 className="font-bold text-2xl text-foreground">{selectedUser?.displayName}</h4>
                        <p className="text-muted-foreground text-sm font-medium">Thống kê tháng {format(date, 'MM/yyyy')}</p>
                    </div>
                    <div className="bg-background/60 backdrop-blur-md px-5 py-3 rounded-2xl border border-primary/10 flex flex-col items-end">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Tổng giờ làm</span>
                        <span className="text-2xl font-black text-primary">{totalHours.toFixed(1)} <span className="text-sm font-bold">giờ</span></span>
                    </div>
                </div>
                <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between bg-muted/30 p-2 rounded-2xl border border-primary/5">
                    <Button variant="ghost" size="icon" className="rounded-xl hover:bg-background shadow-sm transition-all" onClick={() => setDate(prev => addMonths(prev, -1))}>
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div className="font-bold text-lg capitalize flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 text-primary" />
                        {format(date, 'MMMM yyyy', { locale: vi })}
                    </div>
                    <Button variant="ghost" size="icon" className="rounded-xl hover:bg-background shadow-sm transition-all" onClick={() => setDate(prev => addMonths(prev, 1))}>
                        <ChevronRight className="h-5 w-5" />
                    </Button>
                </div>

                {isLoading ? (
                    <div className="space-y-3">
                        <Skeleton className="h-20 w-full rounded-2xl" />
                        <Skeleton className="h-20 w-full rounded-2xl" />
                        <Skeleton className="h-20 w-full rounded-2xl" />
                    </div>
                ) : isMobile ? (
                    <div className="space-y-3">
                        {daysWithShifts.length === 0 ? (
                            <div className="text-center py-12 bg-muted/20 rounded-3xl border border-dashed border-muted-foreground/20">
                                <Clock className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                                <p className="text-muted-foreground font-medium">Không có ca làm việc nào</p>
                            </div>
                        ) : (
                            daysWithShifts.map(day => {
                                const dateKey = format(day, 'yyyy-MM-dd');
                                const shifts = userShifts.get(dateKey)!;
                                return (
                                    <div key={dateKey} className="bg-background border border-primary/10 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-4 mb-3 pb-3 border-b border-muted">
                                            <div className="bg-primary/10 text-primary w-10 h-10 rounded-xl flex flex-col items-center justify-center">
                                                <span className="text-xs font-bold leading-none">{format(day, 'EEE', { locale: vi }).toUpperCase()}</span>
                                                <span className="text-lg font-black leading-none">{format(day, 'd')}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-foreground">Ngày {format(day, 'dd/MM/yyyy')}</span>
                                                <span className="text-xs text-muted-foreground font-medium">{shifts.length} ca làm việc</span>
                                            </div>
                                        </div>
                                        <div className="grid gap-2">
                                            {shifts.map((shift, i) => (
                                                <div key={i} className="text-sm bg-muted/30 px-3 py-2.5 rounded-xl border border-muted flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                                    <span className="font-medium text-muted-foreground">{shift}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                ) : (
                    <div className="flex justify-center w-full">
                        <Calendar
                            mode="single"
                            month={date}
                            onMonthChange={setDate}
                            selected={new Date()}
                            className="p-0 border-none w-full"
                            classNames={{
                                months: "w-full",
                                month: "space-y-4 w-full",
                                table: "w-full border-collapse",
                                head_row: "flex mb-2",
                                head_cell: "text-muted-foreground/60 w-full font-bold text-[0.7rem] uppercase tracking-tighter text-center",
                                row: "flex w-full min-h-[100px] sm:min-h-[120px] border-t border-muted/30 first:border-t-0",
                                cell: "w-full p-0 relative border-l border-muted/30 first:border-l-0 focus-within:z-20",
                                day: "h-full w-full p-0 font-normal",
                                day_today: "bg-primary/[0.03]",
                                day_outside: "opacity-20 pointer-events-none",
                                day_disabled: "opacity-50",
                                day_hidden: "invisible",
                            }}
                            components={{
                                DayContent: ({ date: dayDate }) => {
                                    const dateKey = format(dayDate, 'yyyy-MM-dd');
                                    const shifts = userShifts.get(dateKey);
                                    const isToday = isSameDay(dayDate, new Date());
                                    const isCurrentMonth = dayDate.getMonth() === date.getMonth();
                                    
                                    if (!isCurrentMonth) return null;

                                    return (
                                        <div className={cn(
                                            "flex flex-col h-full w-full p-2 transition-colors hover:bg-muted/10",
                                            isToday && "bg-primary/[0.05]"
                                        )}>
                                            <div className={cn(
                                                "self-start text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-lg",
                                                isToday ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground/80"
                                            )}>
                                                {format(dayDate, 'd')}
                                            </div>
                                            {shifts && shifts.length > 0 && (
                                                <div className="flex flex-col gap-1 overflow-y-auto no-scrollbar">
                                                    {shifts.map((label, i) => (
                                                        <div
                                                            key={i}
                                                            className="bg-primary/10 text-primary text-[10px] sm:text-[11px] font-bold leading-tight rounded-lg px-2 py-1.5 border border-primary/20 shadow-sm"
                                                            title={label}
                                                        >
                                                            {label}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )
                                }
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}

export default function HistoryAndReportsDialog({
    isOpen,
    onClose,
    allUsers,
    parentDialogTag
}: {
    isOpen: boolean;
    onClose: () => void;
    allUsers: ManagedUser[];
    parentDialogTag: string;
}) {
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && allUsers.length > 0 && !selectedUserId) {
            setSelectedUserId(allUsers[0].uid);
        }
    }, [isOpen, allUsers, selectedUserId]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose} dialogTag="history-reports-dialog" parentDialogTag={parentDialogTag}>
            <DialogContent className="max-w-4xl w-full">
                <DialogHeader iconkey="history">
                    <DialogTitle>Lịch sử & Thống kê</DialogTitle>
                    <DialogDescription>
                        Xem lại các lịch đã công bố và thống kê giờ làm của nhân viên.
                    </DialogDescription>
                </DialogHeader>
                <DialogBody>
                    <div className="space-y-4">
                        <div className="bg-muted/30 p-4 rounded-3xl border border-primary/5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block px-1">
                                Chọn nhân viên
                            </label>
                            <Combobox
                                value={selectedUserId || ''}
                                onChange={(val) => setSelectedUserId(val as string)}
                                options={allUsers.map(user => ({ value: user.uid, label: user.displayName }))}
                                placeholder="Chọn một nhân viên..."
                                searchable={true}
                                className="w-full bg-background rounded-2xl"
                            />
                        </div>
                        
                        {selectedUserId ? (
                            <MonthlyUserReport userId={selectedUserId} allUsers={allUsers} />
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                <User className="h-12 w-12 mb-4 opacity-20" />
                                <p>Vui lòng chọn nhân viên để xem thống kê</p>
                            </div>
                        )}
                    </div>
                </DialogBody>
                <DialogFooter>
                    <DialogAction onClick={onClose} variant="secondary">
                        Đóng
                    </DialogAction>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
