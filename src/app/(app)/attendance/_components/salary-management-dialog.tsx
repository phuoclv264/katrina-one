'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { dataStore } from '@/lib/data-store';
import type { MonthlySalarySheet, SalaryRecord, ManagedUser, Schedule, AttendanceRecord, Violation, SimpleUser, UserRole } from '@/lib/types';
import { format, startOfMonth, endOfMonth, getISOWeek, getYear, parseISO, differenceInMinutes, addMonths } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from '@/components/ui/pro-toast';
import { Loader2, Download, RotateCw, AlertTriangle, CheckCircle, User, Clock, FileX, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import SalaryRecordAccordionItem from './salary-record-accordion-item';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox } from '@/components/combobox';

type SalaryManagementDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    allUsers: ManagedUser[];
};

const calculateSalarySheet = async (
    month: Date,
    allUsers: ManagedUser[],
    currentUser: SimpleUser,
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
            bonus: existingSalaryRecords?.[user.uid]?.bonus || 0,
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
    const [selectedUsers, setSelectedUsers] = useState<ManagedUser[]>([]);
    const [nextMonthSalaryByUser, setNextMonthSalaryByUser] = useState<Record<string, number>>({});
    const eligibleThreshold = 500000;

    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        let date = new Date();
        for (let i = 0; i < 12; i++) {
            months.add(format(date, 'yyyy-MM'));
            date.setMonth(date.getMonth() - 1);
        }
        return Array.from(months);
    }, []);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        let isActive = true;
        const loadSalaryData = async () => {
            setIsLoading(true);
            setSalarySheet(null); // Clear previous data
            try {
                // Try fetching existing sheet first
                let sheet = await dataStore.getMonthlySalarySheet(selectedMonth);

                // If no sheet, calculate a new one
                if (!sheet) {
                    if (!currentUser) {
                        if (isActive) setIsLoading(false);
                        return;
                    }
                    toast.loading('Đang tính toán bảng lương...', { id: 'recalc' });
                    const monthDate = parseISO(`${selectedMonth}-01`);
                    const newSheet = await calculateSalarySheet(monthDate, allUsers, { userId: currentUser.uid, userName: currentUser.displayName });
                    await dataStore.saveMonthlySalarySheet(selectedMonth, newSheet);
                    sheet = newSheet;
                    toast.success('Bảng lương đã được tính toán và lưu lại.', { id: 'recalc' });
                }

                if (isActive) {
                    setSalarySheet(sheet);
                    setOpenAccordionItems([]);
                }
            } catch (error) {
                console.error("Salary data handling failed:", error);
                toast.error('Lỗi khi xử lý dữ liệu lương.');
                if (isActive) {
                    setSalarySheet(null);
                }
            } finally {
                if (isActive) {
                    setIsLoading(false);
                }
            }
        };

        loadSalaryData();

        return () => {
            isActive = false;
        };
    }, [isOpen, selectedMonth, allUsers, currentUser]);

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

    const filteredRecords = useMemo(() => {
        if (selectedUsers.length === 0) return sortedSalaryRecords;
        const selectedIds = new Set(selectedUsers.map(u => u.uid));
        return sortedSalaryRecords.filter(r => selectedIds.has(r.userId));
    }, [sortedSalaryRecords, selectedUsers]);

    const paidRecords = useMemo(() => {
        return filteredRecords.filter(r => r.paymentStatus === 'paid');
    }, [filteredRecords]);

    const eligibleRecords = useMemo(() => {
        // Eligible only when: not already paid, next month expected salary meets threshold,
        // AND the employee has no unpaid violation penalties.
        return filteredRecords.filter(r =>
            r.paymentStatus !== 'paid' &&
            (nextMonthSalaryByUser[r.userId] || 0) >= eligibleThreshold &&
            ((r.totalUnpaidPenalties || 0) === 0)
        );
    }, [filteredRecords, nextMonthSalaryByUser]);

    const ineligibleRecords = useMemo(() => {
        // Ineligible when not paid AND (next-month expected salary below threshold OR has unpaid penalties)
        return filteredRecords.filter(r =>
            r.paymentStatus !== 'paid' && (
                (nextMonthSalaryByUser[r.userId] || 0) < eligibleThreshold ||
                ((r.totalUnpaidPenalties || 0) > 0)
            )
        );
    }, [filteredRecords, nextMonthSalaryByUser]);

    const totalEligibleAmount = useMemo(() => {
        return eligibleRecords.reduce((sum, record) => {
            return sum + (record.totalSalary - (record.salaryAdvance || 0) + (record.bonus || 0));
        }, 0);
    }, [eligibleRecords]);

    const totalIneligibleAmount = useMemo(() => {
        return ineligibleRecords.reduce((sum, record) => {
            return sum + (record.totalSalary - (record.salaryAdvance || 0) + (record.bonus || 0));
        }, 0);
    }, [ineligibleRecords]);

    // Count of records currently shown and whether all are expanded
    const shownCount = eligibleRecords.length + ineligibleRecords.length + paidRecords.length;
    const allExpanded = shownCount > 0 && openAccordionItems.length === shownCount;

    useEffect(() => {
        const computeNextMonthExpectedSalaries = async () => {
            if (!salarySheet) return;
            const nextMonthDate = addMonths(parseISO(`${selectedMonth}-01`), 1);
            const nextStart = startOfMonth(nextMonthDate);
            const nextEnd = endOfMonth(nextMonthDate);

            // Fetch all attendance for the next month once
            const nextMonthAttendance = await dataStore.getAttendanceRecordsForDateRange({ from: nextStart, to: nextEnd });

            const map: Record<string, number> = {};
            for (const record of Object.values(salarySheet.salaryRecords)) {
                const userId = record.userId;
                const userAttendance = nextMonthAttendance.filter(r => r.userId === userId && r.checkInTime && r.checkOutTime);
                const hours = userAttendance.reduce((sum, r) => sum + (r.totalHours || 0), 0);
                const user = allUsers.find(u => u.uid === userId);
                const rate = record.averageHourlyRate || user?.hourlyRate || 0;
                map[userId] = Math.round(hours * rate);
            }
            setNextMonthSalaryByUser(map);
        };
        computeNextMonthExpectedSalaries();
    }, [salarySheet, selectedMonth, allUsers]);

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
        const shownIds = [...eligibleRecords, ...ineligibleRecords, ...paidRecords].map(r => r.userId);
        if (openAccordionItems.length === shownIds.length) {
            setOpenAccordionItems([]);
        } else {
            setOpenAccordionItems(shownIds);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl sm:h-[90vh] h-[100vh] flex flex-col p-0">
                <DialogHeader className="flex flex-row items-center gap-2 px-4 py-2 border-b">
                    <DialogTitle className="text-base sm:text-lg">Quản lý Bảng lương</DialogTitle>
                </DialogHeader>
                <div className="px-4 py-2 border-b bg-muted/30">
                    <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-5 sm:col-span-3">
                            <Combobox
                                value={selectedMonth}
                                onChange={setSelectedMonth}
                                options={availableMonths.map(month => ({
                                    value: month,
                                    label: `Tháng ${format(parseISO(`${month}-01`), 'MM/yyyy')}`
                                }))}
                                className="w-full"
                                placeholder="Tháng"
                                compact
                                searchable={false}
                            />
                        </div>
                        <div className="col-span-7 sm:col-span-9">
                            <Combobox
                                options={allUsers
                                    .filter(u => u.role !== 'Chủ nhà hàng')
                                    .map(u => ({ value: u.uid, label: u.displayName }))}
                                multiple
                                value={selectedUsers.map(u => u.uid)}
                                onChange={(next) => {
                                    const nextIds = Array.isArray(next)
                                        ? next
                                        : typeof next === 'string' && next
                                            ? [next]
                                            : [];
                                    setSelectedUsers(
                                        nextIds
                                            .map(id => allUsers.find(u => u.uid === id))
                                            .filter((u): u is ManagedUser => !!u)
                                    );
                                }}
                                placeholder="Nhân viên..."
                                searchPlaceholder="Tìm nhân viên..."
                                emptyText="Không thấy."
                                className="w-full"
                                compact
                            />
                        </div>
                    </div>
                    {salarySheet && (
                        <div className="mt-2 grid grid-cols-12 gap-2 items-center">
                            <div className="col-span-10 sm:col-span-10 flex flex-wrap items-center gap-1.5">
                                <Badge variant="secondary" className="px-2 py-0 h-5 bg-green-100 text-green-700 border-green-200 text-[10px] sm:text-xs">
                                    <CheckCircle className="h-3 w-3 mr-1" /> {eligibleRecords.length} Đủ ĐK
                                </Badge>
                                <Badge variant="outline" className="px-2 py-0 h-5 bg-amber-50 text-amber-700 border-amber-200 text-[10px] sm:text-xs">
                                    <AlertTriangle className="h-3 w-3 mr-1" /> {ineligibleRecords.length} Chưa đủ ĐK
                                </Badge>
                                <Badge variant="outline" className="px-2 py-0 h-5 bg-blue-50 text-blue-700 border-blue-200 text-[10px] sm:text-xs">
                                    <CheckCircle className="h-3 w-3 mr-1" /> {paidRecords.length} Đã trả
                                </Badge>
                            </div>

                            <div className="col-span-2 sm:col-span-2 flex items-center justify-end gap-1">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={handleRecalculate} 
                                    disabled={isLoading}
                                    title="Tính toán lại"
                                    className="h-8 w-8 text-primary"
                                >
                                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                                </Button>
                                    <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={handleToggleAll} 
                                    disabled={!salarySheet || shownCount === 0}
                                    title={allExpanded ? 'Thu gọn tất cả' : 'Mở rộng tất cả'}
                                    className="h-8 w-8"
                                >
                                    {allExpanded ? <ChevronsDownUp className="h-4 w-4" /> : <ChevronsUpDown className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <ScrollArea className="flex-grow min-h-0 px-4">
                        {isLoading ? (
                            <div className="flex justify-center items-center h-64">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : salarySheet ? (
                            <div className="space-y-3 py-3">
                                <Card className="border-l-4 border-green-500 shadow-sm overflow-hidden">
                                    <div className="py-2 px-3 border-b flex items-center justify-between bg-green-50/50">
                                        <div className="flex items-center gap-1.5">
                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                            <span className="font-bold text-sm sm:text-base text-green-800">Đủ điều kiện</span>
                                            <Badge variant="secondary" className="px-1 py-0 h-4 text-[10px] font-normal bg-green-100">{eligibleRecords.length}</Badge>
                                        </div>
                                        <span className="text-sm sm:text-base font-bold text-green-700">
                                            {totalEligibleAmount.toLocaleString('vi-VN')}đ
                                        </span>
                                    </div>
                                    <CardContent className="p-0">
                                        <Accordion
                                            type="multiple"
                                            className="w-full"
                                            value={openAccordionItems}
                                            onValueChange={setOpenAccordionItems}
                                        >
                                            {eligibleRecords.map(record => (
                                                <SalaryRecordAccordionItem
                                                    key={record.userId}
                                                    record={record}
                                                    monthId={salarySheet.id}
                                                    currentUser={currentUser ? { userId: currentUser.uid, userName: currentUser.displayName } : null}
                                                    currentUserRole={currentUser?.role}
                                                    scheduleMap={salarySheet.scheduleMap}
                                                    onRecordUpdated={handleRecordUpdated}
                                                />
                                            ))}
                                        </Accordion>
                                    </CardContent>
                                </Card>

                                <Card className="border-l-4 border-amber-500 shadow-sm overflow-hidden">
                                    <div className="py-2 px-3 border-b flex items-center justify-between bg-amber-50/50">
                                        <div className="flex items-center gap-1.5">
                                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                                            <span className="font-bold text-sm sm:text-base text-amber-800">Chưa đủ điều kiện</span>
                                            <Badge variant="outline" className="px-1 py-0 h-4 text-[10px] font-normal border-amber-200 bg-amber-100">{ineligibleRecords.length}</Badge>
                                        </div>
                                        <span className="text-sm sm:text-base font-bold text-amber-700">{totalIneligibleAmount.toLocaleString('vi-VN')}đ</span>
                                    </div>
                                    <CardContent className="p-0">
                                        <Accordion
                                            type="multiple"
                                            className="w-full"
                                            value={openAccordionItems}
                                            onValueChange={setOpenAccordionItems}
                                        >
                                            {ineligibleRecords.map(record => (
                                                <SalaryRecordAccordionItem
                                                    key={record.userId}
                                                    record={record}
                                                    monthId={salarySheet.id}
                                                    currentUser={currentUser ? { userId: currentUser.uid, userName: currentUser.displayName } : null}
                                                    currentUserRole={currentUser?.role}
                                                    scheduleMap={salarySheet.scheduleMap}
                                                    onRecordUpdated={handleRecordUpdated}
                                                />
                                            ))}
                                        </Accordion>
                                    </CardContent>
                                </Card>

                                <Card className="border-l-4 border-blue-500 shadow-sm overflow-hidden">
                                    <div className="py-2 px-3 border-b flex items-center gap-1.5 bg-blue-50/50">
                                        <CheckCircle className="h-4 w-4 text-blue-600" />
                                        <span className="font-bold text-sm sm:text-base text-blue-800">Đã trả</span>
                                        <Badge variant="outline" className="px-1 py-0 h-4 text-[10px] font-normal border-blue-200 bg-blue-100">{paidRecords.length}</Badge>
                                    </div>
                                    <CardContent className="p-0">
                                        <Accordion
                                            type="multiple"
                                            className="w-full"
                                            value={openAccordionItems}
                                            onValueChange={setOpenAccordionItems}
                                        >
                                            {paidRecords.map(record => (
                                                <SalaryRecordAccordionItem
                                                    key={record.userId}
                                                    record={record}
                                                    monthId={salarySheet.id}
                                                    currentUser={currentUser ? { userId: currentUser.uid, userName: currentUser.displayName } : null}
                                                    currentUserRole={currentUser?.role}
                                                    scheduleMap={salarySheet.scheduleMap}
                                                    onRecordUpdated={handleRecordUpdated}
                                                />
                                            ))}
                                        </Accordion>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : (
                            <div className="text-center py-16 text-muted-foreground">
                                <p>Không có dữ liệu bảng lương cho tháng này.</p>
                                <p className="text-sm">Nhấn "Tính toán lại" để tạo mới.</p>
                            </div>
                        )}
                </ScrollArea>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Đóng</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
