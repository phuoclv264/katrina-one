'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, Circle, ChevronDown, Eye } from 'lucide-react';
import { useAppNavigation } from '@/contexts/app-navigation-context';
import type { MonthlyTask, MonthlyTaskAssignment, TaskCompletionRecord, ManagedUser } from '@/lib/types';
import { useLightbox } from '@/contexts/lightbox-context';
import { formatTime } from '@/lib/utils';

interface RecurringTasksCardProps {
  monthlyTasks: MonthlyTask[];
  taskAssignments: MonthlyTaskAssignment[];
  staffDirectory?: ManagedUser[];
}

type StaffStatus = {
  userId: string;
  userName: string;
  shiftLabels: string[];
  status: 'completed' | 'reported' | 'pending';
  completion?: TaskCompletionRecord;
};

type TaskSummary = {
  taskId: string;
  taskName: string;
  description: string;
  totalAssigned: number;
  completed: number;
  reported: number;
  pending: number;
  staffStatuses: StaffStatus[];
  additionalReports: TaskCompletionRecord[];
};

export function RecurringTasksCard({ monthlyTasks, taskAssignments, staffDirectory = [] }: RecurringTasksCardProps) {
  const navigation = useAppNavigation();
  const { openLightbox } = useLightbox();
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const staffById = useMemo(() => {
    const map = new Map<string, ManagedUser>();
    staffDirectory.forEach((staff) => map.set(staff.uid, staff));
    return map;
  }, [staffDirectory]);

  // Build per-task summaries from assignments similar to TodaysAdminTasksCard
  const taskSummaries = useMemo(() => {
    if (taskAssignments.length === 0) {
      return [];
    }

    const definedTasks = new Map(monthlyTasks.map((task) => [task.id, task]));
    const assignmentsByTask = new Map<string, MonthlyTaskAssignment[]>();
    
    taskAssignments.forEach((assignment) => {
      if (!assignmentsByTask.has(assignment.taskId)) {
        assignmentsByTask.set(assignment.taskId, []);
      }
      assignmentsByTask.get(assignment.taskId)!.push(assignment);
    });

    return Array.from(assignmentsByTask.entries()).map(([taskId, assignments]) => {
      const fallbackAssignment = assignments[0];
      const baseTask: MonthlyTask = definedTasks.get(taskId) ?? ({
        id: taskId,
        name: fallbackAssignment?.taskName ?? 'Công việc không xác định',
        description: fallbackAssignment?.description ?? '',
        appliesToRole: 'Tất cả',
        schedule: { type: 'weekly', daysOfWeek: [] },
      } as MonthlyTask);

      const responsibleUserMap = new Map<
        string,
        { userId: string; userName: string; shiftLabels: Set<string> }
      >();
      const completionByUser = new Map<string, TaskCompletionRecord>();
      const additionalReports: TaskCompletionRecord[] = [];

      assignments.forEach((assignment) => {
        assignment.responsibleUsersByShift.forEach(({ shiftLabel, users }) => {
          users.forEach((user) => {
            const existing = responsibleUserMap.get(user.userId);
            if (existing) {
              existing.shiftLabels.add(shiftLabel);
            } else {
              responsibleUserMap.set(user.userId, {
                userId: user.userId,
                userName: user.userName,
                shiftLabels: new Set([shiftLabel]),
              });
            }
          });
        });

        assignment.completions.forEach((completion) => {
          const userId = completion.completedBy?.userId;
          if (userId) {
            completionByUser.set(userId, completion);
          }
        });

        assignment.otherCompletions.forEach((completion) => {
          additionalReports.push(completion);
        });
      });

      const staffStatuses: StaffStatus[] = Array.from(responsibleUserMap.values()).map(
        ({ userId, userName, shiftLabels }) => {
          const completion = completionByUser.get(userId);
          let status: StaffStatus['status'] = 'pending';

          if (completion?.completedAt) {
            status = 'completed';
          } else if (completion?.note) {
            status = 'reported';
          }

          return {
            userId,
            userName,
            shiftLabels: Array.from(shiftLabels),
            status,
            completion,
          };
        },
      );

      const completed = staffStatuses.filter((s) => s.status === 'completed').length;
      const reported = staffStatuses.filter((s) => s.status === 'reported').length;
      const totalAssigned = staffStatuses.length;
      const pending = Math.max(totalAssigned - completed - reported, 0);

      return {
        taskId,
        taskName: baseTask.name,
        description: baseTask.description,
        totalAssigned,
        completed,
        reported,
        pending,
        staffStatuses,
        additionalReports,
      };
    });
  }, [taskAssignments, monthlyTasks, staffById]);

  const taskStats = useMemo(() => {
    const totalTasks = taskSummaries.length;
    const completedTasks = taskSummaries.filter((t) => t.completed > 0 || t.reported > 0).length;
    const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      total: totalTasks,
      completed: completedTasks,
      percentage: completionPercentage,
    };
  }, [taskSummaries]);

  const toggleTask = useCallback((taskId: string) => {
    setExpandedTaskId((prev) => (prev === taskId ? null : taskId));
  }, []);

  const handleLightboxOpen = useCallback((media: any[] | undefined) => {
    if (!media || media.length === 0) return;
    
    const slides = media.map((attachment) =>
      attachment.type === 'video'
        ? {
            type: 'video' as const,
            sources: [
              { src: attachment.url, type: 'video/mp4' },
              { src: attachment.url, type: 'video/webm' },
            ],
          }
        : { src: attachment.url },
    );
    openLightbox(slides, 0);
  }, [openLightbox]);

  if (taskSummaries.length === 0) {
    return (
      <div className="bg-gradient-to-br from-indigo-600 to-blue-700 dark:from-indigo-700 dark:to-blue-800 rounded-2xl shadow-lg p-5 text-white relative overflow-hidden">
        <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
        <div className="absolute -left-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
        <div className="relative">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4" />
              Công việc định kỳ hôm nay
            </h3>
          </div>
          <p className="text-sm opacity-80">Không có nhiệm vụ hôm nay</p>
          <button
            onClick={() => navigation.push('/task-lists')}
            className="w-full mt-3 py-2 text-sm font-semibold text-white hover:bg-white/10 rounded-lg border border-white/20 transition"
          >
            Xem tất cả công việc
          </button>
        </div>
      </div>
    );
  }

  const renderStaffList = (
    label: string,
    staff: StaffStatus[],
    status: StaffStatus['status'],
  ) => {
    const statusStyles: Record<StaffStatus['status'], { className: string; icon: React.JSX.Element }> = {
      completed: {
        className: 'text-emerald-300',
        icon: <CheckCircle className="h-3.5 w-3.5" />,
      },
      reported: {
        className: 'text-amber-300',
        icon: <AlertCircle className="h-3.5 w-3.5" />,
      },
      pending: {
        className: 'text-gray-300',
        icon: <Circle className="h-3.5 w-3.5" />,
      },
    };

    return (
      <div>
        <div className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase mb-2 ${statusStyles[status].className}`}>
          {statusStyles[status].icon}
          <span>{label}</span>
        </div>
        {staff.length === 0 ? (
          <p className="text-[11px] opacity-60">Không có ghi nhận.</p>
        ) : (
          <div className="space-y-1.5">
            {staff.map((item) => (
              <div key={item.userId} className="flex items-start justify-between bg-white/5 rounded px-2 py-1.5 border border-white/10">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium truncate">{item.userName}</p>
                  <p className="text-[10px] opacity-70 truncate">{item.shiftLabels.join(', ')}</p>
                  {item.status === 'reported' && item.completion?.note && (
                    <p className="text-[10px] text-amber-300 mt-0.5 line-clamp-2">"{item.completion.note}"</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 ml-2">
                  {item.status === 'completed' && item.completion?.completedAt && (
                    <span className="text-[10px] font-semibold text-emerald-300">
                      {formatTime(item.completion.completedAt, 'HH:mm')}
                    </span>
                  )}
                  {item.completion?.media && item.completion.media.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLightboxOpen(item.completion?.media);
                      }}
                      className="text-[10px] text-blue-300 hover:underline inline-flex items-center gap-0.5"
                    >
                      <Eye className="h-3 w-3" />
                      Xem
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-gradient-to-br from-indigo-600 to-blue-700 dark:from-indigo-700 dark:to-blue-800 rounded-2xl shadow-lg p-6 text-white relative overflow-hidden">
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
      <div className="absolute -left-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
      <div className="relative">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-bold flex items-center gap-2 text-base">
            <CheckCircle className="h-5 w-5" />
            Công việc định kỳ hôm nay
          </h3>
          <span className="text-sm bg-white/20 px-2 py-0.5 rounded">
            {taskStats.completed}/{taskStats.total}
          </span>
        </div>
        
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1 opacity-90">
            <span>Tiến độ tổng quan</span>
            <span>{taskStats.percentage}%</span>
          </div>
          <div className="w-full bg-black/20 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-green-400 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${taskStats.percentage}%` }}
            ></div>
          </div>
        </div>

        {/* All tasks with accordion */}
        <div className="space-y-2 mb-3 max-h-[500px] overflow-y-auto">
          {taskSummaries.map((task) => {
            const isExpanded = expandedTaskId === task.taskId;
            const completionPct = task.totalAssigned > 0 ? Math.round((task.completed / task.totalAssigned) * 100) : 0;
            
            const completedStaff = task.staffStatuses.filter((s) => s.status === 'completed');
            const reportedStaff = task.staffStatuses.filter((s) => s.status === 'reported');
            const pendingStaff = task.staffStatuses.filter((s) => s.status === 'pending');
            
            return (
              <div key={task.taskId} className="bg-white/10 rounded-lg backdrop-blur-sm border border-white/10 overflow-hidden">
                {/* Accordion Header */}
                <button
                  type="button"
                  onClick={() => toggleTask(task.taskId)}
                  className="w-full p-3 text-left hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium leading-relaxed line-clamp-2">{task.taskName}</p>
                        <ChevronDown 
                          className={`h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </div>
                      {!isExpanded && (
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          {task.completed > 0 && (
                            <span className="flex items-center gap-0.5 bg-emerald-500/20 px-1 py-0.5 rounded">
                              <CheckCircle className="h-2.5 w-2.5 text-emerald-300" />
                              {task.completed}
                            </span>
                          )}
                          {task.reported > 0 && (
                            <span className="flex items-center gap-0.5 bg-amber-500/20 px-1 py-0.5 rounded">
                              <AlertCircle className="h-2.5 w-2.5 text-amber-300" />
                              {task.reported}
                            </span>
                          )}
                          {task.pending > 0 && (
                            <span className="flex items-center gap-0.5 bg-gray-500/20 px-1 py-0.5 rounded">
                              <Circle className="h-2.5 w-2.5 text-gray-300" />
                              {task.pending}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {!isExpanded && (
                    <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden mt-2">
                      <div 
                        className="bg-white h-1 rounded-full transition-all duration-300" 
                        style={{ width: `${completionPct}%` }}
                      ></div>
                    </div>
                  )}
                </button>

                {/* Accordion Content */}
                {isExpanded && (
                  <div className="border-t border-white/10 p-3 space-y-3 animate-in fade-in duration-200">
                    {task.description && (
                      <p className="text-[11px] opacity-80 leading-relaxed">{task.description}</p>
                    )}
                    
                    {/* Summary stats */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-emerald-500/10 rounded px-2 py-1.5 text-center">
                        <div className="text-sm font-bold text-emerald-300">{task.completed}</div>
                        <div className="text-[10px] opacity-80">Hoàn thành</div>
                      </div>
                      <div className="bg-amber-500/10 rounded px-2 py-1.5 text-center">
                        <div className="text-sm font-bold text-amber-300">{task.reported}</div>
                        <div className="text-[10px] opacity-80">Báo cáo</div>
                      </div>
                      <div className="bg-gray-500/10 rounded px-2 py-1.5 text-center">
                        <div className="text-sm font-bold text-gray-300">{task.pending}</div>
                        <div className="text-[10px] opacity-80">Chưa gửi</div>
                      </div>
                    </div>

                    {/* Staff lists */}
                    <div className="space-y-3">
                      {renderStaffList('Đã hoàn thành', completedStaff, 'completed')}
                      {renderStaffList('Đã báo cáo', reportedStaff, 'reported')}
                      {renderStaffList('Chưa gửi', pendingStaff, 'pending')}
                    </div>

                    {/* Additional reports */}
                    {task.additionalReports.length > 0 && (
                      <div className="pt-3 border-t border-white/10">
                        <p className="text-[11px] font-semibold uppercase opacity-80 mb-2">Báo cáo khác</p>
                        <div className="space-y-1.5">
                          {task.additionalReports.map((report, idx) => (
                            <div
                              key={report.completionId ?? `${report.taskId}-${idx}`}
                              className="flex items-start justify-between bg-white/5 rounded px-2 py-1.5 border border-dashed border-white/10"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-medium">{report.completedBy?.userName ?? 'Không xác định'}</p>
                                {report.note && (
                                  <p className="text-[10px] text-amber-300 line-clamp-2">"{report.note}"</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-2">
                                {report.completedAt && (
                                  <span className="text-[10px] font-semibold text-emerald-300">
                                    {formatTime(report.completedAt, 'HH:mm')}
                                  </span>
                                )}
                                {report.media && report.media.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleLightboxOpen(report.media);
                                    }}
                                    className="text-[10px] text-blue-300 hover:underline inline-flex items-center gap-0.5"
                                  >
                                    <Eye className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={() => navigation.push('/monthly-tasks')}
          className="w-full mt-3 py-2 text-sm font-semibold text-white hover:bg-white/10 rounded-lg border border-white/20 transition"
        >
          Xem chi tiết tất cả công việc
        </button>
      </div>
    </div>
  );
}
