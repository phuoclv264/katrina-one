
'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Camera, VideoOff, RefreshCw, Trash2, CheckCircle, X } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';


type CameraDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (photos: string[]) => void;
  initialPhotos?: string[];
};

export default function CameraDialog({ isOpen, onClose, onSubmit, initialPhotos = [] }: CameraDialogProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
        videoRef.current.srcObject = null;
    }
  }, []);


  const startCamera = useCallback(async () => {
    if (isStarting || (streamRef.current && streamRef.current.active)) return;
    setIsStarting(true);
    setHasCameraPermission(null);
    stopCameraStream(); // Ensure any previous stream is stopped

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported on this browser.');
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setHasCameraPermission(true);
      }
    } catch (error: any) {
      console.error('Error accessing camera:', error);
      setHasCameraPermission(false);
       toast({
        variant: 'destructive',
        title: 'Không thể truy cập camera',
        description: 'Vui lòng cho phép truy cập camera trong cài đặt trình duyệt của bạn.',
      });
    } finally {
        setIsStarting(false);
    }
  }, [isStarting, stopCameraStream, toast]);

  
  useEffect(() => {
    if (isOpen) {
      setCapturedPhotos(initialPhotos);
      startCamera();
    } else {
      stopCameraStream();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current && hasCameraPermission) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUri = canvas.toDataURL('image/jpeg');
        setCapturedPhotos(prev => [...prev, dataUri]);
      }
    }
  };

  const handleDeletePhoto = (index: number) => {
    setCapturedPhotos(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleSubmit = () => {
    onSubmit(capturedPhotos);
  };
  
  const handleDialogClose = () => {
    if (!isStarting) {
        onClose();
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleDialogClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Chụp ảnh bằng chứng</DialogTitle>
          <DialogDescription>
            Chụp một hoặc nhiều ảnh về công việc đã hoàn thành. Nhấn "Xong" khi hoàn tất.
          </DialogDescription>
        </DialogHeader>

        <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted">
            <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline />
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 p-4 text-center text-white transition-opacity duration-300"
                style={{ opacity: hasCameraPermission !== true ? 1 : 0, pointerEvents: hasCameraPermission !== true ? 'auto' : 'none' }}
            >
                {isStarting && <p>Đang yêu cầu quyền truy cập camera...</p>}
                {hasCameraPermission === false && (
                    <>
                        <VideoOff className="mb-4 h-12 w-12" />
                        <p>Không thể truy cập camera. Vui lòng kiểm tra quyền và thử lại.</p>
                        <Button variant="secondary" size="sm" className="mt-4" onClick={startCamera} disabled={isStarting}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${isStarting ? 'animate-spin' : ''}`} />
                            Thử lại
                        </Button>
                    </>
                )}
            </div>
            <Button onClick={handleCapture} disabled={!hasCameraPermission || isStarting} className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 rounded-full h-16 w-16">
                <Camera className="h-8 w-8" />
                <span className="sr-only">Chụp ảnh</span>
            </Button>
        </div>
        
        {capturedPhotos.length > 0 && (
          <ScrollArea className="w-full">
            <div className="flex space-x-2 pb-4">
              {capturedPhotos.map((photo, index) => (
                <div key={index} className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-md">
                   <Image src={photo} alt={`Ảnh đã chụp ${index + 1}`} fill className="object-cover" />
                   <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-5 w-5 rounded-full z-10"
                      onClick={() => handleDeletePhoto(index)}
                    >
                      <X className="h-3 w-3" />
                      <span className="sr-only">Xóa ảnh</span>
                   </Button>
                </div>
              ))}
            </div>
             <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleDialogClose}>Hủy</Button>
          <Button onClick={handleSubmit}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Xong ({capturedPhotos.length})
          </Button>
        </DialogFooter>

        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}
