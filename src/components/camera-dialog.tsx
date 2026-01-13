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
import { toast } from '@/components/ui/pro-toast';
import { Camera, Video, VideoOff, RefreshCw, Trash2, CheckCircle, X, Loader2 } from 'lucide-react';

import { photoStore } from '@/lib/photo-store';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';

import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import MediaGalleryDialog from './media-gallery-dialog';


type CameraDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (media: { id: string; type: 'photo' | 'video' }[]) => void | Promise<void>;
  singlePhotoMode?: boolean;
  captureMode?: 'photo' | 'video' | 'both';
  isHD?: boolean;
};

const PORTRAIT_ASPECT_RATIO = 3 / 4; // width:height = 3:4
const TARGET_DIMENSIONS = {
  standard: { width: 1080, height: 1440 },
  hd: { width: 1440, height: 1920 },
};

const getTargetDimensions = (isHD: boolean) =>
  isHD ? TARGET_DIMENSIONS.hd : TARGET_DIMENSIONS.standard;

const ensureVideoReady = (video: HTMLVideoElement) =>
  new Promise<{ naturalW: number; naturalH: number }>((resolve) => {
    let fallbackTimer: number | null = null;
    if (video.videoWidth && video.videoHeight) {
      resolve({ naturalW: video.videoWidth, naturalH: video.videoHeight });
      return;
    }

    const onLoaded = () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      resolve({ naturalW: video.videoWidth, naturalH: video.videoHeight });
    };

    video.addEventListener('loadedmetadata', onLoaded);
    fallbackTimer = window.setTimeout(() => {
      video.removeEventListener('loadedmetadata', onLoaded);
      resolve({ naturalW: video.videoWidth || TARGET_DIMENSIONS.standard.width, naturalH: video.videoHeight || TARGET_DIMENSIONS.standard.height });
    }, 1000);
  });

const computePortraitCropBox = (naturalW: number, naturalH: number) => {
  // Legacy centered 3:4 box (largest centered area fitting 3:4) — fallback if preview container isn't available.
  const desiredAspect = PORTRAIT_ASPECT_RATIO;
  let cropW = Math.floor(naturalH * desiredAspect);
  let cropH = naturalH;

  if (cropW > naturalW) {
    cropW = naturalW;
    cropH = Math.floor(naturalW / desiredAspect);
  }

  const sx = Math.floor((naturalW - cropW) / 2);
  const sy = Math.floor((naturalH - cropH) / 2);

  return { sx, sy, cropW, cropH };
};

const computeVisibleNaturalCrop = (video: HTMLVideoElement, container: HTMLDivElement) => {
  // Robust mapping from the visible container (CSS pixels) to natural video pixels.
  // This accounts for object-fit: cover on the video element which can scale/offset the
  // rendered video content inside the video element.
  const naturalW = video.videoWidth || 0;
  const naturalH = video.videoHeight || 0;
  if (!naturalW || !naturalH) return null;

  const videoRect = video.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  // Compute scale used by object-fit: cover when rendering the natural content into the video element
  const scale = Math.max(videoRect.width / naturalW, videoRect.height / naturalH); // px (display) per natural px
  const scaledW = naturalW * scale;
  const scaledH = naturalH * scale;

  // Content is centered inside video element; compute offset from video element top-left to content top-left
  const offsetX = (videoRect.width - scaledW) / 2;
  const offsetY = (videoRect.height - scaledH) / 2;

  // Compute container position relative to the video element's content coordinate system
  const leftInVideo = containerRect.left - videoRect.left;
  const topInVideo = containerRect.top - videoRect.top;

  // Position of container relative to the scaled content (in display px)
  const contentLeft = leftInVideo - offsetX;
  const contentTop = topInVideo - offsetY;

  // Convert to natural pixels by dividing by scale
  let sx = Math.floor(contentLeft / scale);
  let sy = Math.floor(contentTop / scale);
  let cropW = Math.floor(containerRect.width / scale);
  let cropH = Math.floor(containerRect.height / scale);

  // Clamp to valid natural bounds
  if (sx < 0) sx = 0;
  if (sy < 0) sy = 0;
  if (sx + cropW > naturalW) cropW = naturalW - sx;
  if (sy + cropH > naturalH) cropH = naturalH - sy;

  // Ensure minimum size
  cropW = Math.max(1, cropW);
  cropH = Math.max(1, cropH);

  return { sx, sy, cropW, cropH };
};

