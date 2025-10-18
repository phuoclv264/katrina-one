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
import { toast } from 'react-hot-toast';
import { Camera, Video, VideoOff, RefreshCw, Trash2, CheckCircle, X, Loader2, Disc } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { photoStore } from '@/lib/photo-store';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';


type CameraDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (media: { id: string; type: 'photo' | 'video' }[]) => void | Promise<void>;
  singlePhotoMode?: boolean;
  captureMode?: 'photo' | 'video' | 'both';
};

export default function CameraDialog({ 
    isOpen, 
    onClose, 
    onSubmit, 
    singlePhotoMode = false,
    captureMode = 'photo',
}: CameraDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null); // For video overlay
  const animationFrameIdRef = useRef<number | null>(null); // To control the drawing loop

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [hardwareError, setHardwareError] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [capturedMedia, setCapturedMedia] = useState<{ id: string; url: string; type: 'photo' | 'video' }[]>([]);
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [currentMode, setCurrentMode] = useState<'photo' | 'video'>(captureMode === 'video' ? 'video' : 'photo');

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
    }
    if (videoRef.current) {
        videoRef.current.srcObject = null;
    }
  }, []);

  const handleDialogClose = useCallback(() => {
    if (!isStarting && !isSubmitting) {
        onClose();
    }
  },[isStarting, isSubmitting, onClose]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen) {
      timer = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOpen]);

  const startCamera = useCallback(async () => {
    if (isStarting || hardwareError || (streamRef.current && streamRef.current.active)) return;
    setIsStarting(true);
    setHasPermission(null);
    stopCameraStream();

    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setHardwareError(true);
            throw new Error('Camera not supported on this browser.');
        }
        
        const constraints = { video: { facingMode: 'environment' }, audio: currentMode === 'video' };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setHasPermission(true);
            setHardwareError(false); // Reset on success
        }
    } catch (error: any) {
        console.error('Error accessing camera:', error);
        setHasPermission(false);
        if (error.name === 'NotFoundError') {
            setHardwareError(true);
            toast.error('Không tìm thấy camera hoặc micro phù hợp trên thiết bị.');
        } else if (error.name === 'NotAllowedError') {
            toast.error('Bạn đã từ chối quyền truy cập camera. Vui lòng cấp quyền trong cài đặt trình duyệt.');
        } else {
            toast.error('Không thể truy cập camera. Vui lòng thử lại.');
        }
    } finally {
        setIsStarting(false);
    }
  }, [currentMode, stopCameraStream, hardwareError]);

  useEffect(() => {
    if (isOpen) {
      setCapturedMedia([]);
      setIsSubmitting(false);
      setIsRecording(false);
      setRecordingDuration(0);
      setHardwareError(false); // Reset on open
      setCurrentMode(captureMode === 'video' ? 'video' : 'photo');
    } else {
      capturedMedia.forEach(p => URL.revokeObjectURL(p.url));
      stopCameraStream();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, captureMode]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    }
  }, [isOpen, currentMode, startCamera]);


  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRecording && recordingStartTime) {
      timer = setInterval(() => {
        setRecordingDuration(Date.now() - recordingStartTime);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRecording, recordingStartTime]);


  const handleCapturePhoto = async () => {
    if (videoRef.current && hasPermission) {
        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (!context) return;
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        
        // Add timestamp
        const timestamp = format(new Date(), 'HH:mm:ss dd/MM/yyyy', { locale: vi });
        context.font = '24px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'right';
        context.textBaseline = 'bottom';
        context.fillText(timestamp, canvas.width - 10, canvas.height - 10);

        canvas.toBlob(async (blob) => {
            if (blob) {
                const photoId = uuidv4();
                try {
                    await photoStore.addPhoto(photoId, blob);
                    const objectUrl = URL.createObjectURL(blob);
                    
                    if (captureMode === 'photo' && singlePhotoMode) { // Replace if only one photo is allowed
                        capturedMedia.forEach(p => URL.revokeObjectURL(p.url));
                        setCapturedMedia([{ id: photoId, url: objectUrl, type: 'photo' }]);
                    } else {
                        setCapturedMedia(prev => [...prev, { id: photoId, url: objectUrl, type: 'photo' }]);
                    }
                } catch(error) {
                    toast.error("Lỗi lưu ảnh tạm thời.");
                }
            }
        }, 'image/jpeg', 0.95);
    }
  };
  
    const handleToggleRecording = () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop();
            if (animationFrameIdRef.current) {
                cancelAnimationFrame(animationFrameIdRef.current);
                animationFrameIdRef.current = null;
            }
        } else {
            if (!streamRef.current || !videoRef.current) {
                toast.error("Stream camera không hoạt động.");
                return;
            }

            const video = videoRef.current;
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvasRef.current = canvas;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const drawFrame = () => {
                if (!ctx || !videoRef.current) return;
                ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                
                const timestamp = format(new Date(), 'HH:mm:ss dd/MM/yyyy', { locale: vi });
                ctx.font = '24px Arial';
                ctx.fillStyle = 'white';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'bottom';
                ctx.shadowColor = 'black';
                ctx.shadowBlur = 4;
                ctx.fillText(timestamp, canvas.width - 10, canvas.height - 10);

                animationFrameIdRef.current = requestAnimationFrame(drawFrame);
            };
            drawFrame();

            const canvasStream = canvas.captureStream(30); // This has the video track with overlay
            const videoTrackWithOverlay = canvasStream.getVideoTracks()[0];

            // Get audio tracks from the original stream, if they exist
            const audioTracks = streamRef.current.getAudioTracks();

            // Combine video with overlay and original audio
            const combinedStream = new MediaStream([videoTrackWithOverlay, ...audioTracks]);

            // Now use the combined stream for the recorder
            mediaRecorderRef.current = new MediaRecorder(combinedStream, { mimeType: 'video/webm' });
            recordedChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = async () => {
                const videoBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                const videoId = uuidv4();
                try {
                    await photoStore.addPhoto(videoId, videoBlob);
                    const url = URL.createObjectURL(videoBlob);
                    setCapturedMedia(prev => [...prev, { id: videoId, url, type: 'video' }]);
                } catch(error) {
                    toast.error("Lỗi lưu video tạm thời.");
                }
                setIsRecording(false);
                setRecordingDuration(0);
                setRecordingStartTime(null);
                if (animationFrameIdRef.current) {
                    cancelAnimationFrame(animationFrameIdRef.current);
                    animationFrameIdRef.current = null;
                }
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingStartTime(Date.now());
        }
    };


  const handleDeleteMedia = async (mediaId: string) => {
    const mediaToDelete = capturedMedia.find(p => p.id === mediaId);
    if (mediaToDelete) URL.revokeObjectURL(mediaToDelete.url);
    
    setCapturedMedia(prev => prev.filter((p) => p.id !== mediaId));
    await photoStore.deletePhoto(mediaId);
  };
  
  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
        await onSubmit(capturedMedia);
    } finally {
        // Parent component closes the dialog, which triggers cleanup.
    }
  };
  
    const formatDuration = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleDialogClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Thêm bằng chứng</DialogTitle>
          <DialogDescription>
            {singlePhotoMode && captureMode === 'photo'
                ? 'Chụp ảnh bằng chứng cho hạng mục này.'
                : 'Chụp ảnh hoặc quay video làm bằng chứng.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted">
            <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline />
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 p-4 text-center text-white transition-opacity duration-300"
                style={{ opacity: hasPermission !== true ? 1 : 0, pointerEvents: hasPermission !== true ? 'auto' : 'none' }}
            >
                {isStarting && <p>Đang yêu cầu quyền truy cập...</p>}
                {hasPermission === false && (
                    <>
                        <VideoOff className="mb-4 h-12 w-12" />
                        {hardwareError ? (
                            <p>Không tìm thấy camera hoặc micro phù hợp trên thiết bị của bạn.</p>
                        ) : (
                            <p>Không thể truy cập camera. Vui lòng cấp quyền trong cài đặt trình duyệt và thử lại.</p>
                        )}
                        <Button variant="secondary" size="sm" className="mt-4" onClick={startCamera} disabled={hardwareError}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${isStarting ? 'animate-spin' : ''}`} />
                            Thử lại
                        </Button>
                    </>
                )}
            </div>

            {isRecording && (
                <div className="absolute top-2 left-2 z-10 flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-white text-sm font-medium">
                    <Disc className="h-4 w-4 animate-pulse" />
                    <span>{formatDuration(recordingDuration)}</span>
                </div>
            )}
             <div className="absolute bottom-2 right-2 z-10 text-white font-mono text-xs bg-black/50 px-2 py-1 rounded">
                {format(currentTime, 'HH:mm:ss dd/MM/yyyy', { locale: vi })}
            </div>
            
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4">
                {captureMode === 'both' && (
                  <ToggleGroup 
                    type="single" 
                    value={currentMode}
                    onValueChange={(value) => { if(value) setCurrentMode(value as 'photo' | 'video')}}
                    className="bg-black/50 p-1 rounded-full"
                    disabled={isRecording}
                  >
                      <ToggleGroupItem value="photo" aria-label="Photo mode" className="rounded-full text-white data-[state=on]:bg-primary/80"><Camera/></ToggleGroupItem>
                      <ToggleGroupItem value="video" aria-label="Video mode" className="rounded-full text-white data-[state=on]:bg-primary/80"><Video/></ToggleGroupItem>
                  </ToggleGroup>
                )}

                <Button 
                    onClick={currentMode === 'photo' ? handleCapturePhoto : handleToggleRecording} 
                    disabled={!hasPermission || isStarting} 
                    className={cn(
                      "rounded-full h-16 w-16 shadow-lg",
                      isRecording && "bg-red-600 hover:bg-red-700 animate-pulse"
                    )}
                >
                    {currentMode === 'photo' ? <Camera className="h-8 w-8" /> : (isRecording ? <div className="h-6 w-6 rounded-sm bg-white" /> : <Video className="h-8 w-8"/>)}
                    <span className="sr-only">{currentMode === 'photo' ? 'Chụp ảnh' : (isRecording ? 'Dừng quay' : 'Bắt đầu quay')}</span>
                </Button>
            </div>
        </div>
        
        {capturedMedia.length > 0 && (
          <ScrollArea className="w-full">
            <div className="flex space-x-2 pb-4">
              {capturedMedia.map((media) => (
                <div key={media.id} className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                   {media.type === 'photo' ? (
                        <Image src={media.url} alt={`Ảnh đã chụp`} fill className="object-cover" />
                   ) : (
                        <video src={media.url} className="h-full w-full object-cover" loop muted playsInline />
                   )}
                   <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-5 w-5 rounded-full z-10"
                      onClick={() => handleDeleteMedia(media.id)}
                    >
                      <X className="h-3 w-3" />
                      <span className="sr-only">Xóa</span>
                   </Button>
                </div>
              ))}
            </div>
             <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleDialogClose} disabled={isSubmitting}>Hủy</Button>
          <Button onClick={handleSubmit} disabled={capturedMedia.length === 0 || isSubmitting || isRecording}>
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-2 h-4 w-4" />
            )}
            Xong ({capturedMedia.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}