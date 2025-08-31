
'use client';
import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import type { Task, TaskCompletion, TasksByShift } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Camera, Paperclip, Send, Star, Upload, ArrowLeft, Clock, PlusCircle } from 'lucide-react';
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
          if (task.timeSlots) {
             initialCompletion[task.id] = [];
          } else {
            initialCompletion[task.id] = false;
          }
        });
      });
      setTaskCompletion(initialCompletion);
    }
  }, [shift]);
  
  const [photos, setPhotos] = useState<string[]>([]);
  const [issues, setIssues] = useState('');

  if (!shift) {
    // Data might be loading, show a skeleton or loading state
    return <div>Đang tải...</div>;
  }
  
  const totalTasks = useMemo(() => {
    return shift.sections.flatMap(s => s.tasks.flatMap(t => t.timeSlots ? t.timeSlots.length : 1)).length;
  }, [shift]);

  const handleTaskToggle = (taskId: string) => {
    setTaskCompletion(current => {
      const newCompletion = JSON.parse(JSON.stringify(current));
      newCompletion[taskId] = !newCompletion[taskId];
      return newCompletion;
    });
  };

   const openCameraForTask = (taskId: string) => {
    setActiveTaskId(taskId);
    setIsCameraOpen(true);
  };
  
  const handleCapturePhoto = (photoDataUri: string) => {
    if (activeTaskId) {
      setPhotos(prev => [...prev, photoDataUri]);
      // Also mark the task as completed with a timestamp
      setTaskCompletion(current => {
        const newCompletion = JSON.parse(JSON.stringify(current));
        const taskTimestamps = (newCompletion[activeTaskId] as string[]) || [];
        const now = new Date();
        const formattedTime = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        taskTimestamps.push(formattedTime);
        newCompletion[activeTaskId] = taskTimestamps;
        return newCompletion;
      });
    }
    setIsCameraOpen(false);
    setActiveTaskId(null);
    toast({
        title: "Đã chụp ảnh!",
        description: "Ảnh đã được thêm vào báo cáo của bạn."
    });
  };
  
  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
       Array.from(event.target.files).forEach(file => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => {
              setPhotos(prev => [...prev, reader.result as string]);
          };
      });
    }
  };

  const handleSubmit = () => {
    dataStore.addReport({
        shiftKey,
        staffName: staffName || 'Nhân viên',
        completedTasks: taskCompletion,
        uploadedPhotos: photos,
        issues: issues || null,
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
        if (task.timeSlots) {
          initialCompletion[task.id] = [];
        } else {
          initialCompletion[task.id] = false;
        }
      });
    });
    setTaskCompletion(initialCompletion);
    setPhotos([]);
    setIssues('');
  };

  const completedCount = useMemo(() => {
    return Object.values(taskCompletion).reduce((count, status) => {
      if (typeof status === 'boolean') {
        return count + (status ? 1 : 0);
      } else if (Array.isArray(status)) {
        // For timestamped tasks, we can count each timestamp as one completion
        return count + status.length;
      }
      return count;
    }, 0);
  }, [taskCompletion]);

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
              Bạn đã hoàn thành các công việc.
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
                        const taskState = taskCompletion[task.id];
                        
                        if (task.timeSlots) {
                          const timestamps = (Array.isArray(taskState) ? taskState : []) as string[];
                          return (
                             <div key={task.id} className="rounded-md border p-4 transition-colors">
                              <div className="flex items-center gap-4">
                                <div className="flex-1">
                                  <p className="font-medium">
                                    {task.text}
                                  </p>
                                </div>
                                <Button size="sm" variant="secondary" onClick={() => openCameraForTask(task.id)}>
                                    <Camera className="mr-2 h-4 w-4"/>
                                    Đã thực hiện
                                </Button>
                              </div>
                              {timestamps.length > 0 && (
                                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                                    <Clock className="h-4 w-4 flex-shrink-0" />
                                    <span>Thực hiện lúc: {timestamps.join(', ')}</span>
                                </div>
                              )}
                            </div>
                          )
                        }

                        const isCompleted = typeof taskState === 'boolean' && taskState;
                        return (
                          <div
                            key={task.id}
                            className={`flex items-center gap-4 rounded-md border p-4 transition-colors ${
                              isCompleted ? 'bg-accent/20' : ''
                            }`}
                          >
                            <Checkbox
                              id={`task-${task.id}`}
                              checked={isCompleted}
                              onCheckedChange={() => handleTaskToggle(task.id)}
                              className="h-6 w-6"
                              aria-label={`Đánh dấu công việc là ${isCompleted ? 'chưa hoàn thành' : 'hoàn thành'}`}
                            />
                            <label
                              htmlFor={`task-${task.id}`}
                              className={`flex-1 text-sm font-medium transition-colors ${
                                isCompleted ? 'text-muted-foreground line-through' : ''
                              }`}
                            >
                              {task.text}
                            </label>
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
            <CardTitle>Hình ảnh chứng thực</CardTitle>
            <CardDescription>Tải lên hoặc chụp ảnh trực tiếp về công việc đã hoàn thành.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
              {photos.map((photo, index) => (
                <div key={index} className="relative aspect-video overflow-hidden rounded-lg">
                  <Image src={photo} alt={`Xem trước ảnh tải lên ${index + 1}`} fill className="object-cover" />
                </div>
              ))}
            </div>
            <div className="relative flex w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border p-8 hover:bg-muted/50">
              <div className="text-center">
                <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Nhấp để tải ảnh lên từ thiết bị</p>
              </div>
              <Input 
                id="photo-upload" 
                type="file" 
                multiple 
                accept="image/*"
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                onChange={handlePhotoUpload}
              />
            </div>
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
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCapturePhoto}
    />
    </>
  );
}

    