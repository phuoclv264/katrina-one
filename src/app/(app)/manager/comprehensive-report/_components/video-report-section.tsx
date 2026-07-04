'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Video, Trash2, VideoIcon, CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { photoStore } from '@/lib/photo-store';
import CameraDialog from '@/components/camera-dialog';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';

export interface LocalVideo {
    id: string;
    timestamp: string;
}

export interface UploadedVideo {
    url: string;
    timestamp: string;
}

interface VideoReportSectionProps {
    localVideos: LocalVideo[];
    uploadedVideos: UploadedVideo[];
    isReadonly: boolean;
    onAddVideo: (videoId: string, timestamp: string) => void;
    onDeleteVideo: (videoId: string) => void;
    /** When true, renders without outer card wrapper and header — for embedding inside a section card */
    embedded?: boolean;
}

function LocalVideoPreview({
    video,
    onDelete,
    isReadonly,
    index,
    reporterName,
}: {
    video: LocalVideo;
    onDelete: () => void;
    isReadonly: boolean;
    index: number;
    reporterName: string;
}) {
    const [url, setUrl] = useState<string>('');

    useEffect(() => {
        let objectUrl = '';
        photoStore.getPhoto(video.id).then(blob => {
            if (blob) {
                objectUrl = URL.createObjectURL(blob);
                setUrl(objectUrl);
            }
        });
        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [video.id]);

    return (
        <div className="rounded-xl overflow-hidden border border-amber-200 dark:border-amber-800 bg-black">
            {url ? (
                <video
                    src={url}
                    className="w-full max-h-64 object-contain bg-black"
                    controls
                    playsInline
                    preload="metadata"
                />
            ) : (
                <div className="w-full h-40 flex items-center justify-center bg-slate-100 dark:bg-slate-800 animate-pulse">
                    <VideoIcon className="w-8 h-8 text-slate-400" />
                </div>
            )}
            <div className="flex items-center justify-between px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-100 dark:border-amber-800">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">{reporterName}</span>
                    <span className="text-amber-400 text-[10px]">•</span>
                    <Clock className="w-3 h-3 text-amber-600" />
                    <span className="text-[11px] font-mono font-bold text-amber-700 dark:text-amber-400">
                        {video.timestamp || '--:--'}
                    </span>
                    <span className="text-[10px] text-amber-600/70 dark:text-amber-500/70">• Chưa gửi</span>
                </div>
                {!isReadonly && (
                    <button
                        onClick={onDelete}
                        className="w-7 h-7 bg-red-500/10 hover:bg-red-500 rounded-full flex items-center justify-center transition-colors group"
                        aria-label="Xóa video"
                    >
                        <Trash2 className="w-3.5 h-3.5 text-red-500 group-hover:text-white transition-colors" />
                    </button>
                )}
            </div>
        </div>
    );
}

export function VideoReportSection({
    localVideos,
    uploadedVideos,
    isReadonly,
    onAddVideo,
    onDeleteVideo,
    embedded = false,
}: VideoReportSectionProps) {
    const { user } = useAuth();
    const reporterName = user?.displayName || user?.email?.split('@')[0] || 'Quản lý';
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    const handleCameraSubmit = useCallback(async (media: { id: string; type: 'photo' | 'video'; recordedAt?: string }[]) => {
        setIsCameraOpen(false);
        const videoMedia = media.filter(m => m.type === 'video');
        for (const item of videoMedia) {
            onAddVideo(item.id, item.recordedAt || format(new Date(), 'HH:mm'));
        }
    }, [onAddVideo]);

    const totalCount = localVideos.length + uploadedVideos.length;

    const videoListContent = (
        <div className={cn('space-y-3', !embedded && 'p-4')}>
            {totalCount === 0 && !embedded && (
                <div className="flex flex-col items-center gap-2 py-6 text-slate-400">
                    <VideoIcon className="w-8 h-8" />
                    <p className="text-[12px] font-medium">Chưa có video báo cáo</p>
                    <p className="text-[11px]">Nhấn nút bên dưới để quay video</p>
                </div>
            )}

            {/* Uploaded videos — green border, sent timestamp */}
            {uploadedVideos.map((video, idx) => (
                <div key={`uploaded-${idx}`} className="rounded-xl overflow-hidden border border-green-200 dark:border-green-800 bg-black">
                    <video
                        src={video.url}
                        className="w-full max-h-64 object-contain bg-black"
                        controls
                        playsInline
                        preload="metadata"
                    />
                    <div className="flex items-center gap-1.5 flex-wrap px-3 py-2 bg-green-50 dark:bg-green-900/20 border-t border-green-100 dark:border-green-800">
                        <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                        <span className="text-[11px] font-bold text-green-600">Đã gửi</span>
                        <span className="text-green-400 text-[10px]">•</span>
                        <span className="text-[11px] font-bold text-green-700 dark:text-green-400">{reporterName}</span>
                        <span className="text-green-400 text-[10px]">•</span>
                        <Clock className="w-3 h-3 text-green-500" />
                        <span className="text-[11px] font-mono font-bold text-green-600">{video.timestamp || '--:--'}</span>
                    </div>
                </div>
            ))}

            {/* Local (pending) videos — amber border, pending timestamp */}
            {localVideos.map((video, idx) => (
                <LocalVideoPreview
                    key={video.id}
                    video={video}
                    index={idx}
                    onDelete={() => onDeleteVideo(video.id)}
                    isReadonly={isReadonly}
                    reporterName={reporterName}
                />
            ))}

            {!isReadonly && (
                <Button
                    variant="outline"
                    className={cn(
                        'w-full h-11 font-bold rounded-xl border-dashed',
                        totalCount > 0
                            ? 'border-slate-300 text-slate-600'
                            : 'border-primary/40 text-primary hover:bg-primary/5'
                    )}
                    onClick={() => setIsCameraOpen(true)}
                >
                    <Video className="w-4 h-4 mr-2" />
                    {totalCount > 0 ? 'Quay thêm video' : 'Quay video báo cáo'}
                </Button>
            )}
        </div>
    );

    const cameraDialog = (
        <CameraDialog
            isOpen={isCameraOpen}
            onClose={() => setIsCameraOpen(false)}
            onSubmit={handleCameraSubmit}
            captureMode="video"
            parentDialogTag="root"
            contextText="Quay video báo cáo tình hình ca làm việc"
            allowCaption={false}
        />
    );

    if (embedded) {
        return (
            <>
                {videoListContent}
                {cameraDialog}
            </>
        );
    }

    return (
        <div className="mb-5 bg-white dark:bg-slate-900 border rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50/80 dark:bg-slate-800/80 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Video Báo Cáo
                    </h3>
                </div>
                {totalCount > 0 && (
                    <span className="text-[11px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {totalCount} video
                    </span>
                )}
            </div>
            {videoListContent}
            {cameraDialog}
        </div>
    );
}