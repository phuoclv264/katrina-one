
'use client';
import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AttendanceRecord, ManagedUser, Schedule, AssignedShift } from '@/lib/types';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getStatusInfo, findShiftForRecord } from '@/lib/attendance-utils';
import { Edit2, Trash2, MoreVertical } from 'lucide-react';
import Image from 'next/image';
import HourlyRateDialog from './hourly-rate-dialog';
import { dataStore } from '@/lib/data-store';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Timestamp } from '@google-cloud/firestore';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

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
  onOpenLightbox: (slides: { src: string }[], index: number) => void;
}) {
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [isRateDialogOpen, setIsRateDialogOpen] = useState(false);

  const handleEditRate = (user: ManagedUser) => {
    setEditingUser(user);
    setIsRateDialogOpen(true);
  };

  const handleSaveRate = async (newRate: number) => {
    if (editingUser) {
      try {
        await dataStore.updateUserData(editingUser.uid, { hourlyRate: newRate });
        toast.success(`Đã cập nhật lương cho ${editingUser.displayName}.`);
      } catch {
        toast.error('Không thể cập nhật lương.');
      }
    }
  };

  const sortedRecords = [...records].sort((a, b) => (b.checkInTime as Timestamp).toMillis() - (a.checkInTime as Timestamp).toMillis());

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nhân viên</TableHead>
              <TableHead>Ngày</TableHead>
              <TableHead>Ca làm việc</TableHead>
              <TableHead>Giờ vào / ra</TableHead>
              <TableHead>Tổng giờ</TableHead>
              <TableHead>Ảnh</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Lương</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRecords.map(record => {
              const user = users.find(u => u.uid === record.userId);
              const shifts = findShiftForRecord(record, schedules);
              const statusInfo = getStatusInfo(record, shifts[0] || null);

              return (
                <TableRow key={record.id}>
                  <TableCell>
                    <div className="font-medium">{user?.displayName || 'Không rõ'}</div>
                    <div className="text-xs text-muted-foreground flex items-center">
                        {user?.hourlyRate?.toLocaleString('vi-VN')}đ/giờ
                        <Button variant="ghost" size="icon" className="h-6 w-6 ml-1" onClick={() => handleEditRate(user!)}>
                            <Edit2 className="h-3 w-3" />
                        </Button>
                    </div>
                  </TableCell>
                  <TableCell>{format(new Date((record.checkInTime as Timestamp).seconds * 1000), 'dd/MM/yyyy', { locale: vi })}</TableCell>
                  <TableCell>
                    {shifts.map(shift => (
                        <div key={shift.id}>
                            <div>{shift.label}</div>
                            <div className="text-xs text-muted-foreground">{shift.timeSlot.start} - {shift.timeSlot.end}</div>
                        </div>
                    ))}
                  </TableCell>
                  <TableCell>
                    <div>Vào: {format(new Date((record.checkInTime as Timestamp).seconds * 1000), 'HH:mm')}</div>
                    <div>Ra: {record.checkOutTime ? format(new Date((record.checkOutTime as Timestamp).seconds * 1000), 'HH:mm') : '--:--'}</div>
                  </TableCell>
                  <TableCell>{record.totalHours?.toFixed(2) || 'N/A'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                        {record.photoInUrl && (
                            <button onClick={() => onOpenLightbox([{src: record.photoInUrl!}], 0)} className="relative h-12 w-12 rounded-md overflow-hidden shrink-0 cursor-pointer">
                              <Image src={record.photoInUrl} alt="Check-in" layout="fill" objectFit="cover" className="hover:scale-110 transition-transform duration-200" />
                            </button>
                        )}
                        {record.photoOutUrl && (
                            <button onClick={() => onOpenLightbox([{src: record.photoOutUrl!}], 0)} className="relative h-12 w-12 rounded-md overflow-hidden shrink-0 cursor-pointer">
                                <Image src={record.photoOutUrl} alt="Check-out" layout="fill" objectFit="cover" className="hover:scale-110 transition-transform duration-200" />
                            </button>
                        )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className={cn("flex items-center gap-2 text-sm", statusInfo.color)}>
                        {statusInfo.icon}
                        {statusInfo.text}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {record.salary?.toLocaleString('vi-VN')}đ
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => onEdit(record)}>
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
                            <AlertDialogHeader><AlertDialogTitle>Xác nhận xóa?</AlertDialogTitle><AlertDialogDescription>Hành động này không thể hoàn tác. Bạn có chắc chắn muốn xóa bản ghi chấm công này không?</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(record.id)}>Xóa</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {records.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">Không có dữ liệu chấm công cho tháng này.</div>
        )}
      </div>

      {editingUser && (
        <HourlyRateDialog
            isOpen={isRateDialogOpen}
            onClose={() => setIsRateDialogOpen(false)}
            user={editingUser}
            onSave={handleSaveRate}
        />
      )}
    </>
  );
}

    