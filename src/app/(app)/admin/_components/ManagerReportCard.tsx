'use client';

import { cn } from '@/lib/utils';
import type { ShiftReport, ComprehensiveTaskSection } from '@/lib/types';
import { CheckCircle, Clock, Video, VideoIcon } from 'lucide-react';

interface ManagerReportCardProps {
  managerTasks: ComprehensiveTaskSection[];
  managerReport: ShiftReport | null;
}

const PERFORMANCE_SECTION_KEYWORD = 'Báo cáo hiệu suất';

export function ManagerReportCard({ managerTasks, managerReport }: ManagerReportCardProps) {
  if (!managerReport) {
    return null;
  }

  const performanceSections = managerTasks.filter(s => s.title.includes(PERFORMANCE_SECTION_KEYWORD));
  const videoUrls = managerReport.videoUrls || [];
  const videoTimestamps = managerReport.videoTimestamps || [];
  const videoStaffNames = managerReport.videoStaffNames || [];
  // Fallback name for single-manager reports (no videoStaffNames stored)
  const fallbackName = managerReport.staffName || 'Quản lý';

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-0.5">
          📋 Phiếu kiểm tra {managerReport.status === 'ongoing' ? '(Đang thực hiện)' : '(Đã hoàn thành)'}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {managerReport.staffName}
        </p>
      </div>

      {/* Video reports */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-700/40 border-b border-slate-200 dark:border-slate-700">
          <Video className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Video Báo Cáo</span>
          {videoUrls.length > 0 && (
            <span className="ml-auto text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
              {videoUrls.length}
            </span>
          )}
        </div>
        <div className="p-3 space-y-3">
          {videoUrls.length === 0 ? (
            <div className="flex items-center gap-2 py-2 text-slate-400">
              <VideoIcon className="w-4 h-4 shrink-0" />
              <p className="text-xs italic">Chưa có video báo cáo</p>
            </div>
          ) : (
            videoUrls.map((url, idx) => (
              <div key={`${url}-${idx}`} className="rounded-lg overflow-hidden border border-green-200 dark:border-green-800 bg-black">
                <video
                  src={url}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full max-h-52 object-contain bg-black"
                />
                <div className="flex items-center gap-1.5 flex-wrap px-2.5 py-1.5 bg-green-50 dark:bg-green-900/20 border-t border-green-100 dark:border-green-800">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  <span className="text-[10px] font-bold text-green-600">Đã gửi</span>
                  <span className="text-green-400 text-[9px]">•</span>
                  <span className="text-[10px] font-bold text-green-700 dark:text-green-400">
                    {videoStaffNames[idx] || fallbackName}
                  </span>
                  <span className="text-green-400 text-[9px]">•</span>
                  <Clock className="w-2.5 h-2.5 text-green-500" />
                  <span className="text-[10px] font-mono font-bold text-green-600">
                    {videoTimestamps[idx] || '--:--'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Báo cáo hiệu suất sections */}
      {performanceSections.length > 0 && (
        <div className="space-y-3">
          {performanceSections.map(section => {
            const sectionReports = managerReport.sectionReports?.[section.title] || [];
            const sorted = [...sectionReports].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
            return (
              <div key={section.title} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-700/40 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    {section.title}
                  </h3>
                  {sectionReports.length > 0 && (
                    <span className="text-[10px] font-bold text-slate-400">{sectionReports.length} báo cáo</span>
                  )}
                </div>
                <div className="p-3">
                  {sorted.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Chưa có báo cáo hiệu suất</p>
                  ) : (
                    <div className="space-y-2">
                      {sorted.map((r, idx) => (
                        <div key={idx} className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-2.5 text-xs">
                          <div className="flex items-start justify-between gap-2 mb-0.5">
                            <p className="text-slate-700 dark:text-slate-300 flex-1 leading-snug">{r.text}</p>
                            <span className="font-mono font-medium text-slate-400 whitespace-nowrap shrink-0 flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />{r.timestamp}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {managerReport.issues && (
        <div className="text-xs text-slate-600 dark:text-slate-400 italic bg-amber-50 dark:bg-amber-500/10 p-3 rounded-xl border border-amber-200/50 dark:border-amber-500/20">
          Ghi chú: "{managerReport.issues}"
        </div>
      )}
    </div>
  );
}

