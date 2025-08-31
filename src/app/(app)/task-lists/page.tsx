'use client';
import { useState } from 'react';
import { tasks as initialTasks } from '@/lib/data';
import type { Task } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Star, ListTodo } from 'lucide-react';
import AiTaskGenerator from '@/components/ai-task-generator';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export default function TaskListsPage() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [newTaskText, setNewTaskText] = useState('');
  const [isNewTaskCritical, setIsNewTaskCritical] = useState(false);

  const handleAddTask = () => {
    if (newTaskText.trim() === '') return;
    const newTask: Task = {
      id: `task-${Date.now()}`,
      text: newTaskText.trim(),
      isCritical: isNewTaskCritical,
    };
    setTasks(prevTasks => [...prevTasks, newTask]);
    setNewTaskText('');
    setIsNewTaskCritical(false);
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
  };
  
  return (
    <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold font-headline">Manage Task Lists</h1>
        <p className="text-muted-foreground">Create and edit the daily tasks for all shifts.</p>
      </header>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ListTodo /> Current Tasks</CardTitle>
              <CardDescription>This list will be shown to staff at the start of each shift.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {tasks.map(task => (
                  <div key={task.id} className="flex items-center gap-2 rounded-md border bg-card p-3">
                    {task.isCritical && <Star className="h-4 w-4 text-yellow-500 shrink-0" />}
                    <p className="flex-1 text-sm">{task.text}</p>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteTask(task.id)}>
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete task</span>
                    </Button>
                  </div>
                ))}
                {tasks.length === 0 && (
                   <p className="text-sm text-muted-foreground text-center py-4">No tasks yet. Add one below or use the AI generator.</p>
                )}
              </div>

              <div className="flex flex-col gap-2 rounded-md border p-3">
                <Input
                  placeholder="Enter a new task description"
                  value={newTaskText}
                  onChange={e => setNewTaskText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                />
                 <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="isCritical" checked={isNewTaskCritical} onCheckedChange={(checked) => setIsNewTaskCritical(checked as boolean)} />
                      <Label htmlFor="isCritical" className="text-sm font-medium">Mark as critical</Label>
                    </div>
                    <Button onClick={handleAddTask} size="sm">
                        <Plus className="mr-2 h-4 w-4" /> Add Task
                    </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <AiTaskGenerator onGenerate={(newTasks) => setTasks(current => [...current, ...newTasks])} />
        </div>
      </div>
    </div>
  );
}
