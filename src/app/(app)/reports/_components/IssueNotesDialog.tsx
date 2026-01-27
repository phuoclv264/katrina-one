
'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogBody,
  DialogAction,
  DialogCancel
} from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/pro-toast';
import { Loader2, Wand2, Clock, Calendar, MessageSquare, User, ChevronsUpDown } from 'lucide-react';
import { dataStore } from '@/lib/data-store';
import { Badge } from '@/components/ui/badge';
import type { IssueNote } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type GroupedNotes = {
  [date: string]: IssueNote[];
};

export default function IssueNotesDialog({ isOpen, onOpenChange }: { isOpen: boolean, onOpenChange: (open: boolean) => void }) {
  const [notes, setNotes] = useState<IssueNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanDate, setLastScanDate] = useState<string | null>(null);
  const [openAccordionItems, setOpenAccordionItems] = useState<string[]>([]);

  // Pagination for date groups: show first N dates, load more when scrolled to bottom
  const [visibleDateCount, setVisibleDateCount] = useState<number>(15);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      const q = query(collection(db, 'issue_notes'), orderBy('date', 'desc'));
      const unsubNotes = onSnapshot(q, (snapshot) => {
        const notes = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
        } as IssueNote));
        setNotes(notes);
      });

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

  // visibleDates supports incremental loading (15 per "page")
  const visibleDates = sortedDates.slice(0, visibleDateCount);

  const handleScrollToLoadMore = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (isLoadingMore || visibleDateCount >= sortedDates.length) return;
    // when user is near the bottom, load next page
    if (distanceToBottom < 120) {
      setIsLoadingMore(true);
      // small delay to make the UI feel smooth; no network I/O involved
      window.setTimeout(() => {
        setVisibleDateCount(prev => Math.min(sortedDates.length, prev + 15));
        setIsLoadingMore(false);
      }, 150);
    }
  }; 

  useEffect(() => {
    // Automatically open the first date group when data loads
    if (sortedDates.length > 0 && openAccordionItems.length === 0) {
      setOpenAccordionItems([sortedDates[0]]);
    }

    // reset pagination to first page when the data set changes
    setVisibleDateCount(Math.min(15, sortedDates.length));
  }, [sortedDates, openAccordionItems.length]);

  const handleToggleAll = () => {
    if (openAccordionItems.length === sortedDates.length) {
      setOpenAccordionItems([]);
    } else {
      setOpenAccordionItems(sortedDates);
    }
  };

  const areAllOpen = sortedDates.length > 0 && openAccordionItems.length === sortedDates.length;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange} dialogTag="issue-notes-dialog" parentDialogTag="root">
      <DialogContent className="max-w-2xl p-0 flex flex-col">
        <DialogHeader iconkey="layout" variant="info">
          <DialogTitle>Vấn đề & Ghi chú</DialogTitle>
          <DialogDescription>
            {lastScanDate ? (
              <span className="flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3 h-3" />
                Lần quét cuối: {lastScanDate}
              </span>
            ) : (
              "Tổng hợp tất cả các ghi chú phát sinh từ báo cáo."
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="bg-muted/[0.02] space-y-6 py-6 overflow-hidden flex-1 flex flex-col">
          {/* Controls Section */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="h-6 w-1 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
              <h4 className="text-sm font-black uppercase tracking-widest text-foreground/70">
                Danh sách ghi chú
              </h4>
            </div>
            {sortedDates.length > 1 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleToggleAll}
                className="h-8 rounded-lg font-bold text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors"
              >
                <ChevronsUpDown className="mr-1.5 h-3.5 w-3.5" />
                {areAllOpen ? 'Thu gọn' : 'Mở rộng'}
              </Button>
            )}
          </div>

          <div
            ref={scrollRef}
            onScroll={handleScrollToLoadMore}
            className="max-h-[60vh] overflow-y-auto px-6 py-4 space-y-4"
          >
            {isLoading ? (
              <div className="space-y-4 px-1">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-background rounded-[2rem] border p-6 space-y-4">
                    <Skeleton className="h-6 w-1/3 rounded-lg" />
                    <Skeleton className="h-20 w-full rounded-2xl" />
                  </div>
                ))}
              </div>
            ) : visibleDates.length > 0 ? (
              <>
                <div className="text-sm text-muted-foreground px-1">Hiển thị {visibleDates.length} / {sortedDates.length} ngày</div>
                <Accordion 
                  type="multiple" 
                  value={openAccordionItems} 
                  onValueChange={setOpenAccordionItems} 
                  className="space-y-4"
                >
                  {visibleDates.map(date => (
                    <AccordionItem 
                      value={date} 
                      key={date} 
                      className="border-none bg-background rounded-[2rem] border shadow-sm overflow-hidden"
                    >
                      <AccordionTrigger className="px-6 py-5 hover:no-underline group">
                        <div className="flex items-center gap-3 text-left">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-data-[state=open]:bg-primary group-data-[state=open]:text-white transition-all">
                            <Calendar className="h-5 w-5" />
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-base font-black text-foreground capitalize">
                              {date}
                            </p>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                              {groupedNotes[date].length} ghi chú
                            </p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-6 pt-2">
                        <div className="space-y-3 pt-2 border-t border-dashed">
                          {groupedNotes[date].map(note => (
                            <div key={note.id} className="p-4 rounded-2xl bg-muted/5 border border-transparent hover:border-border transition-all group/note">
                              <div className="flex gap-3">
                                <MessageSquare className="w-4 h-4 text-primary/40 shrink-0 mt-1 group-hover/note:text-primary transition-colors" />
                                <div className="space-y-3 flex-1">
                                  <p className="text-sm font-medium leading-relaxed text-foreground/80 break-words">
                                    {note.note}
                                  </p>
                                  <div className="flex items-center justify-between pt-1">
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-full bg-muted/50 flex items-center justify-center">
                                        <User className="w-3 h-3 text-muted-foreground" />
                                      </div>
                                      <span className="text-[11px] font-bold text-muted-foreground">
                                        {note.staffName}
                                      </span>
                                    </div>
                                    <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-tighter bg-muted/50 text-muted-foreground border-none">
                                      {note.shiftName}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>

                {isLoadingMore && (
                  <div className="py-4 text-center text-sm text-muted-foreground">Đang tải thêm...</div>
                )}

                {visibleDates.length < sortedDates.length && (
                  <div className="py-2 text-center text-xs text-muted-foreground">Kéo xuống để xem thêm</div>
                )}
              </>
            ) : (
              <div className="bg-background rounded-[2rem] border-2 border-dashed border-muted p-12 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mx-auto">
                  <MessageSquare className="w-8 h-8 text-muted-foreground/30" />
                </div>
                <div className="space-y-1">
                  <p className="font-black text-muted-foreground">Chưa có ghi chú nào</p>
                  <p className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest">
                    Nhấn nút bên dưới để bắt đầu quét dữ liệu
                  </p>
                </div>
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter className="bg-muted/5 border-t p-6">
          <DialogCancel className="rounded-xl font-bold flex-1 sm:flex-none">
            Đóng
          </DialogCancel>
          <DialogAction 
            onClick={handleScan} 
            isLoading={isScanning}
            disabled={isScanning}
            className="rounded-xl font-black min-w-[200px] flex-1 sm:flex-none"
          >
            {isScanning ? (
              "Đang quét dữ liệu..."
            ) : (
              <>
                <Wand2 className="mr-2 h-5 w-5" />
                Quét báo cáo mới
              </>
            )}
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
