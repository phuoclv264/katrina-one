'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { UserMultiSelect } from '@/components/user-multi-select';
import { Loader2 } from 'lucide-react';
import type { MonthlyTask, ManagedUser } from '@/lib/types';
import type { SelectMultipleEventHandler } from 'react-day-picker';
import { format, startOfMonth } from 'date-fns';
import { vi } from 'date-fns/locale';

type ManualAssignmentDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    task: MonthlyTask | null;
    allUsers: ManagedUser[];
    onSave: (task: MonthlyTask, assignments: { userId: string, userName: string, date: string }[]) => Promise<void>;
    isProcessing: boolean;
};

export default function ManualAssignmentDialog({
    isOpen,
    onClose,
    task,
    allUsers,
    onSave,
    isProcessing,
}: ManualAssignmentDialogProps) {
    const [selectedUsers, setSelectedUsers] = useState<ManagedUser[]>([]);
    const [selectedDates, setSelectedDates] = useState<Date[]>([]);
    const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));

    useEffect(() => {
        if (isOpen) {
            setSelectedUsers([]);
            setSelectedDates([]);
            setCurrentMonth(startOfMonth(new Date()));
        }
    }, [isOpen]);

    const handleSave = () => {
        if (!task || selectedUsers.length === 0 || selectedDates.length === 0) return;
        
        const assignments = selectedUsers.flatMap(user => 
            selectedDates.map(date => ({
                userId: user.uid,
                userName: user.displayName,
                date: format(date, 'yyyy-MM-dd'),
            }))
        );

        onSave(task, assignments);
    };

    const eligibleUsers = allUsers.filter(u => u.role === task?.appliesToRole);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Phân công thủ công</DialogTitle>
                    <DialogDescription>
                        Giao việc "{task?.name}" cho nhân viên vào các ngày đã chọn.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <h4 className="font-semibold">1. Chọn nhân viên</h4>
                            <UserMultiSelect users={eligibleUsers} selectedUsers={selectedUsers} onChange={setSelectedUsers} />
                        </div>
                         <div className="space-y-2">
                             <h4 className="font-semibold">2. Chọn ngày</h4>
                            <Calendar
                                mode="multiple"
                                selected={selectedDates}
                                onSelect={setSelectedDates as SelectMultipleEventHandler}
                                month={currentMonth}
                                onMonthChange={setCurrentMonth}
                                className="rounded-md border p-2"
                                locale={vi}
                            />
                        </div>
                    </div>
                     <div className="space-y-4 bg-muted/50 p-4 rounded-lg">
                        <h4 className="font-semibold">Tóm tắt phân công</h4>
                        <p className="text-sm">
                            Bạn sẽ giao công việc <span className="font-bold">"{task?.name}"</span> cho:
                        </p>
                        <ul className="list-disc list-inside text-sm font-medium">
                            {selectedUsers.length > 0 ? selectedUsers.map(u => <li key={u.uid}>{u.displayName}</li>) : <li>(Chưa chọn nhân viên)</li>}
                        </ul>
                         <p className="text-sm">
                            Vào các ngày:
                        </p>
                        <ul className="list-disc list-inside text-sm font-medium">
                             {selectedDates.length > 0 ? selectedDates.map(d => <li key={d.toString()}>{format(d, 'dd/MM/yyyy')}</li>) : <li>(Chưa chọn ngày)</li>}
                        </ul>
                        <p className="text-sm text-primary font-bold">
                            Tổng cộng: {selectedUsers.length * selectedDates.length} lượt phân công.
                        </p>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isProcessing}>Hủy</Button>
                    <Button onClick={handleSave} disabled={isProcessing || selectedDates.length === 0 || selectedUsers.length === 0}>
                        {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Lưu phân công
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
