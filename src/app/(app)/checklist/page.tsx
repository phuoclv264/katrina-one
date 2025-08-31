'use client';
import { useState } from 'react';
import Image from 'next/image';
import { tasks as initialTasks } from '@/lib/data';
import type { Task } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Camera, Paperclip, Send, Star, Upload } from 'lucide-react';

export default function ChecklistPage() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState(initialTasks.map(task => ({ ...task, completed: false })));
  const [photos, setPhotos] = useState<string[]>([]);
  const [issues, setIssues] = useState('');

  const handleTaskToggle = (taskId: string) => {
    setTasks(currentTasks =>
      currentTasks.map(task =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      )
    );
  };
  
  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newPhotos = Array.from(event.target.files).map(file => URL.createObjectURL(file));
      setPhotos(prev => [...prev, ...newPhotos]);
    }
  };

  const handleSubmit = () => {
    // In a real app, this would send data to a server.
    toast({
      title: "Report Submitted!",
      description: "Your shift report has been successfully submitted.",
      style: {
        backgroundColor: 'var(--accent)',
        color: 'var(--accent-foreground)'
      }
    });
    // Reset state
    setTasks(initialTasks.map(task => ({ ...task, completed: false })));
    setPhotos([]);
    setIssues('');
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;

  return (
    <div className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold font-headline">Daily Shift Checklist</h1>
        <p className="text-muted-foreground">Complete your tasks and submit your end-of-shift report.</p>
      </header>

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
            <CardDescription>
              {completedCount} of {totalCount} tasks completed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-center gap-4 rounded-md border p-4 transition-colors ${
                    task.completed ? 'bg-accent/20' : ''
                  }`}
                >
                  <Checkbox
                    id={`task-${task.id}`}
                    checked={task.completed}
                    onCheckedChange={() => handleTaskToggle(task.id)}
                    className="h-6 w-6"
                    aria-label={`Mark task as ${task.completed ? 'incomplete' : 'complete'}`}
                  />
                  <label
                    htmlFor={`task-${task.id}`}
                    className={`flex-1 text-sm font-medium transition-colors ${
                      task.completed ? 'text-muted-foreground line-through' : ''
                    }`}
                  >
                    {task.text}
                  </label>
                  {task.isCritical && <Star className="h-5 w-5 text-yellow-500" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Photo Proof</CardTitle>
            <CardDescription>Upload photos of completed work.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
              {photos.map((photo, index) => (
                <div key={index} className="relative aspect-video overflow-hidden rounded-lg">
                  <Image src={photo} alt={`Upload preview ${index + 1}`} fill className="object-cover" />
                </div>
              ))}
            </div>
            <div className="relative flex w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border p-8 hover:bg-muted/50">
              <div className="text-center">
                <Camera className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Click to upload photos</p>
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
            <CardTitle>Shift Notes</CardTitle>
            <CardDescription>Report any issues or noteworthy events from your shift.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="e.g., 'The coffee machine is leaking.'"
              value={issues}
              onChange={(e) => setIssues(e.target.value)}
            />
          </CardContent>
        </Card>
        
        <Button size="lg" className="w-full" onClick={handleSubmit}>
          <Send className="mr-2" />
          Submit Final Report
        </Button>
      </div>
    </div>
  );
}
