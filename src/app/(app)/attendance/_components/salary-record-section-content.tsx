'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Wallet, TrendingUp, DollarSign, History, ShieldAlert, XCircle, Info, Calendar, User, Loader2, CheckCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { SalaryRecord, SimpleUser, Schedule, ManagedUser } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Timestamp } from 'firebase/firestore';
import { toast } from '@/components/ui/pro-toast';
import { dataStore } from '@/lib/data-store';
import { findShiftForRecord, getStatusInfo } from '@/lib/attendance-utils';
import { cn, generateShortName } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { UserAvatar } from '@/components/user-avatar';
import { useAuth } from '@/hooks/use-auth';

type SalaryRecordSectionContentProps = {
    record: SalaryRecord | undefined;
    monthId: string;
    currentUser: SimpleUser | null;
    currentUserRole: string | undefined;
    scheduleMap: Record<string, Schedule>;
    users: ManagedUser[];
    onRecordUpdated: (userId: string, updates: Partial<SalaryRecord>) => void;
    onBack: () => void;
};

// Embedded SalaryRecordAccordionItem component
const SalaryRecordAccordionItem: React.FC<{
    record: SalaryRecord;
    monthId: string;
    currentUser: SimpleUser | null;
    currentUserRole: string | undefined;
    scheduleMap: Record<string, Schedule>;
    onRecordUpdated: (userId: string, updates: Partial<SalaryRecord>) => void;
    standalone?: boolean;
}> = React.memo(
    ({ record, monthId, currentUser, currentUserRole, scheduleMap, onRecordUpdated, standalone = false }) => {
        const [localAdvanceAmount, setLocalAdvanceAmount] = useState<string>(
            record.salaryAdvance?.toString() ?? ''
        );
        const containerRef = useRef<HTMLDivElement | null>(null);
        const [localBonusAmount, setLocalBonusAmount] = useState<string>(
            record.bonus?.toString() ?? ''
        );
        const [isUpdatingAdvance, setIsUpdatingAdvance] = useState(false);
        const [isUpdatingBonus, setIsUpdatingBonus] = useState(false);
        const isMobile = useIsMobile();
        const [isUpdatingPaymentStatus, setIsUpdatingPaymentStatus] = useState(false);
        const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
        const [actualPaidInput, setActualPaidInput] = useState<string>('');
        const [actualPaidNumber, setActualPaidNumber] = useState<number | null>(null);
        const inputRef = useRef<HTMLInputElement | null>(null);

        useEffect(() => {
            if (!isPayDialogOpen) return;
            const id = window.setTimeout(() => inputRef.current?.focus(), 0);
            return () => clearTimeout(id);
        }, [isPayDialogOpen]);

        useEffect(() => {
            setLocalAdvanceAmount(record.salaryAdvance?.toString() ?? '');
            setLocalBonusAmount(record.bonus?.toString() ?? '');
        }, [record.salaryAdvance, record.bonus]);

        const handleUpdateAdvance = useCallback(async () => {
            if (!monthId || !record.userId) return;
            const amount = Number(localAdvanceAmount);
            if (isNaN(amount) || amount < 0) {
                toast.error('Số tiền tạm ứng không hợp lệ.');
                return;
            }
            setIsUpdatingAdvance(true);
            const toastId = toast.loading('Đang cập nhật tiền tạm ứng...');
            try {
                await dataStore.updateSalaryAdvance(monthId, record.userId, amount);
                onRecordUpdated(record.userId, { salaryAdvance: amount });
                toast.success('Đã cập nhật tiền tạm ứng.', { id: toastId });
            } catch (error) {
                toast.error('Lỗi khi cập nhật tiền tạm ứng.', { id: toastId });
            } finally {
                setIsUpdatingAdvance(false);
            }
        }, [monthId, record.userId, localAdvanceAmount, onRecordUpdated]);

        const handleUpdateBonus = useCallback(async () => {
            if (!monthId || !record.userId) return;
            const amount = Number(localBonusAmount);
            if (isNaN(amount) || amount < 0) {
                toast.error('Số tiền thưởng không hợp lệ.');
                return;
            }
            setIsUpdatingBonus(true);
            const toastId = toast.loading('Đang cập nhật tiền thưởng...');
            try {
                await dataStore.updateSalaryBonus(monthId, record.userId, amount);
                onRecordUpdated(record.userId, { bonus: amount });
                toast.success('Đã cập nhật tiền thưởng.', { id: toastId });
            } catch (error) {
                toast.error('Lỗi khi cập nhật tiền thưởng.', { id: toastId });
            } finally {
                setIsUpdatingBonus(false);
            }
        }, [monthId, record.userId, localBonusAmount, onRecordUpdated]);

        const handleTogglePaymentStatus = useCallback(async () => {
            if (!currentUser || !monthId || !record.userId) return;
            const newStatus = record.paymentStatus === 'paid' ? 'unpaid' : 'paid';
            if (newStatus === 'paid') {
                const baseAmount = Math.max(0, record.totalSalary - (record.salaryAdvance || 0) + (record.bonus || 0));
                const roundedSuggested = Math.ceil(baseAmount / 50000) * 50000;
                setActualPaidNumber(roundedSuggested);
                setActualPaidInput(new Intl.NumberFormat('vi-VN').format(roundedSuggested));
                setIsPayDialogOpen(true);
                return;
            }
            setIsUpdatingPaymentStatus(true);
            const toastId = toast.loading('Đang cập nhật trạng thái...');
            try {
                await dataStore.updateSalaryPayment(monthId, record.userId, newStatus);
                onRecordUpdated(record.userId, { paymentStatus: newStatus, paidAt: undefined });
                toast.success(`Hủy đánh dấu thanh toán thành công.`, { id: toastId });
            } catch (error) {
                toast.error('Lỗi khi cập nhật trạng thái.', { id: toastId });
            } finally {
                setIsUpdatingPaymentStatus(false);
            }
        }, [currentUser, monthId, record.userId, record.paymentStatus, onRecordUpdated]);

        const violationPenaltyTotals = useMemo(() => {
            let paid = 0;
            let unpaid = 0;
            for (const v of record.violationRecords || []) {
                const userCost = v.userCosts?.find((uc) => uc.userId === record.userId)?.cost || 0;
                const isPaid = v.isPenaltyWaived || (v.penaltySubmissions?.some((ps) => ps.userId === record.userId)) || v.penaltyPhotos;
                if (userCost > 0) {
                    if (isPaid) paid += userCost;
                    else unpaid += userCost;
                }
            }
            return { paid, unpaid };
        }, [record.violationRecords, record.userId]);

        const totalPenalty = violationPenaltyTotals.paid + violationPenaltyTotals.unpaid;

        const finalTakeHomePay = useMemo(() => {
            const base = Math.max(0, record.totalSalary - (record.salaryAdvance || 0) + (record.bonus || 0));
            return Math.ceil(base / 50000) * 50000;
        }, [record.totalSalary, record.salaryAdvance, record.bonus]);

        const Content = (
            <div className="space-y-6">
                {/* 1. Main Payment Summary Card */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="border-none shadow-sm bg-white overflow-hidden rounded-2xl">
                        <div className="bg-primary/5 p-4 flex items-center justify-between border-b border-primary/10">
                            <div className="flex items-center gap-2">
                                <Wallet className="w-5 h-5 text-primary" />
                                <span className="text-xs font-black uppercase tracking-wider text-primary/70">Tổng thực nhận</span>
                            </div>
                            {record.paymentStatus === 'paid' ? (
                                <Badge className="bg-emerald-500 hover:bg-emerald-600 rounded-lg">Đã thanh toán</Badge>
                            ) : (
                                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 rounded-lg">Chờ thanh toán</Badge>
                            )}
                        </div>
                        <CardContent className="p-5 pt-4">
                            <div className="flex flex-col">
                                <span className="text-4xl font-black text-zinc-900 leading-tight">
                                    {(record.actualPaidAmount || finalTakeHomePay).toLocaleString('vi-VN')}
                                    <span className="text-lg ml-1 font-bold opacity-30">đ</span>
                                </span>
                                <div className="flex items-center gap-2 mt-2">
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-100 rounded-full text-[10px] font-bold text-zinc-500">
                                        <TrendingUp className="w-3 h-3 text-emerald-500" />
                                        {record.totalWorkingHours.toFixed(1)}h làm việc
                                    </div>
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-100 rounded-full text-[10px] font-bold text-zinc-500">
                                        {record.averageHourlyRate.toLocaleString('vi-VN')}đ/h
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm bg-white overflow-hidden rounded-2xl">
                        <div className="p-4 grid grid-cols-2 gap-4 h-full">
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-black text-zinc-400 tracking-wider">Tạm ứng</p>
                                    <p className="font-bold text-zinc-900 border-l-2 border-amber-400 pl-2">
                                        -{(record.salaryAdvance || 0).toLocaleString('vi-VN')}đ
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-black text-zinc-400 tracking-wider">Khen thưởng</p>
                                    <p className="font-bold text-emerald-600 border-l-2 border-emerald-500 pl-2">
                                        +{(record.bonus || 0).toLocaleString('vi-VN')}đ
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-black text-zinc-400 tracking-wider">Phạt chưa trả</p>
                                    <p className="font-bold text-red-500 border-l-2 border-red-500 pl-2">
                                        -{(record.totalUnpaidPenalties || 0).toLocaleString('vi-VN')}đ
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-black text-zinc-400 tracking-wider">Lương dự tính</p>
                                    <p className="font-bold text-zinc-500 border-l-2 border-zinc-200 pl-2">
                                        {Math.round(record.totalExpectedHours * record.averageHourlyRate).toLocaleString('vi-VN')}đ
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* 2. Admin Quick Update Controls */}
                {currentUserRole === 'Chủ nhà hàng' && (
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                        <div className="sm:col-span-8 grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1" htmlFor={`advance-${record.userId}`}>Cập nhật tạm ứng</Label>
                                <div className="relative group">
                                    <Input
                                        id={`advance-${record.userId}`}
                                        type="number"
                                        placeholder="0"
                                        className="h-11 bg-white border-zinc-100 pr-12 rounded-xl focus-visible:ring-primary/20 shadow-sm"
                                        value={localAdvanceAmount}
                                        onChange={(e) => setLocalAdvanceAmount(e.target.value)}
                                        onFocus={(e) => e.target.select()}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleUpdateAdvance}
                                        className="absolute right-1 top-1 h-9 px-3 rounded-lg text-primary hover:bg-primary/5 font-bold"
                                        disabled={isUpdatingAdvance}
                                    >
                                        {isUpdatingAdvance ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lưu'}
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1" htmlFor={`bonus-${record.userId}`}>Tiền thưởng nóng</Label>
                                <div className="relative group">
                                    <Input
                                        id={`bonus-${record.userId}`}
                                        type="number"
                                        placeholder="0"
                                        className="h-11 bg-white border-zinc-100 pr-12 rounded-xl focus-visible:ring-emerald-500/20 shadow-sm"
                                        value={localBonusAmount}
                                        onChange={(e) => setLocalBonusAmount(e.target.value)}
                                        onFocus={(e) => e.target.select()}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleUpdateBonus}
                                        className="absolute right-1 top-1 h-9 px-3 rounded-lg text-emerald-600 hover:bg-emerald-50 font-bold"
                                        disabled={isUpdatingBonus}
                                    >
                                        {isUpdatingBonus ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lưu'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <div className="sm:col-span-4 self-end">
                            <Button
                                onClick={handleTogglePaymentStatus}
                                variant={record.paymentStatus === 'paid' ? 'outline' : 'default'}
                                disabled={isUpdatingPaymentStatus}
                                className={cn(
                                    "w-full h-11 rounded-xl font-bold shadow-lg transition-all active:scale-[0.98]",
                                    record.paymentStatus === 'paid' ? "border-zinc-200 text-zinc-500 hover:text-red-600 hover:bg-red-50" : "shadow-primary/20 bg-primary hover:bg-primary/90"
                                )}
                            >
                                {isUpdatingPaymentStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DollarSign className="mr-2 h-4 w-4" />}
                                {record.paymentStatus === 'paid' ? 'Hủy thanh toán' : 'Đánh dấu Đã trả'}
                            </Button>
                        </div>
                    </div>
                )}

                {/* 3. Detailed Tabs (Attendance & Violations) */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                        <History className="h-4 w-4 text-zinc-400" />
                        <h4 className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em]">Chi tiết chấm công</h4>
                    </div>

                    <div className="space-y-2.5">
                        {record.attendanceRecords.length === 0 ? (
                            <div className="bg-white p-8 rounded-2xl border border-zinc-100 flex flex-col items-center justify-center text-center">
                                <Calendar className="w-10 h-10 text-zinc-100 mb-2" />
                                <p className="text-xs font-medium text-zinc-400">Không có dữ liệu công</p>
                            </div>
                        ) : (
                            record.attendanceRecords.map((att) => {
                                const shifts = findShiftForRecord(att, scheduleMap);
                                const statusInfo = getStatusInfo(att, shifts);
                                const isWarning = statusInfo.text.toLowerCase().includes('đến trễ') || statusInfo.text.toLowerCase().includes('về sớm');

                                return (
                                    <div key={att.id} className="group bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm hover:border-primary/20 transition-colors">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-zinc-50 flex flex-col items-center justify-center leading-none border border-zinc-100">
                                                    <span className="text-[10px] font-black text-zinc-400 uppercase mb-0.5">{format((att.checkInTime as Timestamp).toDate(), 'EEE', { locale: vi })}</span>
                                                    <span className="text-sm font-black text-zinc-900">{format((att.checkInTime as Timestamp).toDate(), 'dd/MM')}</span>
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-bold text-zinc-900">
                                                            {format((att.checkInTime as Timestamp).toDate(), 'HH:mm')} - {att.checkOutTime ? format((att.checkOutTime as Timestamp).toDate(), 'HH:mm') : '...'}
                                                        </span>
                                                        <Badge variant="secondary" className={cn(
                                                            "h-4 px-1.5 text-[9px] font-bold rounded-md",
                                                            isWarning ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
                                                        )}>
                                                            {statusInfo.text}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] font-bold text-zinc-400 lowercase tracking-tight">
                                                            {shifts.map((s) => s.label).join(', ') || 'Ngoài giờ'}
                                                        </span>
                                                        <span className="text-[10px] text-zinc-300">•</span>
                                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight">{att.totalHours?.toFixed(1)} giờ làm</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-black text-zinc-900">{att.salary?.toLocaleString('vi-VN')}đ</div>
                                                <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-tight">Thu nhập</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {record.absentShifts.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 px-1">
                            <ShieldAlert className="h-4 w-4 text-red-400" />
                            <h4 className="text-[11px] font-black text-red-400 uppercase tracking-[0.2em]">Cáo vắng bất thường</h4>
                        </div>
                        <div className="bg-red-50/50 border border-red-100 rounded-2xl p-4 space-y-2">
                            {record.absentShifts.filter((shift) => {
                                const shiftEnd = parseISO(`${shift.date}T${shift.timeSlot.end}`);
                                return shiftEnd.getTime() < Date.now();
                            }).map((shift) => (
                                <div key={shift.id} className="flex items-center gap-3 text-sm">
                                    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                    <span className="font-bold text-red-900">{format(parseISO(shift.date), 'dd/MM')}</span>
                                    <span className="text-zinc-300">|</span>
                                    <span className="text-red-700 font-medium italic">Vắng ca {shift.label} ({shift.timeSlot.start}-{shift.timeSlot.end})</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {record.violationRecords.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 px-1">
                            <Info className="h-4 w-4 text-amber-500" />
                            <h4 className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em]">Lịch sử vi phạm ({record.violationRecords.length})</h4>
                        </div>
                        <div className="space-y-2.5">
                            {record.violationRecords.map((v) => {
                                const isPaid = v.isPenaltyWaived || v.penaltySubmissions?.some((ps) => ps.userId === record.userId) || v.penaltyPhotos;
                                const userCost = v.userCosts?.find((uc) => uc.userId === record.userId)?.cost || 0;

                                return (
                                    <div key={v.id} className="bg-white border border-zinc-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                                                isPaid ? "bg-zinc-50 text-zinc-400" : "bg-red-50 text-red-600"
                                            )}>
                                                <ShieldAlert className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-zinc-900 pr-2">{v.categoryName}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">{format((v.createdAt as Timestamp).toDate(), 'dd MMM, yyyy')}</span>
                                                    <span className="text-[10px] text-zinc-300">•</span>
                                                    <Badge className={cn(
                                                        "h-3.5 px-1 rounded text-[8px] font-black uppercase tracking-wider",
                                                        isPaid ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-50 border-none shadow-none" : "bg-red-50 text-red-600 hover:bg-red-50 border-none shadow-none"
                                                    )}>
                                                        {v.isPenaltyWaived ? 'MIỄN PHẠT' : isPaid ? 'ĐÃ NỘP' : 'CẦN NỘP'}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right ml-2">
                                            <span className={cn("text-sm font-black", !isPaid ? "text-red-500" : "text-zinc-400")}>
                                                -{userCost.toLocaleString('vi-VN')}đ
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <AlertDialog dialogTag="alert-dialog" open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen} parentDialogTag={standalone ? 'root' : 'salary-management-dialog'} variant="warning">
                    <AlertDialogContent className="max-w-xl">
                        <AlertDialogHeader hideicon className="p-6 pb-0">
                            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2">
                                <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 shadow-sm border border-amber-100 flex-shrink-0">
                                    <DollarSign className="w-7 h-7" />
                                </div>
                                <div className="text-center sm:text-left space-y-1">
                                    <AlertDialogTitle className="text-xl">Xác nhận trả lương</AlertDialogTitle>
                                    <AlertDialogDescription className="text-sm pt-0">
                                        Số tiền đề xuất: <span className="text-primary font-black">{finalTakeHomePay.toLocaleString('vi-VN')}đ</span>. Vui lòng kiểm tra thông tin và nhập số tiền thực trả.
                                    </AlertDialogDescription>
                                </div>
                            </div>
                        </AlertDialogHeader>

                        <div className="p-3 space-y-6">
                            {/* Staff Detailed Breakdown Info */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 bg-zinc-50/50 rounded-2xl p-5 border border-zinc-100">
                                <div className="flex justify-between items-center pb-2 border-b border-zinc-100 sm:col-span-2">
                                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nhân viên</span>
                                    <span className="text-sm font-black text-primary uppercase tracking-tight">{record.userName}</span>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Vai trò</span>
                                    <span className="text-xs font-black text-zinc-700">{record.userRole}</span>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Giờ làm</span>
                                    <span className="text-xs font-black text-zinc-700">{record.totalWorkingHours.toFixed(1)} / {record.totalExpectedHours.toFixed(1)} h</span>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Lương/giờ</span>
                                    <span className="text-xs font-black text-zinc-700">{record.averageHourlyRate.toLocaleString('vi-VN')}đ</span>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Tổng lương ca</span>
                                    <span className="text-xs font-black text-zinc-700">{record.totalSalary.toLocaleString('vi-VN')}đ</span>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Tạm ứng</span>
                                    <span className="text-xs font-black text-red-500">{(record.salaryAdvance || 0).toLocaleString('vi-VN')}đ</span>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Khen thưởng</span>
                                    <span className="text-xs font-black text-emerald-600">{(record.bonus || 0).toLocaleString('vi-VN')}đ</span>
                                </div>

                                <div className="flex justify-between items-center sm:col-span-2 pt-2 border-t border-zinc-100">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Tổng phạt</span>
                                    <div className="text-right">
                                        <span className="text-xs font-black text-zinc-700">{totalPenalty.toLocaleString('vi-VN')}đ</span>
                                        {violationPenaltyTotals.unpaid > 0 && (
                                            <span className="text-[10px] text-red-500 font-bold ml-1.5">(chưa nộp: {violationPenaltyTotals.unpaid.toLocaleString('vi-VN')}đ)</span>
                                        )}
                                    </div>
                                </div>

                                {record.paymentStatus === 'paid' && (
                                    <>
                                        <div className="flex justify-between items-center sm:col-span-2 pt-2 border-t border-zinc-100">
                                            <span className="text-[10px] font-bold text-zinc-400 uppercase">Trạng thái</span>
                                            <Badge className="bg-emerald-500 text-[9px] font-black uppercase h-4 px-1.5 rounded-md">Đã thanh toán</Badge>
                                        </div>
                                        {record.paidAt && (
                                            <div className="flex justify-between items-center sm:col-span-2 mt-1">
                                                <span className="text-[10px] font-bold text-zinc-400 uppercase">Ngày trả</span>
                                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight">
                                                    {format((record.paidAt as Timestamp).toDate(), 'dd/MM/yyyy HH:mm')}
                                                </span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Actual Paid Input */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-1">
                                    <Label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Số tiền thực trả</Label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActualPaidNumber(finalTakeHomePay);
                                            setActualPaidInput(new Intl.NumberFormat('vi-VN').format(finalTakeHomePay));
                                        }}
                                        className="text-[10px] font-black text-primary hover:underline uppercase"
                                    >
                                        Đặt theo đề xuất
                                    </button>
                                </div>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/30 font-black text-2xl group-focus-within:text-primary transition-colors">đ</div>
                                    <Input
                                        ref={inputRef}
                                        type="text"
                                        inputMode="numeric"
                                        value={actualPaidInput}
                                        placeholder="0"
                                        className="h-20 text-4xl font-black text-right pl-12 pr-6 rounded-[2rem] bg-zinc-50 border-2 border-transparent focus-visible:bg-white focus-visible:border-primary/20 focus-visible:ring-primary/10 transition-all shadow-inner"
                                        onChange={(e) => {
                                            const raw = e.target.value || '';
                                            const digits = raw.replace(/\D/g, '');
                                            const num = digits === '' ? null : parseInt(digits, 10);
                                            setActualPaidNumber(num);
                                            setActualPaidInput(num == null ? '' : new Intl.NumberFormat('vi-VN').format(num));
                                        }}
                                        onFocus={(e) => e.currentTarget.select()}
                                    />
                                </div>
                            </div>
                        </div>

                        <AlertDialogFooter className="p-6 pt-0 gap-3">
                            <AlertDialogCancel className="h-12 flex-1 rounded-2xl bg-zinc-100 hover:bg-zinc-200 border-none text-zinc-600 font-black tracking-tight active:scale-[0.98] transition-all">Bỏ qua</AlertDialogCancel>
                            <AlertDialogAction
                                className="h-12 flex-[2] rounded-2xl bg-primary hover:bg-primary/90 text-white font-black tracking-tight shadow-xl shadow-primary/25 active:scale-[0.98] transition-all"
                                onClick={async () => {
                                    const amount = actualPaidNumber ?? (actualPaidInput ? Number(actualPaidInput.replace(/\D/g, '')) : NaN);
                                    if (isNaN(amount) || amount < 0) {
                                        toast.error('Số tiền không hợp lệ.');
                                        return;
                                    }
                                    setIsUpdatingPaymentStatus(true);
                                    const toastId = toast.loading('Đang ghi nhận...');
                                    try {
                                        await dataStore.updateSalaryPayment(monthId!, record.userId, 'paid', amount);
                                        onRecordUpdated(record.userId, { paymentStatus: 'paid', paidAt: Timestamp.now(), actualPaidAmount: amount });
                                        toast.success(`Đã tất toán cho ${record.userName}`, { id: toastId });
                                        setIsPayDialogOpen(false);
                                    } catch (error) {
                                        toast.error('Lỗi khi cập nhật thanh toán.', { id: toastId });
                                    } finally {
                                        setIsUpdatingPaymentStatus(false);
                                    }
                                }}
                            >
                                {isUpdatingPaymentStatus ? <Loader2 className="w-5 h-5 animate-spin" /> : <DollarSign className="w-5 h-5 mr-1" />}
                                Thanh toán
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        );

        if (standalone) {
            return (
                <div className="w-full">
                    {Content}
                </div>
            );
        }

        return (
            <AccordionItem ref={containerRef} value={record.userId} className="border-none mb-3">
                <AccordionTrigger className="group p-4 bg-white rounded-2xl hover:no-underline border border-zinc-100 shadow-sm transition-all hover:bg-zinc-50 data-[state=open]:rounded-b-none data-[state=open]:border-b-0">
                    <div className="flex justify-between items-center w-full">
                        <div className="flex items-center gap-3 pr-2">
                            <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center flex-shrink-0 border border-zinc-100 text-zinc-400 group-hover:bg-white transition-colors">
                                <User className="w-5 h-5" />
                            </div>
                            <div className="text-left min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-black text-zinc-900">{record.userName}</span>
                                    {record.paymentStatus === 'paid' && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{record.userRole}</span>
                                    <span className="text-[10px] text-zinc-300">•</span>
                                    <span className="text-[10px] font-bold text-zinc-500">{record.totalWorkingHours.toFixed(1)}h làm việc</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                            <span className="text-sm font-black text-zinc-900 group-data-[state=open]:text-primary transition-colors">{finalTakeHomePay.toLocaleString('vi-VN')}đ</span>
                            <div className="text-[9px] font-bold text-zinc-300 uppercase leading-none mt-1">Tổng thực nhận</div>
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="p-4 bg-white border border-zinc-100 border-t-0 rounded-b-2xl pt-2 shadow-sm">
                    {Content}
                </AccordionContent>
            </AccordionItem>
        );
    }
);

SalaryRecordAccordionItem.displayName = 'SalaryRecordAccordionItem';

const SalaryRecordSectionContent: React.FC<SalaryRecordSectionContentProps> = ({
    record,
    monthId,
    currentUser,
    currentUserRole,
    scheduleMap,
    users,
    onRecordUpdated,
    onBack,
}) => {
    // Track whether this component has ever been given a valid `record`.
    // If it had one and later the parent clears it (e.g. dialog closed / sheet unloaded),
    // navigate back to the main list so we don't render a detail view with missing props.
    const _hadRecord = React.useRef<boolean>(!!record);
    React.useEffect(() => {
        if (!_hadRecord.current && record) {
            _hadRecord.current = true;
            return;
        }
        if (_hadRecord.current && !record) {
            // record was present and became undefined — close the section
            onBack();
        }
    }, [record, onBack]);

    if (!record) {
        return (
            <div className="flex flex-col h-full bg-zinc-50">
                <DialogHeader className="flex flex-row items-center gap-2 px-4 h-14 border-b bg-white">
                    <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9 text-zinc-500">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <DialogTitle className="text-base font-bold">Không tìm thấy</DialogTitle>
                </DialogHeader>
                <div className="flex-grow flex flex-col items-center justify-center text-zinc-400 p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
                        <ArrowLeft className="w-8 h-8 opacity-20" />
                    </div>
                    <p className="font-medium">Không tìm thấy bản ghi này.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-zinc-50 overflow-hidden">
            {/* Sticky header */}
            <DialogHeader className="flex flex-row items-center justify-between border-b bg-white flex-shrink-0 shadow-sm" hideicon>
                <div className="flex items-center gap-4 min-w-0 flex-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onBack}
                        className="h-10 w-10 text-zinc-400 hover:text-primary hover:bg-primary/5 rounded-full transition-all active:scale-95 flex-shrink-0"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>

                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/10 flex-shrink-0 shadow-inner">
                            <UserAvatar
                                user={users.find((u) => u.uid === record.userId) || null}
                                size="h-5 w-5"
                                rounded="2xl"
                                className="object-cover"
                                fallbackClassName="text-[10px]"
                            />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <DialogTitle className="text-base font-black text-zinc-900 truncate leading-tight tracking-tight">
                                {generateShortName(record.userName)}
                            </DialogTitle>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <Badge variant="outline" className="bg-zinc-100/50 text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1.5 py-0 rounded-md border-none leading-none h-4">
                                    {record.userRole}
                                </Badge>
                                {record.paymentStatus === 'paid' && (
                                    <>
                                        <span className="text-zinc-300 text-[10px] leading-none">•</span>
                                        <div className="flex items-center gap-0.5 text-[9px] font-black text-emerald-500 uppercase leading-none">
                                            <CheckCircle className="w-2.5 h-2.5" />
                                            Đã thanh toán
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="hidden sm:flex flex-col items-end pl-4 flex-shrink-0 border-l border-zinc-100">
                    <span className="text-[9px] font-black text-zinc-300 uppercase tracking-tighter leading-none mb-1">Lương tháng</span>
                    <span className="text-sm font-black text-primary/80 uppercase tracking-tight leading-none">
                        {monthId.split('-')[1]} / {monthId.split('-')[0]}
                    </span>
                </div>
            </DialogHeader>
            <ScrollArea className="flex-grow min-h-0 overflow-y-auto">
                <div className="p-4 sm:p-6 space-y-6 pb-20">
                    {/* Render the embedded record component */}
                    <SalaryRecordAccordionItem
                        record={record}
                        monthId={monthId}
                        currentUser={currentUser}
                        currentUserRole={currentUserRole}
                        scheduleMap={scheduleMap}
                        onRecordUpdated={onRecordUpdated}
                        standalone={true}
                    />
                </div>
            </ScrollArea>
        </div>
    );
};

export default SalaryRecordSectionContent;
