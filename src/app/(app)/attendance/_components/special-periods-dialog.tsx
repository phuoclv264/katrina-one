'use client';

import React, { useState, useMemo } from 'react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { ManagedUser, SpecialPeriod } from '@/lib/types';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from '@/components/ui/pro-toast';
import { Loader2, Plus, Trash2, Calendar as CalendarIcon, Clock, Sparkles, CalendarDays, Search, User } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn, advancedSearch } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';
import { Checkbox } from '@/components/ui/checkbox';

type SpecialPeriodsDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    specialPeriods: SpecialPeriod[];
    users: ManagedUser[];
    onCreateSpecialPeriod: (payload: Omit<SpecialPeriod, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    onDeleteSpecialPeriod: (id: string) => Promise<void>;
    parentDialogTag: string;
};

export default function SpecialPeriodsDialog({
    isOpen,
    onClose,
    specialPeriods,
    users,
    onCreateSpecialPeriod,
    onDeleteSpecialPeriod,
    parentDialogTag,
}: SpecialPeriodsDialogProps) {
    const isMobile = useIsMobile();
    const [isAdding, setIsAdding] = useState(false);

    // Form state
    const [newName, setNewName] = useState('');
    const [newMultiplier, setNewMultiplier] = useState('2');
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [startTime, setStartTime] = useState('00:00');
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);
    const [endTime, setEndTime] = useState('23:59');

    // Target users
    const [targetMode, setTargetMode] = useState<'all' | 'specific'>('all');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [userSearch, setUserSearch] = useState('');

    const filteredUsers = useMemo(() => {
        if (!userSearch) return users;
        return advancedSearch(users, userSearch, ['displayName', 'email', 'role']);
    }, [users, userSearch]);

    const toggleUser = (uid: string) => {
        setSelectedUserIds(prev =>
            prev.includes(uid)
                ? prev.filter(id => id !== uid)
                : [...prev, uid]
        );
    };

    const sortedPeriods = useMemo(() => {
        return [...specialPeriods].sort((a, b) => {
            const dateA = (a.startDate as any).toDate?.() || new Date(a.startDate as any);
            const dateB = (b.startDate as any).toDate?.() || new Date(b.startDate as any);
            return dateB.getTime() - dateA.getTime();
        });
    }, [specialPeriods]);

    const handleAdd = async () => {
        if (!newName || !startDate || !endDate || !newMultiplier || !startTime || !endTime) {
            toast.error('Vui lòng nhập đầy đủ thông tin');
            return;
        }

        const multiplier = parseFloat(newMultiplier);
        if (isNaN(multiplier) || multiplier <= 0) {
            toast.error('Hệ số lương không hợp lệ');
            return;
        }

        // Combine date and time
        const startDateTime = new Date(startDate);
        const [startHours, startMinutes] = startTime.split(':').map(Number);
        startDateTime.setHours(startHours, startMinutes);

        const endDateTime = new Date(endDate);
        const [endHours, endMinutes] = endTime.split(':').map(Number);
        endDateTime.setHours(endHours, endMinutes);

        if (endDateTime <= startDateTime) {
            toast.error('Thời gian kết thúc phải sau thời gian bắt đầu');
            return;
        }

        if (targetMode === 'specific' && selectedUserIds.length === 0) {
            toast.error('Vui lòng chọn ít nhất 1 nhân viên hoặc chọn "Tất cả"');
            return;
        }

        setIsAdding(true);
        try {
            await onCreateSpecialPeriod({
                name: newName,
                startDate: Timestamp.fromDate(startDateTime),
                endDate: Timestamp.fromDate(endDateTime),
                multiplier: multiplier,
                ...(targetMode === 'specific' ? { targetUserIds: selectedUserIds } : {}),
            });

            toast.success('Đã thêm giai đoạn tính lương đặc biệt');
            setNewName('');
            setNewMultiplier('2');
            setStartDate(undefined);
            setStartTime('00:00');
            setEndDate(undefined);
            setEndTime('23:59');
            setTargetMode('all');
            setSelectedUserIds([]);
            setUserSearch('');
        } catch (error) {
            console.error(error);
            toast.error('Lỗi khi thêm giai đoạn');
        } finally {
            setIsAdding(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa giai đoạn này?')) return;

        try {
            await onDeleteSpecialPeriod(id);
            toast.success('Đã xóa giai đoạn');
        } catch (error) {
            console.error(error);
            toast.error('Lỗi khi xóa giai đoạn');
        }
    };

    const renderPeriodList = () => {
        if (sortedPeriods.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-center bg-white rounded-2xl border border-dashed border-zinc-200">
                    <CalendarDays className="h-10 w-10 mb-3 opacity-10 text-zinc-900" />
                    <p className="text-sm font-medium text-zinc-400">Chưa có giai đoạn đặc biệt nào</p>
                </div>
            );
        }

        if (isMobile) {
            return (
                <div className="space-y-3">
                    {sortedPeriods.map((period) => {
                        const start = (period.startDate as any).toDate?.() || new Date(period.startDate as any);
                        const end = (period.endDate as any).toDate?.() || new Date(period.endDate as any);
                        const targetLabel = Array.isArray(period.targetUserIds) && period.targetUserIds.length > 0
                            ? `Chỉ định ${period.targetUserIds.length} nhân viên`
                            : 'Tất cả nhân viên';

                        return (
                            <Card key={period.id} className="overflow-hidden border-none shadow-sm ring-1 ring-zinc-200 rounded-2xl">
                                <CardContent className="p-4 bg-white">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="font-bold text-zinc-900 tracking-tight">{period.name}</div>
                                        <Badge variant="secondary" className={cn(
                                            "rounded-lg px-2 py-0.5 font-black text-[11px]",
                                            period.multiplier >= 3 ? "bg-red-50 text-red-600 border border-red-100" :
                                                period.multiplier >= 2 ? "bg-orange-50 text-orange-600 border border-orange-100" : 
                                                "bg-zinc-50 text-zinc-600 border border-zinc-100"
                                        )}>
                                            x{period.multiplier}
                                        </Badge>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2.5 text-zinc-500">
                                            <div className="w-5 h-5 rounded-full bg-zinc-50 flex items-center justify-center shrink-0">
                                                <CalendarIcon className="h-3 w-3" />
                                            </div>
                                            <span className="text-[11px] font-semibold">{format(start, 'dd/MM/yyyy HH:mm')}</span>
                                            <span className="text-zinc-300">→</span>
                                            <span className="text-[11px] font-semibold">{format(end, 'dd/MM/yyyy HH:mm')}</span>
                                        </div>
                                        <div className="flex items-center gap-2.5 text-zinc-400">
                                            <div className="w-5 h-5 rounded-full bg-zinc-50 flex items-center justify-center shrink-0">
                                                <User className="h-3 w-3" />
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider">{targetLabel}</span>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-zinc-50 flex justify-end">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 rounded-lg px-3 font-bold text-[11px] uppercase tracking-wider"
                                            onClick={() => handleDelete(period.id)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Xóa giai đoạn
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            );
        }

        return (
            <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-zinc-50/50">
                        <TableRow className="hover:bg-transparent border-zinc-200">
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 h-11">Tên dịp</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 h-11">Bắt đầu</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 h-11">Kết thúc</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 h-11">Áp dụng</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 h-11 text-center">Hệ số</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 h-11 text-right pr-6">Thao tác</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedPeriods.map((period) => {
                            const start = (period.startDate as any).toDate?.() || new Date(period.startDate as any);
                            const end = (period.endDate as any).toDate?.() || new Date(period.endDate as any);
                            const targetLabel = Array.isArray(period.targetUserIds) && period.targetUserIds.length > 0
                                ? `${period.targetUserIds.length} user`
                                : 'Tất cả';

                            return (
                                <TableRow key={period.id} className="hover:bg-zinc-50/50 border-zinc-100 transition-colors">
                                    <TableCell className="font-bold text-zinc-900 text-sm py-4">{period.name}</TableCell>
                                    <TableCell className="text-zinc-600 font-medium text-xs">
                                        {format(start, 'dd/MM/yyyy')}
                                        <div className="text-[10px] text-zinc-400 font-bold uppercase">{format(start, 'HH:mm')}</div>
                                    </TableCell>
                                    <TableCell className="text-zinc-600 font-medium text-xs">
                                        {format(end, 'dd/MM/yyyy')}
                                        <div className="text-[10px] text-zinc-400 font-bold uppercase">{format(end, 'HH:mm')}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="rounded-md border-zinc-200 bg-zinc-50/50 text-[10px] font-bold text-zinc-500 px-2 py-0 border-none uppercase tracking-tight">
                                            {targetLabel}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="secondary" className={cn(
                                            "rounded-lg px-2 py-0.5 font-black text-[11px]",
                                            period.multiplier >= 3 ? "bg-red-50 text-red-600 border border-red-100" :
                                                period.multiplier >= 2 ? "bg-orange-50 text-orange-600 border border-orange-100" : 
                                                "bg-zinc-50 text-zinc-600 border border-zinc-100"
                                        )}>
                                            x{period.multiplier}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right pr-6">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-all rounded-lg"
                                            onClick={() => handleDelete(period.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose} dialogTag="special-periods-dialog" parentDialogTag={parentDialogTag}>
            <DialogContent className="max-w-2xl">
                <DialogHeader variant="premium" iconkey="calendar">
                    <DialogTitle>Giai đoạn lương đặc biệt</DialogTitle>
                    <DialogDescription>
                        Quản lý các dịp Lễ, Tết hoặc sự kiện cần nhân hệ số lương
                    </DialogDescription>
                </DialogHeader>

                <DialogBody className="bg-zinc-50/50">
                    <div className="flex flex-col gap-6 py-2">
                        {/* Form Section */}
                        <Card className="border-none shadow-sm ring-1 ring-zinc-200 overflow-hidden">
                            <CardHeader className="bg-zinc-100/50 py-3 px-4 border-b border-zinc-200">
                                <CardTitle className="text-[11px] font-black uppercase tracking-[0.1em] flex items-center gap-2 text-zinc-500">
                                    <Plus className="h-3 w-3" /> Thêm giai đoạn mới
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 space-y-4 bg-white">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 ml-1">Tên dịp</Label>
                                        <Input
                                            placeholder="VD: Tết Nguyên Đán"
                                            className="h-10 rounded-xl border-zinc-200 focus-visible:ring-primary"
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 ml-1">Hệ số lương (x)</Label>
                                        <Input
                                            type="number"
                                            step="0.5"
                                            className="h-10 rounded-xl border-zinc-200 focus-visible:ring-primary"
                                            value={newMultiplier}
                                            onChange={(e) => setNewMultiplier(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 ml-1">Áp dụng cho</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setTargetMode('all')}
                                            className={cn(
                                                "h-10 rounded-xl text-sm font-bold transition-all border-2",
                                                targetMode === 'all' 
                                                    ? "bg-zinc-900 border-zinc-900 text-white shadow-sm"
                                                    : "bg-background border-zinc-100 hover:border-zinc-200 text-zinc-500"
                                            )}
                                        >
                                            Tất cả
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTargetMode('specific')}
                                            className={cn(
                                                "h-10 rounded-xl text-sm font-bold transition-all border-2",
                                                targetMode === 'specific'
                                                    ? "bg-zinc-900 border-zinc-900 text-white shadow-sm"
                                                    : "bg-background border-zinc-100 hover:border-zinc-200 text-zinc-500"
                                            )}
                                        >
                                            Chỉ định User
                                        </button>
                                    </div>

                                    {targetMode === 'specific' && (
                                        <div className="space-y-2 border border-zinc-100 rounded-xl p-3 bg-zinc-50/50 mt-2">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                                                <Input
                                                    placeholder="Tìm kiếm nhân viên..."
                                                    value={userSearch}
                                                    onChange={(e) => setUserSearch(e.target.value)}
                                                    className="pl-9 h-9 border-zinc-200 rounded-lg text-sm bg-white"
                                                />
                                            </div>
                                            <div className="space-y-1 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                                                {filteredUsers.length === 0 ? (
                                                    <div className="text-xs text-muted-foreground text-center py-4 italic">
                                                        Không tìm thấy nhân viên
                                                    </div>
                                                ) : (
                                                    filteredUsers.map((user) => (
                                                        <div key={user.uid} className="flex items-center space-x-2 p-1.5 hover:bg-white rounded-lg transition-colors">
                                                            <Checkbox
                                                                id={`user-${user.uid}`}
                                                                checked={selectedUserIds.includes(user.uid)}
                                                                onCheckedChange={() => toggleUser(user.uid)}
                                                                className="rounded-md border-zinc-300"
                                                            />
                                                            <Label
                                                                htmlFor={`user-${user.uid}`}
                                                                className="text-xs font-semibold text-zinc-700 cursor-pointer flex-1"
                                                            >
                                                                {user.displayName || user.email || 'Unnamed User'}
                                                            </Label>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                            <div className="text-[10px] font-bold text-zinc-400 text-right pt-2 border-t border-zinc-100">
                                                ĐÃ CHỌN: <span className="text-primary">{selectedUserIds.length}</span> NHÂN VIÊN
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 ml-1">Bắt đầu</Label>
                                        <div className="flex gap-2">
                                            <Popover modal={true}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-full justify-start text-left font-semibold px-3 h-10 rounded-xl border-zinc-200",
                                                            !startDate && "text-muted-foreground"
                                                        )}
                                                    >
                                                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                        {startDate ? format(startDate, "dd/MM/yyyy") : <span>Chọn ngày</span>}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden shadow-xl border-zinc-200" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        selected={startDate}
                                                        onSelect={setStartDate}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <div className="relative w-28 shrink-0">
                                                <Clock className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                                                <Input
                                                    type="time"
                                                    className="pl-9 h-10 rounded-xl border-zinc-200 font-semibold"
                                                    value={startTime}
                                                    onChange={(e) => setStartTime(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 ml-1">Kết thúc</Label>
                                        <div className="flex gap-2">
                                            <Popover modal={true}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-full justify-start text-left font-semibold px-3 h-10 rounded-xl border-zinc-200",
                                                            !endDate && "text-muted-foreground"
                                                        )}
                                                    >
                                                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                        {endDate ? format(endDate, "dd/MM/yyyy") : <span>Chọn ngày</span>}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden shadow-xl border-zinc-200" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        selected={endDate}
                                                        onSelect={setEndDate}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <div className="relative w-28 shrink-0">
                                                <Clock className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                                                <Input
                                                    type="time"
                                                    className="pl-9 h-10 rounded-xl border-zinc-200 font-semibold"
                                                    value={endTime}
                                                    onChange={(e) => setEndTime(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <DialogAction 
                                    onClick={handleAdd} 
                                    isLoading={isAdding} 
                                    className="w-full h-12 bg-zinc-900 text-white hover:bg-zinc-800 rounded-xl mt-2"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Lưu giai đoạn
                                </DialogAction>
                            </CardContent>
                        </Card>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-1">
                                <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-zinc-400 flex items-center gap-2">
                                    <Sparkles className="h-3.5 w-3.5 text-orange-400" /> 
                                    Danh sách ({sortedPeriods.length})
                                </h3>
                            </div>
                            {renderPeriodList()}
                        </div>
                    </div>
                </DialogBody>

                <DialogFooter className="bg-white border-t border-zinc-100 p-4">
                    <DialogCancel onClick={onClose} className="w-full sm:w-32">Đóng</DialogCancel>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
