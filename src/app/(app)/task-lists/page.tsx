'use client';
import { useState } from 'react';
import { tasksByShift as initialTasksByShift } from '@/lib/data';
import type { Task, TasksByShift, TaskSection } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Star, ListTodo } from 'lucide-react';
import AiTaskGenerator from '@/components/ai-task-generator';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sun, Moon, Sunset } from 'lucide-react';

export default function TaskListsPage() {
  const [tasksByShift, setTasksByShift] = useState<TasksByShift>(initialTasksByShift);
  const [newTask, setNewTask] = useState<{ [shiftKey: string]: { [sectionTitle: string]: { text: string; isCritical: boolean } } }>({});

  const handleAddTask = (shiftKey: string, sectionTitle: string) => {
    const taskDetails = newTask[shiftKey]?.[sectionTitle];
    if (!taskDetails || taskDetails.text.trim() === '') return;

    const newTaskToAdd: Task = {
      id: `task-${Date.now()}`,
      text: taskDetails.text.trim(),
      isCritical: taskDetails.isCritical,
    };

    setTasksByShift(current => {
      const newTasks = JSON.parse(JSON.stringify(current));
      const section = newTasks[shiftKey].sections.find((s: TaskSection) => s.title === sectionTitle);
      if (section) {
        section.tasks.push(newTaskToAdd);
      }
      return newTasks;
    });

    setNewTask(current => {
      const newTasksState = JSON.parse(JSON.stringify(current));
      if (newTasksState[shiftKey]) {
        delete newTasksState[shiftKey][sectionTitle];
      }
      return newTasksState;
    });
  };

  const handleDeleteTask = (shiftKey: string, sectionTitle: string, taskId: string) => {
    setTasksByShift(current => {
      const newTasks = JSON.parse(JSON.stringify(current));
      const section = newTasks[shiftKey].sections.find((s: TaskSection) => s.title === sectionTitle);
      if (section) {
        section.tasks = section.tasks.filter((task: Task) => task.id !== taskId);
      }
      return newTasks;
    });
  };

  const handleNewTaskChange = (shiftKey: string, sectionTitle: string, field: 'text' | 'isCritical', value: string | boolean) => {
    setNewTask(current => {
      const newState = JSON.parse(JSON.stringify(current));
      if (!newState[shiftKey]) newState[shiftKey] = {};
      if (!newState[shiftKey][sectionTitle]) newState[shiftKey][sectionTitle] = { text: '', isCritical: false };
      (newState[shiftKey][sectionTitle] as any)[field] = value;
      return newState;
    });
  };

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

        {Object.entries(tasksByShift).map(([shiftKey, shiftData]) => (
          <TabsContent value={shiftKey} key={shiftKey}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ListTodo /> Công việc {shiftData.name}</CardTitle>
                <CardDescription>Danh sách này sẽ được hiển thị cho nhân viên vào đầu mỗi ca.</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" defaultValue={shiftData.sections.map(s => s.title)} className="w-full space-y-4">
                  {shiftData.sections.map(section => (
                    <AccordionItem value={section.title} key={section.title} className="border rounded-lg">
                      <AccordionTrigger className="p-4 text-lg font-medium">{section.title}</AccordionTrigger>
                      <AccordionContent className="p-4 border-t">
                        <div className="space-y-4">
                            <div className="space-y-2">
                            {section.tasks.map(task => (
                              <div key={task.id} className="flex items-center gap-2 rounded-md border bg-card p-3">
                                {task.isCritical && <Star className="h-4 w-4 text-yellow-500 shrink-0" />}
                                <p className="flex-1 text-sm">{task.text}</p>
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
        ))}
      </Tabs>
    </div>
  );
}
