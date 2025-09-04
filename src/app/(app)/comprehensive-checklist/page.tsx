
'use client';
import { useState, useEffect } from 'react';
import { dataStore } from '@/lib/data-store';
import type { ComprehensiveTask, ComprehensiveTaskSection } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Building, ListChecks, MessageSquare, Image as ImageIcon, CheckSquare, Pencil } from 'lucide-react';
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


export default function ComprehensiveChecklistPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [sections, setSections] = useState<ComprehensiveTaskSection[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [newText, setNewText] = useState('');
  const [newType, setNewType] = useState<'photo' | 'boolean' | 'opinion'>('boolean');
  const [newSection, setNewSection] = useState('');
  
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [editingSection, setEditingSection] = useState<{ title: string; newTitle: string } | null>(null);
  const [editingTask, setEditingTask] = useState<{ sectionTitle: string; taskId: string; newText: string } | null>(null);


  useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'Chủ nhà hàng') {
        router.replace('/');
      } else {
        const unsubscribe = dataStore.subscribeToComprehensiveTasks((data) => {
          setSections(data);
          if (data.length > 0 && !newSection) {
            setNewSection(data[0].title);
          }
          setIsLoading(false);
        });
        return () => unsubscribe();
      }
    }
  }, [user, authLoading, router, newSection]);

  const handleUpdateAndSave = (newSections: ComprehensiveTaskSection[]) => {
    setSections(newSections); // Optimistic update
    dataStore.updateComprehensiveTasks(newSections).then(() => {
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
      // Optional: revert optimistic update if needed
    });
  }
  
  // Section Management
  const handleAddSection = () => {
    if (!sections || newSectionTitle.trim() === '') return;
    if (sections.some(s => s.title === newSectionTitle.trim())) {
        toast({ title: "Lỗi", description: "Khu vực này đã tồn tại.", variant: "destructive" });
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
      if (!sections || !editingSection || editingSection.newTitle.trim() === '') return;
      if (sections.some(s => s.title === editingSection.newTitle.trim())) {
        toast({ title: "Lỗi", description: "Tên khu vực này đã tồn tại.", variant: "destructive" });
        return;
      }
      const newSectionsState = sections.map(s => 
          s.title === oldTitle ? { ...s, title: editingSection.newTitle.trim() } : s
      );
      handleUpdateAndSave(newSectionsState);
      setEditingSection(null);
  }

  // Task Management
  const handleAddTask = () => {
    if (!sections || newText.trim() === '' || !newSection || !newType) {
        toast({ title: "Lỗi", description: "Vui lòng điền đầy đủ thông tin.", variant: "destructive" });
        return;
    };

    const newTaskToAdd: ComprehensiveTask = {
      id: `comp-task-${Date.now()}`,
      text: newText.trim(),
      type: newType,
    };

    const newSectionsState = JSON.parse(JSON.stringify(sections));
    const section = newSectionsState.find((s: ComprehensiveTaskSection) => s.title === newSection);
    if (section) {
      section.tasks.push(newTaskToAdd);
    }

    handleUpdateAndSave(newSectionsState);
    setNewText('');
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
  
   const handleUpdateTask = (sectionTitle: string, taskId: string) => {
    if (!sections || !editingTask || editingTask.newText.trim() === '') return;

    const newSectionsState = JSON.parse(JSON.stringify(sections));
    const section = newSectionsState.find((s: ComprehensiveTaskSection) => s.title === sectionTitle);
    if (section) {
        const task = section.tasks.find((t: ComprehensiveTask) => t.id === taskId);
        if (task) {
            task.text = editingTask.newText.trim();
        }
    }
    handleUpdateAndSave(newSectionsState);
    setEditingTask(null);
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

  if (!sections) {
    return <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">Không thể tải danh sách công việc.</div>;
  }

  return (
    <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><ListChecks/> Quản lý Hạng mục Kiểm tra Toàn diện</h1>
        <p className="text-muted-foreground">Thêm, sửa, xóa các khu vực và hạng mục kiểm tra cho Quản lý.</p>
      </header>

       <Card className="mb-8">
            <CardHeader>
                <CardTitle>Quản lý Khu vực</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex gap-2">
                    <Input 
                        placeholder="Tên khu vực mới, ví dụ: Tầng 3"
                        value={newSectionTitle}
                        onChange={e => setNewSectionTitle(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddSection()}
                    />
                    <Button onClick={handleAddSection}><Plus className="mr-2 h-4 w-4" /> Thêm khu vực</Button>
                </div>
            </CardContent>
       </Card>
      
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
                       <Select value={newSection} onValueChange={value => setNewSection(value)} disabled={sections.length === 0}>
                            <SelectTrigger id="new-task-section">
                                <SelectValue placeholder="Chọn khu vực..." />
                            </SelectTrigger>
                            <SelectContent>
                                {sections.map(section => (
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
                <Button onClick={handleAddTask} className="w-full md:w-auto" disabled={sections.length === 0}>
                  <Plus className="mr-2 h-4 w-4" /> Thêm hạng mục
                </Button>
                {sections.length === 0 && <p className="text-sm text-muted-foreground text-center">Vui lòng thêm một khu vực trước khi thêm hạng mục.</p>}
          </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Accordion type="multiple" defaultValue={sections.map(s => s.title)} className="w-full space-y-4">
            {sections.map(section => (
              <AccordionItem value={section.title} key={section.title} className="border rounded-lg">
                <AccordionTrigger className="p-4 text-lg font-medium hover:no-underline">
                  <div className="flex items-center gap-3 w-full">
                    <Building className="h-5 w-5 text-primary"/>
                     {editingSection?.title === section.title ? (
                         <Input
                            value={editingSection.newTitle}
                            onChange={(e) => setEditingSection({...editingSection, newTitle: e.target.value})}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameSection(section.title);
                                if (e.key === 'Escape') setEditingSection(null);
                            }}
                            onBlur={() => handleRenameSection(section.title)}
                            autoFocus
                            className="text-lg font-medium h-9"
                            onClick={(e) => e.stopPropagation()}
                        />
                     ) : (
                        <span className="flex-1 text-left">{section.title}</span>
                     )}
                    
                    <div className="flex items-center gap-1 ml-auto mr-2" onClick={e => e.stopPropagation()}>
                         <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setEditingSection({ title: section.title, newTitle: section.title })}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Xóa khu vực "{section.title}"?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Hành động này không thể được hoàn tác. Việc này sẽ xóa vĩnh viễn khu vực và tất cả các hạng mục công việc bên trong nó.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Hủy</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteSection(section.title)}>Xóa</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>

                  </div>
                  </AccordionTrigger>
                <AccordionContent className="p-4 border-t">
                  <div className="space-y-2">
                      {section.tasks.map(task => (
                        <div key={task.id} className="flex items-center gap-3 rounded-md border bg-card p-3">
                           {getTaskTypeIcon(task.type)}
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
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
