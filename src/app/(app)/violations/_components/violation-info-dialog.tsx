
'use client';
import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { ViolationCategory, FineRule } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

type ViolationInfoDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  categories: ViolationCategory[];
  generalRules?: FineRule[];
};

const getSeverityBadgeClass = (severity: ViolationCategory['severity']) => {
    switch (severity) {
  case 'high': return 'violation-high';
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

export default function ViolationInfoDialog({ isOpen, onClose, categories, generalRules = [] }: ViolationInfoDialogProps) {
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
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl h-[90vh] flex flex-col bg-dialog p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="text-lg">Chính sách phạt</DialogTitle>
        </DialogHeader>

        <div className="px-4 border-b bg-muted/50 sticky top-0 z-10 bg-background/95 backdrop-blur">
          <div className="flex h-10 items-center text-xs font-medium text-muted-foreground">
            <div className="w-[40%] px-2 text-left">Tên vi phạm</div>
            <div className="w-[30%] px-2 text-center">Mức độ</div>
            <div className="w-[30%] px-2 text-right">Mức phạt</div>
          </div>
        </div>

        <ScrollArea className="flex-grow">
            <div className="px-4">
                <Table>
                    <TableBody>
                        {sortedCategories.map((category) => (
                        <TableRow key={category.id}>
                            <TableCell className="font-medium py-1.5 px-2 w-[40%] text-sm">{category.name}</TableCell>
                            <TableCell className="text-center py-1.5 px-2 w-[30%]">
                                <Badge className={cn("capitalize text-xs", getSeverityBadgeClass(category.severity))}>
                                    {category.severity === 'low' ? 'Nhẹ' : category.severity === 'medium' ? 'TB' : 'Nặng'}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold py-1.5 px-2 w-[30%] text-sm">
                            {category.calculationType === 'perUnit'
                                ? `${(category.finePerUnit ?? 0).toLocaleString('vi-VN')}đ / ${category.unitLabel || 'đơn vị'}`
                                : `${(category.fineAmount ?? 0).toLocaleString('vi-VN')}đ`
                            }
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </ScrollArea>
        <DialogFooter className="p-4 pt-2 border-t flex-col items-start gap-2 sm:flex-col sm:items-start bg-white dark:bg-card">
          <Label className="text-xs font-semibold text-muted-foreground w-full">
            Quy tắc phạt chung
          </Label>
          <div className="w-full text-xs text-muted-foreground p-2 border rounded-lg bg-muted/50 whitespace-pre-wrap">
            {generalRuleSummary ? generalRuleSummary : 'Không có quy tắc phạt chung nào được thiết lập.'}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
