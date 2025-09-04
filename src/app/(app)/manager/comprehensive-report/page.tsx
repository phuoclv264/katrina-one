
'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import type { ShiftReport, CompletionRecord, ComprehensiveTaskSection, ComprehensiveTask } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Camera, Send, ArrowLeft, Clock, X, Trash2, AlertCircle, Loader2, CheckCircle, WifiOff, CloudDownload, UploadCloud, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, Check, Building, MessageSquare } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import CameraDialog from '@/components/camera-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import ShiftNotesCard from '@/components/shift-notes-card';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/plugins/counter.css";
import Captions from "yet-another-react-lightbox/plugins/captions";
import "yet-another-react-lightbox/plugins/captions.css";

type SyncStatus = 'checking' | 'synced' | 'local-newer' | 'server-newer' | 'error';

export default function ComprehensiveReportPage() {
  const { toast } = useToast();
  const { user, loading: isAuthLoading } = useAuth();
  const router = useRouter();
  const shiftKey = 'manager_comprehensive';
  
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('checking');
  const [showSyncDialog, setShowSyncDialog] = useState(false);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  
  const [tasks, setTasks] = useState<ComprehensiveTaskSection[] | null>(null);

  const [openAccordionItems, setOpenAccordionItems] = useState<string[]>([]);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    if (tasks) {
      setOpenAccordionItems(tasks.map(section => section.title));
    }
  }, [tasks]);

  useEffect(() => {
    if (!isAuthLoading && (!user || (user.role !== 'Quản lý' && user.role !== 'Chủ nhà hàng'))) {
      router.replace('/');
    }
  }, [isAuthLoading, user, router]);

  useEffect(() => {
    let isMounted = true;
    const unsubscribeTasks = dataStore.subscribeToComprehensiveTasks((managerTasks) => {
      if(isMounted) setTasks(managerTasks);
    });
    return () => {
      isMounted = false;
      unsubscribeTasks();
    }
  }, []);

  useEffect(() => {
    if (isAuthLoading || !user) return;
    let isMounted = true;
    
    const loadReport = async () => {
        setIsLoading(true);
        setSyncStatus('checking');
        try {
            const { report: loadedReport, status } = await dataStore.getOrCreateReport(user.uid, user.displayName || 'Quản lý', shiftKey);
            if(isMounted) {
              setReport(loadedReport);
              setSyncStatus(status);
              if (status === 'local-newer' || status === 'server-newer') {
                  setShowSyncDialog(true);
              }
            }
        } catch (error) {
            console.error("Error loading comprehensive report:", error);
            if(isMounted) {
              setSyncStatus('error');
              toast({
                  title: "Lỗi tải dữ liệu",
                  description: "Không thể tải báo cáo. Đang chuyển hướng bạn về trang tổng quan.",
                  variant: "destructive"
              });
              router.replace('/manager');
            }
        } finally {
            if(isMounted) setIsLoading(false);
        }
    };

    loadReport();
    return () => { isMounted = false; }
  }, [isAuthLoading, user, shiftKey, toast, router]);

  const allPagePhotos = useMemo(() => {
    if (!tasks || !report) return [];

    const findTaskText = (taskId: string): string => {
        for (const section of tasks) {
            const task = section.tasks.find(t => t.id === taskId);
            if (task) return task.text;
        }
        return "Nhiệm vụ không xác định";
    };

    const photos = [];
    for (const taskId in report.completedTasks) {
        const task = findTaskText(taskId);
        const completions = report.completedTasks[taskId] as CompletionRecord[];
        for (const completion of completions) {
            if (completion.photos) {
              for (const photoUrl of completion.photos) {
                  photos.push({
                      src: photoUrl,
                      description: `${task}\nThực hiện lúc: ${completion.timestamp}`
                  });
              }
            }
        }
    }
    return photos;
  }, [tasks, report]);

  const updateLocalReport = useCallback(async (updatedReport: ShiftReport) => {
      setReport(updatedReport);
      if (dataStore.isReportEmpty(updatedReport)) {
        await dataStore.deleteLocalReport(updatedReport.id);
        setSyncStatus('synced');
      } else {
        await dataStore.saveLocalReport(updatedReport);
        setSyncStatus('local-newer');
      }
  }, []);

  const handlePhotoTaskAction = (taskId: string) => {
    setActiveTaskId(taskId);
    setIsCameraOpen(true);
  };
  
  const handleBooleanTaskAction = async (taskId: string, value: boolean) => {
    if (!report) return;

    const newReport = JSON.parse(JSON.stringify(report));
    let taskCompletions = (newReport.completedTasks[taskId] as CompletionRecord[]) || [];
    const now = new Date();
    const formattedTime = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    
    const newCompletion: CompletionRecord = {
      timestamp: formattedTime,
      photos: [],
      value: value,
    };

    taskCompletions.unshift(newCompletion);
    newReport.completedTasks[taskId] = taskCompletions;
    await updateLocalReport(newReport);
  };
  
  // Placeholder for opinion task action
  const handleOpinionTaskAction = (taskId: string) => {
      // For now, it works like a boolean task.
      // We can implement a text input dialog later.
      handleBooleanTaskAction(taskId, true);
      toast({
          title: "Đã ghi nhận",
          description: "Vui lòng ghi chi tiết ý kiến của bạn vào phần Ghi chú ca ở cuối trang.",
      });
  }

  const handleCapturePhotos = useCallback(async (photosDataUris: string[]) => {
    if (!activeTaskId || !report) return;

    const newReport = JSON.parse(JSON.stringify(report));
    let taskCompletions = (newReport.completedTasks[activeTaskId] as CompletionRecord[]) || [];
    const now = new Date();
    const formattedTime = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    
    const newCompletion: CompletionRecord = {
        timestamp: formattedTime,
        photos: photosDataUris
    };

    taskCompletions.unshift(newCompletion);
    newReport.completedTasks[activeTaskId] = taskCompletions;
    await updateLocalReport(newReport);

    setIsCameraOpen(false);
    setActiveTaskId(null);
  }, [activeTaskId, report, updateLocalReport]);
  
  const handleDeleteCompletion = async (taskId: string, completionIndex: number) => {
      if (!report) return;
      
      const newReport = JSON.parse(JSON.stringify(report));
      const taskCompletions = newReport.completedTasks[taskId] as CompletionRecord[];

      taskCompletions.splice(completionIndex, 1);
      
      if (taskCompletions.length > 0) {
          newReport.completedTasks[taskId] = taskCompletions;
      } else {
          delete newReport.completedTasks[taskId];
      }
      
      await updateLocalReport(newReport);
  }
  
    const handleSubmitReport = async () => {
        if (!report) return;
        setIsSubmitting(true);
        setShowSyncDialog(false);
        toast({
            title: "Đang gửi báo cáo...",
            description: "Vui lòng đợi, quá trình này có thể mất vài phút.",
        });

        try {
            await dataStore.submitReport(report);
            setReport(prev => prev ? {...prev, status: 'submitted'} : null);
            setSyncStatus('synced');
            toast({
                title: "Gửi báo cáo thành công!",
                description: "Báo cáo của bạn đã được đồng bộ lên hệ thống.",
            });
        } catch (error) {
            console.error("Failed to submit report:", error);
            setSyncStatus('error');
            toast({
                variant: "destructive",
                title: "Gửi báo cáo thất bại",
                description: "Đã xảy ra lỗi khi gửi báo cáo của bạn. Vui lòng kiểm tra kết nối mạng và thử lại.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };
    
  const handleDownloadFromServer = async () => {
      if (!report) return;
      setIsSubmitting(true);
      setShowSyncDialog(false);
       toast({
            title: "Đang tải dữ liệu từ máy chủ...",
        });
      try {
        const serverReport = await dataStore.overwriteLocalReport(report.id);
        setReport(serverReport);
        setSyncStatus('synced');
         toast({
            title: "Tải thành công!",
            description: "Báo cáo đã được cập nhật với phiên bản mới nhất từ máy chủ.",
        });
      } catch (error) {
         console.error("Failed to download report:", error);
         setSyncStatus('error');
         toast({
            variant: "destructive",
            title: "Tải thất bại",
            description: "Không thể tải dữ liệu từ máy chủ. Vui lòng thử lại.",
        });
      } finally {
        setIsSubmitting(false);
      }
  }

  const toggleExpandTask = useCallback((taskId: string) => {
    setExpandedTaskIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  }, []);
    
  const handleCameraClose = useCallback(() => {
    setIsCameraOpen(false);
    setActiveTaskId(null);
  }, []);
  
  const openLightbox = (photoUrl: string) => {
    const photoIndex = allPagePhotos.findIndex(p => p.src === photoUrl);
    if (photoIndex > -1) {
        setLightboxIndex(photoIndex);
        setIsLightboxOpen(true);
    }
  };

  const isReadonly = isSubmitting;

  if (isAuthLoading || isLoading || !report || !tasks) {
      return (
        <div className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8">
            <header className="mb-8">
                <Skeleton className="h-8 w-48 mb-4" />
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-5 w-1/2 mt-2" />
            </header>
            <div className="space-y-8">
                <Skeleton className="h-96 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        </div>
    )
  }
  
  const getSyncBadge = () => {
    switch(syncStatus) {
        case 'synced':
            return <Badge variant="default"><CheckCircle className="mr-1.5 h-3 w-3"/>Đã đồng bộ</Badge>;
        case 'local-newer':
            return <Badge variant="secondary"><UploadCloud className="mr-1.5 h-3 w-3 text-blue-500"/>Có thay đổi chưa gửi</Badge>;
        case 'server-newer':
            return <Badge variant="secondary"><CloudDownload className="mr-1.5 h-3 w-3 text-green-500"/>Có bản mới trên máy chủ</Badge>;
        case 'checking':
            return <Badge variant="outline"><Loader2 className="mr-1.5 h-3 w-3 animate-spin"/>Đang kiểm tra</Badge>;
        case 'error':
             return <Badge variant="destructive"><WifiOff className="mr-1.5 h-3 w-3"/>Lỗi đồng bộ</Badge>;
        default:
            return null;
    }
  }

  const handleSaveNotes = (newIssues: string) => {
    if(!report) return;
    if (newIssues !== (report.issues || '')) {
      const newReport = { ...report, issues: newIssues || null };
      updateLocalReport(newReport);
    }
  }

  return (
    <>
    <div className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8 pb-32">
      <header className="mb-8">
         <div className="flex justify-between items-center mb-4">
            <Button asChild variant="ghost" className="-ml-4">
                <Link href="/manager">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Quay lại
                </Link>
            </Button>
            <div className="flex items-center gap-2">
                 {getSyncBadge()}
            </div>
        </div>
        <div className="flex justify-between items-start">
            <div>
                 <h1 className="text-2xl md:text-3xl font-bold font-headline">Phiếu kiểm tra toàn diện</h1>
                 <p className="text-muted-foreground">Thực hiện và ghi nhận các công việc kiểm tra trong ngày.</p>
            </div>
        </div>
      </header>

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Danh sách kiểm tra</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" value={openAccordionItems} onValueChange={setOpenAccordionItems} className="w-full space-y-4">
              {tasks.map((section) => (
                <AccordionItem value={section.title} key={section.title} className="border rounded-lg bg-card">
                  <AccordionTrigger className="text-lg font-bold p-4 hover:no-underline">
                     <div className="flex items-center">
                        <Building className="mr-3 h-5 w-5 text-primary" />
                        {section.title}
                     </div>
                  </AccordionTrigger>
                  <AccordionContent className="border-t p-4">
                    <div className="space-y-4 pt-2">
                      {section.tasks.map((task) => {
                        const completions = (report.completedTasks[task.id] || []) as CompletionRecord[];
                        const isTaskCompleted = completions.length > 0;
                        const isExpanded = expandedTaskIds.has(task.id);

                        return (
                           <div key={task.id} className={`rounded-md border p-4 transition-colors ${isTaskCompleted ? 'bg-accent/20' : ''}`}>
                            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                              <p className="font-semibold flex-1">
                                {task.text}
                              </p>
                              <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
                                {task.type === 'photo' && (
                                  <Button 
                                    size="sm" 
                                    className="w-full active:scale-95 transition-transform"
                                    onClick={() => handlePhotoTaskAction(task.id)}
                                    disabled={isReadonly}
                                  >
                                      <Camera className="mr-2 h-4 w-4"/>
                                      Chụp ảnh
                                  </Button>
                                )}
                                {task.type === 'boolean' && (
                                    <>
                                        <Button
                                            size="sm"
                                            variant={"outline"}
                                            className="w-full"
                                            onClick={() => handleBooleanTaskAction(task.id, true)}
                                            disabled={isReadonly}
                                        >
                                            <ThumbsUp className="mr-2 h-4 w-4"/> Có
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant={"outline"}
                                            className="w-full"
                                            onClick={() => handleBooleanTaskAction(task.id, false)}
                                            disabled={isReadonly}
                                        >
                                            <ThumbsDown className="mr-2 h-4 w-4"/> Không
                                        </Button>
                                    </>
                                )}
                                {task.type === 'opinion' && (
                                    <Button
                                        size="sm"
                                        className="w-full"
                                        onClick={() => handleOpinionTaskAction(task.id)}
                                        disabled={isReadonly}
                                    >
                                        <MessageSquare className="mr-2 h-4 w-4"/> Ghi nhận
                                    </Button>
                                )}
                              </div>
                            </div>
                            
                            {isTaskCompleted && (
                                <div className="mt-4 space-y-3">
                                  {(isExpanded ? completions : completions.slice(0, 1)).map((completion, cIndex) => (
                                      <div key={cIndex} className="rounded-md border bg-card p-3">
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Clock className="h-4 w-4 flex-shrink-0" />
                                            <span>Kiểm tra lúc: {completion.timestamp}</span>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            {completion.value !== undefined && (
                                              <Badge variant={completion.value ? "default" : "destructive"}>
                                                {completion.value ? "Đảm bảo" : "Không đảm bảo"}
                                              </Badge>
                                            )}
                                            {!isReadonly && (
                                              <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                  <Button size="icon" variant="ghost" className="text-destructive h-7 w-7">
                                                    <Trash2 className="h-4 w-4" />
                                                  </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                  <AlertDialogHeader>
                                                    <AlertDialogTitle>Bạn có chắc không?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                      Hành động này sẽ xóa lần kiểm tra này.
                                                    </AlertDialogDescription>
                                                  </AlertDialogHeader>
                                                  <AlertDialogFooter>
                                                    <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteCompletion(task.id, cIndex)}>Xóa</AlertDialogAction>
                                                  </AlertDialogFooter>
                                                </AlertDialogContent>
                                              </AlertDialog>
                                            )}
                                          </div>
                                        </div>
                                        {completion.photos && completion.photos.length > 0 && (
                                          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                                            {completion.photos.map((photo, pIndex) => (
                                              <div key={photo.slice(0, 50) + pIndex} className="relative z-0 overflow-hidden aspect-square rounded-md group bg-muted">
                                                <button
                                                  onClick={() => openLightbox(photo)}
                                                  className="w-full h-full block"
                                                >
                                                  <Image src={photo} alt={`Ảnh bằng chứng ${pIndex + 1}`} fill className={`object-cover`} />
                                                </button>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                    {completions.length > 1 && (
                                      <Button variant="link" size="sm" onClick={() => toggleExpandTask(task.id)} className="w-full text-muted-foreground">
                                        {isExpanded ? 'Thu gọn' : `Xem thêm (${completions.length - 1} lần)`}
                                        {isExpanded ? <ChevronUp className="ml-1.5 h-4 w-4" /> : <ChevronDown className="ml-1.5 h-4 w-4" />}
                                      </Button>
                                    )}
                                </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        <ShiftNotesCard
          initialIssues={report.issues || ''}
          onSave={handleSaveNotes}
          disabled={isReadonly}
        />
      </div>
    </div>
    
    <div className="fixed bottom-4 right-4 z-50 md:bottom-6 md:right-6">
      <div className="relative">
        <Button 
            size="icon"
            className="rounded-full shadow-lg h-14 w-14 md:h-16 md:w-16" 
            onClick={handleSubmitReport} 
            disabled={isReadonly || syncStatus === 'server-newer'}
            aria-label="Gửi báo cáo"
        >
            {isSubmitting ? <Loader2 className="h-5 w-5 md:h-6 md:w-6 animate-spin" /> : <Send className="h-5 w-5 md:h-6 md:w-6" />}
        </Button>
        {syncStatus === 'local-newer' && (
          <span className="absolute top-0 right-0 block h-3 w-3 rounded-full bg-red-500 ring-2 ring-background" />
        )}
      </div>
    </div>

    <CameraDialog 
        isOpen={isCameraOpen}
        onClose={handleCameraClose}
        onSubmit={handleCapturePhotos}
        initialPhotos={[]}
    />
    
    <AlertDialog open={showSyncDialog && !isSubmitting} onOpenChange={setShowSyncDialog}>
      <AlertDialogContent>
        {syncStatus === 'local-newer' && (
            <>
                <AlertDialogHeader>
                    <AlertDialogTitle>Bạn có thay đổi chưa được gửi</AlertDialogTitle>
                    <AlertDialogDescription>
                        Chúng tôi phát hiện bạn có những công việc đã hoàn thành nhưng chưa được gửi đi. Bạn có muốn gửi báo cáo bổ sung ngay bây giờ không?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Để sau</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSubmitReport}>Gửi ngay</AlertDialogAction>
                </AlertDialogFooter>
            </>
        )}
         {syncStatus === 'server-newer' && (
            <>
                <AlertDialogHeader>
                    <AlertDialogTitle>Có phiên bản mới trên máy chủ</AlertDialogTitle>
                    <AlertDialogDescription>
                       Một phiên bản mới hơn của báo cáo này có sẵn trên máy chủ. Bạn nên tải nó về để đảm bảo dữ liệu được nhất quán. Việc này sẽ ghi đè lên các thay đổi cục bộ chưa được lưu của bạn.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Để sau</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDownloadFromServer}>Tải về ngay</AlertDialogAction>
                </AlertDialogFooter>
            </>
        )}
      </AlertDialogContent>
    </AlertDialog>

    <Lightbox
        open={isLightboxOpen}
        close={() => setIsLightboxOpen(false)}
        slides={allPagePhotos}
        index={lightboxIndex}
        plugins={[Zoom, Counter, Captions]}
        zoom={{ maxZoomPixelRatio: 4 }}
        counter={{ container: { style: { top: "unset", bottom: 0 } } }}
        captions={{ 
            showToggle: true, 
            descriptionTextAlign: 'center',
            descriptionMaxLines: 5
        }}
    />
    </>
  );
}

    