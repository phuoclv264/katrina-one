'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, Copy, Check, X, ImageIcon, Info, Calendar, Layout, Clock, ChevronRight, History, Loader2 } from 'lucide-react';
import { dataStore } from '@/lib/data-store';
import type { TasksByShift, Task, ShiftReport } from '@/lib/types';
import { cn, advancedSearch } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogCancel,
} from '@/components/ui/dialog';

interface InstructionResource {
  taskId: string;
  taskText: string;
  shiftName: string;
  sectionTitle: string;
  instructionText?: string;
  images: { url: string; caption?: string }[];
}

interface ReportResource {
  date: string;
  taskId: string;
  staffName: string;
  photos: string[];
  note: string;
}

interface ImageReuseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (instruction: { text?: string; images: { url: string; caption?: string }[] }) => void;
  parentDialogTag?: string;
  taskId?: string;
  taskName?: string;
}

export function ImageReuseDialog({ isOpen, onClose, onSelect, parentDialogTag = 'task-dialog', taskId = '', taskName = '' }: ImageReuseDialogProps) {
  const [activeTab, setActiveTab] = useState<'library' | 'reports'>('library');
  const [searchTerm, setSearchTerm] = useState('');
  const [resources, setResources] = useState<InstructionResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShift, setSelectedShift] = useState<string | 'all'>('all');

  // Multi-select state for reports
  const [selectedReportPhotos, setSelectedReportPhotos] = useState<string[]>([]);

  // Reports state
  const [reportResources, setReportResources] = useState<ReportResource[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [hasMoreReports, setHasMoreReports] = useState(true);
  const [lastDate, setLastDate] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    const unsubscribe = dataStore.subscribeToTasks((tasksByShift) => {
      const allResources: InstructionResource[] = [];

      Object.entries(tasksByShift || {}).forEach(([shiftId, shift]) => {
        shift.sections?.forEach((section) => {
          section.tasks?.forEach((task) => {
            if (task.instruction?.images && task.instruction.images.length > 0) {
              allResources.push({
                taskId: task.id,
                taskText: task.text,
                shiftName: shift.name,
                sectionTitle: section.title,
                instructionText: task.instruction.text,
                images: task.instruction.images.map(img =>
                  typeof img === 'string' ? { url: img, caption: '' } : { url: img.url, caption: img.caption || '' }
                ),
              });
            }
          });
        });
      });

      setResources(allResources);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen]);

  const fetchReports = useCallback(async (isInitial = false) => {
    if (reportsLoading || (!hasMoreReports && !isInitial)) return;

    setReportsLoading(true);
    try {
      // If taskId is provided, fetch reports for that task specifically.
      // If not, it will fetch any reports with photos (as per our dataStore implementation).
      const newReports = await dataStore.getTaskReportsByDays(
        taskId,
        isInitial ? undefined : lastDate,
        10
      );

      // Check if we got zero reports, which means we might have reached the end of time (or just a gap)
      // Note: Since we fetch strictly by date range now, we only stop if we feel we've gone back far enough
      // or if the results are empty across a significant period. 
      // For now, let's stop if results are empty to avoid infinite loops if the user keeps scrolling.
      if (newReports.length === 0) {
        setHasMoreReports(false);
      }

      const formatted: ReportResource[] = newReports.flatMap(report => {
        const dateStr = report.date;
        // Filter by taskId if provided
        const relevantTasks = taskId
          ? (report.completedTasks?.[taskId] ? { [taskId]: report.completedTasks[taskId] } : {})
          : report.completedTasks;

        if (!relevantTasks) return [];

        return Object.entries(relevantTasks).flatMap(([tid, completions]) => {
          if (!completions) return [];
          return completions.filter(c => c.photos && c.photos.length > 0).map(c => ({
            date: dateStr,
            taskId: tid,
            staffName: report.staffName,
            photos: c.photos || [],
            note: c.note || ''
          }));
        });
      });

      setReportResources(prev => isInitial ? formatted : [...prev, ...formatted]);
      if (newReports.length > 0) {
        setLastDate(newReports[newReports.length - 1].date);
      }
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    } finally {
      setReportsLoading(false);
    }
  }, [lastDate, reportsLoading, hasMoreReports, taskId]);

  useEffect(() => {
    if (isOpen && activeTab === 'reports' && reportResources.length === 0) {
      fetchReports(true);
    }
  }, [isOpen, activeTab, fetchReports, reportResources.length]);

  useEffect(() => {
    // Reset reports when taskId changes or dialog reopens
    if (isOpen) {
      setReportResources([]);
      setLastDate(undefined);
      setHasMoreReports(true);
      setSelectedReportPhotos([]); // Clear selections on reopen
    }
  }, [isOpen, taskId]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 100) {
      if (activeTab === 'reports') {
        // fetchReports(); // Removed infinite scroll automatically
      }
    }
  };

  const shifts = useMemo(() => {
    const defaultShifts = ['Ca sáng', 'Ca trưa', 'Ca tối'];
    // Use a Map to track unique names by their lowercase version to avoid "Ca sáng" vs "Ca Sáng"
    const shiftMap = new Map<string, string>();
    
    // Seed with defaults
    defaultShifts.forEach(s => shiftMap.set(s.toLowerCase(), s));
    
    // Add shifts from resources, only if they don't exist (case-insensitive)
    resources.forEach(r => {
      const lowName = r.shiftName.toLowerCase();
      if (!shiftMap.has(lowName)) {
        shiftMap.set(lowName, r.shiftName);
      }
    });

    const uniqueShifts = Array.from(shiftMap.values());

    return uniqueShifts.sort((a, b) => {
      const order = { 'ca sáng': 1, 'ca trưa': 2, 'ca tối': 3 };
      const valA = order[a.toLowerCase() as keyof typeof order] || 99;
      const valB = order[b.toLowerCase() as keyof typeof order] || 99;
      if (valA !== valB) return valA - valB;
      return a.localeCompare(b);
    });
  }, [resources]);

  const filteredResources = useMemo(() => {
    let result = resources;
    if (selectedShift !== 'all') {
      result = result.filter(r => r.shiftName === selectedShift);
    }
    if (!searchTerm) return result;

    // We use a custom key for taskText because it contains HTML (from RichTextEditor)
    return advancedSearch(result, searchTerm, [
      (item) => item.taskText.replace(/<[^>]*>/g, ''),
      'sectionTitle',
      'shiftName'
    ]);
  }, [resources, searchTerm, selectedShift]);

  const filteredReportResources = useMemo(() => {
    if (!searchTerm) return reportResources;
    return advancedSearch(reportResources, searchTerm, ['staffName', 'note', 'date']);
  }, [reportResources, searchTerm]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} dialogTag="image-reuse-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="max-w-3xl lg:max-w-3xl h-[100dvh] sm:h-[90vh] flex flex-col overflow-hidden sm:rounded-[32px] border-none shadow-2xl transition-all duration-500">
        <DialogHeader className="shrink-0 relative overflow-hidden" variant="premium" icon={<Copy className="h-6 w-6" />}>
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <ImageIcon className="h-32 w-32 rotate-12" />
          </div>
          <DialogTitle className="text-2xl sm:text-3xl tracking-tight font-black">Thư viện Hình ảnh</DialogTitle>
          <DialogDescription className="font-medium max-w-md">
            {taskName ? (
              <>Đang chọn ảnh cho công việc: <span className="text-indigo-600 font-bold" dangerouslySetInnerHTML={{ __html: taskName }} /></>
            ) : (
              "Tìm kiếm mẫu hoặc báo cáo cũ để tái sử dụng hình ảnh hướng dẫn."
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as any)}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="px-5 py-2 bg-background/80 backdrop-blur-xl border-b border-zinc-100 flex flex-col gap-3 shrink-0 sticky top-0 z-20">
            <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-zinc-100/50 p-1">
              <TabsTrigger value="library" className="rounded-xl font-bold text-xs uppercase tracking-widest py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Layout className="h-3.5 w-3.5 mr-2" />
                Mẫu chuẩn
              </TabsTrigger>
              <TabsTrigger value="reports" className="rounded-xl font-bold text-xs uppercase tracking-widest py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <History className="h-3.5 w-3.5 mr-2" />
                Báo cáo cũ
              </TabsTrigger>
            </TabsList>

            <div className="relative group">
              <div className="absolute inset-0 bg-indigo-500/5 blur-xl group-focus-within:bg-indigo-500/10 transition-all rounded-full pointer-events-none" />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-indigo-500 transition-colors" />
              <Input
                placeholder={activeTab === 'library' ? "Tìm theo nội dung, khu vực..." : "Tìm theo người báo cáo, ghi chú..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-11 h-12 bg-white sm:bg-zinc-50/50 border-zinc-200/60 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/5 transition-all rounded-2xl shadow-sm text-base"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 hover:bg-zinc-100 rounded-full text-muted-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {activeTab === 'library' && (
              <ScrollArea className="w-full">
                <div className="flex items-center gap-2 pb-1">
                  <button
                    onClick={() => setSelectedShift('all')}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border",
                      selectedShift === 'all'
                        ? "bg-zinc-800 text-white border-zinc-800 shadow-md shadow-zinc-200"
                        : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300"
                    )}
                  >
                    Tất cả ca
                  </button>
                  {shifts.map(shift => (
                    <button
                      key={shift}
                      onClick={() => setSelectedShift(shift)}
                      className={cn(
                        "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border",
                        selectedShift === shift
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100"
                          : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300"
                      )}
                    >
                      {shift}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <DialogBody className="flex-1 overflow-hidden p-0 bg-zinc-50/30">
            <TabsContent value="library" className="h-full m-0">
              <ScrollArea className="h-full">
                <div className="px-5 py-6 pb-24 space-y-4">
                  {loading ? (
                    <LibrarySkeleton />
                  ) : filteredResources.length === 0 ? (
                    <EmptyState onReset={() => { setSearchTerm(''); setSelectedShift('all'); }} />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {filteredResources.map((res, idx) => (
                        <LibraryCard key={`${res.taskId}-${idx}`} resource={res} onSelect={onSelect} onClose={onClose} />
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="reports" className="h-full m-0">
              <ScrollArea className="h-full" onScrollCapture={handleScroll}>
                <div className="px-5 py-6 pb-24 space-y-6">
                  {reportResources.length === 0 && reportsLoading ? (
                    <ReportsSkeleton />
                  ) : filteredReportResources.length === 0 ? (
                    <EmptyState title="Không có báo cáo" onReset={() => setSearchTerm('')} />
                  ) : (
                    <div className="space-y-8">
                      {/* Group by Date */}
                      {Object.entries(
                        filteredReportResources.reduce((acc, curr) => {
                          if (!acc[curr.date]) acc[curr.date] = [];
                          acc[curr.date].push(curr);
                          return acc;
                        }, {} as Record<string, ReportResource[]>)
                      ).map(([date, items]) => (
                        <div key={date} className="space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="h-px flex-1 bg-zinc-200" />
                            <Badge variant="secondary" className="bg-white border-zinc-200 text-zinc-500 rounded-lg px-3 py-1 font-bold text-[10px] uppercase tracking-widest">
                              <Calendar className="h-3 w-3 mr-1.5" />
                              {date}
                            </Badge>
                            <div className="h-px flex-1 bg-zinc-200" />
                          </div>

                          <div className="grid grid-cols-1 gap-4">
                            {items.map((item: ReportResource, idx: number) => (
                              <ReportItemCard 
                                key={`${item.taskId}-${idx}`} 
                                item={item} 
                                selectedPhotos={selectedReportPhotos}
                                onTogglePhoto={(url) => setSelectedReportPhotos(prev => 
                                  prev.includes(url) ? prev.filter(p => p !== url) : [...prev, url]
                                )}
                              />
                            ))}
                          </div>
                        </div>
                      ))}

                      {hasMoreReports && !reportsLoading && (
                        <div className="flex justify-center pt-4">
                          <Button 
                            variant="outline" 
                            onClick={() => fetchReports()}
                            className="rounded-2xl border-indigo-100 bg-indigo-50/30 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 font-bold text-[11px] uppercase tracking-widest px-8 h-10 transition-all"
                          >
                            Xem báo cáo cũ hơn
                          </Button>
                        </div>
                      )}

                      {reportsLoading && (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </DialogBody>
        </Tabs>

        <DialogFooter className="bg-white/80 backdrop-blur-xl p-5 border-t border-zinc-100 sm:flex-row items-center gap-4 shrink-0">
          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full sm:w-auto h-12 rounded-2xl font-bold text-zinc-500 hover:bg-zinc-100 sm:px-8"
          >
            Hủy bỏ
          </Button>

          {activeTab === 'reports' && selectedReportPhotos.length > 0 ? (
            <Button
              onClick={() => {
                // Get unique notes from reports that had photos selected
                const relevantNotes = reportResources
                  .filter(r => r.photos.some(p => selectedReportPhotos.includes(p)))
                  .map(r => r.note)
                  .filter(n => n && n.trim() !== '');

                onSelect({
                  text: relevantNotes.length > 0 ? relevantNotes.join('\n---\n') : '',
                  images: selectedReportPhotos.map(url => ({ url, caption: '' }))
                });
                onClose();
              }}
              className="w-full sm:w-auto h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest px-8 shadow-lg shadow-indigo-200"
            >
              Sử dụng {selectedReportPhotos.length} ảnh đã chọn
            </Button>
          ) : (
            <div className="hidden sm:flex flex-1 items-center justify-center">
              <div className="px-4 py-1.5 rounded-full bg-zinc-50 border border-zinc-200/50 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                {activeTab === 'library' ? `Tìm thấy ${filteredResources.length} mẫu có sẵn` : `Chọn ảnh từ các báo cáo bên trên`}
              </div>
            </div>
          )}

          <div className="w-full sm:w-auto flex items-center gap-2 sm:hidden">
            <div className="flex-1 h-[1px] bg-zinc-100" />
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
              {activeTab === 'library' ? `${filteredResources.length} kết quả` : ''}
            </span>
            <div className="flex-1 h-[1px] bg-zinc-100" />
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LibrarySkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="p-5 rounded-[28px] bg-white border border-zinc-100 space-y-4 shadow-sm">
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-3 flex-1">
              <div className="flex gap-2">
                <Skeleton className="h-4 w-16 rounded-full" />
                <Skeleton className="h-4 w-24 rounded-full" />
              </div>
              <Skeleton className="h-5 w-full rounded-md" />
              <Skeleton className="h-5 w-2/3 rounded-md" />
            </div>
            <Skeleton className="h-16 w-16 rounded-2xl shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-8">
      {[1, 2].map((i) => (
        <div key={i} className="space-y-4">
          <div className="flex justify-center">
            <Skeleton className="h-6 w-32 rounded-lg" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((j) => (
              <div key={j} className="p-5 rounded-[32px] bg-white border border-zinc-100 space-y-4 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-1/3 rounded-md" />
                    <Skeleton className="h-4 w-1/2 rounded-md" />
                  </div>
                  <div className="flex gap-1">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                    <Skeleton className="h-12 w-12 rounded-xl" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title = "Không tìm thấy mẫu", onReset }: { title?: string, onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in duration-500">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-indigo-500/10 blur-3xl rounded-full scale-150 rotate-12" />
        <div className="relative h-24 w-24 rounded-[32px] bg-gradient-to-br from-indigo-50 to-white shadow-xl flex items-center justify-center border border-indigo-100/50">
          <ImageIcon className="h-12 w-12 text-indigo-200" />
          <Search className="absolute -bottom-2 -right-2 h-8 w-8 text-indigo-600 bg-white rounded-full p-1.5 shadow-lg border border-indigo-50" />
        </div>
      </div>
      <div className="text-center space-y-3 max-w-[280px]">
        <p className="font-black text-zinc-900 uppercase tracking-widest text-sm">{title}</p>
        <p className="text-[13px] text-zinc-500 leading-relaxed font-medium">
          Chúng tôi không tìm thấy kết quả nào phù hợp. Thử thay đổi từ khóa hoặc bộ lọc.
        </p>
        <Button
          variant="outline"
          onClick={onReset}
          className="mt-4 rounded-xl border-zinc-200 font-bold text-xs uppercase tracking-widest px-6"
        >
          Đặt lại tất cả
        </Button>
      </div>
    </div>
  );
}

function LibraryCard({ resource, onSelect, onClose }: { resource: InstructionResource, onSelect: any, onClose: any }) {
  return (
    <div
      className="group relative flex flex-col justify-between p-5 rounded-[32px] bg-white border border-zinc-100/80 hover:border-indigo-300 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 cursor-pointer overflow-hidden shadow-sm"
      onClick={() => {
        onSelect({ text: resource.instructionText, images: resource.images });
        onClose();
      }}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/[0.03] blur-3xl -mr-16 -mt-16 group-hover:bg-indigo-500/[0.07] transition-colors rounded-full" />

      <div className="space-y-4 relative z-10">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100/50">
                <Clock className="h-3 w-3" />
                <span className="text-[10px] font-black uppercase tracking-tight">{resource.shiftName}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-50 text-zinc-600 border border-zinc-200/50">
                <Layout className="h-3 w-3" />
                <span className="text-[10px] font-black uppercase tracking-tight">{resource.sectionTitle}</span>
              </div>
            </div>

            <h4
              className="text-[16px] font-bold text-zinc-900 leading-[1.3] mb-3 pr-2"
              dangerouslySetInnerHTML={{ __html: resource.taskText }}
            />
          </div>

          <div className="shrink-0 relative">
            {resource.images.slice(0, 2).map((img: any, i: number) => (
              <div
                key={i}
                className={cn(
                  "h-16 w-16 sm:h-20 sm:w-20 rounded-2xl border-4 border-white shadow-xl overflow-hidden bg-zinc-100 transition-all duration-500 shadow-indigo-200/20",
                  i === 0 ? "relative z-10 rotate-3 group-hover:rotate-0" : "absolute top-2 -right-4 -rotate-6 group-hover:-rotate-12 group-hover:-translate-x-2 opacity-40 group-hover:opacity-60"
                )}
              >
                <img src={img.url} className="w-full h-full object-cover" alt="" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-zinc-50">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-1.5">
              {resource.images.slice(0, 3).map((_: any, i: number) => (
                <div key={i} className="h-1.5 w-1.5 rounded-full bg-indigo-200 border border-white" />
              ))}
              {resource.images.length > 3 && <div className="h-1.5 w-1.5 rounded-full bg-zinc-200 border border-white" />}
            </div>
            <span className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">{resource.images.length} hình ảnh</span>
          </div>
          <div className="h-8 w-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
            <ChevronRight className="h-4 w-4" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportItemCard({ item, selectedPhotos, onTogglePhoto }: { item: ReportResource, selectedPhotos: string[], onTogglePhoto: (url: string) => void }) {
  return (
    <div className="p-5 rounded-[32px] bg-white border border-zinc-100 shadow-sm space-y-5">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-[13px] font-bold text-zinc-900">{item.staffName}</p>
          {item.note && (
            <p className="text-[12px] text-zinc-500 italic line-clamp-1">{item.note}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-50 text-zinc-500 border border-zinc-100">
          <span className="text-[10px] font-black uppercase tracking-tight">
            {item.photos.filter(p => selectedPhotos.includes(p)).length} / {item.photos.length}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
        {item.photos.map((url: string, idx: number) => {
          const isSelected = selectedPhotos.includes(url);
          return (
            <div
              key={idx}
              onClick={() => onTogglePhoto(url)}
              className={cn(
                "aspect-square rounded-xl overflow-hidden cursor-pointer relative transition-all duration-300 ring-2 ring-offset-2",
                isSelected
                  ? "ring-indigo-500 scale-95"
                  : "ring-transparent hover:scale-105"
              )}
            >
              <img src={url} className="w-full h-full object-cover" alt="" />
              {isSelected && (
                <div className="absolute inset-0 bg-indigo-600/30 flex items-center justify-center">
                  <div className="h-6 w-6 rounded-full bg-white text-indigo-600 flex items-center justify-center shadow-lg transform scale-100 animate-in zoom-in">
                    <Check className="h-4 w-4" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

