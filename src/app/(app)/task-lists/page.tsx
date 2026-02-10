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


function AiAssistant({
    tasksByShift,
    onAddTasks,
    onSortTasks,
}: {
    tasksByShift: TasksByShift | null,
    onAddTasks: (tasks: GenerateServerTasksOutput['tasks'], shiftKey: string, sectionTitle: string) => void;
    onSortTasks: (sortedTasks: string[], shiftKey: string, sectionTitle: string) => void;
}) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [textInput, setTextInput] = useState('');
    const [imageInput, setImageInput] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('add');

    const [targetShift, setTargetShift] = useState('sang');
    const [targetSection, setTargetSection] = useState('Trong ca');
    const [sortInstruction, setSortInstruction] = useState('');


    const [showAddPreview, setShowAddPreview] = useState(false);
    const [addPreviewTasks, setAddPreviewTasks] = useState<GenerateServerTasksOutput['tasks']>([]);

    const [showSortPreview, setShowSortPreview] = useState(false);
    const [sortPreview, setSortPreview] = useState<{ oldOrder: string[], newOrder: string[] }>({ oldOrder: [], newOrder: [] });

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImageInput(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const resetAddState = () => {
        setTextInput('');
        setImageInput(null);
        const fileInput = document.getElementById('server-image-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
    };

    const handleGenerateAdd = async (source: 'text' | 'image') => {
        setIsGenerating(true);

        try {
            const input = source === 'text'
                ? { source, inputText: textInput }
                : { source, imageDataUri: imageInput! };

            if ((source === 'text' && !textInput.trim()) || (source === 'image' && !imageInput)) {
                toast.error("Vui lòng cung cấp đầu vào.");
                setIsGenerating(false);
                return;
            }

            toast.loading("AI đang xử lý...");

            const result = await callGenerateServerTasks(input);

            if (!result || !result.tasks) {
                throw new Error("AI không trả về kết quả hợp lệ.");
            }

            setAddPreviewTasks(result.tasks);
            setShowAddPreview(true);

        } catch (error) {
            console.error("Failed to generate server tasks:", error);
            toast.error("Không thể tạo danh sách công việc. Vui lòng thử lại.");
        } finally {
            setIsGenerating(false);
            toast.dismiss();
        }
    };

    const handleConfirmAdd = () => {
        // AI will determine the shift and section from the text, but we need a fallback
        onAddTasks(addPreviewTasks, targetShift, targetSection);
        toast.success(`Đã thêm ${addPreviewTasks.length} công việc mới.`);
        resetAddState();
        setShowAddPreview(false);
        setAddPreviewTasks([]);
    };

    const handleGenerateSort = async () => {
        if (!targetShift || !targetSection) {
            toast.error("Vui lòng chọn ca và mục để sắp xếp.");
            return;
        }
        if (!sortInstruction.trim()) {
            toast.error("Vui lòng nhập yêu cầu sắp xếp.");
            return;
        }

        const sectionToSort = tasksByShift?.[targetShift]?.sections.find(s => s.title === targetSection);
        if (!sectionToSort || sectionToSort.tasks.length < 2) {
            toast.info("Mục này có ít hơn 2 công việc.", { icon: 'ℹ️' });
            return;
        }

        setIsGenerating(true);
        toast.loading("AI đang sắp xếp...");

        try {
            const currentTasks = sectionToSort.tasks.map(t => t.text);
            const result = await callSortTasks({
                context: `Server tasks for shift: ${tasksByShift?.[targetShift]?.name}, section: ${targetSection}`,
                tasks: currentTasks,
                userInstruction: sortInstruction,
            });

            if (!result || !result.sortedTasks || result.sortedTasks.length !== currentTasks.length) {
                throw new Error("AI did not return a valid sorted list.");
            }

            setSortPreview({ oldOrder: currentTasks, newOrder: result.sortedTasks });
            setShowSortPreview(true);

        } catch (error) {
            console.error("Failed to sort tasks:", error);
            toast.error("Không thể sắp xếp công việc. Vui lòng thử lại.");
        } finally {
            setIsGenerating(false);
            toast.dismiss();
        }
    };

    const handleConfirmSort = () => {
        onSortTasks(sortPreview.newOrder, targetShift, targetSection);
        toast.success(`Đã sắp xếp lại công việc.`);
        setShowSortPreview(false);
        setSortInstruction('');
    };

    const renderDiff = (oldText: string, newText: string) => {
        const differences = diffChars(oldText, newText);
        return differences.map((part, index) => {
            const color = part.added ? 'bg-green-200/50' : part.removed ? 'bg-red-200/50' : 'bg-transparent';
            return <span key={index} className={color}>{part.value}</span>;
        });
    };

    return (
        <>
            <Card className="mb-8 border-none shadow-lg bg-gradient-to-br from-primary/5 via-background to-secondary/5 overflow-hidden">
                <CardHeader className="pb-4 relative">
                    <div className="absolute top-0 right-0 p-6 opacity-10 hidden sm:block pointer-events-none">
                        <Sparkles className="h-20 w-20 text-primary" />
                    </div>
                    <CardTitle className="flex items-center gap-3 text-xl sm:text-2xl font-headline text-primary">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Wand2 className="h-6 w-6" />
                        </div>
                        Trợ lý AI Thông minh
                    </CardTitle>
                    <CardDescription className="text-base">Sử dụng AI để tối ưu hóa quy trình làm việc một cách tự động.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setTargetShift(''); setTargetSection(''); }} className="space-y-6">
                        <TabsList className="grid w-full grid-cols-2 p-1 bg-muted/50 rounded-xl h-auto">
                            <TabsTrigger value="add" className="py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                <Plus className="mr-2 h-4 w-4 text-green-500" />
                                <span className="font-medium">Thêm hàng loạt</span>
                            </TabsTrigger>
                            <TabsTrigger value="sort" className="py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                <Shuffle className="mr-2 h-4 w-4 text-blue-500" />
                                <span className="font-medium">Sắp xếp thông minh</span>
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="add" className="mt-0 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <Tabs defaultValue="text" className="w-full">
                                <div className="flex items-center gap-2 mb-4">
                                     <TabsList className="bg-muted/30 p-1">
                                        <TabsTrigger value="text" className="text-xs py-1.5"><FileText className="mr-1.5 h-3.5 w-3.5" />Văn bản</TabsTrigger>
                                        <TabsTrigger value="image" className="text-xs py-1.5"><ImageIcon className="mr-1.5 h-3.5 w-3.5" />Hình ảnh</TabsTrigger>
                                    </TabsList>
                                </div>
                                <TabsContent value="text" className="space-y-4">
                                    <Textarea
                                        placeholder="Ví dụ: 'Ca Sáng - Đầu ca: Vệ sinh máy pha cà phê, Kiểm tra tủ bánh...'. AI sẽ tự động phân loại giúp bạn."
                                        rows={4}
                                        className="resize-none border-muted-foreground/20 focus-visible:ring-primary/30"
                                        value={textInput}
                                        onChange={(e) => setTextInput(e.target.value)}
                                        disabled={isGenerating}
                                    />
                                    <Button onClick={() => handleGenerateAdd('text')} disabled={isGenerating || !textInput.trim()} className="w-full sm:w-auto shadow-md">
                                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                        Tạo danh sách bằng AI
                                    </Button>
                                </TabsContent>
                                <TabsContent value="image" className="space-y-4">
                                    <div className="flex items-center gap-4">
                                        <Input
                                            id="server-image-upload"
                                            type="file"
                                            accept="image/*"
                                            className="flex-1 cursor-pointer"
                                            onChange={handleFileChange}
                                            disabled={isGenerating}
                                        />
                                    </div>
                                    <Button onClick={() => handleGenerateAdd('image')} disabled={isGenerating || !imageInput} className="w-full sm:w-auto shadow-md">
                                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-2 h-4 w-4" />}
                                        Trích xuất từ ảnh
                                    </Button>
                                </TabsContent>
                            </Tabs>
                        </TabsContent>

                        <TabsContent value="sort" className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">Mục tiêu sắp xếp</Label>
                                    <Textarea
                                        placeholder="Ví dụ: 'Ưu tiên các việc quan trọng lên đầu', 'Sắp xếp theo thứ tự ưu tiên vận hành'..."
                                        rows={2}
                                        className="resize-none border-muted-foreground/20"
                                        value={sortInstruction}
                                        onChange={(e) => setSortInstruction(e.target.value)}
                                        disabled={isGenerating}
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">Chọn ca</Label>
                                        <Combobox
                                            value={targetShift}
                                            onChange={setTargetShift}
                                            disabled={isGenerating}
                                            placeholder="Chọn ca..."
                                            options={[
                                                { value: "sang", label: "Ca Sáng" },
                                                { value: "trua", label: "Ca Trưa" },
                                                { value: "toi", label: "Ca Tối" }
                                            ]}
                                            compact
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">Chọn mục</Label>
                                        <Combobox
                                            value={targetSection}
                                            onChange={setTargetSection}
                                            disabled={isGenerating}
                                            placeholder="Chọn mục..."
                                            options={[
                                                { value: "Đầu ca", label: "Đầu ca" },
                                                { value: "Trong ca", label: "Trong ca" },
                                                { value: "Cuối ca", label: "Cuối ca" }
                                            ]}
                                            compact
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <Button onClick={handleGenerateSort} disabled={isGenerating || !targetShift || !targetSection || !sortInstruction.trim()} className="w-full shadow-md bg-indigo-600 hover:bg-indigo-700 text-white">
                                            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                            Sắp xếp ngay
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Add Preview Dialog */}
            <Dialog open={showAddPreview} onOpenChange={setShowAddPreview} dialogTag="task-add-preview-dialog" parentDialogTag="root">
                <DialogContent className="max-w-2xl">
                    <DialogHeader variant="info" iconkey="file">
                        <DialogTitle>Xem trước danh sách từ AI</DialogTitle>
                        <DialogDescription>
                            AI đã phân tích nội dung. Kiểm tra lại danh sách dưới đây trước khi thêm vào hệ thống.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogBody>
                        <ul className="space-y-2">
                            {addPreviewTasks.map((task, index) => (
                                <li key={index} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 text-sm border border-transparent hover:border-primary/10 transition-colors">
                                    {task.isCritical ? <div className="p-1 bg-amber-100 rounded-md"><Star className="h-4 w-4 text-amber-500 fill-current" /></div> : <div className="p-1 bg-primary/10 rounded-md"><Plus className="h-4 w-4 text-primary" /></div>}
                                    <span className="flex-1 font-medium">{task.text}</span>
                                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{task.type}</Badge>
                                </li>
                            ))}
                        </ul>
                    </DialogBody>
                    <DialogFooter>
                        <DialogCancel onClick={() => setShowAddPreview(false)}>Hủy bỏ</DialogCancel>
                        <DialogAction onClick={handleConfirmAdd}>
                             Thêm {addPreviewTasks.length} công việc
                        </DialogAction>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Sort Preview Dialog */}
            <Dialog open={showSortPreview} onOpenChange={setShowSortPreview} dialogTag="task-sort-preview-dialog" parentDialogTag="root">
                <DialogContent className="max-w-4xl">
                    <DialogHeader variant="premium" iconkey="layout">
                        <DialogTitle>Thứ tự sắp xếp mới</DialogTitle>
                        <DialogDescription>
                            AI đề xuất sắp xếp lại các công việc trong mục <span className="font-bold">"{targetSection}"</span> của <span className="font-bold">Ca {tasksByShift?.[targetShift]?.name}</span>.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogBody className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6">
                        <div className="space-y-3">
                            <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground/70 ml-1">Thứ tự hiện tại</h4>
                            <ul className="space-y-2 text-sm bg-muted/20 p-4 rounded-2xl border border-dashed">
                                {sortPreview.oldOrder.map((task, index) => (
                                    <li key={index} className="flex gap-2 text-muted-foreground italic">
                                        <span className="opacity-50">{index + 1}.</span> {task}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="space-y-3">
                            <h4 className="text-xs font-black uppercase tracking-widest text-primary/70 ml-1">Thứ tự đề xuất</h4>
                            <ul className="space-y-2 text-sm bg-primary/5 p-4 rounded-2xl border border-primary/10">
                                {sortPreview.newOrder.map((task, index) => {
                                    const oldIndex = sortPreview.oldOrder.findIndex(t => t === task);
                                    const oldTaskText = oldIndex !== -1 ? sortPreview.oldOrder[oldIndex] : '';
                                    return (
                                        <li key={index} className="flex gap-2 font-medium">
                                            <span className="text-primary">{index + 1}.</span> {renderDiff(oldTaskText, task)}
                                        </li>
                                    )
                                })}
                            </ul>
                        </div>
                    </DialogBody>
                    <DialogFooter>
                        <DialogCancel onClick={() => setShowSortPreview(false)}>Hủy bỏ</DialogCancel>
                        <DialogAction onClick={handleConfirmSort}>
                            Áp dụng thay đổi
                        </DialogAction>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

export default function TaskListsPage() {
    const { user, loading: authLoading } = useAuth();
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [tasksByShift, setTasksByShift] = useState<TasksByShift | null>(null);
    const navigation = useAppNavigation();
    const [isLoading, setIsLoading] = useState(true);
    const [isSorting, setIsSorting] = useState(false);
    const [addingToSection, setAddingToSection] = useState<{ shiftKey: string; sectionTitle: string } | null>(null);
    const [editingTask, setEditingTask] = useState<{ shiftKey: string; sectionTitle: string; taskId: string; text: string; type: Task['type']; minCompletions: number; isCritical: boolean; instruction?: { text?: string; images?: string[] } } | null>(null);

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
        const textToCopy = `# ${shift.name}\n\n` +
            shift.sections.map(section =>
                `## ${section.title}\n` +
                section.tasks.map(task => `- ${task.isCritical ? '(quan trọng) ' : ''}${task.text}`).join('\n')
            ).join('\n\n');

        navigator.clipboard.writeText(textToCopy).then(() => {
            toast.success(`Danh sách công việc của ${shift.name} đã được sao chép.`);
        }).catch(err => {
            toast.error("Không thể sao chép.");
        });
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

            <AiAssistant tasksByShift={tasksByShift} onAddTasks={onAiAddTasks} onSortTasks={onAiSortTasks} />

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