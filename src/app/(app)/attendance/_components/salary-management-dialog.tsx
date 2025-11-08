'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { dataStore } from '@/lib/data-store';
import type { MonthlySalarySheet, SalaryRecord, ManagedUser, Schedule, AttendanceRecord, Violation, AssignedUser, UserRole } from '@/lib/types';
import { format, startOfMonth, endOfMonth, getISOWeek, getYear, parseISO, differenceInMinutes } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from 'react-hot-toast';
import { Loader2, Download, Calculator, AlertTriangle, CheckCircle, User, Clock, FileX, ChevronsDownUp } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { findShiftForRecord, getStatusInfo } from '@/lib/attendance-utils';
import { cn } from '@/lib/utils'; 
import SalaryRecordAccordionItem from './salary-record-accordion-item';
import { Label } from '@/components/ui/label';

type SalaryManagementDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    allUsers: ManagedUser[];
};

const calculateSalarySheet = async (
    month: Date,
    allUsers: ManagedUser[],
    currentUser: AssignedUser,
    existingSalaryRecords?: Record<string, SalaryRecord>
    ): Promise<MonthlySalarySheet> => {
    const monthId = format(month, 'yyyy-MM');
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);

    // Fetch all necessary data for the month
    const attendanceRecords = await dataStore.getAttendanceRecordsForDateRange({ from: monthStart, to: monthEnd });
    const violations = await dataStore.getAllViolationRecords(); // Fetch all and filter client-side
    const schedules = await dataStore.getSchedulesForDateRange({ from: monthStart, to: monthEnd });

    const scheduleMap = schedules.reduce((acc, s) => {
        acc[s.weekId] = s;
        return acc;
    }, {} as Record<string, Schedule>);

    const monthlyViolations = violations.filter(v => {
        const vDate = (v.createdAt as Timestamp).toDate();
        return vDate >= monthStart && vDate <= monthEnd;
    });

    const salaryRecords: Record<string, SalaryRecord> = {};

    for (const user of allUsers) {
        if (user.role === 'Chủ nhà hàng') continue;

        const userAttendances = attendanceRecords.filter(r => r.userId === user.uid && r.checkInTime && r.checkOutTime);
        const userViolations = monthlyViolations.filter(v => v.users.some(u => u.id === user.uid));

        const totalWorkingHours = userAttendances.reduce((sum, r) => sum + (r.totalHours || 0), 0);
        const totalSalaryFromAttendance = userAttendances.reduce((sum, r) => sum + (r.salary || 0), 0);
        const averageHourlyRate = totalWorkingHours > 0 ? totalSalaryFromAttendance / totalWorkingHours : user.hourlyRate || 0;

        const totalUnpaidPenalties = userViolations.reduce((sum, v) => {
            if (v.isPenaltyWaived) return sum;
            const userCost = v.userCosts?.find(uc => uc.userId === user.uid)?.cost || 0;
            const isPaid = (v.penaltySubmissions?.some(ps => ps.userId === user.uid) || v.penaltyPhotos);
            return sum + (isPaid ? 0 : userCost);
        }, 0);

        let totalExpectedHours = 0;
        const absentShifts: any[] = [];

        const userShifts = schedules.filter(s => s.status === 'published')
            .flatMap(s => s.shifts)
            .filter(shift => shift.assignedUsers.some(au => au.userId === user.uid));

        userShifts.filter(shift => (new Date(shift.date) >= monthStart) && (new Date(shift.date) <= monthEnd)).forEach(shift => {
            const shiftStart = parseISO(`${shift.date}T${shift.timeSlot.start}`);
            const shiftEnd = parseISO(`${shift.date}T${shift.timeSlot.end}`);
            totalExpectedHours += differenceInMinutes(shiftEnd, shiftStart) / 60;

            // Check if there's any attendance record that significantly overlaps with this shift
            const hasAttendance = userAttendances.some(r => {
                if (!r.checkInTime || !r.checkOutTime) return false;
                const recordStart = (r.checkInTime as Timestamp).toDate();
                const recordEnd = (r.checkOutTime as Timestamp).toDate();

                // Check for overlap: (Record starts before shift ends) AND (Record ends after shift starts)
                return recordStart < shiftEnd && recordEnd > shiftStart;
            });

            if (!hasAttendance) {
                absentShifts.push(shift);
            }
        });

        const totalLateMinutes = userAttendances.reduce((sum, r) => {
            const shift = userShifts.find(s => {
                const shiftStart = parseISO(`${s.date}T${s.timeSlot.start}`);
                const checkIn = (r.checkInTime as Timestamp).toDate();
                return checkIn >= shiftStart && checkIn <= parseISO(`${s.date}T${s.timeSlot.end}`);
            });
            if (shift) {
                const shiftStart = parseISO(`${shift.date}T${shift.timeSlot.start}`);
                const checkIn = (r.checkInTime as Timestamp).toDate();
                const lateMinutes = differenceInMinutes(checkIn, shiftStart);
                return sum + (lateMinutes > 5 ? lateMinutes : 0);
            }
            return sum;
        }, 0);

        salaryRecords[user.uid] = {
            userId: user.uid,
            userName: user.displayName,
            userRole: user.role,
            totalWorkingHours,
            totalExpectedHours,
            totalSalary: totalSalaryFromAttendance,
            averageHourlyRate,
            totalUnpaidPenalties,
            totalLateMinutes,
            attendanceRecords: userAttendances,
            violationRecords: userViolations,
            absentShifts,
            paymentStatus: existingSalaryRecords?.[user.uid]?.paymentStatus || 'unpaid',
            paidAt: existingSalaryRecords?.[user.uid]?.paidAt,
            salaryAdvance: existingSalaryRecords?.[user.uid]?.salaryAdvance || 0,
        };
    }

    return {
        id: monthId,
        calculatedAt: Timestamp.now(),
        calculatedBy: currentUser,
        scheduleMap, // Include scheduleMap in the sheet
        salaryRecords,
    };
};

