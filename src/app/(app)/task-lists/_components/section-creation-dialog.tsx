'use client';

import { useState } from 'react';
import { Plus, FileText, Star, CheckSquare, Check, X, Info, Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/combobox';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TasksByShift, ShiftTemplate } from '@/lib/types';

interface SectionCreationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    shiftKey: string | null;
    shiftName: string;
    tasksByShift: TasksByShift;
    shiftTemplates: ShiftTemplate[];
    onConfirm: (title: string, copyFrom: { shiftKey: string; sectionTitle: string }[], templateId?: string) => void | Promise<void>;
}

export function SectionCreationDialog({
    open,
    onOpenChange,
    shiftKey,
    shiftName,
    tasksByShift,
    shiftTemplates,
    onConfirm
}: SectionCreationDialogProps) {
    const [title, setTitle] = useState("");
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined);
    const [copyFrom, setCopyFrom] = useState<{ shiftKey: string; sectionTitle: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Filter templates to show only those belonging to this shift (e.g. "sang", "trua", "toi")
    const relevantTemplates = shiftTemplates.filter(t => {
        if (!shiftKey) return false;
        const startHour = parseInt(t.timeSlot.start.split(':')[0]);
        if (shiftKey === 'sang') return startHour < 12;
        if (shiftKey === 'trua') return startHour >= 12 && startHour < 17;
        if (shiftKey === 'toi') return startHour >= 17;
        return false;
    });

    const handleConfirm = async () => {
        if (!title.trim()) return;
        setIsLoading(true);
        try {
            await onConfirm(title.trim(), copyFrom, selectedTemplateId);
            setTitle("");
            setSelectedTemplateId(undefined);
            setCopyFrom([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        onOpenChange(false);
        setTitle("");
        setSelectedTemplateId(undefined);
        setCopyFrom([]);
    };

    const toggleCopyFrom = (item: { shiftKey: string; sectionTitle: string }) => {
        setCopyFrom(prev => {
            const exists = prev.find(p => p.shiftKey === item.shiftKey && p.sectionTitle === item.sectionTitle);
            if (exists) {
                return prev.filter(p => !(p.shiftKey === item.shiftKey && p.sectionTitle === item.sectionTitle));
            }
            return [...prev, item];
        });
    };

    const totalTasksToCopy = copyFrom.reduce((acc, item) => {
        const section = tasksByShift[item.shiftKey]?.sections.find(s => s.title === item.sectionTitle);
        return acc + (section?.tasks.length || 0);
    }, 0);

    const quickNames = ['Vệ sinh', 'Thu dọn', 'Bàn giao', 'Pha chế', 'Phục vụ', 'Khu vực bếp'];

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => !v ? handleClose() : onOpenChange(v)}
            dialogTag="add-task-section"
            parentDialogTag="root"
        >
            <DialogContent className="max-w-[550px] p-0 overflow-hidden sm:rounded-[28px] border-none shadow-2xl h-[100dvh] sm:h-auto flex flex-col">
                {/* Responsive Header */}
                <DialogHeader variant='premium' icon={<Plus className="h-6 w-6 text-primary" />}>
                    <DialogTitle className="text-xl sm:text-2xl font-headline font-black tracking-tight flex items-center gap-2">
                        Mục mới <span className="text-primary">{shiftName}</span>
                    </DialogTitle>
                    <DialogDescription className="text-xs sm:text-sm font-medium text-muted-foreground/80">
                        Thêm chuyên mục công việc để tổ chức quy trình.
                    </DialogDescription>
                </DialogHeader>

                {/* Form Content */}
                <ScrollArea className="flex-1 px-4 sm:px-8 py-5 sm:py-7">
                    <div className="space-y-8">
                        {/* Section Name UI */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label className="text-[13px] font-black uppercase tracking-widest text-foreground/60 flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-primary" />
                                    Tên chuyên mục
                                </Label>
                                {title && (
                                    <button onClick={() => setTitle("")} className="text-[10px] font-bold text-destructive flex items-center gap-1 hover:underline">
                                        <X className="h-3 w-3" /> Xóa
                                    </button>
                                )}
                            </div>

                            <div className="space-y-3">
                                <Combobox
                                    options={relevantTemplates.map(t => ({ value: t.id, label: t.label }))}
                                    value={selectedTemplateId || title}
                                    onChange={(val) => {
                                        const template = relevantTemplates.find(t => t.id === val);
                                        if (template) {
                                            setTitle(template.label);
                                            setSelectedTemplateId(template.id);
                                        } else {
                                            setTitle(val);
                                            setSelectedTemplateId(undefined);
                                        }
                                    }}
                                    placeholder="Tìm tên mẫu hoặc tự nhập mới..."
                                    className="w-full h-12 sm:h-14 rounded-2xl shadow-sm border-muted-foreground/20 focus-within:ring-2 ring-primary/20 transition-all text-base font-semibold"
                                />

                                {selectedTemplateId && (
                                    <div className="flex items-center gap-2 mt-2 p-2 bg-primary/10 border border-primary/20 rounded-xl px-4 animate-in fade-in slide-in-from-left-2">
                                        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                        <p className="text-[11px] font-black text-primary uppercase tracking-wider">Gắn chặt vào mẫu ca: {title}</p>
                                    </div>
                                )}

                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {quickNames.map(t => (
                                        <button
                                            key={t}
                                            onClick={() => {
                                                setTitle(t);
                                                setSelectedTemplateId(undefined);
                                            }}
                                            className={cn(
                                                "text-[11px] px-3 py-1 rounded-full transition-all font-bold border",
                                                title === t
                                                    ? "bg-primary text-white border-primary shadow-md"
                                                    : "bg-secondary/40 hover:bg-secondary text-muted-foreground border-transparent"
                                            )}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Copy Logic UI */}
                        <div className="space-y-4 p-5 sm:p-6 bg-secondary/20 rounded-[24px] border border-dashed border-primary/20 group/copy">
                            <div className="flex items-center justify-between mb-2">
                                <Label className="text-[13px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                    <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                                    Sao chép từ mục khác?
                                </Label>
                                {copyFrom.length > 0 && (
                                    <Badge variant="outline" className="bg-background text-primary animate-pulse border-primary/20 text-[10px] font-black">
                                        ĐÃ CHỌN {copyFrom.length}
                                    </Badge>
                                )}
                            </div>

                            <div className="space-y-5">
                                {Object.entries(tasksByShift).map(([sKey, sData]) => (
                                    <div key={sKey} className="space-y-2.5">
                                        <p className="text-[10px] font-extrabold uppercase tracking-tighter text-muted-foreground/50 ml-1 flex items-center gap-1.5">
                                            <span className="w-1 h-3 bg-primary/30 rounded-full" />
                                            {sData.name}
                                        </p>
                                        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 gap-2">
                                            {sData.sections.length > 0 ? (
                                                sData.sections.map(s => {
                                                    const isSelected = copyFrom.some(p => p.shiftKey === sKey && p.sectionTitle === s.title);
                                                    return (
                                                        <button
                                                            key={`${sKey}-${s.title}`}
                                                            onClick={() => toggleCopyFrom({ shiftKey: sKey, sectionTitle: s.title })}
                                                            className={cn(
                                                                "relative px-3 py-2 text-[11px] font-bold rounded-xl border transition-all duration-300 text-left flex flex-col items-start gap-0.5",
                                                                isSelected
                                                                    ? "bg-primary text-white border-primary shadow-[0_8px_16px_rgba(var(--primary-rgb),0.3)] scale-[1.05] z-10"
                                                                    : "bg-background/60 border-muted-foreground/10 hover:border-primary/40 hover:bg-background/100 hover:shadow-sm"
                                                            )}
                                                        >
                                                            <span className="truncate w-full">{s.title}</span>
                                                            <span className={cn(
                                                                "text-[9px] opacity-70",
                                                                isSelected ? "text-white" : "text-primary"
                                                            )}>
                                                                {s.tasks.length} nhiệm vụ
                                                            </span>
                                                            {isSelected && (
                                                                <Check className="absolute top-1 right-1 h-3 w-3" />
                                                            )}
                                                        </button>
                                                    );
                                                })
                                            ) : (
                                                <span className="col-span-full text-[10px] italic text-muted-foreground/30 px-1 py-1">Ca này chưa có dữ liệu</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {copyFrom.length > 0 && (
                                <div className="pt-4 mt-2 border-t border-primary/10 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
                                    <div className="h-8 w-8 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                                        <Info className="h-4 w-4 text-primary" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-[11px] text-primary font-black leading-tight">
                                            Sẵn sàng nhân bản {totalTasksToCopy} công việc từ {copyFrom.length} chuyên mục
                                        </p>
                                        <p className="text-[10px] text-muted-foreground font-medium">
                                            Hành động này sẽ gộp tất cả công việc đã chọn vào mục mới.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollArea>

                {/* Footer Buttons */}
                <div className="px-5 sm:px-8 py-4 sm:py-6 bg-background border-t mt-auto shrink-0 flex items-center justify-between gap-4">
                    <Button
                        variant="ghost"
                        onClick={handleClose}
                        disabled={isLoading}
                        className="h-11 sm:h-12 px-6 rounded-2xl text-xs font-bold text-muted-foreground hover:bg-secondary/80 transition-all sm:flex-1 max-w-[120px]"
                    >
                        Hủy
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!title.trim() || isLoading}
                        className="bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 h-11 sm:h-12 px-8 rounded-2xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex-1 sm:max-w-none"
                    >
                        {isLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : copyFrom.length > 0 ? (
                            <CheckSquare className="mr-2 h-4 w-4" />
                        ) : (
                            <Plus className="mr-2 h-4 w-4" />
                        )}
                        {isLoading 
                            ? 'Đang xử lý...' 
                            : copyFrom.length > 0 
                                ? `Tạo & Copy (${totalTasksToCopy})` 
                                : 'Tạo chuyên mục'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
