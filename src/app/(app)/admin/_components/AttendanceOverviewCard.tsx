'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Users, CheckCircle, XCircle, Clock, MessageCircleWarning } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn, generateShortName } from '@/lib/utils';
import type { AssignedShift, AttendanceRecord } from '@/lib/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format, addDays } from 'date-fns';
import { useRouter } from 'nextjs-toploader/app';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type EmployeeStatus = 'present' | 'late' | 'absent' | 'pending_late';

export type EmployeeAttendance = {
  id: string;
  name: string;
  status: EmployeeStatus;
  checkInTime: Date | null;
  checkOutTime: Date | null;
  lateMinutes: number | null;
  lateReason: string | null;
};

export type ShiftWithAttendance = AssignedShift & {
  employees: EmployeeAttendance[];
  isActive?: boolean;
};

export type AttendanceOverviewCardProps = {
  todayShifts: ShiftWithAttendance[];
  upcomingShifts: AssignedShift[];
};

const statusIcons: Record<EmployeeStatus, React.ReactNode> = {
  present: <CheckCircle className="h-4 w-4 text-green-500" />,
  late: <Clock className="h-4 w-4 text-yellow-500" />,
  pending_late: <MessageCircleWarning className="h-4 w-4 text-orange-500" />,
  absent: <XCircle className="h-4 w-4 text-red-500" />,
};

const statusBadgeClass: Record<EmployeeStatus, string> = {
  present: 'border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-300',
  late: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300',
  pending_late: 'border-orange-500/50 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  absent: 'border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300',
};

export function AttendanceOverviewCard({ todayShifts, upcomingShifts }: AttendanceOverviewCardProps) {
  const router = useRouter();
  const now = new Date();
  const tomorrowStr = format(addDays(now, 1), 'yyyy-MM-dd');

  const tomorrowShifts = useMemo(() => {
    return upcomingShifts.filter(shift => shift.date === tomorrowStr);
  }, [upcomingShifts, tomorrowStr]);

  return (
    <Card className="md:col-span-2 lg:col-span-1 flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-lg">
          <Users className="text-blue-500" /> 
          Chấm công & Lịch làm việc
        </CardTitle>
        <CardDescription>Tổng quan nhân sự và ca làm việc</CardDescription>
      </CardHeader>
      <CardContent>
        {todayShifts.length > 0 || tomorrowShifts.length > 0 ? (
          <div className="space-y-4">
            {/* Today's shifts with attendance status */}
            {todayShifts.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Hôm nay</h4>
                {todayShifts.filter(s => s.assignedUsers.length > 0).map(shift => {
                  return (
                    <div key={shift.id} className="p-3 border rounded-lg bg-muted/30">
                      <h5 className="font-semibold text-sm">
                        {shift.label} 
                        <span className="text-xs font-normal text-muted-foreground"> ({shift.timeSlot.start} - {shift.timeSlot.end})</span>
                        {shift.isActive && <span className="ml-2 text-xs font-semibold text-green-600">● Đang hoạt động</span>}
                      </h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {shift.employees.map(employee => (
                          <TooltipProvider key={employee.id} delayDuration={100}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className={cn("flex items-center gap-1.5 cursor-default", statusBadgeClass[employee.status])}>
                                  {statusIcons[employee.status]}
                                  {generateShortName(employee.name)}
                                  {employee.checkInTime && !employee.checkOutTime && <span className="text-xs">({format(employee.checkInTime, 'HH:mm')} → ..)</span>}
                                  {employee.checkInTime &&employee.checkOutTime && <span className="text-xs">({format(employee.checkInTime, 'HH:mm')} → {format(employee.checkOutTime, 'HH:mm')})</span>}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-semibold">{employee.name}</p>
                                {employee.checkInTime && <p>Vào ca lúc: {format(employee.checkInTime, 'HH:mm')}</p>}
                                {employee.checkOutTime && <p>Ra ca lúc: {format(employee.checkOutTime, 'HH:mm')}</p>}
                                {employee.lateMinutes && <p className="text-yellow-500">Đi trễ: {employee.lateMinutes} phút</p>}
                                {employee.lateReason && <p className="text-orange-500">Xin trễ: {employee.lateReason}</p>}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tomorrow's shifts in accordion */}
            {tomorrowShifts.length > 0 && (
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="tomorrow" className="border rounded-md">
                  <AccordionTrigger className="px-3 py-2 text-sm font-semibold hover:no-underline">
                    Ngày mai ({tomorrowShifts.filter(s => s.assignedUsers.length > 0).length} ca)
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-3 pt-2 border-t">
                    <div className="space-y-3">
                      {tomorrowShifts.filter(s => s.assignedUsers.length > 0).map(shift => (
                        <div key={shift.id} className="p-3 border rounded-lg bg-muted/30">
                          <h5 className="font-semibold text-sm">{shift.label} <span className="text-xs font-normal text-muted-foreground">({shift.timeSlot.start} - {shift.timeSlot.end})</span></h5>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {shift.assignedUsers.map(user => (
                              <Badge key={user.userId} variant="outline" className="border-muted-foreground/30">
                                {generateShortName(user.userName)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center text-center text-muted-foreground p-4">
            <p>Không có ca làm việc nào.</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => router.push('/attendance')}>
          Chấm công
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => router.push('/shift-scheduling')}>
          Xếp lịch
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}