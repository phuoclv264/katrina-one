'use client';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import { useAuth } from '@/hooks/use-auth';
import { useAppRouter } from '@/hooks/use-app-router';import { reportsStore } from '@/lib/reports-store';
import { dataStore } from '@/lib/data-store';
import type { WhistleblowingReport, ManagedUser, AssignedUser, CommentMedia } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { Plus, FileSignature, FileWarning } from 'lucide-react';
import { toast } from 'react-hot-toast';

import ReportCard from './_components/report-card';
import ReportDialog from './_components/report-dialog';
import MySentReportsDialog from './_components/my-sent-reports-dialog';

export default function ReportsFeedPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useAppRouter();
  const reportRefs = useRef(new Map<string, HTMLDivElement | null>());

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const handleDataRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const [reports, setReports] = useState<WhistleblowingReport[]>([]);
  const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isMyReportsDialogOpen, setIsMyReportsDialogOpen] = useState(false);
  const [reportToEdit, setReportToEdit] = useState<WhistleblowingReport | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      let reportsLoaded = false;
      let usersLoaded = false;

      const checkLoadingDone = () => {
        if (reportsLoaded && usersLoaded) {
          setIsLoading(false);
        }
      };

      const unsubReports = reportsStore.subscribeToReports((data) => {
        setReports(data);
        reportsLoaded = true;
        checkLoadingDone();
      });
      const unsubUsers = dataStore.subscribeToUsers((data) => {
        setAllUsers(data);
        usersLoaded = true;
        checkLoadingDone();
      });

      return () => {
        unsubReports();
        unsubUsers();
      };
    }
  }, [user, refreshTrigger]);

  useDataRefresher(handleDataRefresh);

  const filteredAndSortedReports = useMemo(() => {
    if (!user) return [];
    
    let reportsToDisplay = reports;
    if (user.role !== 'Chủ nhà hàng') {
        reportsToDisplay = reports.filter(report =>
            report.visibility === 'public' || report.reporterId === user.uid
        );
    }
    
    // Sort so pinned items are always on top, then by date
    return reportsToDisplay.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime();
    });
  }, [reports, user]);
  
  const handleEditReport = (report: WhistleblowingReport) => {
    setReportToEdit(report);
    setIsReportDialogOpen(true);
  };

  const handleSaveReport = async (data: any, id?: string) => {
    if (!user) return;
    
    try {
        if (id) {
            // Update existing report
            await reportsStore.updateReport(id, data);
            toast.success('Đã cập nhật bài đăng.');
        } else {
            // Create new report
             const reportData = {
                ...data,
                reporterId: user.uid,
            };
            await reportsStore.createReport(reportData);
            toast.success('Đã gửi bài tố cáo thành công.');
        }
        setIsReportDialogOpen(false);
        setReportToEdit(null);
    } catch (error) {
      console.error("Failed to save report:", error);
      toast.error('Không thể lưu bài đăng.');
    }
  };

  const handleVote = async (reportId: string, voteType: 'up' | 'down') => {
      if (!user) return;
      try {
        await reportsStore.vote(reportId, user.uid, voteType);
      } catch (error) {
        console.error("Vote failed:", error);
        toast.error("Thao tác thất bại.");
      }
  };
  
  const handleDelete = async (reportId: string) => {
      if (!user) return;
      if (user.role !== 'Chủ nhà hàng' && reports.find(r => r.id === reportId)?.reporterId !== user.uid) {
          toast.error("Bạn không có quyền xóa bài đăng này.");
          return;
      }
      try {
        await reportsStore.deleteReport(reportId);
        toast.success("Đã xóa bài tố cáo.");
      } catch (error) {
        console.error("Delete failed:", error);
        toast.error("Không thể xóa bài tố cáo.");
      }
  };

  const handleTogglePin = async (reportId: string, currentPinStatus: boolean) => {
    if (user?.role !== 'Chủ nhà hàng') return;
    try {
        await reportsStore.togglePin(reportId, currentPinStatus);
        toast.success(currentPinStatus ? 'Đã bỏ ghim bài đăng.' : 'Đã ghim bài đăng.');
    } catch (error) {
        console.error("Failed to toggle pin status:", error);
        toast.error('Thao tác thất bại.');
    }
  };

  const handleCommentSubmit = async (reportId: string, commentText: string, medias: CommentMedia[], isAnonymous: boolean) => {
    if (!user) return;
    
    const commentData = {
        authorId: user.uid,
        isAnonymous: isAnonymous,
        content: commentText,
    };
    await reportsStore.addComment(reportId, commentData, medias);
  };
  
  const handleCommentEdit = async (violationId: string, commentId: string, newText: string) => {
      await reportsStore.editComment(violationId, commentId, newText);
  };

  const handleCommentDelete = async (violationId: string, commentId: string) => {
      await reportsStore.deleteComment(violationId, commentId);
  };
  
  const handleViewReport = (reportId: string) => {
    setIsMyReportsDialogOpen(false);
    setTimeout(() => {
      const element = reportRefs.current.get(reportId);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (element) {
        element.classList.add('ring-2', 'ring-primary', 'transition-all', 'duration-1000');
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-primary');
        }, 2000);
      }
    }, 100);
  };


  if (isLoading || authLoading || !user) {
    return <LoadingPage />;
  }

  return (
    <>
      <div className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8">
        <header className="mb-8 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
                <h1 className="text-3xl font-bold font-headline">Kênh Tố Cáo</h1>
                <p className="text-muted-foreground mt-2">
                    Nơi để chia sẻ các vấn đề một cách an toàn và bảo mật.
                </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button onClick={() => setIsMyReportsDialogOpen(true)} variant="outline" className="w-full sm:w-auto">
                  <FileSignature className="mr-2 h-4 w-4" /> Bài đăng của tôi
              </Button>
              <Button onClick={() => { setReportToEdit(null); setIsReportDialogOpen(true); }} className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" /> Tạo bài tố cáo mới
              </Button>
            </div>
        </header>

        {filteredAndSortedReports.length > 0 ? (
            <div className="space-y-6">
            {filteredAndSortedReports.map(report => {
                const setReportRef = (el: HTMLDivElement | null) => {
                    if (el) {
                        reportRefs.current.set(report.id, el);
                    } else {
                        reportRefs.current.delete(report.id);
                    }
                };
                return (
                    <div key={report.id} ref={setReportRef}>
                        <ReportCard report={report} currentUser={user} allUsers={allUsers} onVote={handleVote} onDelete={handleDelete} onTogglePin={handleTogglePin} onCommentSubmit={handleCommentSubmit} onCommentEdit={handleCommentEdit} onCommentDelete={handleCommentDelete} onEdit={handleEditReport} />
                    </div>
                );
            })}
            </div>
        ) : (
             <div className="text-center py-24 px-4 border-2 border-dashed rounded-xl flex flex-col items-center justify-center">
                <FileWarning className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-xl font-semibold">Chưa có bài đăng nào</h3>
                <p className="mt-2 max-w-xs text-center text-muted-foreground">
                    Hãy là người đầu tiên tạo một bài đăng để chia sẻ vấn đề của bạn.
                </p>
                <Button onClick={() => { setReportToEdit(null); setIsReportDialogOpen(true); }} className="mt-6">
                  <Plus className="mr-2 h-4 w-4" /> Tạo bài tố cáo mới
              </Button>
             </div>
        )}
      </div>

      <ReportDialog
        isOpen={isReportDialogOpen}
        onClose={() => setIsReportDialogOpen(false)}
        onSave={handleSaveReport}
        allUsers={allUsers}
        reportToEdit={reportToEdit}
        currentUserName={user.displayName}
        currentUserRole={user.role}
      />
      <MySentReportsDialog
        isOpen={isMyReportsDialogOpen}
        onClose={() => setIsMyReportsDialogOpen(false)}
        reports={reports}
        userId={user.uid}
        onViewReport={handleViewReport}
      />
    </>
  );
}
