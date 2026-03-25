'use client';
import { useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import { getQueryParamWithMobileHashFallback } from '@/lib/url-params';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquareWarning, Users, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ShiftReport, CompletionRecord, ComprehensiveTaskSection } from '@/lib/types';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { Combobox } from '@/components/combobox';
import { useAuth } from '@/hooks/use-auth';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import { showToast } from '@/components/ui/pro-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogIcon, AlertDialogTitle, AlertDialogTrigger, } from '@/components/ui/alert-dialog';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Timestamp } from 'firebase/firestore';
import { useRouter } from 'nextjs-toploader/app';
import { SectionReportViewer } from './_components/section-report-viewer';

function ComprehensiveReportView() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const date = getQueryParamWithMobileHashFallback({
    param: 'date',
    searchParams,
    hash: typeof window !== 'undefined' ? window.location.hash : '',
  });
  const shiftKey = 'manager_comprehensive';

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const handleDataRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const [reports, setReports] = useState<ShiftReport[]>([]);
  const [taskSections, setTaskSections] = useState<ComprehensiveTaskSection[] | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'Chủ nhà hàng')) {
      router.replace('/shifts');
      return;
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!date) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const unsubscribeTasks = dataStore.subscribeToComprehensiveTasks((tasks) => {
      if (isMounted) setTaskSections(tasks);
    });

    const reportsQuery = query(collection(db, "reports"), where('date', '==', date), where('shiftKey', '==', shiftKey), where('status', '==', 'submitted'));
    const unsubscribeReports = onSnapshot(reportsQuery, (querySnapshot) => {
      if (isMounted) {
        const fetchedReports: ShiftReport[] = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          submittedAt: (doc.data().submittedAt as Timestamp)?.toDate().toISOString(),
        } as ShiftReport));

        setReports(fetchedReports);

        if (selectedReportId && !fetchedReports.some(r => r.id === selectedReportId)) {
          setSelectedReportId(fetchedReports.length > 0 ? fetchedReports[0].id : null);
        } else if (!selectedReportId && fetchedReports.length > 0) {
          setSelectedReportId(fetchedReports[0].id);
        } else if (fetchedReports.length === 0) {
          setSelectedReportId(null);
        }
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribeTasks();
      unsubscribeReports();
    };
  }, [date, selectedReportId, refreshTrigger]);

  useDataRefresher(handleDataRefresh);

  const report = useMemo(() => {
    return reports.find(r => r.id === selectedReportId) || null;
  }, [reports, selectedReportId]);

  const allPagePhotos = useMemo(() => {
    if (!taskSections || !report) return [];

    const findTaskText = (taskId: string): string => {
      for (const section of taskSections) {
        const task = section.tasks.find(t => t.id === taskId);
        if (task) return task.text;
      }
      return "Nhiệm vụ không xác định";
    };

    const photos: { src: string, description: string }[] = [];
    for (const taskId in report.completedTasks) {
      const taskText = findTaskText(taskId);
      const completions = report.completedTasks[taskId] as CompletionRecord[];
      for (const completion of completions) {
        if (completion.photos) {
          for (const photoUrl of completion.photos) {
            photos.push({
              src: photoUrl,
              description: `${taskText}\nThực hiện lúc: ${completion.timestamp}`
            });
          }
        }
      }
    }
    return photos;
  }, [taskSections, report]);

  const handleDeleteReport = async () => {
    if (!report) return;
    setIsProcessing(true);
    const reportNameToDelete = report.staffName;
    try {
      await dataStore.deleteShiftReport(report.id);
      showToast({
        title: "Đã xóa báo cáo",
        message: `Báo cáo của ${reportNameToDelete} đã được xóa thành công.`,
        type: 'success',
      });
    } catch (error) {
      console.error("Error deleting report:", error);
      showToast({
        title: "Lỗi",
        message: "Không thể xóa báo cáo. Vui lòng thử lại.",
        type: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  }

  if (isLoading || authLoading) {
    return <LoadingPage />;
  }

  if (!date || reports.length === 0) {
    return (
      <div className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8">
        <h1 className="text-2xl font-bold">Không tìm thấy báo cáo.</h1>
        <p className="text-muted-foreground">Không có báo cáo nào được nộp vào ngày đã chọn.</p>
      </div>
    );
  }

  if (!taskSections) {
    return (
      <div className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8">
        <h1 className="text-2xl font-bold">Lỗi dữ liệu công việc.</h1>
        <p className="text-muted-foreground">Không thể tải cấu trúc công việc cho báo cáo này.</p>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8">
        <header className="mb-8">
          <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold font-headline">Phiếu kiểm tra toàn diện</h1>
              <p className="text-muted-foreground">
                Ngày {new Date(date).toLocaleDateString('vi-VN')}
              </p>
            </div>
            <Card className="w-full md:w-auto md:min-w-[250px]">
              <CardHeader className="p-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2"><Users className="h-4 w-4" />Chọn Quản lý</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="flex items-center gap-2">
                  <Combobox
                    value={selectedReportId || ''}
                    onChange={(val) => setSelectedReportId(val as string)}
                    options={reports.map(r => ({ value: r.id, label: r.staffName }))}
                    placeholder="Chọn một quản lý..."
                    compact
                    searchable={false}
                    disabled={isProcessing}
                    className="w-full"
                  />
                  {selectedReportId && (
                    <AlertDialog dialogTag="alert-dialog" parentDialogTag="root" variant="destructive">
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon" disabled={isProcessing}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogIcon icon={Trash2} />
                          <div className="space-y-2 text-center sm:text-left">
                            <AlertDialogTitle>Xác nhận xóa báo cáo?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Hành động này sẽ xóa vĩnh viễn báo cáo của <span className="font-bold">{report?.staffName}</span> và tất cả hình ảnh liên quan. Không thể hoàn tác.
                            </AlertDialogDescription>
                          </div>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Hủy</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteReport}>Xóa vĩnh viễn</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </header>

        {!report ? (
          <div className="text-center py-16 text-muted-foreground">
            <p>Vui lòng chọn một quản lý để xem báo cáo.</p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="mb-6">
              <p className="text-sm text-muted-foreground">
                Báo cáo từ <span className="font-semibold text-foreground">{report.staffName}</span>, nộp lúc <span className="font-semibold text-foreground">{new Date(report.submittedAt as string).toLocaleString('vi-VN', { hour12: false })}</span>.
              </p>
            </div>

            <div className="space-y-6">
              {taskSections.map((section) => (
                <SectionReportViewer
                  key={section.title}
                  section={section}
                  report={report}
                  allPagePhotos={allPagePhotos}
                />
              ))}
            </div>

            {report.issues && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl"><MessageSquareWarning /> Ghi chú chung</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-[14px] leading-relaxed italic bg-amber-50/50 dark:bg-amber-500/10 p-4 rounded-xl border border-amber-200/50 dark:border-amber-500/20">"{report.issues}"</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default function ComprehensiveReportPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <ComprehensiveReportView />
    </Suspense>
  )
}
