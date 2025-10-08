'use client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { ViolationCategory } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type ViolationInfoDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  categories: ViolationCategory[];
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

export default function ViolationInfoDialog({ isOpen, onClose, categories }: ViolationInfoDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Quy định Vi phạm & Mức phạt</DialogTitle>
          <DialogDescription>
            Danh sách các loại vi phạm và mức phạt tương ứng được áp dụng tại cửa hàng.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
            <div className="border rounded-lg">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead className="w-[40%]">Tên vi phạm</TableHead>
                    <TableHead className="text-center">Mức độ</TableHead>
                    <TableHead className="text-right">Mức phạt</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {categories.map((category) => (
                    <TableRow key={category.id}>
                        <TableCell className="font-medium">{category.name}</TableCell>
                        <TableCell className="text-center">
                            <Badge className={cn("capitalize", getSeverityBadgeClass(category.severity))}>
                                {category.severity === 'low' ? 'Nhẹ' : category.severity === 'medium' ? 'TB' : 'Nặng'}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
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
      </DialogContent>
    </Dialog>
  );
}
