'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogBody, DialogCancel } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Combobox } from '@/components/combobox';
import { dataStore } from '@/lib/data-store';
import type { ManagedUser, ShiftReport, Violation, AttendanceRecord, TasksByShift, TaskSection, ComprehensiveTaskSection, CompletionRecord } from '@/lib/types';
import { format, startOfMonth, endOfMonth, parseISO, addMonths, subMonths } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Loader2, AlertTriangle, Camera, ListTodo, ThumbsDown, ThumbsUp, Users, ListTree, ListX, ChevronLeft, ChevronRight, LayoutGrid, Trophy, CheckCircle2, Target } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import Image from '@/components/ui/image';
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

function NavigationItem({ icon: Icon, label, subLabel, count, onClick }: { icon: any, label: string, subLabel?: string, count?: number, onClick: () => void }) {
    return (
        <button 
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
            className="w-full flex items-center justify-between p-3.5 md:p-4 border rounded-2xl bg-card hover:bg-muted/50 transition-all active:scale-[0.97] group shadow-sm active:shadow-none"
        >
            <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-primary/5 text-primary group-hover:bg-primary/10 transition-colors shrink-0">
                    <Icon className="h-5 w-5" />
                </div>
                <div className="flex flex-col items-start min-w-0 flex-1">
                    <p className="font-bold text-foreground text-sm tracking-tight w-full text-left break-words line-clamp-2 leading-tight">{label}</p>
                    {subLabel && <p className="text-[10px] font-bold text-muted-foreground/60 w-full text-left uppercase tracking-tight break-words line-clamp-2 leading-tight">{subLabel}</p>}
                </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
                {count !== undefined && (
                    <Badge variant="secondary" className="bg-muted text-muted-foreground border-none font-bold tabular-nums h-5 px-1.5 min-w-[1.25rem] flex items-center justify-center">
                        {count}
                    </Badge>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
            </div>
        </button>
    );
}

function StaffMonthlyDetails({ user, data, tasksByShift, bartenderTasks, comprehensiveTasks, onOpenLightbox, onNavigate }: {
    user: ManagedUser, data: MonthlyUserData,
    tasksByShift: TasksByShift | null,
    bartenderTasks: TaskSection[] | null,
    comprehensiveTasks: ComprehensiveTaskSection[] | null,
    onOpenLightbox: (slides: { src: string, description?: string }[], index: number) => void;
    onNavigate: (title: string, content: React.ReactNode) => void;
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
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                <div className="p-2.5 md:p-3 rounded-2xl bg-muted/30 border border-border/50 text-center">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70 mb-1">Giờ làm</p>
                    <p className="text-lg md:text-xl font-black text-foreground tracking-tight">{data.totalHours.toFixed(2)}</p>
                </div>
                <div className="p-2.5 md:p-3 rounded-2xl bg-muted/30 border border-border/50 text-center">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70 mb-1">Dự tính lương</p>
                    <p className="text-lg md:text-xl font-black text-emerald-600 tracking-tight">{Math.round(data.totalSalary / 1000)}k</p>
                </div>
                <div className="p-2.5 md:p-3 rounded-2xl bg-muted/30 border border-border/50 text-center">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70 mb-1">Lỗi vi phạm</p>
                    <p className="text-lg md:text-xl font-black text-rose-500 tracking-tight">{data.totalViolations}</p>
                </div>
                <div className="p-2.5 md:p-3 rounded-2xl bg-muted/30 border border-border/50 text-center">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70 mb-1">Tiền phạt</p>
                    <p className="text-lg md:text-xl font-black text-rose-500 tracking-tight">{Math.round(data.totalViolationCost / 1000)}k</p>
                </div>
            </div>

            <div className="space-y-2">
                {completedTasks.doneTasks.length > 0 && (
                    <NavigationItem 
                        icon={ListTodo} 
                        label="Công việc đã làm" 
                        subLabel={completedTasks.doneTasks[0] ? `Thường xuyên: ${completedTasks.doneTasks[0].taskText}` : undefined}
                        count={completedTasks.doneTasks.length}
                        onClick={() => onNavigate("Công việc đã làm", (
                            <div className="space-y-3">
                                {completedTasks.doneTasks.map((taskGroup) => (
                                    <div key={taskGroup.taskText} className="p-3.5 md:p-4 border rounded-2xl bg-card shadow-sm">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0">
                                                <ListTodo className="h-4 w-4" />
                                            </div>
                                            <p className="font-bold text-sm tracking-tight break-words flex-1 min-w-0">{taskGroup.taskText}</p>
                                            <Badge variant="secondary" className="ml-auto bg-muted text-muted-foreground border-none font-bold shrink-0">
                                                {taskGroup.completions.length} lần
                                            </Badge>
                                        </div>
                                        <div className="space-y-3">
                                            {taskGroup.completions.map((comp, i) => (
                                                <div key={i} className="p-2.5 md:p-3 border rounded-xl bg-muted/20 relative overflow-hidden group">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/20" />
                                                    <div className="flex flex-wrap items-center justify-between gap-y-2 mb-2">
                                                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                                                            <div className="px-2 py-0.5 rounded-full bg-background border text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0">
                                                                {comp.shiftName}
                                                            </div>
                                                            <div className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">
                                                                {format(parseISO(comp.reportDate), 'dd/MM/yy')} {comp.timestamp}
                                                            </div>
                                                        </div>
                                                        {comp.value !== undefined && (
                                                            <Badge variant={comp.value ? "default" : "destructive"} className="h-5 px-1.5 font-bold text-[10px] shrink-0">
                                                                {comp.value ? "Đảm bảo" : "Không"}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {comp.opinion && (
                                                        <p className="text-xs text-foreground/80 font-medium italic mb-2 leading-relaxed bg-background/50 p-2 rounded-lg">
                                                            "{comp.opinion}"
                                                        </p>
                                                    )}
                                                    {comp.photos && comp.photos.length > 0 && (
                                                        <div className="flex flex-wrap gap-2 mt-2">
                                                            {comp.photos.map((photo, pIndex) => (
                                                                <button 
                                                                    key={pIndex} 
                                                                    className="h-14 w-14 md:h-16 md:w-16 relative rounded-xl overflow-hidden bg-muted shadow-sm border border-black/5 hover:scale-110 active:scale-95 transition-all" 
                                                                    onClick={() => onOpenLightbox(
                                                                        comp.photos!.map(p => ({
                                                                            src: p,
                                                                            description: `${taskGroup.taskText} - ${user.displayName} - ${format(parseISO(comp.reportDate), 'dd/MM/yy')} ${comp.timestamp}`
                                                                        })), pIndex
                                                                    )}
                                                                >
                                                                    <Image src={photo} alt={`Photo ${pIndex}`} fill className="object-cover" />
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    />
                )}
                {completedTasks.undoneTasks.length > 0 && (
                    <NavigationItem 
                        icon={ListX} 
                        label="Công việc chưa làm" 
                        subLabel="Các đầu việc còn xót"
                        count={completedTasks.undoneTasks.length}
                        onClick={() => onNavigate("Công việc chưa làm", (
                            <div className="grid grid-cols-1 gap-2">
                                {completedTasks.undoneTasks.map((task) => (
                                    <div key={task.taskText} className="p-3.5 md:p-4 border rounded-2xl bg-card shadow-sm flex items-center gap-3">
                                        <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 shrink-0">
                                            <ListX className="h-4 w-4" />
                                        </div>
                                        <p className="font-bold text-sm tracking-tight leading-snug break-words flex-1 min-w-0">{task.taskText}</p>
                                    </div>
                                ))}
                            </div>
                        ))}
                    />
                )}
                <NavigationItem 
                    icon={AlertTriangle} 
                    label="Vi phạm" 
                    subLabel={data.totalViolations > 0 ? "Chi tiết nội dung vi phạm" : "Lịch sử sạch, không lỗi"}
                    count={data.violations.length}
                    onClick={() => onNavigate("Vi phạm", (
                        <div className="space-y-3">
                            {data.violations.length > 0 ? (
                                data.violations.map(v => (
                                    <div key={v.id} className="p-3.5 md:p-4 border rounded-2xl bg-card shadow-sm flex flex-col gap-2 relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-rose-500/30" />
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-bold text-muted-foreground text-[10px] md:text-xs">{format(parseISO(v.createdAt as string), 'dd/MM/yyyy HH:mm')}</p>
                                            <Badge variant="destructive" className="font-bold tabular-nums text-[10px] md:text-xs">-{v.cost.toLocaleString()}đ</Badge>
                                        </div>
                                        <p className="font-bold text-sm text-foreground tracking-tight leading-relaxed">{v.content}</p>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12 bg-emerald-500/5 rounded-[2.5rem] border border-emerald-500/10">
                                    <ThumbsUp className="h-12 w-12 text-emerald-500/30 mx-auto mb-3" />
                                    <p className="font-bold text-emerald-600 tracking-tight">Tuyệt vời! Không có vi phạm nào</p>
                                </div>
                            )}
                        </div>
                    ))}
                />
                <NavigationItem 
                    icon={Camera} 
                    label="Ảnh đã chụp" 
                    subLabel="Toàn bộ ảnh bằng chứng"
                    count={allPhotos.length}
                    onClick={() => onNavigate("Ảnh đã chụp", (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 md:gap-3">
                            {allPhotos.length > 0 ? (
                                allPhotos.map((photoUrl, i) => (
                                    <button 
                                        key={i} 
                                        className="aspect-square relative rounded-xl md:rounded-2xl overflow-hidden bg-muted shadow-sm border border-black/5 hover:scale-105 active:scale-95 transition-all" 
                                        onClick={() => onOpenLightbox(
                                            allPhotos.map(p => ({
                                                src: p,
                                                description: `Ảnh chụp bởi ${user.displayName}`
                                            })), i
                                        )}
                                    >
                                        <Image src={photoUrl} alt={`Report photo ${i}`} fill className="object-cover" />
                                    </button>
                                ))
                            ) : (
                                <div className="col-span-full text-center py-12 bg-muted/20 rounded-[2.5rem] border border-dashed">
                                    <Camera className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                                    <p className="font-bold text-muted-foreground tracking-tight">Chưa có hình ảnh nào được chụp</p>
                                </div>
                            )}
                        </div>
                    ))}
                />
            </div>
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

function TaskCentricView({ allUsers, monthlyData, tasksByShift, bartenderTasks, comprehensiveTasks, onOpenLightbox, onNavigate }: {
    allUsers: ManagedUser[],
    monthlyData: Record<string, MonthlyUserData>,
    tasksByShift: TasksByShift | null,
    bartenderTasks: TaskSection[] | null,
    comprehensiveTasks: ComprehensiveTaskSection[] | null,
    onOpenLightbox: (slides: { src: string, description?: string }[], index: number) => void;
    onNavigate: (title: string, content: React.ReactNode) => void;
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

    const stats = useMemo(() => {
        let totalTasks = 0;
        let completedTasksCount = 0;
        let totalCompletionsCount = 0;
        const userCompletions: Record<string, { name: string, count: number }> = {};

        Object.values(taskCentricData).forEach(reportGroup => {
            Object.values(reportGroup).forEach(taskGroup => {
                totalTasks++;
                let taskCompletions = 0;
                Object.values(taskGroup.completionsByUser).forEach(uGroup => {
                    const count = uGroup.completions.length;
                    taskCompletions += count;
                    totalCompletionsCount += count;
                    
                    if (!userCompletions[uGroup.user.uid]) {
                        userCompletions[uGroup.user.uid] = { name: uGroup.user.displayName, count: 0 };
                    }
                    userCompletions[uGroup.user.uid].count += count;
                });
                if (taskCompletions > 0) completedTasksCount++;
            });
        });

        const topUser = Object.values(userCompletions).sort((a, b) => b.count - a.count)[0];
        
        return { totalTasks, completedTasksCount, totalCompletionsCount, topUser };
    }, [taskCentricData]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                <div className="p-2.5 md:p-3 rounded-2xl bg-muted/30 border border-border/50 text-center">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70 mb-1">Tổng đầu việc</p>
                    <p className="text-lg md:text-xl font-black text-foreground tracking-tight">{stats.totalTasks}</p>
                </div>
                <div className="p-2.5 md:p-3 rounded-2xl bg-muted/30 border border-border/50 text-center">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70 mb-1">Đã thực hiện</p>
                    <p className="text-lg md:text-xl font-black text-emerald-600 tracking-tight">{stats.completedTasksCount}</p>
                </div>
                <div className="p-2.5 md:p-3 rounded-2xl bg-muted/30 border border-border/50 text-center">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70 mb-1">Tổng lượt làm</p>
                    <p className="text-lg md:text-xl font-black text-primary tracking-tight">{stats.totalCompletionsCount}</p>
                </div>
                <div className="p-2.5 md:p-3 rounded-2xl bg-muted/30 border border-border/50 text-center">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70 mb-1">Tích cực nhất</p>
                    <p className="text-sm md:text-base font-black text-amber-600 tracking-tight truncate px-1">
                        {stats.topUser ? stats.topUser.name.split(' ').pop() : '---'}
                    </p>
                </div>
            </div>

            {Object.entries(taskCentricData).map(([reportType, tasks]) => {
                const totalTypeCompletions = Object.values(tasks).reduce((sum, task) => {
                    return sum + Object.values(task.completionsByUser).reduce((t, u) => t + u.completions.length, 0);
                }, 0);

                return (
                    <div key={reportType} className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <h4 className="text-[10px] uppercase tracking-widest font-black text-muted-foreground/60">{reportType}</h4>
                            <Badge variant="secondary" className="bg-primary/5 text-primary border-none h-5 px-1.5 font-bold text-[10px] uppercase tracking-wider">
                                {Object.keys(tasks).length} đầu việc
                            </Badge>
                        </div>
                        <div className="space-y-2">
                        {Object.entries(tasks).sort(([, a], [, b]) => {
                            const totalCompletionsA = Object.values(a.completionsByUser).reduce((sum, u) => sum + u.completions.length, 0);
                            const totalCompletionsB = Object.values(b.completionsByUser).reduce((sum, u) => sum + u.completions.length, 0);
                            return totalCompletionsB - totalCompletionsA;
                        }).map(([taskText, taskData]) => {
                            const totalCompletions = Object.values(taskData.completionsByUser).reduce((sum, u) => sum + u.completions.length, 0);
                            const uniqueUsers = Object.keys(taskData.completionsByUser).length;
                            const sortedUsers = Object.values(taskData.completionsByUser).sort((a, b) => b.completions.length - a.completions.length);
                            
                            return (
                                <NavigationItem 
                                    key={taskText}
                                    icon={ListTodo}
                                    label={taskText}
                                    subLabel={`${uniqueUsers} nhân viên đã thực hiện`}
                                    count={totalCompletions}
                                    onClick={() => onNavigate(taskText, (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="p-3 md:p-3.5 rounded-2xl bg-primary/5 border border-primary/10 text-center">
                                                    <p className="text-[9px] md:text-[10px] uppercase tracking-wider font-bold text-primary/70 mb-0.5">Tổng lượt làm</p>
                                                    <p className="text-lg md:text-xl font-black text-primary tracking-tight">{totalCompletions}</p>
                                                </div>
                                                <div className="p-3 md:p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 text-center">
                                                    <p className="text-[9px] md:text-[10px] uppercase tracking-wider font-bold text-emerald-600/70 mb-0.5">Nhân viên tham gia</p>
                                                    <p className="text-lg md:text-xl font-black text-emerald-600 tracking-tight">{uniqueUsers}</p>
                                                </div>
                                            </div>
                                            <div className="space-y-2.5 md:space-y-3">
                                            {sortedUsers.map(({ user, completions }) => (
                                                <div key={user.uid} className="p-3 md:p-4 border rounded-2xl bg-card shadow-sm flex flex-col gap-2.5 md:gap-3 relative overflow-hidden">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-primary/20" />
                                                    <div className="flex items-center gap-2.5 md:gap-3">
                                                        <Avatar className="h-8 w-8 md:h-10 md:w-10 border-2 border-primary/10 shrink-0">
                                                            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.displayName}`} />
                                                            <AvatarFallback className="bg-primary/5 text-primary font-bold text-xs md:text-sm">
                                                                {user.displayName.charAt(0)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex flex-col min-w-0 text-left">
                                                            <p className="font-bold text-foreground tracking-tight text-xs md:text-sm truncate">{user.displayName}</p>
                                                            <p className="text-[9px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">{user.role}</p>
                                                        </div>
                                                        <Badge variant="secondary" className="ml-auto bg-primary/5 text-primary border-none font-bold tabular-nums text-[9px] md:text-[10px] h-5 px-1.5">
                                                            {completions.length} lần
                                                        </Badge>
                                                    </div>
                                                    <div className="grid grid-cols-1 min-[375px]:grid-cols-2 sm:grid-cols-3 gap-1.5 md:gap-2 mt-0.5">
                                                        {completions.sort((a, b) => (a.reportDate + a.timestamp).localeCompare(b.reportDate + b.timestamp)).map((comp, i) => (
                                                            <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-muted/30 border border-border/50">
                                                                <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">
                                                                    {format(parseISO(comp.reportDate), 'dd/MM')} {comp.timestamp}
                                                                </span>
                                                                {comp.photos && comp.photos.length > 0 && (
                                                                    <button 
                                                                        onClick={() => onOpenLightbox(
                                                                            comp.photos!.map(p => ({
                                                                                src: p,
                                                                                description: `${taskText} - ${user.displayName} - ${format(parseISO(comp.reportDate), 'dd/MM/yy')} ${comp.timestamp}`
                                                                            })), 0
                                                                        )} 
                                                                        className="p-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0"
                                                                    >
                                                                        <Camera className="h-3 w-3" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                            </div>
                                        </div>
                                    ))}
                                />
                            );
                        })}
                        </div>
                    </div>
                );
            })}
        </div>
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

    const [navStack, setNavStack] = useState<Array<{ title: string, content: React.ReactNode }>>([]);

    const pushView = (title: string, content: React.ReactNode) => {
        setNavStack(prev => [...prev, { title, content }]);
    };

    const popView = () => {
        setNavStack(prev => prev.slice(0, -1));
    };

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
        } else {
            setNavStack([]);
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

    const currentView = navStack[navStack.length - 1];

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange} dialogTag="monthly-staff-report-dialog" parentDialogTag={parentDialogTag}>
                <DialogContent className="max-w-4xl w-[95vw] md:w-full h-[92vh] md:h-[90vh] p-0 overflow-hidden">
                    {/* Portal for the lightbox */}
                    <div id="monthly-report-lightbox-portal"></div>
                    <DialogHeader variant="premium" iconkey="trophy" className="shrink-0">
                        {currentView ? (
                            <div className="flex items-center gap-3">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={popView} 
                                    className="h-9 w-9 rounded-full hover:bg-primary/10 hover:text-primary -ml-2 shrink-0"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </Button>
                                <DialogTitle className="text-left text-base md:text-lg leading-tight break-words line-clamp-2 flex-1">{currentView.title}</DialogTitle>
                            </div>
                        ) : (
                            <>
                                <DialogTitle>Báo cáo Hiệu suất Tháng</DialogTitle>
                                <DialogDescription>
                                    Hiệu suất làm việc của nhân viên trong tháng.
                                </DialogDescription>
                            </>
                        )}
                    </DialogHeader>

                    <DialogBody className="space-y-0 p-0 flex flex-col min-h-0 bg-muted/20 relative">
                        {currentView ? (
                            <div className="flex-1 flex flex-col bg-background animate-in slide-in-from-right duration-300 overflow-hidden">
                                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                                    {currentView.content}
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 px-4 md:px-6 border-b sticky top-0 bg-background z-20 shrink-0 shadow-sm">
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
                                            className="w-full sm:w-[180px]"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between sm:justify-end gap-3 bg-muted/50 sm:bg-transparent p-2 sm:p-0 rounded-xl">
                                        <div className="flex items-center space-x-2">
                                            <Users className="h-4 w-4 text-muted-foreground" />
                                            <Switch
                                                id="view-mode-toggle"
                                                checked={viewMode === 'byTask'}
                                                onCheckedChange={(checked) => setViewMode(checked ? 'byTask' : 'byStaff')}
                                            />
                                            <ListTree className="h-4 w-4 text-muted-foreground" />
                                            <Label htmlFor="view-mode-toggle" className="text-[12px] font-bold uppercase tracking-tight text-muted-foreground">
                                                {viewMode === 'byStaff' ? 'Nhân viên' : 'Công việc'}
                                            </Label>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                                    {isLoading ? (
                                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                                            <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
                                            <p className="text-sm text-muted-foreground font-medium animate-pulse text-center px-4">Đang tải dữ liệu...</p>
                                        </div>
                                    ) : viewMode === 'byStaff' ? (
                                        <div className="w-full space-y-3">
                                            {sortedUsers.map(user => {
                                                const userData = monthlyData[user.uid];
                                                if (!userData) return null;

                                                return (
                                                    <button
                                                        key={user.uid}
                                                        onClick={() => pushView(user.displayName, (
                                                            <StaffMonthlyDetails
                                                                user={user}
                                                                data={userData}
                                                                tasksByShift={tasksByShift}
                                                                bartenderTasks={bartenderTasks}
                                                                comprehensiveTasks={comprehensiveTasks}
                                                                onOpenLightbox={openLightbox}
                                                                onNavigate={pushView}
                                                            />
                                                        ))}
                                                        className="w-full border rounded-2xl bg-card overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/20 active:scale-[0.98] text-left p-4 md:p-5 flex items-center justify-between group"
                                                    >
                                                        <div className="flex items-center gap-3 md:gap-4">
                                                            <Avatar className="h-10 w-10 md:h-12 md:w-12 border-2 border-primary/10">
                                                                <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.displayName}`} />
                                                                <AvatarFallback className="bg-primary/5 text-primary text-base md:text-lg font-bold">
                                                                    {user.displayName.charAt(0)}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className="space-y-0.5 min-w-0">
                                                                <p className="font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">{user.displayName}</p>
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <Badge variant="secondary" className="bg-primary/5 text-primary border-none font-bold text-[9px] md:text-[10px] uppercase tracking-wider h-4 md:h-5">
                                                                        {user.role}
                                                                    </Badge>
                                                                    {userData.totalViolations > 0 && (
                                                                        <Badge variant="destructive" className="h-4 md:h-5 px-1 md:px-1.5 font-bold text-[9px] md:text-[10px]">
                                                                            {userData.totalViolations} lỗi
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/30 group-hover:text-primary transition-colors ml-2" />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <TaskCentricView
                                            allUsers={allUsers}
                                            monthlyData={monthlyData}
                                            tasksByShift={tasksByShift}
                                            bartenderTasks={bartenderTasks}
                                            comprehensiveTasks={comprehensiveTasks}
                                            onOpenLightbox={openLightbox} 
                                            onNavigate={pushView}
                                        />
                                    )}
                                </div>
                            </>
                        )}
                    </DialogBody>
                    <DialogFooter variant="muted" className="shrink-0 border-t">
                        <DialogCancel className="w-full" onClick={() => onOpenChange(false)}>Đóng</DialogCancel>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}