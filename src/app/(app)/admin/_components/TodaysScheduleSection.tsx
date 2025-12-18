'use client';

import React from 'react';
import { useRouter } from 'nextjs-toploader/app';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AssignedShift } from '@/lib/types';
import { generateShortName, formatTime } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';
import type { EmployeeAttendance } from '@/lib/types';

interface ShiftWithStatus extends AssignedShift {
  isActive?: boolean;
}

interface TodaysScheduleSectionProps {
  shifts: ShiftWithStatus[];
  onViewDetails?: () => void;
}

export function TodaysScheduleSection({ shifts, onViewDetails }: TodaysScheduleSectionProps) {
  const router = useRouter();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex-1">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-gray-900 dark:text-white">Lịch làm việc hôm nay</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (onViewDetails) {
              onViewDetails();
            } else {
              router.push('/schedule');
            }
          }}
          className="text-xs text-blue-600 hover:text-blue-700 h-auto p-0"
        >
          Chi tiết
        </Button>
      </div>

      {shifts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Không có ca nào được lên lịch hôm nay</p>
        </div>
      ) : (
        <div className="relative border-l-2 border-gray-100 dark:border-gray-700 ml-3 space-y-6">
          {shifts.map((shift) => {
            const activeShift = shift.isActive;
            const employeeCount = shift.assignedUsers.length;

            return (
              <div key={shift.id} className="relative pl-6">
                {/* Timeline dot */}
                <div
                  className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-800 ${
                    activeShift
                      ? 'bg-blue-500 ring-4 ring-blue-100 dark:ring-blue-900/30'
                      : 'bg-green-500'
                  }`}
                ></div>

                {/* Shift info */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider ${
                        activeShift
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      {shift.label}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {shift.timeSlot.start} - {shift.timeSlot.end}
                    </span>
                    {activeShift && (
                      <Badge variant="default" className="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 border-0 animate-pulse h-5 px-2">
                        Ongoing
                      </Badge>
                    )}
                  </div>

                  {/* Staff badges */}
                  <div className="flex flex-col gap-2 mt-1">
                    {shift.assignedUsers.length > 0 ? (
                      shift.assignedUsers.map((user) => {
                        // Try to find attendance info attached to the shift (admin page augments shifts with employees[])
                        const employeeInfo = shift.employees?.find((e: EmployeeAttendance) => e.id === user.userId);
                        const checkIn = formatTime(employeeInfo?.checkInTime);
                        const checkOut = formatTime(employeeInfo?.checkOutTime);
                        let lateMessage = null;
                        if (employeeInfo?.lateReason) {
                          lateMessage = `Xin trễ${employeeInfo?.estimatedLateMinutes ? ` ${employeeInfo.estimatedLateMinutes} phút` : ''}${employeeInfo?.lateReason ? ` — ${employeeInfo.lateReason.trim()}` : ''}`;
                        }

                        return (
                          <div key={user.userId} className="flex items-center gap-3">
                            <Badge
                              variant="outline"
                              className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700 text-xs"
                            >
                              {generateShortName(user.userName)}
                            </Badge>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {checkIn ? <span className="font-medium text-gray-700 dark:text-gray-200">{checkIn} - </span> : <span className="italic">Chưa check-in</span>}
                              {checkOut && <span className="font-medium text-gray-700 dark:text-gray-200">{checkOut}</span>}
                              {employeeInfo?.status === 'pending_late' && (
                                <span className="ml-3 text-orange-500"></span>
                              )}
                              {employeeInfo?.status === 'late' && (
                                <span className="ml-3 text-red-500">
                                  Trễ {employeeInfo.lateMinutes ?? '?'} phút{lateMessage && ` (${lateMessage})`}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <span className="text-xs text-gray-400 italic">Chưa có nhân viên</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
