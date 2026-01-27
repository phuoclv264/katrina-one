'use client';
import React, { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogBody,
  DialogAction,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { ViolationCategory, FineRule } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Search, Info, SlidersHorizontal, X } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

type ViolationInfoDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  categories: ViolationCategory[];
  generalRules?: FineRule[];
  parentDialogTag: string;
};

const getSeverityBadgeClass = (severity: ViolationCategory['severity']) => {
  switch (severity) {
    case 'high': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700';
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700';
    case 'low':
    default:
      return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700';
  }
};

const severityOrder: Record<ViolationCategory['severity'], number> = {
  low: 1,
  medium: 2,
  high: 3
};

export default function ViolationInfoDialog({ isOpen, onClose, categories, generalRules = [], parentDialogTag }: ViolationInfoDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<ViolationCategory['severity'] | 'all'>('all');

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const severityA = severityOrder[a.severity] || 99;
      const severityB = severityOrder[b.severity] || 99;
      if (severityA !== severityB) {
        return severityA - severityB;
      }
      return (a.name || '').localeCompare(b.name || '', 'vi');
    });
  }, [categories]);

  const filteredCategories = useMemo(() => {
    return sortedCategories.filter(cat => {
      const matchSearch = (cat.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchSeverity = severityFilter === 'all' || cat.severity === severityFilter;
      return matchSearch && matchSeverity;
    });
  }, [sortedCategories, searchTerm, severityFilter]);

  const generalRuleSummary = useMemo(() => {
    if (!generalRules || generalRules.length === 0) return null;
    return generalRules.map(rule => {
      let conditionText = '';
      if (rule.condition === 'repeat_in_month') {
        conditionText = `lặp lại từ lần thứ ${rule.threshold} trong tháng`;
      } else if (rule.condition === 'is_flagged') {
        conditionText = `bị gắn cờ đỏ`;
      }

      let actionText = '';
      if (rule.action === 'multiply') {
        actionText = `nhân tiền phạt với ${rule.value}`;
      } else {
        actionText = `cộng thêm ${rule.value.toLocaleString('vi-VN')}đ`;
      }

      let severityActionText = '';
      if (rule.severityAction === 'increase') {
        severityActionText = ', tăng mức độ vi phạm';
      } else if (rule.severityAction === 'set_to_high') {
        severityActionText = ', chuyển thành vi phạm nghiêm trọng';
      }

      return `- Nếu một vi phạm ${conditionText} thì ${actionText}${severityActionText}.`;
    }).join('\n');
  }, [generalRules]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose} dialogTag="violation-info-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="max-w-2xl flex flex-col p-0">
        <DialogHeader variant="info" iconkey="info">
          <DialogTitle>Chính sách vi phạm</DialogTitle>
          <DialogDescription>
            Tra cứu mức phạt và quy định
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col p-0 overflow-hidden">
          <div className="px-6 py-4 border-b flex flex-col gap-3 bg-muted/5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm kiếm vi phạm..."
                  className="pl-9 h-11 bg-background rounded-xl border-muted-foreground/20 focus-visible:ring-primary/20"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-transparent"
                    onClick={() => setSearchTerm('')}
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-11 px-4 rounded-xl border-muted-foreground/20 flex gap-2 bg-background hover:bg-muted/10">
                    <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-semibold hidden sm:inline">
                      {severityFilter === 'all' ? 'Tất cả' : 
                       severityFilter === 'low' ? 'Nhẹ' : 
                       severityFilter === 'medium' ? 'Trung bình' : 'Nghiêm trọng'}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-2xl p-2">
                  <DropdownMenuLabel className="text-[10px] font-bold uppercase text-muted-foreground px-2 py-1.5">
                    Mức độ vi phạm
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="my-1" />
                  <DropdownMenuRadioGroup value={severityFilter} onValueChange={(v) => setSeverityFilter(v as any)}>
                    {[
                      { id: 'all', label: 'Tất cả mức độ' },
                      { id: 'low', label: 'Vi phạm Nhẹ' },
                      { id: 'medium', label: 'Vi phạm Trung bình' },
                      { id: 'high', label: 'Vi phạm Nghiêm trọng' }
                    ].map((s) => (
                      <DropdownMenuRadioItem 
                        key={s.id} 
                        value={s.id}
                        className="rounded-xl text-xs py-2 px-3"
                      >
                        {s.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="px-6 border-b bg-muted/30 sticky top-0 z-10">
            <div className="flex h-10 items-center text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              <div className="w-[45%] text-left px-2">Loại vi phạm</div>
              <div className="w-[25%] text-center px-2">Mức độ</div>
              <div className="w-[30%] text-right px-2">Mức phạt</div>
            </div>
          </div>

          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="px-4 pb-4">
              <Table>
                <TableBody>
                  {filteredCategories.length > 0 ? (
                    filteredCategories.map((category) => (
                      <TableRow key={category.id} className="hover:bg-muted/30 border-b-muted/20">
                        <TableCell className="font-semibold py-3 px-2 w-[45%] text-sm leading-tight text-foreground/90">
                          {category.name}
                        </TableCell>
                        <TableCell className="text-center py-3 px-2 w-[25%]">
                          <Badge className={cn("text-[10px] px-2 py-0.5 h-auto font-bold uppercase border shadow-none", getSeverityBadgeClass(category.severity))}>
                            {category.severity === 'low' ? 'Nhẹ' : category.severity === 'medium' ? 'TB' : 'Nặng'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold py-3 px-2 w-[30%] text-sm text-primary">
                          {category.calculationType === 'perUnit'
                            ? `${(category.finePerUnit ?? 0).toLocaleString('vi-VN')}đ / ${category.unitLabel || 'đơn vị'}`
                            : `${(category.fineAmount ?? 0).toLocaleString('vi-VN')}đ`
                          }
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="h-40 text-center text-muted-foreground italic">
                        Không tìm thấy vi phạm nào khớp với bộ lọc
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </DialogBody>

        <DialogFooter className="flex-row items-center justify-between gap-4 border-t p-4 sm:p-6 bg-background shrink-0">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full gap-2 border-primary/20 hover:bg-primary/5 text-primary h-9 px-4">
                <Info className="h-4 w-4" />
                <span className="text-xs font-bold">Quy tắc chung</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="center" className="max-w-[300px] p-4 bg-card shadow-2xl border-primary/20 rounded-2xl">
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-primary/10">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <Info className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-xs font-bold text-primary tracking-tight">
                    CÁC QUY TẮC PHẠT CHUNG
                  </p>
                </div>
                <div className="text-[11px] leading-relaxed text-foreground/80 whitespace-pre-wrap font-medium">
                  {generalRuleSummary ? generalRuleSummary : 'Không có quy tắc phạt chung nào được thiết lập.'}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <DialogAction variant="secondary" onClick={onClose} className="h-10 px-8 rounded-full">
            Đóng
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
