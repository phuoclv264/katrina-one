'use client';

import React from 'react';
import Link from 'next/link';
import { CalendarCheck, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type SchedulingOverviewCardProps = {
  upcomingShiftsCount: number;
};

export function SchedulingOverviewCard({ upcomingShiftsCount }: SchedulingOverviewCardProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card className="flex flex-col h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-lg">
            <CalendarCheck className="text-purple-500" />
            Lịch làm việc
          </CardTitle>
          <CardDescription>Ca làm việc sắp tới</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow">
          <p className="text-4xl font-bold">{`${upcomingShiftsCount}+`}</p>
        </CardContent>
        <CardFooter><Button asChild variant="outline" className="w-full"><Link href="/shift-scheduling">Xem Xếp lịch<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></CardFooter>
      </Card>
    </motion.div>
  );
}