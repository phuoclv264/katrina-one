'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogBody, DialogAction, DialogCancel } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Combobox } from '@/components/combobox';
import { Loader2, Wand2, Paperclip, Camera, X, File as FileIcon, Users, Type, AlignLeft, ShieldCheck, Globe } from 'lucide-react';
import type { ManagedUser, WhistleblowingReport, Attachment } from '@/lib/types';
import { callRefineText } from '@/lib/ai-service';
import { toast } from '@/components/ui/pro-toast';
import { photoStore } from '@/lib/photo-store';
import { v4 as uuidv4 } from 'uuid';
import Image from '@/components/ui/image';
import CameraDialog from '@/components/camera-dialog';


type ReportDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any, id?: string) => Promise<void>;
    allUsers: ManagedUser[];
    reportToEdit?: WhistleblowingReport | null;
    currentUserName: string;
    currentUserRole: string;
    parentDialogTag: string;
};

type LocalAttachment = {
    id: string; // for local state management
    url: string; // Object URL for preview
    file: File;
};

export default function ReportDialog({ isOpen, onClose, onSave, allUsers, reportToEdit, currentUserName, currentUserRole, parentDialogTag }: ReportDialogProps) {
    const isEditMode = !!reportToEdit;
    const shouldShowAllUsers = currentUserName.includes('Không chọn') || currentUserRole === 'Chủ nhà hàng';

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [accusedUsers, setAccusedUsers] = useState<ManagedUser[]>([]);
    const [isAnonymous, setIsAnonymous] = useState(true);
    const [visibility, setVisibility] = useState<'public' | 'private'>('private');

    // Attachment state
    const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);
    const [localAttachments, setLocalAttachments] = useState<LocalAttachment[]>([]);

    const [isSaving, setIsSaving] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (isEditMode) {
                setTitle(reportToEdit.title);
                setContent(reportToEdit.content);
                setAccusedUsers(reportToEdit.accusedUsers);
                setIsAnonymous(reportToEdit.isAnonymous);
                setVisibility(reportToEdit.visibility);
                setExistingAttachments(reportToEdit.attachments || []);
            } else {
                setTitle('');
                setContent('');
                setAccusedUsers([]);
                setIsAnonymous(true);
                setVisibility('private');
                setExistingAttachments([]);
            }
            // Always reset local photos
            localAttachments.forEach(att => URL.revokeObjectURL(att.url));
            setLocalAttachments([]);
        }
    }, [isOpen, reportToEdit, isEditMode]);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files) return;
        const files = Array.from(event.target.files);
        const newAttachments: LocalAttachment[] = [];

        for (const file of files) {
            const id = uuidv4();
            await photoStore.addPhoto(id, file); // Store the file blob
            const url = URL.createObjectURL(file);
            newAttachments.push({ id, url, file });
        }
        setLocalAttachments(prev => [...prev, ...newAttachments]);
    };

    const handleCameraCapture = async (media: { id: string; type: 'photo' | 'video' }[]) => {
        setIsCameraOpen(false);
        const newAttachments: LocalAttachment[] = [];
        // Filter for photos only, as this dialog currently only handles images.
        const photos = media.filter(m => m.type === 'photo');
        for (const { id } of photos) {
            const blob = await photoStore.getPhoto(id);
            if (blob) {
                const file = new File([blob], `${id}.jpg`, { type: blob.type });
                const url = URL.createObjectURL(file);
                newAttachments.push({ id, url, file });
            }
        }
        setLocalAttachments(prev => [...prev, ...newAttachments]);
    };

    const handleDeleteAttachment = async (attachment: Attachment | LocalAttachment, isExisting: boolean) => {
        if (isExisting) {
            setExistingAttachments(prev => prev.filter(att => att.url !== attachment.url));
        } else {
            const localAtt = attachment as LocalAttachment;
            setLocalAttachments(prev => prev.filter(att => att.id !== localAtt.id));
            URL.revokeObjectURL(localAtt.url);
            await photoStore.deletePhoto(localAtt.id);
        }
    };


    const handleRefineContent = async () => {
        if (!title.trim() && !content.trim()) return;
        setIsAiLoading(true);
        try {
            const { refinedTitle, refinedContent } = await callRefineText({ title, content });
            setTitle(refinedTitle);
            setContent(refinedContent);
            toast.success('Đã chuốt lại câu từ!');
        } catch (error) {
            toast.error('Không thể chuốt lại câu từ lúc này.');
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleSave = async () => {
        if (!title.trim() || !content.trim()) {
            toast.error("Vui lòng nhập tiêu đề và nội dung.");
            return;
        }
        setIsSaving(true);

        const data = {
            title,
            content,
            accusedUsers: accusedUsers,
            isAnonymous,
            visibility,
            localAttachments: localAttachments,
            existingAttachments, // Pass existing attachments for update logic
        };

        await onSave(data, reportToEdit?.id);
        setIsSaving(false);
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose} dialogTag="report-dialog" parentDialogTag={parentDialogTag}>
                <DialogContent className="max-w-3xl h-[90vh] sm:h-[85vh]">
                    <DialogHeader iconkey="file">
                        <DialogTitle>{isEditMode ? 'Chỉnh sửa bài đăng' : 'Tạo bài tố cáo mới'}</DialogTitle>
                        <DialogDescription>
                            {isEditMode ? 'Thực hiện các thay đổi cho bài đăng của bạn.' : 'Mọi thông tin sẽ được bảo mật theo lựa chọn của bạn.'}
                        </DialogDescription>
                    </DialogHeader>

                    <DialogBody className="bg-muted/5 py-6">
                        <div className="space-y-8">
                            {/* Section: People involved */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 ml-1">
                                    <Users className="h-3 w-3" />
                                    Đối tượng liên quan
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-foreground/70 ml-1">Người bị tố cáo</Label>
                                    <Combobox
                                        options={(shouldShowAllUsers
                                            ? allUsers
                                            : allUsers.filter(u => u.role !== 'Chủ nhà hàng' && !u.displayName.includes('Không chọn'))
                                        )
                                            .filter(u => u.role !== 'Chủ nhà hàng')
                                            .map(u => ({ value: u.uid, label: u.displayName }))}
                                        multiple
                                        value={accusedUsers.map(u => u.uid)}
                                        onChange={(next) => {
                                            const nextIds = Array.isArray(next)
                                                ? next
                                                : typeof next === 'string' && next
                                                    ? [next]
                                                    : [];
                                            const candidateUsers = (shouldShowAllUsers
                                                ? allUsers
                                                : allUsers.filter(u => u.role !== 'Chủ nhà hàng' && !u.displayName.includes('Không chọn'))
                                            ).filter(u => u.role !== 'Chủ nhà hàng');

                                            setAccusedUsers(
                                                nextIds
                                                    .map(id => candidateUsers.find(u => u.uid === id))
                                                    .filter((u): u is ManagedUser => !!u)
                                            );
                                        }}
                                        placeholder="Chọn nhân viên..."
                                        searchPlaceholder="Tìm nhân viên..."
                                        emptyText="Không tìm thấy nhân viên."
                                        className="rounded-2xl border-none bg-background shadow-sm h-14 px-4"
                                    />
                                </div>
                            </div>

                            {/* Section: Content */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 ml-1">
                                    <Type className="h-3 w-3" />
                                    Nội dung phản ánh
                                </div>
                                <div className="grid gap-5">
                                    <div className="space-y-2">
                                        <Label htmlFor="title" className="text-xs font-bold text-foreground/70 ml-1">Tiêu đề</Label>
                                        <Input
                                            id="title"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            disabled={isSaving || isAiLoading}
                                            className="rounded-2xl border-none bg-background shadow-sm h-14 px-5 font-bold focus:ring-2 focus:ring-primary/10"
                                            placeholder="Tiêu đề bài đăng..."
                                        />
                                    </div>
                                    <div className="space-y-2 relative">
                                        <Label htmlFor="content" className="text-xs font-bold text-foreground/70 ml-1">Nội dung chi tiết</Label>
                                        <Textarea
                                            id="content"
                                            value={content}
                                            onChange={(e) => setContent(e.target.value)}
                                            rows={6}
                                            disabled={isSaving || isAiLoading}
                                            className="rounded-3xl border-none bg-background shadow-sm p-5 font-medium min-h-[160px] focus:ring-2 focus:ring-primary/10 leading-relaxed"
                                            placeholder="Vui lòng mô tả chi tiết sự việc, thời gian và địa điểm..."
                                        />
                                        <div className="flex justify-end pt-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleRefineContent}
                                                disabled={isAiLoading || (!title.trim() && !content.trim())}
                                                className="rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-600 border-orange-100/50 h-9 font-black text-[10px] uppercase tracking-widest gap-2 shadow-sm transition-all"
                                            >
                                                {isAiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                                                Chuốt lại câu từ bằng AI
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section: Attachments */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 ml-1">
                                    <Paperclip className="h-3 w-3" />
                                    Tệp đính kèm & Hình ảnh
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Button asChild variant="outline" className="rounded-2xl border-dashed border-2 bg-background h-14 font-black text-[10px] uppercase tracking-widest hover:bg-muted/50 transition-all cursor-pointer shadow-sm">
                                        <label htmlFor="file-upload">
                                            <Paperclip className="mr-2 h-4 w-4" />
                                            Tải tệp lên
                                        </label>
                                    </Button>
                                    <input id="file-upload" type="file" multiple className="hidden" onChange={handleFileChange} />
                                    <Button
                                        variant="outline"
                                        onClick={() => setIsCameraOpen(true)}
                                        className="rounded-2xl border-dashed border-2 bg-background h-14 font-black text-[10px] uppercase tracking-widest hover:bg-muted/50 transition-all shadow-sm"
                                    >
                                        <Camera className="mr-2 h-4 w-4" /> Chụp ảnh mới
                                    </Button>
                                </div>

                                {(existingAttachments.length > 0 || localAttachments.length > 0) && (
                                    <div className="flex flex-wrap gap-4 mt-2 p-5 bg-background rounded-3xl border-2 border-dashed border-muted/50">
                                        {existingAttachments.map((att) => (
                                            <div key={att.url} className="relative w-24 h-24 group">
                                                {att.type.startsWith('image/') ? (
                                                    <Image src={att.url} alt={att.name} fill className="object-cover rounded-2xl shadow-sm" />
                                                ) : (
                                                    <div className="w-full h-full rounded-2xl bg-muted/30 flex flex-col items-center justify-center p-2 border border-muted/50">
                                                        <FileIcon className="h-8 w-8 text-muted-foreground/40" />
                                                        <p className="text-[9px] font-bold text-muted-foreground/60 text-center truncate w-full px-1 uppercase tracking-tighter mt-1">{att.name}</p>
                                                    </div>
                                                )}
                                                <Button
                                                    variant="destructive"
                                                    size="icon"
                                                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-lg scale-90 group-hover:scale-110 transition-transform"
                                                    onClick={() => handleDeleteAttachment(att, true)}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                        {localAttachments.map((att) => (
                                            <div key={att.id} className="relative w-24 h-24 group">
                                                {att.file.type.startsWith('image/') || att.file.type.startsWith('video/') ? (
                                                    <Image src={att.url} alt={att.file.name} fill className="object-cover rounded-2xl shadow-sm" />
                                                ) : (
                                                    <div className="w-full h-full rounded-2xl bg-muted/30 flex flex-col items-center justify-center p-2 border border-muted/50">
                                                        <FileIcon className="h-8 w-8 text-muted-foreground/40" />
                                                        <p className="text-[9px] font-bold text-muted-foreground/60 text-center truncate w-full px-1 uppercase tracking-tighter mt-1">{att.file.name}</p>
                                                    </div>
                                                )}
                                                <Button
                                                    variant="destructive"
                                                    size="icon"
                                                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-lg scale-90 group-hover:scale-110 transition-transform"
                                                    onClick={() => handleDeleteAttachment(att, false)}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </DialogBody>

                    <DialogFooter className="flex flex-col gap-6 p-6">
                        {/* Protection Policies */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 w-full">
                            <div className="flex items-center justify-between bg-muted/30 p-2 rounded-3xl border border-muted-foreground/5">
                                <div className="space-y-0.5 pr-2">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground/60" />
                                        <Label htmlFor="anonymous-mode" className="text-xs font-black uppercase tracking-tight cursor-pointer">Gửi ẩn danh</Label>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground/60 font-medium">Ẩn danh tính với mọi người</p>
                                </div>
                                <Switch id="anonymous-mode" checked={isAnonymous} onCheckedChange={setIsAnonymous} />
                            </div>
                            <div className="flex items-center justify-between bg-muted/30 p-2 rounded-3xl border border-muted-foreground/5">
                                <div className="space-y-0.5 pr-2">
                                    <div className="flex items-center gap-2">
                                        <Globe className="h-3.5 w-3.5 text-muted-foreground/60" />
                                        <Label htmlFor="visibility-mode" className="text-xs font-black uppercase tracking-tight cursor-pointer">Riêng tư</Label>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground/60 font-medium">Chỉ chủ quán mới thấy</p>
                                </div>
                                <Switch id="visibility-mode" checked={visibility === 'private'} onCheckedChange={(checked) => setVisibility(checked ? 'private' : 'public')} />
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 w-full">
                            <DialogCancel onClick={onClose} disabled={isSaving} className="flex-1 h-14 rounded-2xl text-xs font-black uppercase tracking-widest border-none bg-muted/40 font-black">Hủy bỏ</DialogCancel>
                            <DialogAction onClick={handleSave} isLoading={isSaving} className="flex-[2] h-14 rounded-2xl text-base font-black tracking-tight">
                                {isEditMode ? 'Cập nhật bài đăng' : 'Gửi bài tố cáo ngay'}
                            </DialogAction>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <CameraDialog
                isOpen={isCameraOpen}
                onClose={() => setIsCameraOpen(false)}
                onSubmit={handleCameraCapture}
                captureMode="photo"
                parentDialogTag="report-dialog"
            />
        </>
    );
}
