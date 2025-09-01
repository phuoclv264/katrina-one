
'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import AiReportSummary from '@/components/ai-report-summary';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Check, Camera, MessageSquareWarning, Sparkles, Star, Clock, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { TaskCompletion, CompletionRecord } from '@/lib/types';

export default function ReportDetailPage() {
  const params = useParams();
  const [reports, setReports] = useState(dataStore.getReports());
  const [tasksByShift, setTasksByShift] = useState(dataStore.getTasks());

  useEffect(() => {
    const unsubscribe = dataStore.subscribe(() => {
      setReports(dataStore.getReports());
      setTasksByShift(dataStore.getTasks());
    });
    return () => unsubscribe();
  }, []);
  
  const report = reports.find(r => r.id === params.id);

  if (!report) {
    return <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">Báo cáo không tìm thấy.</div>;
  }

  const shift = tasksByShift[report.shiftKey];
  if (!shift) {
    return <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">Thông tin ca làm việc không tồn tại.</div>;
  }
  
  const getCompletedTaskCount = (completedTasks: TaskCompletion) => {
    const allTasks = shift.sections.flatMap(s => s.tasks);
    let completedCount = 0;
    allTasks.forEach(task => {
        const completions = completedTasks[task.id];
        if (Array.isArray(completions) && completions.length > 0) {
            completedCount++;
        }
    });
    return completedCount;
  };
  
  const totalTaskCount = shift.sections.flatMap(s => s.tasks).length;
  const completedTaskCount = getCompletedTaskCount(report.completedTasks);


  return (
    <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">
      <header className="mb-8">
        <Button asChild variant="ghost" className="mb-4 -ml-4">
            <Link href="/reports">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Quay lại tất cả báo cáo
            </Link>
        </Button>
        <h1 className="text-3xl font-bold font-headline">Chi tiết báo cáo</h1>
        <p className="text-muted-foreground">
          Báo cáo ca từ <span className="font-semibold">{report.staffName}</span> vào lúc <span className="font-semibold">{new Date(report.submittedAt).toLocaleString('vi-VN')}</span>.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Sparkles className="text-primary" /> Tóm tắt từ AI</CardTitle>
                </CardHeader>
                <CardContent>
                    <AiReportSummary report={report} />
                </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Nhiệm vụ đã hoàn thành</CardTitle>
                <CardDescription>{completedTaskCount} trên {totalTaskCount} nhiệm vụ đã được đánh dấu là hoàn thành.</CardDescription>
              </CardHeader>
              <CardContent>
                 <Accordion type="multiple" defaultValue={shift.sections.map(s => s.title)} className="w-full">
                  {shift.sections.map((section) => (
                    <AccordionItem value={section.title} key={section.title}>
                      <AccordionTrigger className="text-lg font-medium">{section.title}</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-2">
                          {section.tasks.map((task) => {
                            const completions = (report.completedTasks[task.id] || []) as CompletionRecord[];
                            const isCompleted = completions.length > 0;
                            
                            return (
                               <div key={task.id} className="flex flex-col gap-3 text-sm p-4 border rounded-md">
                                <div className="flex items-start gap-4">
                                  <div className={`flex h-5 w-5 items-center justify-center rounded-full flex-shrink-0 mt-0.5 ${isCompleted ? 'bg-accent' : 'bg-muted'}`}>
                                    {isCompleted ? <Check className="h-4 w-4 text-accent-foreground" /> : <X className="h-4 w-4 text-muted-foreground" />}
                                  </div>
                                  <span className={`flex-1 ${!isCompleted ? 'text-muted-foreground' : ''}`}>{task.text}</span>
                                </div>
                                
                                {completions.map((completion, cIndex) => (
                                  <div key={cIndex} className="mt-2 ml-9 rounded-md border bg-card p-3">
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                                          <Clock className="h-4 w-4 flex-shrink-0" />
                                          <span>Thực hiện lúc: {completion.timestamp}</span>
                                      </div>
                                    {completion.photos.length > 0 ? (
                                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                        {completion.photos.map((photo, pIndex) => (
                                            <div key={pIndex} className="relative aspect-square overflow-hidden rounded-md">
                                            <Image src={photo} alt={`Ảnh bằng chứng ${pIndex + 1}`} fill className="object-cover" />
                                            </div>
                                        ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground italic">Không có ảnh nào được cung cấp.</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Camera /> Tổng hợp hình ảnh</CardTitle>
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
                <p className="text-sm text-muted-foreground text-center py-4">Không có ảnh nào được tải lên cho ca này.</p>
              )}
            </CardContent>
          </Card>

          {report.issues && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MessageSquareWarning /> Vấn đề được báo cáo</CardTitle>
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
