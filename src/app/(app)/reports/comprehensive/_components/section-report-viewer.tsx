'use client';

import Image from '@/components/ui/image';
import { Clock, TrendingUp } from 'lucide-react';
import type { ShiftReport, ComprehensiveTaskSection } from '@/lib/types';
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
        <Card className="overflow-hidden">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 p-4 border-b space-y-0">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    {section.title}
                    <span className="ml-auto text-[11px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {sortedReports.length} báo cáo
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
                {sortedReports.length > 0 ? (
                    <div className="space-y-3">
                        {sortedReports.map((r, idx) => (
                            <div key={idx} className="flex gap-3">
                                <div className="flex flex-col items-center pt-1">
                                    <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                                    {idx !== sortedReports.length - 1 && (
                                        <div className="w-0.5 flex-1 bg-slate-100 dark:bg-slate-800 my-1" />
                                    )}
                                </div>
                                <div className="flex-1 pb-2">
                                    <p className="text-[11px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
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
                        Chưa có báo cáo hiệu suất
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
