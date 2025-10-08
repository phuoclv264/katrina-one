
'use client';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { ViolationCategory } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, Save, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'react-hot-toast';


type ViolationInfoDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  categories: ViolationCategory[];
  generalNote?: string;
  onSaveNote?: (newNote: string) => void;
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

export default function ViolationInfoDialog({ isOpen, onClose, categories, generalNote = '', onSaveNote }: ViolationInfoDialogProps) {
  const { user } = useAuth();
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteContent, setNoteContent] = useState(generalNote);

  useEffect(() => {
    if (isOpen) {
        setNoteContent(generalNote);
        setIsEditingNote(false);
    }
  }, [isOpen, generalNote]);

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
  
  const handleSaveNote = () => {
    if (onSaveNote) {
        onSaveNote(noteContent);
        toast.success("Đã lưu ghi chú.");
    }
    setIsEditingNote(false);
  }

  const isOwner = user?.role === 'Chủ nhà hàng';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white dark:bg-card">
        <DialogHeader>
          <DialogTitle>Chính sách phạt</DialogTitle>
          <DialogDescription>
            Danh sách các loại vi phạm và mức phạt tương ứng được áp dụng tại cửa hàng.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] -mx-6 px-6">
            <div className="border rounded-lg overflow-hidden">
                <Table>
                <TableHeader className="sticky top-0 bg-background/95 backdrop-blur z-10">
                    <TableRow>
                    <TableHead className="w-[40%]">Tên vi phạm</TableHead>
                    <TableHead className="text-center">Mức độ</TableHead>
                    <TableHead className="text-right">Mức phạt</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedCategories.map((category) => (
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
         <DialogFooter className="border-t pt-4 flex-col items-start gap-2 sm:flex-row sm:items-center">
            <div className="w-full space-y-2">
                <Label htmlFor="general-note" className="text-xs font-semibold text-muted-foreground flex items-center justify-between w-full">
                    Ghi chú chung
                    {isOwner && !isEditingNote && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsEditingNote(true)}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                    )}
                </Label>
                {isEditingNote ? (
                    <Textarea
                        id="general-note"
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        className="text-sm"
                        rows={4}
                        autoFocus
                    />
                ) : (
                    <div className="text-sm text-muted-foreground p-3 border rounded-md min-h-[80px] bg-muted/50 whitespace-pre-wrap">
                        {noteContent || 'Không có ghi chú chung.'}
                    </div>
                )}
                 {isEditingNote && (
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setIsEditingNote(false)}>Hủy</Button>
                        <Button size="sm" onClick={handleSaveNote}>
                            <Save className="mr-2 h-4 w-4" /> Lưu
                        </Button>
                    </div>
                )}
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
