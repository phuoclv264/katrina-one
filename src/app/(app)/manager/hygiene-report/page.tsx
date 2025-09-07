
'use client';
import { useState, useEffect, useMemo, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Check, Camera, MessageSquareWarning, Clock, X, Droplets, UtensilsCrossed, Wind, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { ShiftReport, CompletionRecord, TaskSection } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/plugins/counter.css";
import Captions from "yet-another-react-lightbox/plugins/captions";
import "yet-another-react-lightbox/plugins/captions.css";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Calendar as CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"


function ManagerHygieneReportView() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  
  const getTodaysDateKey = () => {
    const now = new Date();
    const year = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric' });
    const month = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', month: '2-digit' });
    const day = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit' });
    return `${year}-${month}-${day}`;
  };

  const [date, setDate] = useState<Date | undefined>(new Date());
  const dateKey = date ? format(date, 'yyyy-MM-dd') : getTodaysDateKey();

  const [reports, setReports] = useState<ShiftReport[]>([]);
  const [taskSections, setTaskSections] = useState<TaskSection[] | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    if (!authLoading && (!user || (user.role !== 'Quản lý' && user.role !== 'Chủ nhà hàng'))) {
        router.replace('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    let isMounted = true;
    const unsubscribeTasks = dataStore.subscribeToBartenderTasks((tasks) => {
      if(isMounted) setTaskSections(tasks);
    });
    return () => { isMounted = false; unsubscribeTasks(); }
  }, []);

  useEffect(() => {
    if (!dateKey) return;
    setIsLoading(true);
    let isMounted = true;
    dataStore.getHygieneReportForDate(dateKey, 'bartender_hygiene').then(fetchedReports => {
        if(isMounted) {
            setReports(fetchedReports);
            if (fetchedReports.length > 0) {
                setSelectedReportId(fetchedReports[0].id);
            } else {
                setSelectedReportId(null);
            }
            setIsLoading(false);
        }
    }).catch(error => {
        console.error("Error fetching hygiene report for manager:", error);
        if(isMounted) {
            toast({ title: "Lỗi", description: "Không thể tải báo cáo.", variant: "destructive" });
            setIsLoading(false);
        }
    });

    return () => { isMounted = false; };
  }, [dateKey, toast]);


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
            for (const photoUrl of (completion.photos || [])) {
                photos.push({
                    src: photoUrl,
                    description: `${taskText}\nThực hiện lúc: ${completion.timestamp}`
                });
            }
        }
    }
    return photos;
  }, [taskSections, report]);

  const openLightbox = (photoUrl: string) => {
    const photoIndex = allPagePhotos.findIndex(p => p.src === photoUrl);
    if (photoIndex > -1) {
        setLightboxIndex(photoIndex);
        setIsLightboxOpen(true);
    }
  };

  const getSectionIcon = (title: string) => {
    switch(title) {
        case 'Vệ sinh khu vực pha chế': return <Droplets className="mr-3 h-5 w-5 text-blue-500" />;
        case 'Vệ sinh dụng cụ': return <UtensilsCrossed className="mr-3 h-5 w-5 text-green-500" />;
        case 'Vệ sinh thiết bị': return <Wind className="mr-3 h-5 w-5 text-purple-500" />;
        default: return null;
    }
  }

  const getSectionBorderColor = (title: string) => {
    switch(title) {
        case 'Vệ sinh khu vực pha chế': return 'border-blue-500/80';
        case 'Vệ sinh dụng cụ': return 'border-green-500/80';
        case 'Vệ sinh thiết bị': return 'border-purple-500/80';
        default: return 'border-border';
    }
  }

  if (authLoading || !taskSections) {
    return (
        <div className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8">
            <header className="mb-8">
                <Skeleton className="h-8 w-48 mb-4" />
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-5 w-1/2 mt-2" />
            </header>
            <div className="space-y-8">
                <Skeleton className="h-96 w-full" />
            </div>
        </div>
    )
  }


  return (
    <>
    <div className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8">
      <header className="mb-8">
        <Button asChild variant="ghost" className="mb-4 -ml-4">
            <Link href="/manager">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Quay lại
            </Link>
        </Button>
        <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold font-headline">Báo cáo Vệ sinh quầy</h1>
            </div>
             <Popover>
                <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                    "w-full md:w-[280px] justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Chọn ngày</span>}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                />
                </PopoverContent>
            </Popover>
        </div>
      </header>

    {isLoading ? (
         <div className="space-y-8">
            <Skeleton className="h-96 w-full" />
        </div>
    ) : reports.length === 0 ? (
         <Card>
            <CardHeader>
                <CardTitle>Không có báo cáo</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">Không tìm thấy báo cáo vệ sinh nào cho ngày đã chọn.</p>
            </CardContent>
        </Card>
    ) : (
      <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Kết quả kiểm tra</CardTitle>
               <CardDescription>
                <div className="flex items-center gap-4">
                     <span>Báo cáo ngày {format(date!, "dd/MM/yyyy")}</span>
                     <Select onValueChange={setSelectedReportId} value={selectedReportId || ''}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Chọn nhân viên..."/>
                        </SelectTrigger>
                        <SelectContent>
                            {reports.map(r => (
                                <SelectItem key={r.id} value={r.id}>{r.staffName}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                </CardDescription>
            </CardHeader>
            <CardContent>
                 {report ? (
                    <Accordion type="multiple" defaultValue={taskSections.map(s => s.title)} className="w-full space-y-4">
                    {taskSections.map((section) => (
                    <AccordionItem value={section.title} key={section.title} className={`rounded-lg border-[3px] bg-card ${getSectionBorderColor(section.title)}`}>
                        <AccordionTrigger className="text-lg font-bold p-4 hover:no-underline">
                        <div className="flex items-center">
                            {getSectionIcon(section.title)}
                            {section.title}
                        </div>
                        </AccordionTrigger>
                        <AccordionContent className="border-t p-4">
                        <div className="space-y-4 pt-2">
                            {section.tasks.map((task) => {
                            const completions = (report.completedTasks[task.id] || []) as CompletionRecord[];
                            const isCompleted = completions.length > 0;
                            
                            return (
                                <div key={task.id} className={`rounded-md border p-4 transition-colors ${isCompleted ? 'bg-accent/20' : ''}`}>
                                    <div className="flex items-start gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <div className={`flex h-5 w-5 items-center justify-center rounded-full flex-shrink-0 mt-0.5 ${isCompleted ? 'bg-green-500/20 text-green-700' : 'bg-muted'}`}>
                                                {isCompleted ? <Check className="h-4 w-4" /> : <X className="h-4 w-4 text-muted-foreground" />}
                                            </div>
                                            <p className={`font-semibold ${!isCompleted ? 'text-muted-foreground' : ''}`}>
                                                {task.text}
                                            </p>
                                        </div>
                                    </div>
                                    </div>
                                    
                                    {isCompleted && (
                                        <div className="mt-4 ml-8 space-y-3 pl-3 border-l-2">
                                        {completions.map((completion, cIndex) => (
                                        <div key={cIndex} className="rounded-md border bg-card p-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Clock className="h-4 w-4 flex-shrink-0" />
                                                    <span>Thực hiện lúc: {completion.timestamp}</span>
                                                </div>
                                            </div>
                                            {completion.photos && completion.photos.length > 0 ? (
                                                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                                                {completion.photos.map((photo, pIndex) => (
                                                    <button
                                                    onClick={() => openLightbox(photo)}
                                                    key={photo.slice(0, 50) + pIndex}
                                                    className="relative z-0 overflow-hidden aspect-square rounded-md group bg-muted"
                                                    >
                                                    <Image src={photo} alt={`Ảnh bằng chứng ${pIndex + 1}`} fill className="object-cover" />
                                                    </button>
                                                ))}
                                                </div>
                                            ): (
                                                <p className="text-xs text-muted-foreground italic">Không có ảnh nào được chụp cho lần thực hiện này.</p>
                                            )}
                                        </div>
                                        ))}
                                        </div>
                                    )}
                                </div>
                            );
                            })}
                        </div>
                        </AccordionContent>
                    </AccordionItem>
                    ))}
                </Accordion>
                 ) : (
                    <p className="text-muted-foreground text-center py-4">Vui lòng chọn một nhân viên để xem báo cáo.</p>
                 )}
            </CardContent>
          </Card>
      </div>
    )}
    </div>
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
            descriptionMaxLines: 5,
        }}
    />
    </>
  );
}

export default function ManagerHygieneReportPage() {
    return (
        <Suspense fallback={<Skeleton className="w-full h-screen" />}>
            <ManagerHygieneReportView />
        </Suspense>
    )
}

    