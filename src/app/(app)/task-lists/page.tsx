
'use client';
import { useState, useEffect } from 'react';
import { dataStore } from '@/lib/data-store';
import type { Task, TasksByShift, TaskSection } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Star, ListTodo, ArrowUp, ArrowDown, ChevronsDownUp } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sun, Moon, Sunset } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';

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
