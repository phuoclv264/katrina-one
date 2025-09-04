
'use client';
import { useState, useEffect } from 'react';
import { dataStore } from '@/lib/data-store';
import type { ComprehensiveTask, ComprehensiveTaskSection } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Building, ListChecks, RadioTower, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function ComprehensiveChecklistPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<ComprehensiveTaskSection[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newTask, setNewTask] = useState<{ [sectionTitle: string]: { text: string; type: 'photo' | 'boolean' } }>({});

  useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'Chủ nhà hàng') {
        router.replace('/');
      } else {
        const unsubscribe = dataStore.subscribeToComprehensiveTasks((data) => {
          setTasks(data);
          setIsLoading(false);
        });
        return () => unsubscribe();
      }
    }
  }, [user, authLoading, router]);

  const handleUpdateAndSave = (newTasks: ComprehensiveTaskSection[]) => {
    dataStore.updateComprehensiveTasks(newTasks).then(() => {
      toast({
        title: "Đã lưu thay đổi!",
        description: "Danh sách kiểm tra đã được cập nhật.",
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

  const handleAddTask = (sectionTitle: string) => {
    if (!tasks) return;
    const taskDetails = newTask[sectionTitle];
    if (!taskDetails || taskDetails.text.trim() === '') return;

    const newTaskToAdd: ComprehensiveTask = {
      id: `comp-task-${Date.now()}`,
      text: taskDetails.text.trim(),
      type: taskDetails.type,
    };

    const newTasksState = JSON.parse(JSON.stringify(tasks));
    const section = newTasksState.find((s: ComprehensiveTaskSection) => s.title === sectionTitle);
    if (section) {
      section.tasks.push(newTaskToAdd);
    }

    handleUpdateAndSave(newTasksState);

    setNewTask(current => {
      const newTasksInputState = JSON.parse(JSON.stringify(current));
      delete newTasksInputState[sectionTitle];
      return newTasksInputState;
    });
  };

  const handleDeleteTask = (sectionTitle: string, taskId: string) => {
    if (!tasks) return;
    const newTasksState = JSON.parse(JSON.stringify(tasks));
    const section = newTasksState.find((s: ComprehensiveTaskSection) => s.title === sectionTitle);
    if (section) {
      section.tasks = section.tasks.filter((task: ComprehensiveTask) => task.id !== taskId);
    }
    handleUpdateAndSave(newTasksState);
  };

  const handleNewTaskChange = (sectionTitle: string, field: 'text' | 'type', value: string) => {
    setNewTask(current => {
      const newState = JSON.parse(JSON.stringify(current));
      if (!newState[sectionTitle]) newState[sectionTitle] = { text: '', type: 'boolean' };
      (newState[sectionTitle] as any)[field] = value;
      return newState;
    });
  };

  if (isLoading || authLoading) {
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

  if (!tasks) {
    return <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">Không thể tải danh sách công việc.</div>;
  }

  return (
    <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><ListChecks/> Quản lý Hạng mục Kiểm tra Toàn diện</h1>
        <p className="text-muted-foreground">Chỉnh sửa danh sách các hạng mục kiểm tra cho Quản lý.</p>
      </header>

      <Card>
        <CardContent className="pt-6">
          <Accordion type="multiple" defaultValue={tasks.map(s => s.title)} className="w-full space-y-4">
            {tasks.map(section => (
              <AccordionItem value={section.title} key={section.title} className="border rounded-lg">
                <AccordionTrigger className="p-4 text-lg font-medium">
                  <div className="flex items-center gap-3">
                    <Building className="h-5 w-5 text-primary"/>
                    {section.title}
                  </div>
                  </AccordionTrigger>
                <AccordionContent className="p-4 border-t">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      {section.tasks.map(task => (
                        <div key={task.id} className="flex items-center gap-2 rounded-md border bg-card p-3">
                           {task.type === 'boolean' ? <RadioTower className="h-4 w-4 text-sky-500 shrink-0" /> : <ImageIcon className="h-4 w-4 text-green-500 shrink-0" />}
                          <p className="flex-1 text-sm">{task.text}</p>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteTask(section.title, task.id)}>
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Xóa công việc</span>
                          </Button>
                        </div>
                      ))}
                      {section.tasks.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">Chưa có công việc nào.</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 rounded-md border p-3">
                      <Input
                        placeholder="Nhập mô tả công việc mới"
                        value={newTask[section.title]?.text || ''}
                        onChange={e => handleNewTaskChange(section.title, 'text', e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddTask(section.title)}
                      />
                      <div className="flex items-center justify-between">
                         <div className="w-48">
                            <Select 
                                value={newTask[section.title]?.type || 'boolean'}
                                onValueChange={(value) => handleNewTaskChange(section.title, 'type', value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Loại công việc" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="boolean">Có / Không</SelectItem>
                                    <SelectItem value="photo">Chụp ảnh</SelectItem>
                                </SelectContent>
                            </Select>
                         </div>
                        <Button onClick={() => handleAddTask(section.title)} size="sm">
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
    </div>
  );
}

    