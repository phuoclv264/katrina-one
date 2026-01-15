'use client';

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ManagedUser, SpecialPeriod } from '@/lib/types';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from '@/components/ui/pro-toast';
import { Loader2, Plus, Trash2, Calendar as CalendarIcon, Clock, Sparkles, CalendarDays, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn, normalizeSearchString } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useIsMobile } from '@/hooks/use-mobile';
import { Checkbox } from '@/components/ui/checkbox';

type SpecialPeriodsDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    specialPeriods: SpecialPeriod[];
    users: ManagedUser[];
    onCreateSpecialPeriod: (payload: Omit<SpecialPeriod, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    onDeleteSpecialPeriod: (id: string) => Promise<void>;
};

export default function SpecialPeriodsDialog({
    isOpen,
    onClose,
    specialPeriods,
    users,
    onCreateSpecialPeriod,
    onDeleteSpecialPeriod,
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
        const normalizedSearch = normalizeSearchString(userSearch);
        return users.filter(u =>
            normalizeSearchString(u.displayName || '').includes(normalizedSearch) ||
            normalizeSearchString(u.email || '').includes(normalizedSearch)
        );
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
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-center">
                    <CalendarDays className="h-12 w-12 mb-2 opacity-20" />
                    <p>Chưa có giai đoạn đặc biệt nào</p>
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
                            ? `Chỉ định ${period.targetUserIds.length} user`
                            : 'Tất cả user';

                        return (
                            <Card key={period.id} className="overflow-hidden">
                                <CardContent className="p-3">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="font-medium">{period.name}</div>
                                        <Badge variant="secondary" className={cn(
                                            period.multiplier >= 3 ? "bg-red-100 text-red-800" :
                                                period.multiplier >= 2 ? "bg-orange-100 text-orange-800" : ""
                                        )}>
                                            x{period.multiplier}
                                        </Badge>
                                    </div>
                                    <div className="text-sm text-muted-foreground space-y-1">
                                        <div className="flex items-center gap-2">
                                            <CalendarIcon className="h-3 w-3" />
                                            <span>{format(start, 'dd/MM/yyyy HH:mm')}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-3 w-3" />
                                            <span>{format(end, 'dd/MM/yyyy HH:mm')}</span>
                                        </div>
                                        <div className="text-xs">{targetLabel}</div>
                                    </div>
                                    <Separator className="my-2" />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 h-8"
                                        onClick={() => handleDelete(period.id)}
                                    >
                                        <Trash2 className="h-3 w-3 mr-2" /> Xóa
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            );
        }

        return (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Tên dịp</TableHead>
                        <TableHead>Bắt đầu</TableHead>
                        <TableHead>Kết thúc</TableHead>
                        <TableHead>Áp dụng</TableHead>
                        <TableHead className="text-center">Hệ số</TableHead>
                        <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedPeriods.map((period) => {
                        const start = (period.startDate as any).toDate?.() || new Date(period.startDate as any);
                        const end = (period.endDate as any).toDate?.() || new Date(period.endDate as any);
                        const targetLabel = Array.isArray(period.targetUserIds) && period.targetUserIds.length > 0
                            ? `Chỉ định ${period.targetUserIds.length} user`
                            : 'Tất cả user';

                        return (
                            <TableRow key={period.id}>
                                <TableCell className="font-medium">{period.name}</TableCell>
                                <TableCell>{format(start, 'dd/MM/yyyy HH:mm')}</TableCell>
                                <TableCell>{format(end, 'dd/MM/yyyy HH:mm')}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{targetLabel}</TableCell>
                                <TableCell className="text-center">
                                    <Badge variant="secondary" className={cn(
                                        period.multiplier >= 3 ? "bg-red-100 text-red-800" :
                                            period.multiplier >= 2 ? "bg-orange-100 text-orange-800" : ""
                                    )}>
                                        x{period.multiplier}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
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
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose} dialogTag="special-periods-dialog" parentDialogTag="root">
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b bg-muted/10">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-full">
                            <Sparkles className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <DialogTitle>Giai đoạn lương đặc biệt</DialogTitle>
                            <DialogDescription>
                                Quản lý các dịp Lễ, Tết nhân hệ số lương
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1 overflow-y-auto p-6">
                    <div className="flex flex-col gap-6">
                        {/* Form Section */}
                        <Card className="border-dashed shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <Plus className="h-4 w-4" /> Thêm giai đoạn mới
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Tên dịp</Label>
                                        <Input
                                            placeholder="VD: Tết Nguyên Đán"
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Hệ số lương (x)</Label>
                                        <Input
                                            type="number"
                                            step="0.5"
                                            value={newMultiplier}
                                            onChange={(e) => setNewMultiplier(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Áp dụng cho</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button
                                            type="button"
                                            variant={targetMode === 'all' ? 'default' : 'outline'}
                                            onClick={() => setTargetMode('all')}
                                        >
                                            Tất cả
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={targetMode === 'specific' ? 'default' : 'outline'}
                                            onClick={() => setTargetMode('specific')}
                                        >
                                            Chỉ định User ID
                                        </Button>
                                    </div>

                                    {targetMode === 'specific' && (
                                        <div className="space-y-2 border rounded-md p-3 bg-muted/20">
                                            <div className="relative">
                                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    placeholder="Tìm kiếm nhân viên..."
                                                    value={userSearch}
                                                    onChange={(e) => setUserSearch(e.target.value)}
                                                    className="pl-8 h-9"
                                                />
                                            </div>
                                            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                                                {filteredUsers.length === 0 ? (
                                                    <div className="text-sm text-muted-foreground text-center py-4">
                                                        Không tìm thấy nhân viên
                                                    </div>
                                                ) : (
                                                    filteredUsers.map((user) => (
                                                        <div key={user.uid} className="flex items-center space-x-2">
                                                            <Checkbox
                                                                id={`user-${user.uid}`}
                                                                checked={selectedUserIds.includes(user.uid)}
                                                                onCheckedChange={() => toggleUser(user.uid)}
                                                            />
                                                            <Label
                                                                htmlFor={`user-${user.uid}`}
                                                                className="text-sm font-normal cursor-pointer flex-1"
                                                            >
                                                                {user.displayName || user.email || 'Unnamed User'}
                                                            </Label>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                            <div className="text-xs text-muted-foreground text-right pt-2 border-t mt-2">
                                                Đã chọn: {selectedUserIds.length} nhân viên
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Bắt đầu</Label>
                                        <div className="flex gap-2">
                                            <Popover modal={true}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-full justify-start text-left font-normal px-2",
                                                            !startDate && "text-muted-foreground"
                                                        )}
                                                    >
                                                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                                                        {startDate ? format(startDate, "dd/MM") : <span>Ngày</span>}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0">
                                                    <Calendar
                                                        mode="single"
                                                        selected={startDate}
                                                        onSelect={setStartDate}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <div className="relative w-24 shrink-0">
                                                <Clock className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    type="time"
                                                    className="pl-8"
                                                    value={startTime}
                                                    onChange={(e) => setStartTime(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Kết thúc</Label>
                                        <div className="flex gap-2">
                                            <Popover modal={true}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-full justify-start text-left font-normal px-2",
                                                            !endDate && "text-muted-foreground"
                                                        )}
                                                    >
                                                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                                                        {endDate ? format(endDate, "dd/MM") : <span>Ngày</span>}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0">
                                                    <Calendar
                                                        mode="single"
                                                        selected={endDate}
                                                        onSelect={setEndDate}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <div className="relative w-24 shrink-0">
                                                <Clock className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    type="time"
                                                    className="pl-8"
                                                    value={endTime}
                                                    onChange={(e) => setEndTime(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <Button onClick={handleAdd} disabled={isAdding} className="w-full">
                                    {isAdding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                                    Thêm giai đoạn
                                </Button>
                            </CardContent>
                        </Card>

                        <Separator />

                        {/* List Section */}
                        <div className="space-y-3">
                            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                                Danh sách ({sortedPeriods.length})
                            </h3>
                            {renderPeriodList()}
                        </div>
                    </div>
                </ScrollArea>

                <DialogFooter className="p-4 border-t bg-muted/10">
                    <Button variant="outline" onClick={onClose} className="w-full md:w-auto">Đóng</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
