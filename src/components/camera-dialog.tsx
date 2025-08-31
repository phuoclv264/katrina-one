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
  const streamRef = useRef<MediaStream | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const startCamera = useCallback(async () => {
    if (isStarting) return;
    setIsStarting(true);
    setHasCameraPermission(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported on this browser.');
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setHasCameraPermission(true);
          setIsStarting(false);
        };
      }
    } catch (error: any) {
      console.error('Error accessing camera:', error);
      setHasCameraPermission(false);
      let description = 'Vui lòng cho phép truy cập camera trong cài đặt trình duyệt của bạn.';
      if (error.name === 'NotAllowedError') {
        description = 'Bạn đã từ chối quyền truy cập camera. Vui lòng bật lại trong cài đặt.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        description = 'Không tìm thấy camera nào trên thiết bị của bạn.';
      }
      toast({
        variant: 'destructive',
        title: 'Không thể truy cập camera',
        description: description,
      });
      setIsStarting(false);
    }
  }, [isStarting, toast]);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if(videoRef.current) {
        videoRef.current.srcObject = null;
    }
  }, []);
  
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCameraStream();
    }

    return () => {
      stopCameraStream();
    };
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
        onCapture(dataUri);
      }
    }
  };
  
  const handleDialogClose = () => {
    if (!isStarting) {
        onClose();
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleDialogClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chụp ảnh bằng chứng</DialogTitle>
          <DialogDescription>
            Hướng camera về phía công việc đã hoàn thành và nhấn Chụp ảnh.
          </DialogDescription>
        </DialogHeader>

        <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted">
            <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline />
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 p-4 text-center text-white transition-opacity duration-300"
                style={{ opacity: hasCameraPermission !== true ? 1 : 0, pointerEvents: hasCameraPermission !== true ? 'auto' : 'none' }}
            >
                {isStarting && (
                    <p>Đang yêu cầu quyền truy cập camera...</p>
                )}
                {hasCameraPermission === false && (
                    <>
                        <VideoOff className="mb-4 h-12 w-12" />
                        <p>Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập của bạn.</p>
                        <Button variant="secondary" size="sm" className="mt-4" onClick={startCamera} disabled={isStarting}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${isStarting ? 'animate-spin' : ''}`} />
                            Thử lại
                        </Button>
                    </>
                )}
            </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleDialogClose}>Hủy</Button>
          <Button onClick={handleCapture} disabled={!hasCameraPermission || isStarting}>
            <Camera className="mr-2 h-4 w-4" />
            Chụp ảnh
          </Button>
        </DialogFooter>

        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}
