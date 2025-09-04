
'use client';
import { useState, useEffect } from 'react';
import { dataStore } from '@/lib/data-store';
import type { Task, TasksByShift, TaskSection, ParsedServerTask } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, ListTodo, ArrowUp, ArrowDown, ChevronsDownUp, Wand2, Loader2, FileText, Image as ImageIcon } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function ServerTasksAiGenerator({ 
    tasksByShift,
    onTasksGenerated 
}: { 
    tasksByShift: TasksByShift | null,
    onTasksGenerated: (tasks: ParsedServerTask[], shiftKey: string, sectionTitle: string) => void 
}) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [textInput, setTextInput] = useState('');
    const [imageInput, setImageInput] = useState<string | null>(null);
    const [targetShift, setTargetShift] = useState('');
    const [targetSection, setTargetSection] = useState('');
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

    const resetState = () => {
        setTextInput('');
        setImageInput(null);
        const fileInput = document.getElementById('server-image-upload') as HTMLInputElement;
        if(fileInput) fileInput.value = '';
    }

    const handleGenerate = async (source: 'text' | 'image') => {
        setIsGenerating(true);

        try {
            const input = source === 'text' 
                ? { source, inputText: textInput }
                : { source, imageDataUri: imageInput! };
            
            if ((source === 'text' && !textInput.trim()) || (source === 'image' && !imageInput)) {
                toast({ title: "Lỗi", description: "Vui lòng cung cấp đầu vào.", variant: "destructive" });
                return;
            }
             if (!targetShift || !targetSection) {
                toast({ title: "Lỗi", description: "Vui lòng chọn ca và khu vực để thêm công việc.", variant: "destructive" });
                return;
            }
            
            toast({ title: "AI đang xử lý...", description: "Quá trình này có thể mất một chút thời gian."});

            const result = await generateServerTasks(input);
            
            if (!result || !result.tasks) {
                 throw new Error("AI không trả về kết quả hợp lệ.");
            }
            
            onTasksGenerated(result.tasks, targetShift, targetSection);

            toast({ title: "Hoàn tất!", description: `AI đã tạo ${result.tasks.length} công việc mới.`});
            resetState();

        } catch (error) {
            console.error("Failed to generate server tasks:", error);
            toast({ title: "Lỗi", description: "Không thể tạo danh sách công việc. Vui lòng thử lại.", variant: "destructive"});
        } finally {
            setIsGenerating(false);
        }
    };


    return (
        <Card className="mb-8">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Wand2 /> Thêm hàng loạt bằng AI</CardTitle>
                <CardDescription>Dán văn bản hoặc tải ảnh danh sách công việc để AI tự động thêm vào ca và mục bạn chọn.</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="text">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="text"><FileText className="mr-2 h-4 w-4"/>Dán văn bản</TabsTrigger>
                        <TabsTrigger value="image"><ImageIcon className="mr-2 h-4 w-4"/>Tải ảnh lên</TabsTrigger>
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
                             <Select onValueChange={setTargetShift}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Chọn ca..." />
                                </SelectTrigger>
                                <SelectContent>
                                     <SelectItem value="sang">Ca Sáng</SelectItem>
                                     <SelectItem value="trua">Ca Trưa</SelectItem>
                                     <SelectItem value="toi">Ca Tối</SelectItem>
                                </SelectContent>
                            </Select>
                             <Select onValueChange={setTargetSection}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Chọn mục..." />
                                </SelectTrigger>
                                <SelectContent>
                                     <SelectItem value="Đầu ca">Đầu ca</SelectItem>
                                     <SelectItem value="Trong ca">Trong ca</SelectItem>
                                     <SelectItem value="Cuối ca">Cuối ca</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button onClick={() => handleGenerate('text')} disabled={isGenerating || !textInput.trim() || !targetShift || !targetSection} className="w-full sm:w-auto">
                                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                Tạo từ văn bản
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
                             <Select onValueChange={setTargetShift}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Chọn ca..." />
                                </SelectTrigger>
                                <SelectContent>
                                     <SelectItem value="sang">Ca Sáng</SelectItem>
                                     <SelectItem value="trua">Ca Trưa</SelectItem>
                                     <SelectItem value="toi">Ca Tối</SelectItem>
                                </SelectContent>
                            </Select>
                             <Select onValueChange={setTargetSection}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Chọn mục..." />
                                </SelectTrigger>
                                <SelectContent>
                                     <SelectItem value="Đầu ca">Đầu ca</SelectItem>
                                     <SelectItem value="Trong ca">Trong ca</SelectItem>
                                     <SelectItem value="Cuối ca">Cuối ca</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button onClick={() => handleGenerate('image')} disabled={isGenerating || !imageInput || !targetShift || !targetSection} className="w-full sm:w-auto">
                                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                Tạo từ ảnh
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    )
}

