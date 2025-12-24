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
    <AccordionItem value={date} key={date} className="border rounded-xl shadow-sm bg-white dark:bg-card overflow-hidden">
      <AccordionTrigger className="p-3 sm:p-4 text-base font-semibold hover:no-underline">
        <div className="w-full flex items-start gap-3">
          <div className="mt-1 shrink-0">
            {isShiftFinalized ? (
              <div className="bg-green-100 dark:bg-green-900/30 p-1.5 rounded-full">
                <ClipboardCheck className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
              </div>
            ) : (
              <div className="bg-red-100 dark:bg-red-900/30 p-1.5 rounded-full">
                <ClipboardX className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
              </div>
            )}
          </div>
          <div className="flex flex-col text-left min-w-0 flex-1">
            <div className="text-base sm:text-lg font-bold truncate">
              {format(parseISO(date), 'eeee, dd/MM/yyyy', { locale: vi })}
            </div>
            <div className="text-[11px] sm:text-sm text-muted-foreground font-normal flex flex-wrap gap-x-3 gap-y-1 mt-0.5">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                Thu: <span className="font-bold text-green-600 dark:text-green-400">{totalDailyRevenue.toLocaleString('vi-VN')}đ</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                Chi: <span className="font-bold text-red-600 dark:text-red-400">{totalDailyExpense.toLocaleString('vi-VN')}đ</span>
              </span>
              {totalIntangibleIncidentCost > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                  Sự cố: <span className="font-bold text-yellow-600 dark:text-yellow-400">{totalIntangibleIncidentCost.toLocaleString('vi-VN')}đ</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="p-2 sm:p-4 bg-muted/10">
        <div className="space-y-4 sm:space-y-6">
          <Card className="border-green-500/20 rounded-lg shadow-none bg-transparent">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2 text-green-800 dark:text-green-300">
                <Receipt className="h-4 w-4" /> Doanh thu
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <RevenueStatsList stats={dayReports.revenue || []} onEdit={onEditRevenue} onDelete={onDeleteRevenue} processingItemId={processingItemId} itemRefs={itemRefs} />
            </CardContent>
          </Card>
          <Card className="border-blue-500/20 rounded-lg shadow-none bg-transparent">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2 text-blue-800 dark:text-blue-300">
                <Wallet className="h-4 w-4" /> Phiếu chi
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <ExpenseList 
                expenses={dayReports.expenses || []} 
                onEdit={onEditExpense} 
                onDelete={onDeleteExpense} 
                processingItemId={processingItemId} 
                inventoryList={inventoryList} 
                itemRefs={itemRefs} 
              />
            </CardContent>
          </Card>
          <Card className="border-amber-500/20 rounded-lg shadow-none bg-transparent">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2 text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" /> Sự cố
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <IncidentList 
                incidents={dayReports.incidents || []} 
                onEdit={onEditIncident} 
                onDelete={onDeleteIncident} 
                onOpenLightbox={onOpenLightbox} 
                processingItemId={processingItemId} 
                itemRefs={itemRefs} 
              />
            </CardContent>
          </Card>
          
          {dayReports.cashHandovers && dayReports.cashHandovers.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">Kiểm kê & Bàn giao</h4>
              <HandoverReportCard 
                cashHandovers={dayReports.cashHandovers}
                revenueStats={dayReports.revenue}
                expenseSlips={dayReports.expenses}
                onEditCashHandover={onEditCashHandover}
                onDeleteCashHandover={onDeleteCashHandover}
                onViewFinalHandover={onViewFinalHandover}
                processingItemId={processingItemId}
                itemRefs={itemRefs}
              />
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
});

DailyReportAccordionItem.displayName = 'DailyReportAccordionItem';
export default DailyReportAccordionItem;
