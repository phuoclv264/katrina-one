
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
import { Camera, VideoOff, RefreshCw, Trash2, CheckCircle, X, Loader2 } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { photoStore } from '@/lib/photo-store';
import { v4 as uuidv4 } from 'uuid';

type CameraDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (photoIds: string[]) => void | Promise<void>;
  singlePhotoMode?: boolean;
};

export default function CameraDialog({ isOpen, onClose, onSubmit, singlePhotoMode = false }: CameraDialogProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [capturedPhotos, setCapturedPhotos] = useState<{ id: string; url: string }[]>([]);

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
      setCapturedPhotos([]);
      setIsSubmitting(false); // Reset submitting state
      startCamera();
    } else {
      // Cleanup object URLs when dialog is closed
      capturedPhotos.forEach(p => URL.revokeObjectURL(p.url));
      stopCameraStream();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleCapture = async () => {
    if (videoRef.current && hasCameraPermission) {
        const video = videoRef.current;
        
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (!context) return;
        
        // 1. Draw the video frame
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

        // 2. Add timestamp overlay
        const now = new Date();
        const timestamp = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) 
                        + ' ' 
                        + now.toLocaleDateString('vi-VN');
        
        const fontSize = Math.max(16, Math.round(canvas.width / 50)); // Adjust font size based on image width
        context.font = `bold ${fontSize}px Arial`;
        context.textAlign = 'right';
        context.textBaseline = 'bottom';
        
        const padding = fontSize / 2;
        const textMetrics = context.measureText(timestamp);
        const textWidth = textMetrics.width;
        const textHeight = fontSize;

        // Draw semi-transparent background for better readability
        context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        context.fillRect(
            canvas.width - textWidth - padding * 2, 
            canvas.height - textHeight - padding * 2, 
            textWidth + padding * 2, 
            textHeight + padding * 2
        );

        // Draw the text
        context.fillStyle = 'white';
        context.fillText(timestamp, canvas.width - padding, canvas.height - padding);

        // 3. Get the image as a Blob
        canvas.toBlob(async (blob) => {
            if (blob) {
                const photoId = uuidv4();
                try {
                    await photoStore.addPhoto(photoId, blob);
                    const objectUrl = URL.createObjectURL(blob);
                    
                    if (singlePhotoMode) {
                        // In single photo mode, replace existing photo
                        capturedPhotos.forEach(p => URL.revokeObjectURL(p.url)); // Clean up old URL
                        setCapturedPhotos([{ id: photoId, url: objectUrl }]);
                    } else {
                        setCapturedPhotos(prev => [...prev, { id: photoId, url: objectUrl }]);
                    }
                } catch(error) {
                    console.error("Failed to save photo to IndexedDB", error);
                    toast({
                        title: "Lỗi lưu ảnh",
                        description: "Không thể lưu ảnh tạm thời. Vui lòng thử lại.",
                        variant: "destructive"
                    });
                }
            }
        }, 'image/jpeg', 1); // 100% quality
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    // Revoke the object URL to free up memory
    const photoToDelete = capturedPhotos.find(p => p.id === photoId);
    if (photoToDelete) {
        URL.revokeObjectURL(photoToDelete.url);
    }
    
    setCapturedPhotos(prev => prev.filter((p) => p.id !== photoId));
    await photoStore.deletePhoto(photoId);
  };
  
  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
        await onSubmit(capturedPhotos.map(p => p.id));
    } finally {
        // The parent component is responsible for closing the dialog
        // and the isOpen effect will reset the state.
    }
  };
  
  const handleDialogClose = () => {
    if (!isStarting && !isSubmitting) {
        onClose();
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleDialogClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Chụp ảnh bằng chứng</DialogTitle>
          <DialogDescription>
            {singlePhotoMode 
                ? 'Chụp ảnh bằng chứng cho hạng mục này. Ảnh mới sẽ thay thế ảnh cũ.'
                : 'Chụp một hoặc nhiều ảnh về công việc đã hoàn thành. Nhấn "Xong" khi hoàn tất.'
            }
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
              {capturedPhotos.map((photo) => (
                <div key={photo.id} className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-md">
                   <Image src={photo.url} alt={`Ảnh đã chụp`} fill className="object-cover" />
                   <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-5 w-5 rounded-full z-10"
                      onClick={() => handleDeletePhoto(photo.id)}
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
          <Button variant="outline" onClick={handleDialogClose} disabled={isSubmitting}>Hủy</Button>
          <Button onClick={handleSubmit} disabled={capturedPhotos.length === 0 || isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-2 h-4 w-4" />
            )}
            Xong ({capturedPhotos.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