export default function CameraDialog({ 
    isOpen, 
    onClose, 
    onSubmit, 
    singlePhotoMode = false,
    captureMode = 'photo',
    isHD = false,
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

  // UI state: gallery open and preview scroller ref
  const [showGallery, setShowGallery] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  const [supportedMimeType, setSupportedMimeType] = useState<string | null>(null);
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
    if (window.MediaRecorder) {
      const mimeTypes = [
        'video/mp4', // Often supported on Safari/iOS, prioritize this
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
      ];
      const supported = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
      setSupportedMimeType(supported || null);
    } else {
        setSupportedMimeType(null);
    }
  }, []);

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
        
        // Prefer the native camera resolution. Removing explicit width/height prevents
        // forcing the device to downscale to a target size. We still request a portrait
        // aspect ratio and the rear camera.
        const videoConstraints: MediaTrackConstraints = {
          facingMode: { ideal: 'environment' },
          aspectRatio: PORTRAIT_ASPECT_RATIO,
        };

        const constraints = { video: videoConstraints, audio: currentMode === 'video' };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setHasPermission(true);
            setHardwareError(false); // Reset on success
        }
    } catch (error: any) {
        setHasPermission(false);
        if (error.name === 'NotFoundError') {
            setHardwareError(true);
            toast.error('Không tìm thấy camera hoặc micro phù hợp trên thiết bị.');
        } else if (error.name === 'NotAllowedError') {
            setHasPermission(null);
            toast.error('Bạn đã từ chối quyền truy cập camera. Vui lòng cấp quyền trong cài đặt trình duyệt.');
        } else if (error.name === 'AbortError') {
            // This is expected if the user closes the dialog before the camera starts.
            // We can safely ignore it.
        } else {
            toast.error('Không thể truy cập camera. Vui lòng thử lại.');
        }
    } finally {
        setIsStarting(false);
    }
  }, [isStarting, hardwareError, stopCameraStream, isHD, currentMode, videoRef, hardwareError]);

  useEffect(() => {
    if (isOpen) {
      setCapturedMedia([]);
      setIsSubmitting(false);
      setIsRecording(false);
      setRecordingDuration(0);
      setHardwareError(false); // Reset on open
      setCurrentMode(captureMode === 'video' ? 'video' : 'photo');
    } else {
      // Ensure animation frame is cancelled when dialog is closed
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      capturedMedia.forEach(p => URL.revokeObjectURL(p.url));
      stopCameraStream();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, captureMode]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    }
  }, [isOpen, startCamera]);


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

        const { naturalW, naturalH } = await ensureVideoReady(video);
        // Prefer crop derived from the on-screen preview (object-fit: cover) so preview == saved
        let crop = null;
        if (previewContainerRef.current) {
          crop = computeVisibleNaturalCrop(video, previewContainerRef.current);
        }
        const { sx, sy, cropW, cropH } = crop || computePortraitCropBox(naturalW, naturalH);

        const canvas = document.createElement('canvas');
        canvas.width = cropW;
        canvas.height = cropH;
        const context = canvas.getContext('2d');
        if (!context) return;

        context.drawImage(video, sx, sy, cropW, cropH, 0, 0, canvas.width, canvas.height);

        console.log('Drawing image with params:', { sx, sy, cropW, cropH, destW: canvas.width, destH: canvas.height });

        // Add timestamp
        const timestamp = format(new Date(), 'HH:mm:ss dd/MM/yyyy', { locale: vi });
        context.font = '24px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'right';
        context.textBaseline = 'bottom';
        context.shadowColor = 'black';
        context.shadowBlur = 4;
        context.fillText(timestamp, canvas.width - 10, canvas.height - 10);

        // For debugging, log sizes when in dev
        // eslint-disable-next-line no-console
        console.debug('capture', { naturalW, naturalH, sx, sy, cropW, cropH, outW: canvas.width, outH: canvas.height });

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
                        // Put newest media at the start so newest appears on the left
                        setCapturedMedia(prev => [{ id: photoId, url: objectUrl, type: 'photo' }, ...prev]);
                    }
                } catch(error) {
                    toast.error("Lỗi lưu ảnh tạm thời.");
                }
            }
        }, 'image/jpeg', isHD ? 1.0 : 0.95);
    }
  };
  
    const handleToggleRecording = async () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop(); // onstop will handle the rest
            if (animationFrameIdRef.current) {
                cancelAnimationFrame(animationFrameIdRef.current);
                animationFrameIdRef.current = null;
            }
        } else {
            if (!streamRef.current || !videoRef.current) {
                toast.error("Stream camera không hoạt động.");
                return;
            }
            if (!supportedMimeType) {
                toast.error("Trình duyệt của bạn không hỗ trợ quay video.");
                console.error("No supported MIME type found for MediaRecorder.");
                return;
            }

            toast.success("Đang bắt đầu quay video...");

            const video = videoRef.current;
          const { naturalW, naturalH } = await ensureVideoReady(video);
          // Prefer crop derived from the on-screen preview (object-fit: cover) so preview == recorded
          let crop = null;
          if (previewContainerRef.current) {
            crop = computeVisibleNaturalCrop(video, previewContainerRef.current);
          }
          const { sx, sy, cropW, cropH } = crop || computePortraitCropBox(naturalW, naturalH);

          const canvas = document.createElement('canvas');
          canvas.width = cropW;
          canvas.height = cropH;
            canvasRef.current = canvas;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const drawFrame = () => {
                if (!ctx || !videoRef.current) return;
            ctx.drawImage(videoRef.current, sx, sy, cropW, cropH, 0, 0, canvas.width, canvas.height);
                
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

            try {
                // Now use the combined stream for the recorder
                mediaRecorderRef.current = new MediaRecorder(combinedStream, { mimeType: supportedMimeType });
                recordedChunksRef.current = [];

                mediaRecorderRef.current.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        recordedChunksRef.current.push(event.data);
                    }
                };

                mediaRecorderRef.current.onstop = async () => {
                    const videoBlob = new Blob(recordedChunksRef.current, { type: supportedMimeType });
                    const videoId = uuidv4();
                    try {
                        await photoStore.addPhoto(videoId, videoBlob);
                        const url = URL.createObjectURL(videoBlob);
                        // Put newest media at the start so newest appears on the left
                        setCapturedMedia(prev => [{ id: videoId, url, type: 'video' }, ...prev]);
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
            } catch (error) {
                console.error("MediaRecorder initialization failed:", error);
                toast.error("Không thể khởi tạo chức năng quay video. Thiết bị hoặc trình duyệt có thể không hỗ trợ.");
                // Clean up the animation frame if recorder fails to start
                if (animationFrameIdRef.current) {
                    cancelAnimationFrame(animationFrameIdRef.current);
                    animationFrameIdRef.current = null;
                }
            }
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

  // Preview helper: show up to 5 items in the strip; remaining items are counted as "extra"
  const previewItems = capturedMedia.slice(0, 5);
  const extraCount = Math.max(0, capturedMedia.length - previewItems.length);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleDialogClose()}>
      <DialogContent
        overlayClassName="bg-transparent"
        hideClose={true}
        className="max-w-3xl p-0 overflow-hidden border-none bg-transparent sm:rounded-[40px] shadow-2xl"
      >
        <div className="relative h-[90vh] sm:h-[80vh] w-full flex flex-col">
          {/* Main Camera View - Absolutely positioned to fill background */}
          <div className="absolute inset-0 z-0">
              <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline />
          </div>

          {/* Preview window (transparent) - shows the crop area over the full video */}
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <div ref={previewContainerRef} className="relative w-full max-w-2xl aspect-[3/4] overflow-hidden rounded-3xl border bg-transparent z-20 pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] ring-1 ring-white/10" aria-hidden>
                {/* transparent window showing the area that will be captured */}
              </div>
          </div>

          {/* Header Overlay - Gradient for legibility */}
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-6 bg-gradient-to-b from-black/80 via-black/20 to-transparent text-white">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold tracking-tight">Bằng chứng</DialogTitle>
              <DialogDescription className="text-sm text-white/70 italic line-clamp-1">
                {singlePhotoMode ? 'Vui lòng chụp 1 tấm ảnh' : 'Chụp ảnh hoặc video'}
              </DialogDescription>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-12 w-12 text-white hover:bg-white/20 hover:text-white rounded-full transition-all duration-300 backdrop-blur-md border border-white/10 pointer-events-auto"
              onClick={handleDialogClose}
            >
              <X className="h-6 w-6" />
            </Button>
          </div>

          {/* Camera Status Overlay (Center) */}
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] p-6 text-center text-white transition-opacity duration-500"
              style={{ opacity: hasPermission !== true ? 1 : 0, pointerEvents: hasPermission !== true ? 'auto' : 'none' }}
          >
              {isStarting && (
                <div className="flex flex-col items-center gap-6">
                  <div className="relative">
                    <div className="h-20 w-20 rounded-full border-4 border-white/10 border-t-primary animate-spin" />
                    <Camera className="absolute inset-0 m-auto h-8 w-8 text-primary/50" />
                  </div>
                  <p className="text-lg font-medium tracking-wide">Đang kết nối camera...</p>
                </div>
              )}
              {hasPermission === false && (
                  <div className="max-w-xs flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-300">
                      <div className="bg-destructive/10 p-6 rounded-full ring-8 ring-destructive/5">
                        <VideoOff className="h-10 w-10 text-destructive" />
                      </div>
                      <p className="text-base text-white/90 leading-relaxed font-medium">
                        {hardwareError 
                          ? 'Không tìm thấy camera hoặc micro.' 
                          : 'Vui lòng cấp quyền truy cập camera trong cài đặt.'}
                      </p>
                      <Button variant="outline" size="lg" className="bg-white text-black hover:bg-white/90 border-none rounded-full px-8 py-6 h-auto font-bold shadow-xl" onClick={startCamera}>
                          <RefreshCw className={`mr-2 h-5 w-5 ${isStarting ? 'animate-spin' : ''}`} />
                          Thử lại ngay
                      </Button>
                  </div>
              )}
          </div>

          {/* Indicators Overlays */}
          <div className="absolute top-24 left-6 z-20 flex flex-col gap-3">
              {isRecording && (
                  <div className="flex items-center gap-3 rounded-2xl bg-red-600 px-4 py-2 text-white text-sm font-black ring-4 ring-red-600/20 animate-in slide-in-from-left duration-300">
                      <div className="h-2.5 w-2.5 rounded-full bg-white animate-pulse shadow-[0_0_10px_white]" />
                      <span className="tabular-nums tracking-widest">{formatDuration(recordingDuration)}</span>
                  </div>
              )}
          </div>
          
          {/* Fixed Controls - centered and fixed to viewport bottom */}
          <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 w-full max-w-sm pointer-events-none">
              <div className="flex items-center justify-around w-full pointer-events-auto">
                  <div className="w-16 h-16 flex items-center justify-center">
                    {captureMode === 'both' && !isRecording && (
                       <button 
                         onClick={() => setCurrentMode(currentMode === 'photo' ? 'video' : 'photo')}
                         className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-all active:scale-95"
                       >
                         {currentMode === 'photo' ? <Video className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
                       </button>
                    )}
                  </div>

                  {/* Shutter */}
                  <button 
                      onClick={currentMode === 'photo' ? handleCapturePhoto : handleToggleRecording} 
                      disabled={!hasPermission || isStarting || isSubmitting} 
                      className={cn(
                        "relative flex items-center justify-center rounded-full transition-all duration-300 transform active:scale-90 ring-offset-black ring-offset-4 pointer-events-auto",
                        currentMode === 'photo' 
                          ? "h-20 w-20 bg-white ring-2 ring-white/50" 
                          : cn("h-20 w-20 ring-4 ring-white/50", isRecording ? "bg-red-600 ring-red-500/50 scale-110" : "bg-white")
                      )}
                  >
                      {currentMode === 'video' && isRecording ? (
                         <div className="h-8 w-8 rounded-md bg-white animate-pulse" />
                      ) : (
                         <div className={cn(
                           "h-[calc(100%-12px)] w-[calc(100%-12px)] rounded-full border-2",
                           currentMode === 'photo' ? "border-black/5 bg-white" : "border-black/5 bg-red-600"
                         )} />
                      )}
                  </button>

                  <div className="w-16 h-16 flex items-center justify-center">
                    {capturedMedia.length > 0 && !isRecording && (
                      <button 
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="group h-16 w-16 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xl shadow-primary/40 flex flex-col items-center justify-center gap-1 transition-all duration-300 hover:scale-110 active:scale-95"
                      >
                         {isSubmitting ? (
                            <Loader2 className="h-6 w-6 animate-spin" />
                         ) : (
                            <>
                              <CheckCircle className="h-6 w-6" />
                              <span className="text-[10px] font-bold uppercase tracking-tighter">Xong</span>
                            </>
                         )}
                      </button>
                    )}
                  </div>
              </div>
          </div>

          {/* Preview Strip - fixed and transparent, positioned above controls */}
          {capturedMedia.length > 0 && (
            <div className="fixed bottom-28 left-1/2 z-50 -translate-x-1/2 w-full max-w-lg pointer-events-auto">

              <div className="w-full">
                <div ref={previewRef} className="flex gap-3 px-4 pb-2 items-center">
                  {previewItems.map((media, idx) => {
                    const isLastPreview = idx === previewItems.length - 1 && extraCount > 0;
                    const extraPeeks = capturedMedia.slice(previewItems.length, previewItems.length + 3); // show up to 3 peeks
                    return (
                      <div
                        key={media.id}
                        className={cn(
                          "group relative h-14 flex-1 min-w-0 max-w-[88px] rounded-2xl border-2 border-white/10 bg-transparent shadow-xl transition-all hover:scale-110 active:scale-95",
                          isLastPreview ? "overflow-visible" : "overflow-hidden"
                        )}
                        role={isLastPreview ? 'button' : undefined}
                        aria-label={isLastPreview ? `Mở thư viện — còn ${extraCount} ảnh/video` : undefined}
                        tabIndex={isLastPreview ? 0 : undefined}
                        onKeyDown={(e) => { if (isLastPreview && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setShowGallery(true); } }}
                        onClick={() => { if (isLastPreview) setShowGallery(true); }}
                      >
                        <div className="w-full h-full relative overflow-hidden rounded-2xl">
                          {media.type === 'photo' ? (
                            <Image src={media.url} alt="Preview" fill className="object-cover bg-black" />
                          ) : (
                            <video src={media.url} className="w-full h-full object-cover" muted />
                          )}
                        </div>

                        {!isLastPreview && (
                          <button
                            className="absolute inset-0 bg-red-600/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20"
                            onClick={(e) => { e.stopPropagation(); handleDeleteMedia(media.id); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}

                        {media.type === 'video' && (
                          <div className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_5px_red]" />
                        )}

                        {isLastPreview && (
                          <>
                            {extraPeeks.map((m, i) => (
                              <div
                                key={m.id}
                                className="absolute w-14 h-9 rounded-md overflow-hidden border-2 border-white/10 shadow-sm"
                                style={{ right: -(i + 1) * 16 }}
                              >
                                {m.type === 'photo' ? (
                                  <Image src={m.url} alt="peek" width={56} height={36} className="object-cover" />
                                ) : (
                                  <video src={m.url} className="w-full h-full object-cover" muted />
                                )}
                              </div>
                            ))}

                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10 text-white text-sm font-bold pointer-events-none">
                              +{extraCount}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Enhanced Gallery component */}
              <MediaGalleryDialog 
                isOpen={showGallery}
                onClose={() => setShowGallery(false)}
                media={capturedMedia}
                onDelete={handleDeleteMedia}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}