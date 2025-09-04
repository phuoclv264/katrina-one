
'use client';
import { useState, useEffect } from 'react';
import { dataStore } from '@/lib/data-store';
import type { Task, TaskSection, ParsedServerTask } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Pencil, Droplets, UtensilsCrossed, Wind, ArrowUp, ArrowDown, ChevronsDownUp, Wand2, Loader2, FileText, Image as ImageIcon, Check, Shuffle, Sparkles, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { generateBartenderTasks } from '@/ai/flows/generate-bartender-tasks';
import { sortTasks } from '@/ai/flows/sort-tasks';
import type { GenerateBartenderTasksOutput } from '@/ai/flows/generate-bartender-tasks';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog } from '@/components/ui/dialog';
import { diffChars } from 'diff';


function AiAssistant({
    sections,
    onAddTasks,
    onSortTasks,
}: {
    sections: TaskSection[],
    onAddTasks: (tasks: GenerateBartenderTasksOutput['tasks'], section: string) => void,
    onSortTasks: (sortedTasks: string[], sectionTitle: string) => void;
}) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [textInput, setTextInput] = useState('');
    const [imageInput, setImageInput] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('add');

    const [targetSection, setTargetSection] = useState('');

    const [showAddPreview, setShowAddPreview] = useState(false);
    const [addPreviewTasks, setAddPreviewTasks] = useState<GenerateBartenderTasksOutput['tasks']>([]);

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
        const fileInput = document.getElementById('bt-image-upload') as HTMLInputElement;
        if(fileInput) fileInput.value = '';
    }

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
            if (!targetSection) {
                toast({ title: "Lỗi", description: "Vui lòng chọn khu vực để thêm công việc.", variant: "destructive" });
                setIsGenerating(false);
                return;
            }

            toast({ title: "AI đang xử lý...", description: "Quá trình này có thể mất một chút thời gian."});

            const result = await generateBartenderTasks(input);

            if (!result || !result.tasks) {
                 throw new Error("AI không trả về kết quả hợp lệ.");
            }
            
            setAddPreviewTasks(result.tasks);
            setShowAddPreview(true);

        } catch (error) {
            console.error("Failed to generate bartender tasks:", error);
            toast({ title: "Lỗi", description: "Không thể tạo danh sách công việc. Vui lòng thử lại.", variant: "destructive"});
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleConfirmAdd = () => {
        onAddTasks(addPreviewTasks, targetSection);
        toast({ title: "Hoàn tất!", description: `Đã thêm ${addPreviewTasks.length} công việc mới vào khu vực "${targetSection}".`});
        resetAddState();
        setShowAddPreview(false);
        setAddPreviewTasks([]);
    }
    
    const handleGenerateSort = async () => {
        if (!targetSection) {
            toast({ title: "Lỗi", description: "Vui lòng chọn một khu vực để sắp xếp.", variant: "destructive" });
            return;
        }

        const sectionToSort = sections.find(s => s.title === targetSection);
        if (!sectionToSort || sectionToSort.tasks.length < 2) {
            toast({ title: "Không cần sắp xếp", description: "Khu vực này có ít hơn 2 công việc.", variant: "default" });
            return;
        }
        
        setIsGenerating(true);
        toast({ title: "AI đang sắp xếp...", description: "Vui lòng đợi một lát." });

        try {
            const currentTasks = sectionToSort.tasks.map(t => t.text);
            const result = await sortTasks({
                context: `Bartender tasks for section: ${targetSection}`,
                tasks: currentTasks
            });
            
            if (!result || !result.sortedTasks || result.sortedTasks.length !== currentTasks.length) {
                throw new Error("AI did not return a valid sorted list.");
            }

            setSortPreview({ oldOrder: currentTasks, newOrder: result.sortedTasks });
            setShowSortPreview(true);

        } catch(error) {
            console.error("Failed to sort tasks:", error);
            toast({ title: "Lỗi", description: "Không thể sắp xếp công việc. Vui lòng thử lại.", variant: "destructive"});
        } finally {
            setIsGenerating(false);
        }
    };

    const handleConfirmSort = () => {
        onSortTasks(sortPreview.newOrder, targetSection);
        toast({ title: "Hoàn tất!", description: `Đã sắp xếp lại công việc trong khu vực "${targetSection}".` });
        setShowSortPreview(false);
    }
    
    const renderDiff = (oldText: string, newText: string) => {
        const differences = diffChars(oldText, newText);
        return differences.map((part, index) => {
            const color = part.added ? 'bg-green-200/50' : part.removed ? 'bg-red-200/50' : 'bg-transparent';
            return <span key={index} className={color}>{part.value}</span>;
        });
    }

    return (
        <>
        <Card className="mb-8">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl"><Wand2 /> Công cụ hỗ trợ AI</CardTitle>
                <CardDescription>Sử dụng AI để thêm hoặc sắp xếp lại các công việc một cách thông minh.</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setTargetSection('')}}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="add"><Plus className="mr-2 h-4 w-4"/>Thêm mới</TabsTrigger>
                        <TabsTrigger value="sort"><Sparkles className="mr-2 h-4 w-4"/>Sắp xếp</TabsTrigger>
                    </TabsList>
                    <TabsContent value="add" className="mt-4 space-y-4">
                        <Tabs defaultValue="text">
                             <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="text"><FileText className="mr-2 h-4 w-4"/>Dán văn bản</TabsTrigger>
                                <TabsTrigger value="image"><ImageIcon className="mr-2 h-4 w-4"/>Tải ảnh lên</TabsTrigger>
                            </TabsList>
                            <TabsContent value="text" className="mt-4 space-y-4">
                                <Textarea
                                    placeholder="Dán danh sách các công việc vào đây, mỗi công việc trên một dòng."
                                    rows={4}
                                    value={textInput}
                                    onChange={(e) => setTextInput(e.target.value)}
                                    disabled={isGenerating}
                                />
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <Select onValueChange={setTargetSection} value={targetSection} disabled={isGenerating || sections.length === 0}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Chọn khu vực để thêm vào..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {sections.map(section => (
                                                <SelectItem key={section.title} value={section.title}>{section.title}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button onClick={() => handleGenerateAdd('text')} disabled={isGenerating || !textInput.trim() || !targetSection} className="w-full sm:w-auto">
                                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                        Tạo từ văn bản
                                    </Button>
                                </div>
                            </TabsContent>
                            <TabsContent value="image" className="mt-4 space-y-4">
                                <Input
                                    id="bt-image-upload"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    disabled={isGenerating}
                                />
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <Select onValueChange={setTargetSection} value={targetSection} disabled={isGenerating || sections.length === 0}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Chọn khu vực để thêm vào..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {sections.map(section => (
                                                <SelectItem key={section.title} value={section.title}>{section.title}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button onClick={() => handleGenerateAdd('image')} disabled={isGenerating || !imageInput || !targetSection} className="w-full sm:w-auto">
                                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                        Tạo từ ảnh
                                    </Button>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </TabsContent>
                     <TabsContent value="sort" className="mt-4 space-y-4">
                        <p className="text-sm text-muted-foreground">Chọn một khu vực và để AI sắp xếp lại các công việc trong đó theo một thứ tự logic và hiệu quả hơn.</p>
                        <div className="flex flex-col sm:flex-row gap-2">
                             <Select onValueChange={setTargetSection} value={targetSection} disabled={isGenerating || sections.length === 0}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Chọn khu vực để sắp xếp..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {sections.map(section => (
                                        <SelectItem key={section.title} value={section.title}>{section.title}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button onClick={handleGenerateSort} disabled={isGenerating || !targetSection} className="w-full sm:w-auto">
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
                        AI đã phân tích đầu vào của bạn. Kiểm tra lại danh sách dưới đây trước khi thêm chúng vào khu vực <span className="font-bold">"{targetSection}"</span>.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                 <div className="max-h-[50vh] overflow-y-auto p-2 border rounded-md">
                   <ul className="space-y-2">
                        {addPreviewTasks.map((task, index) => (
                            <li key={index} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm">
                                <Plus className="h-4 w-4 text-green-500"/>
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
                        AI đề xuất sắp xếp lại các công việc trong khu vực <span className="font-bold">"{targetSection}"</span> như sau. Bạn có muốn áp dụng thay đổi không?
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
                                // This isn't a perfect diff if items are reordered AND text is changed, but it's a good heuristic.
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

export default function BartenderTasksPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [sections, setSections] = useState<TaskSection[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSorting, setIsSorting] = useState(false);

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
          if (data.length > 0 && openItems.length === 0) {
            setOpenItems(data.map(s => s.title));
          }
          setIsLoading(false);
        });
        return () => unsubscribe();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, router]);

  const handleUpdateAndSave = (newSections: TaskSection[], showToast: boolean = true) => {
    setSections(newSections); // Optimistic update
    dataStore.updateBartenderTasks(newSections).then(() => {
      if (showToast) {
        toast({
            title: "Đã lưu thay đổi!",
            description: "Danh sách công việc đã được cập nhật.",
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

  const onAiAddTasks = (tasks: GenerateBartenderTasksOutput['tasks'], sectionTitle: string) => {
    if (!sections) return;

    const newTasksToAdd: Task[] = tasks.map(task => ({
      id: `bt-task-${Date.now()}-${Math.random()}`,
      text: task.text,
      type: 'photo',
    }));

    const newSectionsState = JSON.parse(JSON.stringify(sections));
    const section = newSectionsState.find((s: TaskSection) => s.title === sectionTitle);

    if (section) {
      section.tasks.push(...newTasksToAdd);
      handleUpdateAndSave(newSectionsState);
      if (!openItems.includes(sectionTitle)) {
        setOpenItems(prev => [...prev, sectionTitle]);
      }
    }
  };
  
  const onAiSortTasks = (sortedTasksText: string[], sectionTitle: string) => {
      if (!sections) return;
      const newSectionsState = JSON.parse(JSON.stringify(sections));
      const section = newSectionsState.find((s: TaskSection) => s.title === sectionTitle);

      if (section) {
          // Create a map of text -> task object to preserve IDs and other properties
          const taskMap = new Map(section.tasks.map((t: Task) => [t.text, t]));
          const sortedTasks: Task[] = sortedTasksText.map(text => taskMap.get(text)).filter((t): t is Task => !!t);

          // Check if any tasks were lost during mapping
          if (sortedTasks.length === section.tasks.length) {
              section.tasks = sortedTasks;
              handleUpdateAndSave(newSectionsState);
          } else {
              toast({ title: "Lỗi sắp xếp", description: "Không thể khớp các công việc đã sắp xếp. Thay đổi đã bị hủy.", variant: "destructive" });
          }
      }
  };

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
    if (!sections || !editingTask || editingTask.newText.trim() === '') {
        setEditingTask(null);
        return;
    }

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
    const newSections = JSON.parse(JSON.stringify(sections));
    const section = newSections[sectionIndex];
    const tasks = section.tasks;
    const newIndex = direction === 'up' ? taskIndex - 1 : taskIndex + 1;
    if (newIndex < 0 || newIndex >= tasks.length) return;

    [tasks[taskIndex], tasks[newIndex]] = [tasks[newIndex], tasks[taskIndex]];
    handleUpdateAndSave(newSections, false);
  };

  const handleMoveSection = (sectionIndex: number, direction: 'up' | 'down') => {
    if (!sections) return;
    const newSections = JSON.parse(JSON.stringify(sections));
    const newIndex = direction === 'up' ? sectionIndex - 1 : sectionIndex + 1;
    if (newIndex < 0 || newIndex >= newSections.length) return;

    [newSections[sectionIndex], newSections[newIndex]] = [newSections[newIndex], newSections[sectionIndex]];
    handleUpdateAndSave(newSections, false);
  }

  const getSectionIcon = (title: string) => {
    switch(title) {
        case 'Vệ sinh khu vực pha chế': return <Droplets className="h-5 w-5 text-blue-500"/>;
        case 'Vệ sinh dụng cụ': return <UtensilsCrossed className="h-5 w-5 text-green-500"/>;
        case 'Vệ sinh thiết bị': return <Wind className="h-5 w-5 text-purple-500"/>;
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
        <h1 className="text-2xl md:text-3xl font-bold font-headline flex items-center gap-3"><UtensilsCrossed/> Quản lý Công việc Pha chế</h1>
        <p className="text-muted-foreground">Thêm, sửa, xóa và sắp xếp các hạng mục trong checklist Vệ sinh quầy của Pha chế.</p>
      </header>

      <AiAssistant sections={sections} onAddTasks={onAiAddTasks} onSortTasks={onAiSortTasks} />

      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
                <CardTitle>Danh sách công việc</CardTitle>
                <CardDescription>Các thay đổi về nội dung sẽ được lưu tự động.</CardDescription>
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
                    <AccordionTrigger className="p-2 text-lg font-medium hover:no-underline flex-1" disabled={isSorting}>
                    <div className="flex items-center gap-3 w-full">
                        {getSectionIcon(section.title)}
                        <span className="flex-1 text-left">{section.title}</span>
                    </div>
                    </AccordionTrigger>
                     {isSorting && (
                         <div className="flex items-center gap-1 pl-4">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleMoveSection(sectionIndex, 'up')} disabled={sectionIndex === 0}>
                                <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleMoveSection(sectionIndex, 'down')} disabled={sectionIndex === sections.length - 1}>
                                <ArrowDown className="h-4 w-4" />
                            </Button>
                        </div>
                     )}
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
                             {isSorting ? (
                                <>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleMoveTask(sectionIndex, taskIndex, 'up')} disabled={taskIndex === 0}>
                                        <ArrowUp className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleMoveTask(sectionIndex, taskIndex, 'down')} disabled={taskIndex === section.tasks.length - 1}>
                                        <ArrowDown className="h-4 w-4" />
                                    </Button>
                                </>
                             ) : (
                                <>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setEditingTask({ sectionTitle: section.title, taskId: task.id, newText: task.text })}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader><AlertDialogTitle>Xóa công việc?</AlertDialogTitle><AlertDialogDescription>Hành động này không thể được hoàn tác.</AlertDialogDescription></AlertDialogHeader>
                                            <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteTask(section.title, task.id)}>Xóa</AlertDialogAction></AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </>
                             )}
                          </div>
                        </div>
                      ))}
                      {section.tasks.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">Chưa có hạng mục nào trong khu vực này.</p>
                      )}
                    </div>
                     <div className="mt-4 flex flex-col sm:flex-row gap-2 pt-4 border-t">
                        <Input
                            placeholder="Nội dung công việc mới..."
                            value={newText}
                            onChange={(e) => setNewText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddTask(section.title)}
                        />
                        <Button onClick={() => handleAddTask(section.title)} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4"/> Thêm</Button>
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
