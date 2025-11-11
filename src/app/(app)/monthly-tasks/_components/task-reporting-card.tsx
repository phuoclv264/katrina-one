
'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, Video, CheckCircle, Loader2, User, Clock } from 'lucide-react';
import type { MonthlyTaskAssignment, MediaItem, MediaAttachment, TaskCompletionRecord, AssignedUser } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { toast } from 'react-hot-toast';
import CameraDialog from '@/components/camera-dialog';
import Image from 'next/image';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import LightboxVideo from "yet-another-react-lightbox/plugins/video";
import { useAuth } from '@/hooks/use-auth';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';

type TaskReportingCardProps = {
  assignment: MonthlyTaskAssignment;
};

export default function TaskReportingCard({ assignment }: TaskReportingCardProps) {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const { user } = useAuth();
  const [captureMode, setCaptureMode] = useState<'photo' | 'video'>('photo');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Back button handling for Lightbox
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (isLightboxOpen) {
        event.preventDefault();
        setIsLightboxOpen(false);
      }
    };

    if (isLightboxOpen) {
      window.history.pushState({ lightbox: 'open' }, '');
      window.addEventListener('popstate', handlePopState);
    } else {
      // This check is to avoid going back a page if the dialog was closed by other means.
      if (window.history.state?.lightbox) {
        window.history.back();
      }
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, [isLightboxOpen]);


  const handleOpenMediaDialog = (mode: 'photo' | 'video') => {
    setCaptureMode(mode);
    setIsCameraOpen(true);
  };

  const handleMediaSubmit = async (media: MediaItem[]) => {
    if (media.length === 0) return;
    setIsSubmitting(true);
    if (!user) return;
    try {
      await dataStore.updateMonthlyTaskCompletionStatus(
        assignment.taskId,
        assignment.taskName,
        { userId: user.uid, userName: user.displayName },
        new Date(assignment.assignedDate),
        true,
        media,
      );
      toast.success(`Đã báo cáo hoàn thành công việc: "${assignment.taskName}"`);
    } catch (error) {
      console.error("Failed to report task completion:", error);
      toast.error("Không thể báo cáo hoàn thành công việc.");
    } finally {
      setIsSubmitting(false);
      setIsCameraOpen(false);
    }
  };

  const openLightbox = (media: MediaAttachment[], index: number) => {
    setLightboxSlides(createLightboxSlides(media));
    setLightboxIndex(index);
    setIsLightboxOpen(true);
  };

  const createLightboxSlides = (media: MediaAttachment[]) => media.map(att => {
    if (att.type === 'video') {
      return {
        type: 'video' as const,
        sources: [
          { src: att.url, type: 'video/mp4' },
        ],
      };
    }
    return { src: att.url };
  });

  const [lightboxSlides, setLightboxSlides] = useState(createLightboxSlides([]));

  const currentUserCompletion = assignment.completions.find(c => c.completedBy?.userId === user?.uid);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{assignment.taskName}</CardTitle>
          <CardDescription>
            Công việc ngày: {assignment.assignedDate}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Trạng thái hoàn thành</h4>
            <ul className="space-y-3">
              {assignment.responsibleUsers.map(responsibleUser => {
                const completion = assignment.completions.find(c => c.completedBy?.userId === responsibleUser.userId);
                return (
                  <li key={responsibleUser.userId} className="flex flex-col gap-2 p-2 rounded-md bg-muted/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-medium">
                        <User className="h-4 w-4" />
                        <span>{responsibleUser.userName}</span>
                      </div>
                      {completion ? (
                        <div className="flex items-center gap-2 text-green-600 text-xs">
                          <CheckCircle className="h-4 w-4" />
                          <span>Hoàn thành</span>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">Chưa xong</div>
                      )}
                    </div>
                    {completion && (
                      <div className="pl-6 space-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{format(completion.completedAt!.toDate(), 'HH:mm dd/MM/yyyy')}</span>
                        </div>
                        {completion.media && completion.media.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {completion.media.map((att, index) => (
                              <button key={index} onClick={() => openLightbox(completion.media!, index)} className="relative w-16 h-16 rounded-md overflow-hidden group">
                                {att.type === 'photo' ? (
                                  <Image src={att.url} alt={`Bằng chứng ${index + 1}`} fill className="object-cover transition-transform duration-200 group-hover:scale-105" />
                                ) : (
                                  <video src={att.url} className="object-cover h-full w-full transition-transform duration-200 group-hover:scale-105" muted playsInline />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <Separator />

            {currentUserCompletion ? (
              <div className="space-y-2 text-center">
                <p className="text-sm font-medium text-green-600">Bạn đã báo cáo hoàn thành công việc này.</p>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Button variant="outline" size="sm" onClick={() => handleOpenMediaDialog('photo')} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Camera className="mr-2 h-4 w-4" />}
                    Thêm ảnh
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleOpenMediaDialog('video')} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Video className="mr-2 h-4 w-4" />}
                    Thêm video
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={() => handleOpenMediaDialog('photo')} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Camera className="mr-2 h-4 w-4" />}
                  Chụp ảnh
                </Button>
                <Button onClick={() => handleOpenMediaDialog('video')} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Video className="mr-2 h-4 w-4" />}
                  Quay video
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <CameraDialog
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onSubmit={handleMediaSubmit}
        captureMode={captureMode}
        isHD={true}
      />

      <Lightbox
        open={isLightboxOpen}
        close={() => setIsLightboxOpen(false)}
        slides={lightboxSlides}
        index={lightboxIndex}
        plugins={[LightboxVideo]}
      />
    </>
  );
}
