'use client';

import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { ShiftReport, ComprehensiveTaskSection } from '@/lib/types';

interface ManagerReportCardProps {
  managerTasks: ComprehensiveTaskSection[];
  managerReport: ShiftReport | null;
}

export function ManagerReportCard({ managerTasks, managerReport }: ManagerReportCardProps) {
  if (!managerTasks.length || !managerReport) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
      {/* Header */}
      <div className="mb-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">
          📋 Phiếu kiểm tra của Quản lý
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {format(new Date(), 'EEEE, dd/MM/yyyy', { locale: vi })}
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {managerTasks.map((section) => {
          const sectionReports = managerReport.sectionReports?.[section.title] || [];

          return (
            <div
              key={section.title}
              className="border border-slate-200 dark:border-slate-700 rounded-lg p-3"
            >
              {/* Section Title */}
              <div className="mb-2">
                <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                  {section.title}
                </h3>
              </div>

              {/* Section Reports/Entries */}
              {sectionReports.length > 0 ? (
                <div className="space-y-2 mb-3">
                  {sectionReports.map((report, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-50 dark:bg-slate-700/30 rounded p-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <p className="text-slate-700 dark:text-slate-300 flex-1 line-clamp-2">
                          {report.text}
                        </p>
                        <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap flex-shrink-0">
                          {report.timestamp}
                        </span>
                      </div>
                      {report.photoIds && report.photoIds.length > 0 && (
                        <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                          📸 {report.photoIds.length}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                  Chưa có báo cáo
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* General Notes */}
      {managerReport.issues && (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
          <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-2">
            <h4 className="font-semibold text-slate-900 dark:text-white text-xs mb-1">
              Ghi chú chung
            </h4>
            <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap line-clamp-3">
              {managerReport.issues}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
