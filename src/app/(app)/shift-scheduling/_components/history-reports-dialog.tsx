

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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import type { ManagedUser, Schedule, AssignedShift, Notification } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { eachDayOfInterval, format, startOfMonth, endOfMonth, getMonth, getYear, isSameDay } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { calculateTotalHours } from '@/lib/schedule-utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowRight, Loader2, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';


function MonthlyUserReport({ userId, allUsers }: { userId: string, allUsers: ManagedUser[]}) {
    const [date, setDate] = useState<Date>(new Date());
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [isLoading, setIsLoading] = useState(true);

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
    
    const selectedUser = allUsers.find(u => u.uid === userId);

    return (
        <div className="space-y-4">
             <div className="p-4 border rounded-md">
                <h4 className="font-semibold text-lg">{selectedUser?.displayName}</h4>
                <p className="text-muted-foreground">Tổng giờ làm tháng {format(date, 'MM/yyyy')}: <span className="font-bold text-primary">{totalHours.toFixed(1)} giờ</span></p>
            </div>
            <div className="flex justify-center">
                <Calendar
                    mode="single"
                    month={date}
                    onMonthChange={setDate}
                    selected={new Date()} // a dummy date to prevent selection highlight
                    className="rounded-md border p-0"
                    classNames={{
                        head_cell: "w-full",
                        day: "h-12 w-full",
                        day_selected: "",
                        day_today: "bg-accent text-accent-foreground",
                    }}
                    components={{
                        DayContent: ({ date: dayDate }) => {
                            const dateKey = format(dayDate, 'yyyy-MM-dd');
                            const shifts = userShifts.get(dateKey);
                            return (
                                <div className="flex flex-col h-full w-full p-1 text-xs">
                                    <div className={cn("self-start", isSameDay(dayDate, new Date()) && "font-bold")}>{format(dayDate, 'd')}</div>
                                    {shifts && (
                                        <div className="flex-grow mt-1 space-y-0.5 overflow-y-auto">
                                            {shifts.map((label, i) => <div key={i} className="bg-primary/20 text-primary-foreground rounded-sm px-1 truncate">{label}</div>)}
                                        </div>
                                    )}
                                </div>
                            )
                        }
                    }}
                />
            </div>
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
  
  // --- Back button handling ---
  useEffect(() => {
    const handler = (e: PopStateEvent) => {
      if (isOpen) {
        e.preventDefault();
        onClose();
      }
    };

    if (isOpen) {
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', handler);
    }

    return () => {
      window.removeEventListener('popstate', handler);
    };
  }, [isOpen, onClose]);


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Lịch sử & Thống kê</DialogTitle>
          <DialogDescription>
            Xem lại các lịch đã công bố và thống kê giờ làm của nhân viên.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <Select onValueChange={setSelectedUserId} value={selectedUserId || ''}>
            <SelectTrigger>
                <SelectValue placeholder="Chọn một nhân viên..."/>
            </SelectTrigger>
            <SelectContent>
                {allUsers.map(user => (
                    <SelectItem key={user.uid} value={user.uid}>{user.displayName}</SelectItem>
                ))}
            </SelectContent>
            </Select>
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
