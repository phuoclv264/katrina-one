'use client';

import React, { useMemo } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { useRouter } from 'nextjs-toploader/app';
import type { MonthlyTask, MonthlyTaskAssignment } from '@/lib/types';

interface RecurringTasksCardProps {
  monthlyTasks: MonthlyTask[];
  taskAssignments: MonthlyTaskAssignment[];
}

export function RecurringTasksCard({ monthlyTasks, taskAssignments }: RecurringTasksCardProps) {
  const router = useRouter();

  const taskStats = useMemo(() => {
    const totalTasks = monthlyTasks.length;
    const completedTasks = taskAssignments.filter((a) => a.reportCount > 0).length;
    const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      total: totalTasks,
      completed: completedTasks,
      percentage: completionPercentage,
    };
  }, [monthlyTasks, taskAssignments]);

  const primaryTask = monthlyTasks[0];
  const primaryAssignment = primaryTask ? taskAssignments.find((a) => a.taskId === primaryTask.id) : null;

  return (
    <div className="bg-gradient-to-br from-indigo-600 to-blue-700 dark:from-indigo-700 dark:to-blue-800 rounded-2xl shadow-lg p-5 text-white relative overflow-hidden">
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
      <div className="absolute -left-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
      <div className="relative z-10">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4" />
            Công việc định kỳ
          </h3>
          <span className="text-xs bg-white/20 px-2 py-0.5 rounded">
            {taskStats.completed}/{taskStats.total}
          </span>
        </div>
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1 opacity-90">
            <span>Tiến độ hôm nay</span>
            <span>{taskStats.percentage}%</span>
          </div>
          <div className="w-full bg-black/20 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-green-400 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${taskStats.percentage}%` }}
            ></div>
          </div>
        </div>
        {primaryTask && (
          <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm border border-white/10">
            <p className="text-xs font-medium leading-relaxed truncate">{primaryTask.title}</p>
            <div className="flex items-center gap-3 mt-2 text-[10px] opacity-80">
              {primaryAssignment && primaryAssignment.reportCount > 0 ? (
                <>
                  <span className="flex items-center gap-0.5">
                    <CheckCircle className="h-3 w-3 text-green-300" />
                    {primaryAssignment.reportCount} xong
                  </span>
                  {primaryAssignment.reportCount < (monthlyTasks[0]?.assignedStaff?.length || 0) && (
                    <span className="flex items-center gap-0.5">
                      <AlertCircle className="h-3 w-3 text-yellow-300" />
                      {(monthlyTasks[0]?.assignedStaff?.length || 0) - primaryAssignment.reportCount} chưa báo
                    </span>
                  )}
                </>
              ) : (
                <span className="flex items-center gap-0.5">
                  <AlertCircle className="h-3 w-3 text-yellow-300" />
                  Chưa có báo cáo
                </span>
              )}
            </div>
          </div>
        )}
        <button
          onClick={() => router.push('/task-lists')}
          className="w-full mt-3 py-2 text-xs font-semibold text-white hover:bg-white/10 rounded-lg border border-white/20 transition"
        >
          Xem tất cả công việc
        </button>
      </div>
    </div>
  );
}
