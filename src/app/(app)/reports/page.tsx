import Link from 'next/link';
import { reports, tasks } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowRight, CheckCircle, XCircle } from 'lucide-react';

function getCompletionStatus(report: (typeof reports)[0]) {
    const criticalTasks = tasks.filter(t => t.isCritical).map(t => t.id);
    const completedCriticalTasks = report.completedTasks.filter(ct => criticalTasks.includes(ct));
    
    if (criticalTasks.length === 0) {
        return { text: "Completed", variant: "default", icon: CheckCircle };
    }
    
    if (completedCriticalTasks.length === criticalTasks.length) {
        return { text: "Completed", variant: "default", icon: CheckCircle };
    }
    
    if (completedCriticalTasks.length > 0) {
        return { text: "Partially Completed", variant: "secondary", icon: CheckCircle };
    }

    return { text: "Incomplete", variant: "destructive", icon: XCircle };
}


export default function ReportsPage() {
  return (
    <div className="container mx-auto p-4 sm:p-6 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold font-headline">Shift Reports</h1>
        <p className="text-muted-foreground">Review submitted reports from all staff members.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
          <CardDescription>
            Showing the {reports.length} most recent shift reports.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Staff Member</TableHead>
                <TableHead className="text-center">Task Completion</TableHead>
                <TableHead className="text-center">Photos</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => {
                const status = getCompletionStatus(report);
                const allTasksCount = tasks.length;
                const completedTasksCount = report.completedTasks.length;
                
                return (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">{report.shiftDate}</TableCell>
                    <TableCell>{report.staffName}</TableCell>
                    <TableCell className="text-center">
                       <Badge variant={status.variant} className="gap-1">
                          <status.icon className="h-3 w-3" />
                          <span>{completedTasksCount}/{allTasksCount}</span>
                       </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                        <Badge variant="outline">{report.uploadedPhotos.length} uploaded</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/reports/${report.id}`}>
                          View Details <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
