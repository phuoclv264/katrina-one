
'use client';
import { useState, useEffect } from 'react';
import { dataStore } from '@/lib/data-store';
import type { ComprehensiveTask, ComprehensiveTaskSection } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Building, ListChecks, MessageSquare, Image as ImageIcon, CheckSquare } from 'lucide-react';
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
import { Label } from '@/components/ui/label';

export default function ComprehensiveChecklistPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<ComprehensiveTaskSection[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [newText, setNewText] = useState('');
  const [newType, setNewType] = useState<'photo' | 'boolean' | 'opinion'>('boolean');
  const [newSection, setNewSection] = useState('Tầng 1');

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

  const handleAddTask = () => {
    if (!tasks || newText.trim() === '' || !newSection || !newType) {
        toast({ title: "Lỗi", description: "Vui lòng điền đầy đủ thông tin.", variant: "destructive" });
        return;
    };

    const newTaskToAdd: ComprehensiveTask = {
      id: `comp-task-${Date.now()}`,
      text: newText.trim(),
      type: newType,
    };

    const newTasksState = JSON.parse(JSON.stringify(tasks));
    const section = newTasksState.find((s: ComprehensiveTaskSection) => s.title === newSection);
    if (section) {
      section.tasks.push(newTaskToAdd);
    }

    handleUpdateAndSave(newTasksState);
    
    // Reset form
    setNewText('');
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
  
  const getTaskTypeIcon = (type: 'photo' | 'boolean' | 'opinion') => {
      switch(type) {
          case 'photo': return <ImageIcon className="h-4 w-4 text-green-500 shrink-0" />;
          case 'boolean': return <CheckSquare className="h-4 w-4 text-sky-500 shrink-0" />;
          case 'opinion': return <MessageSquare className="h-4 w-4 text-orange-500 shrink-0" />;
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
        <p className="text-muted-foreground">Thêm, sửa, xóa các hạng mục kiểm tra cho Quản lý.</p>
      </header>
      
      <Card className="mb-8">
          <CardHeader>
              <CardTitle>Thêm hạng mục mới</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <div className="space-y-2 col-span-1 md:col-span-3">
                       <Label htmlFor="new-task-text">Nội dung hạng mục</Label>
                       <Input
                        id="new-task-text"
                        placeholder="ví dụ: 'Sàn nhà sạch sẽ'"
                        value={newText}
                        onChange={e => setNewText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                      />
                   </div>
                   <div className="space-y-2">
                       <Label htmlFor="new-task-section">Khu vực</Label>
                       <Select value={newSection} onValueChange={value => setNewSection(value)}>
                            <SelectTrigger id="new-task-section">
                                <SelectValue placeholder="Chọn khu vực..." />
                            </SelectTrigger>
                            <SelectContent>
                                {tasks.map(section => (
                                    <SelectItem key={section.title} value={section.title}>{section.title}</SelectItem>
                                ))}
                            </SelectContent>
                       </Select>
                   </div>
                   <div className="space-y-2">
                       <Label htmlFor="new-task-type">Loại báo cáo</Label>
                       <Select value={newType} onValueChange={(value) => setNewType(value as 'photo' | 'boolean' | 'opinion')}>
                            <SelectTrigger id="new-task-type">
                                <SelectValue placeholder="Chọn loại báo cáo..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="boolean">Đảm bảo / Không đảm bảo</SelectItem>
                                <SelectItem value="photo">Hình ảnh</SelectItem>
                                <SelectItem value="opinion">Ý kiến</SelectItem>
                            </SelectContent>
                       </Select>
                   </div>
               </div>
                <Button onClick={handleAddTask} className="w-full md:w-auto">
                  <Plus className="mr-2 h-4 w-4" /> Thêm hạng mục
                </Button>
          </CardContent>
      </Card>

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
                  <div className="space-y-2">
                      {section.tasks.map(task => (
                        <div key={task.id} className="flex items-center gap-3 rounded-md border bg-card p-3">
                           {getTaskTypeIcon(task.type)}
                          <p className="flex-1 text-sm">{task.text}</p>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteTask(section.title, task.id)}>
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Xóa công việc</span>
                          </Button>
                        </div>
                      ))}
                      {section.tasks.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">Chưa có hạng mục nào trong khu vực này.</p>
                      )}
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
