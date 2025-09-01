
'use client';
import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import type { Task, TaskCompletion, TasksByShift, CompletionRecord } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Camera, Send, ArrowLeft, Clock, X, Trash2 } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import CameraDialog from '@/components/camera-dialog';

export default function ChecklistPage() {
  const { toast } = useToast();
  const { role, staffName } = useAuth();
  const params = useParams();
  const shiftKey = params.shift as string;

  const [tasksByShift, setTasksByShift] = useState<TasksByShift>(dataStore.getTasks());
  
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeCompletionIndex, setActiveCompletionIndex] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribe = dataStore.subscribe(() => {
      setTasksByShift(dataStore.getTasks());
    });
    return () => unsubscribe();
  }, []);
  
  const shift = tasksByShift[shiftKey];

  const [taskCompletion, setTaskCompletion] = useState<TaskCompletion>({});
  
  useEffect(() => {
    if (shift) {
      const initialCompletion: TaskCompletion = {};
      shift.sections.forEach(section => {
        section.tasks.forEach(task => {
          initialCompletion[task.id] = [];
        });
      });
      setTaskCompletion(initialCompletion);
    }
  }, [shift]);
  
  const [issues, setIssues] = useState('');

  if (!shift) {
    return <div>Đang tải...</div>;
  }
  
  const handleTaskAction = (taskId: string) => {
    setActiveTaskId(taskId);
    setActiveCompletionIndex(null); // New completion
    setIsCameraOpen(true);
  };

  const handleEditPhotos = (taskId: string, completionIndex: number) => {
    setActiveTaskId(taskId);
    setActiveCompletionIndex(completionIndex);
    setIsCameraOpen(true);
  };
  
  const handleCapturePhotos = (photos: string[]) => {
    if (activeTaskId) {
      setTaskCompletion(current => {
        const newCompletion = JSON.parse(JSON.stringify(current));
        const taskCompletions = (newCompletion[activeTaskId] as CompletionRecord[]) || [];

        if (activeCompletionIndex !== null) {
          // Editing existing completion
          taskCompletions[activeCompletionIndex].photos = photos;
        } else {
          // Adding new completion
          const now = new Date();
          const formattedTime = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
          taskCompletions.push({
            timestamp: formattedTime,
            photos: photos
          });
        }
        
        newCompletion[activeTaskId] = taskCompletions;
        return newCompletion;
      });

      toast({
          title: `Đã lưu ${photos.length} ảnh!`,
          description: "Ảnh đã được thêm vào báo cáo của bạn."
      });
    }
    setIsCameraOpen(false);
    setActiveTaskId(null);
    setActiveCompletionIndex(null);
  };
  
  const handleDeletePhoto = (taskId: string, completionIndex: number, photoIndex: number) => {
    setTaskCompletion(prev => {
      const newCompletion = JSON.parse(JSON.stringify(prev));
      const taskCompletions = newCompletion[taskId] as CompletionRecord[];
      taskCompletions[completionIndex].photos.splice(photoIndex, 1);
      newCompletion[taskId] = taskCompletions;
      return newCompletion;
    });
  };

  const handleDeleteCompletion = (taskId: string, completionIndex: number) => {
     setTaskCompletion(prev => {
      const newCompletion = JSON.parse(JSON.stringify(prev));
      const taskCompletions = newCompletion[taskId] as CompletionRecord[];
      taskCompletions.splice(completionIndex, 1);
      newCompletion[taskId] = taskCompletions;
      return newCompletion;
    });
     toast({
        title: "Đã xóa lần thực hiện",
        description: "Lần hoàn thành công việc đã được xóa khỏi báo cáo.",
        variant: "destructive"
    });
  }


  const handleSubmit = () => {
    // Consolidate all photos from taskCompletions into a single array for the report
    const allUploadedPhotos = Object.values(taskCompletion)
      .flat()
      .flatMap((record: CompletionRecord) => record.photos);
      
    dataStore.addReport({
        shiftKey,
        staffName: staffName || 'Nhân viên',
        completedTasks: taskCompletion,
        uploadedPhotos: allUploadedPhotos,
        issues: issues || null,
        taskPhotos: {}, // This can be deprecated or re-purposed if needed
    });
    
    toast({
      title: "Đã gửi báo cáo!",
      description: "Báo cáo ca làm việc của bạn đã được gửi thành công.",
      style: {
        backgroundColor: 'var(--accent)',
        color: 'var(--accent-foreground)'
      }
    });

    // Reset state
    const initialCompletion: TaskCompletion = {};
    shift.sections.forEach(section => {
      section.tasks.forEach(task => {
        initialCompletion[task.id] = [];
      });
    });
    setTaskCompletion(initialCompletion);
    setIssues('');
  };
  
  const getInitialPhotosForCamera = () => {
    if (activeTaskId && activeCompletionIndex !== null) {
      const completions = taskCompletion[activeTaskId] as CompletionRecord[];
      return completions[activeCompletionIndex]?.photos || [];
    }
    return [];
  }


  return (
    <>
    <div className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8">
      <header className="mb-8">
        <Button asChild variant="ghost" className="mb-4 -ml-4">
            <Link href="/shifts">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Quay lại Ca làm việc
            </Link>
        </Button>
        <h1 className="text-3xl font-bold font-headline">Checklist: {shift.name}</h1>
        <p className="text-muted-foreground">Hoàn thành nhiệm vụ của bạn và gửi báo cáo cuối ca.</p>
      </header>

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Nhiệm vụ</CardTitle>
            <CardDescription>
              Nhấn "Đã hoàn thành" để ghi nhận công việc bằng hình ảnh.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" defaultValue={shift.sections.map(s => s.title)} className="w-full">
              {shift.sections.map((section) => (
                <AccordionItem value={section.title} key={section.title}>
                  <AccordionTrigger className="text-lg font-medium">{section.title}</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      {section.tasks.map((task) => {
                        const completions = (taskCompletion[task.id] || []) as CompletionRecord[];
                        const isCompleted = completions.length > 0;
                        
                        return (
                           <div key={task.id} className={`rounded-md border p-4 transition-colors ${isCompleted ? 'bg-accent/20' : ''}`}>
                            <div className="flex items-center gap-4">
                              <div className="flex-1">
                                <p className="font-medium">
                                  {task.text}
                                </p>
                              </div>
                              <Button size="sm" variant="secondary" onClick={() => handleTaskAction(task.id)}>
                                  <Camera className="mr-2 h-4 w-4"/>
                                  Đã hoàn thành
                              </Button>
                            </div>
                            
                            {completions.map((completion, cIndex) => (
                              <div key={cIndex} className="mt-4 rounded-md border bg-card p-3">
                                  <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                          <Clock className="h-4 w-4 flex-shrink-0" />
                                          <span>Thực hiện lúc: {completion.timestamp}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                          <Button size="xs" variant="outline" onClick={() => handleEditPhotos(task.id, cIndex)}>
                                              <Camera className="mr-1.5 h-3 w-3" />
                                              Sửa ảnh
                                          </Button>
                                          <Button size="xs" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => handleDeleteCompletion(task.id, cIndex)}>
                                              <Trash2 className="h-3 w-3" />
                                          </Button>
                                      </div>
                                  </div>
                                {completion.photos.length > 0 ? (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                    {completion.photos.map((photo, pIndex) => (
                                        <div key={pIndex} className="relative aspect-square overflow-hidden rounded-md">
                                        <Image src={photo} alt={`Ảnh bằng chứng ${pIndex + 1}`} fill className="object-cover" />
                                        <Button 
                                            variant="destructive"
                                            size="icon"
                                            className="absolute top-1 right-1 h-6 w-6 rounded-full"
                                            onClick={() => handleDeletePhoto(task.id, cIndex, pIndex)}
                                        >
                                            <X className="h-4 w-4" />
                                            <span className="sr-only">Xóa ảnh</span>
                                        </Button>
                                        </div>
                                    ))}
                                    </div>
                                ): (
                                    <p className="text-xs text-muted-foreground italic">Không có ảnh nào được chụp cho lần thực hiện này.</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ghi chú ca</CardTitle>
            <CardDescription>Báo cáo mọi sự cố hoặc sự kiện đáng chú ý trong ca của bạn.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="ví dụ: 'Máy pha cà phê bị rò rỉ.'"
              value={issues}
              onChange={(e) => setIssues(e.target.value)}
            />
          </CardContent>
        </Card>
        
        <Button size="lg" className="w-full" onClick={handleSubmit}>
          <Send className="mr-2" />
          Gửi báo cáo cuối cùng
        </Button>
      </div>
    </div>
    <CameraDialog 
        isOpen={isCameraOpen}
        onClose={() => {
            setIsCameraOpen(false);
            setActiveTaskId(null);
            setActiveCompletionIndex(null);
        }}
        onSubmit={handleCapturePhotos}
        initialPhotos={getInitialPhotosForCamera()}
    />
    </>
  );
}
