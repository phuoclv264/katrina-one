
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
import type { ManagedUser, Schedule, AssignedShift, PassRequest } from '@/lib/types';
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

function PassHistoryReport() {
    const [allSchedules, setAllSchedules] = useState<Schedule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        setIsLoading(true);
        const unsub = dataStore.subscribeToAllSchedules((schedules) => {
            setAllSchedules(schedules);
            setIsLoading(false);
        });
        return () => unsub();
    }, []);
    
    const handleRevertPass = async (weekId: string, shiftId: string, passRequest: PassRequest) => {
        setIsProcessing(`${weekId}-${shiftId}-${passRequest.requestingUser.userId}`);
        try {
            await dataStore.revertPassRequest(weekId, shiftId, passRequest);
            toast({ title: 'Thành công', description: 'Đã hoàn tác yêu cầu pass ca.'});
        } catch (error) {
            console.error("Failed to revert pass request:", error);
            toast({ title: 'Lỗi', description: 'Không thể hoàn tác yêu cầu.', variant: 'destructive'});
        } finally {
            setIsProcessing(null);
        }
    }

    const completedPasses = useMemo(() => {
        return allSchedules
            .flatMap(schedule => 
                schedule.shifts.map(shift => ({
                    ...shift,
                    weekId: schedule.weekId,
                }))
            )
            .flatMap(shift => 
                (shift.passRequests || [])
                    .filter(pr => pr.status === 'taken' && pr.takenBy)
                    .map(pr => ({
                        shift,
                        passRequest: pr,
                    }))
            )
            .sort((a, b) => {
                 const timeA = (a.passRequest.timestamp as any)?.toDate?.() || new Date(a.passRequest.timestamp as string);
                 const timeB = (b.passRequest.timestamp as any)?.toDate?.() || new Date(b.passRequest.timestamp as string);
                 return timeB.getTime() - timeA.getTime();
            });
    }, [allSchedules]);

    if (isLoading) {
        return <Skeleton className="h-64 w-full" />;
    }
    
    if (completedPasses.length === 0) {
        return <p className="text-muted-foreground text-center py-8">Chưa có lịch sử pass ca nào.</p>
    }

    return (
        <div className="max-h-[60vh] overflow-y-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Ca làm việc</TableHead>
                        <TableHead>Người pass</TableHead>
                        <TableHead>Người nhận</TableHead>
                        <TableHead className="text-right">Hành động</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {completedPasses.map(({ shift, passRequest }) => (
                        <TableRow key={`${shift.id}-${passRequest.requestingUser.userId}`} className={isProcessing === `${shift.weekId}-${shift.id}-${passRequest.requestingUser.userId}` ? 'opacity-50' : ''}>
                            <TableCell>
                                <p className="font-semibold">{shift.label}</p>
                                <p className="text-xs text-muted-foreground">{format(new Date(shift.date), 'dd/MM/yyyy')} | {shift.timeSlot.start} - {shift.timeSlot.end}</p>
                            </TableCell>
                            <TableCell>{passRequest.requestingUser.userName}</TableCell>
                            <TableCell>{passRequest.takenBy?.userName}</TableCell>
                            <TableCell className="text-right">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" disabled={!!isProcessing}>
                                            <Trash2 className="h-4 w-4 text-destructive"/>
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Hoàn tác yêu cầu Pass ca?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Hành động này sẽ xóa yêu cầu và gán ca làm việc trở lại cho nhân viên ban đầu ({passRequest.requestingUser.userName}).
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Hủy</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleRevertPass(shift.weekId, shift.id, passRequest)}>
                                                Xác nhận hoàn tác
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Lịch sử & Thống kê</DialogTitle>
          <DialogDescription>
            Xem lại các lịch đã công bố và thống kê giờ làm của nhân viên.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="monthly">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="monthly">Thống kê tháng</TabsTrigger>
                <TabsTrigger value="pass-history">Lịch sử Pass ca</TabsTrigger>
            </TabsList>
            <TabsContent value="monthly" className="py-4 space-y-4">
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
            </TabsContent>
            <TabsContent value="pass-history" className="py-4">
                 <PassHistoryReport />
            </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

    