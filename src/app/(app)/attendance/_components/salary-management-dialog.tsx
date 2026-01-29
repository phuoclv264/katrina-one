'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogCancel } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { dataStore } from '@/lib/data-store';
import type { MonthlySalarySheet, SalaryRecord, ManagedUser, Schedule, AttendanceRecord, Violation, SimpleUser, UserRole } from '@/lib/types';
import { format, startOfMonth, endOfMonth, getISOWeek, getYear, parseISO, differenceInMinutes, addMonths } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from '@/components/ui/pro-toast';
import { Loader2, Download, RotateCw, AlertTriangle, CheckCircle, User, Clock, FileX, ChevronsDownUp, ChevronsUpDown, ArrowLeft, TrendingUp, DollarSign, Calendar, Filter, Search, ChevronRight } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import SalaryRecordSectionContent from './salary-record-section-content';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox } from '@/components/combobox';
import { cn, normalizeSearchString } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/user-avatar';

type SalaryManagementDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    allUsers: ManagedUser[];
    parentDialogTag: string;
};

// Navigation trigger component for section headers
const SalaryRecordNavigationTrigger: React.FC<{
    record: SalaryRecord;
    user: ManagedUser | null;
    onClick: () => void;
}> = ({ record, user, onClick }) => {
    const takeHome = Math.ceil((record.totalSalary - (record.salaryAdvance || 0) + (record.bonus || 0)) / 50000) * 50000;

    return (
        <button
            onClick={onClick}
            className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-zinc-50 active:bg-zinc-100 transition-colors border-b border-zinc-100 last:border-0 text-left"
        >
            <div className="flex items-center gap-3 flex-grow min-w-0">
                <UserAvatar user={user} />
                <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-zinc-900">{record.userName}</span>
                        {record.paymentStatus === 'paid' && (
                            <Badge className="h-4 px-1 text-[8px] uppercase tracking-wider bg-blue-500 hover:bg-blue-600">Trả</Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0">
                        <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-tight">{record.userRole}</span>
                        <span className="text-[10px] text-zinc-300">•</span>
                        <span className="text-[10px] text-zinc-500 font-medium">{record.totalWorkingHours.toFixed(1)}h</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <div className="text-right">
                    <div className="font-bold text-sm text-zinc-900 leading-tight">
                        {takeHome.toLocaleString('vi-VN')}đ
                    </div>
                    {record.totalUnpaidPenalties > 0 && (
                        <div className="text-[9px] font-bold text-red-500 mt-0">
                            -{record.totalUnpaidPenalties.toLocaleString('vi-VN')}đ phạt
                        </div>
                    )}
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-300" />
            </div>
        </button>
    );
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
            advances: existingSalaryRecords?.[user.uid]?.advances || [],
            bonus: existingSalaryRecords?.[user.uid]?.bonus || 0,
            bonuses: existingSalaryRecords?.[user.uid]?.bonuses || [],
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

export default function SalaryManagementDialog({ isOpen, onClose, allUsers, parentDialogTag }: SalaryManagementDialogProps & { parentDialogTag: string }) {
    const { user: currentUser } = useAuth();
    const isMobile = useIsMobile();
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [salarySheet, setSalarySheet] = useState<MonthlySalarySheet | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedUsers, setSelectedUsers] = useState<ManagedUser[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [nextMonthSalaryByUser, setNextMonthSalaryByUser] = useState<Record<string, number>>({});
    const [currentSection, setCurrentSection] = useState<string | null>(null); // null = main view, string = userId
    const dialogRef = React.useRef<HTMLDivElement>(null);
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
            // Ensure detail section is closed when the dialog is closed so we don't land
            // directly into a stale/open section on the next open.
            setCurrentSection(null);
            return;
        }

        let isActive = true;
        const loadSalaryData = async () => {
            setIsLoading(true);
            setSalarySheet(null); // Clear previous data
            try {
                let sheet = await dataStore.getMonthlySalarySheet(selectedMonth);

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
        let records = sortedSalaryRecords;

        if (selectedUsers.length > 0) {
            const selectedIds = new Set(selectedUsers.map(u => u.uid));
            records = records.filter(r => selectedIds.has(r.userId));
        }

        if (searchQuery.trim()) {
            const query = normalizeSearchString(searchQuery);
            records = records.filter(r =>
                normalizeSearchString(r.userName).includes(query) ||
                normalizeSearchString(r.userRole).includes(query)
            );
        }

        return records;
    }, [sortedSalaryRecords, selectedUsers, searchQuery]);

    const paidRecords = useMemo(() => {
        return filteredRecords.filter(r => r.paymentStatus === 'paid');
    }, [filteredRecords]);

    const eligibleRecords = useMemo(() => {
        return filteredRecords.filter(r =>
            r.paymentStatus !== 'paid' &&
            (nextMonthSalaryByUser[r.userId] || 0) >= eligibleThreshold &&
            ((r.totalUnpaidPenalties || 0) === 0)
        );
    }, [filteredRecords, nextMonthSalaryByUser]);

    const ineligibleRecords = useMemo(() => {
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

    useEffect(() => {
        const computeNextMonthExpectedSalaries = async () => {
            if (!salarySheet) return;
            const nextMonthDate = addMonths(parseISO(`${selectedMonth}-01`), 1);
            const nextStart = startOfMonth(nextMonthDate);
            const nextEnd = endOfMonth(nextMonthDate);

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

    return (
        <Dialog open={isOpen} onOpenChange={onClose} dialogTag="salary-management-dialog" parentDialogTag={parentDialogTag}>
            <DialogContent ref={dialogRef} className="max-w-4xl flex flex-col p-0 overflow-hidden bg-zinc-50">
                {currentSection === null ? (
                    <>
                        <div className="flex flex-col bg-white border-b shadow-sm">
                            <DialogHeader variant='premium' className="flex flex-row items-center justify-between border-b">
                                <div className="flex items-center gap-3 min-w-0">
                                    <DialogTitle className="text-base font-bold text-zinc-900">Bảng lương tháng {format(parseISO(`${selectedMonth}-01`), 'MM/yyyy')}</DialogTitle>

                                    {/* Recalculate button placed directly next to the title for faster access */}
                                    <Button
                                        aria-label="Tính lại bảng lương"
                                        title="Tính lại"
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleRecalculate}
                                        disabled={isLoading}
                                        className="h-9 w-9 text-zinc-500 hover:text-primary hover:bg-primary/5 flex-shrink-0"
                                    >
                                        <RotateCw className={cn("h-4.5 w-4.5", isLoading && "animate-spin")} />
                                    </Button>
                                </div>

                                <div className="flex items-center gap-1">
                                    {!isMobile && (
                                        <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9 text-zinc-400">
                                            <ArrowLeft className="h-5 w-5 rotate-180" />
                                        </Button>
                                    )}
                                </div>
                            </DialogHeader>

                            <div className="px-3 py-2 flex flex-col gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="flex-1 min-w-[130px]">
                                        <Combobox
                                            value={selectedMonth}
                                            onChange={setSelectedMonth}
                                            options={availableMonths.map(month => ({
                                                value: month,
                                                label: `Tháng ${format(parseISO(`${month}-01`), 'MM/yyyy')}`
                                            }))}
                                            className="w-full h-9 bg-zinc-50 border-zinc-200"
                                            placeholder="Chọn tháng"
                                            compact
                                            searchable={false}
                                        />
                                    </div>
                                    <div className="flex-[2] min-w-[180px] relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                        <Input
                                            placeholder="Tìm tên nhân viên..."
                                            className="pl-9 h-9 bg-zinc-50 border-zinc-200 focus-visible:ring-primary/20"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {salarySheet && (
                                    <div className="w-full -mx-3 px-3">
                                        <div className="w-full flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                                            <Card className="flex-1 border-none shadow-none bg-emerald-50/70 p-2 rounded-xl border border-emerald-100">
                                                <div className="flex items-center gap-1.5 text-emerald-700 mb-0">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                    <span className="text-[9px] font-bold uppercase tracking-wider">Đủ Trả</span>
                                                </div>
                                                <div className="text-sm font-black text-emerald-900">
                                                    {totalEligibleAmount.toLocaleString('vi-VN')}đ
                                                </div>
                                                <div className="text-[9px] text-emerald-600/80 font-medium">
                                                    {eligibleRecords.length} người
                                                </div>
                                            </Card>

                                            <Card className="flex-1 border-none shadow-none bg-amber-50/70 p-2 rounded-xl border border-amber-100">
                                                <div className="flex items-center gap-1.5 text-amber-700 mb-0">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                                    <span className="text-[9px] font-bold uppercase tracking-wider">Chưa đủ</span>
                                                </div>
                                                <div className="text-sm font-black text-amber-900">
                                                    {totalIneligibleAmount.toLocaleString('vi-VN')}đ
                                                </div>
                                                <div className="text-[9px] text-amber-600/80 font-medium">
                                                    {ineligibleRecords.length} người
                                                </div>
                                            </Card>

                                            <Card className="flex-1 border-none shadow-none bg-blue-50/70 p-2 rounded-xl border border-blue-100">
                                                <div className="flex items-center gap-1.5 text-blue-700 mb-0">
                                                    <CheckCircle className="h-3 w-3" />
                                                    <span className="text-[9px] font-bold uppercase tracking-wider">Đã Trả</span>
                                                </div>
                                                <div className="text-sm font-black text-blue-900">
                                                    {paidRecords.length}
                                                </div>
                                                <div className="text-[9px] text-blue-600/80 font-medium">
                                                    Hoàn thiện
                                                </div>
                                            </Card>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <ScrollArea className="flex-grow min-h-0 bg-zinc-50 overflow-y-auto">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center h-64 gap-3">
                                    <div className="relative">
                                        <div className="h-12 w-12 rounded-full border-4 border-zinc-100 border-t-primary animate-spin" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <DollarSign className="h-5 w-5 text-primary" />
                                        </div>
                                    </div>
                                    <p className="text-sm font-medium text-zinc-500">Đang chuẩn bị dữ liệu...</p>
                                </div>
                            ) : salarySheet ? (
                                <div className="p-3 space-y-4 pb-20">
                                    {eligibleRecords.length > 0 && (
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between px-1">
                                                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                                    Đủ điều kiện trả lương
                                                    <span className="bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded text-[9px]">{eligibleRecords.length}</span>
                                                </h3>
                                            </div>
                                            <div className="bg-white rounded-xl shadow-sm border border-zinc-100 overflow-hidden">
                                                {eligibleRecords.map(record => (
                                                    <SalaryRecordNavigationTrigger
                                                        key={record.userId}
                                                        record={record}
                                                        user={allUsers.find(u => u.uid === record.userId) || null}
                                                        onClick={() => setCurrentSection(record.userId)}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {ineligibleRecords.length > 0 && (
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between px-1">
                                                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                                    Chưa đủ điều kiện
                                                    <span className="bg-amber-100 text-amber-700 px-1 py-0.5 rounded text-[9px]">{ineligibleRecords.length}</span>
                                                </h3>
                                            </div>
                                            <div className="bg-white rounded-xl shadow-sm border border-zinc-100 overflow-hidden opacity-90">
                                                {ineligibleRecords.map(record => (
                                                    <SalaryRecordNavigationTrigger
                                                        key={record.userId}
                                                        record={record}
                                                        user={allUsers.find(u => u.uid === record.userId) || null}
                                                        onClick={() => setCurrentSection(record.userId)}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {paidRecords.length > 0 && (
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between px-1">
                                                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                                    Đã thanh toán xong
                                                    <span className="bg-blue-100 text-blue-700 px-1 py-0.5 rounded text-[9px]">{paidRecords.length}</span>
                                                </h3>
                                            </div>
                                            <div className="bg-white rounded-xl shadow-sm border border-zinc-100 overflow-hidden grayscale-[0.3]">
                                                {paidRecords.map(record => (
                                                    <SalaryRecordNavigationTrigger
                                                        key={record.userId}
                                                        record={record}
                                                        user={allUsers.find(u => u.uid === record.userId) || null}
                                                        onClick={() => setCurrentSection(record.userId)}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {filteredRecords.length === 0 && (
                                        <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                                            <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
                                                <Search className="h-8 w-8 text-zinc-300" />
                                            </div>
                                            <h3 className="text-zinc-900 font-bold mb-1">Không tìm thấy kết quả</h3>
                                            <p className="text-sm text-zinc-500 max-w-[240px]">Không tìm thấy nhân viên nào khớp với tìm kiếm của bạn.</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                                    <div className="w-20 h-20 rounded-full bg-zinc-100 flex items-center justify-center mb-6">
                                        <Calendar className="h-10 w-10 text-zinc-300" />
                                    </div>
                                    <h3 className="text-zinc-900 font-bold mb-2">Chưa có dữ liệu</h3>
                                    <p className="text-sm text-zinc-500 max-w-[280px] mb-8">Bảng lương cho tháng này chưa được tạo hoặc cần dữ liệu mới.</p>
                                    <Button onClick={handleRecalculate} className="rounded-xl px-8 h-12 font-bold shadow-lg shadow-primary/20">
                                        <RotateCw className="w-4 h-4 mr-2" />
                                        Tính toán ngay
                                    </Button>
                                </div>
                            )}
                        </ScrollArea>
                        <DialogFooter>
                            <DialogCancel onClick={onClose} className="w-full">Đóng</DialogCancel>
                        </DialogFooter>
                    </>
                ) : salarySheet ? (
                    <SalaryRecordSectionContent
                        record={salarySheet.salaryRecords[currentSection]}
                        monthId={salarySheet.id}
                        currentUser={currentUser ? { userId: currentUser.uid, userName: currentUser.displayName } : null}
                        currentUserRole={currentUser?.role}
                        scheduleMap={salarySheet.scheduleMap}
                        users={allUsers}
                        onRecordUpdated={handleRecordUpdated}
                        onBack={() => setCurrentSection(null)}
                        dialogContainerRef={dialogRef}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    );
}
