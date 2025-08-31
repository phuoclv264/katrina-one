import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { reports, tasks } from '@/lib/data';
import AiReportSummary from '@/components/ai-report-summary';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Check, Camera, MessageSquareWarning, Sparkles, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ReportDetailPage({ params }: { params: { id: string } }) {
  const report = reports.find(r => r.id === params.id);

  if (!report) {
    notFound();
  }

  const criticalTaskIds = tasks.filter(t => t.isCritical).map(t => t.id);

  return (
    <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">
      <header className="mb-8">
        <Button asChild variant="ghost" className="mb-4 -ml-4">
            <Link href="/reports">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to All Reports
            </Link>
        </Button>
        <h1 className="text-3xl font-bold font-headline">Report Details</h1>
        <p className="text-muted-foreground">
          Shift report from <span className="font-semibold">{report.staffName}</span> on <span className="font-semibold">{report.shiftDate}</span>.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Sparkles className="text-primary" /> AI Generated Summary</CardTitle>
                </CardHeader>
                <CardContent>
                    <AiReportSummary report={report} />
                </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Completed Tasks</CardTitle>
                <CardDescription>{report.completedTasks.length} of {tasks.length} tasks were marked as complete.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {tasks.map(task => {
                    const isCompleted = report.completedTasks.includes(task.id);
                    return (
                      <li key={task.id} className="flex items-center gap-3 text-sm">
                        <div className={`flex h-5 w-5 items-center justify-center rounded-full ${isCompleted ? 'bg-accent' : 'bg-muted'}`}>
                          {isCompleted && <Check className="h-4 w-4 text-accent-foreground" />}
                        </div>
                        <span className={isCompleted ? '' : 'text-muted-foreground'}>{task.text}</span>
                        {task.isCritical && <Star className={`h-4 w-4 ml-auto ${isCompleted ? 'text-yellow-500' : 'text-yellow-500/30'}`} />}
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Camera /> Uploaded Photos</CardTitle>
            </CardHeader>
            <CardContent>
              {report.uploadedPhotos.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {report.uploadedPhotos.map((photo, index) => (
                    <div key={index} className="relative aspect-video overflow-hidden rounded-md">
                      <Image src={photo} alt={`Report photo ${index + 1}`} fill className="object-cover" data-ai-hint="work area" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No photos were uploaded for this shift.</p>
              )}
            </CardContent>
          </Card>

          {report.issues && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MessageSquareWarning /> Reported Issues</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm italic">"{report.issues}"</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
