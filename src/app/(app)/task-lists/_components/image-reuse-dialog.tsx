'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, Copy, Check, X, ImageIcon, Info, Calendar, Layout, Clock, ChevronRight } from 'lucide-react';
import { dataStore } from '@/lib/data-store';
import type { TasksByShift, Task } from '@/lib/types';
import { cn, advancedSearch } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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

interface ImageReuseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (instruction: { text?: string; images: { url: string; caption?: string }[] }) => void;
  parentDialogTag?: string;
}

export function ImageReuseDialog({ isOpen, onClose, onSelect, parentDialogTag = 'task-dialog' }: ImageReuseDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [resources, setResources] = useState<InstructionResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShift, setSelectedShift] = useState<string | 'all'>('all');

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

  const shifts = useMemo(() => {
    const uniqueShifts = Array.from(new Set(resources.map(r => r.shiftName)));
    return uniqueShifts.sort();
  }, [resources]);

  const filteredResources = useMemo(() => {
    let result = resources;
    if (selectedShift !== 'all') {
      result = result.filter(r => r.shiftName === selectedShift);
    }
    if (!searchTerm) return result;
    return advancedSearch(result, searchTerm, ['taskText', 'sectionTitle', 'shiftName']);
  }, [resources, searchTerm, selectedShift]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} dialogTag="image-reuse-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="max-w-3xl h-[100dvh] sm:h-[90vh] flex flex-col overflow-hidden sm:rounded-[32px] border-none shadow-2xl transition-all duration-500">
        <DialogHeader className="shrink-0 relative overflow-hidden" variant="premium" icon={<Copy className="h-6 w-6" />}>
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <ImageIcon className="h-32 w-32 rotate-12" />
          </div>
          <DialogTitle className="text-2xl sm:text-3xl tracking-tight font-black">Thư viện Hướng dẫn</DialogTitle>
          <DialogDescription className="font-medium max-w-md">
            Tận dụng các quy trình chuẩn đã được xây dựng để tiết kiệm thời gian thiết lập.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-4 bg-background/80 backdrop-blur-xl border-b border-zinc-100 flex flex-col gap-3 shrink-0 sticky top-0 z-20">
          <div className="relative group">
            <div className="absolute inset-0 bg-indigo-500/5 blur-xl group-focus-within:bg-indigo-500/10 transition-all rounded-full" />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-indigo-500 transition-colors" />
            <Input
              placeholder="Tìm theo nội dung, khu vực..."
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
        </div>

        <DialogBody className="flex-1 overflow-hidden p-0 bg-zinc-50/30">
          <ScrollArea className="h-full">
            <div className="px-5 py-6 pb-24 space-y-4">
              {loading ? (
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
              ) : filteredResources.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in duration-500">
                  <div className="relative mb-8">
                    <div className="absolute inset-0 bg-indigo-500/10 blur-3xl rounded-full scale-150 rotate-12" />
                    <div className="relative h-24 w-24 rounded-[32px] bg-gradient-to-br from-indigo-50 to-white shadow-xl flex items-center justify-center border border-indigo-100/50">
                      <ImageIcon className="h-12 w-12 text-indigo-200" />
                      <Search className="absolute -bottom-2 -right-2 h-8 w-8 text-indigo-600 bg-white rounded-full p-1.5 shadow-lg border border-indigo-50" />
                    </div>
                  </div>
                  <div className="text-center space-y-3 max-w-[280px]">
                    <p className="font-black text-zinc-900 uppercase tracking-widest text-sm">Không tìm thấy mẫu</p>
                    <p className="text-[13px] text-zinc-500 leading-relaxed font-medium">
                      Chúng tôi không tìm thấy kết quả nào phù hợp. Thử thay đổi từ khóa hoặc bộ lọc ca.
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setSearchTerm('');
                        setSelectedShift('all');
                      }}
                      className="mt-4 rounded-xl border-zinc-200 font-bold text-xs uppercase tracking-widest px-6"
                    >
                      Đặt lại tất cả
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredResources.map((res, idx) => (
                    <div 
                      key={`${res.taskId}-${idx}`}
                      className="group relative flex flex-col justify-between p-5 rounded-[32px] bg-white border border-zinc-100/80 hover:border-indigo-300 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 cursor-pointer overflow-hidden shadow-sm"
                      onClick={() => {
                        onSelect({ text: res.instructionText, images: res.images });
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
                                <span className="text-[10px] font-black uppercase tracking-tight">{res.shiftName}</span>
                              </div>
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-50 text-zinc-600 border border-zinc-200/50">
                                <Layout className="h-3 w-3" />
                                <span className="text-[10px] font-black uppercase tracking-tight">{res.sectionTitle}</span>
                              </div>
                            </div>
                            
                            <h4 
                              className="text-[16px] font-bold text-zinc-900 leading-[1.3] mb-3 line-clamp-2 pr-2" 
                              dangerouslySetInnerHTML={{ __html: res.taskText }} 
                            />
                          </div>

                          <div className="shrink-0 relative">
                            {res.images.slice(0, 2).map((img, i) => (
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
                              {/* Small circle indicators for total images */}
                              {res.images.slice(0, 3).map((_, i) => (
                                <div key={i} className="h-1.5 w-1.5 rounded-full bg-indigo-200 border border-white" />
                              ))}
                              {res.images.length > 3 && <div className="h-1.5 w-1.5 rounded-full bg-zinc-200 border border-white" />}
                            </div>
                            <span className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">{res.images.length} hình ảnh</span>
                          </div>
                          <div className="h-8 w-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                            <ChevronRight className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogBody>

        <DialogFooter className="bg-white/80 backdrop-blur-xl p-5 border-t border-zinc-100 sm:flex-row items-center gap-4 shrink-0">
          <Button 
            variant="ghost" 
            onClick={onClose} 
            className="w-full sm:w-autoh-12 rounded-2xl font-bold text-zinc-500 hover:bg-zinc-100 sm:px-8"
          >
            Hủy bỏ
          </Button>
          <div className="hidden sm:flex flex-1 items-center justify-center">
            <div className="px-4 py-1.5 rounded-full bg-zinc-50 border border-zinc-200/50 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
              Tìm thấy {filteredResources.length} mẫu có sẵn
            </div>
          </div>
          <div className="w-full sm:w-auto flex items-center gap-2 sm:hidden">
             <div className="flex-1 h-[1px] bg-zinc-100" />
             <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{filteredResources.length} kết quả</span>
             <div className="flex-1 h-[1px] bg-zinc-100" />
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
