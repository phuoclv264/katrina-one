
'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'react-hot-toast';
import { Loader2, Wand2, ArrowRight } from 'lucide-react';
import { dataStore } from '@/lib/data-store';
import type { IssueNote } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';

type GroupedNotes = {
  [date: string]: IssueNote[];
};

export default function IssueNotesDialog({ isOpen, onOpenChange }: { isOpen: boolean, onOpenChange: (open: boolean) => void }) {
  const [notes, setNotes] = useState<IssueNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanDate, setLastScanDate] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      const unsubNotes = dataStore.subscribeToIssueNotes(setNotes);
      dataStore.getAppSettings().then(settings => {
        if (settings.lastIssueNoteScan) {
          setLastScanDate(new Date(settings.lastIssueNoteScan as string).toLocaleString('vi-VN'));
        }
        setIsLoading(false);
      });
      return () => unsubNotes();
    }
  }, [isOpen]);

  const handleScan = async () => {
    setIsScanning(true);
    toast.loading("Đang quét các báo cáo mới...");

    try {
      const newNotesCount = await dataStore.scanAndSaveIssueNotes();
      if (newNotesCount > 0) {
        toast.success(`Đã tìm thấy và lưu ${newNotesCount} ghi chú mới.`);
        const settings = await dataStore.getAppSettings();
        if (settings.lastIssueNoteScan) {
          setLastScanDate(new Date(settings.lastIssueNoteScan as string).toLocaleString('vi-VN'));
        }
      } else {
        toast.success("Không có ghi chú mới nào được tìm thấy.");
      }
    } catch (error) {
      console.error("Failed to scan for issue notes:", error);
      toast.error("Lỗi khi quét báo cáo.");
    } finally {
      setIsScanning(false);
      toast.dismiss();
    }
  };

  const groupedNotes = useMemo(() => {
    return notes.reduce((acc, note) => {
      const dateKey = format(parseISO(note.date), "eeee, dd/MM/yyyy", { locale: vi });
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(note);
      return acc;
    }, {} as GroupedNotes);
  }, [notes]);

  const sortedDates = useMemo(() => Object.keys(groupedNotes).sort((a, b) => {
    const dateA = notes.find(n => format(parseISO(n.date), "eeee, dd/MM/yyyy", { locale: vi }) === a)!.date;
    const dateB = notes.find(n => format(parseISO(n.date), "eeee, dd/MM/yyyy", { locale: vi }) === b)!.date;
    return parseISO(dateB).getTime() - parseISO(dateA).getTime();
  }), [groupedNotes, notes]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Báo cáo Vấn đề & Ghi chú</DialogTitle>
          <DialogDescription>
            Tổng hợp tất cả các ghi chú và vấn đề phát sinh từ báo cáo của nhân viên. 
            {lastScanDate && ` Lần quét cuối: ${lastScanDate}`}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto -mx-6 px-6 py-4">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : sortedDates.length > 0 ? (
            <Accordion type="multiple" defaultValue={sortedDates.slice(0,1)} className="space-y-3">
              {sortedDates.map(date => (
                <AccordionItem value={date} key={date} className="border rounded-lg">
                  <AccordionTrigger className="p-4 text-base font-semibold hover:no-underline">
                    {date}
                  </AccordionTrigger>
                  <AccordionContent className="p-4 border-t">
                    <div className="space-y-3">
                      {groupedNotes[date].map(note => (
                        <div key={note.id} className="p-3 border rounded-md bg-muted/50">
                           <blockquote className="border-l-4 pl-3 italic text-sm">
                                {note.note}
                           </blockquote>
                           <p className="text-xs text-muted-foreground text-right mt-2">
                             - {note.staffName} ({note.shiftName})
                           </p>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground">Chưa có ghi chú nào được tìm thấy.</p>
              <p className="text-sm text-muted-foreground">Nhấn nút bên dưới để bắt đầu quét.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleScan} disabled={isScanning}>
            {isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Wand2 className="mr-2 h-4 w-4"/>}
            Quét báo cáo mới
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
