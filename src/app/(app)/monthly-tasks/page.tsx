'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import { getDay } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'nextjs-toploader/app';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { CalendarClock, Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { dataStore } from '@/lib/data-store';
import type { MonthlyTask, UserRole, ManagedUser } from '@/lib/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/pro-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { addYears, eachWeekOfInterval, eachMonthOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, format, addDays as addDaysFns } from 'date-fns';

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
    const ROLES: UserRole[] = ['Phục vụ', 'Pha chế', 'Quản lý'];
    const [localTask, setLocalTask] = useState(task);

    const handleFieldChange = (field: keyof MonthlyTask, value: any) => {
        setLocalTask(prev => ({ ...prev, [field]: value }));
    };

    const handleScheduleTypeChange = (type: 'weekly' | 'interval' | 'monthly_date' | 'monthly_weekday' | 'random') => {
        let newSchedule: MonthlyTask['schedule'];
        switch (type) {
            case 'weekly':
                newSchedule = { type: 'weekly', daysOfWeek: [1, 3, 5] };
                break;
            case 'interval':
                newSchedule = { type: 'interval', intervalDays: 3, startDate: new Date().toISOString().split('T')[0] };
                break;
            case 'monthly_date':
                newSchedule = { type: 'monthly_date', daysOfMonth: [1, 15] };
                break;
            case 'monthly_weekday':
                newSchedule = { type: 'monthly_weekday', occurrences: [{ week: 1, day: 1 }] };
                break;
            case 'random':
                newSchedule = { type: 'random', period: 'week', count: 1, excludeWeekends: true };
                break;
            default:
                newSchedule = { type: 'weekly', daysOfWeek: [] };
        }
        setLocalTask(prev => ({ ...prev, schedule: newSchedule }));
    };

    const handleScheduleDetailChange = (field: string, value: any) => {
        setLocalTask(prev => ({
            ...prev,
            schedule: {
                ...prev.schedule,
                [field]: value,
            }
        }));
    };

    const handleWeeklyDayToggle = (day: number) => {
        if (localTask.schedule.type !== 'weekly') return;
        const currentDays = localTask.schedule.daysOfWeek || [];
        const newDays = currentDays.includes(day)
            ? currentDays.filter(d => d !== day)
            : [...currentDays, day];
        handleScheduleDetailChange('daysOfWeek', newDays.sort());
    };

    const renderScheduleInputs = () => {
        const { schedule } = localTask;
        switch (schedule.type) {
            case 'weekly':
                const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
                return (
                    <div className="flex flex-wrap gap-2">
                        {days.map((label, index) => (
                            <Toggle
                                key={index}
                                pressed={(schedule.daysOfWeek || []).includes(index)}
                                onPressedChange={() => handleWeeklyDayToggle(index)}
                                variant="outline"
                                size="sm"
                            >
                                {label}
                            </Toggle>
                        ))}
                    </div>
                );
            case 'interval':
                return (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Lặp lại mỗi (ngày)</Label>
                            <Input
                                type="number"
                                value={schedule.intervalDays || 1}
                                onChange={e => handleScheduleDetailChange('intervalDays', parseInt(e.target.value, 10) || 1)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Ngày bắt đầu (YYYY-MM-DD)</Label>
                            <Input
                                type="text"
                                value={schedule.startDate || ''}
                                onChange={e => handleScheduleDetailChange('startDate', e.target.value)}
                                placeholder="2024-01-01"
                            />
                        </div>
                    </div>
                );
            case 'monthly_date':
                return (
                    <div className="space-y-2">
                        <Label>Vào các ngày trong tháng (cách nhau bằng dấu phẩy)</Label>
                        <Input
                            type="text"
                            value={(schedule.daysOfMonth || []).join(', ')}
                            onChange={e => handleScheduleDetailChange('daysOfMonth', e.target.value.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n)))}
                            placeholder="1, 15, 30"
                        />
                    </div>
                );
            case 'monthly_weekday':
                // This is a simplified UI for a complex feature.
                // A more advanced UI would allow adding/removing multiple occurrences.
                const occurrence = schedule.occurrences?.[0] || { week: 1, day: 1 };
                return (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Tuần trong tháng</Label>
                            <Select
                                value={String(occurrence.week)}
                                onValueChange={v => handleScheduleDetailChange('occurrences', [{ ...occurrence, week: parseInt(v) }])}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">Tuần đầu tiên</SelectItem>
                                    <SelectItem value="2">Tuần thứ 2</SelectItem>
                                    <SelectItem value="3">Tuần thứ 3</SelectItem>
                                    <SelectItem value="4">Tuần thứ 4</SelectItem>
                                    <SelectItem value="-1">Tuần cuối cùng</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Ngày trong tuần</Label>
                            <Select
                                value={String(occurrence.day)}
                                onValueChange={v => handleScheduleDetailChange('occurrences', [{ ...occurrence, day: parseInt(v) }])}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">Thứ Hai</SelectItem>
                                    <SelectItem value="2">Thứ Ba</SelectItem>
                                    <SelectItem value="3">Thứ Tư</SelectItem>
                                    <SelectItem value="4">Thứ Năm</SelectItem>
                                    <SelectItem value="5">Thứ Sáu</SelectItem>
                                    <SelectItem value="6">Thứ Bảy</SelectItem>
                                    <SelectItem value="0">Chủ Nhật</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                );
            case 'random':
                return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Chu kỳ</Label>
                            <Select
                                value={schedule.period}
                                onValueChange={v => handleScheduleDetailChange('period', v)}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="week">Mỗi tuần</SelectItem>
                                    <SelectItem value="month">Mỗi tháng</SelectItem>
                                    <SelectItem value="custom_days">N ngày</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Số lần / chu kỳ</Label>
                            <Input type="number" value={schedule.count || 1} onChange={e => handleScheduleDetailChange('count', parseInt(e.target.value, 10) || 1)} />
                        </div>
                        {schedule.period === 'custom_days' && (
                            <div className="space-y-2 sm:col-span-2">
                                <Label>Số ngày trong chu kỳ</Label>
                                <Input
                                    type="number"
                                    value={schedule.customDays || 7}
                                    onChange={e => handleScheduleDetailChange('customDays', parseInt(e.target.value, 10) || 7)}
                                />
                            </div>
                        )}
                        <div className="flex items-center space-x-2 sm:col-span-2">
                            <Checkbox
                                id="exclude-weekends"
                                checked={schedule.excludeWeekends}
                                onCheckedChange={(checked) => handleScheduleDetailChange('excludeWeekends', checked)}
                            />
                            <label htmlFor="exclude-weekends" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Loại trừ cuối tuần (Thứ 7 & Chủ Nhật)
                            </label>
                        </div>
                    </div>
                );
            default:
                return null;
        }
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
            <div className="space-y-2">
                <Label>Áp dụng cho vai trò</Label>
                <Select value={localTask.appliesToRole} onValueChange={(v) => handleFieldChange('appliesToRole', v)}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Tất cả">Tất cả vai trò</SelectItem>
                        <SelectItem value="Phục vụ">Phục vụ</SelectItem>
                        <SelectItem value="Pha chế">Pha chế</SelectItem>
                        <SelectItem value="Quản lý">Quản lý</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="p-3 border bg-background rounded-md space-y-3">
                <div className="space-y-2">
                    <Label>Loại lịch trình</Label>
                    <Select value={localTask.schedule.type} onValueChange={handleScheduleTypeChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="weekly">Hàng tuần</SelectItem>
                            <SelectItem value="interval">Theo chu kỳ (N ngày)</SelectItem>
                            <SelectItem value="monthly_date">Theo ngày trong tháng</SelectItem>
                            <SelectItem value="monthly_weekday">Theo thứ trong tháng</SelectItem>
                            <SelectItem value="random">Ngẫu nhiên</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    {renderScheduleInputs()}
                </div>
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
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const [tasks, setTasks] = useState<MonthlyTask[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);


    const ROLES: UserRole[] = ['Phục vụ', 'Pha chế', 'Quản lý'];

    const handleReconnect = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
    }, []);

    useEffect(() => {
        if (!authLoading) {
            if (!user || user.role !== 'Chủ nhà hàng') {
                router.replace('/');
            } else {
                const unsubTasks = dataStore.subscribeToMonthlyTasks((data) => {
                    setTasks(data);
                    if(isLoading) setIsLoading(false);
                });
                return () => { unsubTasks(); };
            }
        }
    }, [user, authLoading, router, isLoading, refreshTrigger]);

    useDataRefresher(handleReconnect);
    
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
    
    const handleAddTask = () => {
        const newTask: MonthlyTask = {
            id: `task_${Date.now()}`,
            name: 'Công việc mới',
            description: '',
            appliesToRole: 'Tất cả',
            schedule: {
                type: 'weekly',
                daysOfWeek: [1, 3, 5] // Default to Mon, Wed, Fri
            }
        };
        handleSaveTasks([...tasks, newTask]);
        setEditingTaskId(newTask.id);
    };

    const handleUpdateTask = (updatedTask: MonthlyTask) => {
        let finalTask = { ...updatedTask };
        if (finalTask.schedule.type === 'random') {
            finalTask.scheduledDates = generateRandomDates(finalTask.schedule);
        } else {
            delete finalTask.scheduledDates; // Clean up dates if not a random task
        }
        const newTasks = tasks.map(t => t.id === finalTask.id ? finalTask : t);
        handleSaveTasks(newTasks);
        setEditingTaskId(null);
    };

    const handleDeleteTask = (taskId: string) => {
        const newTasks = tasks.filter(t => t.id !== taskId);
        handleSaveTasks(newTasks);
    };

    const generateRandomDates = (schedule: MonthlyTask['schedule']): string[] => {
        if (schedule.type !== 'random') return [];

        const startDate = new Date();
        const endDate = addYears(startDate, 10);
        const generatedDates: string[] = [];

        const excludeWeekends = schedule.excludeWeekends;

        const getRandomDateInInterval = (interval: { start: Date, end: Date }) => {
            let randomDate: Date;
            let attempts = 0;
            do {
                const start = interval.start.getTime();
                const end = interval.end.getTime();
                const randomTime = start + Math.random() * (end - start);
                randomDate = new Date(randomTime);
                attempts++;
            } while (excludeWeekends && (getDay(randomDate) === 0 || getDay(randomDate) === 6) && attempts < 100); // Avoid infinite loops
            return randomDate;
        };

        if (schedule.period === 'week') {
            const weeks = eachWeekOfInterval({ start: startDate, end: endDate }, { weekStartsOn: 1 });
            weeks.forEach(weekStart => {
                for (let i = 0; i < schedule.count; i++) {
                    const randomDate = getRandomDateInInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) });
                    generatedDates.push(format(randomDate, 'yyyy-MM-dd'));
                }
            });
        } else if (schedule.period === 'month') {
            const months = eachMonthOfInterval({ start: startDate, end: endDate });
            months.forEach(monthStart => {
                for (let i = 0; i < schedule.count; i++) {
                    const randomDate = getRandomDateInInterval({ start: monthStart, end: endOfMonth(monthStart) });
                    generatedDates.push(format(randomDate, 'yyyy-MM-dd'));
                }
            });
        } else if (schedule.period === 'custom_days' && schedule.customDays) {
            let currentPeriodStart = startDate;
            while (currentPeriodStart < endDate) {
                const periodEnd = addDaysFns(currentPeriodStart, schedule.customDays - 1);
                for (let i = 0; i < schedule.count; i++) {
                    const randomDate = getRandomDateInInterval({ start: currentPeriodStart, end: periodEnd > endDate ? endDate : periodEnd });
                    generatedDates.push(format(randomDate, 'yyyy-MM-dd'));
                }
                currentPeriodStart = addDaysFns(currentPeriodStart, schedule.customDays);
            }
        }
        return [...new Set(generatedDates)].sort(); // Ensure unique and sorted dates
    };

    const formatScheduleInfo = (task: MonthlyTask): string => {
        const { schedule } = task;
        switch (schedule.type) {
            case 'weekly':
                const daysOfWeek = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
                const scheduledDays = schedule.daysOfWeek.map(d => daysOfWeek[d]).join(', ');
                return `Hàng tuần: ${scheduledDays}`;
            case 'interval':
                return `Mỗi ${schedule.intervalDays} ngày, từ ${schedule.startDate}`;
            case 'monthly_date':
                return `Hàng tháng vào ngày: ${schedule.daysOfMonth.join(', ')}`;
            case 'monthly_weekday':
                const weekMap: { [key: number]: string } = { 1: 'đầu tiên', 2: 'thứ 2', 3: 'thứ 3', 4: 'thứ 4', '-1': 'cuối cùng' };
                const dayMap = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
                const occurrence = schedule.occurrences[0];
                if (!occurrence) return "Lịch theo thứ trong tháng";
                return `Vào ${dayMap[occurrence.day]} ${weekMap[occurrence.week]} của tháng`;
            case 'random':
                const nextDates = (task.scheduledDates || []).filter(d => new Date(d) >= new Date()).slice(0, 3).join(', ');
                return `Ngẫu nhiên: ${nextDates}...`;
            default: return "Lịch trình không xác định";
        }
    };

    if (isLoading || authLoading) {
        return <LoadingPage />;
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
                    Thiết lập danh sách các công việc và quy tắc lịch trình của chúng. Hệ thống sẽ tự động hiển thị công việc cho nhân viên vào ngày được lên lịch.
                </p>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle>Danh sách công việc</CardTitle>
                    <CardDescription>Tổng cộng: {tasks.length} công việc.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {tasks.map(task => (
                        editingTaskId === task.id ? (
                            <EditTaskForm 
                                key={task.id}
                                task={{
                                    ...task,
                                    schedule: task.schedule || { type: 'weekly', daysOfWeek: [] }
                                }}
                                onSave={handleUpdateTask}
                                onCancel={() => setEditingTaskId(null)}
                                isProcessing={isProcessing}
                            />
                        ) : (
                        <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-muted/50">
                            <div className="space-y-1">
                                <p className="font-semibold">{task.name} <span className="ml-2 text-xs font-normal text-primary bg-primary/10 px-2 py-0.5 rounded-full">{task.appliesToRole}</span></p>
                                <p className="text-xs text-muted-foreground italic">
                                    {formatScheduleInfo(task)}
                                </p>
                                <p className="text-sm text-muted-foreground">{task.description}</p>
                            </div>
                            <div className="flex items-center gap-1">
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
                    {tasks.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Chưa có công việc nào.</p>}

                    <Button variant="outline" className="w-full mt-4" onClick={handleAddTask}>
                        <Plus className="mr-2 h-4 w-4"/> Thêm công việc mới
                    </Button>
                </CardContent>
            </Card>
        </div>
        </>
    );
}
