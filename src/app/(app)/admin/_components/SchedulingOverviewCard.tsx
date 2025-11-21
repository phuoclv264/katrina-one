'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarCheck, ArrowRight, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { AssignedShift } from '@/lib/types';
import { format, addDays } from 'date-fns';
import { generateShortName } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type SchedulingOverviewCardProps = {
  upcomingShifts: AssignedShift[];
};

export function SchedulingOverviewCard({ upcomingShifts }: SchedulingOverviewCardProps) {
  const router = useRouter();
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const tomorrowStr = format(addDays(now, 1), 'yyyy-MM-dd');

  const groupedShifts = useMemo(() => {
    const today = upcomingShifts.filter(shift => shift.date === todayStr);
    const tomorrow = upcomingShifts.filter(shift => shift.date === tomorrowStr);
    return { today, tomorrow };
  }, [upcomingShifts, todayStr, tomorrowStr]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card className="flex flex-col h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-lg">
            <CalendarCheck className="text-purple-500" />
            Lịch làm việc
          </CardTitle>
          <CardDescription>Các ca làm việc tiếp theo</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow overflow-hidden">
          {upcomingShifts.length > 0 ? (
            <ScrollArea className="h-full pr-4 -mr-4">
              <div className="space-y-4">
                {groupedShifts.today.length > 0 && (
                  <div className='p-1 rounded-md border bg-muted/50'>
                    <h4 className="font-semibold text-sm text-center mb-1">Hôm nay</h4>
                    {groupedShifts.today.filter(s => s.assignedUsers.length > 0).map(shift => (
                      <div key={shift.id} className="text-sm">
                        <p className="font-semibold">{shift.label} <span className="text-xs font-normal text-muted-foreground">({shift.timeSlot.start} - {shift.timeSlot.end})</span></p>
                        <p className="text-muted-foreground flex flex-wrap gap-x-2 gap-y-1">{shift.assignedUsers.map(u => generateShortName(u.userName)).join(', ')}</p>
                      </div>
                    ))}
                  </div>
                )}
                {groupedShifts.tomorrow.length > 0 && (
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="tomorrow" className="border rounded-md bg-muted/50">
                      <AccordionTrigger className="px-3 py-2 text-sm font-semibold hover:no-underline">
                        Ngày mai ({groupedShifts.tomorrow.filter(s => s.assignedUsers.length > 0).length} ca)
                      </AccordionTrigger>
                      <AccordionContent className="p-1 border-t">
                        {groupedShifts.tomorrow.filter(s => s.assignedUsers.length > 0).map(shift => (
                          <div key={shift.id} className="text-sm last:mb-0">
                            <p className="font-semibold">{shift.label} <span className="text-xs font-normal text-muted-foreground">({shift.timeSlot.start} - {shift.timeSlot.end})</span></p>
                            <p className="text-muted-foreground flex flex-wrap gap-x-2 gap-y-1">{shift.assignedUsers.map(u => generateShortName(u.userName)).join(', ')}</p>
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground text-center h-full flex items-center justify-center">Không có ca làm việc nào sắp tới.</p>
          )}
        </CardContent>
        <CardFooter>
          <Button variant="outline" className="w-full" onClick={() => router.push('/shift-scheduling')}>
            Xem Xếp lịch
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}