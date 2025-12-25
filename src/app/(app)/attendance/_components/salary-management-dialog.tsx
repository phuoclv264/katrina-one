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
import { Loader2, Download, Calculator, AlertTriangle, CheckCircle, User, Clock, FileX, ChevronsDownUp } from 'lucide-react';
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
        return filteredRecords.filter(r => r.paymentStatus !== 'paid' && (nextMonthSalaryByUser[r.userId] || 0) >= eligibleThreshold);
    }, [filteredRecords, nextMonthSalaryByUser]);

    const ineligibleRecords = useMemo(() => {
        return filteredRecords.filter(r => r.paymentStatus !== 'paid' && (nextMonthSalaryByUser[r.userId] || 0) < eligibleThreshold);
    }, [filteredRecords, nextMonthSalaryByUser]);

    const totalEligibleAmount = useMemo(() => {
        return eligibleRecords.reduce((sum, record) => {
            return sum + (record.totalSalary - (record.salaryAdvance || 0) + (record.bonus || 0));
        }, 0);
    }, [eligibleRecords]);

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
                <DialogHeader>
                    <DialogTitle className="px-4 pt-4">Quản lý Bảng lương tháng</DialogTitle>
                </DialogHeader>
                <div className="px-4 py-2 border-b">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Combobox
                                value={selectedMonth}
                                onChange={setSelectedMonth}
                                options={availableMonths.map(month => ({
                                    value: month,
                                    label: `Tháng ${format(parseISO(`${month}-01`), 'MM/yyyy')}`
                                }))}
                                className="w-[160px] sm:w-[180px]"
                                placeholder="Chọn tháng"
                                compact
                                searchable={false}
                            />
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <div className="w-full sm:w-[300px]">
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
                                    placeholder="Chọn nhân viên..."
                                    searchPlaceholder="Tìm nhân viên..."
                                    emptyText="Không tìm thấy nhân viên."
                                    className="w-full"
                                />
                            </div>
                            <Button variant="outline" onClick={handleToggleAll} disabled={!salarySheet || (eligibleRecords.length + ineligibleRecords.length + paidRecords.length) === 0}>
                                <ChevronsDownUp className="mr-2 h-4 w-4" />
                                {openAccordionItems.length === (eligibleRecords.length + ineligibleRecords.length + paidRecords.length) ? 'Thu gọn' : 'Mở rộng'}
                            </Button>
                            <Button onClick={handleRecalculate} disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                                Tính toán lại
                            </Button>
                        </div>
                    </div>
                    {salarySheet && (
                        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-muted-foreground mt-2">
                            <Badge variant="secondary" className="flex items-center gap-1">
                                <CheckCircle className="h-3 w-3 text-green-600" /> {eligibleRecords.length} đủ điều kiện (≥ {eligibleThreshold.toLocaleString('vi-VN')})
                            </Badge>
                            <Badge variant="outline" className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3 text-yellow-600" /> {ineligibleRecords.length} chưa đủ điều kiện
                            </Badge>
                            <Badge variant="outline" className="flex items-center gap-1">
                                <CheckCircle className="h-3 w-3 text-blue-600" /> {paidRecords.length} đã trả
                            </Badge>
                        </div>
                    )}
                </div>

                <ScrollArea className="flex-grow min-h-0 px-4">
                        {isLoading ? (
                            <div className="flex justify-center items-center h-64">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : salarySheet ? (
                            <div className="space-y-4">
                                <Card className="border-l-4 border-green-500">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-center gap-2 justify-between">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle className="h-5 w-5 text-green-600" />
                                                <span>Đủ điều kiện trả lương</span>
                                                <Badge variant="secondary">{eligibleRecords.length}</Badge>
                                            </div>
                                            <span className="text-lg font-bold text-green-700">
                                                {totalEligibleAmount.toLocaleString('vi-VN')}đ
                                            </span>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Accordion
                                            type="multiple"
                                            className="w-full space-y-2"
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
                                <Card className="border-l-4 border-amber-500">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-center gap-2">
                                            <AlertTriangle className="h-5 w-5 text-yellow-600" />
                                            <span>Chưa đủ điều kiện</span>
                                            <Badge variant="outline">{ineligibleRecords.length}</Badge>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Accordion
                                            type="multiple"
                                            className="w-full space-y-2"
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
                                <Card className="border-l-4 border-blue-500">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-center gap-2">
                                            <CheckCircle className="h-5 w-5 text-blue-600" />
                                            <span>Đã trả</span>
                                            <Badge>{paidRecords.length}</Badge>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Accordion
                                            type="multiple"
                                            className="w-full space-y-2"
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
