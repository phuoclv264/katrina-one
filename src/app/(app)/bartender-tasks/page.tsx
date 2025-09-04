
'use client';
import { useState, useEffect } from 'react';
import { dataStore } from '@/lib/data-store';
import type { Task, TaskSection } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Pencil, Droplets, UtensilsCrossed, Wind, ArrowUp, ArrowDown, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


export default function BartenderTasksPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [sections, setSections] = useState<TaskSection[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [newText, setNewText] = useState('');
  
  const [editingTask, setEditingTask] = useState<{ sectionTitle: string; taskId: string; newText: string } | null>(null);
  const [openItems, setOpenItems] = useState<string[]>([]);


  useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'Chủ nhà hàng') {
        router.replace('/');
      } else {
        const unsubscribe = dataStore.subscribeToBartenderTasks((data) => {
          setSections(data);
          setOpenItems(data.map(s => s.title));
          setIsLoading(false);
        });
        return () => unsubscribe();
      }
    }
  }, [user, authLoading, router]);

  const handleUpdateAndSave = (newSections: TaskSection[]) => {
    setSections(newSections); // Optimistic update
    dataStore.updateBartenderTasks(newSections).then(() => {
      toast({
        title: "Đã lưu thay đổi!",
        description: "Danh sách công việc đã được cập nhật.",
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
    if (!sections || newText.trim() === '') {
        toast({ title: "Lỗi", description: "Vui lòng điền nội dung công việc.", variant: "destructive" });
        return;
    };

    const newTaskToAdd: Task = {
      id: `bt-task-${Date.now()}`,
      text: newText.trim(),
      type: 'photo', // All bartender tasks are photo type
    };

    const newSectionsState = JSON.parse(JSON.stringify(sections));
    const section = newSectionsState.find((s: TaskSection) => s.title === sectionTitle);
    if (section) {
      section.tasks.push(newTaskToAdd);
    }

    handleUpdateAndSave(newSectionsState);
    setNewText('');
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
  
   const handleUpdateTask = (sectionTitle: string, taskId: string) => {
    if (!sections || !editingTask || editingTask.newText.trim() === '') return;

    const newSectionsState = JSON.parse(JSON.stringify(sections));
    const section = newSectionsState.find((s: TaskSection) => s.title === sectionTitle);
    if (section) {
        const task = section.tasks.find((t: Task) => t.id === taskId);
        if (task) {
            task.text = editingTask.newText.trim();
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
    handleUpdateAndSave(newSections);
  };

  const handleMoveSection = (sectionIndex: number, direction: 'up' | 'down') => {
    if (!sections) return;
    const newSections = [...sections];
    const newIndex = direction === 'up' ? sectionIndex - 1 : sectionIndex + 1;
    if (newIndex < 0 || newIndex >= newSections.length) return;

    [newSections[sectionIndex], newSections[newIndex]] = [newSections[newIndex], newSections[sectionIndex]];
    handleUpdateAndSave(newSections);
  }
  
  const getSectionIcon = (title: string) => {
    switch(title) {
        case 'Vệ sinh khu vực pha chế': return <Droplets className="h-5 w-5 text-blue-500"/>;
        case 'Vệ sinh dụng cụ': return <UtensilsCrossed className="h-5 w-5 text-green-500"/>;
        case 'Vệ sinh thiết bị': return <Wind className="h-5 w-5 text-purple-500"/>;
        default: return null;
    }
  }

  if (isLoading || authLoading) {
    return (
      <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">
        <header className="mb-8">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-4 w-1/2 mt-2" />
        </header>
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    )
  }

  if (!sections) {
    return <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">Không thể tải danh sách công việc.</div>;
  }

  return (
    <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><UtensilsCrossed/> Quản lý Công việc Pha chế</h1>
        <p className="text-muted-foreground">Thêm, sửa, xóa và sắp xếp các hạng mục trong checklist Vệ sinh quầy của Pha chế.</p>
      </header>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1.5">
                <CardTitle>Danh sách công việc</CardTitle>
                <CardDescription>Các thay đổi sẽ được lưu tự động.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpenItems(sections.map(s => s.title))}>
                  <ChevronsDownUp className="mr-2 h-4 w-4"/>
                  Mở rộng tất cả
              </Button>
               <Button variant="outline" size="sm" onClick={() => setOpenItems([])}>
                  <ChevronsUpDown className="mr-2 h-4 w-4"/>
                  Thu gọn tất cả
              </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" value={openItems} onValueChange={setOpenItems} className="w-full space-y-4">
            {sections.map((section, sectionIndex) => (
              <AccordionItem value={section.title} key={section.title} className="border rounded-lg">
                <div className="flex items-center p-2">
                    <AccordionTrigger className="p-2 text-lg font-medium hover:no-underline flex-1">
                    <div className="flex items-center gap-3 w-full">
                        {getSectionIcon(section.title)}
                        <span className="flex-1 text-left">{section.title}</span>
                    </div>
                    </AccordionTrigger>
                     <div className="flex items-center gap-1 pl-4">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleMoveSection(sectionIndex, 'up')} disabled={sectionIndex === 0}>
                            <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleMoveSection(sectionIndex, 'down')} disabled={sectionIndex === sections.length - 1}>
                            <ArrowDown className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <AccordionContent className="p-4 border-t">
                  <div className="space-y-2">
                      {section.tasks.map((task, taskIndex) => (
                        <div key={task.id} className="flex items-center gap-3 rounded-md border bg-card p-3">
                            {editingTask?.taskId === task.id ? (
                                <Input
                                    value={editingTask.newText}
                                    onChange={(e) => setEditingTask({...editingTask, newText: e.target.value})}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleUpdateTask(section.title, task.id);
                                        if (e.key === 'Escape') setEditingTask(null);
                                    }}
                                    onBlur={() => handleUpdateTask(section.title, task.id)}
                                    autoFocus
                                    className="text-sm h-8 flex-1"
                                />
                            ) : (
                               <p className="flex-1 text-sm">{task.text}</p>
                            )}
                          
                          <div className="flex items-center gap-0">
                             <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleMoveTask(sectionIndex, taskIndex, 'up')} disabled={taskIndex === 0}>
                                <ArrowUp className="h-4 w-4" />
                            </Button>
                             <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleMoveTask(sectionIndex, taskIndex, 'down')} disabled={taskIndex === section.tasks.length - 1}>
                                <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setEditingTask({ sectionTitle: section.title, taskId: task.id, newText: task.text })}>
                                <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteTask(section.title, task.id)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {section.tasks.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">Chưa có hạng mục nào trong khu vực này.</p>
                      )}
                    </div>
                     <div className="mt-4 flex gap-2 pt-4 border-t">
                        <Input
                            placeholder="Nội dung công việc mới..."
                            value={newText}
                            onChange={(e) => setNewText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddTask(section.title)}
                        />
                        <Button onClick={() => handleAddTask(section.title)}><Plus className="mr-2 h-4 w-4"/> Thêm</Button>
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

    