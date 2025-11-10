'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarClock, Plus, Edit, Trash2, Loader2, Save, Users, AlertTriangle, Wand2, ChevronLeft, ChevronRight, UserPlus } from 'lucide-react';
import { dataStore } from '@/lib/data-store';
import type { MonthlyTask, UserRole, ManagedUser, Schedule, MonthlyTaskAssignment, MonthlyTaskSchedule } from '@/lib/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'react-hot-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { generateTaskAssignments, type GenerateTaskAssignmentsOutput } from '@/ai/flows/generate-task-assignments-flow';
import AssignmentDialog from './_components/assignment-dialog';
import ManualAssignmentDialog from './_components/manual-assignment-dialog';
import { format, startOfMonth, endOfMonth, parseISO, addMonths, subMonths } from 'date-fns';
import { vi } from 'date-fns/locale';

function EditTaskForm({
    task,
    onSave,
    onCancel,
    isProcessing,
}: {
    task: MonthlyTask;
    onSave: (updatedTask: MonthlyTask) => void;
    onCancel: () => void;
    isProcessing: boolean;
}) {
    const [localTask, setLocalTask] = useState(task);

    const handleFieldChange = (field: keyof MonthlyTask, value: any) => {
        setLocalTask(prev => ({ ...prev, [field]: value }));
    };

    const handleFrequencyChange = (field: 'type' | 'count', value: any) => {
        setLocalTask(prev => ({
            ...prev,
            frequency: {
                ...(prev.frequency || { type: 'per_month', count: 1 }),
                [field]: value
            }
        }));
    };

    const handleSaveClick = () => {
        if (!localTask.name.trim()) {
            toast.error("Tên công việc không được để trống.");
            return;
        }
        onSave(localTask);
    }

    return (
        <div className="p-4 border bg-muted/50 rounded-lg space-y-4">
             <div className="space-y-2">
                <Label htmlFor={`name-${task.id}`}>Tên công việc</Label>
                <Input id={`name-${task.id}`} value={localTask.name} onChange={e => handleFieldChange('name', e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label htmlFor={`desc-${task.id}`}>Mô tả</Label>
                <Textarea id={`desc-${task.id}`} value={localTask.description} onChange={e => handleFieldChange('description', e.target.value)} rows={2} />
            </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor={`freq-type-${task.id}`}>Tần suất</Label>
                    <Select value={localTask.frequency.type} onValueChange={(v) => handleFrequencyChange('type', v)}>
                        <SelectTrigger id={`freq-type-${task.id}`}><SelectValue/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="per_month">Mỗi tháng</SelectItem>
                            <SelectItem value="per_week">Mỗi tuần</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor={`freq-count-${task.id}`}>Số lần</Label>
                    <Input id={`freq-count-${task.id}`} type="number" value={localTask.frequency.count} onChange={e => handleFrequencyChange('count', Number(e.target.value))} />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor={`time-${task.id}`}>Thời gian ước tính (phút)</Label>
                <Input id={`time-${task.id}`} type="number" value={localTask.estimatedTime} onChange={e => handleFieldChange('estimatedTime', Number(e.target.value))} />
            </div>
            <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={onCancel}>Hủy</Button>
                <Button size="sm" onClick={handleSaveClick} disabled={isProcessing}>
                    {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Lưu
                </Button>
            </div>
        </div>
    )
}


export default function MonthlyTasksPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [tasks, setTasks] = useState<MonthlyTask[]>([]);
    const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

    // State for AI assignment
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiAssignments, setAiAssignments] = useState<GenerateTaskAssignmentsOutput['assignments'] | null>(null);
    const [showAssignmentConflict, setShowAssignmentConflict] = useState(false);
    
    // State for manual assignment
    const [isManualAssignmentOpen, setIsManualAssignmentOpen] = useState(false);
    const [taskToAssignManually, setTaskToAssignManually] = useState<MonthlyTask | null>(null);


    const ROLES: UserRole[] = ['Phục vụ', 'Pha chế', 'Thu ngân', 'Quản lý'];

    useEffect(() => {
        if (!authLoading) {
            if (!user || user.role !== 'Chủ nhà hàng') {
                router.replace('/');
            } else {
                const unsubTasks = dataStore.subscribeToMonthlyTasks((data) => {
                    setTasks(data);
                    if(isLoading) setIsLoading(false);
                });
                const unsubUsers = dataStore.subscribeToUsers((data) => {
                    setAllUsers(data);
                });
                return () => { unsubTasks(); unsubUsers(); };
            }
        }
    }, [user, authLoading, router, isLoading]);
    
    const handleSaveTasks = async (newTasks: MonthlyTask[]) => {
        setIsProcessing(true);
        try {
            await dataStore.updateMonthlyTasks(newTasks);
            toast.success("Đã cập nhật danh sách công việc.");
        } catch(error) {
            toast.error("Lỗi khi lưu thay đổi.");
            console.error(error);
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleAddTask = (role: UserRole) => {
        const newTask: MonthlyTask = {
            id: `task_${Date.now()}`,
            name: 'Công việc mới',
            description: '',
            appliesToRole: role,
            frequency: { type: 'per_month', count: 1 },
            estimatedTime: 30,
        };
        handleSaveTasks([...tasks, newTask]);
        setEditingTaskId(newTask.id);
    };

    const handleUpdateTask = (updatedTask: MonthlyTask) => {
        const newTasks = tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
        handleSaveTasks(newTasks);
        setEditingTaskId(null);
    };

    const handleDeleteTask = (taskId: string) => {
        const newTasks = tasks.filter(t => t.id !== taskId);
        handleSaveTasks(newTasks);
    };

    const handleGenerateAssignments = async () => {
        setIsAiLoading(true);
        setIsAssignmentDialogOpen(true);
        setAiAssignments(null); // Clear previous results

        try {
            const schedules = await dataStore.getSchedulesForMonth(currentMonth);
            if (!schedules || schedules.length === 0) {
                toast.error(`Chưa có lịch làm việc nào được công bố cho tháng ${format(currentMonth, 'MM/yyyy')}.`);
                setIsAssignmentDialogOpen(false);
                return;
            }
            
            const existingAssignmentSchedule = await dataStore.getMonthlyTaskSchedule(format(currentMonth, 'yyyy-MM'));
            if(existingAssignmentSchedule) {
                setShowAssignmentConflict(true);
                // The dialog will handle closing everything else
                return;
            }
            
            const result = await generateTaskAssignments({
                month: format(currentMonth, 'yyyy-MM'),
                allTasks: tasks,
                allUsers,
                allSchedules: schedules,
            });
            setAiAssignments(result.assignments);

        } catch (error: any) {
            toast.error(error.message || 'Lỗi khi tạo lịch phân công.');
            setIsAssignmentDialogOpen(false);
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleConfirmAssignments = async (assignments: GenerateTaskAssignmentsOutput['assignments']) => {
        setIsProcessing(true);
        try {
            const monthId = format(currentMonth, 'yyyy-MM');
            const schedule: Omit<MonthlyTaskSchedule, 'month'> = {
                assignments: assignments.map(assignment => ({
                    ...assignment,
                    status: 'pending' // Add the missing 'status' property
                }))
            };

            await dataStore.saveMonthlyTaskSchedule(monthId, schedule);
            toast.success(`Đã lưu lịch phân công cho tháng ${format(currentMonth, 'MM/yyyy')}`);
            setIsAssignmentDialogOpen(false);
        } catch (error) {
            toast.error("Không thể lưu lịch phân công.");
        } finally {
            setIsProcessing(false);
        }
    };
    
     const handleOverwriteAssignments = async () => {
        setShowAssignmentConflict(false);
        setIsAiLoading(true);
        setIsAssignmentDialogOpen(true);
        setAiAssignments(null);
        try {
            const schedules = await dataStore.getSchedulesForMonth(currentMonth);
            const result = await generateTaskAssignments({
                month: format(currentMonth, 'yyyy-MM'),
                allTasks: tasks,
                allUsers,
                allSchedules: schedules,
            });
            setAiAssignments(result.assignments);
        } catch (error: any) {
             toast.error(error.message || 'Lỗi khi tạo lịch phân công.');
             setIsAssignmentDialogOpen(false);
        } finally {
             setIsAiLoading(false);
        }
    };

    const handleOpenManualAssign = (task: MonthlyTask) => {
        setTaskToAssignManually(task);
        setIsManualAssignmentOpen(true);
    };

    const handleConfirmManualAssignment = async (task: MonthlyTask, assignments: { userId: string, userName: string, date: string }[]) => {
        if (!assignments || assignments.length === 0) return;
        setIsProcessing(true);
        try {
            const monthId = format(parseISO(assignments[0].date), 'yyyy-MM');
            await dataStore.addManualTaskAssignments(monthId, task, assignments);
            toast.success(`Đã giao ${assignments.length} công việc "${task.name}".`);
            setIsManualAssignmentOpen(false);
        } catch (error) {
            console.error("Failed to save manual assignments:", error);
            toast.error("Không thể lưu phân công.");
        } finally {
            setIsProcessing(false);
        }
    };


    if (isLoading || authLoading) {
        return (
            <div className="container mx-auto p-4 sm:p-6 md:p-8">
                <header className="mb-8"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-4 w-1/3 mt-2" /></header>
                <Card><CardHeader><Skeleton className="h-8 w-1/3" /></CardHeader><CardContent className="space-y-4"><Skeleton className="h-24 w-full" /></CardContent></Card>
            </div>
        );
    }

    return (
        <>
        <div className="container mx-auto p-4 sm:p-6 md:p-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <CalendarClock />
                    Quản lý Công việc Định kỳ
                </h1>
                <p className="text-muted-foreground mt-2">
                    Thiết lập danh sách các công việc cần thực hiện định kỳ (hàng tuần, tháng) cho từng vai trò.
                </p>
            </header>
            
            <Card className="mb-8">
                <CardHeader>
                    <CardTitle>Phân công công việc</CardTitle>
                    <CardDescription>Sử dụng AI để tự động phân công các công việc định kỳ cho nhân viên trong tháng, dựa trên lịch làm việc của họ.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="h-4 w-4"/></Button>
                        <span className="text-lg font-semibold w-32 text-center">{format(currentMonth, 'MM/yyyy')}</span>
                        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="h-4 w-4"/></Button>
                    </div>
                     <Button onClick={handleGenerateAssignments} disabled={isAiLoading}>
                        <Wand2 className="mr-2 h-4 w-4" />
                        Phân công bằng AI cho tháng {format(currentMonth, 'MM')}
                    </Button>
                </CardContent>
            </Card>

            <Tabs defaultValue={ROLES[0]} className="w-full">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto">
                    {ROLES.map(role => (
                        <TabsTrigger key={role} value={role} className="py-2">{role}</TabsTrigger>
                    ))}
                </TabsList>
                {ROLES.map(role => {
                    const tasksForRole = tasks.filter(t => t.appliesToRole === role);
                    return (
                    <TabsContent value={role} key={role}>
                        <Card className="mt-4">
                            <CardHeader>
                                <CardTitle>Công việc cho {role}</CardTitle>
                                <CardDescription>Tổng cộng: {tasksForRole.length} công việc.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                               {tasksForRole.map(task => (
                                    editingTaskId === task.id ? (
                                        <EditTaskForm 
                                            key={task.id}
                                            task={task}
                                            onSave={handleUpdateTask}
                                            onCancel={() => setEditingTaskId(null)}
                                            isProcessing={isProcessing}
                                        />
                                    ) : (
                                    <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-muted/50">
                                        <div className="space-y-1">
                                            <p className="font-semibold">{task.name}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {task.frequency.count} lần / {task.frequency.type === 'per_month' ? 'tháng' : 'tuần'}
                                                <span className="mx-2">•</span>
                                                Ước tính: {task.estimatedTime} phút
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button variant="ghost" size="sm" onClick={() => handleOpenManualAssign(task)}>
                                                <UserPlus className="mr-2 h-4 w-4"/>Giao việc
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => setEditingTaskId(task.id)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                             <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Xác nhận xóa?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Bạn có chắc muốn xóa công việc "{task.name}" không?
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteTask(task.id)}>Xóa</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>
                                    )
                               ))}
                               {tasksForRole.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Chưa có công việc nào cho vai trò này.</p>}

                               <Button variant="outline" className="w-full mt-4" onClick={() => handleAddTask(role)}>
                                    <Plus className="mr-2 h-4 w-4"/> Thêm công việc mới cho {role}
                               </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    )
                })}
            </Tabs>
        </div>
        
        <AssignmentDialog 
            isOpen={isAssignmentDialogOpen}
            onClose={() => setIsAssignmentDialogOpen(false)}
            onConfirm={handleConfirmAssignments}
            assignments={aiAssignments}
            isLoading={isAiLoading}
            allUsers={allUsers}
        />
        
        <ManualAssignmentDialog
            isOpen={isManualAssignmentOpen}
            onClose={() => setIsManualAssignmentOpen(false)}
            task={taskToAssignManually}
            allUsers={allUsers}
            onSave={handleConfirmManualAssignment}
            isProcessing={isProcessing}
        />
        
        <AlertDialog open={showAssignmentConflict} onOpenChange={setShowAssignmentConflict}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="text-amber-500" />Lịch phân công đã tồn tại</AlertDialogTitle>
                    <AlertDialogDescription>
                        Đã có lịch phân công cho tháng {format(currentMonth, 'MM/yyyy')}. 
                        Bạn có muốn tạo lại và ghi đè lên lịch cũ không? Hành động này không thể hoàn tác.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Hủy</AlertDialogCancel>
                    <AlertDialogAction onClick={handleOverwriteAssignments}>Tạo lại và Ghi đè</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}
