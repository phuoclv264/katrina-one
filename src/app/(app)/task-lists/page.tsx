'use client';
import { useState, useEffect, useCallback } from 'react';
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
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { diffChars } from 'diff';
import { Badge } from '@/components/ui/badge';


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
            <Card className="mb-8">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl"><Wand2 /> Công cụ hỗ trợ AI</CardTitle>
                    <CardDescription>Sử dụng AI để thêm hoặc sắp xếp lại các công việc một cách thông minh.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setTargetShift(''); setTargetSection(''); }}>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="add"><Plus className="mr-2 h-4 w-4" />Thêm mới</TabsTrigger>
                            <TabsTrigger value="sort"><Sparkles className="mr-2 h-4 w-4" />Sắp xếp</TabsTrigger>
                        </TabsList>
                        <TabsContent value="add" className="mt-4 space-y-4">
                            <Tabs defaultValue="text">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="text"><FileText className="mr-2 h-4 w-4" />Dán văn bản</TabsTrigger>
                                    <TabsTrigger value="image"><ImageIcon className="mr-2 h-4 w-4" />Tải ảnh lên</TabsTrigger>
                                </TabsList>
                                <TabsContent value="text" className="mt-4 space-y-4">
                                    <Textarea
                                        placeholder="Dán danh sách công việc vào đây. Ví dụ: 'Ca Sáng - Đầu ca: Lau bàn'. Nếu không chỉ định, AI sẽ thêm vào mục mặc định."
                                        rows={4}
                                        value={textInput}
                                        onChange={(e) => setTextInput(e.target.value)}
                                        disabled={isGenerating}
                                    />
                                    <Button onClick={() => handleGenerateAdd('text')} disabled={isGenerating || !textInput.trim()} className="w-full sm:w-auto">
                                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                        Tạo
                                    </Button>
                                </TabsContent>
                                <TabsContent value="image" className="mt-4 space-y-4">
                                    <Input
                                        id="server-image-upload"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        disabled={isGenerating}
                                    />
                                    <Button onClick={() => handleGenerateAdd('image')} disabled={isGenerating || !imageInput} className="w-full sm:w-auto">
                                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                        Tạo
                                    </Button>
                                </TabsContent>
                            </Tabs>
                        </TabsContent>
                        <TabsContent value="sort" className="mt-4 space-y-4">
                            <Textarea
                                placeholder="Nhập yêu cầu của bạn, ví dụ: 'ưu tiên các việc quan trọng lên đầu'"
                                rows={2}
                                value={sortInstruction}
                                onChange={(e) => setSortInstruction(e.target.value)}
                                disabled={isGenerating}
                            />
                            <div className="flex flex-col sm:flex-row gap-2">
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
                                <Button onClick={handleGenerateSort} disabled={isGenerating || !targetShift || !targetSection || !sortInstruction.trim()} className="w-full sm:w-auto">
                                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                    Sắp xếp bằng AI
                                </Button>
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Add Preview Dialog */}
            <Dialog open={showAddPreview} onOpenChange={setShowAddPreview}>
                <DialogContent className="max-w-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Xem trước các công việc sẽ được thêm</AlertDialogTitle>
                        <AlertDialogDescription>
                            AI đã phân tích đầu vào của bạn. Kiểm tra lại danh sách dưới đây trước khi thêm chúng. Công việc không có ca/mục sẽ được thêm vào mục mặc định.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="max-h-[50vh] overflow-y-auto p-2 border rounded-md">
                        <ul className="space-y-2">
                            {addPreviewTasks.map((task, index) => (
                                <li key={index} className="flex items-center gap-3 p-2 rounded-md bg-muted/50 text-sm">
                                    {task.isCritical ? <Star className="h-4 w-4 text-yellow-500" /> : <Plus className="h-4 w-4 text-green-500" />}
                                    <span className="flex-1">{task.text}</span>
                                    <Badge variant="outline">{task.type}</Badge>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmAdd}>Thêm {addPreviewTasks.length} công việc</AlertDialogAction>
                    </AlertDialogFooter>
                </DialogContent>
            </Dialog>

            {/* Sort Preview Dialog */}
            <Dialog open={showSortPreview} onOpenChange={setShowSortPreview}>
                <DialogContent className="max-w-4xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Xem trước thứ tự sắp xếp mới</AlertDialogTitle>
                        <AlertDialogDescription>
                            AI đề xuất sắp xếp lại các công việc trong mục <span className="font-bold">"{targetSection}"</span> của <span className="font-bold">Ca {tasksByShift?.[targetShift]?.name}</span> như sau. Bạn có muốn áp dụng thay đổi không?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto p-2 border rounded-md grid grid-cols-2 gap-4">
                        <div>
                            <h4 className="font-semibold mb-2 text-center">Thứ tự hiện tại</h4>
                            <ul className="space-y-2 text-sm">
                                {sortPreview.oldOrder.map((task, index) => (
                                    <li key={index} className="p-2 rounded-md bg-muted/50">
                                        {index + 1}. {task}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2 text-center">Thứ tự mới</h4>
                            <ul className="space-y-2 text-sm">
                                {sortPreview.newOrder.map((task, index) => {
                                    const oldIndex = sortPreview.oldOrder.findIndex(t => t === task);
                                    const oldTaskText = oldIndex !== -1 ? sortPreview.oldOrder[oldIndex] : '';
                                    return (
                                        <li key={index} className="p-2 rounded-md bg-green-100/50">
                                            {index + 1}. {renderDiff(oldTaskText, task)}
                                        </li>
                                    )
                                })}
                            </ul>
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmSort}>Áp dụng thứ tự mới</AlertDialogAction>
                    </AlertDialogFooter>
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
    const [newTask, setNewTask] = useState<{ [shiftKey: string]: { [sectionTitle: string]: { text: string; isCritical: boolean; type: Task['type']; minCompletions: number } } }>({});
    const [editingTask, setEditingTask] = useState<{ shiftKey: string; sectionTitle: string; taskId: string; newText: string; newType: Task['type']; newMinCompletions: number } | null>(null);

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
                    console.log("Fetched tasks for task lists:", tasks);
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

    const handleAddTask = (shiftKey: string, sectionTitle: string) => {
        if (!tasksByShift) return;
        const taskDetails = newTask[shiftKey]?.[sectionTitle];
        if (!taskDetails || taskDetails.text.trim() === '') return;

        const newTaskToAdd: Task = {
            id: `task-${Date.now()}`,
            text: taskDetails.text.trim(),
            isCritical: taskDetails.isCritical,
            type: taskDetails.type,
            minCompletions: taskDetails.minCompletions || 1,
        };

        const newTasksState = JSON.parse(JSON.stringify(tasksByShift));
        const section = newTasksState[shiftKey].sections.find((s: TaskSection) => s.title === sectionTitle);
        if (section) {
            section.tasks.push(newTaskToAdd);
        }

        handleUpdateAndSave(newTasksState);

        setNewTask(current => {
            const newTasksInputState = JSON.parse(JSON.stringify(current));
            if (newTasksInputState[shiftKey]?.[sectionTitle]) {
                newTasksInputState[shiftKey][sectionTitle].text = '';
                newTasksInputState[shiftKey][sectionTitle].isCritical = false;
                newTasksInputState[shiftKey][sectionTitle].type = 'photo';
                newTasksInputState[shiftKey][sectionTitle].minCompletions = 1;
            }
            return newTasksInputState;
        });
    };

    const handleUpdateTask = () => {
        if (!tasksByShift || !editingTask || editingTask.newText.trim() === '') {
            setEditingTask(null);
            return;
        }

        const { shiftKey, sectionTitle, taskId, newText, newType, newMinCompletions } = editingTask;
        const newTasksState = JSON.parse(JSON.stringify(tasksByShift));
        const section = newTasksState[shiftKey]?.sections.find((s: TaskSection) => s.title === sectionTitle);
        if (section) {
            const task = section.tasks.find((t: Task) => t.id === taskId);
            if (task) {
                task.text = newText.trim();
                task.type = newType;
                task.minCompletions = newMinCompletions || 1;
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

    const handleNewTaskChange = (shiftKey: string, sectionTitle: string, field: 'text' | 'isCritical' | 'type' | 'minCompletions', value: string | boolean | Task['type'] | number) => {
        setNewTask(current => {
            const newState = JSON.parse(JSON.stringify(current));
            if (!newState[shiftKey]) newState[shiftKey] = {};
            if (!newState[shiftKey][sectionTitle]) newState[shiftKey][sectionTitle] = { text: '', isCritical: false, type: 'photo', minCompletions: 1 };
            (newState[shiftKey][sectionTitle] as any)[field] = value;
            return newState;
        });
    };

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
        return <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">Không thể tải danh sách công việc.</div>;
    }

    const getTaskTypeIcon = (type: Task['type']) => {
        switch (type) {
            case 'photo': return <ImageIcon className="h-4 w-4 text-green-500 shrink-0" />;
            case 'boolean': return <CheckSquare className="h-4 w-4 text-sky-500 shrink-0" />;
            case 'opinion': return <MessageSquare className="h-4 w-4 text-orange-500 shrink-0" />;
            default: return null;
        }
    }

    return (
        <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">
            <header className="mb-8">
                <h1 className="text-2xl md:text-3xl font-bold font-headline">Quản lý danh sách công việc</h1>
                <p className="text-muted-foreground">Tạo và chỉnh sửa các công việc hàng ngày cho tất cả các ca.</p>
            </header>

            <AiAssistant tasksByShift={tasksByShift} onAddTasks={onAiAddTasks} onSortTasks={onAiSortTasks} />

            <Tabs defaultValue="sang" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="sang"><Sun className="mr-2" />Ca Sáng</TabsTrigger>
                    <TabsTrigger value="trua"><Sunset className="mr-2" />Ca Trưa</TabsTrigger>
                    <TabsTrigger value="toi"><Moon className="mr-2" />Ca Tối</TabsTrigger>
                </TabsList>

                {Object.entries(tasksByShift).map(([shiftKey, shiftData]) => {
                    const areAllSectionsOpen = tasksByShift?.[shiftKey] ? (openSections[shiftKey] || []).length === tasksByShift[shiftKey].sections.length : false;
                    return (
                        <TabsContent value={shiftKey} key={shiftKey}>
                            <Card>
                                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="space-y-1.5">
                                        <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl"><ListTodo /> Công việc {shiftData.name}</CardTitle>
                                        <CardDescription>Danh sách này sẽ được hiển thị cho nhân viên vào đầu mỗi ca.</CardDescription>
                                    </div>
                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                        <Button variant="outline" size="sm" onClick={() => handleExport(shiftKey)} className="w-full sm:w-auto">
                                            <Download className="mr-2 h-4 w-4" />
                                            Xuất dữ liệu
                                        </Button>
                                        {isSorting ? (
                                            <Button variant="default" size="sm" onClick={toggleSortMode} className="w-full sm:w-auto">
                                                <Check className="mr-2 h-4 w-4" />
                                                Xong
                                            </Button>
                                        ) : (
                                            <Button variant="outline" size="sm" onClick={toggleSortMode} className="w-full sm:w-auto">
                                                <Shuffle className="mr-2 h-4 w-4" />
                                                Sắp xếp
                                            </Button>
                                        )}
                                        {shiftData.sections.length > 0 && (
                                            <Button variant="outline" size="sm" onClick={() => handleToggleAll(shiftKey)} className="w-full sm:w-auto">
                                                <ChevronsDownUp className="mr-2 h-4 w-4" />
                                                {areAllSectionsOpen ? 'Thu gọn' : 'Mở rộng'}
                                            </Button>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <Accordion
                                        type="multiple"
                                        value={openSections[shiftKey] || []}
                                        onValueChange={(value) => setOpenSections(prev => ({ ...prev, [shiftKey]: value }))}
                                        className="w-full space-y-4"
                                    >
                                        {shiftData.sections.map(section => (
                                            <AccordionItem value={section.title} key={section.title} className="border rounded-lg">
                                                <AccordionTrigger className="p-4 text-lg font-medium" disabled={isSorting}>{section.title}</AccordionTrigger>
                                                <AccordionContent className="p-4 border-t">
                                                    <div className="space-y-4">
                                                        <div className="space-y-2">
                                                            {section.tasks.map((task, taskIndex) => (
                                                                <div key={task.id} className="flex items-center gap-2 rounded-md border bg-card p-3">

                                                                    {editingTask?.taskId === task.id ? (
                                                                        <div className="flex-1 flex flex-col sm:flex-row gap-2 items-center">
                                                                            <Input
                                                                                value={editingTask.newText}
                                                                                onChange={(e) => setEditingTask({ ...editingTask, newText: e.target.value })}
                                                                                autoFocus
                                                                                className="text-sm h-9 flex-1"
                                                                            />
                                                                            <Input
                                                                                type="number"
                                                                                min="1"
                                                                                value={editingTask.newMinCompletions}
                                                                                onChange={(e) => {
                                                                                    if (editingTask) {
                                                                                        setEditingTask({ ...editingTask, newMinCompletions: parseInt(e.target.value) || 1 });
                                                                                    }
                                                                                }}
                                                                                className="text-sm h-9 w-20"
                                                                                placeholder="Tối thiểu"
                                                                            />
                                                                            <Combobox
                                                                                value={editingTask.newType}
                                                                                onChange={(value) => {
                                                                                    if (editingTask) {
                                                                                        setEditingTask({ ...editingTask, newType: value as Task['type'] });
                                                                                    }
                                                                                }}
                                                                                options={[
                                                                                    { value: "photo", label: "Hình ảnh" },
                                                                                    { value: "boolean", label: "Đảm bảo / Không đảm bảo" },
                                                                                    { value: "opinion", label: "Ý kiến" }
                                                                                ]}
                                                                                className="h-9 w-full sm:w-[180px]"
                                                                                compact
                                                                                searchable={false}
                                                                            />
                                                                            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={handleUpdateTask}>
                                                                                <Check className="h-4 w-4 text-green-500" />
                                                                            </Button>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2">
                                                                            <p className="text-sm flex items-center gap-2 flex-1">
                                                                                {task.isCritical && <Star className="h-4 w-4 text-yellow-500 shrink-0" />}
                                                                                {getTaskTypeIcon(task.type)}
                                                                                {task.text}
                                                                            </p>
                                                                            {task.minCompletions && task.minCompletions > 1 && (
                                                                                <Badge variant="secondary" className="w-fit text-xs font-normal">
                                                                                    x{task.minCompletions} lần
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {isSorting ? (
                                                                        <>
                                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleMoveTask(shiftKey, section.title, taskIndex, 'up')} disabled={taskIndex === 0}>
                                                                                <ArrowUp className="h-4 w-4" />
                                                                            </Button>
                                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleMoveTask(shiftKey, section.title, taskIndex, 'down')} disabled={taskIndex === section.tasks.length - 1}>
                                                                                <ArrowDown className="h-4 w-4" />
                                                                            </Button>
                                                                        </>
                                                                    ) : (
                                                                        <div className="flex items-center gap-0">
                                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleToggleCritical(shiftKey, section.title, task.id)}>
                                                                                <Star className={`h-4 w-4 ${task.isCritical ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} />
                                                                            </Button>
                                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setEditingTask({ shiftKey, sectionTitle: section.title, taskId: task.id, newText: task.text, newType: task.type, newMinCompletions: task.minCompletions || 1 })}>
                                                                                <Pencil className="h-4 w-4" />
                                                                            </Button>
                                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteTask(shiftKey, section.title, task.id)}>
                                                                                <Trash2 className="h-4 w-4" />
                                                                                <span className="sr-only">Xóa công việc</span>
                                                                            </Button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                            {section.tasks.length === 0 && (
                                                                <p className="text-sm text-muted-foreground text-center py-4">Chưa có công việc nào. Thêm công việc bên dưới.</p>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col gap-2 rounded-md border p-3">
                                                            <Input
                                                                placeholder="Nhập mô tả công việc mới"
                                                                value={newTask[shiftKey]?.[section.title]?.text || ''}
                                                                onChange={e => handleNewTaskChange(shiftKey, section.title, 'text', e.target.value)}
                                                                onKeyDown={e => e.key === 'Enter' && handleAddTask(shiftKey, section.title)}
                                                            />
                                                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                                                <div className="flex items-center space-x-2 w-full sm:w-auto">
                                                                    <Input
                                                                        type="number"
                                                                        min="1"
                                                                        value={newTask[shiftKey]?.[section.title]?.minCompletions || 1}
                                                                        onChange={(e) => handleNewTaskChange(shiftKey, section.title, 'minCompletions', parseInt(e.target.value) || 1)}
                                                                        placeholder="Tối thiểu"
                                                                        className="h-9 w-20"
                                                                    />
                                                                    <Combobox
                                                                        value={newTask[shiftKey]?.[section.title]?.type || 'photo'}
                                                                        onChange={(value) => handleNewTaskChange(shiftKey, section.title, 'type', value as Task['type'])}
                                                                        options={[
                                                                            { value: "photo", label: "Hình ảnh" },
                                                                            { value: "boolean", label: "Đảm bảo / Không đảm bảo" },
                                                                            { value: "opinion", label: "Ý kiến" }
                                                                        ]}
                                                                        className="h-9 w-auto"
                                                                        compact
                                                                        searchable={false}
                                                                    />
                                                                </div>
                                                                <div className="flex items-center space-x-2">
                                                                    <Checkbox
                                                                        id={`isCritical-${shiftKey}-${section.title}`}
                                                                        checked={newTask[shiftKey]?.[section.title]?.isCritical || false}
                                                                        onCheckedChange={(checked) => handleNewTaskChange(shiftKey, section.title, 'isCritical', checked as boolean)}
                                                                    />
                                                                    <Label htmlFor={`isCritical-${shiftKey}-${section.title}`} className="text-sm font-medium">Đánh dấu là quan trọng</Label>
                                                                </div>
                                                                <Button onClick={() => handleAddTask(shiftKey, section.title)} size="sm" className="w-full sm:w-auto">
                                                                    <Plus className="mr-2 h-4 w-4" /> Thêm công việc
                                                                </Button>
                                                            </div>
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
        </div>
    );
}
