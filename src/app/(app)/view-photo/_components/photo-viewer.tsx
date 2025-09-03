
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ShiftReport, CompletionRecord } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { X, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel"
import { Skeleton } from '@/components/ui/skeleton';

export default function PhotoViewer() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const reportId = searchParams.get('reportId');
  const initialPhotoIndex = parseInt(searchParams.get('photoIndex') || '0', 10);
  
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>()
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (!reportId) {
      setIsLoading(false);
      return;
    }

    const fetchReport = async () => {
      setIsLoading(true);
      // Try fetching from localStorage first (for ongoing reports)
      const localReportString = localStorage.getItem(reportId);
      if (localReportString) {
        setReport(JSON.parse(localReportString));
        setIsLoading(false);
        return;
      }
      
      // If not in localStorage, fetch from Firestore (for submitted reports)
      try {
        const docRef = doc(db, 'reports', reportId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
           const data = docSnap.data();
           setReport({
                ...data,
                id: docSnap.id,
                startedAt: (data.startedAt as any)?.toDate ? (data.startedAt as any).toDate().toISOString() : data.startedAt,
                submittedAt: (data.submittedAt as any)?.toDate ? (data.submittedAt as any).toDate().toISOString() : data.submittedAt,
                lastUpdated: (data.lastUpdated as any)?.toDate ? (data.lastUpdated as any).toDate().toISOString() : data.lastUpdated,
            } as ShiftReport);
        } else {
          console.error("Report not found in Firestore");
          setReport(null);
        }
      } catch (error) {
        console.error("Error fetching report:", error);
        setReport(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReport();
  }, [reportId]);
  
  const allPhotos = useMemo(() => {
    if (!report) return [];
    return Object.values(report.completedTasks)
      .flat()
      .flatMap(c => (c as CompletionRecord).photos);
  }, [report]);

  useEffect(() => {
    if (!carouselApi) return;
    setCurrentSlide(carouselApi.selectedScrollSnap());
    carouselApi.on("select", () => {
      setCurrentSlide(carouselApi.selectedScrollSnap());
    });
  }, [carouselApi]);

  const handleClose = () => {
    router.back();
  };
  
  if (isLoading) {
     return (
        <div className="w-screen h-screen bg-black flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-white animate-spin"/>
        </div>
    )
  }

  if (!report || allPhotos.length === 0) {
    return (
      <div className="w-screen h-screen bg-black flex flex-col items-center justify-center text-white p-4">
        <h2 className="text-xl font-bold mb-4">Không tìm thấy ảnh</h2>
        <p className="text-neutral-400 mb-8">Không thể tải báo cáo hoặc báo cáo này không có ảnh.</p>
        <Button onClick={handleClose} variant="outline">Quay lại</Button>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-black flex items-center justify-center">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleClose}
        className="absolute top-4 right-4 z-50 text-white bg-black/30 rounded-full hover:bg-white/20 hover:text-white"
      >
        <X className="w-6 h-6" />
        <span className="sr-only">Đóng</span>
      </Button>

        <Carousel
            setApi={setCarouselApi}
            opts={{
                startIndex: initialPhotoIndex,
                loop: allPhotos.length > 1,
            }}
            className="w-full h-full"
        >
            <CarouselContent>
                {allPhotos.map((url, index) => (
                    <CarouselItem key={url.slice(-50) + index} className="flex items-center justify-center p-8">
                         <Image 
                            src={url} 
                            alt={`Ảnh xem trước ${index + 1}`} 
                            width={1920}
                            height={1080}
                            className="object-contain w-auto h-auto max-w-full max-h-full"
                            priority={index === initialPhotoIndex} // Prioritize loading the first image
                        />
                    </CarouselItem>
                ))}
            </CarouselContent>
            {allPhotos.length > 1 && (
                <>
                    <CarouselPrevious className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-black/30 text-white border-none hover:bg-black/50 h-10 w-10" />
                    <CarouselNext className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-black/30 text-white border-none hover:bg-black/50 h-10 w-10" />
                </>
            )}
        </Carousel>
        {allPhotos.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center text-white text-sm pointer-events-none bg-black/30 px-3 py-1.5 rounded-md">
                Ảnh {currentSlide + 1} / {allPhotos.length}
            </div>
        )}
    </div>
  );
}
