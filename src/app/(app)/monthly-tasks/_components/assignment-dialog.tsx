'use client';
import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { GenerateTaskAssignmentsOutput } from '@/ai/flows/generate-task-assignments-flow';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Loader2, CalendarDays, User, Check, X } from 'lucide-react';
import type { ManagedUser } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

type AssignmentDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (assignments: GenerateTaskAssignmentsOutput['assignments']) => void;
  assignments: GenerateTaskAssignmentsOutput['assignments'] | null;
  isLoading: boolean;
  allUsers: ManagedUser[];
};

export default function AssignmentDialog({ isOpen, onClose, onConfirm, assignments, isLoading, allUsers }: AssignmentDialogProps) {

  const groupedAssignments = useMemo(() => {
    if (!assignments) return {};

    const grouped: { [date: string]: GenerateTaskAssignmentsOutput['assignments'] } = {};
    for (const assignment of assignments) {
      if (!grouped[assignment.assignedDate]) {
        grouped[assignment.assignedDate] = [];
      }
      grouped[assignment.assignedDate].push(assignment);
    }
    // Sort assignments within each day by user name
    for (const date in grouped) {
        grouped[date].sort((a,b) => a.assignedTo.userName.localeCompare(b.assignedTo.userName));
    }

    return grouped;
  }, [assignments]);

  const sortedDates = useMemo(() => Object.keys(groupedAssignments).sort((a, b) => new Date(a).getTime() - new Date(b).getTime()), [groupedAssignments]);
  const [openDates, setOpenDates] = useState<string[]>([]);
  
  useEffect(() => {
      if(isOpen) {
          setOpenDates(sortedDates);
      }
  }, [isOpen, sortedDates]);


  const summaryByUser = useMemo(() => {
    if (!assignments) return [];
    const summary: Record<string, { count: number, taskNames: string[] }> = {};
    for (const assignment of assignments) {
      const userId = assignment.assignedTo.userId;
      if (!summary[userId]) {
        summary[userId] = { count: 0, taskNames: [] };
      }
      summary[userId].count++;
      summary[userId].taskNames.push(assignment.taskName);
    }
    return Object.entries(summary)
      .map(([userId, data]) => ({
        user: allUsers.find(u => u.uid === userId),
        ...data,
      }))
      .filter(item => item.user)
      .sort((a, b) => a.user!.displayName.localeCompare(b.user!.displayName));
  }, [assignments, allUsers]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Xem trước Lịch phân công</DialogTitle>
          <DialogDescription>
            AI đã tạo một lịch phân công dự kiến. Vui lòng xem lại trước khi xác nhận.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-grow flex items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : !assignments || assignments.length === 0 ? (
          <div className="flex-grow flex items-center justify-center text-muted-foreground">
            Không có phân công nào được tạo.
          </div>
        ) : (
            <div className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-4 overflow-hidden">
                {/* User Summary Column */}
                <div className="md:col-span-1 flex flex-col h-full">
                    <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><User className="h-5 w-5"/>Tổng hợp theo Nhân viên</h3>
                    <ScrollArea className="border rounded-lg">
                        <div className="p-3 space-y-2">
                        {summaryByUser.map(({ user, count, taskNames }) => (
                           <Card key={user!.uid} className="bg-muted/50">
                               <CardContent className="p-3">
                                   <p className="font-semibold">{user!.displayName}</p>
                                   <p className="text-sm text-muted-foreground">Tổng cộng: <span className="font-bold text-primary">{count}</span> công việc</p>
                               </CardContent>
                           </Card>
                        ))}
                        </div>
                    </ScrollArea>
                </div>

                {/* Daily Assignments Column */}
                <div className="md:col-span-2 flex flex-col h-full">
                    <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><CalendarDays className="h-5 w-5"/>Phân công theo ngày</h3>
                    <ScrollArea className="flex-grow border rounded-lg">
                        <Accordion type="multiple" value={openDates} onValueChange={setOpenDates} className="w-full p-2">
                        {sortedDates.map(date => (
                            <AccordionItem value={date} key={date}>
                            <AccordionTrigger className="font-semibold hover:no-underline rounded-md px-3">
                                {format(parseISO(date), 'eeee, dd/MM/yyyy', { locale: vi })}
                                <Badge className="ml-2">{groupedAssignments[date].length}</Badge>
                            </AccordionTrigger>
                            <AccordionContent className="pt-2">
                                <div className="space-y-2 pl-4">
                                {groupedAssignments[date].map((assignment, index) => (
                                    <div key={index} className="flex items-center gap-3 p-2 border-l-2">
                                        <div className="w-28 shrink-0">
                                            <Badge variant="secondary">{assignment.assignedTo.userName}</Badge>
                                        </div>
                                        <p className="text-sm">{assignment.taskName}</p>
                                    </div>
                                ))}
                                </div>
                            </AccordionContent>
                            </AccordionItem>
                        ))}
                        </Accordion>
                    </ScrollArea>
                </div>
            </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            <X className="mr-2 h-4 w-4" />
            Hủy
          </Button>
          <Button onClick={() => assignments && onConfirm(assignments)} disabled={isLoading || !assignments}>
            <Check className="mr-2 h-4 w-4" />
            Xác nhận và Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