export default function TaskListsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [tasksByShift, setTasksByShift] = useState<TasksByShift | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newTask, setNewTask] = useState<{ [shiftKey: string]: { [sectionTitle: string]: { text: string; isCritical: boolean } } }>({});
  
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

  const handleUpdateAndSave = (newTasks: TasksByShift) => {
    setTasksByShift(newTasks); // Optimistic update
    dataStore.updateTasks(newTasks).then(() => {
      toast({
          title: "Đã lưu thay đổi!",
          description: "Danh sách công việc đã được cập nhật trên cloud.",
      });
    }).catch(err => {
       toast({
          title: "Lỗi!",
          description: "Không thể lưu thay đổi. Vui lòng thử lại.",
          variant: "destructive"
      });
      console.error(err);
    });
  }

  const onAiTasksGenerated = (tasks: ParsedServerTask[], shiftKey: string, sectionTitle: string) => {
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
      handleUpdateAndSave(newTasksState);
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
        <h1 className="text-3xl font-bold font-headline">Quản lý danh sách công việc</h1>
        <p className="text-muted-foreground">Tạo và chỉnh sửa các công việc hàng ngày cho tất cả các ca.</p>
      </header>
      
       <ServerTasksAiGenerator tasksByShift={tasksByShift} onTasksGenerated={onAiTasksGenerated} />

       <Tabs defaultValue="sang" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sang"><Sun className="mr-2"/>Ca Sáng</TabsTrigger>
          <TabsTrigger value="trua"><Sunset className="mr-2"/>Ca Trưa</TabsTrigger>
          <TabsTrigger value="toi"><Moon className="mr-2"/>Ca Tối</TabsTrigger>
        </TabsList>

        {Object.entries(tasksByShift).map(([shiftKey, shiftData]) => {
          const areAllSectionsOpen = (openSections[shiftKey] || []).length === shiftData.sections.length;
          return (
          <TabsContent value={shiftKey} key={shiftKey}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="space-y-1.5">
                    <CardTitle className="flex items-center gap-2"><ListTodo /> Công việc {shiftData.name}</CardTitle>
                    <CardDescription>Danh sách này sẽ được hiển thị cho nhân viên vào đầu mỗi ca.</CardDescription>
                </div>
                 {shiftData.sections.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => handleToggleAll(shiftKey)}>
                        <ChevronsDownUp className="mr-2 h-4 w-4"/>
                        {areAllSectionsOpen ? 'Thu gọn tất cả' : 'Mở rộng tất cả'}
                    </Button>
                 )}
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
                      <AccordionTrigger className="p-4 text-lg font-medium">{section.title}</AccordionTrigger>
                      <AccordionContent className="p-4 border-t">
                        <div className="space-y-4">
                            <div className="space-y-2">
                            {section.tasks.map((task, taskIndex) => (
                              <div key={task.id} className="flex items-center gap-2 rounded-md border bg-card p-3">
                                {task.isCritical && <Star className="h-4 w-4 text-yellow-500 shrink-0" />}
                                <p className="flex-1 text-sm">{task.text}</p>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleMoveTask(shiftKey, section.title, taskIndex, 'up')} disabled={taskIndex === 0}>
                                  <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleMoveTask(shiftKey, section.title, taskIndex, 'down')} disabled={taskIndex === section.tasks.length - 1}>
                                  <ArrowDown className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteTask(shiftKey, section.title, task.id)}>
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Xóa công việc</span>
                                </Button>
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
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                    <Checkbox 
                                        id={`isCritical-${shiftKey}-${section.title}`} 
                                        checked={newTask[shiftKey]?.[section.title]?.isCritical || false} 
                                        onCheckedChange={(checked) => handleNewTaskChange(shiftKey, section.title, 'isCritical', checked as boolean)}
                                    />
                                    <Label htmlFor={`isCritical-${shiftKey}-${section.title}`} className="text-sm font-medium">Đánh dấu là quan trọng</Label>
                                    </div>
                                    <Button onClick={() => handleAddTask(shiftKey, section.title)} size="sm">
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
