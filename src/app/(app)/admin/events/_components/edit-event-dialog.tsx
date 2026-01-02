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
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from '@/components/ui/pro-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Timestamp } from 'firebase/firestore';
import { timestampToString, toDateSafe } from '@/lib/utils';

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
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{eventToEdit ? 'Chỉnh sửa Sự kiện' : 'Tạo Sự kiện mới'}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[70vh] p-1">
                <div className="grid gap-4 py-4 pr-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Tiêu đề</Label>
                        <Input id="title" value={eventData.title || ''} onChange={(e) => handleFieldChange('title', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Mô tả</Label>
                        <Textarea id="description" value={eventData.description || ''} onChange={(e) => handleFieldChange('description', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="type">Loại sự kiện</Label>
                            <Combobox options={[{value: 'vote', label: 'Bình chọn (1 lựa chọn)'}, {value: 'multi-vote', label: 'Bình chọn (nhiều lựa chọn)'}, {value: 'review', label: 'Đánh giá nhân viên'}, {value: 'ballot', label: 'Bỏ phiếu/Rút thăm'}]} value={eventData.type} onChange={(v) => handleFieldChange('type', v)} compact />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="status">Trạng thái</Label>
                            <Combobox options={[{value: 'draft', label: 'Bản nháp'}, {value: 'active', label: 'Kích hoạt'}, {value: 'closed', label: 'Đã đóng'}]} value={eventData.status} onChange={(v) => handleFieldChange('status', v)} compact />
                        </div>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="startAt">Thời gian bắt đầu</Label>
                            <Input id="startAt" type="datetime-local" value={timestampToString(eventData.startAt)} onChange={e => handleFieldChange('startAt', e.target.value)} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="endAt">Thời gian kết thúc</Label>
                            <Input id="endAt" type="datetime-local" value={timestampToString(eventData.endAt)} onChange={e => handleFieldChange('endAt', e.target.value)} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="eligibleRoles">Vai trò được tham gia</Label>
                         <Combobox
                            options={ROLES_OPTIONS}
                            multiple
                            value={eventData.eligibleRoles || []}
                            onChange={(vals) => handleFieldChange('eligibleRoles', vals)}
                            placeholder="Chọn các vai trò..."
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Đối tượng bình chọn</Label>
                         {(eventData.type === 'review' || eventData.type === 'vote' || eventData.type === 'multi-vote') && (
                            <Combobox
                                options={allUsers.map(u => ({ value: u.uid, label: u.displayName }))}
                                multiple
                                value={(eventData.candidates || []).map(c => c.id)}
                                onChange={(ids) => handleFieldChange('candidates', (ids as string[]).map(id => {
                                    const user = allUsers.find(u => u.uid === id);
                                    return { id: user!.uid, name: user!.displayName, meta: { role: user!.role } };
                                }))}
                                placeholder="Chọn nhân viên..."
                            />
                        )}
                        {(eventData.type !== 'review') && (
                             <div className="space-y-2 pt-2 border-t mt-4">
                                <Label className="text-xs text-muted-foreground">Hoặc thêm lựa chọn tuỳ chỉnh:</Label>
                                <div className="flex gap-2">
                                    <Input value={newOption} onChange={e => setNewOption(e.target.value)} placeholder="Tên lựa chọn..."/>
                                    <Button size="sm" onClick={handleAddOption}><Plus className="mr-2 h-4 w-4"/>Thêm</Button>
                                </div>
                                <div className="space-y-1">
                                    {(eventData.options || []).map(opt => (
                                        <div key={opt.id} className="flex items-center justify-between p-1.5 bg-muted/50 rounded-md">
                                            <span className="text-sm">{opt.name}</span>
                                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleDeleteOption(opt.id)}><Trash2 className="h-3 w-3 text-destructive"/></Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch id="anonymousResults" checked={eventData.anonymousResults} onCheckedChange={(c) => handleFieldChange('anonymousResults', c)} />
                        <Label htmlFor="anonymousResults">Kết quả ẩn danh</Label>
                    </div>
                     <div className="flex items-center space-x-2">
                        <Switch id="allowComments" checked={eventData.allowComments} onCheckedChange={(c) => handleFieldChange('allowComments', c)} />
                        <Label htmlFor="allowComments">Cho phép bình luận</Label>
                    </div>
                </div>
                </ScrollArea>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Hủy</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        {eventToEdit ? 'Lưu thay đổi' : 'Tạo sự kiện'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
