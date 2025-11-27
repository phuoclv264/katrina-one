'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'nextjs-toploader/app';
import { dataStore } from '@/lib/data-store';
import type { MediaAttachment, TaskCompletionRecord } from '@/lib/types';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { CalendarCheck, ChevronLeft, ChevronRight, Clock, User, Image as ImageIcon, Video, Trash2, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'react-hot-toast';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import { useLightbox } from '@/contexts/lightbox-context';
import { Skeleton } from '@/components/ui/skeleton';

type GroupedReports = {
  [taskName: string]: {
    [date: string]: TaskCompletionRecord[];
  };
};

export default function MonthlyTaskReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [completions, setCompletions] = useState<TaskCompletionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { openLightbox } = useLightbox();
  const [isDeleting, setIsDeleting] = useState(false);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const handleDataRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'Chủ nhà hàng') {
        router.replace('/');
      }
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      setIsLoading(true);
      const unsub = dataStore.subscribeToMonthlyTaskCompletionsForMonth(currentMonth, (data) => {
        setCompletions(data);
        setIsLoading(false);
      });
      return () => unsub();
    }
  }, [user, currentMonth, refreshTrigger]);

  useDataRefresher(handleDataRefresh);

  const groupedReports = useMemo<GroupedReports>(() => {
    const grouped: GroupedReports = {};
    completions.forEach(comp => {
      if (!grouped[comp.taskName]) {
        grouped[comp.taskName] = {};
      }
      if (!grouped[comp.taskName][comp.assignedDate]) {
        grouped[comp.taskName][comp.assignedDate] = [];
      }
      grouped[comp.taskName][comp.assignedDate].push(comp);
    });

    // Sort dates within each task
    for (const taskName in grouped) {
      const dates = Object.keys(grouped[taskName]).sort((a, b) => a.localeCompare(b));
      const sortedDates: { [date: string]: TaskCompletionRecord[] } = {};
      for (const date of dates) {
        sortedDates[date] = grouped[taskName][date];
      }
      grouped[taskName] = sortedDates;
    }

    return grouped;
  }, [completions]);

  const createLightboxSlides = (media: MediaAttachment[]) => media.map(att => {
      if (att.type === 'video') {
        return {
          type: 'video' as const,
          sources: [
            { src: att.url, type: 'video/mp4' },
            { src: att.url, type: 'video/webm' },
          ],
        };
      }
      return { src: att.url };
    });

  const handleOpenLightbox = (media: NonNullable<TaskCompletionRecord['media']>, index: number) => {
    openLightbox(createLightboxSlides(media), index);
  };  

  const handleDeleteReport = async (record: TaskCompletionRecord) => {
    if (!record.completedBy) return;
    setIsDeleting(true);
    try {
      await dataStore.deleteMonthlyTaskCompletion(record.taskId, record.completedBy.userId, record.assignedDate);
      toast.success("Đã xóa báo cáo thành công.");
    } catch (error) {
      console.error("Failed to delete report:", error);
      toast.error("Không thể xóa báo cáo.");
    } finally {
      setIsDeleting(false);
    }
  };




  if (authLoading) {
    return <LoadingPage />;
  }

  return (
    <>
      <div className="container mx-auto p-4 sm:p-6 md:p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
            <CalendarCheck />
            Báo cáo Công việc Định kỳ
          </h1>
          <p className="text-muted-foreground mt-2">
            Xem lại tất cả các báo cáo công việc định kỳ đã được nhân viên gửi.
          </p>
        </header>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Báo cáo tháng {format(currentMonth, 'MM/yyyy')}</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : Object.keys(groupedReports).length > 0 ? (
              <Accordion type="multiple" className="w-full space-y-3">
                {Object.entries(groupedReports).map(([taskName, dates]) => (
                  <AccordionItem key={taskName} value={taskName} className="border rounded-lg bg-card">
                    <AccordionTrigger className="p-4 text-lg font-semibold hover:no-underline">{taskName}</AccordionTrigger>
                    <AccordionContent className="p-4 border-t">
                      <Accordion type="multiple" className="w-full space-y-2">
                        {Object.entries(dates).map(([date, records]) => (
                          <AccordionItem key={date} value={date} className="border rounded-md bg-muted/50">
                            <AccordionTrigger className="px-3 py-2 font-medium hover:no-underline">
                              Ngày {format(new Date(date), 'dd/MM/yyyy')}
                            </AccordionTrigger>
                            <AccordionContent className="p-3 border-t">
                              <ul className="space-y-4">
                                {records.map((record, idx) => (
                                  <li key={idx} className="space-y-2">
                                    <div className="flex justify-between items-start">
                                      <div className="flex items-center gap-2 text-sm font-medium">
                                        <User className="h-4 w-4" />
                                        <span>{record.completedBy?.userName || 'Không rõ'}</span>
                                        {record.completedAt && (
                                          <span className="flex items-center gap-1 text-xs text-muted-foreground font-normal">
                                            <Clock className="h-3 w-3" /> {format(record.completedAt.toDate(), 'HH:mm')}
                                          </span>
                                        )}
                                      </div>
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" disabled={isDeleting}>
                                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader><AlertDialogTitle>Xác nhận xóa báo cáo?</AlertDialogTitle><AlertDialogDescription>Hành động này sẽ xóa vĩnh viễn báo cáo và tất cả bằng chứng đính kèm của nhân viên này. Bạn có chắc chắn không?</AlertDialogDescription></AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Hủy</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteReport(record)}>Xóa</AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </div>
                                    {record.note && (
                                      <Alert variant="default" className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 dark:bg-amber-900/30">
                                        <AlertDescription className="text-amber-700 dark:text-amber-400">{record.note}</AlertDescription>
                                      </Alert>
                                    )}
                                    {record.media && record.media.length > 0 && (
                                      <div className="flex flex-wrap gap-2 pl-6">
                                        {record.media.map((att, index) => (
                                          <button key={index} onClick={() => handleOpenLightbox(record.media!, index)} className="relative w-20 h-20 rounded-md overflow-hidden group bg-secondary">
                                            {att.type === 'photo' ? (
                                              <Image src={att.url} alt={`Bằng chứng ${index + 1}`} fill className="object-cover transition-transform duration-200 group-hover:scale-105" />
                                            ) : att.type === 'video' ? (
                                              <>
                                                <video src={`${att.url}#t=0.1`} preload="metadata" muted playsInline className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" />
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Video className="h-8 w-8 text-white" /></div>
                                              </>
                                            ) : null}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <p className="text-center text-muted-foreground py-8">Không có báo cáo nào trong tháng này.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}