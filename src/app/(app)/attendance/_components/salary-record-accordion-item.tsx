'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, FileX } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { dataStore } from '@/lib/data-store';
import type { SalaryRecord, AssignedUser, Schedule } from '@/lib/types';
import { findShiftForRecord, getStatusInfo } from '@/lib/attendance-utils';
import { cn } from '@/lib/utils';

type SalaryRecordAccordionItemProps = {
    record: SalaryRecord;
    monthId: string;
    currentUser: AssignedUser | null;
    currentUserRole: string | undefined;
    scheduleMap: Record<string, Schedule>;
    onRecordUpdated: (userId: string, updates: Partial<SalaryRecord>) => void;
};

const SalaryRecordAccordionItem: React.FC<SalaryRecordAccordionItemProps> = React.memo(
    ({ record, monthId, currentUser, currentUserRole, scheduleMap, onRecordUpdated }) => {
        const [localAdvanceAmount, setLocalAdvanceAmount] = useState<string>(
            record.salaryAdvance?.toString() ?? ''
        );
        const [isUpdatingAdvance, setIsUpdatingAdvance] = useState(false);
        const [isUpdatingPaymentStatus, setIsUpdatingPaymentStatus] = useState(false);

        useEffect(() => {
            // Update local state if record.salaryAdvance changes from outside (e.g., recalculate)
            setLocalAdvanceAmount(record.salaryAdvance?.toString() ?? '');
        }, [record.salaryAdvance]);

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

        const handleTogglePaymentStatus = useCallback(async () => {
            if (!currentUser || !monthId || !record.userId) return;

            const newStatus = record.paymentStatus === 'paid' ? 'unpaid' : 'paid';
            setIsUpdatingPaymentStatus(true);
            const toastId = toast.loading(`Đang cập nhật trạng thái...`);

            try {
                await dataStore.updateSalaryPaymentStatus(
                    monthId,
                    record.userId,
                    newStatus,
                );
                onRecordUpdated(record.userId, {
                    paymentStatus: newStatus,
                    paidAt: newStatus === 'paid' ? Timestamp.now() : undefined,
                });
                toast.success(
                    `Đã cập nhật lương cho ${record.userName} thành ${newStatus === 'paid' ? 'Đã trả' : 'Chưa trả'}.`,
                    { id: toastId }
                );
            } catch (error) {
                console.error('Lỗi khi cập nhật trạng thái thanh toán:', error);
                toast.error('Lỗi khi cập nhật trạng thái.', { id: toastId });
            } finally {
                setIsUpdatingPaymentStatus(false);
            }
        }, [currentUser, monthId, record.userId, record.paymentStatus, record.userName, onRecordUpdated]);

        const finalTakeHomePay = useMemo(() => {
            return record.totalSalary - (record.salaryAdvance || 0);
        }, [record.totalSalary, record.salaryAdvance]);

        return (
            <AccordionItem value={record.userId} key={record.userId}>
                <AccordionTrigger className="p-3 bg-muted/50 rounded-md hover:no-underline">
                    <div className="flex justify-between items-center w-full">
                        <div className="text-left flex-1">
                            <p className="font-semibold flex flex-wrap items-center gap-2">
                                {record.userName}
                                <Badge variant="secondary">{record.userRole}</Badge>
                                {record.paymentStatus === 'paid' && <Badge className="bg-green-100 text-green-800">Đã trả</Badge>}
                                {record.paymentStatus === 'unpaid' && <Badge variant="destructive">Chưa trả</Badge>}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Lương: <span className="font-bold text-primary">{record.totalSalary.toLocaleString('vi-VN')}đ (dự tính: {Math.round(record.totalExpectedHours * record.averageHourlyRate).toLocaleString('vi-VN')}đ) </span>
                                (<span className="font-bold text-green-600">Thực lãnh: {finalTakeHomePay.toLocaleString('vi-VN')}đ, </span>
                                <span className="text-xs">Giờ làm: {record.totalWorkingHours.toFixed(1)} / {record.totalExpectedHours.toFixed(1)} h, </span>
                                <span className="text-xs">Lương/giờ: {record.averageHourlyRate.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}đ, </span>
                                <span className="text-xs">Phạt: {record.totalUnpaidPenalties.toLocaleString('vi-VN')}đ</span>)
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                <div className="space-y-2">
                                    <Label htmlFor={`advance-${record.userId}`}>Tạm ứng</Label>
                                    <Input
                                        id={`advance-${record.userId}`}
                                        type="number"
                                        placeholder="Nhập số tiền tạm ứng"
                                        value={localAdvanceAmount}
                                        onChange={(e) => setLocalAdvanceAmount(e.target.value)}
                                        onFocus={(e) => e.target.select()}
                                    />
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button onClick={handleUpdateAdvance} disabled={isUpdatingAdvance}>
                                        {isUpdatingAdvance && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Lưu Tạm ứng
                                    </Button>
                                    <Button
                                        onClick={handleTogglePaymentStatus}
                                        variant={record.paymentStatus === 'paid' ? 'destructive' : 'default'}
                                        disabled={isUpdatingPaymentStatus}
                                    >
                                        {isUpdatingPaymentStatus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {record.paymentStatus === 'paid' ? 'Đánh dấu Chưa trả' : 'Đánh dấu Đã trả'}
                                    </Button>
                                </div>
                            </div>
                        )}
                        <h4 className="font-semibold">Chi tiết chấm công</h4>
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

                        {record.absentShifts.length > 0 && (
                            <div>
                                <h4 className="font-semibold flex items-center gap-2 text-destructive">
                                    <FileX className="h-4 w-4" /> Vắng mặt
                                </h4>
                                <ul className="list-disc list-inside text-sm text-muted-foreground">
                                    {record.absentShifts.map((shift) => (
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
                                                    <TableCell>{v.content}</TableCell>
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
                            </div>
                        )}
                    </div>
                </AccordionContent>
            </AccordionItem>
        );
    }
);

SalaryRecordAccordionItem.displayName = 'SalaryRecordAccordionItem';

export default SalaryRecordAccordionItem;