'use client';
import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { dataStore } from '@/lib/data-store';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import type { Task, TasksByShift, TaskSection, ParsedServerTask, GenerateServerTasksOutput } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, ListTodo, ArrowUp, ArrowDown, ChevronsDownUp, Wand2, Loader2, FileText, Image as ImageIcon, Star, Shuffle, Check, Pencil, AlertCircle, Sparkles, CheckSquare, MessageSquare, Download, MapPin } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sun, Moon, Sunset } from 'lucide-react';
import { toast } from '@/components/ui/pro-toast';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { useAuth } from '@/hooks/use-auth';
import { useAppNavigation } from '@/contexts/app-navigation-context';
import { Textarea } from '@/components/ui/textarea';
import { callGenerateServerTasks, callSortTasks } from '@/lib/ai-service';
import { Combobox } from '@/components/combobox';
import { 
    Dialog, 
    DialogContent, 
    DialogTitle, 
    DialogHeader, 
    DialogDescription, 
    DialogBody, 
    DialogFooter, 
    DialogAction, 
    DialogCancel 
} from '@/components/ui/dialog';
import { diffChars } from 'diff';
import { Badge } from '@/components/ui/badge';
import { TaskDialog } from './_components/task-dialog';

export default function TaskListsPage() {
    const { user, loading: authLoading } = useAuth();
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [tasksByShift, setTasksByShift] = useState<TasksByShift | null>(null);
    const navigation = useAppNavigation();
    const [isLoading, setIsLoading] = useState(true);
    const [isSorting, setIsSorting] = useState(false);
    const [addingToSection, setAddingToSection] = useState<{ shiftKey: string; sectionTitle: string } | null>(null);
    const [editingTask, setEditingTask] = useState<{ shiftKey: string; sectionTitle: string; taskId: string; text: string; type: Task['type']; minCompletions: number; isCritical: boolean; instruction?: { text?: string; images?: { url: string; caption?: string }[] } } | null>(null);

    const [openSections, setOpenSections] = useState<{ [shiftKey: string]: string[] }>({});

    const handleDataRefresh = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
    }, []);

    useEffect(() => {
        if (!authLoading) {
            if (!user || user.role !== 'Chủ nhà hàng') {
                navigation.replace('/shifts');
            } else {
                const unsubscribe = dataStore.subscribeToTasks((tasks) => {
                    setTasksByShift(tasks);
                    setIsLoading(false);
                    const initialOpenState: { [shiftKey: string]: string[] } = {};
                    for (const shiftKey in tasks) {
                        if (!openSections[shiftKey]) {
                            initialOpenState[shiftKey] = tasks[shiftKey].sections.map(s => s.title);
                        }
                    }
                    if (Object.keys(initialOpenState).length > 0) {
                        setOpenSections(prev => ({ ...prev, ...initialOpenState }));
                    }
                });
                return () => unsubscribe();
            }
        }
    }, [user, authLoading, navigation, refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

    useDataRefresher(handleDataRefresh);

    const handleUpdateAndSave = (newTasks: TasksByShift, showToast: boolean = true) => {
        setTasksByShift(newTasks);
        dataStore.updateTasks(newTasks).then(() => {
            if (showToast) {
                toast.success("Đã lưu thay đổi!");
            }
        }).catch(err => {
            toast.error("Không thể lưu thay đổi. Vui lòng thử lại.");
            console.error(err);
        });
    }

    const onAiAddTasks = (tasks: ParsedServerTask[], shiftKey: string, sectionTitle: string) => {
        if (!tasksByShift) return;

        const newTasksToAdd: Task[] = tasks.map(task => ({
            id: `task-${Date.now()}-${Math.random()}`,
            text: task.text,
            isCritical: task.isCritical,
            type: task.type,
        }));

        const newTasksState = JSON.parse(JSON.stringify(tasksByShift));
        // This is a simplified logic. A more robust solution would parse the task text
        // to determine the correct shift and section. For now, it adds to a default.
        const section = newTasksState[shiftKey]?.sections.find((s: TaskSection) => s.title === sectionTitle);

        if (section) {
            section.tasks.push(...newTasksToAdd);
            handleUpdateAndSave(newTasksState);
            if (!(openSections[shiftKey] || []).includes(sectionTitle)) {
                setOpenSections(prev => {
                    const newOpen = { ...prev };
                    if (!newOpen[shiftKey]) newOpen[shiftKey] = [];
                    newOpen[shiftKey].push(sectionTitle);
                    return newOpen;
                });
            }
        } else {
            toast.error("Không tìm thấy ca hoặc mục để thêm công việc vào.");
        }
    };

    const onAiSortTasks = (sortedTasksText: string[], shiftKey: string, sectionTitle: string) => {
        if (!tasksByShift) return;
        const newTasksState = JSON.parse(JSON.stringify(tasksByShift));
        const section = newTasksState[shiftKey]?.sections.find((s: TaskSection) => s.title === sectionTitle);

        if (section) {
            const taskMap = new Map(section.tasks.map((t: Task) => [t.text, t]));
            const sortedTasks: Task[] = sortedTasksText.map(text => taskMap.get(text)).filter((t): t is Task => !!t);

            if (sortedTasks.length === section.tasks.length) {
                section.tasks = sortedTasks;
                handleUpdateAndSave(newTasksState);
            } else {
                toast.error("Không thể khớp các công việc đã sắp xếp. Thay đổi đã bị hủy.");
            }
        }
    };

    const handleAddTask = (shiftKey: string, sectionTitle: string, taskData: Omit<Task, 'id'>) => {
        if (!tasksByShift) return;

        const newTaskToAdd: Task = {
            id: `task-${Date.now()}`,
            ...taskData
        };

        const newTasksState = JSON.parse(JSON.stringify(tasksByShift));
        const section = newTasksState[shiftKey].sections.find((s: TaskSection) => s.title === sectionTitle);
        if (section) {
            section.tasks.push(newTaskToAdd);
            handleUpdateAndSave(newTasksState);
        } else {
            toast.error("Không tìm thấy ca hoặc mục để thêm công việc vào.");
        }
    };

    const handleUpdateTask = (data: Omit<Task, 'id'>) => {
        if (!tasksByShift || !editingTask) {
            setEditingTask(null);
            return;
        }

        const { shiftKey, sectionTitle, taskId } = editingTask;
        const { text, type, minCompletions, isCritical, instruction } = data;
        const newTasksState = JSON.parse(JSON.stringify(tasksByShift));
        const section = newTasksState[shiftKey]?.sections.find((s: TaskSection) => s.title === sectionTitle);
        if (section) {
            const task = section.tasks.find((t: Task) => t.id === taskId);
            if (task) {
                task.text = text.trim();
                task.type = type;
                task.minCompletions = minCompletions || 1;
                task.isCritical = isCritical;
                task.instruction = instruction;
            }
        }
        handleUpdateAndSave(newTasksState);
        setEditingTask(null);
    };

    const handleToggleCritical = (shiftKey: string, sectionTitle: string, taskId: string) => {
        if (!tasksByShift) return;
        const newTasksState = JSON.parse(JSON.stringify(tasksByShift));
        const section = newTasksState[shiftKey].sections.find((s: TaskSection) => s.title === sectionTitle);
        if (section) {
            const task = section.tasks.find((t: Task) => t.id === taskId);
            if (task) {
                task.isCritical = !task.isCritical;
            }
        }
        handleUpdateAndSave(newTasksState);
    };

    const handleDeleteTask = (shiftKey: string, sectionTitle: string, taskId: string) => {
        if (!tasksByShift) return;
        const newTasksState = JSON.parse(JSON.stringify(tasksByShift));
        const section = newTasksState[shiftKey].sections.find((s: TaskSection) => s.title === sectionTitle);
        if (section) {
            section.tasks = section.tasks.filter((task: Task) => task.id !== taskId);
        }
        handleUpdateAndSave(newTasksState);
    };

    const handleMoveTask = (shiftKey: string, sectionTitle: string, taskIndex: number, direction: 'up' | 'down') => {
        if (!tasksByShift) return;
        const newTasksState = JSON.parse(JSON.stringify(tasksByShift));
        const section = newTasksState[shiftKey].sections.find((s: TaskSection) => s.title === sectionTitle);
        if (!section) return;

        const tasks = section.tasks;
        const newIndex = direction === 'up' ? taskIndex - 1 : taskIndex + 1;
        if (newIndex < 0 || newIndex >= tasks.length) return;

        [tasks[taskIndex], tasks[newIndex]] = [tasks[newIndex], tasks[taskIndex]];
        handleUpdateAndSave(newTasksState, false);
    }

    const handleToggleAll = (shiftKey: string) => {
        if (!tasksByShift?.[shiftKey]) return;
        const areAllOpen = (openSections[shiftKey] || []).length === tasksByShift[shiftKey].sections.length;
        if (areAllOpen) {
            setOpenSections(prev => ({ ...prev, [shiftKey]: [] }));
        } else {
            setOpenSections(prev => ({ ...prev, [shiftKey]: tasksByShift[shiftKey].sections.map(s => s.title) }));
        }
    };

    const toggleSortMode = () => {
        const newSortState = !isSorting;
        setIsSorting(newSortState);
        if (!newSortState) {
            toast.success("Đã lưu thứ tự mới!");
        }
    }

    const handleExport = (shiftKey: string) => {
        if (!tasksByShift || !tasksByShift[shiftKey]) return;
        const shift = tasksByShift[shiftKey];

        // Export payload is versioned so it can be imported reliably later.
        const exportPayload = {
            __exportVersion: 1,
            exportedAt: new Date().toISOString(),
            shiftKey,
            shift: shift,
        } as const;

        const json = JSON.stringify(exportPayload, null, 2);

        try {
            // Trigger a file download with full JSON (includes ids, minCompletions, instruction, etc.)
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const safeName = (shift.name || shiftKey).replace(/\s+/g, '_').toLowerCase();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            a.download = `${safeName}-tasks-${timestamp}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

            toast.success(`Đã xuất danh sách công việc của ${shift.name} — file đã được tải xuống.`);
        } catch (err) {
            // Fallback: copy JSON to clipboard so user can still import later
            navigator.clipboard.writeText(json).then(() => {
                toast.success(`Đã sao chép JSON xuất để dán (dự phòng).`);
            }).catch(() => {
                toast.error('Không thể xuất dữ liệu.');
            });
        }
    };

    if (isLoading || authLoading) {
        return <LoadingPage />;
    }

    if (!tasksByShift) {
        return (
            <div className="container mx-auto max-w-4xl p-12 text-center space-y-4">
                <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                    <AlertCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-semibold">Không thể tải dữ liệu</h2>
                <p className="text-muted-foreground">Vui lòng kiểm tra kết nối mạng và thử lại.</p>
                <Button onClick={handleDataRefresh} variant="outline">Thử lại</Button>
            </div>
        );
    }

    const getTaskTypeIcon = (type: Task['type']) => {
        switch (type) {
            case 'photo': return <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-md"><ImageIcon className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" /></div>;
            case 'boolean': return <div className="p-1.5 bg-sky-100 dark:bg-sky-900/30 rounded-md"><CheckSquare className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" /></div>;
            case 'opinion': return <div className="p-1.5 bg-orange-100 dark:bg-orange-900/30 rounded-md"><MessageSquare className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0" /></div>;
            default: return null;
        }
    }

    const totalTasks = Object.values(tasksByShift).reduce((acc, shift) => acc + shift.sections.reduce((sAcc, section) => sAcc + section.tasks.length, 0), 0);

    return (
        <div className="container mx-auto max-w-5xl p-4 sm:p-6 md:p-8 space-y-8 pb-20">
            <header className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 border-b pb-6">
                <div className="space-y-1">
                    <h1 className="text-3xl md:text-4xl font-extrabold font-headline tracking-tight text-foreground">
                        Quản lý công việc
                    </h1>
                    <p className="text-lg text-muted-foreground">
                        Hệ thống hóa quy trình vận hành cho từng ca làm việc.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="px-3 py-1 text-sm font-medium bg-secondary/50 border-primary/20 text-primary">
                        {totalTasks} nhiệm vụ đang áp dụng
                    </Badge>
                </div>
            </header>

            <Tabs defaultValue="sang" className="w-full space-y-6">
                <TabsList className="grid w-full grid-cols-3 p-1.5 h-auto bg-muted/50 rounded-2xl border">
                    <TabsTrigger value="sang" className="rounded-xl py-3 data-[state=active]:bg-amber-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300">
                        <Sun className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="font-semibold hidden sm:inline">Ca Sáng</span>
                        <span className="font-semibold sm:hidden text-xs">Sáng</span>
                    </TabsTrigger>
                    <TabsTrigger value="trua" className="rounded-xl py-3 data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300">
                        <Sunset className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="font-semibold hidden sm:inline">Ca Trưa</span>
                        <span className="font-semibold sm:hidden text-xs">Trưa</span>
                    </TabsTrigger>
                    <TabsTrigger value="toi" className="rounded-xl py-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300">
                        <Moon className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="font-semibold hidden sm:inline">Ca Tối</span>
                        <span className="font-semibold sm:hidden text-xs">Tối</span>
                    </TabsTrigger>
                </TabsList>

                {Object.entries(tasksByShift).map(([shiftKey, shiftData]) => {
                    const areAllSectionsOpen = (openSections[shiftKey] || []).length === shiftData.sections.length;
                    return (
                        <TabsContent value={shiftKey} key={shiftKey} className="animate-in fade-in slide-in-from-bottom-2 duration-500 mt-0">
                            <Card className="border-none shadow-xl ring-1 ring-border overflow-hidden">
                                <CardHeader className="border-b bg-muted/20 pb-4">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "p-3 rounded-2xl text-white shadow-inner",
                                                shiftKey === 'sang' ? "bg-amber-500" : shiftKey === 'trua' ? "bg-orange-500" : "bg-indigo-600"
                                            )}>
                                                <ListTodo className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-2xl font-headline">Công việc {shiftData.name}</CardTitle>
                                                <CardDescription className="text-sm">Tối ưu các hoạt động vận hành trong {shiftData.name.toLowerCase()}.</CardDescription>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                                            <Button variant="outline" size="sm" onClick={() => handleExport(shiftKey)} className="h-9 px-3 rounded-lg hover:bg-secondary">
                                                <Download className="mr-2 h-4 w-4" />
                                                Xuất
                                            </Button>
                                            <Button variant={isSorting ? "default" : "outline"} size="sm" onClick={toggleSortMode} className="h-9 px-3 rounded-lg">
                                                {isSorting ? <Check className="mr-2 h-4 w-4" /> : <Shuffle className="mr-2 h-4 w-4 text-muted-foreground" />}
                                                {isSorting ? "Xong" : "Sắp xếp"}
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => handleToggleAll(shiftKey)} className="h-9 px-3 rounded-lg">
                                                <ChevronsDownUp className="mr-2 h-4 w-4 text-muted-foreground" />
                                                {areAllSectionsOpen ? 'Thu gọn' : 'Mở rộng'}
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <Accordion
                                        type="multiple"
                                        value={openSections[shiftKey] || []}
                                        onValueChange={(value) => setOpenSections(prev => ({ ...prev, [shiftKey]: value }))}
                                        className="w-full"
                                    >
                                        {shiftData.sections.map(section => (
                                            <AccordionItem value={section.title} key={section.title} className="border-b last:border-0 px-4 sm:px-8">
                                                <AccordionTrigger className="hover:no-underline py-5 group" disabled={isSorting}>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-bold text-xl group-hover:text-primary transition-colors">{section.title}</span>
                                                        <Badge variant="secondary" className="font-normal rounded-full px-2.5 h-6">{section.tasks.length}</Badge>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="pb-8">
                                                    <div className="space-y-5 pt-2">
                                                        <div className="space-y-3">
                                                            {section.tasks.map((task, taskIndex) => (
                                                                <div key={task.id} className={cn(
                                                                    "group relative flex flex-col md:flex-row md:items-center gap-3 md:gap-4 rounded-2xl border p-3 md:p-4 transition-all duration-200 hover:shadow-lg",
                                                                    task.isCritical ? "border-amber-200 bg-amber-50/50 dark:bg-amber-950/10 shadow-sm" : "bg-card border-muted/60"
                                                                )}>
                                                                    <>
                                                                        <div className="flex-1 flex items-start gap-3 md:gap-4 w-full">
                                                                            <div className="mt-0.5 md:mt-1 flex-shrink-0">
                                                                                {getTaskTypeIcon(task.type)}
                                                                            </div>
                                                                            <div className="space-y-1.5 flex-1 min-w-0">
                                                                                <p className={cn(
                                                                                    "text-sm md:text-base font-medium leading-tight md:leading-relaxed tracking-tight break-words",
                                                                                    task.isCritical && "text-amber-900 dark:text-amber-400 font-bold"
                                                                                )}>
                                                                                    {task.text}
                                                                                </p>
                                                                                <div className="flex gap-1.5 md:gap-2 flex-wrap">
                                                                                    {task.isCritical && (
                                                                                        <Badge variant="outline" className="h-5 md:h-6 px-1.5 text-[9px] md:text-[10px] uppercase font-bold tracking-widest bg-amber-200/50 text-amber-800 border-amber-300 rounded-md">Quan trọng</Badge>
                                                                                    )}
                                                                                    {task.minCompletions && task.minCompletions > 1 && (
                                                                                        <Badge variant="secondary" className="h-5 md:h-6 px-1.5 text-[9px] md:text-[10px] font-bold bg-muted text-muted-foreground rounded-md">{task.minCompletions} lần</Badge>
                                                                                    )}
                                                                                    <span className="sm:hidden text-[10px] text-muted-foreground/60 italic self-center ml-auto">
                                                                                        {task.type === 'photo' ? 'Ảnh' : task.type === 'boolean' ? 'Tích' : 'Ghi chú'}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex items-center gap-1 self-end md:self-center md:opacity-0 group-hover:opacity-100 transition-all duration-200 md:translate-x-2 group-hover:translate-x-0 pt-2 md:pt-0 border-t md:border-0 w-full md:w-auto justify-end">
                                                                            {isSorting ? (
                                                                                <>
                                                                                    <Button variant="ghost" size="icon" className="h-9 w-9 md:h-10 md:w-10 text-muted-foreground" onClick={() => handleMoveTask(shiftKey, section.title, taskIndex, 'up')} disabled={taskIndex === 0}>
                                                                                        <ArrowUp className="h-4 w-4 md:h-5 md:w-5" />
                                                                                    </Button>
                                                                                    <Button variant="ghost" size="icon" className="h-9 w-9 md:h-10 md:w-10 text-muted-foreground" onClick={() => handleMoveTask(shiftKey, section.title, taskIndex, 'down')} disabled={taskIndex === section.tasks.length - 1}>
                                                                                        <ArrowDown className="h-4 w-4 md:h-5 md:w-5" />
                                                                                    </Button>
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <Button variant="ghost" size="icon" className="h-9 w-9 md:h-10 md:w-10 text-muted-foreground hover:text-amber-500 hover:bg-amber-100/50 rounded-lg md:rounded-xl" onClick={() => handleToggleCritical(shiftKey, section.title, task.id)}>
                                                                                        <Star className={cn("h-4 w-4 md:h-5 md:w-5 transition-all", task.isCritical && "fill-amber-500 text-amber-500")} />
                                                                                    </Button>
                                                                                    <Button variant="ghost" size="icon" className="h-9 w-9 md:h-10 md:w-10 text-muted-foreground hover:text-blue-500 hover:bg-blue-100/50 rounded-lg md:rounded-xl" onClick={() => setEditingTask({ shiftKey, sectionTitle: section.title, taskId: task.id, text: task.text, type: task.type, minCompletions: task.minCompletions || 1, isCritical: !!task.isCritical, instruction: task.instruction })}>
                                                                                        <Pencil className="h-4 w-4 md:h-5 md:w-5" />
                                                                                    </Button>
                                                                                    <Button variant="ghost" size="icon" className="h-9 w-9 md:h-10 md:w-10 text-muted-foreground hover:text-destructive hover:bg-red-100/50 rounded-lg md:rounded-xl" onClick={() => handleDeleteTask(shiftKey, section.title, task.id)}>
                                                                                        <Trash2 className="h-4 w-4 md:h-5 md:w-5" />
                                                                                    </Button>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    </>
                                                                </div>
                                                            ))}
                                                            {section.tasks.length === 0 && (
                                                                <div className="text-center py-12 border-2 border-dashed rounded-2xl border-muted bg-muted/5 transition-colors">
                                                                   <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-20" />
                                                                   <p className="text-sm text-muted-foreground">Chưa có công việc nào trong danh mục này.</p>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Add Task Button */}
                                                        <div className="mt-6">
                                                            <Button
                                                                variant="outline"
                                                                className="w-full h-full border-dashed border-primary/30 hover:bg-primary/5 hover:border-primary/50 transition-all rounded-2xl group flex flex-col items-center gap-2"
                                                                onClick={() => setAddingToSection({
                                                                    shiftKey,
                                                                    sectionTitle: section.title,
                                                                })}
                                                            >
                                                                <div className="p-2 bg-primary/10 rounded-full group-hover:scale-110 transition-transform">
                                                                    <Plus className="h-6 w-6 text-primary" />
                                                                </div>
                                                                <span className="font-bold text-muted-foreground group-hover:text-primary transition-colors whitespace-normal break-words text-center sm:text-left">Thêm công việc vào mục {section.title}</span>
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    )
                })}
            </Tabs>

            {/* Global Task Add Dialog */}
            <TaskDialog
                isOpen={!!addingToSection}
                onClose={() => setAddingToSection(null)}
                onConfirm={(taskData) => {
                    if (addingToSection) {
                        handleAddTask(addingToSection.shiftKey, addingToSection.sectionTitle, taskData);
                    }
                }}
                shiftName={addingToSection ? tasksByShift?.[addingToSection.shiftKey]?.name || '' : ''}
                sectionTitle={addingToSection?.sectionTitle || ''}
            />

            <TaskDialog
                isOpen={!!editingTask}
                onClose={() => setEditingTask(null)}
                onConfirm={(taskData) => {
                    handleUpdateTask(taskData);
                }}
                initialData={editingTask ? {
                    text: editingTask.text,
                    type: editingTask.type,
                    minCompletions: editingTask.minCompletions,
                    isCritical: editingTask.isCritical,
                    instruction: editingTask.instruction
                } : null}
                shiftName={editingTask ? tasksByShift?.[editingTask.shiftKey]?.name || '' : ''}
                sectionTitle={editingTask?.sectionTitle || ''}
            />
        </div>
    );
}