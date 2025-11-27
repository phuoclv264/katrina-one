'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Users, CheckCircle, XCircle, Clock, MessageCircleWarning } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn, generateShortName } from '@/lib/utils';
import type { AssignedShift, AttendanceRecord } from '@/lib/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { useRouter } from 'nextjs-toploader/app';

type EmployeeStatus = 'present' | 'late' | 'absent' | 'pending_late';

export type EmployeeAttendance = {
  id: string;
  name: string;
  status: EmployeeStatus;
  checkInTime: Date | null;
  lateMinutes: number | null;
  lateReason: string | null;
};

export type ActiveShiftWithAttendance = AssignedShift & {
  employees: EmployeeAttendance[];
};

export type AttendanceOverviewCardProps = {
  activeShifts: ActiveShiftWithAttendance[];
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

export function AttendanceOverviewCard({ activeShifts }: AttendanceOverviewCardProps) {
  const router = useRouter();

  return (
    <Card className="md:col-span-2 lg:col-span-1 flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-lg"><Users className="text-blue-500" /> Quản lý Chấm công</CardTitle>
        <CardDescription>Tổng quan nhân sự trong các ca đang hoạt động.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        {activeShifts.length > 0 ? (
          <div className="space-y-4">
            {activeShifts.filter(s => s.employees.length > 0).map(shift => (
              <div key={shift.id} className="p-3 border rounded-lg">
                <h4 className="font-semibold">{shift.label} <span className="text-sm font-normal text-muted-foreground">({shift.timeSlot.start} - {shift.timeSlot.end})</span></h4>
                <div className="flex flex-wrap gap-2 mt-2">
                  {shift.employees.map(employee => (
                    <TooltipProvider key={employee.id} delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className={cn("flex items-center gap-1.5 cursor-default", statusBadgeClass[employee.status])}>
                            {statusIcons[employee.status]}
                            {generateShortName(employee.name)} {employee.checkInTime && <p>(in: {format(employee.checkInTime, 'HH:mm')})</p>}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-semibold">{employee.name}</p>
                          {employee.checkInTime && <p>Vào ca lúc: {format(employee.checkInTime, 'HH:mm')}</p>}
                          {employee.lateMinutes && <p className="text-yellow-500">Đi trễ: {employee.lateMinutes} phút</p>}
                          {employee.lateReason && <p className="text-orange-500">Xin trễ: {employee.lateReason}</p>}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-center text-muted-foreground p-4">
            <p>Không có ca làm việc nào đang hoạt động.</p>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button variant="outline" className="w-full" onClick={() => router.push('/attendance')}>
          Quản lý Chấm công
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}