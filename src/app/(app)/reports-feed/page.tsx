'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { reportsStore } from '@/lib/reports-store';
import { dataStore } from '@/lib/data-store';
import type { WhistleblowingReport, ManagedUser, AssignedUser } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, FileSignature } from 'lucide-react';
import { toast } from 'react-hot-toast';

import ReportCard from './_components/report-card';
import ReportDialog from './_components/report-dialog';
import MySentReportsDialog from './_components/my-sent-reports-dialog';

export default function ReportsFeedPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [reports, setReports] = useState<WhistleblowingReport[]>([]);
  const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isMyReportsDialogOpen, setIsMyReportsDialogOpen] = useState(false);

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
  }, [user]);

  const filteredReports = useMemo(() => {
    if (!user) return [];
    if (user.role === 'Chủ nhà hàng') {
      return reports;
    }
    return reports.filter(report =>
      report.visibility === 'public' || report.reporterId === user.uid
    );
  }, [reports, user]);

  const handleSaveReport = async (data: any) => {
    if (!user) return;
    
    const accusedUsersForDb: AssignedUser[] = (data.accusedUsers || []).map((u: ManagedUser) => ({ id: u.uid, name: u.displayName }));

    const reportData = {
      ...data,
      accusedUsers: accusedUsersForDb,
      reporterId: user.uid,
    };
    try {
      await reportsStore.createReport(reportData);
      toast.success('Đã gửi bài tố cáo thành công.');
      setIsReportDialogOpen(false);
    } catch (error) {
      console.error("Failed to save report:", error);
      toast.error('Không thể gửi bài tố cáo.');
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
      if (!user || user.role !== 'Chủ nhà hàng') return;
      try {
        await reportsStore.deleteReport(reportId);
        toast.success("Đã xóa bài tố cáo.");
      } catch (error) {
        console.error("Delete failed:", error);
        toast.error("Không thể xóa bài tố cáo.");
      }
  };

  const handleCommentSubmit = async (reportId: string, commentText: string, photoIds: string[], isAnonymous: boolean) => {
    if (!user) return;
    
    const commentData = {
        authorId: user.uid,
        isAnonymous: isAnonymous,
        content: commentText,
    };
    await reportsStore.addComment(reportId, commentData, photoIds);
};
  
  const handleCommentEdit = async (violationId: string, commentId: string, newText: string) => {
      await reportsStore.editComment(violationId, commentId, newText);
  };

  const handleCommentDelete = async (violationId: string, commentId: string) => {
      await reportsStore.deleteComment(violationId, commentId);
  };


  if (isLoading || authLoading || !user) {
    return (
      <div className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8">
        <header className="mb-8">
            <Skeleton className="h-10 w-1/2 mb-2" />
            <Skeleton className="h-4 w-1/3" />
        </header>
        <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
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
              <Button onClick={() => setIsReportDialogOpen(true)} className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" /> Tạo bài tố cáo mới
              </Button>
            </div>
        </header>

        {filteredReports.length > 0 ? (
            <div className="space-y-6">
            {filteredReports.map(report => (
                <ReportCard
                    key={report.id}
                    report={report}
                    currentUser={user}
                    allUsers={allUsers}
                    onVote={handleVote}
                    onDelete={handleDelete}
                    onCommentSubmit={handleCommentSubmit}
                    onCommentEdit={handleCommentEdit}
                    onCommentDelete={handleCommentDelete}
                />
            ))}
            </div>
        ) : (
             <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                <p>Chưa có bài tố cáo nào.</p>
             </div>
        )}
      </div>

      <ReportDialog
        isOpen={isReportDialogOpen}
        onClose={() => setIsReportDialogOpen(false)}
        onSave={handleSaveReport}
        allUsers={allUsers}
      />
      <MySentReportsDialog
        isOpen={isMyReportsDialogOpen}
        onClose={() => setIsMyReportsDialogOpen(false)}
        reports={reports}
        userId={user.uid}
      />
    </>
  );
}
