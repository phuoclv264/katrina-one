'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Wallet, TrendingUp, DollarSign, History, ShieldAlert, XCircle, Info, Calendar, User, Loader2, CheckCircle, Plus, Trash2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { PaymentConfirmationView } from './payment-confirmation-view';
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

type SalaryRecordSectionContentProps = {
    record: SalaryRecord | undefined;
    monthId: string;
    currentUser: SimpleUser | null;
    currentUserRole: string | undefined;
    scheduleMap: Record<string, Schedule>;
    users: ManagedUser[];
    onRecordUpdated: (userId: string, updates: Partial<SalaryRecord>) => void;
    onBack: () => void;
    dialogContainerRef: React.RefObject<HTMLElement | null>;
};

const SalaryRecordAccordionItem: React.FC<{
    record: SalaryRecord;
    monthId: string;
    currentUser: SimpleUser | null;
    currentUserRole: string | undefined;
    scheduleMap: Record<string, Schedule>;
    users: ManagedUser[];
    onRecordUpdated: (userId: string, updates: Partial<SalaryRecord>) => void;
    standalone?: boolean;
    dialogContainerRef: React.RefObject<HTMLElement | null>;
    onInitiatePayment?: (amount: number) => void;
}> = React.memo(
    ({ record, monthId, currentUser, currentUserRole, scheduleMap, users, onRecordUpdated, standalone = false, dialogContainerRef, onInitiatePayment }) => {
        // Advance state
        const [isAddAdvanceDialogOpen, setIsAddAdvanceDialogOpen] = useState(false);
        const [newAdvanceAmount, setNewAdvanceAmount] = useState('');
        const [newAdvanceNote, setNewAdvanceNote] = useState('');
        const [isAddingAdvance, setIsAddingAdvance] = useState(false);
        const [isDeletingAdvanceId, setIsDeletingAdvanceId] = useState<string | null>(null);

        // Bonus state
        const [isAddBonusDialogOpen, setIsAddBonusDialogOpen] = useState(false);
        const [newBonusAmount, setNewBonusAmount] = useState('');
        const [newBonusNote, setNewBonusNote] = useState('');
        const [isAddingBonus, setIsAddingBonus] = useState(false);
        const [isDeletingBonusId, setIsDeletingBonusId] = useState<string | null>(null);

        const isMobile = useIsMobile();
        const [isUpdatingPaymentStatus, setIsUpdatingPaymentStatus] = useState(false);

        const finalTakeHomePay = useMemo(() => {
            const base = Math.max(0, record.totalSalary - (record.salaryAdvance || 0) + (record.bonus || 0));
            return Math.ceil(base / 50000) * 50000;
        }, [record.totalSalary, record.salaryAdvance, record.bonus]);

        const handleAddAdvance = useCallback(async () => {
            if (!currentUser || !monthId || !record.userId) return;
            const amount = Number(newAdvanceAmount.replace(/\D/g, ''));
            if (isNaN(amount) || amount <= 0) {
                toast.error('Số tiền không hợp lệ');
                return;
            }
            if (!newAdvanceNote.trim()) {
                toast.error('Vui lòng nhập lý do tạm ứng');
                return;
            }

            setIsAddingAdvance(true);
            const toastId = toast.loading('Đang thêm khoản tạm ứng...');
            try {
                const newAdvanceId = await dataStore.addSalaryAdvance(monthId, record.userId, amount, newAdvanceNote, currentUser);

                const newAdvance = {
                    id: newAdvanceId,
                    amount,
                    note: newAdvanceNote,
                    createdBy: currentUser,
                    createdAt: new Date().toISOString()
                };
                const updatedAdvances = [...(record.advances || []), newAdvance];
                const updatedTotal = (record.salaryAdvance || 0) + amount;

                onRecordUpdated(record.userId, { salaryAdvance: updatedTotal, advances: updatedAdvances });

                setNewAdvanceAmount('');
                setNewAdvanceNote('');
                setIsAddAdvanceDialogOpen(false);
                toast.success('Đã thêm khoản tạm ứng', { id: toastId });
            } catch (error) {
                toast.error('Lỗi khi thêm khoản tạm ứng', { id: toastId });
                console.error(error);
            } finally {
                setIsAddingAdvance(false);
            }
        }, [currentUser, monthId, record.userId, newAdvanceAmount, newAdvanceNote, record.advances, record.salaryAdvance, onRecordUpdated]);

        const handleDeleteAdvance = useCallback(async (advanceId: string, amount: number) => {
            if (!monthId || !record.userId) return;

            setIsDeletingAdvanceId(advanceId);
            const toastId = toast.loading('Đang xóa khoản tạm ứng...');
            try {
                await dataStore.deleteSalaryAdvance(monthId, record.userId, advanceId);

                const updatedAdvances = (record.advances || []).filter(a => a.id !== advanceId);
                const updatedTotal = (record.salaryAdvance || 0) - amount;

                onRecordUpdated(record.userId, { salaryAdvance: updatedTotal, advances: updatedAdvances });
                toast.success('Đã xóa khoản tạm ứng', { id: toastId });
            } catch (error) {
                toast.error('Lỗi khi xóa khoản tạm ứng', { id: toastId });
            } finally {
                setIsDeletingAdvanceId(null);
            }
        }, [monthId, record.userId, record.advances, record.salaryAdvance, onRecordUpdated]);

        const handleAddBonus = useCallback(async () => {
            if (!currentUser || !monthId || !record.userId) return;
            const amount = Number(newBonusAmount.replace(/\D/g, ''));
            if (isNaN(amount) || amount <= 0) {
                toast.error('Số tiền không hợp lệ');
                return;
            }
            if (!newBonusNote.trim()) {
                toast.error('Vui lòng nhập lý do thưởng');
                return;
            }

            setIsAddingBonus(true);
            const toastId = toast.loading('Đang thêm khoản thưởng...');
            try {
                const newBonusId = await dataStore.addSalaryBonus(monthId, record.userId, amount, newBonusNote, currentUser);

                const newBonus = {
                    id: newBonusId,
                    amount,
                    note: newBonusNote,
                    createdBy: currentUser,
                    createdAt: new Date().toISOString()
                };
                const updatedBonuses = [...(record.bonuses || []), newBonus];
                const updatedTotal = (record.bonus || 0) + amount;

                onRecordUpdated(record.userId, { bonus: updatedTotal, bonuses: updatedBonuses });

                setNewBonusAmount('');
                setNewBonusNote('');
                setIsAddBonusDialogOpen(false);
                toast.success('Đã thêm khoản thưởng', { id: toastId });
            } catch (error) {
                toast.error('Lỗi khi thêm khoản thưởng', { id: toastId });
                console.error(error);
            } finally {
                setIsAddingBonus(false);
            }
        }, [currentUser, monthId, record.userId, newBonusAmount, newBonusNote, record.bonuses, record.bonus, onRecordUpdated]);

        const handleDeleteBonus = useCallback(async (bonusId: string, amount: number) => {
            if (!monthId || !record.userId) return;

            setIsDeletingBonusId(bonusId);
            const toastId = toast.loading('Đang xóa khoản thưởng...');
            try {
                await dataStore.deleteSalaryBonus(monthId, record.userId, bonusId);

                const updatedBonuses = (record.bonuses || []).filter(b => b.id !== bonusId);
                const updatedTotal = (record.bonus || 0) - amount;

                onRecordUpdated(record.userId, { bonus: updatedTotal, bonuses: updatedBonuses });
                toast.success('Đã xóa khoản thưởng', { id: toastId });
            } catch (error) {
                toast.error('Lỗi khi xóa khoản thưởng', { id: toastId });
            } finally {
                setIsDeletingBonusId(null);
            }
        }, [monthId, record.userId, record.bonuses, record.bonus, onRecordUpdated]);

        const handleTogglePaymentStatus = useCallback(async () => {
            if (!currentUser || !monthId || !record.userId) return;
            const newStatus = record.paymentStatus === 'paid' ? 'unpaid' : 'paid';
            if (newStatus === 'paid') {
                const baseAmount = Math.max(0, record.totalSalary - (record.salaryAdvance || 0) + (record.bonus || 0));
                const roundedSuggested = Math.ceil(baseAmount / 50000) * 50000;
                
                if (onInitiatePayment) {
                    onInitiatePayment(roundedSuggested);
                    return;
                }
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
        }, [currentUser, monthId, record.userId, record.paymentStatus, record.totalSalary, record.salaryAdvance, record.bonus, onInitiatePayment, onRecordUpdated]);

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
                {(currentUserRole === 'Chủ nhà hàng' || currentUserRole === 'Quản lý') && (
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                        <div className="sm:col-span-8 grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Tạm ứng</Label>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between bg-white border border-zinc-100 rounded-xl px-3 py-2 shadow-sm">
                                        <span className="font-bold text-amber-500">{(record.salaryAdvance || 0).toLocaleString('vi-VN')}đ</span>
                                        <Popover open={isAddAdvanceDialogOpen} onOpenChange={setIsAddAdvanceDialogOpen}>
                                            <PopoverTrigger asChild>
                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-full hover:bg-amber-50 text-amber-500">
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-80 p-4 space-y-4" align="end" container={dialogContainerRef.current}>
                                                <h4 className="font-medium leading-none">Thêm khoản tạm ứng</h4>
                                                <div className="space-y-3">
                                                    <div className="space-y-1">
                                                        <Label htmlFor="advance-amount">Số tiền</Label>
                                                        <Input
                                                            id="advance-amount"
                                                            placeholder="0"
                                                            className="h-9"
                                                            value={newAdvanceAmount}
                                                            onChange={(e) => {
                                                                const val = e.target.value.replace(/\D/g, '');
                                                                setNewAdvanceAmount(val ? Number(val).toLocaleString('vi-VN') : '');
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label htmlFor="advance-note">Lý do</Label>
                                                        <Textarea
                                                            id="advance-note"
                                                            placeholder="VD: Ứng lương..."
                                                            className="h-20 resize-none"
                                                            value={newAdvanceNote}
                                                            onChange={(e) => setNewAdvanceNote(e.target.value)}
                                                        />
                                                    </div>
                                                    <Button onClick={handleAddAdvance} disabled={isAddingAdvance} className="w-full bg-amber-500 hover:bg-amber-600 text-white">
                                                        {isAddingAdvance ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Thêm'}
                                                    </Button>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    {/* Advance List */}
                                    {record.advances && record.advances.length > 0 && (
                                        <div className="space-y-1.5">
                                            {record.advances.map(advance => (
                                                <div key={advance.id} className="flex items-start justify-between bg-amber-50/30 border border-amber-100 rounded-lg p-2 text-xs">
                                                    <div className="space-y-0.5 min-w-0">
                                                        <div className="font-bold text-amber-600">{advance.amount.toLocaleString('vi-VN')}đ</div>
                                                        <div className="text-zinc-600 break-words">{advance.note}</div>
                                                        <div className="text-[9px] text-zinc-400 mt-1">
                                                            {format(new Date(advance.createdAt as string), 'dd/MM HH:mm')} • {advance.createdBy?.userName}
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-zinc-400 hover:text-red-500 hover:bg-red-50 -mr-1 flex-shrink-0"
                                                        onClick={() => handleDeleteAdvance(advance.id, advance.amount)}
                                                        disabled={isDeletingAdvanceId === advance.id}
                                                    >
                                                        {isDeletingAdvanceId === advance.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Khen thưởng</Label>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between bg-white border border-zinc-100 rounded-xl px-3 py-2 shadow-sm">
                                        <span className="font-bold text-emerald-600">{(record.bonus || 0).toLocaleString('vi-VN')}đ</span>
                                        <Popover open={isAddBonusDialogOpen} onOpenChange={setIsAddBonusDialogOpen}>
                                            <PopoverTrigger asChild>
                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-full hover:bg-emerald-50 text-emerald-600">
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-80 p-4 space-y-4" align="end" container={dialogContainerRef.current}>
                                                <h4 className="font-medium leading-none">Thêm khoản thưởng</h4>
                                                <div className="space-y-3">
                                                    <div className="space-y-1">
                                                        <Label htmlFor="amount">Số tiền</Label>
                                                        <Input
                                                            id="amount"
                                                            placeholder="0"
                                                            className="h-9"
                                                            value={newBonusAmount}
                                                            onChange={(e) => {
                                                                const val = e.target.value.replace(/\D/g, '');
                                                                setNewBonusAmount(val ? Number(val).toLocaleString('vi-VN') : '');
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label htmlFor="note">Lý do</Label>
                                                        <Textarea
                                                            id="note"
                                                            placeholder="VD: Thưởng doanh số..."
                                                            className="h-20 resize-none"
                                                            value={newBonusNote}
                                                            onChange={(e) => setNewBonusNote(e.target.value)}
                                                        />
                                                    </div>
                                                    <Button onClick={handleAddBonus} disabled={isAddingBonus} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                                                        {isAddingBonus ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Thêm'}
                                                    </Button>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    {/* Bonus List */}
                                    {record.bonuses && record.bonuses.length > 0 && (
                                        <div className="space-y-1.5">
                                            {record.bonuses.map(bonus => (
                                                <div key={bonus.id} className="flex items-start justify-between bg-emerald-50/30 border border-emerald-100 rounded-lg p-2 text-xs">
                                                    <div className="space-y-0.5 min-w-0">
                                                        <div className="font-bold text-emerald-700">{bonus.amount.toLocaleString('vi-VN')}đ</div>
                                                        <div className="text-zinc-600 break-words">{bonus.note}</div>
                                                        <div className="text-[9px] text-zinc-400 mt-1">
                                                            {format(new Date(bonus.createdAt as string), 'dd/MM HH:mm')} • {bonus.createdBy?.userName}
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-zinc-400 hover:text-red-500 hover:bg-red-50 -mr-1 flex-shrink-0"
                                                        onClick={() => handleDeleteBonus(bonus.id, bonus.amount)}
                                                        disabled={isDeletingBonusId === bonus.id}
                                                    >
                                                        {isDeletingBonusId === bonus.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
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
            <AccordionItem value={record.userId} className="border-none mb-3">
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
    dialogContainerRef,
}) => {
    const [isPaymentMode, setIsPaymentMode] = useState(false);

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

    const violationPenaltyTotals = useMemo(() => {
        if (!record) return { paid: 0, unpaid: 0 };
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
    }, [record]);

    const totalPenalty = violationPenaltyTotals.paid + violationPenaltyTotals.unpaid;

    const finalTakeHomePay = useMemo(() => {
        if (!record) return 0;
        const base = Math.max(0, record.totalSalary - (record.salaryAdvance || 0) + (record.bonus || 0));
        return Math.ceil(base / 50000) * 50000;
    }, [record]);

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
        <div className="flex flex-col h-full bg-zinc-50 overflow-hidden relative">
            {isPaymentMode ? (
                <PaymentConfirmationView
                    record={record}
                    monthId={monthId}
                    currentUser={currentUser}
                    currentUserRole={currentUserRole}
                    users={users}
                    onRecordUpdated={onRecordUpdated}
                    onCancel={() => {
                        setIsPaymentMode(false);
                        onBack();
                    }}
                    finalTakeHomePay={finalTakeHomePay}
                    violationPenaltyTotals={violationPenaltyTotals}
                    totalPenalty={totalPenalty}
                />
            ) : (
                <>
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
                                users={users}
                                onRecordUpdated={onRecordUpdated}
                                standalone={true}
                                dialogContainerRef={dialogContainerRef}
                                onInitiatePayment={() => setIsPaymentMode(true)}
                            />
                        </div>
                    </ScrollArea>
                </>
            )}
        </div>
    );
};

export default SalaryRecordSectionContent;
