'use client';

import { useEffect, useState } from 'react';
import type { ShiftReport } from '@/lib/types';
import { summarizeShiftReport, SummarizeShiftReportOutput } from '@/ai/flows/summarize-shift-reports';
import { tasks } from '@/lib/data';
import { Skeleton } from './ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { CheckCircle, Info, Lightbulb, XCircle } from 'lucide-react';
import { Badge } from './ui/badge';

type Props = {
  report: ShiftReport;
};

export default function AiReportSummary({ report }: Props) {
  const [summary, setSummary] = useState<SummarizeShiftReportOutput | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const generateSummary = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const criticalTasks = tasks.filter(t => t.isCritical).map(t => t.text);
        const completedTaskTexts = tasks
          .filter(t => report.completedTasks.includes(t.id))
          .map(t => t.text);

        const result = await summarizeShiftReport({
          completedTasks: completedTaskTexts,
          uploadedPhotos: report.uploadedPhotos,
          criticalTasks: criticalTasks,
          commonIssues: report.issues || 'No issues reported.',
        });
        setSummary(result);
      } catch (e) {
        console.error(e);
        setError('Failed to generate AI summary.');
      } finally {
        setIsLoading(false);
      }
    };
    generateSummary();
  }, [report]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex gap-4 pt-4">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-8 w-1/2" />
        </div>
      </div>
    );
  }

  if (error) {
    return <p className="text-destructive">{error}</p>;
  }

  if (!summary) {
    return null;
  }
  
  const allCriticalCompleted = summary.criticalTasksStatus.includes('All critical tasks completed');

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{summary.summary}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex items-center gap-2 rounded-lg border p-3">
          {allCriticalCompleted ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <XCircle className="h-5 w-5 text-destructive" />
          )}
          <div>
            <p className="text-xs text-muted-foreground">Critical Tasks</p>
            <p className="text-sm font-semibold">{summary.criticalTasksStatus}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border p-3">
          {report.uploadedPhotos.length > 0 ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <XCircle className="h-5 w-5 text-destructive" />
          )}
          <div>
            <p className="text-xs text-muted-foreground">Photo Proof</p>
            <p className="text-sm font-semibold">{summary.photoUploadsStatus}</p>
          </div>
        </div>
      </div>
      
      <Alert>
        <Lightbulb className="h-4 w-4" />
        <AlertTitle>Suggested Improvements</AlertTitle>
        <AlertDescription>
          {summary.suggestedImprovements}
        </AlertDescription>
      </Alert>

    </div>
  );
}
