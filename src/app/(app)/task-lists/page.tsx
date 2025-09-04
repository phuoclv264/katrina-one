
'use client';
import { useState, useEffect } from 'react';
import { dataStore } from '@/lib/data-store';
import type { Task, TasksByShift, TaskSection, ParsedServerTask } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, ListTodo, ArrowUp, ArrowDown, ChevronsDownUp, Wand2, Loader2, FileText, Image as ImageIcon, Star, Shuffle, Check, Pencil, AlertCircle, Sparkles } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sun, Moon, Sunset } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Textarea } from '@/components/ui/textarea';
import { generateServerTasks } from '@/ai/flows/generate-server-tasks';
import { sortTasks } from '@/ai/flows/sort-tasks';
import type { GenerateServerTasksOutput } from '@/ai/flows/generate-server-tasks';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { diffChars } from 'diff';


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

    const [targetShift, setTargetShift] = useState('');
    const [targetSection, setTargetSection] = useState('');
    const [sortInstruction, setSortInstruction] = useState('');


    const [showAddPreview, setShowAddPreview] = useState(false);
    const [addPreviewTasks, setAddPreviewTasks] = useState<GenerateServerTasksOutput['tasks']>([]);

    const [showSortPreview, setShowSortPreview] = useState(false);
    const [sortPreview, setSortPreview] = useState<{ oldOrder: string[], newOrder: string[] }>({ oldOrder: [], newOrder: [] });

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
                toast({ title: "Lỗi", description: "Vui lòng cung cấp đầu vào.", variant: "destructive" });
                setIsGenerating(false);
                return;
            }
            if (!targetShift || !targetSection) {
                toast({ title: "Lỗi", description: "Vui lòng chọn ca và mục để thêm công việc.", variant: "destructive" });
                setIsGenerating(false);
                return;
            }

            toast({ title: "AI đang xử lý...", description: "Quá trình này có thể mất một chút thời gian." });

            const result = await generateServerTasks(input);

            if (!result || !result.tasks) {
                throw new Error("AI không trả về kết quả hợp lệ.");
            }

            setAddPreviewTasks(result.tasks);
            setShowAddPreview(true);

        } catch (error) {
            console.error("Failed to generate server tasks:", error);
            toast({ title: "Lỗi", description: "Không thể tạo danh sách công việc. Vui lòng thử lại.", variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleConfirmAdd = () => {
        onAddTasks(addPreviewTasks, targetShift, targetSection);
        toast({ title: "Hoàn tất!", description: `Đã thêm ${addPreviewTasks.length} công việc mới.` });
        resetAddState();
        setShowAddPreview(false);
        setAddPreviewTasks([]);
    };

    const handleGenerateSort = async () => {
        if (!targetShift || !targetSection) {
            toast({ title: "Lỗi", description: "Vui lòng chọn ca và mục để sắp xếp.", variant: "destructive" });
            return;
        }
        if (!sortInstruction.trim()) {
            toast({ title: "Lỗi", description: "Vui lòng nhập yêu cầu sắp xếp.", variant: "destructive" });
            return;
        }

        const sectionToSort = tasksByShift?.[targetShift]?.sections.find(s => s.title === targetSection);
        if (!sectionToSort || sectionToSort.tasks.length < 2) {
            toast({ title: "Không cần sắp xếp", description: "Mục này có ít hơn 2 công việc.", variant: "default" });
            return;
        }
        
        setIsGenerating(true);
        toast({ title: "AI đang sắp xếp...", description: "Vui lòng đợi một lát." });

        try {
            const currentTasks = sectionToSort.tasks.map(t => t.text);
            const result = await sortTasks({
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
            toast({ title: "Lỗi", description: "Không thể sắp xếp công việc. Vui lòng thử lại.", variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleConfirmSort = () => {
        onSortTasks(sortPreview.newOrder, targetShift, targetSection);
        toast({ title: "Hoàn tất!", description: `Đã sắp xếp lại công việc.` });
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
                                    placeholder="Dán danh sách các công việc vào đây, mỗi công việc trên một dòng. Có thể ghi chú (quan trọng) để AI nhận diện."
                                    rows={4}
                                    value={textInput}
                                    onChange={(e) => setTextInput(e.target.value)}
                                    disabled={isGenerating}
                                />
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <Select onValueChange={setTargetShift} value={targetShift} disabled={isGenerating}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Chọn ca..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="sang">Ca Sáng</SelectItem>
                                            <SelectItem value="trua">Ca Trưa</SelectItem>
                                            <SelectItem value="toi">Ca Tối</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Select onValueChange={setTargetSection} value={targetSection} disabled={isGenerating}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Chọn mục..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Đầu ca">Đầu ca</SelectItem>
                                            <SelectItem value="Trong ca">Trong ca</SelectItem>
                                            <SelectItem value="Cuối ca">Cuối ca</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button onClick={() => handleGenerateAdd('text')} disabled={isGenerating || !textInput.trim() || !targetShift || !targetSection} className="w-full sm:w-auto">
                                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                        Tạo
                                    </Button>
                                </div>
                            </TabsContent>
                            <TabsContent value="image" className="mt-4 space-y-4">
                                <Input
                                    id="server-image-upload"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    disabled={isGenerating}
                                />
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <Select onValueChange={setTargetShift} value={targetShift} disabled={isGenerating}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Chọn ca..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="sang">Ca Sáng</SelectItem>
                                            <SelectItem value="trua">Ca Trưa</SelectItem>
                                            <SelectItem value="toi">Ca Tối</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Select onValueChange={setTargetSection} value={targetSection} disabled={isGenerating}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Chọn mục..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Đầu ca">Đầu ca</SelectItem>
                                            <SelectItem value="Trong ca">Trong ca</SelectItem>
                                            <SelectItem value="Cuối ca">Cuối ca</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button onClick={() => handleGenerateAdd('image')} disabled={isGenerating || !imageInput || !targetShift || !targetSection} className="w-full sm:w-auto">
                                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                        Tạo
                                    </Button>
                                </div>
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
                            <Select onValueChange={setTargetShift} value={targetShift} disabled={isGenerating}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Chọn ca..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="sang">Ca Sáng</SelectItem>
                                    <SelectItem value="trua">Ca Trưa</SelectItem>
                                    <SelectItem value="toi">Ca Tối</SelectItem>
                                </SelectContent>
                            </Select>
                             <Select onValueChange={setTargetSection} value={targetSection} disabled={isGenerating}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Chọn mục..." />
                                </SelectTrigger>
                                <SelectContent>
                                     <SelectItem value="Đầu ca">Đầu ca</SelectItem>
                                     <SelectItem value="Trong ca">Trong ca</SelectItem>
                                     <SelectItem value="Cuối ca">Cuối ca</SelectItem>
                                </SelectContent>
                            </Select>
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
                        AI đã phân tích đầu vào của bạn. Kiểm tra lại danh sách dưới đây trước khi thêm chúng vào mục <span className="font-bold">"{targetSection}"</span> của <span className="font-bold">Ca {tasksByShift?.[targetShift]?.name}</span>.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                 <div className="max-h-[50vh] overflow-y-auto p-2 border rounded-md">
                   <ul className="space-y-2">
                        {addPreviewTasks.map((task, index) => (
                            <li key={index} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm">
                                {task.isCritical ? <Star className="h-4 w-4 text-yellow-500"/> : <Plus className="h-4 w-4 text-green-500"/>}
                                <span>{task.text}</span>
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
                                // Find original index for diffing
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
  const router = useRouter();
  const { toast } = useToast();
  const [tasksByShift, setTasksByShift] = useState<TasksByShift | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSorting, setIsSorting] = useState(false);
  const [newTask, setNewTask] = useState<{ [shiftKey: string]: { [sectionTitle: string]: { text: string; isCritical: boolean } } }>({});
  const [editingTask, setEditingTask] = useState<{ shiftKey: string; sectionTitle: string; taskId: string; newText: string } | null>(null);


  const [openSections, setOpenSections] = useState<{ [shiftKey: string]: string[] }>({});

  useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'Chủ nhà hàng') {
        router.replace('/shifts');
      } else {
        const unsubscribe = dataStore.subscribeToTasks((tasks) => {
          setTasksByShift(tasks);
          setIsLoading(false);
          // Initialize accordion state
          const initialOpenState: { [shiftKey: string]: string[] } = {};
          for (const shiftKey in tasks) {
            if (!openSections[shiftKey]) { // Only initialize if not already set
              initialOpenState[shiftKey] = tasks[shiftKey].sections.map(s => s.title);
            }
          }
          if (Object.keys(initialOpenState).length > 0) {
            setOpenSections(prev => ({...prev, ...initialOpenState}));
          }
        });
        return () => unsubscribe();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, router]);

  const handleUpdateAndSave = (newTasks: TasksByShift, showToast: boolean = true) => {
    setTasksByShift(newTasks); // Optimistic update
    dataStore.updateTasks(newTasks).then(() => {
        if(showToast) {
            toast({
                title: "Đã lưu thay đổi!",
                description: "Danh sách công việc đã được cập nhật trên cloud.",
            });
        }
    }).catch(err => {
       toast({
          title: "Lỗi!",
          description: "Không thể lưu thay đổi. Vui lòng thử lại.",
          variant: "destructive"
      });
      console.error(err);
    });
  }

  const onAiAddTasks = (tasks: ParsedServerTask[], shiftKey: string, sectionTitle: string) => {
      if (!tasksByShift) return;

      const newTasksToAdd: Task[] = tasks.map(task => ({
          id: `task-${Date.now()}-${Math.random()}`,
          text: task.text,
          isCritical: task.isCritical,
          type: 'photo',
      }));

      const newTasksState = JSON.parse(JSON.stringify(tasksByShift));
      const section = newTasksState[shiftKey]?.sections.find((s: TaskSection) => s.title === sectionTitle);

      if (section) {
          section.tasks.push(...newTasksToAdd);
          handleUpdateAndSave(newTasksState);
          // Ensure the accordion is open
          if (!(openSections[shiftKey] || []).includes(sectionTitle)) {
              setOpenSections(prev => {
                  const newOpen = { ...prev };
                  if (!newOpen[shiftKey]) newOpen[shiftKey] = [];
                  newOpen[shiftKey].push(sectionTitle);
                  return newOpen;
              });
          }
      } else {
          toast({ title: "Lỗi", description: "Không tìm thấy ca hoặc mục để thêm công việc vào.", variant: "destructive"});
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
            toast({ title: "Lỗi sắp xếp", description: "Không thể khớp các công việc đã sắp xếp. Thay đổi đã bị hủy.", variant: "destructive" });
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
      type: 'photo',
    };

    const newTasksState = JSON.parse(JSON.stringify(tasksByShift));
    const section = newTasksState[shiftKey].sections.find((s: TaskSection) => s.title === sectionTitle);
    if (section) {
      section.tasks.push(newTaskToAdd);
    }

    handleUpdateAndSave(newTasksState);

    setNewTask(current => {
      const newTasksInputState = JSON.parse(JSON.stringify(current));
      if (newTasksInputState[shiftKey]) {
        delete newTasksInputState[shiftKey][sectionTitle];
      }
      return newTasksInputState;
    });
  };

  const handleUpdateTask = (shiftKey: string, sectionTitle: string, taskId: string) => {
    if (!tasksByShift || !editingTask || editingTask.newText.trim() === '') {
        setEditingTask(null);
        return;
    }

    const newTasksState = JSON.parse(JSON.stringify(tasksByShift));
    const section = newTasksState[shiftKey].sections.find((s: TaskSection) => s.title === sectionTitle);
    if (section) {
        const task = section.tasks.find((t: Task) => t.id === taskId);
        if (task) {
            task.text = editingTask.newText.trim();
        }
    }
    handleUpdateAndSave(newTasksState);
    setEditingTask(null);
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

  const handleNewTaskChange = (shiftKey: string, sectionTitle: string, field: 'text' | 'isCritical', value: string | boolean) => {
    setNewTask(current => {
      const newState = JSON.parse(JSON.stringify(current));
      if (!newState[shiftKey]) newState[shiftKey] = {};
      if (!newState[shiftKey][sectionTitle]) newState[shiftKey][sectionTitle] = { text: '', isCritical: false };
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
        toast({
            title: "Đã lưu thứ tự mới!",
        });
    }
  }

  if(isLoading || authLoading) {
    return (
        <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">
             <header className="mb-8">
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
            </header>
            <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-48 w-full" />
            </div>
        </div>
    )
  }

  if(!tasksByShift){
    return <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">Không thể tải danh sách công việc.</div>;
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
          <TabsTrigger value="sang"><Sun className="mr-2"/>Ca Sáng</TabsTrigger>
          <TabsTrigger value="trua"><Sunset className="mr-2"/>Ca Trưa</TabsTrigger>
          <TabsTrigger value="toi"><Moon className="mr-2"/>Ca Tối</TabsTrigger>
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
                    {isSorting ? (
                        <Button variant="default" size="sm" onClick={toggleSortMode} className="w-full sm:w-auto">
                            <Check className="mr-2 h-4 w-4"/>
                            Xong
                        </Button>
                    ) : (
                        <Button variant="outline" size="sm" onClick={toggleSortMode} className="w-full sm:w-auto">
                            <Shuffle className="mr-2 h-4 w-4"/>
                            Sắp xếp
                        </Button>
                    )}
                    {shiftData.sections.length > 0 && (
                        <Button variant="outline" size="sm" onClick={() => handleToggleAll(shiftKey)} className="w-full sm:w-auto">
                            <ChevronsDownUp className="mr-2 h-4 w-4"/>
                            {areAllSectionsOpen ? 'Thu gọn' : 'Mở rộng'}
                        </Button>
                    )}
                 </div>
              </CardHeader>
              <CardContent>
                <Accordion
                    type="multiple"
                    value={openSections[shiftKey] || []}
                    onValueChange={(value) => setOpenSections(prev => ({...prev, [shiftKey]: value}))}
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
                                {task.isCritical && <Star className="h-4 w-4 text-yellow-500 shrink-0" />}
                                
                                {editingTask?.taskId === task.id ? (
                                    <Input
                                        value={editingTask.newText}
                                        onChange={(e) => setEditingTask({...editingTask, newText: e.target.value})}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleUpdateTask(shiftKey, section.title, task.id);
                                            if (e.key === 'Escape') setEditingTask(null);
                                        }}
                                        onBlur={() => handleUpdateTask(shiftKey, section.title, task.id)}
                                        autoFocus
                                        className="text-sm h-8 flex-1"
                                    />
                                ) : (
                                   <p className="flex-1 text-sm">{task.text}</p>
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
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setEditingTask({ shiftKey, sectionTitle: section.title, taskId: task.id, newText: task.text })}>
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
        )})}
      </Tabs>
    </div>
  );
}

