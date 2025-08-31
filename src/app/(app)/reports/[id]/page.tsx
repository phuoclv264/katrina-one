
'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import AiReportSummary from '@/components/ai-report-summary';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Check, Camera, MessageSquareWarning, Sparkles, Star, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

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
  
  const allTasks = shift.sections.flatMap(s => s.tasks);
  
  const completedSimpleTasks = Object.entries(report.completedTasks).filter(([taskId, status]) => {
      const task = allTasks.find(t => t.id === taskId);
      return task && !task.timeSlots && status === true;
  }).length;

  const completedTimestampedTasks = Object.entries(report.completedTasks).filter(([taskId, status]) => {
      const task = allTasks.find(t => t.id === taskId);
      return task && task.timeSlots && Array.isArray(status) && status.length > 0;
  }).length;

  const totalSimpleTasks = allTasks.filter(t => !t.timeSlots).length;
  const totalTimestampedTasks = allTasks.filter(t => t.timeSlots).length;
  const completedTaskCount = completedSimpleTasks + completedTimestampedTasks;
  const totalTaskCount = totalSimpleTasks + totalTimestampedTasks;


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
          Báo cáo ca từ <span className="font-semibold">{report.staffName}</span> vào ngày <span className="font-semibold">{new Date(report.shiftDate).toLocaleDateString('vi-VN')}</span>.
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
                            const completionStatus = report.completedTasks[task.id];
                            
                            if (task.timeSlots) {
                               const timestamps = (Array.isArray(completionStatus) ? completionStatus : []) as string[];
                               return (
                                <div key={task.id} className="rounded-md border p-4">
                                  <div className="flex items-start gap-4">
                                    <div className="flex-1">
                                      <p className="font-medium">
                                        {task.text}
                                      </p>
                                    </div>
                                    <div className={`flex h-5 w-5 items-center justify-center rounded-full ${timestamps.length > 0 ? 'bg-accent' : 'bg-muted'}`}>
                                      {timestamps.length > 0 ? <Check className="h-4 w-4 text-accent-foreground" /> : <X className="h-4 w-4 text-muted-foreground" />}
                                    </div>
                                  </div>
                                  {timestamps.length > 0 && (
                                    <div className="mt-3 pl-2 border-l-2 ml-2 space-y-2">
                                      {timestamps.map((time, index) => (
                                        <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Clock className="h-4 w-4" />
                                            <span>Đã thực hiện lúc: {time}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            }
                            
                            const isCompleted = typeof completionStatus === 'boolean' && completionStatus;
                            return (
                               <div key={task.id} className="flex items-center gap-3 text-sm p-4 border rounded-md">
                                <div className={`flex h-5 w-5 items-center justify-center rounded-full ${isCompleted ? 'bg-accent' : 'bg-muted'}`}>
                                  {isCompleted ? <Check className="h-4 w-4 text-accent-foreground" /> : <X className="h-4 w-4 text-muted-foreground" />}
                                </div>
                                <span className={isCompleted ? '' : 'text-muted-foreground'}>{task.text}</span>
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
              <CardTitle className="flex items-center gap-2"><Camera /> Hình ảnh đã tải lên</CardTitle>
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
