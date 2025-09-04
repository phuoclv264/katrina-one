
'use client';
import { useState, useEffect } from 'react';
import { dataStore } from '@/lib/data-store';
import type { ComprehensiveTask, ComprehensiveTaskSection, ParsedComprehensiveTask } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Building, ListChecks, MessageSquare, Image as ImageIcon, CheckSquare, Pencil, ArrowDown, ArrowUp, ChevronsDownUp, Wand2, Loader2, FileText, Shuffle, Check } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { generateComprehensiveTasks } from '@/ai/flows/generate-comprehensive-tasks';

function ComprehensiveTasksAiGenerator({
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
            if (!targetSection) {
                toast({ title: 'Lỗi', description: 'Vui lòng chọn khu vực để thêm hạng mục.', variant: 'destructive' });
                setIsGenerating(false);
                return;
            }

            toast({ title: 'AI đang xử lý...', description: 'Quá trình này có thể mất một chút thời gian.' });

            const result = await generateComprehensiveTasks(input);

            if (!result || !result.tasks) {
                throw new Error('AI không trả về kết quả hợp lệ.');
            }

            onTasksGenerated(result.tasks, targetSection);

            toast({ title: 'Hoàn tất!', description: `AI đã tạo ${result.tasks.length} hạng mục mới trong khu vực "${targetSection}".` });
            resetState();
        } catch (error) {
            console.error('Failed to generate comprehensive tasks:', error);
            toast({ title: 'Lỗi', description: 'Không thể tạo danh sách hạng mục. Vui lòng thử lại.', variant: 'destructive' });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Card className="mb-8">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
                    <Wand2 /> Thêm hàng loạt bằng AI
                </CardTitle>
                <CardDescription>Dán văn bản hoặc tải ảnh danh sách hạng mục để AI tự động thêm vào khu vực bạn chọn.</CardDescription>
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
                            placeholder="Dán danh sách các hạng mục vào đây. Mỗi dòng là một hạng mục. Có thể bao gồm loại báo cáo mong muốn (ví dụ: 'Sàn nhà sạch sẽ - hình ảnh')."
                            rows={4}
                            value={textInput}
                            onChange={(e) => setTextInput(e.target.value)}
                            disabled={isGenerating}
                        />
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Select onValueChange={setTargetSection} disabled={isGenerating || sections.length === 0}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Chọn khu vực..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {sections.map((section) => (
                                        <SelectItem key={section.title} value={section.title}>
                                            {section.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button onClick={() => handleGenerate('text')} disabled={isGenerating || !textInput.trim() || !targetSection} className="w-full sm:w-auto">
                                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                Tạo
                            </Button>
                        </div>
                    </TabsContent>
                    <TabsContent value="image" className="mt-4 space-y-4">
                        <Input id="comp-image-upload" type="file" accept="image/*" onChange={handleFileChange} disabled={isGenerating} />
                        <div className="flex flex-col sm:flex-row gap-2">
                             <Select onValueChange={setTargetSection} disabled={isGenerating || sections.length === 0}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Chọn khu vực..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {sections.map((section) => (
                                        <SelectItem key={section.title} value={section.title}>
                                            {section.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button onClick={() => handleGenerate('image')} disabled={isGenerating || !imageInput || !targetSection} className="w-full sm:w-auto">
                                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                Tạo
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}

export default function ComprehensiveChecklistPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [sections, setSections] = useState<ComprehensiveTaskSection[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSorting, setIsSorting] = useState(false);

  const [newText, setNewText] = useState('');
  const [newType, setNewType] = useState<'photo' | 'boolean' | 'opinion'>('boolean');
  const [newSection, setNewSection] = useState('');

  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [editingSection, setEditingSection] = useState<{ title: string; newTitle: string } | null>(null);
  const [editingTask, setEditingTask] = useState<{ sectionTitle: string; taskId: string; newText: string } | null>(null);

  const [openItems, setOpenItems] = useState<string[]>([]);

  useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'Chủ nhà hàng') {
        router.replace('/');
      } else {
        const unsubscribe = dataStore.subscribeToComprehensiveTasks((data) => {
          setSections(data);
          if (data.length > 0) {
            if (!newSection) {
              setNewSection(data[0].title);
            }
            if (openItems.length === 0) {
              setOpenItems(data.map(s => s.title));
            }
          }
          setIsLoading(false);
        });
        return () => unsubscribe();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, router, newSection]);

  const handleUpdateAndSave = (newSections: ComprehensiveTaskSection[], showToast: boolean = true) => {
    setSections(newSections); // Optimistic update
    dataStore.updateComprehensiveTasks(newSections).then(() => {
        if(showToast) {
            toast({
                title: "Đã lưu thay đổi!",
                description: "Danh sách kiểm tra đã được cập nhật.",
            });
        }
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
      if (!sections || !editingSection || editingSection.newTitle.trim() === '') {
          setEditingSection(null);
          return;
      };
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

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    if (!sections) return;
    const newSections = [...sections];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newSections.length) return;
    [newSections[index], newSections[newIndex]] = [newSections[newIndex], newSections[index]];
    handleUpdateAndSave(newSections, false);
  };

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
    if (!sections || !editingTask || editingTask.newText.trim() === '') {
        setEditingTask(null);
        return;
    };

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

  const getTaskTypeIcon = (type: 'photo' | 'boolean' | 'opinion') => {
      switch(type) {
          case 'photo': return <ImageIcon className="h-4 w-4 text-green-500 shrink-0" />;
          case 'boolean': return <CheckSquare className="h-4 w-4 text-sky-500 shrink-0" />;
          case 'opinion': return <MessageSquare className="h-4 w-4 text-orange-500 shrink-0" />;
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
      toast({
        title: "Đã lưu thứ tự mới!",
      });
    }
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

  if (!sections) {
    return <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">Không thể tải danh sách công việc.</div>;
  }

  const areAllSectionsOpen = sections && openItems.length === sections.length;

  return (
    <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">
      <header className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold font-headline flex items-center gap-3"><ListChecks/> Quản lý Hạng mục Kiểm tra</h1>
        <p className="text-muted-foreground">Thêm, sửa, xóa và sắp xếp các khu vực, hạng mục kiểm tra cho Quản lý.</p>
      </header>

      <ComprehensiveTasksAiGenerator sections={sections} onTasksGenerated={onAiTasksGenerated} />

       <Card className="mb-8">
            <CardHeader>
                <CardTitle className="text-xl sm:text-2xl">Quản lý Khu vực</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                        placeholder="Tên khu vực mới, ví dụ: Tầng 3"
                        value={newSectionTitle}
                        onChange={e => setNewSectionTitle(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddSection()}
                    />
                    <Button onClick={handleAddSection} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> Thêm khu vực</Button>
                </div>
            </CardContent>
       </Card>

      <Card className="mb-8">
          <CardHeader>
              <CardTitle className="text-xl sm:text-2xl">Thêm hạng mục mới (Thủ công)</CardTitle>
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
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle>Danh sách hạng mục</CardTitle>
            <CardDescription>Xem và quản lý các hạng mục trong từng khu vực.</CardDescription>
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
            {sections && sections.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleToggleAll} className="w-full sm:w-auto">
                    <ChevronsDownUp className="mr-2 h-4 w-4"/>
                    {areAllSectionsOpen ? 'Thu gọn' : 'Mở rộng'}
                </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" value={openItems} onValueChange={setOpenItems} className="w-full space-y-4">
            {sections.map((section, sectionIndex) => (
              <AccordionItem value={section.title} key={section.title} className="border rounded-lg">
                <div className="flex items-center p-2">
                    <AccordionTrigger className="text-lg font-medium hover:no-underline flex-1 p-2" disabled={isSorting}>
                      <div className="flex items-center gap-3">
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
                      </div>
                    </AccordionTrigger>

                    <div className="flex items-center gap-1 ml-auto pl-4">
                        {isSorting ? (
                            <>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleMoveSection(sectionIndex, 'up')} disabled={sectionIndex === 0}>
                                    <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleMoveSection(sectionIndex, 'down')} disabled={sectionIndex === sections.length - 1}>
                                    <ArrowDown className="h-4 w-4" />
                                </Button>
                            </>
                        ) : (
                            <>
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
                            </>
                        )}
                    </div>
                </div>

                <AccordionContent className="p-4 border-t">
                  <div className="space-y-2">
                      {section.tasks.map((task, taskIndex) => (
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
                                    className="text-sm h-8 flex-1"
                                />
                            ) : (
                               <p className="flex-1 text-sm">{task.text}</p>
                            )}

                          <div className="flex items-center gap-0">
                            {isSorting ? (
                                <>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleMoveTask(sectionIndex, taskIndex, 'up')} disabled={taskIndex === 0}>
                                        <ArrowUp className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleMoveTask(sectionIndex, taskIndex, 'down')} disabled={taskIndex === section.tasks.length - 1}>
                                        <ArrowDown className="h-4 w-4" />
                                    </Button>
                                </>
                            ): (
                                <>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setEditingTask({ sectionTitle: section.title, taskId: task.id, newText: task.text })}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteTask(section.title, task.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </>
                            )}
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
