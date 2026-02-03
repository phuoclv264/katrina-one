'use client';

import React, { useState, useMemo } from 'react';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogFooter, 
    DialogDescription,
    DialogBody,
    DialogAction,
    DialogCancel
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, parse, differenceInMinutes, isSameDay, set, isWithinInterval, areIntervalsOverlapping, addDays, startOfDay, endOfDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Loader2, AlertTriangle, CheckCircle, DollarSign, UserX, Calendar, Clock, ChevronRight, Coins, Info, ArrowLeft, Check } from 'lucide-react';
import { dataStore } from '@/lib/data-store';
import { toast } from '@/components/ui/pro-toast';
import { cn } from '@/lib/utils';
import type { Schedule, AttendanceRecord, ManagedUser, AssignedShift, AssignedUser } from '@/lib/types';

interface AbsencePenaltyDialogProps {
    isOpen: boolean;
    onClose: () => void;
    schedules: Record<string, Schedule>;
    attendanceRecords: AttendanceRecord[];
    users: ManagedUser[];
    currentUser: any; // Using any for simplicity as AuthUser type might be complex or imported
    parentDialogTag?: string;
}

type ShiftWithAbsence = {
    shift: AssignedShift & { originalShifts?: AssignedShift[] };
    weekId: string;
    absentUsers: (AssignedUser & { assignedDuration: number })[];
    presentUsers: (AssignedUser & { assignedDuration: number })[];
};