export default function SalaryManagementDialog({ isOpen, onClose, allUsers }: SalaryManagementDialogProps) {
    const { user: currentUser } = useAuth();
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [salarySheet, setSalarySheet] = useState<MonthlySalarySheet | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [advanceAmounts, setAdvanceAmounts] = useState<Record<string, string>>({});
    const [openAccordionItems, setOpenAccordionItems] = useState<string[]>([]);

    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        let date = new Date();
        for (let i = 0; i < 12; i++) {
            months.add(format(date, 'yyyy-MM'));
            date.setMonth(date.getMonth() - 1);
        }
        return Array.from(months);
    }, []);

    const fetchSheet = async (monthId: string) => {
        setIsLoading(true);
        const sheet = await dataStore.getMonthlySalarySheet(monthId);
        setSalarySheet(sheet);
        setOpenAccordionItems([]); // Reset open items when fetching new sheet
        setIsLoading(false);
    };

    useEffect(() => {
        if (isOpen) {
            fetchSheet(selectedMonth);
        }
    }, [isOpen, selectedMonth]);

    const sortedSalaryRecords = useMemo(() => {
        if (!salarySheet) return [];
        const roleOrder: Record<string, number> = { 'Quản lý': 1, 'Pha chế': 2, 'Phục vụ': 3, 'Thu ngân': 4 };
        return Object.values(salarySheet.salaryRecords).sort((a, b) => {
            const orderA = roleOrder[a.userRole] || 99;
            const orderB = roleOrder[b.userRole] || 99;
            if (orderA !== orderB) return orderA - orderB;
            return a.userName.localeCompare(b.userName);
        });
    }, [salarySheet]);

    const handleRecalculate = async () => {
        if (!currentUser) return;
        setIsLoading(true);
        toast.loading('Đang tính toán lại bảng lương...', { id: 'recalc' });
        try {
            const monthDate = parseISO(`${selectedMonth}-01`);
            const newSheet = await calculateSalarySheet(monthDate, allUsers, { userId: currentUser.uid, userName: currentUser.displayName }, salarySheet?.salaryRecords);
            await dataStore.saveMonthlySalarySheet(selectedMonth, newSheet);
            setSalarySheet(newSheet);
            toast.success('Bảng lương đã được tính toán và lưu lại.', { id: 'recalc' });
        } catch (error) {
            console.error("Salary calculation failed:", error);
            toast.error('Lỗi khi tính toán bảng lương.', { id: 'recalc' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleRecordUpdated = useCallback((userId: string, updates: Partial<SalaryRecord>) => {
        // check if paidAt is undefined, delete that field
        if (updates.paidAt === undefined) {
            delete updates.paidAt;
        }
        
        setSalarySheet(prevSheet => {
            if (!prevSheet) return null;
            return {
                ...prevSheet,
                salaryRecords: {
                    ...prevSheet.salaryRecords,
                    [userId]: { ...prevSheet.salaryRecords[userId], ...updates },
                },
            };
        });
    }, []);

    const handleToggleAll = () => {
        if (openAccordionItems.length === sortedSalaryRecords.length) {
            setOpenAccordionItems([]);
        } else {
            setOpenAccordionItems(sortedSalaryRecords.map(r => r.userId));
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Quản lý Bảng lương tháng</DialogTitle>
                    <DialogDescription>
                        Xem lại và tính toán lương cho nhân viên theo tháng.
                        {salarySheet && (
                            <span className="text-xs block mt-1 text-muted-foreground">
                                Cập nhật lần cuối bởi {salarySheet.calculatedBy.userName} lúc {format(salarySheet.calculatedAt.toDate(), 'HH:mm dd/MM/yyyy')}
                            </span>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 py-4 border-y">
                    <div className="flex items-center gap-2">
                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Chọn tháng" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableMonths.map(month => (
                                    <SelectItem key={month} value={month}>
                                        Tháng {format(parseISO(`${month}-01`), 'MM/yyyy')}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <Button variant="outline" onClick={handleToggleAll} disabled={!salarySheet || sortedSalaryRecords.length === 0}>
                            <ChevronsDownUp className="mr-2 h-4 w-4" />
                            {openAccordionItems.length === sortedSalaryRecords.length ? 'Thu gọn' : 'Mở rộng'}
                        </Button>
                        <Button onClick={handleRecalculate} disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                            Tính toán lại
                        </Button>
                    </div>
                </div>

                <ScrollArea className="flex-grow">
                    <div className="pr-4">
                        {isLoading ? (
                            <div className="flex justify-center items-center h-64">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : salarySheet ? (
                            <Accordion 
                                type="multiple" 
                                className="w-full space-y-2" 
                                value={openAccordionItems}
                                onValueChange={setOpenAccordionItems}
                            >
                                {sortedSalaryRecords.map(record => (
                                    <SalaryRecordAccordionItem
                                        key={record.userId}
                                        record={record}
                                        monthId={salarySheet.id}
                                        currentUser={currentUser ? { userId: currentUser.uid, userName: currentUser.displayName} : null}
                                        currentUserRole={currentUser?.role}
                                        scheduleMap={salarySheet.scheduleMap}
                                        onRecordUpdated={handleRecordUpdated}
                                    />
                                ))}
                            </Accordion>
                        ) : (
                            <div className="text-center py-16 text-muted-foreground">
                                <p>Không có dữ liệu bảng lương cho tháng này.</p>
                                <p className="text-sm">Nhấn "Tính toán lại" để tạo mới.</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Đóng</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}