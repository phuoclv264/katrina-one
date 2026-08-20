'use client';

import Link from 'next/link';
import type { ShiftReport, ComprehensiveTaskSection } from '@/lib/types';
import { Clock } from 'lucide-react';

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

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-0.5">
            📋 Phiếu kiểm tra {managerReport.status === 'ongoing' ? '(Đang thực hiện)' : '(Đã hoàn thành)'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {managerReport.staffName}
          </p>
        </div>

        <Link
          href={`/reports/comprehensive?date=${managerReport.date || new Date().toISOString().slice(0, 10)}`}
          className="inline-flex items-center rounded-full bg-primary px-2.5 py-1.5 text-[10px] font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Xem chi tiết
        </Link>
      </div>

      {performanceSections.length > 0 ? (
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
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30 p-3 text-xs text-slate-400 italic">
          Chưa có báo cáo hiệu suất
        </div>
      )}
    </div>
  );
}

