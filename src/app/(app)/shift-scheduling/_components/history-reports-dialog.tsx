

'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
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
import { ArrowRight, Loader2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
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
        if (!isMobile) return [];
        const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
        return days.filter(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            return userShifts.has(dateKey) && userShifts.get(dateKey)!.length > 0;
        });
    }, [isMobile, monthStart, monthEnd, userShifts]);

    const selectedUser = allUsers.find(u => u.uid === userId);

    return (
        <div className="space-y-4">
            <div className="p-4 border rounded-md">
                <h4 className="font-semibold text-lg">{selectedUser?.displayName}</h4>
                <p className="text-muted-foreground">Tổng giờ làm tháng {format(date, 'MM/yyyy')}: <span className="font-bold text-primary">{totalHours.toFixed(1)} giờ</span></p>
            </div>

            {isMobile ? (
                <div className="space-y-4">
                    <div className="flex items-center justify-between bg-muted/30 p-2 rounded-md">
                        <Button variant="ghost" size="icon" onClick={() => setDate(prev => addMonths(prev, -1))}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="font-medium capitalize">{format(date, 'MMMM yyyy', { locale: vi })}</div>
                        <Button variant="ghost" size="icon" onClick={() => setDate(prev => addMonths(prev, 1))}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                        {daysWithShifts.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Không có ca làm việc nào trong tháng này
                            </div>
                        ) : (
                            daysWithShifts.map(day => {
                                const dateKey = format(day, 'yyyy-MM-dd');
                                const shifts = userShifts.get(dateKey)!;
                                return (
                                    <div key={dateKey} className="border rounded-lg p-3 shadow-sm">
                                        <div className="flex items-center gap-3 mb-2 border-b pb-2">
                                            <div className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                                                {format(day, 'd')}
                                            </div>
                                            <div className="font-medium capitalize text-sm">
                                                {format(day, 'EEEE', { locale: vi })}
                                            </div>
                                        </div>
                                        <div className="space-y-2 pl-11">
                                            {shifts.map((shift, i) => (
                                                <div key={i} className="text-sm bg-accent/50 p-2 rounded border border-accent">
                                                    {shift}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex justify-center w-full overflow-x-auto">
                    <Calendar
                        mode="single"
                        month={date}
                        onMonthChange={setDate}
                        selected={new Date()} // a dummy date to prevent selection highlight
                        className="rounded-md border w-full p-3 min-w-[600px]"
                        classNames={{
                            months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 w-full",
                            month: "space-y-4 w-full",
                            table: "w-full border-collapse space-y-1",
                            head_row: "flex",
                            head_cell: "text-muted-foreground rounded-md w-full font-normal text-[0.8rem]",
                            row: "flex w-full mt-2",
                            cell: "h-20 sm:h-24 w-full text-center text-sm p-0 relative [&:has([aria-selected])]:bg-primary/10 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                            day: "h-20 sm:h-24 w-full p-0 font-normal aria-selected:opacity-100",
                            day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                            day_today: "bg-primary/10",
                            day_outside: "text-muted-foreground opacity-50",
                            day_disabled: "text-muted-foreground opacity-50",
                            day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                            day_hidden: "invisible",
                        }}
                        components={{
                            DayContent: ({ date: dayDate }) => {
                                const dateKey = format(dayDate, 'yyyy-MM-dd');
                                const shifts = userShifts.get(dateKey);
                                const isToday = isSameDay(dayDate, new Date());
                                return (
                                    <div className="flex flex-col h-full w-full p-1 text-xs border-t border-l border-transparent hover:bg-muted/50 transition-colors">
                                        <div className={cn(
                                            "self-end mr-1 mt-1 font-medium w-6 h-6 flex items-center justify-center rounded-full",
                                            isToday && "bg-primary text-primary-foreground font-bold"
                                        )}>
                                            {format(dayDate, 'd')}
                                        </div>
                                        {shifts && shifts.length > 0 && (
                                            <div className="flex flex-col gap-1 mt-1 overflow-y-auto max-h-[calc(100%-28px)] no-scrollbar">
                                                {shifts.map((label, i) => (
                                                    <div
                                                        key={i}
                                                        className="bg-primary/10 text-primary text-[10px] leading-tight rounded px-1.5 py-1 text-left border border-primary/20 shadow-sm truncate"
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
    )
}

export default function HistoryAndReportsDialog({
    isOpen,
    onClose,
    allUsers,
}: {
    isOpen: boolean;
    onClose: () => void;
    allUsers: ManagedUser[];
}) {
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && allUsers.length > 0 && !selectedUserId) {
            setSelectedUserId(allUsers[0].uid);
        }
    }, [isOpen, allUsers, selectedUserId]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose} dialogTag="history-reports-dialog" parentDialogTag="root">
            <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Lịch sử & Thống kê</DialogTitle>
                    <DialogDescription>
                        Xem lại các lịch đã công bố và thống kê giờ làm của nhân viên.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <Combobox
                        value={selectedUserId || ''}
                        onChange={(val) => setSelectedUserId(val as string)}
                        options={allUsers.map(user => ({ value: user.uid, label: user.displayName }))}
                        placeholder="Chọn một nhân viên..."
                        searchable={true}
                        className="w-full"
                    />
                    {selectedUserId ? (
                        <MonthlyUserReport userId={selectedUserId} allUsers={allUsers} />
                    ) : (
                        <Skeleton className="h-96 w-full" />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
