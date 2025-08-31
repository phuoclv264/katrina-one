'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sun, Moon, Sunset } from 'lucide-react';

export default function ShiftsPage() {
  return (
    <div className="container mx-auto flex min-h-full items-center justify-center p-4 sm:p-6 md:p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Select a Shift</CardTitle>
          <CardDescription>Choose your current shift to view the checklist.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Button asChild size="lg">
            <Link href="/checklist/sang">
              <Sun className="mr-2" />
              Ca Sáng (Morning)
            </Link>
          </Button>
          <Button asChild size="lg">
            <Link href="/checklist/trua">
              <Sunset className="mr-2" />
              Ca Trưa (Afternoon)
            </Link>
          </Button>
          <Button asChild size="lg">
            <Link href="/checklist/toi">
              <Moon className="mr-2" />
              Ca Tối (Evening)
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
