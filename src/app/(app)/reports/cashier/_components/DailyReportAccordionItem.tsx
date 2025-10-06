
'use client';

import React from 'react';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ClipboardCheck, ClipboardX, Receipt, Wallet, AlertTriangle, PlusCircle } from 'lucide-react';
import type { RevenueStats, ExpenseSlip, IncidentReport, HandoverReport, InventoryItem } from '@/lib/types';
import RevenueStatsList from './RevenueStatsList';
import ExpenseList from './ExpenseList';
import IncidentList from './IncidentList';
import HandoverReportCard from './HandoverReportCard';
import { Button } from '@/components/ui/button';

type DailyReportAccordionItemProps = {
  date: string;
  dayReports: {
    revenue: RevenueStats[];
    expenses: ExpenseSlip[];
    incidents: IncidentReport[];
    handover?: HandoverReport;
  };
  onEditRevenue: (stats: RevenueStats) => void;
  onDeleteRevenue: (id: string) => void;
  onEditExpense: (slip: ExpenseSlip) => void;
  onDeleteExpense: (id: string) => void;
  onEditIncident: (incident: IncidentReport) => void;
  onDeleteIncident: (id: string) => void;
  onOpenLightbox: (photos: string[], index?: number) => void;
  onEditHandover: (handover: HandoverReport) => void;
  onDeleteHandover: (id: string) => void;
  processingItemId: string | null;
  inventoryList: InventoryItem[];
  onAddNewExpense: (date: string) => void;
  onAddNewRevenue: (date: string) => void;
  onAddNewIncident: (date: string) => void;
};

const DailyReportAccordionItem = React.memo(({
  date,
  dayReports,
  onEditRevenue,
  onDeleteRevenue,
  onEditExpense,
  onDeleteExpense,
  onEditIncident,
  onDeleteIncident,
  onOpenLightbox,
  onEditHandover,
  onDeleteHandover,
  processingItemId,
  inventoryList,
  onAddNewExpense,
  onAddNewRevenue,
  onAddNewIncident,
}: DailyReportAccordionItemProps) => {

  const latestRevenueStat = (dayReports.revenue || []).sort((a,b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime())[0];
  const totalDailyRevenue = latestRevenueStat?.netRevenue || 0;

  const totalDailyExpense = (dayReports.expenses || []).reduce((sum, e) => sum + e.totalAmount, 0) + (dayReports.incidents || []).reduce((sum, i) => sum + i.cost, 0);

  return (
    <AccordionItem value={date} key={date} className="border rounded-xl shadow-md bg-white dark:bg-card">
      <AccordionTrigger className="p-4 text-base font-semibold hover:no-underline rounded-t-xl">
        <div className="w-full flex justify-between items-center gap-4">
          <div className="flex flex-col text-left">
            <div className="text-lg font-bold flex items-center gap-2">
              {dayReports.handover ? <ClipboardCheck className="h-5 w-5 text-green-500" /> : <ClipboardX className="h-5 w-5 text-destructive" />}
              {format(parseISO(date), 'eeee, dd/MM/yyyy', { locale: vi })}
            </div>
            <div className="text-sm text-muted-foreground font-normal flex flex-wrap gap-x-4 gap-y-1 mt-1">
              <span>Thu: <span className="font-semibold text-green-600">{totalDailyRevenue.toLocaleString('vi-VN')}đ</span></span>
              <span>Chi: <span className="font-semibold text-red-600">{totalDailyExpense.toLocaleString('vi-VN')}đ</span></span>
            </div>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="p-4 bg-muted/20 rounded-b-xl">
        <div className="space-y-6">
            <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => onAddNewRevenue(date)}><PlusCircle className="mr-2 h-4 w-4"/>Thêm Doanh thu</Button>
                <Button size="sm" variant="outline" onClick={() => onAddNewExpense(date)}><PlusCircle className="mr-2 h-4 w-4"/>Thêm Phiếu chi</Button>
                <Button size="sm" variant="outline" onClick={() => onAddNewIncident(date)}><PlusCircle className="mr-2 h-4 w-4"/>Thêm Sự cố</Button>
            </div>
          <Card className="border-green-500/50 rounded-lg shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-green-800 dark:text-green-300">
                <Receipt /> Doanh thu
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <RevenueStatsList stats={dayReports.revenue || []} onEdit={onEditRevenue} onDelete={onDeleteRevenue} processingItemId={processingItemId} />
            </CardContent>
          </Card>
          <Card className="border-blue-500/50 rounded-lg shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-blue-800 dark:text-blue-300">
                <Wallet /> Phiếu chi
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <ExpenseList 
                expenses={dayReports.expenses || []} 
                onEdit={onEditExpense} 
                onDelete={onDeleteExpense} 
                processingItemId={processingItemId} 
                inventoryList={inventoryList} 
              />
            </CardContent>
          </Card>
          <Card className="border-amber-500/50 rounded-lg shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-amber-800 dark:text-amber-300">
                <AlertTriangle /> Sự cố
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <IncidentList incidents={dayReports.incidents || []} onEdit={onEditIncident} onDelete={onDeleteIncident} onOpenLightbox={onOpenLightbox} processingItemId={processingItemId} />
            </CardContent>
          </Card>
          {dayReports.handover && (
            <HandoverReportCard handover={dayReports.handover} onEdit={onEditHandover} onDelete={onDeleteHandover} processingItemId={processingItemId} />
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
});

DailyReportAccordionItem.displayName = 'DailyReportAccordionItem';
export default DailyReportAccordionItem;
