
'use client';
import { useState, useEffect, useCallback } from 'react';
import { dataStore } from '@/lib/data-store';
import type { ComprehensiveTask, ComprehensiveTaskSection, ParsedComprehensiveTask, Task, TaskSection } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Trash2, Plus, Building, ListChecks, MessageSquare,
    Image as ImageIcon, CheckSquare, Pencil, ArrowDown,
    ArrowUp, ChevronsDownUp, Wand2, Loader2, FileText,
    Shuffle, Check, Download, AlertCircle, MoreVertical,
    LayoutDashboard
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'nextjs-toploader/app';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Combobox } from "@/components/combobox";
import { Label } from '@/components/ui/label';
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
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { callGenerateComprehensiveTasks } from '@/lib/ai-service';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogAction, DialogCancel } from '@/components/ui/dialog';
import { TaskDialog } from '../task-lists/_components/task-dialog';
import { Badge } from '@/components/ui/badge';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import { toast } from 'react-hot-toast';

function AiAssistant({
    sections,
    onTasksGenerated,
}: {
    sections: ComprehensiveTaskSection[];
    onTasksGenerated: (tasks: ParsedComprehensiveTask[], section: string) => void;
}) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [textInput, setTextInput] = useState('');
    const [imageInput, setImageInput] = useState<string | null>(null);
    const [targetSection, setTargetSection] = useState('');
    const [previewTasks, setPreviewTasks] = useState<ParsedComprehensiveTask[]>([]);
    const [showPreview, setShowPreview] = useState(false);
    const { toast } = useToast();

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
        const fileInput = document.getElementById('comp-image-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
    };

    const handleGenerate = async (source: 'text' | 'image') => {
        setIsGenerating(true);

        try {
            const input = source === 'text' ? { source, inputText: textInput } : { source, imageDataUri: imageInput! };

            if ((source === 'text' && !textInput.trim()) || (source === 'image' && !imageInput)) {
                toast({ title: 'Lỗi', description: 'Vui lòng cung cấp đầu vào.', variant: 'destructive' });
                setIsGenerating(false);
                return;
            }
            const defaultSection = sections.length > 0 ? sections[0].title : '';
            if (!defaultSection) {
                toast({ title: "Lỗi", description: "Không có khu vực nào để thêm công việc vào.", variant: "destructive" });
                setIsGenerating(false);
                return;
            }
            setTargetSection(defaultSection);

            toast({ title: 'AI đang xử lý...', description: 'Quá trình này có thể mất một chút thời gian.' });

            const result = await callGenerateComprehensiveTasks(input);

            if (!result || !result.tasks) {
                throw new Error('AI không trả về kết quả hợp lệ.');
            }

            setPreviewTasks(result.tasks);
            setShowPreview(true);

        } catch (error) {
            console.error('Failed to generate comprehensive tasks:', error);
            toast({ title: 'Lỗi', description: 'Không thể tạo danh sách hạng mục. Vui lòng thử lại.', variant: 'destructive' });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleConfirmAdd = () => {
        onTasksGenerated(previewTasks, targetSection);
        toast({ title: 'Hoàn tất!', description: `Đã thêm ${previewTasks.length} hạng mục mới.` });
        resetAddState();
        setShowPreview(false);
        setPreviewTasks([]);
    }

    return (
        <>
            <Card className="mb-8">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
                        <Wand2 /> Công cụ hỗ trợ AI
                    </CardTitle>
                    <CardDescription>Dán văn bản hoặc tải ảnh danh sách hạng mục để AI tự động thêm vào khu vực mặc định.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="text">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="text">
                                <FileText className="mr-2 h-4 w-4" />
                                Dán văn bản
                            </TabsTrigger>
                            <TabsTrigger value="image">
                                <ImageIcon className="mr-2 h-4 w-4" />
                                Tải ảnh lên
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="text" className="mt-4 space-y-4">
                            <Textarea
                                placeholder="Dán danh sách các hạng mục vào đây. Bạn có thể ghi rõ khu vực bằng cách dùng '#' ở đầu dòng, ví dụ: '# Tầng 1: Sàn nhà sạch sẽ - hình ảnh'."
                                rows={4}
                                value={textInput}
                                onChange={(e) => setTextInput(e.target.value)}
                                disabled={isGenerating}
                            />
                            <Button onClick={() => handleGenerate('text')} disabled={isGenerating || !textInput.trim()} className="w-full sm:w-auto">
                                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                Tạo
                            </Button>
                        </TabsContent>
                        <TabsContent value="image" className="mt-4 space-y-4">
                            <Input id="comp-image-upload" type="file" accept="image/*" onChange={handleFileChange} disabled={isGenerating} />
                            <Button onClick={() => handleGenerate('image')} disabled={isGenerating || !imageInput} className="w-full sm:w-auto">
                                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                Tạo
                            </Button>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <Dialog open={showPreview} onOpenChange={setShowPreview} dialogTag="comp-checklist-preview-dialog" parentDialogTag="root">
                <DialogContent className="max-w-2xl">
                    <AlertDialogHeader>
                        <AlertDialogIcon icon={Wand2} />
                        <div className="space-y-2 text-center sm:text-left">
                            <AlertDialogTitle>Xem trước các hạng mục sẽ được thêm</AlertDialogTitle>
                            <AlertDialogDescription>
                                AI đã phân tích đầu vào của bạn. Kiểm tra lại danh sách dưới đây trước khi thêm chúng vào khu vực <span className="font-bold">"{targetSection}"</span>.
                            </AlertDialogDescription>
                        </div>
                    </AlertDialogHeader>
                    <div className="max-h-[50vh] overflow-y-auto p-2 border rounded-md">
                        <ul className="space-y-2">
                            {previewTasks.map((task, index) => (
                                <li key={index} className="flex items-center gap-3 p-2 rounded-md bg-muted/50 text-sm">
                                    <Plus className="h-4 w-4 text-green-500" />
                                    <span className="flex-1">{task.text}</span>
                                    <Badge>{task.type}</Badge>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmAdd}>Thêm {previewTasks.length} hạng mục</AlertDialogAction>
                    </AlertDialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

export default function ComprehensiveChecklistPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [sections, setSections] = useState<ComprehensiveTaskSection[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSorting, setIsSorting] = useState(false);

    const [addingToSection, setAddingToSection] = useState<string | null>(null);
    const [editingTask, setEditingTask] = useState<{ sectionTitle: string; taskId: string; text: string; type: Task['type']; minCompletions: number; isCritical: boolean; instruction?: { text?: string; images?: { url: string; caption?: string }[] } } | null>(null);

    const [newSectionTitle, setNewSectionTitle] = useState('');
    const [editingSection, setEditingSection] = useState<{ title: string; newTitle: string } | null>(null);

    const [openItems, setOpenItems] = useState<string[]>([]);

    const handleReconnect = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
    }, []);

    useEffect(() => {
        if (!authLoading) {
            if (!user || user.role !== 'Chủ nhà hàng') {
                router.replace('/');
            }
        }
    }, [user, authLoading, router]);

    useDataRefresher(handleReconnect);

    useEffect(() => {
        if (!user) return;

        const unsubscribe = dataStore.subscribeToComprehensiveTasks((data) => {
            setSections(data);
            if (data.length > 0 && openItems.length === 0) {
                setOpenItems(data.map(s => s.title));
            }
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user, refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleUpdateAndSave = (newSections: ComprehensiveTaskSection[], showToast: boolean = true) => {
        setSections(newSections); // Optimistic update
        dataStore.updateComprehensiveTasks(newSections).then(() => {
            if (showToast) {
                toast.success("Đã lưu thay đổi!");
            }
        }).catch(err => {
            toast.error("Không thể lưu thay đổi. Vui lòng thử lại.");
            console.error(err);
        });
    }

    const onAiTasksGenerated = (tasks: ParsedComprehensiveTask[], sectionTitle: string) => {
        if (!sections) return;

        const newTasksToAdd: ComprehensiveTask[] = tasks.map(task => ({
            id: `comp-task-${Date.now()}-${Math.random()}`,
            text: task.text,
            type: task.type,
        }));

        const newSectionsState = JSON.parse(JSON.stringify(sections));
        const section = newSectionsState.find((s: ComprehensiveTaskSection) => s.title === sectionTitle);

        if (section) {
            section.tasks.push(...newTasksToAdd);
            handleUpdateAndSave(newSectionsState);
            if (!openItems.includes(sectionTitle)) {
                setOpenItems(prev => [...prev, sectionTitle]);
            }
        }
    };

    // Section Management
    const handleAddSection = () => {
        if (!sections || newSectionTitle.trim() === '') return;
        if (sections.some(s => s.title === newSectionTitle.trim())) {
            toast.error("Khu vực này đã tồn tại.");
            return;
        }
        const newSectionToAdd: ComprehensiveTaskSection = { title: newSectionTitle.trim(), tasks: [] };
        const newSectionsState = [...sections, newSectionToAdd];
        handleUpdateAndSave(newSectionsState);
        setNewSectionTitle('');
    }

    const handleDeleteSection = (sectionTitle: string) => {
        if (!sections) return;
        const newSectionsState = sections.filter(s => s.title !== sectionTitle);
        handleUpdateAndSave(newSectionsState);
    }

    const handleRenameSection = (oldTitle: string) => {
        if (!sections || !editingSection || editingSection.newTitle.trim() === '') {
            setEditingSection(null);
            return;
        };
        if (sections.some(s => s.title === editingSection.newTitle.trim())) {
            toast.error("Tên khu vực này đã tồn tại.");
            return;
        }
        const newSectionsState = sections.map(s =>
            s.title === oldTitle ? { ...s, title: editingSection.newTitle.trim() } : s
        );
        handleUpdateAndSave(newSectionsState);
        setEditingSection(null);
    }

    const handleMoveSection = (index: number, direction: 'up' | 'down') => {
        if (!sections) return;
        const newSections = [...sections];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= newSections.length) return;
        [newSections[index], newSections[newIndex]] = [newSections[newIndex], newSections[index]];
        handleUpdateAndSave(newSections, false);
    };

    // Task Management
    const handleAddTask = (sectionTitle: string, taskData: Omit<Task, 'id'>) => {
        if (!sections) return;

        const newTaskToAdd: ComprehensiveTask = {
            id: `comp-task-${Date.now()}`,
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
        const section = newSectionsState.find((s: ComprehensiveTaskSection) => s.title === sectionTitle);
        if (section) {
            section.tasks.push(newTaskToAdd);
        }

        handleUpdateAndSave(newSectionsState);
        setAddingToSection(null);
    };

    const handleDeleteTask = (sectionTitle: string, taskId: string) => {
        if (!sections) return;
        const newSectionsState = JSON.parse(JSON.stringify(sections));
        const section = newSectionsState.find((s: ComprehensiveTaskSection) => s.title === sectionTitle);
        if (section) {
            section.tasks = section.tasks.filter((task: ComprehensiveTask) => task.id !== taskId);
        }
        handleUpdateAndSave(newSectionsState);
    };

    const handleUpdateTask = (data: Omit<Task, 'id'>) => {
        if (!sections || !editingTask) {
            setEditingTask(null);
            return;
        };

        const { sectionTitle, taskId } = editingTask;
        const { text, type, minCompletions, isCritical, instruction } = data;

        const newSectionsState = JSON.parse(JSON.stringify(sections));
        const section = newSectionsState.find((s: ComprehensiveTaskSection) => s.title === sectionTitle);
        if (section) {
            const task = section.tasks.find((t: ComprehensiveTask) => t.id === taskId);
            if (task) {
                task.text = text.trim();
                task.type = type;
                task.minCompletions = minCompletions || 1;
                task.isCritical = !!isCritical;

                if (instruction) {
                    task.instruction = {
                        text: instruction.text ?? "",
                        images: instruction.images ?? []
                    };
                } else {
                    delete task.instruction;
                }
            }
        }
        handleUpdateAndSave(newSectionsState);
        setEditingTask(null);
    };

    const handleMoveTask = (sectionIndex: number, taskIndex: number, direction: 'up' | 'down') => {
        if (!sections) return;
        const newSections = [...sections];
        const section = newSections[sectionIndex];
        const tasks = section.tasks;
        const newIndex = direction === 'up' ? taskIndex - 1 : taskIndex + 1;
        if (newIndex < 0 || newIndex >= tasks.length) return;
        [tasks[taskIndex], tasks[newIndex]] = [tasks[newIndex], tasks[taskIndex]];
        handleUpdateAndSave(newSections, false);
    };

    const getTaskTypeIcon = (type: Task['type']) => {
        switch (type) {
            case 'photo': return <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-md"><ImageIcon className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" /></div>;
            case 'boolean': return <div className="p-1.5 bg-sky-100 dark:bg-sky-900/30 rounded-md"><CheckSquare className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" /></div>;
            case 'opinion': return <div className="p-1.5 bg-orange-100 dark:bg-orange-900/30 rounded-md"><MessageSquare className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0" /></div>;
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
            toast.success("Danh sách hạng mục đã được sao chép vào bộ nhớ tạm.");
        }).catch(err => {
            toast.error("Không thể sao chép.");
        });
    };

    if (isLoading || authLoading) {
        return <LoadingPage />;
    }

    if (!sections) {
        return <div className="container mx-auto p-4 sm:p-6 md:p-8">Không thể tải danh sách công việc.</div>;
    }

    const areAllSectionsOpen = sections && openItems.length === sections.length;
    const totalTasks = sections?.reduce((acc, s) => acc + (s.tasks?.length || 0), 0) || 0;

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-5xl">
            <header className="mb-8 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl">
                                <ListChecks className="h-8 w-8 text-primary" />
                            </div>
                            Hạng mục Tổng hợp
                        </h1>
                        <p className="text-muted-foreground">
                            Quản lý {sections?.length || 0} khu vực và {totalTasks} hạng mục kiểm tra.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {isSorting ? (
                            <Button
                                variant="default"
                                size="sm"
                                onClick={toggleSortMode}
                                className="shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90"
                            >
                                <Check className="mr-2 h-4 w-4" />
                                Xong
                            </Button>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={toggleSortMode}
                                className="bg-background/50 backdrop-blur-sm border-primary/20 hover:border-primary/50 transition-all"
                            >
                                <Shuffle className="mr-2 h-4 w-4 text-primary" />
                                Sắp xếp
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExport}
                            className="bg-background/50 backdrop-blur-sm"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Xuất
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="md:col-span-3 border-dashed bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group">
                        <CardContent className="p-4 flex items-center justify-between" onClick={() => (document.getElementById('new-section-input') as HTMLInputElement)?.focus()}>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                                    <Plus className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1">
                                    <Input
                                        id="new-section-input"
                                        placeholder="Tên khu vực mới (ví dụ: Tầng 3)"
                                        value={newSectionTitle}
                                        onChange={e => setNewSectionTitle(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAddSection()}
                                        className="border-none bg-transparent p-0 focus-visible:ring-0 text-lg font-medium placeholder:text-muted-foreground/50"
                                    />
                                    <p className="text-xs text-muted-foreground">Nhấn Enter để thêm nhanh</p>
                                </div>
                            </div>
                            <Button size="sm" onClick={handleAddSection} disabled={!newSectionTitle.trim()}>
                                Thêm
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="bg-primary/5 border-primary/20">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div className="space-y-0.5">
                                <p className="text-sm font-medium">Trạng thái</p>
                                <p className="text-xs text-muted-foreground">{areAllSectionsOpen ? 'Đang mở hết' : 'Đang thu gọn'}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={handleToggleAll} className="hover:bg-primary/10">
                                <ChevronsDownUp className={areAllSectionsOpen ? "h-5 w-5 rotate-180 transition-transform" : "h-5 w-5 transition-transform"} />
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </header>

            <AiAssistant sections={sections || []} onTasksGenerated={onAiTasksGenerated} />

            <div className="space-y-6">
                <Accordion type="multiple" value={openItems} onValueChange={setOpenItems} className="space-y-4">
                    {sections?.map((section, sectionIndex) => (
                        <div key={section.title} className="group/section">
                            <AccordionItem value={section.title} className="border rounded-2xl bg-card overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 border-muted/60">
                                <div className="flex items-center px-4 py-2 bg-muted/30 group-hover/section:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className="p-2 bg-background rounded-lg shadow-sm border border-muted/50">
                                            <Building className="h-5 w-5 text-primary" />
                                        </div>
                                        {editingSection?.title === section.title ? (
                                            <div className="flex items-center gap-2 flex-1 max-w-md">
                                                <Input
                                                    value={editingSection.newTitle}
                                                    onChange={(e) => setEditingSection({ ...editingSection, newTitle: e.target.value })}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleRenameSection(section.title);
                                                        if (e.key === 'Escape') setEditingSection(null);
                                                    }}
                                                    onBlur={() => handleRenameSection(section.title)}
                                                    autoFocus
                                                    className="h-9 font-semibold"
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex flex-col">
                                                <span className="font-bold text-lg">{section.title}</span>
                                                <span className="text-xs text-muted-foreground">{section.tasks.length} hạng mục</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-1">
                                        {isSorting ? (
                                            <div className="flex items-center bg-background/80 rounded-lg border border-muted/50 p-1 shadow-sm">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleMoveSection(sectionIndex, 'up')} disabled={sectionIndex === 0}>
                                                    <ArrowUp className="h-4 w-4" />
                                                </Button>
                                                <div className="w-[1px] h-4 bg-muted mx-1" />
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleMoveSection(sectionIndex, 'down')} disabled={sectionIndex === (sections?.length || 0) - 1}>
                                                    <ArrowDown className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-9 w-9 text-muted-foreground hover:bg-background hover:text-primary transition-all rounded-full"
                                                    onClick={() => setEditingSection({ title: section.title, newTitle: section.title })}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <AlertDialog dialogTag={`delete-section-${section.title}`} parentDialogTag="root" variant="destructive">
                                                    <AlertDialogTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-9 w-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all rounded-full"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogIcon icon={Trash2} />
                                                            <div className="space-y-2">
                                                                <AlertDialogTitle>Xóa khu vực "{section.title}"?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Hành động này không thể được hoàn tác. Tất cả <strong>{section.tasks.length}</strong> hạng mục kiểm tra sẽ bị xóa vĩnh viễn.
                                                                </AlertDialogDescription>
                                                            </div>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteSection(section.title)} className="bg-destructive hover:bg-destructive/90">Xóa vĩnh viễn</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        )}
                                        <AccordionTrigger className="h-9 w-9 p-0 flex items-center justify-center hover:bg-background rounded-full transition-all ml-1" />
                                    </div>
                                </div>

                                <AccordionContent className="p-0 border-t border-muted/50 bg-background/50">
                                    <div className="divide-y divide-muted/30">
                                        {section.tasks.length > 0 ? (
                                            section.tasks.map((task, taskIndex) => (
                                                <div
                                                    key={task.id || taskIndex}
                                                    className="group/task flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-all duration-200"
                                                >
                                                    <div className="flex-shrink-0">
                                                        {getTaskTypeIcon(task.type)}
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-sm font-semibold text-foreground/90 leading-tight">
                                                                {task.text}
                                                            </span>
                                                            {task.isCritical && (
                                                                <Badge variant="destructive" className="h-5 px-1.5 text-[10px] uppercase tracking-wider font-bold animate-pulse">
                                                                    <AlertCircle className="h-3 w-3 mr-1" /> Tối quan trọng
                                                                </Badge>
                                                            )}
                                                            {task.minCompletions && task.minCompletions > 1 && (
                                                                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border-none">
                                                                    <Check className="h-3 w-3 mr-1" /> {task.minCompletions} lần
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        {task.instruction && (
                                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 w-fit px-2 py-0.5 rounded-md border border-muted/50">
                                                                <FileText className="h-3 w-3" />
                                                                <span>Có hướng dẫn</span>
                                                                {task.instruction.images && task.instruction.images.length > 0 && (
                                                                    <Badge variant="outline" className="h-4 px-1 text-[9px] border-muted-foreground/30 font-normal">
                                                                        +{task.instruction.images.length} ảnh
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex-shrink-0 flex items-center gap-1 transition-all">
                                                        {isSorting ? (
                                                            <div className="flex items-center bg-background rounded-lg border border-muted/50 shadow-sm p-0.5">
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleMoveTask(sectionIndex, taskIndex, 'up')} disabled={taskIndex === 0}>
                                                                    <ArrowUp className="h-4 w-4" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleMoveTask(sectionIndex, taskIndex, 'down')} disabled={taskIndex === section.tasks.length - 1}>
                                                                    <ArrowDown className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-muted-foreground hover:bg-background hover:text-primary transition-colors"
                                                                    onClick={() => setEditingTask({
                                                                        sectionTitle: section.title,
                                                                        taskId: task.id,
                                                                        text: task.text,
                                                                        type: task.type,
                                                                        minCompletions: task.minCompletions || 1,
                                                                        isCritical: !!task.isCritical,
                                                                        instruction: task.instruction
                                                                    })}
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                                                                    onClick={() => handleDeleteTask(section.title, task.id)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="py-12 flex flex-col items-center justify-center text-center px-4 bg-muted/10">
                                                <div className="p-4 bg-background rounded-full shadow-sm border border-muted/50 mb-4">
                                                    <ListChecks className="h-8 w-8 text-muted-foreground/40" />
                                                </div>
                                                <h3 className="text-lg font-semibold text-muted-foreground">Chưa có hạng mục nào</h3>
                                                <p className="text-sm text-muted-foreground/60 max-w-[250px] mt-1">
                                                    Khu vực này đang trống. Hãy thêm các hạng mục kiểm tra để bắt đầu.
                                                </p>
                                            </div>
                                        )}

                                        <div className="p-3 bg-muted/10 flex justify-center border-t border-muted/30">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setAddingToSection(section.title)}
                                                className="w-full max-w-[200px] border border-dashed border-primary/20 text-primary hover:bg-primary/10 hover:border-primary/40 transition-all font-medium rounded-xl h-10"
                                            >
                                                <Plus className="mr-2 h-4 w-4" /> Thêm hạng mục
                                            </Button>
                                        </div>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </div>
                    ))}
                </Accordion>

                {sections?.length === 0 && (
                    <div className="text-center py-24 bg-card border rounded-3xl shadow-sm border-dashed border-muted-foreground/20">
                        <div className="p-6 bg-primary/5 rounded-full w-fit mx-auto mb-6">
                            <Building className="h-12 w-12 text-primary/40" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Chưa có khu vực nào</h2>
                        <p className="text-muted-foreground mb-8 max-w-md mx-auto px-4">
                            Hãy bắt đầu bằng cách thêm một khu vực (ví dụ: Tầng 1, Nhà vệ sinh) và thêm các hạng mục kiểm tra bên trong.
                        </p>
                        <Button size="lg" onClick={() => (document.getElementById('new-section-input') as HTMLInputElement)?.focus()} className="shadow-lg shadow-primary/20 h-14 px-8 rounded-2xl font-bold">
                            <Plus className="mr-2 h-6 w-6" /> Tạo khu vực đầu tiên
                        </Button>
                    </div>
                )}
            </div>

            {addingToSection && (
                <TaskDialog
                    isOpen={!!addingToSection}
                    onClose={() => setAddingToSection(null)}
                    onConfirm={(data) => handleAddTask(addingToSection, data)}
                    sectionTitle={addingToSection}
                />
            )}

            {editingTask && (
                <TaskDialog
                    isOpen={!!editingTask}
                    onClose={() => setEditingTask(null)}
                    onConfirm={handleUpdateTask}
                    initialData={editingTask}
                    sectionTitle={editingTask.sectionTitle}
                />
            )}
        </div>
    );
}
