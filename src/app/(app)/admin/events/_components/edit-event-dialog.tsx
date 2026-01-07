'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Combobox } from '@/components/combobox';
import type { Event, EventCandidate, EventType, UserRole, ManagedUser } from '@/lib/types';
import { Loader2, Plus, Trash2, Calendar, Users, Settings, Info, CheckCircle2, ListFilter, UserCheck, MessageSquare, EyeOff, Clock, Trophy, Star } from 'lucide-react';
import { toast } from '@/components/ui/pro-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Timestamp } from 'firebase/firestore';
import { timestampToString, toDateSafe } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface EditEventDialogProps {
    isOpen: boolean;
    onClose: () => void;
    eventToEdit: Event | null;
    onSave: (event: Omit<Event, 'id'>, id?: string) => Promise<void>;
    allUsers: ManagedUser[];
}

const ROLES_OPTIONS: { value: UserRole; label: string }[] = [
    { value: 'Phục vụ', label: 'Phục vụ' },
    { value: 'Pha chế', label: 'Pha chế' },
    { value: 'Thu ngân', label: 'Thu ngân' },
    { value: 'Quản lý', label: 'Quản lý' },
];

export default function EditEventDialog({ isOpen, onClose, eventToEdit, onSave, allUsers }: EditEventDialogProps) {
    const [eventData, setEventData] = useState<Partial<Event>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [newOption, setNewOption] = useState('');

    useEffect(() => {
        if (isOpen) {
            const initialData = eventToEdit ? {
                ...eventToEdit,
                startAt: (eventToEdit.startAt as Timestamp).toDate().toISOString().slice(0, 16),
                endAt: (eventToEdit.endAt as Timestamp).toDate().toISOString().slice(0, 16),
            } : {
                title: '',
                description: '',
                type: 'vote' as EventType,
                status: 'draft' as Event['status'],
                eligibleRoles: [],
                candidates: [],
                options: [],
                startAt: new Date().toISOString().slice(0, 16),
                endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
                anonymousResults: false,
                allowComments: true,
            };
            setEventData(initialData as any);
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
        if (eventData.type === 'multi-vote') {
            const max = eventData.maxVotesPerUser;
            const totalOptions = (eventData.candidates || []).length + (eventData.options || []).length;
            if (!max || max < 1) {
                toast.error('Vui lòng chỉ định số lượt tối đa mỗi người cho loại "multi-vote".');
                return;
            }
            if (totalOptions > 0 && max > totalOptions) {
                toast.error('Số lượt tối đa không thể lớn hơn tổng số lựa chọn.');
                return;
            }
        }
        setIsSaving(true);
        try {
            const finalData = {
                ...eventData,
                startAt: Timestamp.fromDate(toDateSafe(eventData.startAt) ?? new Date()),
                endAt: Timestamp.fromDate(toDateSafe(eventData.endAt) ?? new Date()),
            };
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
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl p-0 overflow-hidden border-none shadow-2xl flex flex-col max-h-[90vh]">
                <div className="bg-primary/5 px-6 py-4 border-b">
                    <DialogHeader>
                        <DialogTitle className="text-xl flex items-center gap-2">
                            {eventToEdit ? <Settings className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
                            {eventToEdit ? 'Chỉnh sửa Sự kiện' : 'Tạo Sự kiện mới'}
                        </DialogTitle>
                        <DialogDescription>
                            Thiết lập các thông số cho sự kiện bình chọn hoặc đánh giá.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <ScrollArea className="flex-1 overflow-auto">
                    <div className="p-6 space-y-8">
                        {/* Section: Basic Info */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-bold text-primary uppercase tracking-wider">
                                <Info className="h-4 w-4" />
                                Thông tin cơ bản
                            </div>
                            <div className="grid gap-4 pl-6 border-l-2 border-muted ml-2">
                                <div className="space-y-2">
                                    <Label htmlFor="title" className="text-sm font-medium">Tiêu đề sự kiện</Label>
                                    <Input 
                                        id="title" 
                                        placeholder="Ví dụ: Bình chọn nhân viên xuất sắc tháng 12"
                                        value={eventData.title || ''} 
                                        onChange={(e) => handleFieldChange('title', e.target.value)} 
                                        className="bg-muted/30 focus-visible:ring-primary"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description" className="text-sm font-medium">Mô tả chi tiết</Label>
                                    <Textarea 
                                        id="description" 
                                        placeholder="Mô tả mục đích hoặc hướng dẫn tham gia..."
                                        value={eventData.description || ''} 
                                        onChange={(e) => handleFieldChange('description', e.target.value)} 
                                        className="bg-muted/30 min-h-[100px] focus-visible:ring-primary"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Section: Event Type Selection */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-bold text-primary uppercase tracking-wider">
                                <ListFilter className="h-4 w-4" />
                                Loại sự kiện
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pl-6 border-l-2 border-muted ml-2">
                                {[
                                    { id: 'vote', label: 'Bình chọn', icon: CheckCircle2, desc: '1 lựa chọn' },
                                    { id: 'multi-vote', label: 'Đa bình chọn', icon: ListFilter, desc: 'Nhiều lựa chọn' },
                                    { id: 'review', label: 'Đánh giá', icon: Star, desc: 'Chấm điểm sao' },
                                    { id: 'ballot', label: 'Rút thăm', icon: Trophy, desc: 'Bỏ phiếu may mắn' }
                                ].map((t) => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => handleFieldChange('type', t.id)}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all text-center gap-1",
                                            eventData.type === t.id 
                                                ? "border-primary bg-primary/5 text-primary shadow-sm" 
                                                : "border-muted bg-transparent hover:border-muted-foreground/30 text-muted-foreground"
                                        )}
                                    >
                                        <t.icon className={cn("h-6 w-6 mb-1", eventData.type === t.id ? "text-primary" : "text-muted-foreground")} />
                                        <span className="text-xs font-bold leading-tight">{t.label}</span>
                                        <span className="text-[10px] opacity-70">{t.desc}</span>
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* Section: Timing & Status */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-bold text-primary uppercase tracking-wider">
                                <Clock className="h-4 w-4" />
                                Thời gian & Trạng thái
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pl-6 border-l-2 border-muted ml-2">
                                <div className="space-y-2">
                                    <Label htmlFor="startAt" className="text-xs font-medium flex items-center gap-1"><Calendar className="h-3 w-3"/> Bắt đầu</Label>
                                    <Input id="startAt" type="datetime-local" value={timestampToString(eventData.startAt)} onChange={e => handleFieldChange('startAt', e.target.value)} className="bg-muted/30 text-xs" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="endAt" className="text-xs font-medium flex items-center gap-1"><Calendar className="h-3 w-3"/> Kết thúc</Label>
                                    <Input id="endAt" type="datetime-local" value={timestampToString(eventData.endAt)} onChange={e => handleFieldChange('endAt', e.target.value)} className="bg-muted/30 text-xs" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="status" className="text-xs font-medium">Trạng thái</Label>
                                    <Combobox 
                                        options={[
                                            {value: 'draft', label: 'Bản nháp'}, 
                                            {value: 'active', label: 'Kích hoạt'}, 
                                            {value: 'closed', label: 'Đã đóng'}
                                        ]} 
                                        value={eventData.status} 
                                        onChange={(v) => handleFieldChange('status', v)} 
                                        compact 
                                        className="bg-muted/30"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Section: Participation */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-bold text-primary uppercase tracking-wider">
                                <Users className="h-4 w-4" />
                                Đối tượng & Lựa chọn
                            </div>
                            <div className="space-y-4 pl-6 border-l-2 border-muted ml-2">
                                <div className="space-y-2">
                                    <Label htmlFor="eligibleRoles" className="text-sm font-medium">Vai trò được tham gia</Label>
                                    <Combobox
                                        options={ROLES_OPTIONS}
                                        multiple
                                        value={eventData.eligibleRoles || []}
                                        onChange={(vals) => handleFieldChange('eligibleRoles', vals)}
                                        placeholder="Chọn các vai trò..."
                                        className="bg-muted/30"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-sm font-medium flex items-center gap-2">
                                        <UserCheck className="h-4 w-4" />
                                        Danh sách ứng viên / Lựa chọn
                                    </Label>
                                    
                                    {(eventData.type === 'review' || eventData.type === 'vote' || eventData.type === 'multi-vote') && (
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">Chọn từ danh sách nhân viên:</Label>
                                            <Combobox
                                                options={allUsers.map(u => ({ value: u.uid, label: u.displayName }))}
                                                multiple
                                                value={(eventData.candidates || []).map(c => c.id)}
                                                onChange={(ids) => handleFieldChange('candidates', (ids as string[]).map(id => {
                                                    const user = allUsers.find(u => u.uid === id);
                                                    return { id: user!.uid, name: user!.displayName, meta: { role: user!.role } };
                                                }))}
                                                placeholder="Chọn nhân viên..."
                                                className="bg-muted/30"
                                            />
                                        </div>
                                    )}

                                    {(eventData.type !== 'review') && (
                                        <div className="space-y-3 pt-2 border-t border-dashed">
                                            <Label className="text-xs text-muted-foreground">Hoặc thêm lựa chọn tuỳ chỉnh:</Label>
                                            <div className="flex gap-2">
                                                <Input 
                                                    value={newOption} 
                                                    onChange={e => setNewOption(e.target.value)} 
                                                    placeholder="Tên lựa chọn mới..."
                                                    className="bg-muted/30 h-9"
                                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddOption())}
                                                />
                                                <Button size="sm" onClick={handleAddOption} className="shrink-0"><Plus className="h-4 w-4"/></Button>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {(eventData.options || []).map(opt => (
                                                    <div key={opt.id} className="flex items-center gap-1.5 pl-3 pr-1 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium border border-primary/20">
                                                        {opt.name}
                                                        <button onClick={() => handleDeleteOption(opt.id)} className="hover:bg-primary/20 rounded-full p-0.5 transition-colors">
                                                            <Trash2 className="h-3 w-3"/>
                                                        </button>
                                                    </div>
                                                ))}
                                                {(eventData.options || []).length === 0 && (eventData.candidates || []).length === 0 && (
                                                    <span className="text-xs text-muted-foreground italic">Chưa có lựa chọn nào.</span>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {eventData.type === 'multi-vote' && (
                                        <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg space-y-2">
                                            <Label htmlFor="maxVotesPerUser" className="text-xs font-bold text-amber-800">Giới hạn số lượt chọn</Label>
                                            <div className="flex items-center gap-3">
                                                <Input 
                                                    id="maxVotesPerUser" 
                                                    type="number" 
                                                    min={1} 
                                                    value={eventData.maxVotesPerUser ?? ''} 
                                                    onChange={(e) => handleFieldChange('maxVotesPerUser', e.target.value ? Number(e.target.value) : undefined)} 
                                                    className="w-24 bg-white border-amber-200 h-8 text-sm"
                                                />
                                                <p className="text-[10px] text-amber-700 leading-tight">Mỗi người dùng được phép chọn tối đa bao nhiêu mục.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* Section: Advanced Settings */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-bold text-primary uppercase tracking-wider">
                                <Settings className="h-4 w-4" />
                                Cấu hình nâng cao
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pl-6 border-l-2 border-muted ml-2">
                                <div className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border border-transparent hover:border-muted transition-all">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="anonymousResults" className="text-sm font-bold flex items-center gap-2">
                                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                                            Kết quả ẩn danh
                                        </Label>
                                        <p className="text-[10px] text-muted-foreground">Không hiển thị tên người bình chọn.</p>
                                    </div>
                                    <Switch id="anonymousResults" checked={eventData.anonymousResults} onCheckedChange={(c) => handleFieldChange('anonymousResults', c)} />
                                </div>
                                <div className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border border-transparent hover:border-muted transition-all">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="allowComments" className="text-sm font-bold flex items-center gap-2">
                                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                            Cho phép bình luận
                                        </Label>
                                        <p className="text-[10px] text-muted-foreground">Người dùng có thể để lại ý kiến.</p>
                                    </div>
                                    <Switch id="allowComments" checked={eventData.allowComments} onCheckedChange={(c) => handleFieldChange('allowComments', c)} />
                                </div>
                            </div>
                        </section>
                    </div>
                </ScrollArea>

                <div className="p-6 border-t bg-muted/10">
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={onClose} className="font-bold">Hủy bỏ</Button>
                        <Button onClick={handleSave} disabled={isSaving} className="min-w-[140px] font-bold shadow-lg shadow-primary/20">
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            {eventToEdit ? 'Lưu thay đổi' : 'Tạo sự kiện ngay'}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
