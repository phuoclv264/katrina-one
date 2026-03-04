'use client';
import { useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import Image from '@/components/ui/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import { getQueryParamWithMobileHashFallback } from '@/lib/url-params';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Check, Camera, MessageSquareWarning, MessageSquareText, Clock, X, Image as ImageIcon, Sunrise, Activity, Sunset, CheckCircle, Users, Trash2, Loader2, AlertCircle, FilePen, Info, ListTodo, UserCheck, ListX, Eye, ThumbsUp, ThumbsDown, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { ShiftReport, CompletionRecord, TasksByShift, Shift, Schedule, ManagedUser } from '@/lib/types';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { Combobox } from '@/components/combobox';
import { useAuth } from '@/hooks/use-auth';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import { useToast } from '@/components/ui/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogIcon, AlertDialogTitle, AlertDialogTrigger, } from '@/components/ui/alert-dialog';
import { getISOWeek, getISOWeekYear } from 'date-fns';
import { useLightbox } from '@/contexts/lightbox-context';
import { useAppNavigation } from '@/contexts/app-navigation-context';


const mainShiftTimeFrames: { [key: string]: { start: string; end: string; icon: any; color: string } } = {
    sang: { start: '05:30', end: '12:00', icon: Sunrise, color: 'text-amber-600' },
    trua: { start: '12:00', end: '17:00', icon: Activity, color: 'text-sky-600' },
    toi: { start: '17:00', end: '23:00', icon: Sunset, color: 'text-indigo-600' },
};

function ShiftSummaryCard({
    shift,
    shiftKey,
    date,
    reports,
    schedule,
    allUsers,
    onViewPhotos
}: {
    shift: Shift,
    shiftKey: string,
    date: string,
    reports: ShiftReport[],
    schedule: Schedule | null,
    allUsers: ManagedUser[],
    onViewPhotos: (photos: { src: string, description: string }[], startIndex: number) => void
}) {
    const summary = useMemo(() => {
        const parseTime = (timeStr: string) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
        };

        const mainShiftFrame = mainShiftTimeFrames[shiftKey];
        if (!mainShiftFrame) return { assignedUsers: [], submittedUsers: [], absentUsers: [], uncompletedStartShiftTasks: [], uncompletedInShiftTasks: [], uncompletedEndShiftTasks: [], completedStartShiftTasks: [], completedInShiftTasks: [], completedEndShiftTasks: [], allStartShiftTasksUncompleted: false, allEndShiftTasksUncompleted: false, notes: [] };

        const allShiftsOnDay = schedule?.shifts.filter(s => s.date === date) || [];

        const serverUsers = allUsers.filter(u => u.role === 'Phục vụ');

        const assignedUsersMap = new Map<string, { name: string; shifts: string[] }>();

        const mainShiftStartMinutes = parseTime(mainShiftFrame.start);
        const mainShiftEndMinutes = parseTime(mainShiftFrame.end);

        serverUsers.forEach(user => {
            const userShiftsOnDay = allShiftsOnDay.filter(s => s.assignedUsers.some(au => au.userId === user.uid));

            userShiftsOnDay.forEach(userShift => {
                const shiftStartMinutes = parseTime(userShift.timeSlot.start);
                const shiftEndMinutes = parseTime(userShift.timeSlot.end);
                const overlaps = shiftStartMinutes < mainShiftEndMinutes && mainShiftStartMinutes < shiftEndMinutes;

                if (overlaps) {
                    if (!assignedUsersMap.has(user.uid)) {
                        assignedUsersMap.set(user.uid, { name: user.displayName, shifts: [] });
                    }
                    assignedUsersMap.get(user.uid)!.shifts.push(userShift.label);
                }
            });
        });

        const assignedUsers = Array.from(assignedUsersMap.values()).map(u => ({ name: u.name, shifts: u.shifts })).sort((a, b) => a.name.localeCompare(b.name));
        const submittedUsers = Array.from(new Set(reports.map(r => r.staffName)));
        const absentUsers = assignedUsers.filter(u => !submittedUsers.includes(u.name));


        const allCompletedTasks = new Map<string, { staffName: string; completion: CompletionRecord }[]>();

        reports.forEach(report => {
            for (const taskId in report.completedTasks) {
                if (!allCompletedTasks.has(taskId)) {
                    allCompletedTasks.set(taskId, []);
                }
                const completionsWithStaff = report.completedTasks[taskId].map(comp => ({
                    staffName: report.staffName,
                    completion: comp
                }));
                allCompletedTasks.get(taskId)!.push(...completionsWithStaff);
            }
        });

        // Collect all task-specific notes
        const taskNotes: { staffName: string; taskText: string; note: string; timestamp: string }[] = [];
        allCompletedTasks.forEach((completions, taskId) => {
            const task = shift.sections.flatMap(s => s.tasks).find(t => t.id === taskId);
            if (!task) return;
            completions.forEach(c => {
                if (c.completion.note) {
                    taskNotes.push({
                        staffName: c.staffName,
                        taskText: task.text,
                        note: c.completion.note,
                        timestamp: c.completion.timestamp
                    });
                }
            });
        });
        taskNotes.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

        // Sort completions by timestamp
        allCompletedTasks.forEach((completions) => {
            completions.sort((a, b) => {
                return a.completion.timestamp.localeCompare(b.completion.timestamp);
            });
        });

        const startShiftSection = shift.sections.find(s => s.title === 'Đầu ca');
        const endShiftSection = shift.sections.find(s => s.title === 'Cuối ca');
        const inShiftSection = shift.sections.find(s => s.title === 'Trong ca');

        const uncompletedStartShiftTasks = startShiftSection?.tasks.filter(task => !allCompletedTasks.has(task.id)) || [];
        const uncompletedInShiftTasks = inShiftSection?.tasks.filter(task => !allCompletedTasks.has(task.id)) || [];
        const uncompletedEndShiftTasks = endShiftSection?.tasks.filter(task => !allCompletedTasks.has(task.id)) || [];

        const mapCompletedTasks = (section: typeof startShiftSection) => {
            if (!section) return [];
            return section.tasks
                .map(task => ({
                    taskText: task.text,
                    taskType: task.type,
                    taskMinCompletions: task.minCompletions || 1,
                    completions: allCompletedTasks.get(task.id) || [],
                }))
                .filter(item => item.completions.length > 0);
        };

        const completedStartShiftTasks = mapCompletedTasks(startShiftSection);
        const completedInShiftTasks = mapCompletedTasks(inShiftSection);
        const completedEndShiftTasks = mapCompletedTasks(endShiftSection);

        const allStartShiftTasksUncompleted = startShiftSection ? uncompletedStartShiftTasks.length === startShiftSection.tasks.length : false;
        const allEndShiftTasksUncompleted = endShiftSection ? uncompletedEndShiftTasks.length === endShiftSection.tasks.length : false;

        return {
            uncompletedStartShiftTasks,
            uncompletedInShiftTasks,
            uncompletedEndShiftTasks,
            completedStartShiftTasks,
            completedInShiftTasks,
            completedEndShiftTasks,
            allStartShiftTasksUncompleted,
            allEndShiftTasksUncompleted,
            assignedUsers,
            submittedUsers,
            absentUsers,
            notes: taskNotes,
        };
    }, [shift, shiftKey, date, reports, schedule, allUsers]);

    const hasUncompleted = summary.uncompletedStartShiftTasks.length > 0 || summary.uncompletedEndShiftTasks.length > 0 || summary.uncompletedInShiftTasks.length > 0;
    const hasCompleted = summary.completedStartShiftTasks.length > 0 || summary.completedInShiftTasks.length > 0 || summary.completedEndShiftTasks.length > 0;

    const renderCompletedTaskList = (completedTasks: typeof summary.completedStartShiftTasks) => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {completedTasks.map(item => (
                <div key={item.taskText} className="group flex flex-col p-3 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-md hover:border-amber-200 dark:hover:border-amber-900/50">
                    <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1.5 flex-1">
                            <p className="font-bold text-slate-800 dark:text-slate-100 leading-tight">{item.taskText}</p>
                        </div>
                        {item.taskMinCompletions > 1 && (
                            <Badge variant="secondary" className="bg-amber-100/80 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-none font-bold text-[10px] h-6">
                                x{item.taskMinCompletions}
                            </Badge>
                        )}
                    </div>

                    <div>
                        {item.completions.map((comp, index) => (
                            <div key={index} className="flex items-start gap-2.5 p-1 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-transparent dark:border-slate-800/50 group/item transition-colors">
                                <div className="h-4 w-4 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mt-0.5 shadow-sm">
                                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100">{comp.staffName}</span>
                                            <span className="text-[9px] font-mono text-slate-400">{comp.completion.timestamp}</span>
                                        </div>
                                        {(comp.completion.photos && comp.completion.photos.length > 0) && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 rounded-lg bg-slate-200/50 dark:bg-white/5"
                                                onClick={() => {
                                                    const slides = comp.completion.photos!.map(p => ({
                                                        src: p,
                                                        description: `${item.taskText}\nPhụ trách: ${comp.staffName}\nThời điểm: ${comp.completion.timestamp}`
                                                    }));
                                                    onViewPhotos(slides, 0);
                                                }}>
                                                <ImageIcon className="h-3.5 w-3.5 text-slate-600" />
                                            </Button>
                                        )}
                                    </div>

                                    {item.taskType === 'boolean' && comp.completion.value !== undefined && (
                                        <Badge 
                                            variant={comp.completion.value ? "default" : "destructive"} 
                                            className={`text-[9px] px-1.5 py-0 h-4 font-bold border-none ${comp.completion.value ? 'bg-emerald-500' : 'bg-red-500'}`}
                                        >
                                            {comp.completion.value ? "Đạt" : "K.Đạt"}
                                        </Badge>
                                    )}

                                    {item.taskType === 'opinion' && comp.completion.opinion && (
                                        <p className="text-[11px] italic text-slate-600 dark:text-slate-400 bg-white/50 dark:bg-black/20 p-2 rounded-lg border border-slate-100 dark:border-white/5 mt-1.5 line-clamp-2 hover:line-clamp-none transition-all">
                                            "{comp.completion.opinion}"
                                        </p>
                                    )}

                                    {comp.completion.note && (
                                        <div className="mt-2 flex items-start gap-2 p-2.5 bg-amber-500/5 dark:bg-amber-400/5 border border-amber-500/10 dark:border-amber-400/10 rounded-xl relative">
                                            <div className="h-3 w-1 bg-amber-400 rounded-full mr-1" />
                                            <p className="text-[12px] italic text-amber-900 dark:text-amber-200 leading-snug font-medium">
                                                {comp.completion.note}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );

    const ShiftIcon = mainShiftTimeFrames[shiftKey]?.icon || Info;
    const shiftColor = mainShiftTimeFrames[shiftKey]?.color || 'text-amber-700';

    return (
        <Card className="mb-8 overflow-hidden border-none shadow-md bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/10">
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 to-orange-500" />
            <CardHeader className="pb-4">
                <CardTitle className={`flex items-center gap-3 text-xl font-bold ${shiftColor}`}>
                    <div className="p-2 rounded-xl bg-white/80 dark:bg-black/20 shadow-sm border border-amber-200/50 dark:border-amber-800/20">
                        <ShiftIcon className="h-6 w-6" />
                    </div>
                    Tóm tắt báo cáo {shift.name.toLowerCase()}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
                <div>
                    <h4 className="font-bold flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-200">
                        <Users className="h-5 w-5 text-amber-500" /> Chuyên cần (Phục vụ)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-4 bg-white/70 dark:bg-black/20 rounded-2xl border border-white dark:border-white/5 shadow-sm">
                            <p className="font-semibold text-xs uppercase tracking-wider text-slate-400 mb-2">Được phân công</p>
                            <div className="flex flex-wrap gap-1.5">
                                {summary.assignedUsers.length > 0 ? (
                                    summary.assignedUsers.map((u, i) => (
                                        <Badge key={i} variant="secondary" className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-none font-medium px-2.5 py-1">
                                            {u.name} <span className="opacity-40 mx-1 text-[10px]">•</span> <span className="text-[10px] font-mono">{u.shifts.join(', ')}</span>
                                        </Badge>
                                    ))
                                ) : (
                                    <p className="text-sm text-muted-foreground italic">Không có phân công.</p>
                                )}
                            </div>
                        </div>

                        {summary.absentUsers.length > 0 ? (
                            <div className="p-4 bg-red-50/50 dark:bg-red-950/20 rounded-2xl border border-red-100 dark:border-red-900/30 shadow-sm">
                                <p className="font-semibold text-xs uppercase tracking-wider text-red-400 mb-2">Chưa nộp báo cáo</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {summary.absentUsers.map((u, i) => (
                                        <Badge key={i} variant="destructive" className="bg-red-500 text-white border-none font-bold px-2.5 py-1 animate-pulse">
                                            {u.name}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        ) : summary.assignedUsers.length > 0 ? (
                            <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm flex items-center justify-center">
                                <div className="text-center">
                                    <div className="inline-flex p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 mb-2">
                                        <CheckCircle className="h-5 w-5" />
                                    </div>
                                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">100% HOÀN TẠO BÁO CÁO</p>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>

                {summary.notes.length > 0 && (
                    <div className="pt-6 border-t border-amber-200/50 dark:border-amber-800/20">
                        <h4 className="font-bold flex items-center gap-2 mb-5 text-amber-900 dark:text-amber-400">
                            <MessageSquareText className="h-5 w-5 text-amber-500" /> Điểm tin & Ghi chú quan trọng
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {summary.notes.map((note, idx) => (
                                <div key={idx} className="group relative p-4 bg-white dark:bg-black/30 border-none rounded-2xl shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)] overflow-hidden transition-all hover:shadow-md">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-400" />
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/50 dark:to-orange-900/50 flex items-center justify-center text-xs font-bold text-amber-700 uppercase">
                                                {note.staffName.split(' ').pop()?.[0] || 'N'}
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{note.staffName}</p>
                                                <div className="flex items-center gap-1.5 opacity-40">
                                                    <Clock className="h-3 w-3" />
                                                    <span className="text-[10px] font-mono">{note.timestamp}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className="h-5 text-[9px] uppercase font-bold border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400">Ghi chú</Badge>
                                    </div>
                                    <div className="pl-1">
                                        <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">Công việc:</p>
                                        <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-300 leading-snug mb-3">{note.taskText}</p>
                                        <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-100/50 dark:border-amber-900/30">
                                            <p className="text-[14px] font-medium text-amber-900 dark:text-amber-200 leading-relaxed italic">"{note.note}"</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {hasUncompleted && (
                    <div>
                        <h4 className="font-semibold flex items-center gap-2 mb-2"><ListX /> Công việc chưa hoàn thành</h4>
                        <div className="space-y-3">
                            {summary.uncompletedStartShiftTasks.length > 0 && (
                                <div className="p-3 bg-card rounded-md border">
                                    <p className="font-medium text-sm mb-1 text-muted-foreground">Đầu ca:</p>
                                    {summary.allStartShiftTasksUncompleted ? (
                                        <p className="text-sm italic">Toàn bộ các công việc đầu ca chưa được thực hiện.</p>
                                    ) : (
                                        <ul className="list-disc pl-5 space-y-1 text-sm">
                                            {summary.uncompletedStartShiftTasks.map(task => (
                                                <li key={task.id} className="flex items-center gap-2 flex-wrap">
                                                    <span>{task.text}</span>
                                                    {task.minCompletions && task.minCompletions > 1 && (
                                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-normal whitespace-nowrap">
                                                            x{task.minCompletions} lần
                                                        </Badge>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                            {summary.uncompletedInShiftTasks.length > 0 && (
                                <div className="p-3 bg-card rounded-md border">
                                    <p className="font-medium text-sm mb-1 text-muted-foreground">Trong ca:</p>
                                    <ul className="list-disc pl-5 space-y-1 text-sm">
                                        {summary.uncompletedInShiftTasks.map(task => (
                                            <li key={task.id} className="flex items-center gap-2 flex-wrap">
                                                <span>{task.text}</span>
                                                {task.minCompletions && task.minCompletions > 1 && (
                                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-normal whitespace-nowrap">
                                                        x{task.minCompletions} lần
                                                    </Badge>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {summary.uncompletedEndShiftTasks.length > 0 && (
                                <div className="p-3 bg-card rounded-md border">
                                    <p className="font-medium text-sm mb-1 text-muted-foreground">Cuối ca:</p>
                                    {summary.allEndShiftTasksUncompleted ? (
                                        <p className="text-sm italic">Toàn bộ các công việc cuối ca chưa được thực hiện.</p>
                                    ) : (
                                        <ul className="list-disc pl-5 space-y-1 text-sm">
                                            {summary.uncompletedEndShiftTasks.map(task => (
                                                <li key={task.id} className="flex items-center gap-2 flex-wrap">
                                                    <span>{task.text}</span>
                                                    {task.minCompletions && task.minCompletions > 1 && (
                                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-normal whitespace-nowrap">
                                                            x{task.minCompletions} lần
                                                        </Badge>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {hasCompleted && (
                    <div>
                        <h4 className="font-semibold flex items-center gap-2 mb-2"><ListTodo /> Công việc đã hoàn thành</h4>
                        <Accordion type="multiple" defaultValue={['start-shift-completed', 'in-shift-completed', 'end-shift-completed']} className="w-full space-y-2">
                            {summary.completedStartShiftTasks.length > 0 && (
                                <AccordionItem value="start-shift-completed" className="border rounded-md bg-card">
                                    <AccordionTrigger className="p-3 font-medium hover:no-underline text-base">Đầu ca</AccordionTrigger>
                                    <AccordionContent className="p-3 border-t">{renderCompletedTaskList(summary.completedStartShiftTasks)}</AccordionContent>
                                </AccordionItem>
                            )}
                            {summary.completedInShiftTasks.length > 0 && (
                                <AccordionItem value="in-shift-completed" className="border rounded-md bg-card">
                                    <AccordionTrigger className="p-3 font-medium hover:no-underline text-base">Trong ca</AccordionTrigger>
                                    <AccordionContent className="p-3 border-t">{renderCompletedTaskList(summary.completedInShiftTasks)}</AccordionContent>
                                </AccordionItem>
                            )}
                            {summary.completedEndShiftTasks.length > 0 && (
                                <AccordionItem value="end-shift-completed" className="border rounded-md bg-card">
                                    <AccordionTrigger className="p-3 font-medium hover:no-underline text-base">Cuối ca</AccordionTrigger>
                                    <AccordionContent className="p-3 border-t">{renderCompletedTaskList(summary.completedEndShiftTasks)}</AccordionContent>
                                </AccordionItem>
                            )}
                        </Accordion>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}


function ReportView() {
    const { openLightbox } = useLightbox();
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const navigation = useAppNavigation();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const date = getQueryParamWithMobileHashFallback({
        param: 'date',
        searchParams,
        hash: typeof window !== 'undefined' ? window.location.hash : '',
    });
    const shiftKey = getQueryParamWithMobileHashFallback({
        param: 'shiftKey',
        searchParams,
        hash: typeof window !== 'undefined' ? window.location.hash : '',
    });

    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const handleDataRefresh = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
    }, []);

    const [reports, setReports] = useState<ShiftReport[]>([]);
    const [tasksByShift, setTasksByShift] = useState<TasksByShift | null>(null);
    const [schedule, setSchedule] = useState<Schedule | null>(null);
    const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);


    useEffect(() => {
        if (!authLoading && (!user || (user.role !== 'Chủ nhà hàng' && user.role !== 'Quản lý'))) {
            router.replace('/shifts');
            return;
        }
    }, [authLoading, user, router]);

    useEffect(() => {
        if (!date || !shiftKey) {
            setIsLoading(false);
            return;
        }

        let isMounted = true;
        let loadingFlags = { tasks: false, reports: false, schedule: false, users: false };

        const checkAllLoaded = () => {
            if (Object.values(loadingFlags).every(Boolean) && isMounted) {
                setIsLoading(false);
            }
        };

        const unsubTasks = dataStore.subscribeToTasks((tasks) => {
            if (isMounted) {
                setTasksByShift(tasks);
                loadingFlags.tasks = true;
                checkAllLoaded();
            }
        });

        const unsubUsers = dataStore.subscribeToUsers((users) => {
            if (isMounted) {
                setAllUsers(users);
                loadingFlags.users = true;
                checkAllLoaded();
            }
        });

        const weekId = `${getISOWeekYear(new Date(date))}-W${getISOWeek(new Date(date))}`;
        const unsubSchedule = dataStore.subscribeToSchedule(weekId, (sch) => {
            if (isMounted) {
                setSchedule(sch);
                loadingFlags.schedule = true;
                checkAllLoaded();
            }
        });

        const unsubReports = dataStore.subscribeToReportsForShift(date, shiftKey, (fetchedReports) => {
            if (isMounted) {
                setReports(fetchedReports);

                if (selectedReportId && !fetchedReports.some(r => r.id === selectedReportId) && selectedReportId !== 'summary') {
                    setSelectedReportId(fetchedReports.length > 0 ? 'summary' : null);
                } else if (!selectedReportId && fetchedReports.length > 0) {
                    setSelectedReportId('summary');
                } else if (fetchedReports.length === 0) {
                    setSelectedReportId(null);
                }

                loadingFlags.reports = true;
                checkAllLoaded();
            }
        });

        return () => {
            isMounted = false;
            unsubTasks();
            unsubReports();
            unsubSchedule();
            unsubUsers();
        };
    }, [date, shiftKey, refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

    useDataRefresher(handleDataRefresh);

    const reportToView = useMemo(() => {
        if (!selectedReportId) return null;
        if (selectedReportId === 'summary') {
            const combinedTasks: { [taskId: string]: CompletionRecord[] } = {};
            let combinedIssues: string[] = [];

            reports.forEach(report => {
                // Combine tasks
                for (const taskId in report.completedTasks) {
                    if (!combinedTasks[taskId]) {
                        combinedTasks[taskId] = [];
                    }
                    const tasksWithStaffName = report.completedTasks[taskId].map(comp => ({
                        ...comp,
                        staffName: report.staffName // Inject staffName into each completion
                    }));
                    combinedTasks[taskId].push(...tasksWithStaffName);
                }
                // Combine issues
                if (report.issues) {
                    combinedIssues.push(`${report.staffName}: ${report.issues}`);
                }
            });

            // Sort completions for each task chronologically (newest first)
            for (const taskId in combinedTasks) {
                combinedTasks[taskId].sort((a, b) => {
                    const timeA = a.timestamp.replace(':', '');
                    const timeB = b.timestamp.replace(':', '');
                    return timeB.localeCompare(timeA); // Sort descending
                });
            }

            return {
                id: 'summary',
                staffName: 'Tổng hợp',
                shiftKey: shiftKey as string,
                date: date as string,
                completedTasks: combinedTasks,
                issues: combinedIssues.length > 0 ? combinedIssues.join('\n\n') : null,
            } as unknown as ShiftReport;
        }
        return reports.find(r => r.id === selectedReportId) || null;
    }, [reports, selectedReportId, shiftKey, date]);

    const shift = useMemo(() => {
        return tasksByShift && shiftKey ? tasksByShift[shiftKey] : null;
    }, [tasksByShift, shiftKey]);

    const getSectionIcon = (title: string) => {
        switch (title) {
            case 'Đầu ca': return <Sunrise className="mr-3 h-5 w-5 text-yellow-500" />;
            case 'Trong ca': return <Activity className="mr-3 h-5 w-5 text-sky-500" />;
            case 'Cuối ca': return <Sunset className="mr-3 h-5 w-5 text-indigo-500" />;
            default: return null;
        }
    }

    const getSectionBorderColor = (title: string) => {
        switch (title) {
            case 'Đầu ca': return 'border-yellow-500/80';
            case 'Trong ca': return 'border-sky-500/80';
            case 'Cuối ca': return 'border-indigo-500/80';
            default: return 'border-border';
        }
    }

    const handleDeleteReport = async () => {
        if (!reportToView || reportToView.id === 'summary' || user?.role !== 'Chủ nhà hàng') return;
        setIsProcessing(true);
        const reportNameToDelete = reportToView.staffName;
        try {
            await dataStore.deleteShiftReport(reportToView.id);
            toast({
                title: "Đã xóa báo cáo",
                description: `Báo cáo của ${reportNameToDelete} đã được xóa thành công.`,
            });
            // The useEffect will handle the state update and re-selection
        } catch (error) {
            console.error("Error deleting report:", error);
            toast({
                title: "Lỗi",
                description: "Không thể xóa báo cáo. Vui lòng thử lại.",
                variant: "destructive"
            });
        } finally {
            setIsProcessing(false);
        }
    }

    if (isLoading || authLoading) {
        return <LoadingPage />;
    }

    if (!date || !shiftKey) {
        return (
            <div className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8">
                <h1 className="text-2xl font-bold">Lỗi truy cập.</h1>
                <p className="text-muted-foreground">URL không hợp lệ. Vui lòng quay lại và thử lại.</p>
            </div>
        );
    }

    if (reports.length === 0 && !schedule) {
        return (
            <div className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8">
                <h1 className="text-2xl font-bold">Không tìm thấy báo cáo.</h1>
                <p className="text-muted-foreground">Không có báo cáo nào được nộp cho ca này vào ngày đã chọn.</p>
            </div>
        )
    }

    if (!shift) {
        return (
            <div className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8">
                <h1 className="text-2xl font-bold">Lỗi dữ liệu ca làm việc.</h1>
                <p className="text-muted-foreground">Không thể tải cấu trúc ca làm việc cho báo cáo này.</p>
            </div>
        );
    }

    return (
        <>
            <div className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8">
                <header className="mb-8">
                    <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold font-headline">Báo cáo {shift.name}</h1>
                            <p className="text-muted-foreground">
                                Ngày {new Date(date).toLocaleDateString('vi-VN')}
                            </p>
                        </div>
                        {reports.length > 0 && (
                            <div className="w-full md:w-auto md:min-w-[280px] space-y-2">
                                <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 ml-1">Chế độ xem báo cáo</label>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                        <Combobox
                                            value={selectedReportId || ''}
                                            onChange={(val) => setSelectedReportId(val as string)}
                                            options={[
                                                { value: "summary", label: "✨ Tổng hợp toàn ca" },
                                                ...reports.map(r => ({ value: r.id, label: `👤 ${r.staffName}` }))
                                            ]}
                                            placeholder="Chọn báo cáo..."
                                            compact
                                            searchable={false}
                                            disabled={isProcessing}
                                            className="w-full h-11 rounded-xl border-slate-200 shadow-sm"
                                        />
                                    </div>
                                    {user?.role === 'Chủ nhà hàng' && selectedReportId && selectedReportId !== 'summary' && (
                                        <AlertDialog dialogTag="alert-dialog" parentDialogTag="root" variant="destructive">
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600 border border-red-100" disabled={isProcessing}>
                                                    <Trash2 className="h-5 w-5" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="rounded-3xl">
                                                <AlertDialogHeader>
                                                    <AlertDialogIcon icon={Trash2} />
                                                    <div className="space-y-2 text-center sm:text-left">
                                                        <AlertDialogTitle>Xác nhận xóa báo cáo?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Hành động này sẽ xóa vĩnh viễn báo cáo của <span className="font-bold">{reportToView?.staffName}</span> và tất cả hình ảnh liên quan. Hành động này không thể được hoàn tác.
                                                        </AlertDialogDescription>
                                                    </div>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel className="rounded-xl">Hủy</AlertDialogCancel>
                                                    <AlertDialogAction onClick={handleDeleteReport} className="rounded-xl bg-red-500 hover:bg-red-600">Xóa vĩnh viễn</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </header>

                <ShiftSummaryCard
                    shift={shift}
                    shiftKey={shiftKey}
                    date={date}
                    reports={reports}
                    schedule={schedule}
                    allUsers={allUsers}
                    onViewPhotos={openLightbox}
                />

                {!reportToView ? (
                    <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                        <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500 font-medium tracking-tight">Vui lòng chọn một báo cáo để xem chi tiết.</p>
                    </div>
                ) : (
                    <div className="space-y-10">
                        <Accordion type="single" collapsible value={isDetailViewOpen ? 'details' : ''} onValueChange={(value) => setIsDetailViewOpen(value === 'details')}>
                            <AccordionItem value="details" className="border-none">
                                <div className="text-center mb-4">
                                    <AccordionTrigger className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 hover:no-underline transition-all group">
                                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                            <Eye className="h-4 w-4" />
                                            {isDetailViewOpen ? 'Ẩn báo cáo chi tiết' : 'Xem chi tiết từng mục'}
                                        </div>
                                    </AccordionTrigger>
                                </div>
                                <AccordionContent className="pt-4">
                                    <div className="space-y-8">
                                        {shift.sections.map((section) => (
                                            <div key={section.title} className="space-y-4">
                                                <div className="flex items-center gap-3 px-2">
                                                    <div className="h-10 w-10 flex items-center justify-center rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
                                                        {getSectionIcon(section.title)}
                                                    </div>
                                                    <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">{section.title}</h3>
                                                </div>
                                                
                                                <div className="grid grid-cols-1 gap-3">
                                                    {section.tasks.map((task) => {
                                                        const completions = (reportToView.completedTasks[task.id] || []) as CompletionRecord[];
                                                        const isCompleted = completions.length > 0;

                                                        return (
                                                            <div key={task.id} className={`group relative rounded-[1.5rem] border transition-all p-5 ${isCompleted ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm' : 'bg-slate-50/50 dark:bg-slate-900/20 border-slate-100 dark:border-slate-800/40 opacity-60'}`}>
                                                                <div className="flex items-start gap-4">
                                                                    <div className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors ${isCompleted ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-200 dark:bg-slate-800'}`}>
                                                                        {isCompleted ? <Check className="h-3.5 w-3.5 stroke-[4]" /> : <X className="h-3.5 w-3.5 text-slate-400" />}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className={`text-base font-bold leading-tight ${isCompleted ? 'text-slate-900 dark:text-slate-50' : 'text-slate-500'}`}>
                                                                            {task.text}
                                                                        </p>
                                                                        
                                                                        {isCompleted && (
                                                                            <div className="mt-4 space-y-4">
                                                                                {completions.map((completion, cIndex) => (
                                                                                    <div key={cIndex} className="pt-4 border-t border-slate-50 dark:border-slate-800 first:border-t-0 first:pt-0">
                                                                                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                                                                                            <div className="flex items-center gap-3">
                                                                                                <Badge variant="outline" className="h-6 rounded-lg text-[10px] font-mono border-slate-200 text-slate-500 bg-slate-50/50">
                                                                                                    {completion.timestamp}
                                                                                                </Badge>
                                                                                                {selectedReportId === 'summary' && (
                                                                                                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-md">
                                                                                                        👤 {(completion as any).staffName}
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>

                                                                                        {task.type === 'photo' && (
                                                                                            completion.photos && completion.photos.length > 0 ? (
                                                                                                <div className="flex flex-wrap gap-2">
                                                                                                    {completion.photos.map((photo, pIndex) => (
                                                                                                        <button
                                                                                                            onClick={() => {
                                                                                                                const slides = completion.photos!.map(p => ({
                                                                                                                    src: p,
                                                                                                                    description: `${task.text}\nPhụ trách: ${(completion as any).staffName || reportToView.staffName}\nThời gian: ${completion.timestamp}`
                                                                                                                }));
                                                                                                                const currentPhotoIndex = completion.photos!.findIndex(p => p === photo);
                                                                                                                openLightbox(slides, currentPhotoIndex);
                                                                                                            }}
                                                                                                            key={photo.slice(0, 50) + pIndex}
                                                                                                            className="relative overflow-hidden w-20 h-20 sm:w-24 sm:h-24 rounded-2xl group ring-2 ring-slate-100 dark:ring-slate-800 transition-all hover:ring-amber-400 hover:scale-105 active:scale-95 shadow-sm"
                                                                                                        >
                                                                                                            <Image src={photo} alt="Minh chứng" fill className="object-cover" />
                                                                                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                                                                <Eye className="text-white h-5 w-5" />
                                                                                                            </div>
                                                                                                        </button>
                                                                                                    ))}
                                                                                                </div>
                                                                                            ) : (
                                                                                                <p className="text-xs text-slate-400 italic">Không có ảnh bằng chứng.</p>
                                                                                            )
                                                                                        )}

                                                                                        {task.type === 'boolean' && completion.value !== undefined && (
                                                                                            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${completion.value ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' : 'bg-red-100 text-red-700 dark:bg-red-900/30'}`}>
                                                                                                {completion.value ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
                                                                                                {completion.value ? 'ĐẠT YÊU CẦU' : 'CHƯA ĐẠT'}
                                                                                            </div>
                                                                                        )}

                                                                                        {task.type === 'opinion' && (
                                                                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                                                                                                <p className="text-sm font-medium italic text-slate-700 dark:text-slate-300 leading-relaxed">
                                                                                                    {completion.opinion || "Đã xác nhận, không có ý kiến bổ sung."}
                                                                                                </p>
                                                                                            </div>
                                                                                        )}

                                                                                        {completion.note && (
                                                                                            <div className="mt-3 flex items-start gap-2.5 p-3.5 bg-amber-500/5 dark:bg-amber-400/5 border border-amber-500/10 dark:border-amber-400/10 rounded-[1.25rem]">
                                                                                                <MessageSquareText className="h-3.5 w-3.5 text-amber-500 mt-1 shrink-0" />
                                                                                                <p className="text-[13px] italic text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                                                                                                    "{completion.note}"
                                                                                                </p>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>

                        {reportToView.issues && (
                            <div className="relative pt-6">
                                <div className="absolute -top-3 left-8 px-4 py-1.5 bg-red-500 rounded-full shadow-lg shadow-red-500/20 z-10">
                                    <p className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                                        <MessageSquareWarning className="h-3 w-3" /> Cảnh báo quan trọng
                                    </p>
                                </div>
                                <div className="rounded-[2rem] bg-gradient-to-br from-red-50 to-orange-50/50 dark:from-red-950/20 dark:to-orange-950/10 p-8 border border-red-100 dark:border-red-900/30 shadow-inner">
                                    <p className="text-sm font-medium text-red-900 dark:text-red-200 italic leading-relaxed whitespace-pre-wrap">
                                        {reportToView.issues}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}

export default function ByShiftPage() {
    return (
        <Suspense fallback={<LoadingPage />}>
            <ReportView />
        </Suspense>
    )
}
