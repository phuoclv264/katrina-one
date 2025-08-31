'use client';

import { useState } from 'react';
import { generateStartingTaskList } from '@/ai/flows/generate-starting-task-lists';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Textarea } from './ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Wand2 } from 'lucide-react';
import type { Task } from '@/lib/types';
import { Skeleton } from './ui/skeleton';

type Props = {
  onGenerate: (newTasks: Task[]) => void;
};

export default function AiTaskGenerator({ onGenerate }: Props) {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (prompt.trim() === '') return;
    setIsLoading(true);
    try {
      const result = await generateStartingTaskList({ description: prompt });
      if (result && result.taskList) {
        const newTasks: Task[] = result.taskList.map(text => ({
          id: `task-${Date.now()}-${Math.random()}`,
          text,
        }));
        onGenerate(newTasks);
        setPrompt('');
        toast({
          title: "Tasks Generated!",
          description: `${newTasks.length} new tasks have been added to your list.`,
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to generate tasks. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="text-primary"/> AI Task Generator</CardTitle>
        <CardDescription>
          Describe the type of shift or work area, and AI will create a starting list of tasks for you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="e.g., 'Daily closing tasks for a small coffee shop' or 'Morning prep for a kitchen'"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={4}
          disabled={isLoading}
        />
        {isLoading ? (
            <Button disabled className="w-full">
                <Wand2 className="mr-2 h-4 w-4 animate-pulse" />
                Generating...
            </Button>
        ) : (
            <Button onClick={handleGenerate} className="w-full">
                <Wand2 className="mr-2 h-4 w-4" />
                Generate Tasks
            </Button>
        )}
      </CardContent>
    </Card>
  );
}
