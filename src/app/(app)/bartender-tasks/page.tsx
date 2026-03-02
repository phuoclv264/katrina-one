
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import { dataStore } from '@/lib/data-store';
import type { Task, TaskSection } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Pencil, Droplets, UtensilsCrossed, Wind, ArrowUp, ArrowDown, ChevronsDownUp, Shuffle, Check, AlertCircle, CheckSquare, MessageSquare, Download, ChevronDown, ListPlus, MoreVertical, Image as ImageIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/pro-toast';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'nextjs-toploader/app';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
    AlertDialogIcon
} from "@/components/ui/alert-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

import { TaskDialog } from '../task-lists/_components/task-dialog';
import { cn } from '@/lib/utils';




export default function BartenderTasksPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [sections, setSections] = useState<TaskSection[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSorting, setIsSorting] = useState(false);
    const [newSectionTitle, setNewSectionTitle] = useState('');
    const [editingSection, setEditingSection] = useState<{ title: string; newTitle: string } | null>(null);
    // section for which the "add task" dialog is open
    const [addingToSection, setAddingToSection] = useState<string | null>(null);
    const [editingTask, setEditingTask] = useState<{ sectionTitle: string; taskId: string; text: string; type: Task['type']; minCompletions: number; isCritical: boolean; instruction?: { text?: string; images?: { url: string; caption?: string }[] } } | null>(null);
    const [openItems, setOpenItems] = useState<string[]>([]);


    const handleReconnect = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
    }, []);

    useEffect(() => {
        if (!authLoading) {
            if (!user || user.role !== 'Chủ nhà hàng') {
                router.replace('/');
            } else {
                const unsubscribe = dataStore.subscribeToBartenderTasks((data) => {
                    setSections(data);
                    if (data.length > 0 && openItems.length === 0) {
                        setOpenItems(data.map(s => s.title));
                    }
                    setIsLoading(false);
                });
                return () => unsubscribe();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, authLoading, router, refreshTrigger]);

    useDataRefresher(handleReconnect);

    const handleUpdateAndSave = (newSections: TaskSection[], showToast: boolean = true) => {
        setSections(newSections); // Optimistic update
        dataStore.updateBartenderTasks(newSections).then(() => {
            if (showToast) {
                toast.success("Đã lưu thay đổi!");
            }
        }).catch(err => {
            toast.error("Không thể lưu thay đổi. Vui lòng thử lại.");
            console.error(err);
        });
    }

    const handleAddSection = () => {
        if (!sections || newSectionTitle.trim() === '') return;
        if (sections.some(s => s.title === newSectionTitle.trim())) {
            toast.error("Tên danh mục này đã tồn tại.");
            return;
        }

        const newSection: TaskSection = {
            title: newSectionTitle.trim(),
            tasks: []
        };

        const newSections = [...sections, newSection];
        handleUpdateAndSave(newSections);
        setNewSectionTitle('');
        setOpenItems(prev => [...prev, newSection.title]);
    };

    const handleRenameSection = (oldTitle: string) => {
        if (!sections || !editingSection || editingSection.newTitle.trim() === '') {
            setEditingSection(null);
            return;
        }

        if (sections.some(s => s.title === editingSection.newTitle.trim() && s.title !== oldTitle)) {
            toast.error("Tên danh mục này đã tồn tại.");
            return;
        }

        const newSections = sections.map(s =>
            s.title === oldTitle ? { ...s, title: editingSection.newTitle.trim() } : s
        );
        handleUpdateAndSave(newSections);
        setEditingSection(null);
    };

    const handleDeleteSection = (title: string) => {
        if (!sections) return;
        const newSections = sections.filter(s => s.title !== title);
        handleUpdateAndSave(newSections);
    };


    const handleAddTask = (sectionTitle: string, taskData: Omit<Task, 'id'>) => {
        if (!sections) return;

        const newTaskToAdd: Task = {
            id: `bt-task-${Date.now()}`,
            text: taskData.text,
            type: taskData.type,
            isCritical: !!taskData.isCritical,
            minCompletions: taskData.minCompletions ?? 1
        };

        if (taskData.instruction) {
            newTaskToAdd.instruction = {
                text: taskData.instruction.text ?? "",
                images: taskData.instruction.images ?? []
            };
        }

        const newSectionsState = JSON.parse(JSON.stringify(sections));
        const section = newSectionsState.find((s: TaskSection) => s.title === sectionTitle);
        if (section) {
            section.tasks.push(newTaskToAdd);
            handleUpdateAndSave(newSectionsState);
        } else {
            toast.error("Không tìm thấy mục để thêm công việc vào.");
        }
    };

    const handleUpdateTask = (data: Omit<Task, 'id'>) => {
        if (!sections || !editingTask) {
            setEditingTask(null);
            return;
        }

        const { sectionTitle, taskId } = editingTask;
        const { text, type, minCompletions, isCritical, instruction } = data;
        const newSectionsState = JSON.parse(JSON.stringify(sections));
        const section = newSectionsState.find((s: TaskSection) => s.title === sectionTitle);
        if (section) {
            const task = section.tasks.find((t: Task) => t.id === taskId);
            if (task) {
                task.text = text.trim();
                task.type = type;
                task.minCompletions = minCompletions ?? 1;
                task.isCritical = !!isCritical;
                if (instruction) {
                    task.instruction = {
                        text: instruction.text ?? "",
                        images: instruction.images ?? []
                    };
                } else if ('instruction' in task) {
                    delete task.instruction;
                }
            }
        }
        handleUpdateAndSave(newSectionsState);
        setEditingTask(null);
    };

    const handleToggleCritical = (sectionTitle: string, taskId: string) => {
        if (!sections) return;
        const newSectionsState = JSON.parse(JSON.stringify(sections));
        const section = newSectionsState.find((s: TaskSection) => s.title === sectionTitle);
        if (section) {
            const task = section.tasks.find((t: Task) => t.id === taskId);
            if (task) {
                task.isCritical = !task.isCritical;
            }
        }
        handleUpdateAndSave(newSectionsState);
    };

    const handleDeleteTask = (sectionTitle: string, taskId: string) => {
        if (!sections) return;
        const newSectionsState = JSON.parse(JSON.stringify(sections));
        const section = newSectionsState.find((s: TaskSection) => s.title === sectionTitle);
        if (section) {
            section.tasks = section.tasks.filter((task: Task) => task.id !== taskId);
        }
        handleUpdateAndSave(newSectionsState);
    };

    const handleMoveTask = (sectionIndex: number, taskIndex: number, direction: 'up' | 'down') => {
        if (!sections) return;
        const newSections = JSON.parse(JSON.stringify(sections));
        const section = newSections[sectionIndex];
        const tasks = section.tasks;
        const newIndex = direction === 'up' ? taskIndex - 1 : taskIndex + 1;
        if (newIndex < 0 || newIndex >= tasks.length) return;

        [tasks[taskIndex], tasks[newIndex]] = [tasks[newIndex], tasks[taskIndex]];
        handleUpdateAndSave(newSections, false);
    };

    const handleMoveSection = (sectionIndex: number, direction: 'up' | 'down') => {
        if (!sections) return;
        const newSections = JSON.parse(JSON.stringify(sections));
        const newIndex = direction === 'up' ? sectionIndex - 1 : sectionIndex + 1;
        if (newIndex < 0 || newIndex >= newSections.length) return;

        [newSections[sectionIndex], newSections[newIndex]] = [newSections[newIndex], newSections[sectionIndex]];
        handleUpdateAndSave(newSections, false);
    }

    const getSectionIcon = (title: string) => {
        switch (title) {
            case 'Vệ sinh khu vực pha chế': return <Droplets className="h-5 w-5 text-blue-500" />;
            case 'Vệ sinh dụng cụ': return <UtensilsCrossed className="h-5 w-5 text-green-500" />;
            case 'Vệ sinh thiết bị': return <Wind className="h-5 w-5 text-purple-500" />;
            default: return null;
        }
    }

    const getTaskTypeIcon = (type: Task['type']) => {
        switch (type) {
            case 'photo': return <ImageIcon className="h-4 w-4 text-green-500 shrink-0" />;
            case 'boolean': return <CheckSquare className="h-4 w-4 text-sky-500 shrink-0" />;
            case 'opinion': return <MessageSquare className="h-4 w-4 text-orange-500 shrink-0" />;
            default: return null;
        }
    }

    const handleToggleAll = () => {
        if (!sections) return;
        if (openItems.length === sections.length) {
            setOpenItems([]);
        } else {
            setOpenItems(sections.map(s => s.title));
        }
    };

    const toggleSortMode = () => {
        const newSortState = !isSorting;
        setIsSorting(newSortState);
        if (!newSortState) {
            toast.success("Đã lưu thứ tự mới!");
        }
    };

    const handleExport = () => {
        if (!sections) return;
        const textToCopy = sections.map(section =>
            `# ${section.title}\n` +
            section.tasks.map(task => `- ${task.text}`).join('\n')
        ).join('\n\n');

        navigator.clipboard.writeText(textToCopy).then(() => {
            toast.success("Danh sách công việc đã được sao chép vào bộ nhớ tạm.");
        }).catch(err => {
            toast.error("Không thể sao chép.");
        });
    };

    if (isLoading || authLoading) {
        return <LoadingPage />;
    }

    if (!sections) {
        return <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">Không thể tải danh sách công việc.</div>;
    }

    const areAllSectionsOpen = sections && openItems.length === sections.length;
    const totalTasks = sections?.reduce((acc, section) => acc + section.tasks.length, 0) || 0;

    return (
        <div className="container mx-auto max-w-4xl p-0 sm:p-6 md:p-8 pb-32">
            <header className="mb-6 px-4 pt-6 sm:px-0 sm:pt-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
                    <h1 className="text-2xl md:text-3xl font-bold font-headline flex items-center gap-2.5">
                        <UtensilsCrossed className="w-7 h-7 md:w-8 md:h-8 text-primary shrink-0" /> 
                        <span className="truncate">Quản lý Pha chế</span>
                    </h1>
                    <Badge variant="secondary" className="font-mono text-[10px] sm:text-xs w-fit">
                        {totalTasks} công việc
                    </Badge>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">Quản lý checklist vệ sinh và chuẩn bị cho bộ phận Pha chế.</p>
            </header>

            <Card className="border-none shadow-none bg-transparent">
                <CardHeader className="px-4 sm:px-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                    <div className="space-y-1">
                        <CardTitle className="text-lg sm:text-xl font-headline">Danh sách công việc</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">Tự động đồng bộ với hệ thống nhân viên.</CardDescription>
                    </div>
                    <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleExport}
                            className="h-9 text-xs sm:text-sm"
                        >
                            <Download className="mr-2 h-3.5 w-3.5" />
                            <span className="hidden xs:inline">Xuất dữ liệu</span>
                            <span className="xs:hidden">Xuất</span>
                        </Button>
                        
                        <div className="flex items-center gap-2">
                            {isSorting ? (
                                <Button 
                                    variant="default" 
                                    size="sm" 
                                    onClick={toggleSortMode}
                                    className="flex-1 h-9 shadow-sm text-xs sm:text-sm"
                                >
                                    <Check className="mr-2 h-3.5 w-3.5" />
                                    Xong
                                </Button>
                            ) : (
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={toggleSortMode}
                                    className="flex-1 h-9 text-xs sm:text-sm"
                                >
                                    <Shuffle className="mr-2 h-3.5 w-3.5" />
                                    Sắp xếp
                                </Button>
                            )}
                            
                            {sections && sections.length > 0 && (
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={handleToggleAll}
                                    className="px-3 h-9 shrink-0"
                                    title={areAllSectionsOpen ? 'Thu gọn tất cả' : 'Mở rộng tất cả'}
                                >
                                    {areAllSectionsOpen ? <ChevronsDownUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                
                <div className="mx-4 sm:mx-0 mb-6 p-1 bg-muted/30 rounded-2xl border border-muted/50 flex items-center gap-1 group focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                    <div className="pl-3 text-primary shrink-0">
                        <ListPlus className="h-5 w-5" />
                    </div>
                    <Input
                        placeholder="Thêm nhóm mới..."
                        value={newSectionTitle}
                        onChange={(e) => setNewSectionTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddSection()}
                        className="border-none bg-transparent focus-visible:ring-0 text-sm sm:text-base h-10 sm:h-12 placeholder:text-muted-foreground/60"
                    />
                    <Button 
                        size="sm"
                        onClick={handleAddSection}
                        disabled={!newSectionTitle.trim()}
                        className="mr-1 rounded-xl shadow-sm px-3 sm:px-4 h-8 sm:h-10 transition-all active:scale-95 text-xs sm:text-sm"
                    >
                        Thêm
                    </Button>
                </div>

                <CardContent className="px-4 sm:px-0">
                    <Accordion 
                        type="multiple" 
                        value={openItems} 
                        onValueChange={setOpenItems} 
                        className="w-full space-y-4"
                    >
                        {sections.map((section, sectionIndex) => (
                            <AccordionItem 
                                value={section.title} 
                                key={section.title} 
                                className="border rounded-xl bg-card transition-all duration-200 overflow-hidden shadow-sm hover:shadow-md border-muted/60"
                            >
                                <div className="flex items-center group/header">
                                    <AccordionTrigger 
                                        className="py-3 px-4 sm:py-4 sm:px-5 text-lg font-semibold hover:no-underline flex-1 transition-colors hover:bg-muted/30"
                                        disabled={isSorting}
                                    >
                                                    <div className="flex flex-row items-center gap-3 sm:gap-4 w-full">
                                                        <div className="p-2 rounded-lg bg-primary/5 text-primary group-hover/header:bg-primary/10 transition-colors hidden xs:block">
                                                            {getSectionIcon(section.title)}
                                                        </div>
                                                        <div className="flex flex-col items-start gap-0.5 w-full pr-8 sm:pr-0 overflow-hidden">
                                                            {editingSection?.title === section.title ? (
                                                                <div className="flex items-center gap-2 w-full pr-4" onClick={(e) => e.stopPropagation()}>
                                                                    <Input
                                                                        value={editingSection.newTitle}
                                                                        onChange={(e) => setEditingSection({ ...editingSection, newTitle: e.target.value })}
                                                                        className="h-8 text-sm sm:text-base font-semibold py-1 focus-visible:ring-1"
                                                                        autoFocus
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') handleRenameSection(section.title);
                                                                            if (e.key === 'Escape') setEditingSection(null);
                                                                        }}
                                                                        onBlur={() => handleRenameSection(section.title)}
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <span className="text-left font-headline tracking-tight text-sm sm:text-lg block w-full truncate leading-tight">{section.title}</span>
                                                                    <span className="text-[10px] sm:text-xs text-muted-foreground font-normal">
                                                                        {section.tasks.length} hạng mục
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                    </AccordionTrigger>
                                    
                                    {!isSorting && (
                                        <div className="flex items-center gap-0.5 pr-2 sm:pr-4">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground sm:h-9 sm:w-9">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-52">
                                                    <DropdownMenuItem onClick={() => setEditingSection({ title: section.title, newTitle: section.title })}>
                                                        <Pencil className="mr-2 h-4 w-4 text-muted-foreground" />
                                                        <span className="flex-1 font-medium">Đổi tên nhóm</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <AlertDialog dialogTag={`delete-section-${section.title}`} parentDialogTag="root" variant="destructive">
                                                        <AlertDialogTrigger asChild>
                                                            <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onSelect={(e) => e.preventDefault()}>
                                                                <Trash2 className="mr-2 h-4 w-4" /> 
                                                                <span className="font-semibold">Xóa nhóm</span>
                                                            </DropdownMenuItem>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md rounded-2xl">
                                                            <AlertDialogHeader>
                                                                <AlertDialogIcon icon={Trash2} />
                                                                <div className="space-y-2 text-center sm:text-left">
                                                                    <AlertDialogTitle>Xóa nhóm công việc?</AlertDialogTitle>
                                                                    <AlertDialogDescription className="text-sm">
                                                                        Toàn bộ hạng mục trong <span className="font-bold text-foreground italic">"{section.title}"</span> ({section.tasks.length} mục) sẽ biến mất.
                                                                    </AlertDialogDescription>
                                                                </div>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                                                                <AlertDialogCancel className="rounded-xl mt-0 order-2 sm:order-1">Hủy</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteSection(section.title)} className="rounded-xl order-1 sm:order-2">Xóa tất cả</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    )}

                                    {isSorting && (
                                        <div className="flex items-center gap-0.5 pr-2 sm:pr-4">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground hover:bg-muted" 
                                                onClick={() => handleMoveSection(sectionIndex, 'up')} 
                                                disabled={sectionIndex === 0}
                                            >
                                                <ArrowUp className="h-4 w-4" />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground hover:bg-muted" 
                                                onClick={() => handleMoveSection(sectionIndex, 'down')} 
                                                disabled={sectionIndex === sections.length - 1}
                                            >
                                                <ArrowDown className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <AccordionContent className="p-0 border-t border-muted/50 bg-muted/5">
                                    <div className="divide-y divide-muted/50">
                                        {section.tasks.map((task, taskIndex) => (
                                            <div 
                                                key={task.id} 
                                                className={cn(
                                                    "flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 transition-colors hover:bg-muted/10",
                                                    task.isCritical && "bg-destructive/5"
                                                )}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start gap-2.5 sm:gap-3">
                                                        <div className={cn(
                                                            "mt-0.5 p-1 sm:p-1.5 rounded-md shrink-0",
                                                            task.isCritical ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                                                        )}>
                                                            {getTaskTypeIcon(task.type)}
                                                        </div>
                                                        <div className="flex-1 space-y-1 overflow-hidden">
                                                            <div className="flex items-start gap-1.5 flex-wrap">
                                                                <p className={cn(
                                                                    "text-sm sm:text-[15px] font-medium leading-tight sm:leading-snug break-words",
                                                                    task.isCritical ? "text-destructive underline decoration-destructive/20 underline-offset-4" : "text-foreground"
                                                                )}>
                                                                    {task.text}
                                                                </p>
                                                                <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                                                    {task.isCritical && (
                                                                        <Badge variant="destructive" className="h-3.5 px-1 text-[8px] sm:text-[10px] uppercase tracking-wider font-bold shrink-0">
                                                                            Mới
                                                                        </Badge>
                                                                    )}
                                                                    {task.minCompletions && task.minCompletions > 1 && (
                                                                        <Badge variant="secondary" className="h-3.5 px-1 text-[8px] sm:text-[10px] font-mono shrink-0">
                                                                            x{task.minCompletions}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {task.instruction?.text && (
                                                                <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1 italic">
                                                                    💡 {task.instruction.text}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                    <div className="flex items-center gap-0.5 sm:gap-1 pl-2">
                                                        {isSorting ? (
                                                            <div className="flex items-center bg-background rounded-lg border border-muted/50 shadow-[0_1px_2px_rgba(0,0,0,0.05)] p-0.5">
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground" 
                                                                    onClick={() => handleMoveTask(sectionIndex, taskIndex, 'up')} 
                                                                    disabled={taskIndex === 0}
                                                                >
                                                                    <ArrowUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                                </Button>
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground" 
                                                                    onClick={() => handleMoveTask(sectionIndex, taskIndex, 'down')} 
                                                                    disabled={taskIndex === section.tasks.length - 1}
                                                                >
                                                                    <ArrowDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-0 sm:gap-0.5">
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className={cn(
                                                                        "h-8 w-8 sm:h-9 sm:w-9 transition-colors",
                                                                        task.isCritical ? "text-destructive hover:bg-destructive/10" : "text-muted-foreground/60 hover:bg-muted"
                                                                    )}
                                                                    onClick={() => handleToggleCritical(section.title, task.id)}
                                                                    title={task.isCritical ? "Bỏ đánh dấu quan trọng" : "Đánh dấu quan trọng"}
                                                                >
                                                                    <AlertCircle className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", task.isCritical && "fill-current")} />
                                                                </Button>
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground/60 hover:bg-primary/10 hover:text-primary" 
                                                                    onClick={() => setEditingTask({ 
                                                                        sectionTitle: section.title, 
                                                                        taskId: task.id, 
                                                                        text: task.text, 
                                                                        type: task.type,
                                                                        isCritical: !!task.isCritical,
                                                                        minCompletions: task.minCompletions || 1,
                                                                        instruction: task.instruction
                                                                    })}
                                                                >
                                                                    <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                                </Button>
                                                                
                                                                <AlertDialog dialogTag={`delete-task-${task.id}`} parentDialogTag="root" variant="destructive">
                                                                    <AlertDialogTrigger asChild>
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive">
                                                                            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                                        </Button>
                                                                    </AlertDialogTrigger>
                                                                    <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md rounded-2xl">
                                                                        <AlertDialogHeader>
                                                                            <AlertDialogIcon icon={Trash2} />
                                                                            <div className="space-y-2 text-center sm:text-left">
                                                                                <AlertDialogTitle>Xóa công việc?</AlertDialogTitle>
                                                                                <AlertDialogDescription className="text-sm">
                                                                                    Xác nhận xóa hạng mục <span className="font-semibold text-foreground italic">"{task.text}"</span>?
                                                                                </AlertDialogDescription>
                                                                            </div>
                                                                        </AlertDialogHeader>
                                                                        <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
                                                                            <AlertDialogCancel className="rounded-xl mt-0 order-2 sm:order-1">Hủy</AlertDialogCancel>
                                                                            <AlertDialogAction onClick={() => handleDeleteTask(section.title, task.id)} className="rounded-xl order-1 sm:order-2">Xác nhận xóa</AlertDialogAction>
                                                                        </AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            </div>
                                                        )}
                                                    </div>
                                            </div>
                                        ))}
                                        
                                        {section.tasks.length === 0 && (
                                            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                                                <div className="bg-muted/40 p-3 rounded-full mb-2">
                                                    <Plus className="h-5 w-5 text-muted-foreground/40" />
                                                </div>
                                                <p className="text-xs text-muted-foreground max-w-[150px]">
                                                    Nhóm này chưa có công việc nào.
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-3.5 sm:p-5 bg-background/50 border-t border-muted/50 flex justify-center sm:justify-start">
                                        <Button
                                            onClick={() => setAddingToSection(section.title)}
                                            className="w-full sm:w-[200px] bg-primary text-primary-foreground hover:bg-primary/90 transition-all font-semibold rounded-2xl h-11 sm:h-12 shadow-sm active:scale-[0.98] border-none"
                                        >
                                            <Plus className="mr-2 h-4 w-4" /> Thêm công việc
                                        </Button>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </CardContent>
            </Card>

            {addingToSection && (
                <TaskDialog
                    isOpen={!!addingToSection}
                    onClose={() => setAddingToSection(null)}
                    onConfirm={(data) => handleAddTask(addingToSection, data)}
                    sectionTitle={addingToSection}
                />
            )}

            <TaskDialog 
                isOpen={!!editingTask}
                onClose={() => setEditingTask(null)}
                onConfirm={handleUpdateTask}
                sectionTitle={editingTask?.sectionTitle}
                initialData={editingTask ? {
                    text: editingTask.text,
                    type: editingTask.type,
                    isCritical: editingTask.isCritical,
                    minCompletions: editingTask.minCompletions,
                    instruction: editingTask.instruction
                } : null}
            />
        </div>


    );
}
