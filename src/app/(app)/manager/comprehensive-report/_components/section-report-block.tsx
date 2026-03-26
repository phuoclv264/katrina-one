import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Send, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task, ComprehensiveTaskSection, ShiftReport } from '@/lib/types';
import { photoStore } from '@/lib/photo-store';
import Image from 'next/image';
import { useLightbox } from '@/contexts/lightbox-context';

interface SectionReportBlockProps {
    section: ComprehensiveTaskSection;
    report: ShiftReport;
    isReadonly: boolean;
    onAddReport: (sectionTitle: string, text: string) => void;
    onPhotoAction: (task: Task) => void;
}

function LocalPhotoPreview({ photoId, onClick }: { photoId: string, onClick?: (url: string) => void }) {
    const [url, setUrl] = useState<string>('');

    useEffect(() => {
        let objectUrl = '';
        photoStore.getPhoto(photoId).then(blob => {
            if (blob) {
                objectUrl = URL.createObjectURL(blob);
                setUrl(objectUrl);
            }
        });
        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [photoId]);

    if (!url) return <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" />;

    {/* eslint-disable-next-line @next/next/no-img-element */}
    return (
        <img 
            src={url} 
            alt="Local Preview" 
            className="w-14 h-14 object-cover rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer hover:opacity-80 transition-opacity" 
            onClick={() => onClick?.(url)}
        />
    );
}

export function SectionReportBlock({
    section,
    report,
    isReadonly,
    onAddReport,
    onPhotoAction
}: SectionReportBlockProps) {
    const [text, setText] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);
    const { openLightbox } = useLightbox();
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const newHeight = Math.min(textareaRef.current.scrollHeight, 180); // ~7 lines (20px * 7 + padding/border)
            textareaRef.current.style.height = `${newHeight}px`;
            textareaRef.current.style.overflowY = textareaRef.current.scrollHeight > 180 ? 'auto' : 'hidden';
        }
    }, [text]);

    const handleSubmit = () => {
        if (!text.trim()) return;
        onAddReport(section.title, text);
        setText('');
    };

    const sectionHistory = useMemo(() => {
        const history = report.sectionReports?.[section.title] || [];
        // Sort newest first
        return [...history].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }, [report.sectionReports, section.title]);

    const displayHistory = isExpanded ? sectionHistory : sectionHistory.slice(0, 2);
    const hasMore = sectionHistory.length > 2;

    // Helper to get all photos for lightbox
    const historyPhotos = useMemo(() => {
        const photos: { src: string; description: string }[] = [];
        const localPhotoUrls = new Map<string, string>(); // We can't easily resolve these sync here for the whole list
        
        sectionHistory.forEach(r => {
            if (r.photos) {
                r.photos.forEach(url => photos.push({ src: url, description: r.text }));
            }
            // For local photos, we'd need them as URLs. 
            // Since they are local blobs, a full gallery across items is complex.
            // We'll prioritize opening the single clicked image for local ones.
        });
        return photos;
    }, [sectionHistory]);

    const handleOpenRemoteLightbox = (url: string) => {
        const index = historyPhotos.findIndex(p => p.src === url);
        if (index > -1) {
            openLightbox(historyPhotos, index);
        }
    };

    return (
        <div className="mb-5 bg-white dark:bg-slate-900 border rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-50/80 dark:bg-slate-800/80 border-b">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    {section.title}
                </h3>
            </div>

            <div className="p-4 space-y-4">
                <ul className="space-y-2">
                    {section.tasks.map((task) => {
                        const completionsStr = report.completedTasks[task.id] || [];
                        const hasPhotos = completionsStr.some(c => (c.photoIds && c.photoIds.length > 0) || (c.photos && c.photos.length > 0));
                        return (
                            <li key={task.id} className="flex justify-between items-start gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                <span className="text-[13px] font-medium text-slate-700 dark:text-slate-300 leading-snug mt-1">
                                    • {task.text}
                                </span>
                                {task.type === 'photo' && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className={cn(
                                            "shrink-0 h-8 text-[11px] font-bold rounded-lg",
                                            hasPhotos ? "border-green-500 text-green-600 bg-green-50 dark:bg-green-500/10" : ""
                                        )}
                                        onClick={() => onPhotoAction(task)}
                                        disabled={isReadonly}
                                    >
                                        <Camera className="w-3.5 h-3.5 mr-1.5" />
                                        {hasPhotos ? 'Đã chụp' : 'Chụp ảnh'}
                                    </Button>
                                )}
                            </li>
                        );
                    })}
                </ul>

                <div className="flex gap-2 items-end">
                    <textarea
                        ref={textareaRef}
                        className="flex-1 min-h-[44px] max-h-[180px] resize-none border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-[13px] bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-slate-400"
                        placeholder="Nhập báo cáo..."
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        disabled={isReadonly}
                    />
                    <Button
                        onClick={handleSubmit}
                        disabled={isReadonly || !text.trim()}
                        className="rounded-xl shadow-sm h-11 w-11 flex-shrink-0"
                        size="icon"
                    >
                        <Send className="w-4 h-4" />
                    </Button>
                </div>

                {sectionHistory.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-dashed border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5 text-slate-500">
                                <Clock className="w-3.5 h-3.5" />
                                <h4 className="text-[10px] font-bold uppercase tracking-wider">
                                    Lịch sử báo cáo
                                </h4>
                            </div>
                            {hasMore && (
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    className="h-6 text-[10px] font-bold uppercase text-primary hover:text-primary hover:bg-primary/10 rounded-lg px-2"
                                >
                                    {isExpanded ? (
                                        <span className="flex items-center gap-1"><ChevronUp className="w-3 h-3" /> Thu gọn</span>
                                    ) : (
                                        <span className="flex items-center gap-1"><ChevronDown className="w-3 h-3" /> Xem tất cả ({sectionHistory.length})</span>
                                    )}
                                </Button>
                            )}
                        </div>
                        <div className="space-y-2.5 pl-1">
                            {displayHistory.map((r, i) => (
                                <div key={i} className="flex gap-3 text-[13px] flex-col animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="flex gap-3">
                                        <span className="font-mono font-medium text-slate-400 shrink-0 mt-0.5">
                                            {r.timestamp}
                                        </span>
                                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                                            {r.text}
                                        </span>
                                    </div>
                                    <div className="pl-14 flex flex-wrap gap-2">
                                        {r.photos?.map((url, pIdx) => (
                                            /* eslint-disable-next-line @next/next/no-img-element */
                                            <img 
                                                key={`remote-${pIdx}`} 
                                                src={url} 
                                                alt={`Ânh ${pIdx + 1}`} 
                                                className="w-14 h-14 object-cover rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer hover:opacity-80 transition-opacity" 
                                                onClick={() => handleOpenRemoteLightbox(url)}
                                            />
                                        ))}
                                        {r.photoIds?.map((id, pIdx) => (
                                            <LocalPhotoPreview 
                                                key={`local-${pIdx}`} 
                                                photoId={id} 
                                                onClick={(url) => openLightbox([{ src: url, description: r.text }], 0)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
