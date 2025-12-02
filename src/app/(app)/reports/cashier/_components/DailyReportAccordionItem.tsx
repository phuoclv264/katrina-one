
'use client';

import React from 'react';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { format, parseISO, startOfDay } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { vi } from 'date-fns/locale';
import { ClipboardCheck, ClipboardX, Receipt, Wallet, AlertTriangle, PlusCircle } from 'lucide-react';
import type { RevenueStats, ExpenseSlip, IncidentReport, InventoryItem, CashHandoverReport } from '@/lib/types';
import RevenueStatsList from './RevenueStatsList';
import ExpenseList from './ExpenseList';
import IncidentList from './IncidentList';
import HandoverReportCard from './HandoverReportCard';

type DailyReportAccordionItemProps = {
  date: string;
  dayReports: {
    revenue: RevenueStats[];
    expenses: ExpenseSlip[];
    incidents: IncidentReport[];
    cashHandovers: CashHandoverReport[];
  };
  onEditRevenue: (stat: RevenueStats) => void;
  onDeleteRevenue: (id: string) => void;
  onEditExpense: (slip: ExpenseSlip) => void;
  onDeleteExpense: (id: string) => void;
  onEditIncident: (incident: IncidentReport) => void;
  onDeleteIncident: (id: string) => void;
  onOpenLightbox: (photos: string[], index?: number) => void;
  onEditCashHandover: (handover: CashHandoverReport) => void;
  onDeleteCashHandover: (id: string) => void;  
  onViewFinalHandover: (handover: CashHandoverReport) => void;
  processingItemId: string | null;
  inventoryList: InventoryItem[];
  itemRefs: React.MutableRefObject<Map<string, HTMLDivElement | null>>;
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
  onEditCashHandover,
  onDeleteCashHandover,
  onViewFinalHandover,
  processingItemId,
  inventoryList,
  itemRefs }: DailyReportAccordionItemProps) => {

  const latestRevenueStat = (dayReports.revenue || []).sort((a,b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime())[0];
  const totalDailyRevenue = latestRevenueStat?.netRevenue || 0;
  const isShiftFinalized = dayReports.cashHandovers.some(h => h.finalHandoverDetails);

  const totalDailyExpense = (dayReports.expenses || []).reduce((sum, e) => sum + e.totalAmount, 0);
  const totalIntangibleIncidentCost = (dayReports.incidents || []).filter(incident => incident.paymentMethod === 'intangible_cost').reduce((sum, i) => sum + i.cost, 0);

  return (
    <AccordionItem value={date} key={date} className="border rounded-xl shadow-md bg-white dark:bg-card">
      <AccordionTrigger className="p-4 text-base font-semibold hover:no-underline rounded-t-xl">
        <div className="w-full flex justify-between items-center gap-4">
          <div className="flex flex-col text-left">
            <div className="text-lg font-bold flex items-center gap-2">
              {isShiftFinalized ? <ClipboardCheck className="h-5 w-5 text-green-500" /> : <ClipboardX className="h-5 w-5 text-destructive" />}
              {format(parseISO(date), 'eeee, dd/MM/yyyy', { locale: vi })}
            </div>
            <div className="text-sm text-muted-foreground font-normal flex flex-wrap gap-x-4 gap-y-1 mt-1">
              <span>Thu: <span className="font-semibold text-green-600">{totalDailyRevenue.toLocaleString('vi-VN')}đ</span></span>
              <span>Chi: <span className="font-semibold text-red-600">{totalDailyExpense.toLocaleString('vi-VN')}đ</span></span>
              {totalIntangibleIncidentCost > 0 && <span>Sự cố: <span className="font-semibold text-yellow-600">{totalIntangibleIncidentCost.toLocaleString('vi-VN')}đ</span></span>}
            </div>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="p-4 bg-muted/20 rounded-b-xl">
        <div className="space-y-6">
          <Card className="border-green-500/50 rounded-lg shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-green-800 dark:text-green-300">
                <Receipt /> Doanh thu
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <RevenueStatsList stats={dayReports.revenue || []} onEdit={onEditRevenue} onDelete={onDeleteRevenue} processingItemId={processingItemId} itemRefs={itemRefs} />
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
                itemRefs={itemRefs}
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
              <IncidentList incidents={dayReports.incidents || []} onEdit={onEditIncident} onDelete={onDeleteIncident} onOpenLightbox={onOpenLightbox} processingItemId={processingItemId} itemRefs={itemRefs} />
            </CardContent>
          </Card>
          {dayReports.cashHandovers.length > 0 && (
            <HandoverReportCard 
              cashHandovers={dayReports.cashHandovers}
              onEditCashHandover={onEditCashHandover}
              onDeleteCashHandover={onDeleteCashHandover}
              processingItemId={processingItemId}
              onViewFinalHandover={onViewFinalHandover}
              revenueStats={dayReports.revenue}
              expenseSlips={dayReports.expenses}
              itemRefs={itemRefs} />
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
});

DailyReportAccordionItem.displayName = 'DailyReportAccordionItem';
export default DailyReportAccordionItem;
