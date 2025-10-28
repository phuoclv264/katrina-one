
'use client';
import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AttendanceRecord, ManagedUser, Schedule, AssignedShift } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getStatusInfo, getShiftDetails } from '@/lib/attendance-utils';
import { Eye, Edit2 } from 'lucide-react';
import HourlyRateDialog from './hourly-rate-dialog';
import { dataStore } from '@/lib/data-store';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';

export default function AttendanceTable({
  records,
  users,
  schedules,
}: {
  records: AttendanceRecord[];
  users: ManagedUser[];
  schedules: Record<string, Schedule>;
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

  const sortedRecords = [...records].sort((a, b) => new Date(b.checkInTime as string).getTime() - new Date(a.checkInTime as string).getTime());

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
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Lương</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRecords.map(record => {
              const user = users.find(u => u.uid === record.userId);
              const { shift, weekId } = getShiftDetails(record.shiftId, schedules);
              const statusInfo = getStatusInfo(record, shift);

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
                  <TableCell>{format(parseISO(record.checkInTime as string), 'dd/MM/yyyy', { locale: vi })}</TableCell>
                  <TableCell>
                    <div>{shift?.label}</div>
                    <div className="text-xs text-muted-foreground">{shift?.timeSlot.start} - {shift?.timeSlot.end}</div>
                  </TableCell>
                  <TableCell>
                    <div>Vào: {format(parseISO(record.checkInTime as string), 'HH:mm')}</div>
                    <div>Ra: {record.checkOutTime ? format(parseISO(record.checkOutTime as string), 'HH:mm') : '--:--'}</div>
                  </TableCell>
                  <TableCell>{record.totalHours?.toFixed(2) || 'N/A'}</TableCell>
                  <TableCell>
                    <div className={cn("flex items-center gap-2 text-sm", statusInfo.color)}>
                        {statusInfo.icon}
                        {statusInfo.text}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {record.salary?.toLocaleString('vi-VN')}đ
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

    