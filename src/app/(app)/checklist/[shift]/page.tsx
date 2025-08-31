'use client';
import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { tasksByShift } from '@/lib/data';
import type { Task } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Camera, Paperclip, Send, Star, Upload, ArrowLeft, Clock } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type TaskCompletionState = {
  [taskId: string]: boolean | { [timeSlot: string]: boolean };
};

export default function ChecklistPage() {
  const { toast } = useToast();
  const params = useParams();
  const shiftKey = params.shift as string;

  const shift = tasksByShift[shiftKey];

  const [taskCompletion, setTaskCompletion] = useState<TaskCompletionState>({});

  useEffect(() => {
    if (shift) {
      const initialCompletion: TaskCompletionState = {};
      shift.sections.forEach(section => {
        section.tasks.forEach(task => {
          if (task.timeSlots) {
            initialCompletion[task.id] = {};
            task.timeSlots.forEach(slot => {
              (initialCompletion[task.id] as { [timeSlot: string]: boolean })[slot] = false;
            });
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
    notFound();
  }
  
  const totalTasks = useMemo(() => {
    return shift.sections.flatMap(s => s.tasks.flatMap(t => t.timeSlots ? t.timeSlots : t)).length;
  }, [shift]);

  const handleTaskToggle = (taskId: string, timeSlot?: string) => {
    setTaskCompletion(current => {
      const newCompletion = JSON.parse(JSON.stringify(current));
      const taskState = newCompletion[taskId];
      
      if (typeof taskState === 'object' && timeSlot && taskState !== null) {
        taskState[timeSlot] = !taskState[timeSlot];
      } else {
        newCompletion[taskId] = !taskState;
      }
      return newCompletion;
    });
  };
  
  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newPhotos = Array.from(event.target.files).map(file => URL.createObjectURL(file));
      setPhotos(prev => [...prev, ...newPhotos]);
    }
  };

  const handleSubmit = () => {
    toast({
      title: "Đã gửi báo cáo!",
      description: "Báo cáo ca làm việc của bạn đã được gửi thành công.",
      style: {
        backgroundColor: 'var(--accent)',
        color: 'var(--accent-foreground)'
      }
    });
    // Reset state
    const initialCompletion: TaskCompletionState = {};
    shift.sections.forEach(section => {
      section.tasks.forEach(task => {
        if (task.timeSlots) {
          initialCompletion[task.id] = {};
          task.timeSlots.forEach(slot => {
            (initialCompletion[task.id] as { [timeSlot: string]: boolean })[slot] = false;
          });
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
      } else if (status) {
        return count + Object.values(status).filter(Boolean).length;
      }
      return count;
    }, 0);
  }, [taskCompletion]);

  return (
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
              {completedCount} trên {totalTasks} nhiệm vụ đã hoàn thành.
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
                          const allSlotsCompleted = taskState && typeof taskState === 'object' && Object.values(taskState).every(Boolean);
                          return (
                            <div key={task.id} className={`rounded-md border p-4 transition-colors ${allSlotsCompleted ? 'bg-accent/20' : ''}`}>
                              <div className="flex items-start gap-4">
                                <div className="flex-1">
                                  <p className={`font-medium transition-colors ${allSlotsCompleted ? 'text-muted-foreground line-through' : ''}`}>
                                    {task.text}
                                  </p>
                                </div>
                                {task.isCritical && <Star className="h-5 w-5 text-yellow-500" />}
                              </div>
                              <div className="mt-4 space-y-3 pl-2 border-l-2 ml-2">
                                {task.timeSlots.map(slot => {
                                  const isSlotCompleted = taskState && typeof taskState === 'object' && taskState[slot];
                                  return (
                                    <div key={slot} className="flex items-center gap-3">
                                       <Checkbox
                                        id={`task-${task.id}-${slot}`}
                                        checked={!!isSlotCompleted}
                                        onCheckedChange={() => handleTaskToggle(task.id, slot)}
                                        className="h-5 w-5"
                                        aria-label={`Đánh dấu công việc lúc ${slot} là ${isSlotCompleted ? 'chưa hoàn thành' : 'hoàn thành'}`}
                                      />
                                      <Label htmlFor={`task-${task.id}-${slot}`} className={`text-sm transition-colors flex items-center gap-2 ${isSlotCompleted ? 'text-muted-foreground line-through' : ''}`}>
                                        <Clock className="h-4 w-4" />
                                        {slot}
                                      </Label>
                                    </div>
                                  )
                                })}
                              </div>
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
                            {task.isCritical && <Star className="h-5 w-5 text-yellow-500" />}
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
            <CardDescription>Tải lên hình ảnh về công việc đã hoàn thành.</CardDescription>
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
                <Camera className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Nhấp để tải ảnh lên</p>
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
  );
}
