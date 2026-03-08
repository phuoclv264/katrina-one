'use client';

import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogBody,
    DialogFooter,
    DialogCancel,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { dataStore } from '@/lib/data-store';
import { toast } from '@/components/ui/pro-toast';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Clock, Trash2, User, Calendar, Loader2 } from 'lucide-react';
import type { AttendanceRecord, ManagedUser } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';

interface PendingLateRequestsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    records: AttendanceRecord[];
    users: ManagedUser[];
    parentDialogTag?: string;
}

export default function PendingLateRequestsDialog({
    isOpen,
    onClose,
    records,
    users,
    parentDialogTag,
}: PendingLateRequestsDialogProps) {
    const [isDeleting, setIsDeleting] = React.useState<string | null>(null);

    const pendingRecords = React.useMemo(() => {
        return records.filter(r => r.status === 'pending_late');
    }, [records]);

    const handleDelete = async (recordId: string) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa yêu cầu xin trễ này? Thao tác này sẽ gỡ bỏ hoàn toàn bản ghi khỏi hệ thống.')) {
            return;
        }

        setIsDeleting(recordId);
        try {
            await dataStore.deleteAttendanceRecord(recordId);
            toast.success('Đã xóa yêu cầu xin trễ.');
        } catch (error) {
            console.error('Failed to delete pending late record:', error);
            toast.error('Không thể xóa yêu cầu.');
        } finally {
            setIsDeleting(null);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose} dialogTag="pending-late-dialog" parentDialogTag={parentDialogTag || ''}>
            <DialogContent className="max-w-2xl">
                <DialogHeader variant="premium" iconkey="history">
                    <div>
                        <DialogTitle>Yêu cầu xin trễ đang chờ</DialogTitle>
                        <DialogDescription>
                            Danh sách các nhân viên đã gửi yêu cầu xin trễ nhưng chưa chấm công.
                        </DialogDescription>
                    </div>
                </DialogHeader>
                <DialogBody className="max-h-[60vh] overflow-y-auto">
                    {pendingRecords.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Clock className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p className="font-medium">Không có yêu cầu xin trễ nào đang chờ.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {pendingRecords.map((record) => {
                                const user = users.find(u => u.uid === record.userId);
                                const createdAt = record.createdAt instanceof Timestamp 
                                    ? record.createdAt.toDate() 
                                    : new Date(record.createdAt as any);

                                return (
                                    <div key={record.id} className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-zinc-100 dark:border-zinc-800">
                                        <div className="flex-1 min-w-0 mr-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <User className="h-4 w-4 text-zinc-500" />
                                                <span className="font-bold text-zinc-900 dark:text-zinc-50 truncate">
                                                    {user?.displayName || 'Nhân viên ẩn danh'}
                                                </span>
                                                <Badge variant="outline" className="text-[10px] uppercase font-bold text-amber-600 border-amber-200 bg-amber-50">
                                                    Đang chờ
                                                </Badge>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    {format(createdAt, 'HH:mm dd/MM/yyyy', { locale: vi })}
                                                </div>
                                                <div className="flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400">
                                                    <Clock className="h-3 w-3" />
                                                    Dự kiến trễ: {record.estimatedLateMinutes || '?'} phút
                                                </div>
                                            </div>
                                            {record.lateReason && (
                                                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 italic line-clamp-2">
                                                    "{record.lateReason}"
                                                </p>
                                            )}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-10 w-10 text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0"
                                            onClick={() => handleDelete(record.id)}
                                            disabled={isDeleting === record.id}
                                        >
                                            {isDeleting === record.id ? (
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-5 w-5" />
                                            )}
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </DialogBody>
                <DialogFooter>
                    <DialogCancel className="w-full" onClick={onClose}>Đóng</DialogCancel>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
