'use client';

import React, { useMemo, useState } from 'react';
import { useAppNavigation } from '@/contexts/app-navigation-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AssignedShift } from '@/lib/types';
import { generateShortName, formatTime, cn } from '@/lib/utils';
import { AlertCircle, Eye, ChevronDown } from 'lucide-react';
import type { EmployeeAttendance, EmployeeStatus } from '@/lib/types';
import { parse, isAfter, differenceInMinutes } from 'date-fns';
import { useLightbox } from '@/contexts/lightbox-context';

interface ShiftWithStatus extends AssignedShift {
  isActive?: boolean;
}

interface TodaysScheduleSectionProps {
  shifts: ShiftWithStatus[];
  offShiftEmployees?: EmployeeAttendance[];
  onViewDetails?: () => void;
}

export function TodaysScheduleSection({ shifts, offShiftEmployees, onViewDetails }: TodaysScheduleSectionProps) {
  const navigation = useAppNavigation();
  const { openLightbox } = useLightbox();
  const now = new Date();
  const [showOffShift, setShowOffShift] = useState(true);

  const visibleShifts = useMemo(() => shifts.filter(shift => shift.assignedUsers.length > 0), [shifts]);

  const groupedShifts = useMemo(() => {
    return [
      {
        id: 'morning',
        label: 'Sáng',
        shifts: visibleShifts.filter(s => {
          const h = parseInt(s.timeSlot.start.split(':')[0], 10);
          return h < 12;
        })
      },
      {
        id: 'afternoon',
        label: 'Chiều',
        shifts: visibleShifts.filter(s => {
          const h = parseInt(s.timeSlot.start.split(':')[0], 10);
          return h >= 12 && h < 17;
        })
      },
      {
        id: 'evening',
        label: 'Tối',
        shifts: visibleShifts.filter(s => {
          const h = parseInt(s.timeSlot.start.split(':')[0], 10);
          return h >= 17;
        })
      }
    ];
  }, [visibleShifts]);

  return (
    <div className="bg-card dark:bg-zinc-900 rounded-[2rem] shadow-soft border border-zinc-100/80 dark:border-zinc-800/50 p-4 flex-1"> 
      <div className="flex justify-between items-center mb-3"> 
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 tracking-tight leading-none">Lịch làm việc hôm nay</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (onViewDetails) {
              onViewDetails();
            } else {
              navigation.push('/shift-scheduling');
            }
          }}
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-all h-6 px-2"
        >
          Chi tiết
        </Button>
      </div>

      {visibleShifts.length === 0 && (!offShiftEmployees || offShiftEmployees.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center mb-4">
            <AlertCircle className="h-7 w-7 text-zinc-300 dark:text-zinc-600" />
          </div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Không có ca nào được lên lịch hôm nay</p>
        </div>
      ) : (
        <div className="space-y-6"> 
          {offShiftEmployees && offShiftEmployees.length > 0 && (
            <div className="relative border-l border-zinc-100 dark:border-zinc-800/80 ml-2 space-y-4 pb-1"> 
              <div className="relative pl-5 pt-1"> 
                <div className="absolute -left-[7px] top-4 w-3 h-3 rounded-full border-2 border-white dark:border-zinc-900 bg-orange-400 shadow-sm"></div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-orange-600 dark:text-orange-400">
                    Làm ngoài ca / Tăng cường
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setShowOffShift(v => !v)}
                    aria-label="Thu gọn mục làm ngoài ca"
                  >
                    <ChevronDown className={cn("h-4 w-4 transition-transform", showOffShift ? "rotate-180" : "rotate-0")} />
                  </Button>
                </div>
                {showOffShift && (
                  <div className="flex flex-col gap-2 mt-1"> 
                    {offShiftEmployees.map((emp) => (
                      <div key={emp.id} className="flex items-center gap-2"> 
                        <Badge
                          variant="outline"
                          className="bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-0 shadow-sm ring-1 ring-orange-100 dark:ring-orange-900/20 text-[11px] font-bold px-2 py-0 h-5"
                        >
                          {generateShortName(emp.name)}
                        </Badge>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-2 tracking-tight">
                          {formatTime(emp.checkInTime) && (
                            <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                              {formatTime(emp.checkInTime)} - {formatTime(emp.checkOutTime) || '...'}
                            </span>
                          )}
                          {emp.lateReason ? (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-orange-500 dark:text-orange-400 font-bold">
                                {emp.estimatedLateMinutes != null ? `Xin trễ ${emp.estimatedLateMinutes} phút — ${emp.lateReason}` : emp.lateReason}
                              </span>
                              {emp.lateReasonPhotoUrl && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 rounded-md text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                                  onClick={() => openLightbox([{ src: emp.lateReasonPhotoUrl! }])}
                                  title="Xem minh chứng"
                                  aria-label={`Xem minh chứng của ${emp.name}`}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-red-500 dark:text-red-400 font-bold bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded uppercase tracking-wider">
                              Làm ngoài ca
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {groupedShifts.map((group) => (
              <div key={group.id} className="bg-zinc-50/50 dark:bg-zinc-800/20 rounded-[1.5rem] p-4 border border-zinc-100/50 dark:border-zinc-800/30 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/50 pb-2">
                  <h4 className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 leading-none">
                    {group.label}
                  </h4>
                  {group.shifts.length > 0 && (
                    <Badge variant="outline" className="h-4 px-1.5 text-[9px] bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 font-bold">
                      {group.shifts.length}
                    </Badge>
                  )}
                </div>

                <div className="relative border-l border-zinc-100 dark:border-zinc-800/50 ml-1.5 space-y-5 pb-1 flex-1">
                  {group.shifts.length === 0 ? (
                    <div className="pl-4 py-2">
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-600 italic">Trống</p>
                    </div>
                  ) : (
                    group.shifts.map((shift) => {
                      const activeShift = shift.isActive;
                      const shiftStartTime = parse(shift.timeSlot.start, 'HH:mm', new Date(shift.date));
                      const hasStarted = isAfter(now, shiftStartTime);

                      return (
                        <div key={shift.id} className="relative pl-5"> 
                          {/* Timeline dot */}
                          <div
                            className={`absolute -left-[7px] top-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-zinc-900 shadow-sm transition-all duration-300 ${activeShift
                                ? 'bg-blue-600 ring-4 ring-blue-50 dark:ring-blue-900/30'
                                : 'bg-emerald-500'
                              }`}
                          ></div>

                          {/* Shift info */}
                          <div className="flex flex-col gap-1.5"> 
                            <div className="flex items-center justify-between gap-2 flex-wrap leading-none">
                              <span
                                className={`text-[11px] font-bold uppercase tracking-[0.08em] ${activeShift
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-zinc-900 dark:text-zinc-100'
                                  }`}
                              >
                                {shift.timeSlot.start} - {shift.timeSlot.end}
                              </span>
                              {activeShift && (
                                <Badge variant="default" className="bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 border-0 animate-pulse h-4 px-1.5 text-[9px] font-bold tracking-wider uppercase">
                                  Live
                                </Badge>
                              )}
                            </div>

                            {/* Staff badges */}
                            <div className="flex flex-col gap-2 mt-0.5">
                              {shift.assignedUsers.length > 0 ? (
                                shift.assignedUsers.map((user) => {
                                  // Use the pre-processed attendance data from shift.employees
                                  const employeeData = shift.employees?.find(emp => emp.id === user.userId);
                                  
                                  // Use multiple records if available, otherwise fallback to legacy single fields
                                  const timeRecords = employeeData?.records && employeeData.records.length > 0 
                                    ? employeeData.records 
                                    : (employeeData?.checkInTime ? [{ checkInTime: employeeData.checkInTime, checkOutTime: employeeData.checkOutTime }] : []);

                                  const hasCheckIn = timeRecords.length > 0;
                                  
                                  let lateMessage = null;
                                  if (employeeData?.lateReason) {
                                    lateMessage = `Xin trễ${employeeData?.estimatedLateMinutes ? ` ${employeeData.estimatedLateMinutes} phút` : ''}${employeeData?.lateReason ? ` — ${employeeData.lateReason.trim()}` : ''}`;
                                  }

                                  return (
                                    <div key={user.userId} className="flex items-start gap-2">
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "text-[11px] px-2 py-0 h-5 border-0 font-bold transition-colors mt-0.5",
                                          (!hasCheckIn && hasStarted)
                                            ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 shadow-sm ring-1 ring-red-100 dark:ring-red-900/30"
                                            : employeeData?.status === 'late'
                                            ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 shadow-sm ring-1 ring-amber-100 dark:ring-amber-900/20"
                                            : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-100 dark:ring-emerald-900/20"
                                        )}
                                      >
                                        {generateShortName(user.userName)}
                                      </Badge>
                                      {hasStarted && (
                                        <div className="flex flex-col gap-1">
                                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 tracking-tight leading-5">
                                            {hasCheckIn ? (
                                              <div className="flex flex-col gap-1">
                                                {timeRecords.map((rec, idx) => (
                                                  <span key={idx}>
                                                    <span className="font-semibold text-zinc-700 dark:text-zinc-200">{formatTime(rec.checkInTime)} - </span>
                                                    {rec.checkOutTime && <span className="font-semibold text-zinc-700 dark:text-zinc-200">{formatTime(rec.checkOutTime)}</span>}
                                                  </span>
                                                ))}
                                              </div>
                                            ) : (
                                              <span className="italic opacity-60">Chưa check-in</span>
                                            )}
                                            {employeeData?.status === 'pending_late' && (
                                              <span className="ml-3 inline-flex items-center gap-2">
                                                <span className="text-amber-600 dark:text-amber-400 font-bold">Dự kiến trễ {employeeData?.estimatedLateMinutes ?? '?'} phút</span>
                                                {employeeData?.lateReason && (
                                                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 italic line-clamp-1 max-w-[120px]">{employeeData?.lateReason}</span>
                                                )}
                                                {employeeData?.lateReasonPhotoUrl && (
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 rounded-md text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                                    onClick={() => { if (employeeData?.lateReasonPhotoUrl) openLightbox([{ src: employeeData.lateReasonPhotoUrl }]) }}
                                                    title="Xem minh chứng"
                                                    aria-label={`Xem minh chứng của ${user.userName}`}
                                                  >
                                                    <Eye className="h-3.5 w-3.5" />
                                                  </Button>
                                                )}
                                              </span>
                                            )}
                                            {employeeData?.status === 'late' && (
                                              <span className="ml-3 inline-flex items-center gap-1 text-red-500 font-medium">
                                                <span>Trễ {employeeData?.lateMinutes ?? '?'} phút{lateMessage && ` (${lateMessage})`}</span>
                                                {employeeData?.lateReasonPhotoUrl && (
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 rounded-md text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                    onClick={() => { if (employeeData?.lateReasonPhotoUrl) openLightbox([{ src: employeeData.lateReasonPhotoUrl }]) }}
                                                    title="Xem minh chứng"
                                                    aria-label={`Xem minh chứng của ${user.userName}`}
                                                  >
                                                    <Eye className="h-3.5 w-3.5" />
                                                  </Button>
                                                )}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
