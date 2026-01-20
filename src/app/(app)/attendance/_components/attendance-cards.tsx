'use client';
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AttendanceRecord, ManagedUser, Schedule, AssignedShift } from '@/lib/types';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn, getInitials } from '@/lib/utils';
import Image from 'next/image';
import { getStatusInfo, findShiftForRecord } from '@/lib/attendance-utils';
import { Edit2, MoreVertical, Trash2, AlertCircle, DollarSign } from 'lucide-react';
import HourlyRateDialog from './hourly-rate-dialog';
import { dataStore } from '@/lib/data-store';
import { toast } from '@/components/ui/pro-toast';
import type { Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
    AlertDialogIcon
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function AttendanceCards({
    records,
    users,
    schedules,
    onEdit,
    onDelete,
    onOpenLightbox,
}: {
    records: AttendanceRecord[];
    users: ManagedUser[];
    schedules: Record<string, Schedule>;
    onEdit: (record: AttendanceRecord) => void;
    onDelete: (id: string) => void;
    onOpenLightbox: (slides: { src: string, description?: string }[], index: number) => void;
}) {
    const [recordToEditRate, setRecordToEditRate] = useState<AttendanceRecord | null>(null);
    const [isRateDialogOpen, setIsRateDialogOpen] = useState(false);

    const handleEditRate = (record: AttendanceRecord) => {
        setRecordToEditRate(record);
        setIsRateDialogOpen(true);
    };

    const handleSaveRate = async (recordId: string, newRate: number) => {
        if (recordToEditRate) {
            try {
                await dataStore.updateAttendanceRecordRate(recordId, newRate);
                toast.success(`Đã cập nhật lương cho bản ghi.`);
            } catch {
                toast.error('Không thể cập nhật lương cho bản ghi.');
            }
        }
    };

    const sortedRecords = [...records].sort((a, b) => (b.checkInTime as Timestamp).toMillis() - (a.checkInTime as Timestamp).toMillis());

    if (records.length === 0) {
        return <div className="text-center py-10 text-muted-foreground">Không có dữ liệu chấm công cho tháng này.</div>;
    }

    return (
        <>
            <div className="space-y-4">
                {sortedRecords.map(record => {
                    const user = users.find(u => u.uid === record.userId);
                    const shifts = findShiftForRecord(record, schedules);
                    const statusInfo = getStatusInfo(record, shifts);

                    const allRecordPhotos = [
                        ...(record.photoInUrl ? [{
                            src: record.photoInUrl,
                            description: `Ảnh vào ca của ${user?.displayName} lúc ${format((record.checkInTime as Timestamp).toDate(), 'HH:mm dd/MM/yy')}`
                        }] : []),
                        ...(record.breaks?.flatMap(b => [
                            ...(b.breakStartPhotoUrl ? [{ src: b.breakStartPhotoUrl, description: `Ảnh bắt đầu nghỉ của ${user?.displayName} lúc ${format((b.breakStartTime as Timestamp).toDate(), 'HH:mm dd/MM/yy')}` }] : []),
                            ...(b.breakEndPhotoUrl ? [{ src: b.breakEndPhotoUrl, description: `Ảnh kết thúc nghỉ của ${user?.displayName} lúc ${format((b.breakEndTime as Timestamp).toDate(), 'HH:mm dd/MM/yy')}` }] : [])
                        ]) || []),
                        ...(record.photoOutUrl ? [{
                            src: record.photoOutUrl,
                            description: `Ảnh ra ca của ${user?.displayName} lúc ${format((record.checkOutTime as Timestamp).toDate(), 'HH:mm dd/MM/yy')}`
                        }] : [])
                    ];

                    const openLightboxForRecord = (photoSrc: string) => {
                        const photoIndex = allRecordPhotos.findIndex(p => p.src === photoSrc);
                        onOpenLightbox(allRecordPhotos, photoIndex >= 0 ? photoIndex : 0);
                    };

                    return (
                        <Card key={record.id}>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10 border border-border">
                                            <AvatarImage src={user?.photoURL || ''} />
                                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                                {getInitials(user?.displayName)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <CardTitle className="text-base">{user?.displayName || 'Không rõ'}</CardTitle>
                                            <div className="text-xs text-muted-foreground flex items-center">
                                                {user?.role}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <div className={cn("text-sm font-semibold flex items-center gap-1", statusInfo.color)}>
                                            {statusInfo.icon}
                                            {statusInfo.text}
                                        </div>
                                        <AlertDialog dialogTag="alert-dialog" parentDialogTag="root" variant="destructive">
                                            <DropdownMenu modal={false}>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuItem onSelect={() => onEdit(record)}><Edit2 className="mr-2 h-4 w-4" /> Chỉnh sửa</DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => handleEditRate(record)}><DollarSign className="mr-2 h-4 w-4" /> Chỉnh sửa lương</DropdownMenuItem>
                                                    <AlertDialogTrigger asChild>
                                                        <DropdownMenuItem className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Xóa</DropdownMenuItem>
                                                    </AlertDialogTrigger>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogIcon icon={Trash2} />
                                                    <div className="space-y-2 text-center sm:text-left">
                                                        <AlertDialogTitle>Xác nhận xóa?</AlertDialogTitle>
                                                        <AlertDialogDescription>Hành động này không thể hoàn tác. Bạn có chắc chắn muốn xóa bản ghi chấm công này không?</AlertDialogDescription>
                                                    </div>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(record.id)}>Xóa</AlertDialogAction></AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="text-sm space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Ngày</span>
                                    <span>{format(new Date((record.checkInTime as Timestamp).seconds * 1000), 'dd/MM/yyyy', { locale: vi })}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Ca</span>
                                    <span>{shifts.map(s => `${s.label} (${s.timeSlot.start}-${s.timeSlot.end})`).join(', ')}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Giờ vào/ra</span>
                                    <span>{format(new Date((record.checkInTime as Timestamp).seconds * 1000), 'HH:mm')} - {record.checkOutTime ? format(new Date((record.checkOutTime as Timestamp).seconds * 1000), 'HH:mm') : (
                                        record.onBreak ? <Badge variant="secondary">Đang nghỉ</Badge> : (
                                            record.status === 'in-progress' ? <Badge variant="secondary">Đang làm</Badge> : '--:--'
                                        )
                                    )}</span>
                                </div>
                                {record.breaks && record.breaks.length > 0 && (
                                    <div className="text-xs text-blue-600 space-y-0.5 pt-1 border-t mt-2">
                                        {record.breaks.map((breakItem, index) => (
                                            <div key={index} className="flex justify-between">
                                                <span>Nghỉ {index + 1}:</span>
                                                <span>
                                                    {format((breakItem.breakStartTime as Timestamp).toDate(), 'HH:mm')}
                                                    {breakItem.breakEndTime ? ` - ${format((breakItem.breakEndTime as Timestamp).toDate(), 'HH:mm')}` : '...'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Tổng giờ</span>
                                    <span>{record.totalHours?.toFixed(2) || 'N/A'}</span>
                                </div>
                                {record.offShiftReason && <div className="text-xs italic text-muted-foreground">Lý do ngoài giờ: {record.offShiftReason}</div>}
                                {record.lateReason && (
                                    <div className="text-xs text-destructive italic border-t pt-2 mt-2">
                                        <p>Xin trễ: {record.estimatedLateMinutes} phút</p>
                                        <p>Lý do: {record.lateReason}</p>
                                        {record.lateReasonPhotoUrl && (
                                            <button onClick={() => onOpenLightbox([{ src: record.lateReasonPhotoUrl! }], 0)} className="text-blue-500 hover:underline">Xem ảnh bằng chứng</button>
                                        )}
                                    </div>
                                )}
                                <div className="flex flex-wrap justify-between pt-2 gap-2">
                                    {record.photoInUrl && (
                                        <div className="text-center">
                                            <p className="text-xs text-muted-foreground mb-1">Ảnh vào</p>
                                            <button onClick={() => openLightboxForRecord(record.photoInUrl!)} className="relative h-20 w-20 rounded-md overflow-hidden cursor-pointer">
                                                <Image src={record.photoInUrl} alt="Check-in" layout="fill" objectFit="cover" className="hover:scale-110 transition-transform duration-200" />
                                            </button>
                                        </div>
                                    )}
                                    {record.photoOutUrl && (
                                        <div className="text-center">
                                            <p className="text-xs text-muted-foreground mb-1">Ảnh ra</p>
                                            <button onClick={() => openLightboxForRecord(record.photoOutUrl!)} className="relative h-20 w-20 rounded-md overflow-hidden cursor-pointer">
                                                <Image src={record.photoOutUrl} alt="Check-out" layout="fill" objectFit="cover" className="hover:scale-110 transition-transform duration-200" />
                                            </button>
                                        </div>
                                    )}
                                    {record.breaks?.map((breakItem, breakIndex) => (
                                        <React.Fragment key={`break-${breakIndex}`}>
                                            {breakItem.breakStartPhotoUrl && (
                                                <div className="text-center">
                                                    <p className="text-xs text-muted-foreground mb-1">Ảnh nghỉ {breakIndex + 1}</p>
                                                    <button onClick={() => openLightboxForRecord(breakItem.breakStartPhotoUrl!)} className="relative h-20 w-20 rounded-md overflow-hidden cursor-pointer border-2 border-blue-400">
                                                        <Image src={breakItem.breakStartPhotoUrl} alt={`Break start ${breakIndex + 1}`} layout="fill" objectFit="cover" className="hover:scale-110 transition-transform duration-200" />
                                                    </button>
                                                </div>
                                            )}
                                            {breakItem.breakEndPhotoUrl && (
                                                <div className="text-center">
                                                    <p className="text-xs text-muted-foreground mb-1">Ảnh làm lại {breakIndex + 1}</p>
                                                    <button onClick={() => openLightboxForRecord(breakItem.breakEndPhotoUrl!)} className="relative h-20 w-20 rounded-md overflow-hidden cursor-pointer border-2 border-green-400">
                                                        <Image src={breakItem.breakEndPhotoUrl} alt={`Break end ${breakIndex + 1}`} layout="fill" objectFit="cover" className="hover:scale-110 transition-transform duration-200" />
                                                    </button>
                                                </div>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </div>
                                <div className="flex justify-between items-center border-t pt-2 mt-2">
                                    <span className="text-muted-foreground font-semibold">Lương</span>
                                    <span className="font-bold text-base text-primary">{record.salary?.toLocaleString('vi-VN')}đ</span>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
            {recordToEditRate && (
                <HourlyRateDialog
                    isOpen={isRateDialogOpen}
                    onClose={() => setIsRateDialogOpen(false)}
                    record={recordToEditRate}
                    onSave={handleSaveRate}
                    parentDialogTag='root'
                />
            )}
        </>
    );
}