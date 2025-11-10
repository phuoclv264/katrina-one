
'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, Video, CheckCircle, Loader2 } from 'lucide-react';
import type { MonthlyTaskAssignment, MediaItem, MediaAttachment } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { toast } from 'react-hot-toast';
import CameraDialog from '@/components/camera-dialog';
import Image from 'next/image';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import LightboxVideo from "yet-another-react-lightbox/plugins/video";

type TaskReportingCardProps = {
  assignment: MonthlyTaskAssignment;
};

export default function TaskReportingCard({ assignment }: TaskReportingCardProps) {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
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


  const isCompleted = assignment.status === 'completed';

  const handleOpenMediaDialog = (mode: 'photo' | 'video') => {
    setCaptureMode(mode);
    setIsCameraOpen(true);
  };

  const handleMediaSubmit = async (media: MediaItem[]) => {
    if (media.length === 0) return;
    setIsSubmitting(true);
    try {
      await dataStore.updateMonthlyTaskAssignmentStatus(
        assignment.assignedDate.substring(0, 7), // YYYY-MM
        assignment.taskId,
        assignment.assignedDate,
        assignment.assignedTo.userId,
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

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setIsLightboxOpen(true);
  };

  const lightboxSlides = assignment.media?.map(att => {
    if (att.type === 'video') {
      console.log(att.url);
      return {
        type: 'video' as const,
        sources: [
          { src: att.url, type: 'video/mp4' },
          { src: att.url, type: 'video/webm' }
        ],
      };
    }
    return { src: att.url };
  }) || [];

  return (
    <>
      <Card className={isCompleted ? "bg-muted border-green-500/50" : "bg-card"}>
        <CardHeader>
          <CardTitle className="text-lg">{assignment.taskName}</CardTitle>
          <CardDescription>
            Được giao vào ngày: {assignment.assignedDate}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isCompleted ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-600 font-semibold">
                <CheckCircle className="h-5 w-5" />
                <span>Đã hoàn thành</span>
              </div>
              {assignment.media && assignment.media.length > 0 && (
                 <div className="flex flex-wrap gap-2">
                    {assignment.media.map((att, index) => (
                        <button key={index} onClick={() => openLightbox(index)} className="relative w-24 h-24 rounded-md overflow-hidden group">
                             {att.type === 'photo' ? (
                                <Image src={att.url} alt={`Bằng chứng ${index + 1}`} fill className="object-cover transition-transform duration-200 group-hover:scale-105" />
                            ) : (
                                <video src={att.url} className="object-cover h-full w-full transition-transform duration-200 group-hover:scale-105" muted playsInline />
                            )}
                        </button>
                    ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 pt-3">
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