export default function AbsencePenaltyDialog({
    isOpen,
    onClose,
    schedules,
    attendanceRecords,
    users,
    currentUser,
    parentDialogTag
}: AbsencePenaltyDialogProps) {
    const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
    const [selectedAbsentUserId, setSelectedAbsentUserId] = useState<string | null>(null);
    const [selectedBonusUserIds, setSelectedBonusUserIds] = useState<string[]>([]);
    const [penaltyAmount, setPenaltyAmount] = useState<number | ''>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [configView, setConfigView] = useState(false);
    const [lastSelectedUserId, setLastSelectedUserId] = useState<string | null>(null);
    const [shouldMarkAsDone, setShouldMarkAsDone] = useState(true);

    const getShiftDurationHours = (start: string, end: string) => {
        const [startHour, startMinute] = start.split(':').map(Number);
        const [endHour, endMinute] = end.split(':').map(Number);
        
        const startTime = new Date(2000, 0, 1, startHour, startMinute);
        let endTime = new Date(2000, 0, 1, endHour, endMinute);
        
        if (endTime < startTime) {
            endTime.setDate(endTime.getDate() + 1);
        }
        
        return (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    };

    // 1. Identify all shifts with absences
    const shiftsWithAbsences = useMemo(() => {
        const results: ShiftWithAbsence[] = [];
        
        // Determine the date range of attendance records to ensure consistency
        let minDate: Date | null = null;
        let maxDate: Date | null = null;

        if (attendanceRecords.length > 0) {
            attendanceRecords.forEach(record => {
                const date = (record.checkInTime as any).toDate ? (record.checkInTime as any).toDate() : new Date(record.checkInTime as any);
                if (!minDate || date < minDate) minDate = startOfDay(date);
                if (!maxDate || date > maxDate) maxDate = endOfDay(date);
            });
        }

        const getShiftInterval = (shift: AssignedShift) => {
            const shiftDate = new Date(shift.date);
            const [startHour, startMinute] = shift.timeSlot.start.split(':').map(Number);
            const start = set(shiftDate, { hours: startHour, minutes: startMinute });

            const [endHour, endMinute] = shift.timeSlot.end.split(':').map(Number);
            let end = set(shiftDate, { hours: endHour, minutes: endMinute });
            
            if (end < start) end = addDays(end, 1);
            return { start, end };
        };

        // Group all raw shifts by date first
        const shiftsByDate: Record<string, { shift: AssignedShift; weekId: string }[]> = {};
        Object.values(schedules).forEach(schedule => {
            schedule.shifts.forEach(shift => {
                if (shift.isPenaltyProcessed) return; // Skip already done
                const dateStr = shift.date;
                if (!shiftsByDate[dateStr]) shiftsByDate[dateStr] = [];
                shiftsByDate[dateStr].push({ shift, weekId: schedule.weekId });
            });
        });

        // For each date, cluster overlapping shifts
        Object.keys(shiftsByDate).forEach(dateStr => {
            const rawShifts = shiftsByDate[dateStr];
            
            // Filter by min/max date if applicable
            const shiftDateObj = new Date(dateStr);
            if (minDate && maxDate) {
                if (shiftDateObj < minDate || shiftDateObj > maxDate) return;
            }

            const processedIndices = new Set<number>();
            const now = new Date();

            for (let i = 0; i < rawShifts.length; i++) {
                if (processedIndices.has(i)) continue;

                const group = [rawShifts[i]];
                processedIndices.add(i);

                // Cluster logic: find all shifts that overlap (transitively)
                let expanded = true;
                while (expanded) {
                    expanded = false;
                    const groupIntervals = group.map(item => getShiftInterval(item.shift));
                    
                    for (let j = 0; j < rawShifts.length; j++) {
                        if (processedIndices.has(j)) continue;
                        
                        const shiftJ = rawShifts[j];
                        const intervalJ = getShiftInterval(shiftJ.shift);
                        
                        const overlaps = groupIntervals.some(intervalI => 
                            areIntervalsOverlapping(intervalI, intervalJ)
                        );

                        if (overlaps) {
                            group.push(shiftJ);
                            processedIndices.add(j);
                            expanded = true;
                        }
                    }
                }

                // Now we have a group of overlapping shifts
                // Check absences for each shift in the group
                type EnhancedAssignedUser = AssignedUser & { assignedDuration: number };
                const collectiveAbsent = new Map<string, EnhancedAssignedUser>();
                const collectivePresent = new Map<string, EnhancedAssignedUser>();
                
                let minStart = group[0].shift.timeSlot.start;
                let maxEnd = group[0].shift.timeSlot.end;
                const labels = new Set<string>();

                group.forEach(({ shift }) => {
                    labels.add(shift.label);
                    const interval = getShiftInterval(shift);
                    const duration = getShiftDurationHours(shift.timeSlot.start, shift.timeSlot.end);
                    
                    // Update bounds for the "Mega Shift" display
                    if (interval.start < getShiftInterval({ ...shift, timeSlot: { ...shift.timeSlot, start: minStart } } as any).start) minStart = shift.timeSlot.start;
                    if (interval.end > getShiftInterval({ ...shift, timeSlot: { ...shift.timeSlot, end: maxEnd } } as any).end) maxEnd = shift.timeSlot.end;

                    // If shift hasn't ended yet, skip absence check for this specific shift part
                    if (interval.end > now) return;

                    shift.assignedUsers.forEach(assignedUser => {
                        const hasRecord = attendanceRecords.some(record => {
                            if (record.userId !== assignedUser.userId) return false;
                            if (!record.checkInTime) return false;
                            
                            const recordStart = (record.checkInTime as any).toDate ? (record.checkInTime as any).toDate() : new Date(record.checkInTime as any);
                            let recordEnd = record.checkOutTime 
                                ? ((record.checkOutTime as any).toDate ? (record.checkOutTime as any).toDate() : new Date(record.checkOutTime as any)) 
                                : new Date();
                            if (recordEnd < recordStart) recordEnd = recordStart;

                            return areIntervalsOverlapping(interval, { start: recordStart, end: recordEnd });
                        });

                        const enhancedUser: EnhancedAssignedUser = { ...assignedUser, assignedDuration: duration };

                        if (hasRecord) {
                            collectivePresent.set(assignedUser.userId, enhancedUser);
                            collectiveAbsent.delete(assignedUser.userId); // Present in one part = not absent for the group
                        } else {
                            if (!collectivePresent.has(assignedUser.userId)) {
                                collectiveAbsent.set(assignedUser.userId, enhancedUser);
                            }
                        }
                    });
                });

                if (collectiveAbsent.size > 0) {
                    // Create a synthetic "Mega Shift"
                    const megaShift: AssignedShift & { originalShifts?: AssignedShift[] } = {
                        ...group[0].shift,
                        label: Array.from(labels).join(' + '),
                        timeSlot: { start: minStart, end: maxEnd },
                        assignedUsers: [...Array.from(collectivePresent.values()), ...Array.from(collectiveAbsent.values())],
                        originalShifts: group.map(g => g.shift)
                    };

                    results.push({
                        shift: megaShift,
                        weekId: group[0].weekId,
                        absentUsers: Array.from(collectiveAbsent.values()),
                        presentUsers: Array.from(collectivePresent.values())
                    });
                }
            }
        });

        // Sort by date desc
        return results.sort((a, b) => new Date(b.shift.date).getTime() - new Date(a.shift.date).getTime());
    }, [schedules, attendanceRecords]);

    const selectedShiftData = useMemo(() => 
        shiftsWithAbsences.find(s => s.shift.id === selectedShiftId),
    [shiftsWithAbsences, selectedShiftId]);

    const selectedAbsentUser = useMemo(() => 
        selectedShiftData?.absentUsers.find(u => u.userId === selectedAbsentUserId),
    [selectedShiftData, selectedAbsentUserId]);

    const absentUserExpectedSalary = useMemo(() => {
        if (!selectedShiftData || !selectedAbsentUserId || !selectedAbsentUser) return 0;
        const durationHours = selectedAbsentUser.assignedDuration;
        const user = users.find(u => u.uid === selectedAbsentUserId);
        const hourlyRate = user?.hourlyRate || 0;
        return Math.floor(durationHours * hourlyRate);
    }, [selectedShiftData, selectedAbsentUserId, selectedAbsentUser, users]);

    // Update penalty and bonus recipients when a user is selected
    React.useEffect(() => {
        if (selectedAbsentUserId && selectedAbsentUserId !== lastSelectedUserId) {
            setPenaltyAmount(absentUserExpectedSalary || '');
            if (selectedShiftData) {
                setSelectedBonusUserIds(selectedShiftData.presentUsers.map(u => u.userId));
            }
            setConfigView(true);
            setLastSelectedUserId(selectedAbsentUserId);
        } else if (!selectedAbsentUserId) {
            setConfigView(false);
            setPenaltyAmount('');
            setLastSelectedUserId(null);
        }
    }, [selectedAbsentUserId, absentUserExpectedSalary, selectedShiftData, lastSelectedUserId]);

    const bonusCalculations = useMemo(() => {
        if (!selectedShiftData || !penaltyAmount || typeof penaltyAmount !== 'number' || penaltyAmount <= 0) return [];

        const activeBonusUsers = selectedShiftData.presentUsers.filter(u => selectedBonusUserIds.includes(u.userId));
        if (activeBonusUsers.length === 0) return [];

        // Logic: Bonus is proportional to assigned working hours
        const totalSelectedHours = activeBonusUsers.reduce((sum, u) => sum + u.assignedDuration, 0);
        
        return activeBonusUsers.map(u => ({
            user: u,
            amount: Math.floor((u.assignedDuration / totalSelectedHours) * penaltyAmount),
            hours: u.assignedDuration
        }));

    }, [selectedShiftData, penaltyAmount, selectedBonusUserIds]);

    const markShiftAsDone = async (shiftData: typeof selectedShiftData) => {
        if (!shiftData) return;
        
        setIsProcessing(true);
        const toastId = toast.loading("Đang đánh dấu hoàn tất...");
        try {
            const weekId = shiftData.weekId;
            const schedule = schedules[weekId];
            if (schedule) {
                const shiftIdsToMark = shiftData.shift.originalShifts 
                    ? shiftData.shift.originalShifts.map((s: any) => s.id)
                    : [shiftData.shift.id];
                
                const updatedShifts = schedule.shifts.map(s => 
                    shiftIdsToMark.includes(s.id) ? { ...s, isPenaltyProcessed: true } : s
                );
                
                await dataStore.updateSchedule(weekId, { shifts: updatedShifts });
                toast.success("Đã hoàn tất xử lý ca này!", { id: toastId });
                
                // Reset state
                setSelectedShiftId(null);
                setSelectedAbsentUserId(null);
                setConfigView(false);
                setLastSelectedUserId(null);
            }
        } catch (error) {
            console.error("Error marking shift as done:", error);
            toast.error("Không thể đánh dấu hoàn tất.", { id: toastId });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleConfirm = async () => {
        if (!selectedShiftData || !selectedAbsentUser || !penaltyAmount || typeof penaltyAmount !== 'number') return;
        
        const effectiveUser = users.find(u => u.uid === currentUser?.uid) || { uid: 'admin', displayName: 'Admin' } as any; 
        
        setIsProcessing(true);
        const toastId = toast.loading("Đang xử lý...");

        try {
            const monthId = format(new Date(selectedShiftData.shift.date), 'yyyy-MM');
            
            // 1. Add Advance Payment (Penalty) for Absent User
            const penaltyNote = `Phạt vắng mặt ca ${selectedShiftData.shift.label} (${selectedShiftData.shift.date})`;
            await dataStore.addSalaryAdvance(
                monthId, 
                selectedAbsentUser.userId, 
                penaltyAmount, 
                penaltyNote, 
                { userId: effectiveUser.uid || 'admin', userName: effectiveUser.displayName || 'Admin' }
            );

            // 2. Add Bonuses for Present Users
            const bonusNote = `Thưởng đi làm ca ${selectedShiftData.shift.label} (${selectedShiftData.shift.date}) - từ phạt nhân viên ${selectedAbsentUser.userName}`;
            
            await Promise.all(bonusCalculations.map(item => 
                dataStore.addSalaryBonus(
                    monthId,
                    item.user.userId,
                    item.amount,
                    bonusNote,
                    { userId: effectiveUser.uid || 'admin', userName: effectiveUser.displayName || 'Admin' }
                )
            ));

            // 3. Mark shift(s) as processed if needed
            if (shouldMarkAsDone) {
                const weekId = selectedShiftData.weekId;
                const schedule = schedules[weekId];
                if (schedule) {
                    const shiftIdsToMark = selectedShiftData.shift.originalShifts 
                        ? selectedShiftData.shift.originalShifts.map((s: any) => s.id)
                        : [selectedShiftData.shift.id];
                    
                    const updatedShifts = schedule.shifts.map(s => 
                        shiftIdsToMark.includes(s.id) ? { ...s, isPenaltyProcessed: true } : s
                    );
                    
                    await dataStore.updateSchedule(weekId, { shifts: updatedShifts });
                }
            }

            toast.success("Đã xử lý phạt và thưởng thành công!", { id: toastId });
            
            // If we marked as done, the shift disappears, so we should deselect it
            if (shouldMarkAsDone) {
                onClose();
                setSelectedAbsentUserId(null);
                setSelectedShiftId(null);
                setConfigView(false);
                setLastSelectedUserId(null);
            } else {
                // Stay in the dialog but go back to the list of absent users
                setSelectedAbsentUserId(null);
                setConfigView(false);
                setLastSelectedUserId(null);
            }

        } catch (error) {
            console.error("Error processing penalty:", error);
            toast.error("Có lỗi xảy ra khi xử lý.", { id: toastId });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose} dialogTag="absence-penalty-dialog" parentDialogTag='root'>
            <DialogContent className="max-w-4xl p-0 overflow-hidden" data-dialog-tag={parentDialogTag}>
                <DialogHeader variant="warning" iconkey="alert">
                    <div>
                        <DialogTitle className="mb-1 text-amber-950">Xử lý Phạt Vắng Mặt</DialogTitle>
                        <DialogDescription className="text-amber-800/60 text-[10px] font-black uppercase tracking-[0.2em]">
                            Phạt nhân viên vắng mặt và chia thưởng cho nhân viên đi làm
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <DialogBody className="p-0 flex flex-col md:flex-row h-[80vh] md:h-[70vh] max-h-[800px] min-h-[500px]">
                    {/* Left: Shifts List */}
                    <div className={cn(
                        "w-full md:w-[320px] lg:w-[380px] border-b md:border-b-0 md:border-r border-zinc-100 flex flex-col bg-zinc-50/30 shrink-0 transition-all duration-300",
                        selectedShiftId && "hidden md:flex" // Hide list on mobile when a shift is selected to focus on action
                    )}>
                        <div className="p-4 border-b border-zinc-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10 shrink-0">
                            <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Ca làm việc có vắng mặt</h4>
                        </div>
                        <ScrollArea className="flex-1">
                            {shiftsWithAbsences.length === 0 ? (
                                <div className="p-12 text-center">
                                    <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <Info className="w-6 h-6 text-zinc-400" />
                                    </div>
                                    <p className="text-sm font-medium text-zinc-500 px-4">Không tìm thấy ca nào vắng mặt trong giai đoạn này.</p>
                                </div>
                            ) : (
                                <div className="p-2 space-y-1">
                                    {shiftsWithAbsences.map(({ shift, absentUsers }) => (
                                        <button
                                            key={shift.id}
                                            onClick={() => {
                                                setSelectedShiftId(shift.id);
                                                setSelectedAbsentUserId(null);
                                            }}
                                            className={cn(
                                                "w-full text-left p-4 rounded-[1.5rem] transition-all duration-200 group relative overflow-hidden",
                                                selectedShiftId === shift.id 
                                                    ? "bg-white shadow-md ring-1 ring-zinc-200/50" 
                                                    : "hover:bg-white/60"
                                            )}
                                        >
                                            <div className="flex justify-between items-start relative z-10">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-bold text-zinc-900 line-clamp-1">{shift.label}</span>
                                                        <span className="text-[10px] whitespace-nowrap font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">
                                                            {absentUsers.length} vắng
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-zinc-400">
                                                        <div className="flex items-center gap-1.5 grayscale opacity-70">
                                                            <Calendar className="w-3 h-3" />
                                                            <span className="text-[10px] font-medium whitespace-nowrap">{format(new Date(shift.date), 'dd/MM/yyyy')}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 grayscale opacity-70">
                                                            <Clock className="w-3 h-3" />
                                                            <span className="text-[10px] font-medium whitespace-nowrap">{shift.timeSlot.start}-{shift.timeSlot.end}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <ChevronRight className={cn(
                                                    "w-4 h-4 transition-transform duration-200 shrink-0",
                                                    selectedShiftId === shift.id ? "text-primary translate-x-1" : "text-zinc-300"
                                                )} />
                                            </div>
                                            
                                            <div className="mt-3 flex flex-wrap gap-1 relative z-10">
                                                {absentUsers.map(u => (
                                                    <span key={u.userId} className="inline-flex items-center text-[10px] font-bold bg-red-50/50 text-red-700/70 px-2 py-0.5 rounded-lg border border-red-100/50">
                                                        {u.userName}
                                                    </span>
                                                ))}
                                            </div>

                                            {selectedShiftId === shift.id && (
                                                <div className="absolute left-0 top-3 bottom-3 w-1 bg-amber-500 rounded-full" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </div>

                    {/* Right: Details & Action */}
                    <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
                        {!selectedShiftData ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 text-center animate-in fade-in zoom-in-95 duration-300">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-amber-50 rounded-[2rem] sm:rounded-[2.5rem] flex items-center justify-center mb-6">
                                    <AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10 text-amber-500" />
                                </div>
                                <h3 className="text-base sm:text-lg font-bold text-zinc-900 mb-2 font-headline">Chưa chọn ca làm việc</h3>
                                <p className="text-xs sm:text-sm text-zinc-500 max-w-xs mx-auto leading-relaxed px-4">Vui lòng chọn một ca làm việc từ danh sách để bắt đầu xử lý kỷ luật.</p>
                            </div>
                        ) : !configView ? (
                            <div className="flex-1 flex flex-col p-5 sm:p-8 overflow-y-auto space-y-6 sm:space-y-8 animate-in slide-in-from-right-4 duration-300">
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex items-center justify-between mb-4 md:hidden">
                                            <button 
                                                onClick={() => setSelectedShiftId(null)}
                                                className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-zinc-600 transition-colors"
                                            >
                                                <ArrowLeft className="w-3.5 h-3.5" />
                                                Quay lại danh sách
                                            </button>
                                        </div>
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-4 ml-1">Chọn nhân viên vi phạm (Vắng mặt)</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-8">
                                            {selectedShiftData.absentUsers.map(u => (
                                                <button
                                                    key={u.userId}
                                                    onClick={() => {
                                                        setSelectedAbsentUserId(u.userId);
                                                        // Note: useEffect will trigger setConfigView(true)
                                                    }}
                                                    className="flex items-center justify-between p-4 rounded-2xl transition-all border-2 border-zinc-100 hover:border-amber-500 hover:bg-amber-50/20 text-left group"
                                                >
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div className="w-10 h-10 shrink-0 rounded-xl bg-red-100 flex items-center justify-center group-hover:bg-red-200 transition-colors">
                                                            <UserX className="w-5 h-5 text-red-600" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-sm sm:text-base text-zinc-900 truncate">{u.userName}</div>
                                                            <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-zinc-400 truncate">{u.assignedRole}</div>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-amber-500 group-hover:translate-x-1 transition-all shrink-0" />
                                                </button>
                                            ))}
                                        </div>

                                        {/* Skip/Mark as Done button */}
                                        <div className="pt-4 border-t border-zinc-100 flex flex-col items-center gap-3">
                                            <p className="text-[10px] text-zinc-400 font-medium text-center">Nếu không có ai cần phạt hoặc đã xử lý xong bên ngoài:</p>
                                            <Button 
                                                variant="outline" 
                                                className="rounded-xl h-10 px-6 border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 gap-2 text-xs font-bold"
                                                onClick={() => markShiftAsDone(selectedShiftData)}
                                                disabled={isProcessing}
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                                Đánh dấu ca này đã xử lý xong
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col p-5 sm:p-8 overflow-y-auto space-y-6 sm:space-y-8 animate-in slide-in-from-right-4 duration-300">
                                {/* Back button & title */}
                                <div className="flex items-center gap-4">
                                    <button 
                                        onClick={() => {
                                            setSelectedAbsentUserId(null);
                                            setConfigView(false);
                                        }}
                                        className="p-2 hover:bg-zinc-100 rounded-full transition-colors shrink-0"
                                    >
                                        <ArrowLeft className="w-5 h-5 text-zinc-500" />
                                    </button>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-base sm:text-lg text-zinc-900 truncate">{selectedAbsentUser?.userName}</h3>
                                        <p className="text-[10px] sm:text-xs text-zinc-500 font-medium uppercase tracking-tight truncate">{selectedAbsentUser?.assignedRole} • Vắng mặt</p>
                                    </div>
                                </div>

                                {/* Step 1: Penalty amount */}
                                <div className="space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Thiết lập mức phạt</h4>
                                        {absentUserExpectedSalary > 0 && (
                                            <span className="inline-flex w-fit text-[10px] font-bold px-2 py-0.5 rounded-lg bg-zinc-100 text-zinc-600 border border-zinc-200">
                                                Lương dự kiến: {absentUserExpectedSalary.toLocaleString('vi-VN')}đ
                                            </span>
                                        )}
                                    </div>
                                    <div className="relative group">
                                        <div className="absolute left-5 top-1/2 -translate-y-1/2 w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center transition-colors group-focus-within:bg-amber-100">
                                            <Coins className="w-5 h-5 text-zinc-400 group-focus-within:text-amber-600" />
                                        </div>
                                        <Input
                                            type="number"
                                            inputMode="numeric"
                                            placeholder="Nhập số tiền..."
                                            className="h-14 sm:h-16 pl-16 sm:pl-20 pr-10 sm:pr-12 rounded-[1.25rem] sm:rounded-[1.5rem] border-zinc-100 bg-zinc-50 focus:bg-white text-lg sm:text-xl font-bold transition-all shadow-inner focus:ring-0"
                                            value={penaltyAmount}
                                            onChange={(e) => setPenaltyAmount(e.target.value ? Number(e.target.value) : '')}
                                        />
                                        <div className="absolute right-5 sm:right-6 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-sm sm:text-base">đ</div>
                                    </div>
                                    <p className="text-[10px] text-zinc-400 italic ml-4 leading-relaxed">* Mặc định là lương dự kiến của nhân viên cho ca làm việc này.</p>
                                </div>

                                {/* Step 2: Bonus Recipients Selection & Preview */}
                                {penaltyAmount && Number(penaltyAmount) > 0 && (
                                    <div className="space-y-4 pb-12">
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Phân chia thưởng cho nhân viên đi làm</h4>
                                        
                                        {selectedShiftData.presentUsers.length === 0 ? (
                                            <div className="p-5 rounded-[1.25rem] sm:rounded-[1.5rem] bg-amber-50/50 border border-amber-100 flex items-start gap-4">
                                                <div className="shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center mt-1">
                                                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                                                </div>
                                                <div className="space-y-1 min-w-0">
                                                    <p className="text-sm font-bold text-amber-900">Không có nhân viên nhận thưởng</p>
                                                    <p className="text-[11px] text-amber-700 leading-relaxed font-medium">Trong ca này không có nhân viên nào khác đi làm để nhận thưởng.</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="rounded-[1.25rem] sm:rounded-[1.5rem] border border-zinc-100 overflow-hidden shadow-sm">
                                                <div className="bg-emerald-50 px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                                                        <span className="text-[10px] sm:text-xs font-bold text-emerald-700 uppercase tracking-tight">Chọn người nhận thưởng</span>
                                                    </div>
                                                    <span className="text-[10px] font-black tracking-wider text-emerald-600 uppercase">
                                                        {selectedBonusUserIds.length} người được chọn
                                                    </span>
                                                </div>
                                                <div className="divide-y divide-zinc-50 max-h-[250px] sm:max-h-[300px] overflow-y-auto bg-white">
                                                    {selectedShiftData.presentUsers.map((pUser) => {
                                                        const bonusItem = bonusCalculations.find(b => b.user.userId === pUser.userId);
                                                        const isSelected = selectedBonusUserIds.includes(pUser.userId);
                                                        
                                                        return (
                                                            <div 
                                                                key={pUser.userId} 
                                                                className={cn(
                                                                    "px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between transition-colors cursor-pointer",
                                                                    isSelected ? "bg-white hover:bg-zinc-50/30" : "bg-zinc-50/30 hover:bg-zinc-50/50 opacity-60"
                                                                )}
                                                                onClick={() => {
                                                                    if (isSelected) {
                                                                        setSelectedBonusUserIds(prev => prev.filter(id => id !== pUser.userId));
                                                                    } else {
                                                                        setSelectedBonusUserIds(prev => [...prev, pUser.userId]);
                                                                    }
                                                                }}
                                                            >
                                                                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                                                    <div className={cn(
                                                                        "w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all shrink-0",
                                                                        isSelected ? "bg-emerald-500 border-emerald-500 shadow-sm" : "border-zinc-200"
                                                                    )}>
                                                                        {isSelected && <Check className="w-3 h-3 text-white" />}
                                                                    </div>
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className={cn(
                                                                            "text-xs sm:text-sm font-bold truncate transition-colors",
                                                                            isSelected ? "text-zinc-900" : "text-zinc-400"
                                                                        )}>
                                                                            {pUser.userName}
                                                                        </span>
                                                                        <span className="text-[9px] sm:text-[10px] font-bold text-zinc-400 uppercase tracking-tight truncate">
                                                                            {pUser.assignedRole} • {bonusItem?.hours.toFixed(1) || '0'} giờ
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                {isSelected && bonusItem && (
                                                                    <div className="shrink-0 text-emerald-600 text-sm sm:text-base font-bold tabular-nums animate-in fade-in slide-in-from-right-2">
                                                                        +{bonusItem.amount.toLocaleString('vi-VN')}đ
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </DialogBody>

                <DialogFooter variant="muted" className="border-t border-zinc-100 flex-col sm:flex-row items-center justify-between gap-4 px-6 sm:px-8 py-4 sm:py-6 rounded-b-[2.5rem] bg-zinc-50/50">
                    <div className="flex items-center gap-3">
                        <DialogCancel className="w-full sm:w-auto px-8 border-none hover:bg-zinc-100 text-xs sm:text-sm">
                            Đóng lại
                        </DialogCancel>
                        
                        {configView && (
                            <button 
                                onClick={() => setShouldMarkAsDone(!shouldMarkAsDone)}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-zinc-200/50 transition-colors group"
                            >
                                <div className={cn(
                                    "w-4 h-4 rounded border flex items-center justify-center transition-all",
                                    shouldMarkAsDone ? "bg-amber-500 border-amber-500 shadow-sm" : "border-zinc-300 bg-white"
                                )}>
                                    {shouldMarkAsDone && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <span className="text-[10px] font-bold text-zinc-500 group-hover:text-zinc-700 whitespace-nowrap">Xong ca này sau khi xác nhận</span>
                            </button>
                        )}
                    </div>

                    <DialogAction 
                        variant="pastel-purple" 
                        className="w-full sm:w-auto px-8 sm:min-w-[200px] text-xs sm:text-sm"
                        onClick={handleConfirm}
                        isLoading={isProcessing}
                        disabled={!selectedShiftData || !selectedAbsentUser || !penaltyAmount || isProcessing}
                    >
                        Xác nhận & Thực hiện
                    </DialogAction>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
