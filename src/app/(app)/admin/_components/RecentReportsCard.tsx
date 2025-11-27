'use client';

import React, { useState } from 'react';
import { useRouter } from 'nextjs-toploader/app';
import { format } from 'date-fns';
import { FileText, ArrowRight } from 'lucide-react';
import type { ShiftReport } from '@/lib/types';
import { ListCard } from './ListCard';
import { getReportLink } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type RecentReportsCardProps = {
  shiftReports: ShiftReport[];
};

export function RecentReportsCard({ shiftReports }: RecentReportsCardProps) {
  const router = useRouter();

  return (
    <ListCard
      title="Báo cáo mới nhất"
      icon={<FileText className="text-orange-500" />}
      link="/reports"
      linkText="Xem tất cả Báo cáo"
    >
      {shiftReports.length > 0 ? (
        <>
          {shiftReports.slice(0, 4).map(report => (
            <motion.div
              key={report.id}
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex items-center justify-between text-sm p-2 rounded-md border bg-muted/50"
            >
              <div>
                <p className="font-semibold">{report.staffName}</p>
                <p className="text-muted-foreground">Đã nộp báo cáo ca {report.shiftKey} lúc {format(new Date(report.submittedAt as string), 'HH:mm')}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => router.push(getReportLink(report.date, report.shiftKey))}>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </motion.div>
          ))}
          {shiftReports.length > 4 && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="more-reports" className="border-none">
                <AccordionTrigger className="text-sm p-0 hover:no-underline justify-center text-muted-foreground">
                  Xem thêm {shiftReports.length - 4} báo cáo khác
                </AccordionTrigger>
                <AccordionContent className="pt-3 space-y-3">
                  {shiftReports.slice(4).map(report => (
                    <motion.div
                      key={report.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="flex items-center justify-between text-sm p-2 rounded-md border bg-muted/50"
                    >
                      <div>
                        <p className="font-semibold">{report.staffName}</p>
                        <p className="text-muted-foreground">Đã nộp báo cáo ca {report.shiftKey} lúc {format(new Date(report.submittedAt as string), 'HH:mm')}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => router.push(getReportLink(report.date, report.shiftKey))}>
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">Chưa có báo cáo nào hôm nay.</p>
      )}
    </ListCard>
  );
}