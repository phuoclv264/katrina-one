'use client';
import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AttendanceRecord, ManagedUser, Schedule, AssignedShift } from '@/lib/types';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn, getInitials } from '@/lib/utils';
import { getStatusInfo, findShiftForRecord } from '@/lib/attendance-utils';
import { Edit2, Trash2, MoreVertical, AlertCircle } from 'lucide-react';
import Image from '@/components/ui/image';
import HourlyRateDialog from './hourly-rate-dialog';
import { dataStore } from '@/lib/data-store';
import { toast } from '@/components/ui/pro-toast';
import { Button } from '@/components/ui/button';
import { Timestamp } from 'firebase/firestore';
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
import React from 'react';

export default function AttendanceTable({
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

  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <Table>
          <TableHeader className="bg-gray-50 text-gray-700">
            <TableRow>
              <TableHead className="w-48">Nhân viên</TableHead>
              <TableHead>Ngày</TableHead>
              <TableHead>Ca làm việc</TableHead>
              <TableHead>Giờ làm</TableHead>
              <TableHead>Tổng giờ</TableHead>
              <TableHead>Ảnh chấm công</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Lương</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
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
                <TableRow key={record.id} className="hover:bg-gray-50">
                  {/* Nhân viên */}
                  <TableCell className="align-top">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 border border-border flex-shrink-0">
                        <AvatarImage src={user?.photoURL || ''} />
                        <AvatarFallback className="text-sm bg-primary/10 text-primary">
                          {getInitials(user?.displayName)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="space-y-1">
                        <div className="font-semibold text-gray-900">{user?.displayName || 'Không rõ'}</div>
                        <div className="text-xs text-gray-500 flex items-center">
                          {record.hourlyRate?.toLocaleString('vi-VN')}đ/giờ
                          <Button
                            variant="ghost"
                            size="icon"
                            className="ml-1 h-6 w-6"
                            onClick={() => handleEditRate(record)}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        </div>
                        {record.isOffShift && (
                          <Badge variant="outline" className="text-amber-700 border-amber-500">
                            Ngoài giờ
                          </Badge>
                        )}
                        {record.offShiftReason && (
                          <p className="text-xs text-gray-500 italic">Lý do: {record.offShiftReason}</p>
                        )}
                        {record.lateReason && (
                          <div className="text-xs text-red-500 italic space-y-0.5">
                            <p>Xin trễ: {record.estimatedLateMinutes} phút</p>
                            <p>Lý do: {record.lateReason}</p>
                            {record.lateReasonPhotoUrl && (
                              <button
                                onClick={() => onOpenLightbox([{ src: record.lateReasonPhotoUrl! }], 0)}
                                className="text-blue-500 hover:underline"
                              >
                                Xem ảnh
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Ngày */}
                  <TableCell className="align-top text-sm text-gray-700">
                    {format(new Date((record.checkInTime as Timestamp).seconds * 1000), 'dd/MM/yyyy', { locale: vi })}
                  </TableCell>

                  {/* Ca làm việc */}
                  <TableCell className="align-top">
                    {shifts.map(shift => (
                      <div key={shift.id} className="text-sm">
                        <div className="font-medium text-gray-800">{shift.label}</div>
                        <div className="text-xs text-gray-500">{shift.timeSlot.start} - {shift.timeSlot.end}</div>
                      </div>
                    ))}
                  </TableCell>

                  {/* Giờ làm */}
                  <TableCell className="align-top text-sm text-gray-700">
                    <div>Vào: {format(new Date((record.checkInTime as Timestamp).seconds * 1000), 'HH:mm')}</div>
                    {record.breaks && record.breaks.length > 0 && (
                      <div className="mt-1 text-xs text-blue-600 space-y-0.5">
                        {record.breaks.map((b, i) => (
                          <div key={i}>
                            Nghỉ {i + 1}: {format((b.breakStartTime as Timestamp).toDate(), 'HH:mm')}
                            {b.breakEndTime ? ` - ${format((b.breakEndTime as Timestamp).toDate(), 'HH:mm')}` : ' - ...'}
                          </div>
                        ))}
                      </div>
                    )}
                    <div>
                      Ra: {record.checkOutTime
                        ? format(new Date((record.checkOutTime as Timestamp).seconds * 1000), 'HH:mm')
                        : record.onBreak
                          ? <Badge variant="secondary">Đang nghỉ</Badge>
                          : record.status === 'in-progress'
                            ? <Badge variant="secondary">Đang làm</Badge>
                            : '--:--'}
                    </div>
                  </TableCell>

                  {/* Tổng giờ */}
                  <TableCell className="align-top text-sm font-medium text-gray-700">
                    {record.totalHours?.toFixed(2) || 'N/A'}
                  </TableCell>

                  {/* Ảnh */}
                  <TableCell className="align-top">
                    <div className="flex flex-wrap gap-2">
                      {[
                        record.photoInUrl && { url: record.photoInUrl, border: '' },
                        record.photoOutUrl && { url: record.photoOutUrl, border: '' },
                        ...(record.breaks?.flatMap(b => [
                          b.breakStartPhotoUrl && { url: b.breakStartPhotoUrl, border: 'border-2 border-blue-400' },
                          b.breakEndPhotoUrl && { url: b.breakEndPhotoUrl, border: 'border-2 border-green-400' },
                        ]) || []),
                      ]
                        .filter(Boolean)
                        .map((p, i) => (
                          <button
                            key={i} // Use a unique key for each photo
                            onClick={() => openLightboxForRecord(p ? p.url : '')}
                            className={`relative h-12 w-12 rounded-md overflow-hidden cursor-pointer border ${p ? p.border : ''} hover:ring-2 hover:ring-blue-400 transition`}
                          >
                            <Image
                              src={p ? p.url : ''}
                              alt="Record photo"
                              fill
                              className="object-cover hover:scale-110 transition-transform duration-200"
                            />
                          </button>
                        ))}
                    </div>
                  </TableCell>

                  {/* Trạng thái */}
                  <TableCell className="align-top">
                    <div className={cn("flex items-center gap-2 text-sm", statusInfo.color)}>
                      {statusInfo.icon}
                      {statusInfo.text}
                    </div>
                  </TableCell>

                  {/* Lương */}
                  <TableCell className="align-top text-right font-semibold text-gray-900">
                    {record.salary?.toLocaleString('vi-VN')}đ
                  </TableCell>

                  {/* Hành động */}
                  <TableCell className="align-top text-right">
                    <AlertDialog dialogTag="alert-dialog" parentDialogTag="root" variant="destructive">
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => onEdit(record)}>
                            <Edit2 className="mr-2 h-4 w-4" /> Chỉnh sửa
                          </DropdownMenuItem>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem className="text-destructive focus:text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" /> Xóa
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogIcon icon={Trash2} />
                          <div className="space-y-2 text-center sm:text-left">
                            <AlertDialogTitle>Xác nhận xóa?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Hành động này không thể hoàn tác. Bạn có chắc chắn muốn xóa bản ghi chấm công này không?
                            </AlertDialogDescription>
                          </div>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Hủy</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDelete(record.id)}>Xóa</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {records.length === 0 && (
          <div className="py-10 text-center text-gray-500">Không có dữ liệu chấm công cho tháng này.</div>
        )}
      </div>

      {recordToEditRate && (
        <HourlyRateDialog
          isOpen={isRateDialogOpen}
          onClose={() => setIsRateDialogOpen(false)}
          record={recordToEditRate}
          onSave={handleSaveRate}
          parentDialogTag="root"
        />
      )}
    </>

  );
}
