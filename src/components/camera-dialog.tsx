'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
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
import { Alert, AlertTitle, AlertDescription } from './ui/alert';
import { Camera, VideoOff, RefreshCw } from 'lucide-react';

type CameraDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (photoDataUri: string) => void;
};

export default function CameraDialog({ isOpen, onClose, onCapture }: CameraDialogProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const getCameraPermission = useCallback(async () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(newStream);
      setHasCameraPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setHasCameraPermission(false);
      toast({
        variant: 'destructive',
        title: 'Không thể truy cập camera',
        description: 'Vui lòng cho phép truy cập camera trong cài đặt trình duyệt của bạn.',
      });
    }
  }, [toast, stream]);

  useEffect(() => {
    if (isOpen) {
      getCameraPermission();
    } else {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    }
    
    return () => {
         if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    }
  }, [isOpen, getCameraPermission, stream]);


  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUri = canvas.toDataURL('image/jpeg');
        onCapture(dataUri);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chụp ảnh bằng chứng</DialogTitle>
          <DialogDescription>
            Hướng camera về phía công việc đã hoàn thành và nhấn Chụp ảnh.
          </DialogDescription>
        </DialogHeader>

        <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted">
            <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline />
            {hasCameraPermission === false && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white p-4">
                    <VideoOff className="h-12 w-12 mb-4" />
                    <p className="text-center">Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập.</p>
                     <Button variant="secondary" size="sm" className="mt-4" onClick={getCameraPermission}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Thử lại
                    </Button>
                </div>
            )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={handleCapture} disabled={!hasCameraPermission}>
            <Camera className="mr-2 h-4 w-4" />
            Chụp ảnh
          </Button>
        </DialogFooter>

        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}
