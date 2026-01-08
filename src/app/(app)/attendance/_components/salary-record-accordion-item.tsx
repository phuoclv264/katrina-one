'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, FileX } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { toast } from '@/components/ui/pro-toast';
import { dataStore } from '@/lib/data-store';
import type { SalaryRecord, SimpleUser, Schedule } from '@/lib/types';
import { findShiftForRecord, getStatusInfo } from '@/lib/attendance-utils';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

type SalaryRecordAccordionItemProps = {
    record: SalaryRecord;
    monthId: string;
    currentUser: SimpleUser | null;
    currentUserRole: string | undefined;
    scheduleMap: Record<string, Schedule>;
    onRecordUpdated: (userId: string, updates: Partial<SalaryRecord>) => void;
};

const SalaryRecordAccordionItem: React.FC<SalaryRecordAccordionItemProps> = React.memo(
    ({ record, monthId, currentUser, currentUserRole, scheduleMap, onRecordUpdated }) => {
        const [localAdvanceAmount, setLocalAdvanceAmount] = useState<string>(
            record.salaryAdvance?.toString() ?? ''
        );
        // Container ref to mount the alert dialog portal inside the accordion item to preserve stacking/context
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
        // Numeric value (used for submit) kept separate from the formatted display
        const [actualPaidNumber, setActualPaidNumber] = useState<number | null>(null);
        // Ref for the payment input so we can focus it when the dialog opens
        const inputRef = useRef<HTMLInputElement | null>(null);

        useEffect(() => {
            if (!isPayDialogOpen) return;
            // Delay focus slightly to ensure the portal/content is mounted
            const id = window.setTimeout(() => inputRef.current?.focus(), 0);
            return () => clearTimeout(id);
        }, [isPayDialogOpen]);

        useEffect(() => {
            // Update local state if record.salaryAdvance changes from outside (e.g., recalculate)
            setLocalAdvanceAmount(record.salaryAdvance?.toString() ?? '');
            // Update local state for bonus
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
                console.error('Lỗi khi cập nhật tạm ứng:', error);
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
                console.error('Lỗi khi cập nhật thưởng:', error);
                toast.error('Lỗi khi cập nhật tiền thưởng.', { id: toastId });
            } finally {
                setIsUpdatingBonus(false);
            }
        }, [monthId, record.userId, localBonusAmount, onRecordUpdated]);

        const handleTogglePaymentStatus = useCallback(async () => {
            if (!currentUser || !monthId || !record.userId) return;

            const newStatus = record.paymentStatus === 'paid' ? 'unpaid' : 'paid';
            if (newStatus === 'paid') {
                const defaultAmount = Math.max(0, record.totalSalary - (record.salaryAdvance || 0) + (record.bonus || 0));
                setActualPaidNumber(defaultAmount);
                setActualPaidInput(new Intl.NumberFormat('vi-VN').format(defaultAmount));
                setIsPayDialogOpen(true);
                return;
            }
                setIsUpdatingPaymentStatus(true);
            const toastId = toast.loading('Đang cập nhật trạng thái...');
            try {
                await dataStore.updateSalaryPayment(monthId, record.userId, newStatus);
                onRecordUpdated(record.userId, { paymentStatus: newStatus, paidAt: undefined });
                toast.success(`Đã cập nhật lương cho ${record.userName} thành Chưa trả.`, { id: toastId });
            } catch (error) {
                toast.error('Lỗi khi cập nhật trạng thái.', { id: toastId });
            } finally {
                setIsUpdatingPaymentStatus(false);
            }
        }, [currentUser, monthId, record.userId, record.paymentStatus, record.userName, onRecordUpdated]);

        const finalTakeHomePay = useMemo(() => {
            return record.totalSalary - (record.salaryAdvance || 0) + (record.bonus || 0);
        }, [record.totalSalary, record.salaryAdvance, record.bonus]);

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

        return (
            <AccordionItem ref={containerRef} value={record.userId} key={record.userId}>
                <AccordionTrigger className="p-4 bg-muted/30 rounded-lg hover:no-underline border shadow-sm">
                    <div className="flex justify-between items-center w-full">
                        <div className="text-left flex-1">
                            <p className="font-semibold flex flex-wrap items-center gap-2">
                                {record.userName}
                                <Badge variant="secondary">{record.userRole}</Badge>
                                {record.paymentStatus === 'paid' && <Badge className="bg-green-100 text-green-800">Đã trả</Badge>}
                                {record.paymentStatus === 'unpaid' && <Badge variant="destructive">Chưa trả</Badge>}
                                {record.paymentStatus === 'paid' && typeof record.actualPaidAmount === 'number' && (
                                    <Badge variant="outline" className="border-blue-300 text-blue-700">Thực trả: {record.actualPaidAmount.toLocaleString('vi-VN')}đ</Badge>
                                )}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Lương: <span className="font-bold text-primary">{record.totalSalary.toLocaleString('vi-VN')}đ (dự tính: {Math.round(record.totalExpectedHours * record.averageHourlyRate).toLocaleString('vi-VN')}đ) </span>
                                (<span className="font-bold text-green-600">Thực lãnh: {finalTakeHomePay.toLocaleString('vi-VN')}đ</span>
                                <span className="text-xs">, Tạm ứng: {(record.salaryAdvance || 0).toLocaleString('vi-VN')}đ, Thưởng: {(record.bonus || 0).toLocaleString('vi-VN')}đ, </span>
                                <span className="text-xs">Giờ làm: {record.totalWorkingHours.toFixed(1)} / {record.totalExpectedHours.toFixed(1)} h, </span>
                                <span className="text-xs">Lương/giờ: {record.averageHourlyRate.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}đ, </span>
                                <span className="text-xs">Phạt: {record.totalUnpaidPenalties.toLocaleString('vi-VN')}đ</span>)
                                {record.paymentStatus === 'paid' && typeof record.actualPaidAmount === 'number' && (
                                    <span className="text-xs"> — <span className="font-semibold text-blue-700">Đã trả: {record.actualPaidAmount.toLocaleString('vi-VN')}đ</span></span>
                                )}
                            </p>
                        </div>
                        {/* <div className="text-right text-xs text-muted-foreground hidden sm:block">
                            <p>Giờ làm: {record.totalWorkingHours.toFixed(1)} / {record.totalExpectedHours.toFixed(1)} h</p>
                            <p>Lương/giờ: {record.averageHourlyRate.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}đ</p>
                            <p>Phạt: {record.totalUnpaidPenalties.toLocaleString('vi-VN')}đ</p>
                        </div> */}
                    </div>
                </AccordionTrigger>
                <AccordionContent className="p-4 border rounded-b-md">
                    <div className="space-y-4">
                        {currentUserRole === 'Chủ nhà hàng' && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor={`advance-${record.userId}`}>Tạm ứng</Label>
                                        <div className="flex items-center gap-2">
                                            <Input id={`advance-${record.userId}`} type="number" placeholder="Nhập số tiền" value={localAdvanceAmount} onChange={(e) => setLocalAdvanceAmount(e.target.value)} onFocus={(e) => e.target.select()} />
                                            <Button size="sm" onClick={handleUpdateAdvance} disabled={isUpdatingAdvance}>
                                                {isUpdatingAdvance ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lưu'}
                                            </Button>
                                        </div>
                                    </div>
                                     <div className="space-y-2">
                                        <Label htmlFor={`bonus-${record.userId}`}>Thưởng</Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                id={`bonus-${record.userId}`}
                                                type="number"
                                                placeholder="Nhập số tiền"
                                                value={localBonusAmount}
                                                onChange={(e) => setLocalBonusAmount(e.target.value)}
                                                onFocus={(e) => e.target.select()}
                                            />
                                            <Button size="sm" onClick={handleUpdateBonus} disabled={isUpdatingBonus}>
                                                {isUpdatingBonus ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lưu'}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <Button
                                        onClick={handleTogglePaymentStatus}
                                        variant={record.paymentStatus === 'paid' ? 'destructive' : 'default'}
                                        disabled={isUpdatingPaymentStatus}
                                        className="w-full sm:w-auto"
                                    >
                                        {isUpdatingPaymentStatus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {record.paymentStatus === 'paid' ? 'Đánh dấu Chưa trả' : 'Đánh dấu Đã trả'}
                                    </Button>
                                </div>
                            </div>
                        )}
                        <h4 className="font-semibold">Chi tiết chấm công</h4>
                        {isMobile ? (
                            <div className="space-y-2">
                                {record.attendanceRecords.map((att) => {
                                    const shifts = findShiftForRecord(att, scheduleMap);
                                    const statusInfo = getStatusInfo(att, shifts);
                                    return (
                                        <Card key={att.id} className="bg-background">
                                            <CardContent className="p-3 text-sm space-y-1">
                                                <div className="flex justify-between items-center font-semibold">
                                                    <p>Ngày {format((att.checkInTime as Timestamp).toDate(), 'dd/MM')}</p>
                                                    <p>{att.salary?.toLocaleString('vi-VN')}đ</p>
                                                </div>
                                                <div className="flex justify-between text-muted-foreground">
                                                    <span>Ca làm:</span>
                                                    <span>{shifts.map((s) => s.label).join(', ') || <Badge variant="outline" className="text-xs">Ngoài giờ</Badge>}</span>
                                                </div>
                                                <div className="flex justify-between text-muted-foreground">
                                                    <span>Giờ vào - ra:</span>
                                                    <span>{format((att.checkInTime as Timestamp).toDate(), 'HH:mm')} - {att.checkOutTime ? format((att.checkOutTime as Timestamp).toDate(), 'HH:mm') : '...'}</span>
                                                </div>
                                                <div className="flex justify-between text-muted-foreground">
                                                    <span>Tổng giờ:</span>
                                                    <span>{att.totalHours?.toFixed(2)} giờ</span>
                                                </div>
                                                <div className="flex justify-between items-center text-muted-foreground">
                                                    <span>Trạng thái:</span>
                                                    <span className={cn('text-xs font-medium', statusInfo.color)}>{statusInfo.text}</span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Ngày</TableHead>
                                        <TableHead>Ca làm</TableHead>
                                        <TableHead>Giờ vào - ra</TableHead>
                                        <TableHead>Trạng thái</TableHead>
                                        <TableHead>Tổng giờ</TableHead>
                                        <TableHead className="text-right">Lương</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {record.attendanceRecords.map((att) => {
                                        const shifts = findShiftForRecord(att, scheduleMap);
                                        const statusInfo = getStatusInfo(att, shifts);
                                        return (
                                            <TableRow key={att.id}>
                                                <TableCell>{format((att.checkInTime as Timestamp).toDate(), 'dd/MM')}</TableCell>
                                                <TableCell>
                                                    {shifts.map((s) => s.label).join(', ') || <Badge variant="outline">Ngoài giờ</Badge>}
                                                </TableCell>
                                                <TableCell>
                                                    {format((att.checkInTime as Timestamp).toDate(), 'HH:mm')} -{' '}
                                                    {att.checkOutTime ? format((att.checkOutTime as Timestamp).toDate(), 'HH:mm') : 'N/A'}
                                                </TableCell>
                                                <TableCell className={cn('text-xs', statusInfo.color)}>{statusInfo.text}</TableCell>
                                                <TableCell>{att.totalHours?.toFixed(2)}</TableCell>
                                                <TableCell className="text-right">{att.salary?.toLocaleString('vi-VN')}đ</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}

                        {record.absentShifts.length > 0 && (
                            <div>
                                <h4 className="font-semibold flex items-center gap-2 text-destructive">
                                    <FileX className="h-4 w-4" /> Vắng mặt
                                </h4>
                                <ul className="list-disc list-inside text-sm text-muted-foreground">
                                    {record.absentShifts.filter((shift) => {
                                        const shiftEnd = parseISO(`${shift.date}T${shift.timeSlot.end}`);
                                        //compare shift end time with current time
                                        return shiftEnd.getTime() < Date.now();
                                    }).map((shift) => (
                                        <li key={shift.id}>
                                            {format(parseISO(shift.date), 'dd/MM')} - Ca {shift.label} ({shift.timeSlot.start}-{shift.timeSlot.end})
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {record.violationRecords.length > 0 && (
                            <div>
                                <h4 className="font-semibold flex items-center gap-2 text-amber-600">
                                    <AlertTriangle className="h-4 w-4" /> Vi phạm
                                </h4>
                                {isMobile ? (
                                    <div className="space-y-2">
                                        {record.violationRecords.map((v) => {
                                            const isPaid = v.isPenaltyWaived || v.penaltySubmissions?.some((ps) => ps.userId === record.userId) || v.penaltyPhotos;
                                            const userCost = v.userCosts?.find((uc) => uc.userId === record.userId)?.cost || 0;
                                            return (
                                                <Card key={v.id} className="bg-background">
                                                    <CardContent className="p-3 text-sm space-y-1">
                                                        <div className="flex justify-between items-start">
                                                            <p className="font-semibold pr-2">{v.categoryName} - {v.content}</p>
                                                            <p className="font-bold text-destructive whitespace-nowrap">{userCost.toLocaleString('vi-VN')}đ</p>
                                                        </div>
                                                        <div className="flex justify-between text-muted-foreground">
                                                            <span>Ngày: {format((v.createdAt as Timestamp).toDate(), 'dd/MM')}</span>
                                                            <Badge variant={(isPaid || userCost === 0) ? 'default' : 'destructive'}>
                                                                {v.isPenaltyWaived ? 'Đã miễn' : (isPaid || userCost === 0) ? 'Đã nộp' : 'Chưa nộp'}
                                                            </Badge>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Ngày</TableHead>
                                                <TableHead>Nội dung</TableHead>
                                                <TableHead>Trạng thái</TableHead>
                                                <TableHead className="text-right">Tiền phạt</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {record.violationRecords.map((v) => {
                                                const isPaid = v.isPenaltyWaived || v.penaltySubmissions?.some((ps) => ps.userId === record.userId) || v.penaltyPhotos;
                                                const userCost = v.userCosts?.find((uc) => uc.userId === record.userId)?.cost || 0;
                                                return (
                                                    <TableRow key={v.id}>
                                                        <TableCell>{format((v.createdAt as Timestamp).toDate(), 'dd/MM')}</TableCell>
                                                        <TableCell>{v.categoryName} - {v.content}</TableCell>
                                                        <TableCell>
                                                            <Badge variant={(isPaid || userCost === 0) ? 'default' : 'destructive'}>
                                                                {v.isPenaltyWaived ? 'Đã miễn' : (isPaid || userCost === 0) ? 'Đã nộp' : 'Chưa nộp'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right">{userCost.toLocaleString('vi-VN')}đ</TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                )}
                            </div>
                        )}
                    </div>
                </AccordionContent>
                <AlertDialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Xác nhận trả lương</AlertDialogTitle>
                            <AlertDialogDescription>
                                Số tiền đề xuất: {finalTakeHomePay.toLocaleString('vi-VN')}đ. Nhập số tiền thực trả:
                            </AlertDialogDescription>
                        </AlertDialogHeader>

                        {/* Staff quick info */}
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                            <div className="flex justify-between"><span className="font-medium">Tên</span><span className="text-lg font-semibold text-primary">{record.userName}</span></div>
                            <div className="flex justify-between"><span className="font-medium">Vai trò</span><span>{record.userRole}</span></div>
                            <div className="flex justify-between"><span className="font-medium">Tổng lương</span><span>{record.totalSalary.toLocaleString('vi-VN')}đ</span></div>
                            <div className="flex justify-between"><span className="font-medium">Giờ làm</span><span>{record.totalWorkingHours.toFixed(1)} / {record.totalExpectedHours.toFixed(1)} h</span></div>
                            <div className="flex justify-between"><span className="font-medium">Lương/giờ</span><span>{record.averageHourlyRate.toLocaleString('vi-VN')}đ</span></div>
                            <div className="flex justify-between"><span className="font-medium">Tạm ứng</span><span>{(record.salaryAdvance || 0).toLocaleString('vi-VN')}đ</span></div>
                            <div className="flex justify-between"><span className="font-medium">Thưởng</span><span>{(record.bonus || 0).toLocaleString('vi-VN')}đ</span></div>
                            <div className="flex justify-between items-center">
                                <span className="font-medium">Tổng phạt</span>
                                <span>
                                    {totalPenalty.toLocaleString('vi-VN')}đ
                                    <span className="text-sm text-muted-foreground ml-2">(
                                        <span>chưa nộp: </span>
                                        <span className={cn(violationPenaltyTotals.unpaid > 0 ? 'text-destructive font-semibold' : 'text-muted-foreground')}>
                                            {violationPenaltyTotals.unpaid.toLocaleString('vi-VN')}đ
                                        </span>
                                    )</span>
                                </span>
                            </div>
                            {record.paymentStatus && <div className="flex justify-between"><span className="font-medium">Trạng thái</span><span>{record.paymentStatus === 'paid' ? 'Đã trả' : 'Chưa trả'}</span></div>}
                            {record.paidAt && <div className="flex justify-between"><span className="font-medium">Ngày trả</span><span>{format((record.paidAt as Timestamp).toDate(), 'dd/MM/yyyy HH:mm')}</span></div>}
                        </div>

                        <div className="mt-2">
                            <div className="flex items-center gap-3">
                                <Input
                                    ref={inputRef}
                                    type="text"
                                    inputMode="numeric"
                                    value={actualPaidInput}
                                    placeholder="0"
                                    aria-label="Số tiền thực trả (VND)"
                                    onChange={(e) => {
                                        const raw = e.target.value || '';
                                        // Keep only digits (VND uses whole numbers)
                                        const digits = raw.replace(/\D/g, '');
                                        const num = digits === '' ? null : parseInt(digits, 10);
                                        setActualPaidNumber(num);
                                        setActualPaidInput(num == null ? '' : new Intl.NumberFormat('vi-VN').format(num));
                                    }}
                                    onFocus={(e) => e.currentTarget.select()}
                                    className="text-2xl sm:text-3xl font-semibold text-right text-primary border border-primary/10 p-3 rounded-md w-full"
                                />
                                <span className="text-lg font-semibold">đ</span>
                            </div>
                        </div> 
                        <AlertDialogFooter>
                            <AlertDialogCancel>Hủy</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={async () => {
                                    const amount = actualPaidNumber ?? (actualPaidInput ? Number(actualPaidInput.replace(/\D/g, '')) : NaN);
                                    if (isNaN(amount) || amount < 0) {
                                        toast.error('Số tiền không hợp lệ.');
                                        return;
                                    }
                                    setIsUpdatingPaymentStatus(true);
                                    const toastId = toast.loading('Đang cập nhật thanh toán...');
                                    try {
                                        await dataStore.updateSalaryPayment(monthId!, record.userId, 'paid', amount);
                                        onRecordUpdated(record.userId, { paymentStatus: 'paid', paidAt: Timestamp.now(), actualPaidAmount: amount });
                                        toast.success(`Đã đánh dấu trả lương cho ${record.userName}.`, { id: toastId });
                                        setIsPayDialogOpen(false);
                                    } catch (error) {
                                        toast.error('Lỗi khi cập nhật thanh toán.', { id: toastId });
                                    } finally {
                                        setIsUpdatingPaymentStatus(false);
                                    }
                                }}
                            >
                                Xác nhận
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </AccordionItem>
        );
    }
);

SalaryRecordAccordionItem.displayName = 'SalaryRecordAccordionItem';

export default SalaryRecordAccordionItem;
