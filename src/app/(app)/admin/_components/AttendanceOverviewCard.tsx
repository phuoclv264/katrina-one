'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Users } from 'lucide-react';

type AttendanceOverviewCardProps = {
  checkedIn: number;
  absent: number;
  late: number;
};

export function AttendanceOverviewCard({ checkedIn, absent, late }: AttendanceOverviewCardProps) {
  return (
    <Card className="md:col-span-2 lg:col-span-1">
      <CardHeader><CardTitle className="flex items-center gap-3 text-lg"><Users className="text-blue-500" /> Quản lý Chấm công</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-3 gap-4 text-center">
        <div><p className="text-3xl font-bold">{checkedIn}</p><p className="text-sm text-muted-foreground">Đã vào ca</p></div>
        <div><p className="text-3xl font-bold">{absent}</p><p className="text-sm text-muted-foreground">Vắng</p></div>
        <div><p className="text-3xl font-bold">{late}</p><p className="text-sm text-muted-foreground">Đi trễ</p></div>
      </CardContent>
      <CardFooter><Button asChild variant="outline" className="w-full"><Link href="/attendance">Đi tới Quản lý Chấm công<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></CardFooter>
    </Card>
  );
}