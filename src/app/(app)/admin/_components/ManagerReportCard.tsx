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
  if (!managerReport) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
      {/* Header */}
      <div className="mb-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">
          📋 Phiếu kiểm tra của Quản lý {managerReport.status === 'ongoing' ? '(Đang thực hiện)' : '(Đã hoàn thành)'}
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
          Nhân viên: {managerReport.staffName}
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {managerTasks.length > 0 ? (
          managerTasks.map((section) => {
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
                    {sectionReports.map((report: any, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-50 dark:bg-slate-700/30 rounded p-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2 mb-0.5">
                          <p className="text-slate-700 dark:text-slate-300 flex-1 line-clamp-3">
                            {report.managerName && (
                              <span className="font-bold text-blue-600 dark:text-blue-400 mr-1.5 uppercase tracking-tighter text-[10px]">
                                [{report.managerName}]
                              </span>
                            )}
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
            )
          })
        ) : (
          <div className="py-8 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Chưa có danh mục công việc nào được thiết lập cho Quản lý.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
