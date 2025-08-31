
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
import { Camera, Paperclip, Send, Star, Upload, ArrowLeft, Clock, PlusCircle, X } from 'lucide-react';
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
  
  // Changed photos state to associate photos with task IDs
  const [taskPhotos, setTaskPhotos] = useState<{[taskId: string]: string[]}>({});

  useEffect(() => {
    if (shift) {
      const initialCompletion: TaskCompletion = {};
      const initialPhotos: {[taskId: string]: string[]} = {};
      shift.sections.forEach(section => {
        section.tasks.forEach(task => {
          if (task.timeSlots) {
             initialCompletion[task.id] = [];
             initialPhotos[task.id] = [];
          } else {
            initialCompletion[task.id] = false;
          }
        });
      });
      setTaskCompletion(initialCompletion);
      setTaskPhotos(initialPhotos);
    }
  }, [shift]);
  
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
  
  const handleCapturePhotos = (photos: string[]) => {
    if (activeTaskId) {
       setTaskPhotos(prev => ({
        ...prev,
        [activeTaskId]: photos
      }));

      // Only add timestamp if photos are added
      if (photos.length > 0) {
        setTaskCompletion(current => {
          const newCompletion = JSON.parse(JSON.stringify(current));
          const taskTimestamps = (newCompletion[activeTaskId] as string[]) || [];
          const now = new Date();
          const formattedTime = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

          // Add a timestamp for each new photo, but avoid duplicates if called multiple times
          // A simpler approach: just ensure at least one timestamp exists if there are photos
          if (taskTimestamps.length === 0) {
            taskTimestamps.push(formattedTime);
          }
          newCompletion[activeTaskId] = taskTimestamps;
          return newCompletion;
        });
      }
    }
    setIsCameraOpen(false);
    setActiveTaskId(null);
    toast({
        title: `Đã lưu ${photos.length} ảnh!`,
        description: "Ảnh đã được thêm vào báo cáo của bạn."
    });
  };
  
  const handleDeletePhoto = (taskId: string, photoIndex: number) => {
    setTaskPhotos(prev => {
      const newPhotos = [...(prev[taskId] || [])];
      newPhotos.splice(photoIndex, 1);
      return {
        ...prev,
        [taskId]: newPhotos
      };
    });
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>, taskId: string) => {
    if (event.target.files) {
       Array.from(event.target.files).forEach(file => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => {
              setTaskPhotos(prev => ({
                ...prev,
                [taskId]: [...(prev[taskId] || []), reader.result as string]
              }));
          };
      });
    }
  };


  const handleSubmit = () => {
    // Consolidate all photos from taskPhotos into a single array for the report
    const allUploadedPhotos = Object.values(taskPhotos).flat();

    dataStore.addReport({
        shiftKey,
        staffName: staffName || 'Nhân viên',
        completedTasks: taskCompletion,
        uploadedPhotos: allUploadedPhotos, // Send the consolidated list
        issues: issues || null,
        taskPhotos, // Keep the association for the detailed report view
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
    const initialPhotos: {[taskId: string]: string[]} = {};
    shift.sections.forEach(section => {
      section.tasks.forEach(task => {
        if (task.timeSlots) {
          initialCompletion[task.id] = [];
          initialPhotos[task.id] = [];
        } else {
          initialCompletion[task.id] = false;
        }
      });
    });
    setTaskCompletion(initialCompletion);
    setTaskPhotos(initialPhotos);
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
                          const photosForTask = taskPhotos[task.id] || [];
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
                                    Chụp ảnh
                                </Button>
                              </div>
                              {timestamps.length > 0 && (
                                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                                    <Clock className="h-4 w-4 flex-shrink-0" />
                                    <span>Thực hiện lúc: {timestamps.join(', ')}</span>
                                </div>
                              )}
                              {photosForTask.length > 0 && (
                                <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 gap-2">
                                  {photosForTask.map((photo, index) => (
                                    <div key={index} className="relative aspect-square overflow-hidden rounded-md">
                                      <Image src={photo} alt={`Ảnh bằng chứng ${index + 1}`} fill className="object-cover" />
                                      <Button 
                                        variant="destructive"
                                        size="icon"
                                        className="absolute top-1 right-1 h-6 w-6 rounded-full"
                                        onClick={() => handleDeletePhoto(task.id, index)}
                                      >
                                        <X className="h-4 w-4" />
                                        <span className="sr-only">Xóa ảnh</span>
                                      </Button>
                                    </div>
                                  ))}
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
        onSubmit={handleCapturePhotos}
        initialPhotos={activeTaskId ? taskPhotos[activeTaskId] : []}
    />
    </>
  );
}
