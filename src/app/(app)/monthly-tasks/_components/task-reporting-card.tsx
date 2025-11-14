
'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, Video, CheckCircle, Loader2, User, Clock, MessageSquareWarning, FilePlus2, Circle } from 'lucide-react';
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
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogHeader } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';

type TaskReportingCardProps = {
  assignment: MonthlyTaskAssignment;
};

export default function TaskReportingCard({ assignment }: TaskReportingCardProps) {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [noteContent, setNoteContent] = useState('');

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

  const handleNoteSubmit = async () => {
    if (!noteContent.trim() || !user) {
        toast.error("Vui lòng nhập nội dung báo cáo.");
        return;
    }
    setIsSubmitting(true);
    try {
        await dataStore.updateMonthlyTaskCompletionStatus(
            assignment.taskId,
            assignment.taskName,
            { userId: user.uid, userName: user.displayName },
            new Date(assignment.assignedDate),
            !!currentUserCompletion?.completedAt, // Keep current completion status
            [], // No new media when submitting a note
            noteContent
        );
        toast.success("Đã gửi báo cáo sự cố.");
        setIsNoteDialogOpen(false);
    } catch (error) {
        toast.error("Không thể gửi báo cáo sự cố.");
    } finally {
        setIsSubmitting(false);
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
          { src: att.url, type: 'video/webm' },
        ],
      };
    }
    return { src: att.url };
  });

  const [lightboxSlides, setLightboxSlides] = useState(createLightboxSlides([]));

  const currentUserCompletion = assignment.completions.find(c => c.completedBy?.userId === user?.uid) ||
                                  assignment.otherCompletions.find(c => c.completedBy?.userId === user?.uid);

  const renderMyStatus = () => {
    if (!currentUserCompletion) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Circle className="h-4 w-4" />
          <span>Bạn chưa thực hiện</span>
        </div>
      );
    }

    if (currentUserCompletion.completedAt) {
      return (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span>Bạn đã hoàn thành lúc {format(currentUserCompletion.completedAt.toDate(), 'HH:mm')}</span>
        </div>
      );
    }

    if (currentUserCompletion.note) {
      return (
        <div className="flex items-center gap-2 text-sm text-amber-600">
          <MessageSquareWarning className="h-4 w-4" />
          <span>Đã nộp báo cáo</span>
        </div>
      );
    }

    return null; // Should not be reached if logic is correct
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{assignment.taskName}</CardTitle>
          <CardDescription className="pt-1">
            {assignment.description}
          </CardDescription>
        </CardHeader>
        <div className="px-6 pb-4 border-b space-y-2">
          {renderMyStatus()}
          {currentUserCompletion?.note && (
            <Alert variant="default" className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 dark:bg-amber-900/30">
              <AlertDescription className="text-amber-700 dark:text-amber-400">{currentUserCompletion.note}</AlertDescription>
            </Alert>
          )}
          {currentUserCompletion?.media && currentUserCompletion.media.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Bằng chứng của bạn:</p>
              <div className="flex flex-wrap gap-2">
                {currentUserCompletion.media.map((att, index) => (
                  <button key={index} onClick={() => openLightbox(currentUserCompletion.media!, index)} className="relative w-16 h-16 rounded-md overflow-hidden group">
                    {att.type === 'photo' ? (
                      <Image src={att.url} alt={`Bằng chứng ${index + 1}`} fill className="object-cover transition-transform duration-200 group-hover:scale-105" />
                    ) : (
                      <video src={att.url} className="object-cover h-full w-full transition-transform duration-200 group-hover:scale-105" muted playsInline />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <CardContent>
          <div className="space-y-4">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>Trạng thái hoàn thành</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    {assignment.responsibleUsersByShift.map(({ shiftId, shiftLabel, users }) => (
                      <div key={shiftId}>
                        <h4 className="font-semibold text-sm mb-2">{shiftLabel}</h4>
                        <ul className="space-y-3 pl-2 border-l-2">
                          {users.map(responsibleUser => {
                            const completion = assignment.completions.find(c => c.completedBy?.userId === responsibleUser.userId);
                            return (
                              <li key={responsibleUser.userId} className="flex flex-col gap-2 p-2 rounded-md bg-muted/50">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 font-medium">
                                    <User className="h-4 w-4" />
                                    <span>{responsibleUser.userName}</span>
                                  </div>
                                  {completion?.completedAt ? (
                                    <div className="flex items-center gap-2 text-green-600 text-xs">
                                      <CheckCircle className="h-4 w-4" />
                                      <span>Hoàn thành</span>
                                    </div>
                                  ) : completion?.note ? (
                                    <div className="flex items-center gap-2 text-amber-600 text-xs">
                                      <MessageSquareWarning className="h-4 w-4" />
                                      <span>Có báo cáo</span>
                                    </div>
                                  ) :
                                    <div className="text-xs text-muted-foreground">Chưa xong</div>
                                  }
                                </div>
                                {completion && (
                                  <div className="pl-6 space-y-2">
                                    {completion.completedAt && (
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        <span>{format(completion.completedAt.toDate(), 'HH:mm dd/MM/yyyy')}</span>
                                      </div>
                                    )}
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
                                    {completion?.note && (
                                      <Alert variant="default" className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 dark:bg-amber-900/30">
                                        <AlertDescription className="text-amber-700 dark:text-amber-400">{completion.note}</AlertDescription>
                                      </Alert>
                                    )}
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}

                    {assignment.otherCompletions.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Báo cáo khác</h4>
                        <ul className="space-y-3 pl-2 border-l-2 border-dashed">
                          {assignment.otherCompletions.map(completion => (
                            <li key={completion.completedBy?.userId || 'unknown'} className="flex flex-col gap-2 p-2 rounded-md bg-muted/50">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 font-medium">
                                  <User className="h-4 w-4" />
                                  <span>{completion.completedBy?.userName || 'Không rõ'}</span>
                                </div>
                                {completion.completedAt ? (
                                  <div className="flex items-center gap-2 text-green-600 text-xs">
                                    <CheckCircle className="h-4 w-4" />
                                    <span>Hoàn thành</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 text-amber-600 text-xs">
                                    <MessageSquareWarning className="h-4 w-4" />
                                    <span>Có báo cáo</span>
                                  </div>
                                )}
                              </div>
                              <div className="pl-6 space-y-2">
                                {completion.completedAt && (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    <span>{format(completion.completedAt.toDate(), 'HH:mm dd/MM/yyyy')}</span>
                                  </div>
                                )}
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
                                {completion.note && (
                                  <Alert variant="default" className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 dark:bg-amber-900/30">
                                    <AlertDescription className="text-amber-700 dark:text-amber-400">{completion.note}</AlertDescription>
                                  </Alert>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Separator />

            {currentUserCompletion ? (
              <div className="space-y-2 text-center">
                <p className="text-sm font-medium text-green-600">Bạn đã báo cáo hoàn thành công việc này.</p>
                <div className="pt-2">
                  <Button variant="outline" size="sm" onClick={() => setIsCameraOpen(true)} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : <FilePlus2 className="mr-2 h-4 w-4" />}
                    Thêm bằng chứng
                  </Button>
                </div>
              </div>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="secondary" disabled={isSubmitting}>
                                <MessageSquareWarning className="mr-2 h-4 w-4" />
                                Báo cáo
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Báo cáo sự cố cho công việc</DialogTitle>
                                <DialogDescription>Nếu bạn không thể hoàn thành toàn bộ hoặc một phần công việc, vui lòng ghi rõ lý do để chủ quán xem xét.</DialogDescription>
                            </DialogHeader>
                            <Textarea
                                value={noteContent}
                                onChange={(e) => setNoteContent(e.target.value)}
                                placeholder="Ví dụ: Khách đông quá không kịp làm, có việc về sớm,..."
                                rows={4}
                            />
                            <DialogFooter>
                                <DialogClose asChild><Button variant="outline">Hủy</Button></DialogClose>
                                <Button onClick={handleNoteSubmit} disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Gửi báo cáo</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <Button onClick={() => setIsCameraOpen(true)} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4" />}
                        Hoàn thành
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
        captureMode={"both"}
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
