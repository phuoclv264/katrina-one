
'use client';
import { useState, useEffect } from 'react';
import { dataStore } from '@/lib/data-store';
import type { Task, TaskSection } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Pencil, Droplets, UtensilsCrossed, Wind } from 'lucide-react';
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
  const [newSectionTitle, setNewSectionTitle] = useState('');
  
  const [editingSection, setEditingSection] = useState<{ title: string; newTitle: string } | null>(null);
  const [editingTask, setEditingTask] = useState<{ sectionTitle: string; taskId: string; newText: string } | null>(null);


  useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'Chủ nhà hàng') {
        router.replace('/');
      } else {
        const unsubscribe = dataStore.subscribeToBartenderTasks((data) => {
          setSections(data);
          if (data.length > 0 && !newSectionTitle) {
            setNewSectionTitle(data[0].title);
          }
          setIsLoading(false);
        });
        return () => unsubscribe();
      }
    }
  }, [user, authLoading, router, newSectionTitle]);

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
        <p className="text-muted-foreground">Thêm, sửa, xóa các hạng mục trong checklist Vệ sinh quầy của Pha chế.</p>
      </header>
      
      <Card>
        <CardContent className="pt-6">
          <Accordion type="multiple" defaultValue={sections.map(s => s.title)} className="w-full space-y-4">
            {sections.map(section => (
              <AccordionItem value={section.title} key={section.title} className="border rounded-lg">
                <AccordionTrigger className="p-4 text-lg font-medium hover:no-underline">
                  <div className="flex items-center gap-3 w-full">
                    {getSectionIcon(section.title)}
                    <span className="flex-1 text-left">{section.title}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="p-4 border-t">
                  <div className="space-y-2">
                      {section.tasks.map(task => (
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
                                    className="text-sm h-8"
                                />
                            ) : (
                               <p className="flex-1 text-sm">{task.text}</p>
                            )}
                          
                          <div className="flex items-center gap-0">
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
