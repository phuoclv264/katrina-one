'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogBody, DialogAction, DialogCancel } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Combobox } from '@/components/combobox';
import type { Event, EventCandidate, EventType, UserRole, ManagedUser } from '@/lib/types';
import { Loader2, Plus, Trash2, Calendar, Users, Settings, Info, CheckCircle2, ListFilter, UserCheck, MessageSquare, EyeOff, Clock, Trophy, Star, Sparkles, LayoutGrid, Briefcase, User } from 'lucide-react';
import { toast } from '@/components/ui/pro-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Timestamp } from 'firebase/firestore';
import { timestampToString, toDateSafe, toDatetimeLocalInput } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface EditEventDialogProps {
    isOpen: boolean;
    onClose: () => void;
    eventToEdit: Event | null;
    onSave: (event: Omit<Event, 'id'>, id?: string) => Promise<void>;
    allUsers: ManagedUser[];
    parentDialogTag: string;
}

const ROLES_OPTIONS: { value: UserRole; label: string }[] = [
    { value: 'Phục vụ', label: 'Phục vụ' },
    { value: 'Pha chế', label: 'Pha chế' },
    { value: 'Thu ngân', label: 'Thu ngân' },
    { value: 'Quản lý', label: 'Quản lý' },
];

export default function EditEventDialog({ isOpen, onClose, eventToEdit, onSave, allUsers, parentDialogTag }: EditEventDialogProps) {
    const [eventData, setEventData] = useState<Partial<Event>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [newOption, setNewOption] = useState('');
    const [targetMode, setTargetMode] = useState<'roles' | 'users'>('roles');
    const isEditing = !!eventToEdit;
    const currentType = (eventData.type || 'vote') as EventType;
    const isVote = currentType === 'vote';
    const isMultiVote = currentType === 'multi-vote';
    const isReview = currentType === 'review';
    const isBallot = currentType === 'ballot';

    useEffect(() => {
        if (isOpen) {
            const initialData = eventToEdit ? {
                ...eventToEdit,
                // show stored timestamps in the user's local timezone for editing
                startAt: toDatetimeLocalInput(eventToEdit.startAt),
                endAt: toDatetimeLocalInput(eventToEdit.endAt),
                // Keep ballotDrawTime as Timestamp (if present) to avoid re-saving string values
                ballotConfig: eventToEdit.ballotConfig ? {
                    ...eventToEdit.ballotConfig,
                    ballotDrawTime: eventToEdit.ballotConfig.ballotDrawTime ?? undefined,
                } : undefined,
                isTest: eventToEdit.isTest ?? false,
            } : {
                title: '',
                description: '',
                type: 'vote' as EventType,
                status: 'draft' as Event['status'],
                eligibleRoles: [],
                targetUserIds: [],
                candidates: [],
                options: [],
                // default times shown in user's local timezone
                startAt: toDatetimeLocalInput(new Date()),
                endAt: toDatetimeLocalInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
                anonymousResults: false,
                allowComments: true,
                maxVotesPerUser: 1,
                isTest: false,
                // Default ballot config for new ballot events
                ballotConfig: {
                    winnerCount: 1,
                    resultMessage: 'Chúc mừng bạn đã trúng thưởng! 🎉',
                    loserMessage: 'Cảm ơn bạn đã tham gia! Lần sau may mắn hơn nhé! 💪',
                    autoDraw: true,
                },
            };
            setEventData(initialData as any);
            
            // Determine initial target mode based on data
            const hasTargetUsers = eventToEdit ? (eventToEdit.targetUserIds || []).length > 0 : false;
            setTargetMode(hasTargetUsers ? 'users' : 'roles');
        }
    }, [isOpen, eventToEdit]);

    const handleFieldChange = (field: keyof Event, value: any) => {
        setEventData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        if (!eventData.title || !eventData.type) {
            toast.error("Vui lòng nhập đầy đủ tiêu đề và loại sự kiện.");
            return;
        }

        const startDate = toDateSafe(eventData.startAt);
        const endDate = toDateSafe(eventData.endAt);
        if (!startDate || !endDate) {
            toast.error('Vui lòng thiết lập thời gian bắt đầu và kết thúc hợp lệ.');
            return;
        }
        if (endDate <= startDate) {
            toast.error('Thời gian kết thúc phải sau thời gian bắt đầu.');
            return;
        }

        const candidateCount = (eventData.candidates || []).length;
        const optionCount = (eventData.options || []).length;
        const totalChoices = candidateCount + optionCount;

        if (currentType === 'review' && candidateCount === 0) {
            toast.error('Loại Đánh giá cần ít nhất một nhân viên/ứng viên.');
            return;
        }

        if (currentType === 'ballot') {
            if (!eventData.prize?.name) {
                toast.error('Vui lòng nhập tên giải thưởng cho phần rút thăm.');
                return;
            }
        } else if ((currentType === 'vote' || currentType === 'multi-vote') && totalChoices === 0) {
            toast.error('Vui lòng thêm ít nhất một ứng viên hoặc lựa chọn cho sự kiện.');
            return;
        }

        if (currentType === 'multi-vote') {
            const max = eventData.maxVotesPerUser;
            if (!max || max < 1) {
                toast.error('Vui lòng chỉ định số lượt tối đa mỗi người cho loại "multi-vote".');
                return;
            }
            if (totalChoices > 0 && max > totalChoices) {
                toast.error('Số lượt tối đa không thể lớn hơn tổng số lựa chọn.');
                return;
            }
        }

        setIsSaving(true);
        try {
            // Explicitly construct only the fields that should be saved
            const finalData: Record<string, any> = {
                title: eventData.title,
                description: eventData.description || '',
                type: currentType,
                status: eventData.status || 'draft',
                startAt: Timestamp.fromDate(startDate),
                endAt: Timestamp.fromDate(endDate),
                eligibleRoles: eventData.eligibleRoles || [],
                targetUserIds: eventData.targetUserIds || [],
                candidates: eventData.candidates || [],
                allowComments: eventData.allowComments ?? true,
                anonymousResults: eventData.anonymousResults ?? false,
            };

            // Add type-specific fields
            if (currentType === 'multi-vote') {
                finalData.maxVotesPerUser = eventData.maxVotesPerUser || 1;
            } else {
                // ensure non-multi events have an explicit null value when persisted by events-store
                finalData.maxVotesPerUser = null;
            }

            if (currentType === 'ballot') {
                finalData.prize = eventData.prize;
                const ballotDrawDate = eventData.ballotConfig?.ballotDrawTime
                    ? toDateSafe(eventData.ballotConfig.ballotDrawTime)
                    : null;
                finalData.ballotConfig = {
                    ...eventData.ballotConfig,
                    ballotDrawTime: ballotDrawDate ? Timestamp.fromDate(ballotDrawDate) : undefined,
                };
            }

            // Add options only for types that use them
            if (currentType === 'vote' || currentType === 'multi-vote') {
                finalData.options = eventData.options || [];
            } else {
                // For review and ballot, don't include options
                finalData.options = [];
            }

            // Test-only flag
            finalData.isTest = Boolean(eventData.isTest);

            await onSave(finalData as Omit<Event, 'id'>, eventToEdit?.id);
            onClose();
        } catch (error) {
            console.error("Failed to save event:", error);
            toast.error("Lỗi khi lưu sự kiện.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddOption = () => {
        if (newOption.trim()) {
            const newCandidate: EventCandidate = { id: `option_${Date.now()}`, name: newOption.trim() };
            handleFieldChange('options', [...(eventData.options || []), newCandidate]);
            setNewOption('');
        }
    };

    const handleDeleteOption = (id: string) => {
        handleFieldChange('options', (eventData.options || []).filter(o => o.id !== id));
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose} dialogTag='edit-event-dialog' parentDialogTag={parentDialogTag}>
            <DialogContent className="max-w-4xl h-full sm:h-[90vh] p-0 flex flex-col bg-gray-50 dark:bg-gray-950 sm:rounded-[2rem] overflow-hidden border-none shadow-2xl">
                <DialogHeader iconkey="layout" variant="premium" className="max-sm:px-4 max-sm:py-3 shrink-0">
                    <DialogTitle className="max-sm:text-lg">{eventToEdit ? 'Chỉnh sửa Sự kiện' : 'Tạo Sự kiện mới'}</DialogTitle>
                    <DialogDescription className="max-sm:text-[10px]">
                        Thiết lập các thông số cho sự kiện bình chọn hoặc đánh giá.
                    </DialogDescription>
                </DialogHeader>

                <DialogBody className="flex-1 overflow-hidden p-0 flex flex-col bg-transparent">
                    <ScrollArea className="flex-1 h-full">
                        <div className="p-4 sm:p-10 space-y-12 pb-32 sm:pb-10">
                            {/* Section: Basic Info */}
                            <section className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-gray-500">Thông tin cơ bản</h3>
                                </div>
                                
                                <div className="grid gap-6 ml-0 sm:ml-11">
                                    <div className="space-y-2">
                                        <Label htmlFor="title" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Tiêu đề sự kiện</Label>
                                        <Input
                                            id="title"
                                            placeholder="Ví dụ: Bình chọn nhân viên xuất sắc tháng 12"
                                            value={eventData.title || ''}
                                            onChange={(e) => handleFieldChange('title', e.target.value)}
                                            className="h-12 sm:h-14 bg-white dark:bg-gray-900 rounded-2xl border-none shadow-soft focus-visible:ring-primary text-base sm:text-lg font-bold"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="description" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Mô tả chi tiết</Label>
                                        <Textarea
                                            id="description"
                                            placeholder="Mô tả mục đích hoặc hướng dẫn tham gia..."
                                            value={eventData.description || ''}
                                            onChange={(e) => handleFieldChange('description', e.target.value)}
                                            className="bg-white dark:bg-gray-900 min-h-[120px] rounded-2xl border-none shadow-soft focus-visible:ring-primary resize-none p-4 text-sm font-medium leading-relaxed"
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Section: Event Type Selection */}
                            <section className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                                        <LayoutGrid className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-gray-500">Loại sự kiện</h3>
                                </div>

                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 ml-0 sm:ml-11">
                                    {[
                                        { id: 'vote', label: 'Bình chọn', icon: CheckCircle2, desc: 'Chọn 1 ứng viên', color: 'green' },
                                        { id: 'multi-vote', label: 'Đa bình chọn', icon: ListFilter, desc: 'Chọn nhiều ứng viên', color: 'blue' },
                                        { id: 'review', label: 'Đánh giá', icon: Star, desc: 'Chấm điểm 5 sao', color: 'orange' },
                                        { id: 'ballot', label: 'Rút thăm', icon: Sparkles, desc: 'Ghi danh may mắn', color: 'purple' }
                                    ].map((t) => (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => !isEditing && handleFieldChange('type', t.id)}
                                            disabled={isEditing}
                                            className={cn(
                                                "group flex flex-col items-center justify-center p-4 sm:p-5 rounded-2xl sm:rounded-[2rem] border-2 transition-all text-center gap-2 relative overflow-hidden",
                                                eventData.type === t.id
                                                    ? "border-primary bg-white dark:bg-gray-900 shadow-lg sm:scale-105 z-10"
                                                    : "border-transparent bg-white/50 dark:bg-gray-900/50 grayscale opacity-70 hover:opacity-100 hover:grayscale-0 hover:border-gray-200 dark:hover:border-gray-800",
                                                isEditing && "cursor-not-allowed opacity-70"
                                            )}
                                        >
                                            <div className={cn(
                                                "p-2.5 sm:p-3 rounded-xl sm:rounded-2xl transition-colors",
                                                eventData.type === t.id ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500 group-hover:bg-primary/10 group-hover:text-primary"
                                            )}>
                                                <t.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className={cn("text-xs sm:text-sm font-black tracking-tight truncate", eventData.type === t.id ? "text-primary" : "text-gray-600 dark:text-gray-400")}>
                                                    {t.label}
                                                </p>
                                                <p className="text-[9px] sm:text-[10px] font-bold text-muted-foreground leading-none mt-0.5 sm:mt-1 uppercase tracking-tighter truncate px-1">
                                                    {t.desc}
                                                </p>
                                            </div>
                                            {eventData.type === t.id && (
                                                <div className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                                            )}
                                        </button>
                                    ))}
                                    {isEditing && (
                                        <p className="col-span-full text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/70 ml-1">Không thể đổi loại sự kiện khi đang chỉnh sửa.</p>
                                    )}
                                </div>
                            </section>

                            {/* Section: Timing & Status */}
                            <section className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                                        <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                                    </div>
                                    <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-gray-500">Thời gian & Trạng thái</h3>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 ml-0 sm:ml-11">
                                    <div className="space-y-2">
                                        <Label htmlFor="startAt" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5 ml-1">
                                            <Calendar className="h-3 w-3" /> Bắt đầu
                                        </Label>
                                        <Input id="startAt" type="datetime-local" value={toDatetimeLocalInput(eventData.startAt)} onChange={e => handleFieldChange('startAt', e.target.value)} className="h-11 sm:h-12 bg-white dark:bg-gray-900 rounded-xl border-none shadow-soft px-4 text-sm font-bold" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="endAt" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5 ml-1">
                                            <Calendar className="h-3 w-3" /> Kết thúc
                                        </Label>
                                        <Input id="endAt" type="datetime-local" value={toDatetimeLocalInput(eventData.endAt)} onChange={e => handleFieldChange('endAt', e.target.value)} className="h-11 sm:h-12 bg-white dark:bg-gray-900 rounded-xl border-none shadow-soft px-4 text-sm font-bold" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="status" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Trạng thái</Label>
                                        <Combobox
                                            options={[
                                                { value: 'draft', label: 'Bản nháp' },
                                                { value: 'active', label: 'Kích hoạt' },
                                                { value: 'closed', label: 'Đã đóng' }
                                            ]}
                                            value={eventData.status}
                                            onChange={(v) => handleFieldChange('status', v)}
                                            compact
                                            className="h-11 sm:h-12 bg-white dark:bg-gray-900 rounded-xl border-none shadow-soft font-bold"
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Section: Participation */}
                            <section className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                                        <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
                                    </div>
                                    <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-gray-500">Đối tượng & Lựa chọn</h3>
                                </div>

                                <div className="space-y-8 ml-0 sm:ml-11">
                                    <Tabs 
                                        value={targetMode} 
                                        onValueChange={(v) => {
                                            const newMode = v as 'roles' | 'users';
                                            setTargetMode(newMode);
                                            // Enforce mutual exclusivity
                                            if (newMode === 'roles') {
                                                handleFieldChange('targetUserIds', []);
                                            } else {
                                                handleFieldChange('eligibleRoles', []);
                                            }
                                        }}
                                        className="w-full"
                                    >
                                        <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted/30 p-1 rounded-2xl">
                                            <TabsTrigger value="roles" className="rounded-xl font-bold text-xs uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                                <Briefcase className="h-3.5 w-3.5 mr-2" />
                                                Theo vai trò
                                                {(eventData.eligibleRoles || []).length > 0 && (
                                                    <span className="ml-2 bg-primary/10 text-primary text-[9px] px-1.5 py-0.5 rounded-full">{(eventData.eligibleRoles || []).length}</span>
                                                )}
                                            </TabsTrigger>
                                            <TabsTrigger value="users" className="rounded-xl font-bold text-xs uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                                <User className="h-3.5 w-3.5 mr-2" />
                                                Theo nhân viên
                                                {(eventData.targetUserIds || []).length > 0 && (
                                                    <span className="ml-2 bg-primary/10 text-primary text-[9px] px-1.5 py-0.5 rounded-full">{(eventData.targetUserIds || []).length}</span>
                                                )}
                                            </TabsTrigger>
                                        </TabsList>
                                        
                                        <TabsContent value="roles" className="space-y-3 mt-0">
                                            <Label htmlFor="eligibleRoles" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Vai trò được tham gia</Label>
                                            <Combobox
                                                options={ROLES_OPTIONS}
                                                multiple
                                                value={eventData.eligibleRoles || []}
                                                onChange={(vals) => handleFieldChange('eligibleRoles', vals)}
                                                placeholder="Chọn các vai trò..."
                                                className="bg-white dark:bg-gray-900 rounded-2xl border-none shadow-soft min-h-12 px-4 py-2 font-bold"
                                            />
                                            <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-tight ml-1">
                                                Tất cả nhân viên thuộc vai trò được chọn sẽ thấy sự kiện này.
                                            </p>
                                        </TabsContent>

                                        <TabsContent value="users" className="space-y-3 mt-0">
                                            <Label htmlFor="targetUserIds" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
                                                Chọn nhân viên cụ thể
                                            </Label>
                                            <Combobox
                                                options={allUsers.map(u => ({ value: u.uid, label: u.displayName }))}
                                                multiple
                                                value={eventData.targetUserIds || []}
                                                onChange={(vals) => handleFieldChange('targetUserIds', vals)}
                                                placeholder="Chọn nhân viên..."
                                                className="bg-white dark:bg-gray-900 rounded-2xl border-none shadow-soft min-h-12 px-4 py-2 font-bold"
                                            />
                                            <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-tight ml-1">
                                                Các nhân viên được chọn ở đây sẽ được tham gia, bất kể vai trò của họ.
                                            </p>
                                        </TabsContent>
                                    </Tabs>

                                    <div className="space-y-6 bg-white/50 dark:bg-gray-900/50 p-4 sm:p-8 rounded-3xl sm:rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm transition-all">
                                        {isBallot ? (
                                            <div className="space-y-6">
                                                <div className="flex items-center justify-between mb-2">
                                                    <Label className="text-sm font-black flex items-center gap-2">
                                                        <Trophy className="h-4 w-4 text-primary" />
                                                        Thông tin giải thưởng
                                                    </Label>
                                                </div>
                                                
                                                {/* Prize Information */}
                                                <div className="space-y-4 p-4 bg-white/30 dark:bg-gray-900/30 rounded-2xl">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="prizeName" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Tên giải thưởng</Label>
                                                        <Input
                                                            id="prizeName"
                                                            placeholder="Ví dụ: Thưởng tiền mặt 500k"
                                                            value={eventData.prize?.name || ''}
                                                            onChange={(e) => handleFieldChange('prize', { ...eventData.prize, name: e.target.value })}
                                                            className="h-11 sm:h-12 bg-white dark:bg-gray-900 rounded-xl border-none shadow-soft px-4 text-sm font-bold"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="prizeDesc" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Mô tả giải thưởng</Label>
                                                        <Input
                                                            id="prizeDesc"
                                                            placeholder="Mô tả chi tiết..."
                                                            value={eventData.prize?.description || ''}
                                                            onChange={(e) => handleFieldChange('prize', { ...eventData.prize, description: e.target.value })}
                                                            className="h-11 sm:h-12 bg-white dark:bg-gray-900 rounded-xl border-none shadow-soft px-4 text-sm font-bold"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Ballot Configuration */}
                                                <div className="space-y-4 p-4 bg-amber-50/30 dark:bg-amber-900/20 rounded-2xl border border-amber-200/30 dark:border-amber-800/30">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                                        <Label className="text-sm font-black text-amber-800 dark:text-amber-400">Cấu hình rút thăm</Label>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label htmlFor="winnerCount" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Số người chiến thắng</Label>
                                                        <Input
                                                            id="winnerCount"
                                                            type="number"
                                                            min={1}
                                                            max={50}
                                                            placeholder="1"
                                                            value={eventData.ballotConfig?.winnerCount || ''}
                                                            onChange={(e) => handleFieldChange('ballotConfig', { 
                                                                ...eventData.ballotConfig, 
                                                                winnerCount: parseInt(e.target.value) || 1 
                                                            })}
                                                            className="h-11 bg-white dark:bg-gray-900 rounded-xl border-none shadow-soft px-4 text-sm font-bold w-24"
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label htmlFor="ballotDrawTime" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Thời gian rút thăm</Label>
                                                        <Input
                                                            id="ballotDrawTime"
                                                            type="datetime-local"
                                                            value={eventData.ballotConfig?.ballotDrawTime ? toDatetimeLocalInput(eventData.ballotConfig.ballotDrawTime) : ''}
                                                            onChange={(e) => {
                                                                const date = new Date(e.target.value);
                                                                const timestamp = Timestamp.fromDate(date);
                                                                handleFieldChange('ballotConfig', { 
                                                                    ...eventData.ballotConfig, 
                                                                    ballotDrawTime: timestamp 
                                                                });
                                                            }}
                                                            className="h-11 bg-white dark:bg-gray-900 rounded-xl border-none shadow-soft px-4 text-sm font-bold"
                                                        />
                                                        <p className="text-[9px] text-muted-foreground/60">
                                                            {eventData.ballotConfig?.ballotDrawTime 
                                                                ? `Rút thăm lúc: ${timestampToString(eventData.ballotConfig.ballotDrawTime, 'dd/MM/yyyy HH:mm')}`
                                                                : 'Chọn thời gian rút thăm (mặc định: khi sự kiện kết thúc)'
                                                            }
                                                        </p>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label htmlFor="resultMessage" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Tin nhắn cho người chiến thắng</Label>
                                                        <Textarea
                                                            id="resultMessage"
                                                            placeholder="Chúc mừng bạn đã trúng thưởng! 🎉"
                                                            value={eventData.ballotConfig?.resultMessage || ''}
                                                            onChange={(e) => handleFieldChange('ballotConfig', { 
                                                                ...eventData.ballotConfig, 
                                                                resultMessage: e.target.value 
                                                            })}
                                                            className="bg-white dark:bg-gray-900 min-h-[80px] rounded-xl border-none shadow-soft px-4 py-3 text-sm font-medium resize-none"
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label htmlFor="loserMessage" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Tin nhắn cho người không trúng</Label>
                                                        <Textarea
                                                            id="loserMessage"
                                                            placeholder="Cảm ơn bạn đã tham gia! Lần sau may mắn hơn nhé! 💪"
                                                            value={eventData.ballotConfig?.loserMessage || ''}
                                                            onChange={(e) => handleFieldChange('ballotConfig', { 
                                                                ...eventData.ballotConfig, 
                                                                loserMessage: e.target.value 
                                                            })}
                                                            className="bg-white dark:bg-gray-900 min-h-[80px] rounded-xl border-none shadow-soft px-4 py-3 text-sm font-medium resize-none"
                                                        />
                                                    </div>

                                                    <div className="flex items-center justify-between p-3 bg-white/50 dark:bg-gray-900/50 rounded-xl border border-amber-200/50 dark:border-amber-800/50">
                                                        <div className="space-y-1">
                                                            <Label htmlFor="autoDraw" className="text-sm font-black flex items-center gap-2">
                                                                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                                                Tự động rút thăm
                                                            </Label>
                                                            <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-tight">Rút thăm tự động khi sự kiện kết thúc</p>
                                                        </div>
                                                        <Switch
                                                            id="autoDraw"
                                                            checked={eventData.ballotConfig?.autoDraw ?? true}
                                                            onCheckedChange={(checked) => handleFieldChange('ballotConfig', { 
                                                                ...eventData.ballotConfig, 
                                                                autoDraw: checked 
                                                            })}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-sm font-black flex items-center gap-2">
                                                        <UserCheck className="h-4 w-4 text-primary" />
                                                        Ứng viên / Lựa chọn
                                                    </Label>
                                                </div>

                                                {(isReview || isVote || isMultiVote) && (
                                                    <div className="space-y-3">
                                                        <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">Chọn từ nhân viên hệ thống</Label>
                                                        <Combobox
                                                            options={allUsers.map(u => ({ value: u.uid, label: u.displayName }))}
                                                            multiple
                                                            value={(eventData.candidates || []).map(c => c.id)}
                                                            onChange={(ids) => handleFieldChange('candidates', (ids as string[]).map(id => {
                                                                const user = allUsers.find(u => u.uid === id);
                                                                return { id: user!.uid, name: user!.displayName, avatarUrl: user!.photoURL, meta: { role: user!.role } };
                                                            }))}
                                                            placeholder="Chọn nhân viên..."
                                                            className="bg-white dark:bg-gray-900 rounded-2xl border-none shadow-soft min-h-12 px-4 py-2 font-bold"
                                                        />
                                                    </div>
                                                )}

                                                {(isVote || isMultiVote) && (
                                                    <div className="space-y-5 pt-4 border-t border-dashed border-gray-200 dark:border-gray-800">
                                                        <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">Hoặc thêm lựa chọn tuỳ chỉnh</Label>
                                                        <div className="flex gap-2">
                                                            <Input
                                                                value={newOption}
                                                                onChange={e => setNewOption(e.target.value)}
                                                                placeholder="Tên lựa chọn mới..."
                                                                className="h-11 bg-white dark:bg-gray-900 rounded-xl border-none shadow-soft font-bold px-4 flex-1 text-sm"
                                                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddOption())}
                                                            />
                                                            <Button size="icon" onClick={handleAddOption} className="h-11 w-11 rounded-xl shrink-0 bg-primary/10 hover:bg-primary/20 text-primary border-none"><Plus className="h-5 w-5" /></Button>
                                                        </div>
                                                        
                                                        <div className="flex flex-wrap gap-2 min-h-[40px]">
                                                            {(eventData.options || []).map(opt => (
                                                                <div key={opt.id} className="group flex items-center gap-1.5 pl-3 pr-1 py-1 bg-primary/10 text-primary rounded-xl text-[10px] font-black border border-primary/10 transition-all hover:bg-primary/20">
                                                                    <span className="uppercase tracking-tight truncate max-w-[120px]">{opt.name}</span>
                                                                    <button 
                                                                        onClick={() => handleDeleteOption(opt.id)} 
                                                                        className="opacity-40 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-600 rounded-lg p-1 transition-all"
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                            {(eventData.options || []).length === 0 && (eventData.candidates || []).length === 0 && (
                                                                <span className="text-[10px] text-muted-foreground/50 italic ml-1 font-bold uppercase tracking-wider leading-none mt-2">Chưa có ứng viên hoặc lựa chọn nào.</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {isMultiVote && (
                                            <div className="p-4 sm:p-6 bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 rounded-2xl sm:rounded-3xl space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <Trophy className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                                    <Label htmlFor="maxVotesPerUser" className="text-[10px] font-black uppercase tracking-widest text-amber-800 dark:text-amber-400">Giới hạn lựa chọn</Label>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <Input
                                                        id="maxVotesPerUser"
                                                        type="number"
                                                        min={1}
                                                        value={eventData.maxVotesPerUser ?? ''}
                                                        onChange={(e) => handleFieldChange('maxVotesPerUser', e.target.value ? Number(e.target.value) : undefined)}
                                                        className="w-20 bg-white dark:bg-gray-900 border-none shadow-sm h-10 text-center font-black rounded-lg"
                                                    />
                                                    <p className="text-[9px] sm:text-[10px] font-bold text-amber-700/70 dark:text-amber-400/50 leading-snug uppercase tracking-tight flex-1">
                                                        Mỗi nhân viên được phép chọn tối đa bao nhiêu mục.
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>

                            {/* Section: Advanced Settings */}
                            <section className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center shrink-0">
                                        <Settings className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                                    </div>
                                    <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-gray-500">Cấu hình & Bảo mật</h3>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 ml-0 sm:ml-11 text-gray-600 dark:text-gray-300">
                                    <div className="group flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-2xl sm:rounded-[2rem] border border-transparent hover:border-blue-500/20 shadow-soft transition-all">
                                        <div className="space-y-1 pr-2">
                                            <Label htmlFor="anonymousResults" className="text-sm font-black flex items-center gap-2">
                                                <EyeOff className="h-4 w-4 text-blue-500" />
                                                Ẩn danh
                                            </Label>
                                            <p className="text-[9px] sm:text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tight">Không hiển thị tên người tham gia.</p>
                                        </div>
                                        <Switch 
                                            id="anonymousResults" 
                                            checked={eventData.anonymousResults} 
                                            onCheckedChange={(c) => handleFieldChange('anonymousResults', c)}
                                            className="scale-90 sm:scale-110"
                                        />
                                    </div>
                                    <div className="group flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-2xl sm:rounded-[2rem] border border-transparent hover:border-purple-500/20 shadow-soft transition-all">
                                        <div className="space-y-1 pr-2">
                                            <Label htmlFor="allowComments" className="text-sm font-black flex items-center gap-2">
                                                <MessageSquare className="h-4 w-4 text-purple-500" />
                                                Bình luận
                                            </Label>
                                            <p className="text-[9px] sm:text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tight">Cho phép gửi kèm lời nhắn.</p>
                                        </div>
                                        <Switch 
                                            id="allowComments" 
                                            checked={eventData.allowComments} 
                                            onCheckedChange={(c) => handleFieldChange('allowComments', c)}
                                            className="scale-90 sm:scale-110"
                                        />
                                    </div>
                                </div>

                                <div className="mt-3 flex items-center justify-between p-4 bg-slate-100/50 dark:bg-slate-900/40 rounded-2xl sm:rounded-[2rem] border border-transparent shadow-sm mx-0 sm:mx-11">
                                    <div className="space-y-1 pr-2">
                                        <Label htmlFor="isTest" className="text-sm font-black flex items-center gap-2">
                                            <Sparkles className="h-4 w-4 text-rose-500" />
                                            Sự kiện thử nghiệm
                                        </Label>
                                        <p className="text-[9px] sm:text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tight leading-relaxed">Chỉ dành cho tài khoản nhân viên test mới thấy được sự kiện này.</p>
                                    </div>
                                    <Switch
                                        id="isTest"
                                        checked={Boolean(eventData.isTest)}
                                        onCheckedChange={(v) => handleFieldChange('isTest', Boolean(v))}
                                        className="scale-90 sm:scale-110"
                                    />
                                </div>
                            </section>
                        </div>
                    </ScrollArea>
                </DialogBody>

                <DialogFooter className="p-4 sm:p-8 border-t bg-white/95 dark:bg-gray-950/95 backdrop-blur-md flex-row justify-between items-center gap-4 shrink-0">
                    <DialogCancel onClick={onClose} className="rounded-xl sm:rounded-2xl h-11 sm:h-12 px-4 sm:px-6 font-bold uppercase tracking-widest text-[10px] sm:text-xs border-none bg-transparent hover:bg-muted/50">
                        Huỷ bỏ
                    </DialogCancel>
                    <DialogAction 
                        onClick={handleSave} 
                        isLoading={isSaving} 
                        className="rounded-xl sm:rounded-2xl h-11 sm:h-12 min-w-[120px] sm:min-w-[160px] font-black uppercase tracking-[0.15em] text-[10px] sm:text-xs shadow-lg shadow-primary/20"
                    >
                        {eventToEdit ? 'Cập nhật' : 'Tạo sự kiện'}
                    </DialogAction>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
