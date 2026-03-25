'use client';

import Image from '@/components/ui/image';
import { AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ShiftReport, ComprehensiveTaskSection, CompletionRecord } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLightbox } from '@/contexts/lightbox-context';

interface SectionReportViewerProps {
    section: ComprehensiveTaskSection;
    report: ShiftReport;
    allPagePhotos: { src: string, description: string }[];
}

export function SectionReportViewer({ section, report, allPagePhotos }: SectionReportViewerProps) {
    const { openLightbox } = useLightbox();
    
    const reports = report.sectionReports?.[section.title] || [];
    const sortedReports = [...reports].sort((a, b) => {
        // Sort descending (newest first)
        if (a.timestamp > b.timestamp) return -1;
        if (a.timestamp < b.timestamp) return 1;
        return 0;
    });

    const handleOpenLightbox = (photoUrl: string) => {
        const index = allPagePhotos.findIndex(p => p.src === photoUrl);
        if (index > -1) {
            openLightbox(allPagePhotos, index);
        }
    };

    return (
        <Card className="overflow-hidden border-primary/20">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 p-4 border-b flex flex-row items-center justify-between gap-4 space-y-0">
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                    {section.title}
                </CardTitle>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-primary shrink-0 rounded-full">
                            <AlertCircle className="h-5 w-5" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-80 p-0 shadow-xl rounded-xl">
                        <div className="bg-slate-50 border-b p-3">
                            <h4 className="font-bold text-sm text-slate-900">Danh sách công việc</h4>
                        </div>
                        <div className="p-2 max-h-[300px] overflow-y-auto">
                            <ul className="space-y-1">
                                {section.tasks.map(task => (
                                    <li key={task.id} className="flex items-start gap-2 p-2 hover:bg-slate-50 rounded-md text-sm text-slate-700">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary/40 mt-1.5 shrink-0" />
                                        <span>{task.text}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </PopoverContent>
                </Popover>
            </CardHeader>
            <CardContent className="p-4 space-y-6">
                
                {/* Reports Timeline */}
                <div>
                    {sortedReports.length > 0 ? (
                        <div className="space-y-4">
                            {sortedReports.map((r, idx) => (
                                <div key={idx} className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                                        {idx !== sortedReports.length - 1 && (
                                            <div className="w-0.5 h-full bg-slate-100 dark:bg-slate-800 my-1" />
                                        )}
                                    </div>
                                    <div className="flex-1 pb-4">
                                        <p className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-1.5 mt-0.5">
                                            <Clock className="w-3.5 h-3.5" />
                                            {r.timestamp}
                                        </p>
                                        <p className="text-[14px] text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                            {r.text}
                                        </p>
                                        {r.photos && r.photos.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {r.photos.map((photoUrl, pIdx) => (
                                                    <button
                                                        onClick={() => handleOpenLightbox(photoUrl)}
                                                        key={`${photoUrl}-${pIdx}`}
                                                        className="relative z-0 overflow-hidden w-16 h-16 rounded-xl hover:opacity-90 transition-opacity ring-1 ring-black/5"
                                                    >
                                                        <Image src={photoUrl} alt={`Ảnh ${pIdx + 1}`} fill className="object-cover" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[13px] text-slate-500 italic bg-slate-50/50 p-3 rounded-lg text-center border border-dashed">
                            Chưa có báo cáo
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
