'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import Image from '@/components/ui/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogIcon,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/pro-toast';
import { Camera, Video, VideoOff, RefreshCw, Trash2, CheckCircle, X, Loader2, MessageSquareText, FileText, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { photoStore } from '@/lib/photo-store';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';

import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import MediaGalleryDialog from './media-gallery-dialog';


type CameraDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  // media plus optional text (caption/note) submitted with the media
  onSubmit: (media: { id: string; type: 'photo' | 'video' }[], text?: string) => void | Promise<void>;
  singlePhotoMode?: boolean;
  captureMode?: 'photo' | 'video' | 'both';
  isHD?: boolean;
  parentDialogTag: string;
  /** Optional contextual text to display in the dialog (e.g., task instructions) */
  contextText?: string;
  /** Allow the user to enter a caption/note to submit with the media */
  allowCaption?: boolean;
  /** Initial caption value (optional) */
  initialCaption?: string;
};

const PORTRAIT_ASPECT_RATIO = 3 / 4; // width:height = 3:4
const TARGET_DIMENSIONS = {
  standard: { width: 1080 * 1.5, height: 1440 * 1.5 }, // 1620x2160
  hd: { width: 1440 * 1.5, height: 1920 * 1.5 },     // 3240x4320
};

// Optimized video dimensions to prevent device lag/crash and reduce upload size
const VIDEO_TARGET_DIMENSIONS = {
  standard: { width: 720, height: 960 }, // 720p portrait
  hd: { width: 1080, height: 1440 },     // 1080p portrait
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

  // Convert to natural pixels by dividing to scale
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
  parentDialogTag,
  contextText,
  allowCaption = false,
  initialCaption = '',
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
  const [capturedMedia, setCapturedMedia] = useState<{ id: string; url: string; type: 'photo' | 'video'; caption?: string }[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // UI state: gallery open and preview scroller ref
  const [showGallery, setShowGallery] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const [captionText, setCaptionText] = useState(initialCaption);
  const [isCaptionVisible, setIsCaptionVisible] = useState(false);
  const captionRef = useRef<string | undefined>(initialCaption || undefined);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  useEffect(() => {
    captionRef.current = captionText?.trim() ? captionText.trim() : undefined;
  }, [captionText]);

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
    // Prevent closing during critical operations
    if (isStarting) return;
    if (isSubmitting) return;
    if (isRecording) {
      toast.warning('Đang quay video — dừng quay trước khi đóng.');
      return;
    }

    // If there are unsent/unsaved media, confirm before closing
    if (capturedMedia.length > 0) {
      setShowDiscardConfirm(true);
      return;
    }

    onClose();
  }, [isStarting, isSubmitting, isRecording, capturedMedia, onClose]);

  const confirmDiscardAndClose = useCallback(async () => {
    // Close the confirm dialog immediately to avoid duplicate modals
    setShowDiscardConfirm(false);

    // Revoke object URLs and clear in-memory list
    capturedMedia.forEach(m => URL.revokeObjectURL(m.url));
    setCapturedMedia([]);

    // Also remove temporary blobs from the photo store (best-effort)
    try {
      await Promise.all(capturedMedia.map(m => photoStore.deletePhoto(m.id).catch(() => undefined)));
    } catch (err) {
      // swallow — we still proceed to close the UI
      console.warn('Failed to fully delete some temp media', err);
    } finally {
      stopCameraStream();
      onClose();
    }
  }, [capturedMedia, stopCameraStream, onClose]);

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
      // Prefer camera native resolution close to our target dimensions so
      // captured photos/videos are higher resolution. We still request a
      // portrait aspect ratio and the rear camera.
      const target = getTargetDimensions(isHD);
      const videoConstraints: MediaTrackConstraints = {
        facingMode: { ideal: 'environment' },
        aspectRatio: PORTRAIT_ASPECT_RATIO,
        width: { ideal: target.width },
        height: { ideal: target.height },
      };

      // Start camera with video-only. Defer microphone permission until recording starts to avoid
      // blocking camera on devices without a microphone or when microphone permission is denied.
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
      } catch (err) {
        // Rethrow so outer catch handles error messaging and UI updates
        throw err;
      }

      if (!stream) throw new Error('Failed to acquire media stream.');

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
        setHasPermission(false);
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
      setCaptionText(initialCaption || '');
      setIsCaptionVisible(!!initialCaption);
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

      // Output at our chosen target dimensions (upscale or downscale as needed)
      const target = getTargetDimensions(isHD);
      const canvas = document.createElement('canvas');
      canvas.width = target.width;
      canvas.height = target.height;
      const context = canvas.getContext('2d');
      if (!context) return;

      // Scale the cropped natural region into the target canvas size so saved
      // images have higher resolution.
      context.drawImage(video, sx, sy, cropW, cropH, 0, 0, canvas.width, canvas.height);

      // Add timestamp (scale font to canvas size for legibility at higher res)
      const timestamp = format(new Date(), 'HH:mm:ss dd/MM/yyyy', { locale: vi });
      const fontSize = Math.max(18, Math.round(canvas.width * 0.023));
      context.font = `${fontSize}px Arial`;
      context.fillStyle = 'white';
      context.textAlign = 'right';
      context.textBaseline = 'bottom';
      context.shadowColor = 'black';
      context.shadowBlur = 4;
      context.fillText(timestamp, canvas.width - 10, canvas.height - 10);

      // Draw caption if present (bottom-left), with simple wrapping and background for readability
      const caption = captionRef.current;
      if (caption) {
        const maxWidth = Math.round(canvas.width * 0.8);
        const lineHeight = Math.round(fontSize * 1.15);
        const lines: string[] = [];
        const words = caption.split(' ');
        let currentLine = '';
        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const { width: testWidth } = context.measureText(testLine);
          if (testWidth > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
            if (lines.length >= 2) break; // limit to 2 lines
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) lines.push(currentLine);

        // Draw caption text without a background rectangle. Use a subtle stroke for legibility.
        const padding = 12;
        const boxX = 10;
        const boxY = canvas.height - (lines.length * lineHeight) - 20;

        context.textAlign = 'left';
        context.textBaseline = 'top';
        context.font = `${Math.ceil(fontSize * 0.95)}px Arial`;
        const strokeWidth = Math.max(1, Math.round(fontSize * 0.12));
        context.lineWidth = strokeWidth;
        context.strokeStyle = 'rgba(0,0,0,0.75)';
        context.fillStyle = 'white';
        for (let i = 0; i < lines.length; i++) {
          const x = boxX + padding;
          const y = boxY + padding + i * lineHeight;
          context.strokeText(lines[i], x, y);
          context.fillText(lines[i], x, y);
        }
      }

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
              setCapturedMedia([{ id: photoId, url: objectUrl, type: 'photo', caption: captionRef.current }]);
            } else {
              // Put newest media at the start so newest appears on the left
              setCapturedMedia(prev => [{ id: photoId, url: objectUrl, type: 'photo', caption: captionRef.current }, ...prev]);
            }
          } catch (error) {
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

      toast.success("Đang bắt đầu quay video...");

      const video = videoRef.current;
      const { naturalW, naturalH } = await ensureVideoReady(video);
      // Prefer crop derived from the on-screen preview (object-fit: cover) so preview == recorded
      let crop = null;
      if (previewContainerRef.current) {
        crop = computeVisibleNaturalCrop(video, previewContainerRef.current);
      }
      const { sx, sy, cropW, cropH } = crop || computePortraitCropBox(naturalW, naturalH);

      // Use optimized dimensions for video recording (720p/1080p) to reduce processing load and file size
      const target = isHD ? VIDEO_TARGET_DIMENSIONS.hd : VIDEO_TARGET_DIMENSIONS.standard;
      const canvas = document.createElement('canvas');
      canvas.width = target.width;
      canvas.height = target.height;
      canvasRef.current = canvas;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const drawFrame = () => {
        if (!ctx || !videoRef.current) return;
        // Draw the cropped natural region scaled into our higher-res canvas
        ctx.drawImage(videoRef.current, sx, sy, cropW, cropH, 0, 0, canvas.width, canvas.height);

        const timestamp = format(new Date(), 'HH:mm:ss dd/MM/yyyy', { locale: vi });
        const fontSize = Math.max(18, Math.round(canvas.width * 0.023));
        ctx.font = `${fontSize}px Arial`;
        ctx.fillStyle = 'white';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.fillText(timestamp, canvas.width - 10, canvas.height - 10);

        // Draw caption if present
        const cap = captionRef.current;
        if (cap) {
          const maxWidth = Math.round(canvas.width * 0.8);
          const lineHeight = Math.round(fontSize * 1.15);
          ctx.font = `${Math.ceil(fontSize * 0.95)}px Arial`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          // Simple single-line trim if too long
          let displayText = cap;
          while (ctx.measureText(displayText).width > maxWidth && displayText.length > 0) {
            displayText = displayText.slice(0, -1);
          }
          if (displayText !== cap) displayText = displayText.slice(0, -3) + '...';

          const padding = 10;
          const boxX = 10;
          const boxY = canvas.height - lineHeight - 20;
          ctx.font = `${Math.ceil(fontSize * 0.95)}px Arial`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.lineWidth = Math.max(1, Math.round(fontSize * 0.12));
          ctx.strokeStyle = 'rgba(0,0,0,0.75)';
          ctx.fillStyle = 'white';
          const x = boxX + padding;
          const y = boxY + padding / 2;
          ctx.strokeText(displayText, x, y);
          ctx.fillText(displayText, x, y);
        }

        animationFrameIdRef.current = requestAnimationFrame(drawFrame);
      };
      drawFrame();

      const canvasStream = canvas.captureStream(30); // Reduce to 30fps stable (or lower if needed)
      const videoTrackWithOverlay = canvasStream.getVideoTracks()[0];

      // Get existing audio tracks, or attempt to request microphone now if none present.
      let audioTracks = streamRef.current.getAudioTracks();
      if (!audioTracks || audioTracks.length === 0) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioTracks = audioStream.getAudioTracks();
          // Attach audio tracks to the main stream so they stop when the camera stream is stopped
          audioTracks.forEach(track => streamRef.current?.addTrack(track));
        } catch (err: any) {
          // Microphone unavailable or permission denied - proceed without audio
          toast.warning('Không tìm thấy micro hoặc quyền micro bị từ chối — quay video sẽ không có âm thanh.');
          audioTracks = [];
        }
      }

      // Combine video with overlay and original audio (if any)
      const combinedStream = new MediaStream([videoTrackWithOverlay, ...audioTracks]);

      if (!supportedMimeType) {
        toast.error("Trình duyệt của bạn không hỗ trợ quay video.");
        console.error("No supported MIME type found for MediaRecorder.");
        // Clean up the animation frame if recorder fails to start
        if (animationFrameIdRef.current) {
          cancelAnimationFrame(animationFrameIdRef.current);
          animationFrameIdRef.current = null;
        }
        return;
      }

      try {
        // Now use the combined stream for the recorder
        mediaRecorderRef.current = new MediaRecorder(combinedStream, { 
          mimeType: supportedMimeType as string,
          videoBitsPerSecond: 2500000 // Limit bitrate to ~2.5Mbps to reduce file size and memory usage
        });
        recordedChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };

        mediaRecorderRef.current.onstop = async () => {
          const videoBlob = new Blob(recordedChunksRef.current, { type: supportedMimeType as string });
          const videoId = uuidv4();
          try {
            await photoStore.addPhoto(videoId, videoBlob);
            const url = URL.createObjectURL(videoBlob);
            // Put newest media at the start so newest appears on the left
            setCapturedMedia(prev => [{ id: videoId, url, type: 'video', caption: captionRef.current }, ...prev]);
          } catch (error) {
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
      // Captions are now embedded into the media blobs themselves; submit the media list only.
      await onSubmit(capturedMedia);
    } finally {
      setIsSubmitting(false);
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleDialogClose()} dialogTag="camera-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent
        hideClose={true}
        overlayClassName={parentDialogTag.includes("dialog") ? "bg-transparent" : undefined}
        className="max-h-[95vh] max-w-3xl p-0 overflow-hidden border-none bg-transparent rounded-[30px] sm:rounded-[40px] shadow-2xl"
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
              <DialogTitle className="text-xl text-white font-bold tracking-tight">Bằng chứng</DialogTitle>
              <DialogDescription className="text-sm text-white/70 italic line-clamp-1">
                {singlePhotoMode ? 'Vui lòng chụp 1 tấm ảnh' : 'Chụp ảnh hoặc video'}
              </DialogDescription>
              {contextText && (
                <p className="mt-2 text-sm text-white/80 italic max-w-[40rem] line-clamp-3">{contextText}</p>
              )}
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
                    : 'Bạn đã từ chối quyền truy cập camera. Vui lòng bật quyền Camera cho trang này trong cài đặt trình duyệt.'}
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" size="lg" className="bg-white text-black hover:bg-white/90 border-none rounded-full px-8 py-6 h-auto font-bold shadow-xl" onClick={startCamera}>
                    <RefreshCw className={`mr-2 h-5 w-5 ${isStarting ? 'animate-spin' : ''}`} />
                    Thử lại
                  </Button>
                  <Button variant="ghost" size="lg" className="text-white/90 hover:text-white" onClick={() => window.open('https://support.google.com/chrome/answer/2693767', '_blank')}>
                    Cách bật quyền
                  </Button>
                </div>
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
          <div className="fixed bottom-8 inset-x-0 z-50 pointer-events-none">
            <div className="grid grid-cols-3 items-center w-full max-w-sm mx-auto pointer-events-auto px-4">
              <div className="flex items-center justify-start gap-3">
                {captureMode === 'both' && !isRecording && (
                  <button
                    onClick={() => setCurrentMode(currentMode === 'photo' ? 'video' : 'photo')}
                    className="h-12 w-12 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 flex items-center justify-center text-white transition-all duration-300 active:scale-90 shadow-2xl backdrop-blur-xl"
                  >
                    {currentMode === 'photo' ? <Video className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
                  </button>
                )}
                {allowCaption && !isRecording && (
                  <button
                    onClick={() => setIsCaptionVisible(!isCaptionVisible)}
                    className={cn(
                      "h-12 w-12 rounded-full border flex items-center justify-center transition-all duration-300 active:scale-90 shadow-2xl backdrop-blur-xl",
                      isCaptionVisible
                        ? "bg-primary text-primary-foreground border-transparent ring-4 ring-primary/30"
                        : "bg-black/40 hover:bg-black/60 border-white/10 text-white"
                    )}
                    title="Thêm mô tả"
                  >
                    <MessageSquareText className={cn("h-5 w-5 transition-transform duration-200", isCaptionVisible && "scale-110")} />
                  </button>
                )}
              </div>

              {/* Shutter */}
              <div className="flex items-center justify-center">
                <button
                  onClick={currentMode === 'photo' ? handleCapturePhoto : handleToggleRecording}
                  disabled={!hasPermission || isStarting || isSubmitting}
                  className={cn(
                    "relative flex items-center justify-center rounded-full transition-all duration-300 transform active:scale-90 ring-offset-black ring-offset-4",
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
              </div>

              <div className="flex items-center justify-end">
                {capturedMedia.length > 0 && !isRecording && (
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="group h-16 w-16 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xl shadow-primary/40 flex flex-col items-center justify-center gap-1 transition-all duration-500 hover:scale-110 active:scale-90"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-7 w-7 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="h-6 w-6 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Xong</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Preview Strip - fixed and transparent, positioned above controls */}
          {(capturedMedia.length > 0 || (allowCaption && isCaptionVisible)) && (
            <div className="fixed bottom-32 left-1/2 z-50 -translate-x-1/2 w-full max-w-lg pointer-events-auto">

              <AnimatePresence>
                {allowCaption && isCaptionVisible && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="px-6 pb-6"
                  >
                    <div className="relative group">
                      {/* Glow effect */}
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-purple-500/50 rounded-[28px] blur-xl opacity-20 group-hover:opacity-40 transition duration-1000"></div>

                      <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-black/60 backdrop-blur-3xl shadow-2xl">
                        <div className="absolute left-4 top-4 text-primary/80">
                          <FileText className="h-5 w-5" />
                        </div>
                        <Textarea
                          value={captionText}
                          onChange={(e) => setCaptionText((e.target as HTMLTextAreaElement).value)}
                          placeholder="Thêm mô tả cho bằng chứng này..."
                          className="min-h-[100px] w-full bg-transparent border-none text-white placeholder:text-white/30 rounded-none pl-12 pr-4 py-4 text-[15px] focus-visible:ring-0 shadow-none resize-none leading-relaxed"
                          autoFocus
                        />
                        <div className="absolute bottom-3 right-4 flex items-center gap-2">
                          <span className="text-[10px] text-white/30 font-mono tracking-tighter uppercase">
                            {captionText.length} kí tự
                          </span>
                        </div>
                        <div className="px-4 pb-3 pt-1">
                          <p className="text-xs text-white/50 italic">Lưu ý: mô tả sẽ được ghi trực tiếp lên ảnh/video khi lưu.</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="w-full">
                <div ref={previewRef} className="flex gap-3 px-6 pb-2 items-center">
                  {previewItems.map((media, idx) => {
                    const hasCaption = !!(media as any).caption;
                     const isLastPreview = idx === previewItems.length - 1 && extraCount > 0;
                    const extraPeeks = capturedMedia.slice(previewItems.length, previewItems.length + 3); // show up to 3 peeks
                    return (
                        <div
                        key={media.id}
                        // Left-first alignment: previews flow left-to-right and start flush at the left edge.
                        // - Single item: aligned left (no auto margins)
                        // - Multiple items: items flow left→right; add `mr-auto` on the last item to consume remaining space
                        className={cn(
                          "group relative flex-shrink-0 w-[15vw] min-w-0 rounded-2xl border-2 border-white/10 bg-transparent shadow-xl transition-all hover:scale-110 active:scale-95",
                          isLastPreview ? "overflow-visible" : "overflow-hidden",
                          previewItems.length === 1
                          ? ""
                          : idx === previewItems.length - 1
                            ? "mr-auto"
                            : ""
                        )}
                        role={isLastPreview ? 'button' : undefined}
                        aria-label={isLastPreview ? `Mở thư viện — còn ${extraCount} ảnh/video` : undefined}
                        tabIndex={isLastPreview ? 0 : undefined}
                        onKeyDown={(e) => { if (isLastPreview && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setShowGallery(true); } }}
                        onClick={() => { if (isLastPreview) setShowGallery(true); }}
                        >
                        <div className="relative overflow-hidden rounded-2xl" style={{ aspectRatio: `${PORTRAIT_ASPECT_RATIO}`, width: '100%' }}>
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

                        {hasCaption && (
                          <div className="absolute left-1 bottom-1 text-white text-[10px] px-2 py-0.5 rounded-md opacity-90" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.85)' }}>
                          <span className="truncate max-w-[64px]" title={(media as any).caption}>{(media as any).caption}</span>
                          </div>
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
                              <Image src={m.url} alt="peek" className="object-cover" />
                            ) : (
                              <video src={m.url} className="w-full h-full object-cover" muted />
                            )}
                            </div>
                          ))}

                          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/30 z-10 text-white text-sm font-bold pointer-events-none">
                            {extraCount}+
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
                parentDialogTag="camera-dialog"
              />
            </div>
          )}
        </div>
      </DialogContent>

      {/* Discard-confirm dialog: shown when user attempts to close with unsent media */}
      <AlertDialog 
        open={showDiscardConfirm} 
        onOpenChange={(open) => !open && setShowDiscardConfirm(false)} 
        variant="destructive"
        dialogTag="camera-discard-confirm" 
        parentDialogTag="camera-dialog"
      >
        <AlertDialogContent maxWidth="md">
          <AlertDialogHeader hideicon={false}>
            <AlertDialogTitle>Bạn có chắc chắn?</AlertDialogTitle>
            <AlertDialogDescription>
              Có {capturedMedia.length} ảnh/video chưa gửi. Nếu bạn đóng bây giờ, các media tạm thời sẽ bị xóa và không thể khôi phục.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDiscardConfirm(false)}>
              Tiếp tục chụp
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDiscardAndClose}>
              Bỏ và đóng
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </Dialog>
  );
}