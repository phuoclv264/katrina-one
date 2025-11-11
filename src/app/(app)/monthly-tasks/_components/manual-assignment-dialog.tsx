'use client';
import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { UserMultiSelect } from '@/components/user-multi-select';
import { Loader2, X, UserPlus, ListChecks, Trash2 } from 'lucide-react';
import type { MonthlyTask, ManagedUser, MonthlyTaskSchedule, MonthlyTaskAssignment } from '@/lib/types';
import type { SelectMultipleEventHandler } from 'react-day-picker';
import { format, startOfMonth } from 'date-fns';
import { vi } from 'date-fns/locale';
import { dataStore } from '@/lib/data-store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import toast from 'react-hot-toast';

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
    const [monthlySchedule, setMonthlySchedule] = useState<MonthlyTaskSchedule | null>(null);
    const [removingAssignmentId, setRemovingAssignmentId] = useState<string | null>(null);
    const [isRemovingAll, setIsRemovingAll] = useState(false);
    const [activeTab, setActiveTab] = useState('assign');
    const isMobile = useIsMobile();

    useEffect(() => {
        if (isOpen) {
            setSelectedUsers([]);
            setSelectedDates([]);
            setCurrentMonth(startOfMonth(new Date()));
        }
        setIsRemovingAll(false);
        if (isOpen && isMobile) setActiveTab('assign');
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const monthId = format(currentMonth, 'yyyy-MM');
        const unsub = dataStore.subscribeToMonthlyTaskSchedule(monthId, setMonthlySchedule);

        return () => unsub();
    }, [isOpen, currentMonth]);

    const existingAssignmentsForTask = useMemo(() => {
        if (!monthlySchedule || !task) return [];
        return monthlySchedule.assignments.filter(a => a.taskId === task.id);
    }, [monthlySchedule, task]);

    const existingAssignmentSet = useMemo(() => {
        const set = new Set<string>();
        existingAssignmentsForTask.forEach(a => {
            set.add(`${a.assignedTo.userId}-${a.assignedDate}`);
        });
        return set;
    }, [existingAssignmentsForTask]);

    const handleSave = async () => {
        if (!task || selectedUsers.length === 0 || selectedDates.length === 0) return;
        
        const assignments = selectedUsers.flatMap(user => 
            selectedDates.map(date => {
                const dateString = format(date, 'yyyy-MM-dd');
                if (existingAssignmentSet.has(`${user.uid}-${dateString}`)) {
                    return null;
                }
                return {
                    userId: user.uid,
                    userName: user.displayName,
                    date: dateString,
                };
            }).filter((a): a is { userId: string, userName: string, date: string } => a !== null)
        );

        if (assignments.length === 0) {
            onClose();
            return;
        }

        await onSave(task, assignments);
        if (isMobile) {
            setActiveTab('summary');
        }
    };

    const handleRemoveAssignment = async (assignment: MonthlyTaskAssignment) => {
        const assignmentId = `${assignment.taskId}-${assignment.assignedDate}-${assignment.assignedTo.userId}`;
        setRemovingAssignmentId(assignmentId);
        try {
            const monthId = format(currentMonth, 'yyyy-MM');
            await dataStore.removeMonthlyTaskAssignment(monthId, assignment.taskId, assignment.assignedDate, assignment.assignedTo.userId);
        } catch (error) {
            console.error("Failed to remove assignment:", error);
            // The UI will update automatically via the subscription, so no toast is needed unless there's an error.
        } finally {
            // The loading state will clear automatically when the item is removed from the list, but this handles error cases.
            setRemovingAssignmentId(null);
        }
    };

    const handleRemoveAllAssignmentsForTask = async () => {
        if (!task) return;
        setIsRemovingAll(true);
        try {
            const monthId = format(currentMonth, 'yyyy-MM');
            await dataStore.removeAllAssignmentsForTask(monthId, task.id);
        } catch (error) {
            console.error("Failed to remove all assignments:", error);
            toast.error("Không thể xóa hết các phân công.");
        } finally {
            setIsRemovingAll(false);
        }
    };

    const eligibleUsers = allUsers.filter(u => u.role === task?.appliesToRole);

    const newAssignmentCount = useMemo(() => {
        if (selectedUsers.length === 0 || selectedDates.length === 0) return 0;
        let count = 0;
        selectedUsers.forEach(user => {
            selectedDates.forEach(date => {
                if (!existingAssignmentSet.has(`${user.uid}-${format(date, 'yyyy-MM-dd')}`)) {
                    count++;
                }
            });
        });
        return count;
    }, [selectedUsers, selectedDates, existingAssignmentSet]);

    const AssignmentSelection = () => (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                    disabled={(date) => existingAssignmentSet.has(`${selectedUsers[0]?.uid}-${format(date, 'yyyy-MM-dd')}`)}
                />
            </div>
        </div>
    );

    const AssignmentSummary = () => (
        <div className="space-y-4 bg-muted/50 p-4 rounded-lg flex flex-col h-full">
            <h4 className="font-semibold">Tóm tắt phân công</h4>
            <div className="text-sm space-y-3 flex-grow">
                <p>
                    Bạn sẽ giao <span className="font-bold text-primary">{newAssignmentCount}</span> lượt công việc mới.
                </p>
                <div>
                    <p className="font-medium mb-1">Phân công đã có trong tháng:</p>
                    <ScrollArea className="h-48 border rounded-md bg-background p-2">
                        {existingAssignmentsForTask.length > 0 ? (
                            <ul className="text-xs space-y-1">
                                {existingAssignmentsForTask.sort((a,b) => new Date(a.assignedDate).getTime() - new Date(b.assignedDate).getTime()).map((a, i) => (
                                    <AssignmentListItem 
                                        key={i} 
                                        assignment={a} 
                                        isProcessing={isProcessing || isRemovingAll}
                                        removingAssignmentId={removingAssignmentId}
                                        handleRemoveAssignment={handleRemoveAssignment}
                                    />
                                ))}
                            </ul>
                        ) : (
                            <p className="text-xs text-muted-foreground italic text-center pt-2">Chưa có phân công nào.</p>
                        )}
                    </ScrollArea>
                    {existingAssignmentsForTask.length > 0 && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" className="w-full mt-2" disabled={isProcessing || isRemovingAll}>
                                    {isRemovingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4"/>}
                                    Xóa tất cả
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Xác nhận xóa tất cả?</AlertDialogTitle><AlertDialogDescription>Bạn có chắc muốn xóa TOÀN BỘ {existingAssignmentsForTask.length} phân công cho công việc này trong tháng không? Hành động này không thể hoàn tác.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={handleRemoveAllAssignmentsForTask}>Xóa tất cả</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Phân công thủ công</DialogTitle>
                    <DialogDescription>
                        Giao việc "{task?.name}" cho nhân viên vào các ngày đã chọn. Các phân công đã tồn tại sẽ được bỏ qua.
                    </DialogDescription>
                </DialogHeader>
                {isMobile ? (
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full py-4">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="assign"><UserPlus className="mr-2 h-4 w-4"/>Giao việc</TabsTrigger>
                            <TabsTrigger value="summary"><ListChecks className="mr-2 h-4 w-4"/>Danh sách</TabsTrigger>
                        </TabsList>
                        <TabsContent value="assign" className="mt-4"><AssignmentSelection /></TabsContent>
                        <TabsContent value="summary" className="mt-4"><AssignmentSummary /></TabsContent>
                    </Tabs>
                ) : (
                    <div className="py-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2"><AssignmentSelection /></div>
                        <div className="md:col-span-1"><AssignmentSummary /></div>
                    </div>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isProcessing}>Hủy</Button>
                    <Button onClick={handleSave} disabled={isProcessing || newAssignmentCount === 0}>
                        {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Lưu {newAssignmentCount > 0 ? `${newAssignmentCount} ` : ''}phân công mới
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function AssignmentListItem({ assignment, isProcessing, removingAssignmentId, handleRemoveAssignment }: {
    assignment: MonthlyTaskAssignment;
    isProcessing?: boolean;
    removingAssignmentId?: string | null;
    handleRemoveAssignment: (assignment: MonthlyTaskAssignment) => void;
}) {
    const assignmentId = `${assignment.taskId}-${assignment.assignedDate}-${assignment.assignedTo.userId}`;
    const isBeingRemoved = removingAssignmentId === assignmentId;

    return (
        <li className="flex items-center justify-between group p-1 rounded-md hover:bg-muted/50">
            <span>{assignment.assignedTo.userName} - {format(new Date(assignment.assignedDate), 'dd/MM')}</span>
            {isBeingRemoved ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" disabled={isProcessing}>
                            <X className="h-3 w-3 text-destructive" />
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Xác nhận xóa?</AlertDialogTitle><AlertDialogDescription>Bạn có chắc muốn xóa phân công này không? Hành động này không thể hoàn tác.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => handleRemoveAssignment(assignment)}>Xóa</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </li>
    );
}