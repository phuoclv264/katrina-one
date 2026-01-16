'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Combobox } from '@/components/combobox';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'; // Keep this import
import { dataStore } from '@/lib/data-store';
import type { ManagedUser, ShiftReport, Violation, AttendanceRecord, TasksByShift, TaskSection, ComprehensiveTaskSection, CompletionRecord } from '@/lib/types';
import { format, startOfMonth, endOfMonth, parseISO, addMonths, subMonths } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Loader2, AlertTriangle, Camera, ListTodo, ThumbsDown, ThumbsUp, Users, ListTree, ListX } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useLightbox } from '@/contexts/lightbox-context';

type MonthlyStaffReportDialogProps = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    parentDialogTag: string;
};

type MonthlyUserData = {
    shiftReports: ShiftReport[];
    violations: Violation[];
    attendance: AttendanceRecord[];
    totalHours: number;
    totalSalary: number;
    totalViolations: number;
    totalViolationCost: number;
};

type GroupedTask = {
    taskText: string;
    completions: (CompletionRecord & { reportDate: string; shiftName: string })[];
};

function StaffMonthlyDetails({ user, data, tasksByShift, bartenderTasks, comprehensiveTasks, onOpenLightbox }: {
    user: ManagedUser, data: MonthlyUserData,
    tasksByShift: TasksByShift | null,
    bartenderTasks: TaskSection[] | null,
    comprehensiveTasks: ComprehensiveTaskSection[] | null,
    onOpenLightbox: (slides: { src: string, description?: string }[], index: number) => void;
}) {
    const allPhotos = useMemo(() => {
        return data.shiftReports.flatMap(report =>
            Object.values(report.completedTasks).flatMap(completions =>
                completions.flatMap(comp => comp.photos || [])
            )
        );
    }, [data.shiftReports]);

    const completedTasks = useMemo(() => {
        const groupedTasks: Record<string, GroupedTask> = {};

        // Initialize with all possible tasks to show even those with 0 completions
        if (tasksByShift) {
            Object.values(tasksByShift).forEach(shift => {
                shift.sections.forEach(section => {
                    section.tasks.forEach(task => {
                        groupedTasks[task.text] = { taskText: task.text, completions: [] };
                    });
                });
            });
        }
        if (bartenderTasks) {
            bartenderTasks.forEach(section => {
                section.tasks.forEach(task => {
                    groupedTasks[task.text] = { taskText: task.text, completions: [] };
                });
            });
        }
        if (comprehensiveTasks) {
            comprehensiveTasks.forEach(section => {
                section.tasks.forEach(task => {
                    groupedTasks[task.text] = { taskText: task.text, completions: [] };
                });
            });
        }

        const findTaskDef = (report: ShiftReport) => {
            if (tasksByShift && tasksByShift[report.shiftKey]) {
                const shiftDef = tasksByShift[report.shiftKey];
                return (taskId: string) => shiftDef.sections.flatMap(s => s.tasks).find(t => t.id === taskId);
            }
            if (bartenderTasks && report.shiftKey === 'bartender_hygiene') {
                return (taskId: string) => bartenderTasks.flatMap(s => s.tasks).find(t => t.id === taskId);
            }
            if (comprehensiveTasks && report.shiftKey === 'manager_comprehensive') {
                return (taskId: string) => comprehensiveTasks.flatMap(s => s.tasks).find(t => t.id === taskId);
            }
            return () => undefined;
        };

        data.shiftReports.forEach(report => {
            const getTaskDef = findTaskDef(report);
            const shiftName = tasksByShift?.[report.shiftKey]?.name ||
                (report.shiftKey === 'bartender_hygiene' ? 'Vệ sinh quầy' :
                    (report.shiftKey === 'manager_comprehensive' ? 'Kiểm tra toàn diện' : 'Không rõ'));

            Object.entries(report.completedTasks).forEach(([taskId, completions]) => {
                const taskDef = getTaskDef(taskId);
                if (taskDef) {
                    if (!groupedTasks[taskDef.text]) {
                        groupedTasks[taskDef.text] = {
                            taskText: taskDef.text,
                            completions: []
                        };
                    }
                    completions.forEach(comp => {
                        groupedTasks[taskDef.text].completions.push({
                            ...comp,
                            reportDate: report.date,
                            shiftName: shiftName
                        });
                    });
                }
            });
        });

        // Sort completions within each group by date and time
        Object.values(groupedTasks).forEach(group => {
            group.completions.sort((a, b) =>
                (a.reportDate + a.timestamp).localeCompare(b.reportDate + a.timestamp)
            );
        });

        const allTasks = Object.values(groupedTasks);
        const doneTasks = allTasks.filter(t => t.completions.length > 0).sort((a, b) => b.completions.length - a.completions.length);
        const undoneTasks = allTasks.filter(t => t.completions.length === 0).sort((a, b) => a.taskText.localeCompare(b.taskText));
        return { doneTasks, undoneTasks };
    }, [data.shiftReports, tasksByShift, bartenderTasks, comprehensiveTasks]);

    return (
        <div className="space-y-4 p-4 border rounded-lg bg-background">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="p-3 rounded-md bg-muted">
                    <p className="text-sm text-muted-foreground">Giờ làm</p>
                    <p className="text-xl font-bold">{data.totalHours.toFixed(2)}</p>
                </div>
                <div className="p-3 rounded-md bg-muted">
                    <p className="text-sm text-muted-foreground">Lương</p>
                    <p className="text-xl font-bold">{Math.round(data.totalSalary / 1000)}k</p>
                </div>
                <div className="p-3 rounded-md bg-muted">
                    <p className="text-sm text-muted-foreground">Vi phạm</p>
                    <p className="text-xl font-bold">{data.totalViolations}</p>
                </div>
                <div className="p-3 rounded-md bg-muted">
                    <p className="text-sm text-muted-foreground">Tiền phạt</p>
                    <p className="text-xl font-bold">{Math.round(data.totalViolationCost / 1000)}k</p>
                </div>
            </div>

            <Accordion type="multiple" className="w-full space-y-2">
                {completedTasks.doneTasks.length > 0 && (
                    <AccordionItem value="tasks-done">
                        <AccordionTrigger><ListTodo className="mr-2 h-4 w-4" />Công việc đã làm ({completedTasks.doneTasks.length})</AccordionTrigger>
                        <AccordionContent>
                            <ScrollArea className="h-72">
                                <Accordion type="multiple" className="w-full space-y-1 pr-4">
                                    {completedTasks.doneTasks.map((taskGroup) => (
                                        <AccordionItem value={taskGroup.taskText} key={taskGroup.taskText} className="border rounded-md bg-muted/50">
                                            <AccordionTrigger className="px-3 py-2 text-sm font-medium hover:no-underline">
                                                {taskGroup.taskText} ({taskGroup.completions.length})
                                            </AccordionTrigger>
                                            <AccordionContent className="p-3 border-t">
                                                <ul className="space-y-2">
                                                    {taskGroup.completions.map((comp, i) => (
                                                        <li key={i} className="text-sm p-2 border rounded-md bg-background">
                                                            <p className="text-xs text-muted-foreground">
                                                                {comp.shiftName} - {format(parseISO(comp.reportDate), 'dd/MM/yy')} {comp.timestamp}
                                                            </p>
                                                            {comp.value !== undefined && (
                                                                <Badge variant={comp.value ? "default" : "destructive"} className="mt-1">
                                                                    {comp.value ? <ThumbsUp className="h-3 w-3 mr-1" /> : <ThumbsDown className="h-3 w-3 mr-1" />}
                                                                    {comp.value ? "Đảm bảo" : "Không"}
                                                                </Badge>
                                                            )}
                                                            {comp.opinion && <p className="text-xs italic mt-1">"{comp.opinion}"</p>}
                                                            {comp.photos && comp.photos.length > 0 && (
                                                                <ScrollArea className="w-full whitespace-nowrap rounded-md mt-2">
                                                                    <div className="flex w-max space-x-2 p-1">
                                                                        {comp.photos.map((photo, pIndex) => (
                                                                            <button key={pIndex} className="h-16 w-16 relative rounded-md overflow-hidden bg-muted shrink-0" onClick={() => onOpenLightbox(
                                                                                comp.photos!.map(p => ({
                                                                                    src: p,
                                                                                    description: `${taskGroup.taskText} - ${user.displayName} - ${format(parseISO(comp.reportDate), 'dd/MM/yy')} ${comp.timestamp}`
                                                                                })), pIndex
                                                                            )}>
                                                                                <Image src={photo} alt={`Photo ${pIndex}`} fill className="object-cover" />
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                    <ScrollBar orientation="horizontal" />
                                                                </ScrollArea>
                                                            )}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </ScrollArea>
                        </AccordionContent>
                    </AccordionItem>
                )}
                {completedTasks.undoneTasks.length > 0 && (
                    <AccordionItem value="tasks-undone">
                        <AccordionTrigger><ListX className="mr-2 h-4 w-4" />Công việc chưa làm ({completedTasks.undoneTasks.length})</AccordionTrigger>
                        <AccordionContent>
                            <ScrollArea className="h-72">
                                <ul className="space-y-1 pr-4 text-sm text-muted-foreground">
                                    {completedTasks.undoneTasks.map((task) => (
                                        <li key={task.taskText} className="p-2 border rounded-md bg-muted/30">{task.taskText}</li>
                                    ))}
                                </ul>
                            </ScrollArea>
                        </AccordionContent>
                    </AccordionItem>
                )}
                <AccordionItem value="violations">
                    <AccordionTrigger><AlertTriangle className="mr-2 h-4 w-4" />Vi phạm ({data.violations.length})</AccordionTrigger>
                    <AccordionContent>
                        <ScrollArea className="h-64">
                            <ul className="space-y-2 pr-4">
                                {data.violations.map(v => (
                                    <li key={v.id} className="text-sm p-2 border rounded-md">
                                        <p>{v.content}</p>
                                        <p className="text-xs text-muted-foreground">{format(parseISO(v.createdAt as string), 'dd/MM/yyyy HH:mm')} - Phạt: {v.cost.toLocaleString()}đ</p>
                                    </li>
                                ))}
                            </ul>
                        </ScrollArea>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="photos">
                    <AccordionTrigger><Camera className="mr-2 h-4 w-4" />Ảnh đã chụp ({allPhotos.length})</AccordionTrigger>
                    <AccordionContent>
                        <ScrollArea className="h-64">
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pr-4">
                                {allPhotos.map((photoUrl, i) => (
                                    <button key={i} className="aspect-square relative rounded-md overflow-hidden bg-muted" onClick={() => onOpenLightbox(
                                        allPhotos.map(p => ({
                                            src: p,
                                            description: `Ảnh chụp bởi ${user.displayName}`
                                        })), i
                                    )}>
                                        <Image src={photoUrl} alt={`Report photo ${i}`} fill className="object-cover" />
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}

type TaskCentricData = {
    [reportType: string]: {
        [taskText: string]: {
            completionsByUser: {
                [userId: string]: {
                    user: ManagedUser;
                    completions: (CompletionRecord & { reportDate: string; shiftName: string })[];
                }
            }
        }
    }
};

function TaskCentricView({ allUsers, monthlyData, tasksByShift, bartenderTasks, comprehensiveTasks, onOpenLightbox }: {
    allUsers: ManagedUser[],
    monthlyData: Record<string, MonthlyUserData>,
    tasksByShift: TasksByShift | null,
    bartenderTasks: TaskSection[] | null,
    comprehensiveTasks: ComprehensiveTaskSection[] | null,
    onOpenLightbox: (slides: { src: string, description?: string }[], index: number) => void;
}) {
    const taskCentricData = useMemo(() => {
        const data: TaskCentricData = {};

        // Initialize with all possible tasks to show even those with 0 completions
        if (tasksByShift) {
            data['Checklist'] = {};
            Object.values(tasksByShift).forEach(shift => {
                shift.sections.forEach(section => {
                    section.tasks.forEach(task => {
                        data['Checklist'][task.text] = { completionsByUser: {} };
                    });
                });
            });
        }
        if (bartenderTasks) {
            data['Vệ sinh quầy'] = {};
            bartenderTasks.forEach(section => {
                section.tasks.forEach(task => {
                    data['Vệ sinh quầy'][task.text] = { completionsByUser: {} };
                });
            });
        }
        if (comprehensiveTasks) {
            data['Kiểm tra toàn diện'] = {};
            comprehensiveTasks.forEach(section => {
                section.tasks.forEach(task => {
                    data['Kiểm tra toàn diện'][task.text] = { completionsByUser: {} };
                });
            });
        }
        const findTaskDef = (report: ShiftReport) => {
            if (tasksByShift && tasksByShift[report.shiftKey]) {
                const shiftDef = tasksByShift[report.shiftKey];
                return (taskId: string) => shiftDef.sections.flatMap(s => s.tasks).find(t => t.id === taskId);
            }
            if (bartenderTasks && report.shiftKey === 'bartender_hygiene') {
                return (taskId: string) => bartenderTasks.flatMap(s => s.tasks).find(t => t.id === taskId);
            }
            if (comprehensiveTasks && report.shiftKey === 'manager_comprehensive') {
                return (taskId: string) => comprehensiveTasks.flatMap(s => s.tasks).find(t => t.id === taskId);
            }
            return () => undefined;
        };

        Object.values(monthlyData).forEach(userData => {
            const user = allUsers.find(u => u.uid === userData.shiftReports[0]?.userId);
            if (!user) return;

            userData.shiftReports.forEach(report => {
                const getTaskDef = findTaskDef(report);
                const reportType = tasksByShift?.[report.shiftKey] ? 'Checklist' :
                    (report.shiftKey === 'bartender_hygiene' ? 'Vệ sinh quầy' :
                        (report.shiftKey === 'manager_comprehensive' ? 'Kiểm tra toàn diện' : 'Báo cáo khác'));

                Object.entries(report.completedTasks).forEach(([taskId, completions]) => {
                    const taskDef = getTaskDef(taskId);
                    if (taskDef) {
                        if (!data[reportType]) data[reportType] = {};
                        if (!data[reportType][taskDef.text]) data[reportType][taskDef.text] = { completionsByUser: {} };
                        if (!data[reportType][taskDef.text].completionsByUser[user.uid]) {
                            data[reportType][taskDef.text].completionsByUser[user.uid] = { user, completions: [] };
                        }

                        completions.forEach(comp => {
                            data[reportType][taskDef.text].completionsByUser[user.uid].completions.push({
                                ...comp,
                                reportDate: report.date,
                                shiftName: reportType
                            });
                        });
                    }
                });
            });
        });

        // Sort completions for each user
        Object.values(data).forEach(reportGroup => {
            Object.values(reportGroup).forEach(taskGroup => {
                Object.values(taskGroup.completionsByUser).forEach(userGroup => {
                    userGroup.completions.sort((a, b) => (a.reportDate + a.timestamp).localeCompare(b.reportDate + a.timestamp));
                });
            });
        });

        return data;
    }, [allUsers, monthlyData, tasksByShift, bartenderTasks, comprehensiveTasks]);

    return (
        <Accordion type="multiple" className="w-full space-y-2">
            {Object.entries(taskCentricData).map(([reportType, tasks]) => (
                <AccordionItem value={reportType} key={reportType} className="border rounded-md bg-card">
                    <AccordionTrigger className="px-4 py-3 text-base font-semibold hover:no-underline">{reportType}</AccordionTrigger>
                    <AccordionContent className="p-3 border-t">
                        <Accordion type="multiple" className="w-full space-y-1">
                            {Object.entries(tasks).sort(([, a], [, b]) => {
                                const totalCompletionsA = Object.values(a.completionsByUser).reduce((sum, u) => sum + u.completions.length, 0);
                                const totalCompletionsB = Object.values(b.completionsByUser).reduce((sum, u) => sum + u.completions.length, 0);
                                return totalCompletionsB - totalCompletionsA;
                            })
                                .map(([taskText, taskData]) => {
                                    const sortedUsers = Object.values(taskData.completionsByUser).sort((a, b) => b.completions.length - a.completions.length);
                                    return (
                                        <AccordionItem value={taskText} key={taskText} className="border rounded-md bg-muted/50">
                                            <AccordionTrigger className="px-3 py-2 text-sm font-medium hover:no-underline">
                                                {taskText} ({sortedUsers.reduce((sum, u) => sum + u.completions.length, 0)})
                                            </AccordionTrigger>
                                            <AccordionContent className="p-3 border-t">
                                                <ul className="space-y-3">
                                                    {sortedUsers.map(({ user, completions }) => (
                                                        <li key={user.uid} className="text-sm p-2 border rounded-md bg-background">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Avatar className="h-6 w-6">
                                                                    <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.displayName}`} />
                                                                    <AvatarFallback>{user.displayName.charAt(0)}</AvatarFallback>
                                                                </Avatar>
                                                                <p className="font-semibold">{user.displayName} <span className="font-normal text-muted-foreground">({completions.length} lần)</span></p>
                                                            </div>
                                                            <ul className="space-y-1 pl-4 border-l-2 ml-3">
                                                                <div className="grid grid-flow-row grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-1 ml-3">
                                                                    {completions.sort((a, b) => (a.reportDate + a.timestamp).localeCompare(b.reportDate + b.timestamp)).map((comp, i) => (
                                                                        <li key={i} className="text-xs text-muted-foreground flex items-center">
                                                                            {format(parseISO(comp.reportDate), 'dd/MM')} {comp.timestamp}
                                                                            {comp.photos && comp.photos.length > 0 && (
                                                                                <button onClick={() => onOpenLightbox(
                                                                                    comp.photos!.map(p => ({
                                                                                        src: p,
                                                                                        description: `${taskText} - ${user.displayName} - ${format(parseISO(comp.reportDate), 'dd/MM/yy')} ${comp.timestamp}`
                                                                                    })), 0
                                                                                )} className="ml-2">
                                                                                    <Camera className="h-3 w-3 inline-block text-primary" />
                                                                                </button>
                                                                            )}
                                                                        </li>
                                                                    ))}
                                                                </div>
                                                            </ul>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </AccordionContent>
                                        </AccordionItem>
                                    );
                                })}
                        </Accordion>
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    );
}

export default function MonthlyStaffReportDialog({ isOpen, onOpenChange, parentDialogTag }: MonthlyStaffReportDialogProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [isLoading, setIsLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'byStaff' | 'byTask'>('byStaff');
    const [monthlyData, setMonthlyData] = useState<Record<string, MonthlyUserData>>({});
    const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
    const { openLightbox } = useLightbox();
    const [tasksByShift, setTasksByShift] = useState<TasksByShift | null>(null);
    const [bartenderTasks, setBartenderTasks] = useState<TaskSection[] | null>(null);
    const [comprehensiveTasks, setComprehensiveTasks] = useState<ComprehensiveTaskSection[] | null>(null);

    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        let date = new Date();
        for (let i = 0; i < 12; i++) {
            months.add(format(date, 'yyyy-MM'));
            date.setMonth(date.getMonth() - 1);
        }
        return Array.from(months);
    }, []);

    useEffect(() => {
        if (isOpen) {
            dataStore.subscribeToUsers(setAllUsers);
            dataStore.subscribeToTasks(setTasksByShift);
            dataStore.subscribeToBartenderTasks(setBartenderTasks);
            dataStore.subscribeToComprehensiveTasks(setComprehensiveTasks);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const fetchDataForMonth = async () => {
            setIsLoading(true);
            const monthStart = startOfMonth(currentMonth);
            const monthEnd = endOfMonth(currentMonth);

            const [reports, violations, attendance] = await Promise.all([
                dataStore.getShiftReportsForDateRange({ from: monthStart, to: monthEnd }),
                dataStore.getViolationsForDateRange({ from: monthStart, to: monthEnd }),
                dataStore.getAttendanceRecordsForDateRange({ from: monthStart, to: monthEnd })
            ]);

            const dataByUser: Record<string, MonthlyUserData> = {};

            allUsers.forEach(user => {
                if (user.role === 'Chủ nhà hàng') return;

                const userReports = reports.filter(r => r.userId === user.uid);
                const userViolations = violations.filter(v => v.users.some(u => u.id === user.uid));
                const userAttendance = attendance.filter(a => a.userId === user.uid);

                dataByUser[user.uid] = {
                    shiftReports: userReports,
                    violations: userViolations,
                    attendance: userAttendance,
                    totalHours: userAttendance.reduce((sum, a) => sum + (a.totalHours || 0), 0),
                    totalSalary: userAttendance.reduce((sum, a) => sum + (a.salary || 0), 0),
                    totalViolations: userViolations.length,
                    totalViolationCost: userViolations.reduce((sum, v) => sum + (v.userCosts?.find(uc => uc.userId === user.uid)?.cost || 0), 0),
                };
            });

            setMonthlyData(dataByUser);
            setIsLoading(false);
        };

        fetchDataForMonth();
    }, [isOpen, currentMonth, allUsers]);

    const handleMonthChange = (direction: 'prev' | 'next') => {
        setCurrentMonth(prev => direction === 'next' ? addMonths(prev, 1) : subMonths(prev, 1));
    };

    const sortedUsers = useMemo(() => {
        const roleOrder: Record<string, number> = { 'Quản lý': 1, 'Pha chế': 2, 'Phục vụ': 3, 'Thu ngân': 4 };
        return allUsers
            .filter(u => u.role !== 'Chủ nhà hàng')
            .sort((a, b) => {
                const orderA = roleOrder[a.role] || 99;
                const orderB = roleOrder[b.role] || 99;
                if (orderA !== orderB) return orderA - orderB;
                return a.displayName.localeCompare(b.displayName);
            });
    }, [allUsers]);

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange} dialogTag="monthly-staff-report-dialog" parentDialogTag={parentDialogTag}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                    {/* Portal for the lightbox */}
                    <div id="monthly-report-lightbox-portal"></div>
                    <DialogHeader>
                        <DialogTitle>Báo cáo Hiệu suất Tháng</DialogTitle>
                        <DialogDescription>
                            Tổng hợp hoạt động, hiệu suất và các vấn đề liên quan của nhân viên trong tháng.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex items-center justify-between gap-4 py-4 border-y">
                        <div className="flex items-center gap-2">
                            <Combobox
                                value={format(currentMonth, 'yyyy-MM')}
                                onChange={(val) => setCurrentMonth(parseISO(val as string))}
                                options={availableMonths.map(month => ({
                                    value: month,
                                    label: `Tháng ${format(parseISO(`${month}-01`), 'MM/yyyy', { locale: vi })}`
                                }))}
                                placeholder="Chọn tháng"
                                compact
                                searchable={false}
                                className="w-[180px]"
                            />
                        </div>
                        <div className="flex items-center space-x-2">
                            <Users className="h-5 w-5 text-muted-foreground" />
                            <Switch
                                id="view-mode-toggle"
                                checked={viewMode === 'byTask'}
                                onCheckedChange={(checked) => setViewMode(checked ? 'byTask' : 'byStaff')}
                            />
                            <ListTree className="h-5 w-5 text-muted-foreground" />
                            <Label htmlFor="view-mode-toggle" className="text-sm font-medium">
                                {viewMode === 'byStaff' ? 'Xem theo Nhân viên' : 'Xem theo Công việc'}
                            </Label>
                        </div>
                    </div>

                    <ScrollArea className="flex-grow">
                        <div className="pr-4">
                            {isLoading ? (
                                <div className="flex justify-center items-center h-64">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            ) : viewMode === 'byStaff' ? (
                                <Accordion type="multiple" className="w-full space-y-2">
                                    {sortedUsers.map(user => {
                                        const userData = monthlyData[user.uid];
                                        if (!userData) return null;

                                        return (
                                            <AccordionItem value={user.uid} key={user.uid}>
                                                <AccordionTrigger>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar>
                                                            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.displayName}`} />
                                                            <AvatarFallback>{user.displayName.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="text-left">
                                                            <p className="font-semibold">{user.displayName}</p>
                                                            <p className="text-sm text-muted-foreground">{user.role}</p>
                                                        </div>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <StaffMonthlyDetails user={user} data={userData} tasksByShift={tasksByShift} bartenderTasks={bartenderTasks} comprehensiveTasks={comprehensiveTasks} onOpenLightbox={openLightbox} />
                                                </AccordionContent>
                                            </AccordionItem>
                                        );
                                    })}
                                </Accordion>
                            ) : (
                                <TaskCentricView
                                    allUsers={allUsers}
                                    monthlyData={monthlyData}
                                    tasksByShift={tasksByShift}
                                    bartenderTasks={bartenderTasks}
                                    comprehensiveTasks={comprehensiveTasks}
                                    onOpenLightbox={openLightbox} />
                            )}
                        </div>
                    </ScrollArea>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}