
'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AttendanceRecord, ManagedUser, Schedule, AssignedShift } from '@/lib/types';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getStatusInfo, findShiftForRecord } from '@/lib/attendance-utils';
import { Edit2, MoreVertical, Trash2 } from 'lucide-react';
import HourlyRateDialog from './hourly-rate-dialog';
import { dataStore } from '@/lib/data-store';
import { toast } from 'react-hot-toast';
import { Timestamp } from '@google-cloud/firestore';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export default function AttendanceCards({
  records,
  users,
  schedules,
  onEdit,
  onDelete,
}: {
  records: AttendanceRecord[];
  users: ManagedUser[];
  schedules: Record<string, Schedule>;
  onEdit: (record: AttendanceRecord) => void;
  onDelete: (id: string) => void;
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

  if (records.length === 0) {
    return <div className="text-center py-10 text-muted-foreground">Không có dữ liệu chấm công cho tháng này.</div>;
  }

  return (
    <>
      <div className="space-y-4">
        {sortedRecords.map(record => {
          const user = users.find(u => u.uid === record.userId);
          const shift = findShiftForRecord(record, schedules);
          const statusInfo = getStatusInfo(record, shift);

          return (
            <Card key={record.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-base">{user?.displayName || 'Không rõ'}</CardTitle>
                        <div className="text-xs text-muted-foreground flex items-center">
                            {user?.hourlyRate?.toLocaleString('vi-VN')}đ/giờ
                             <Button variant="ghost" size="icon" className="h-6 w-6 ml-1" onClick={() => handleEditRate(user!)}>
                                <Edit2 className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                     <div className="flex items-center">
                        <div className={cn("text-sm font-semibold flex items-center gap-1", statusInfo.color)}>
                            {statusInfo.icon}
                            {statusInfo.text}
                        </div>
                        <AlertDialog>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onClick={() => onEdit(record)}><Edit2 className="mr-2 h-4 w-4" /> Chỉnh sửa</DropdownMenuItem>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Xóa</DropdownMenuItem>
                                    </AlertDialogTrigger>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Xác nhận xóa?</AlertDialogTitle><AlertDialogDescription>Hành động này không thể hoàn tác. Bạn có chắc chắn muốn xóa bản ghi chấm công này không?</AlertDialogDescription></AlertDialogHeader>
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
                  <span>{shift?.label} ({shift?.timeSlot.start} - {shift?.timeSlot.end})</span>
                </div>
                 <div className="flex justify-between">
                  <span className="text-muted-foreground">Giờ vào/ra</span>
                  <span>{format(new Date((record.checkInTime as Timestamp).seconds * 1000), 'HH:mm')} - {record.checkOutTime ? format(new Date((record.checkOutTime as Timestamp).seconds * 1000), 'HH:mm') : '--:--'}</span>
                </div>
                 <div className="flex justify-between">
                  <span className="text-muted-foreground">Tổng giờ</span>
                  <span>{record.totalHours?.toFixed(2) || 'N/A'}</span>
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

    