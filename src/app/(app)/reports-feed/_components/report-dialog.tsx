'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Combobox } from '@/components/combobox';
import { Loader2, Wand2, Paperclip, Camera, X, File as FileIcon } from 'lucide-react';
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
                <DialogContent className="sm:max-w-[625px] bg-white dark:bg-card p-0 h-[90vh] flex flex-col">
                    <DialogHeader className="p-4 sm:p-6 pb-2 shrink-0">
                        <DialogTitle>{isEditMode ? 'Chỉnh sửa bài đăng' : 'Tạo bài tố cáo mới'}</DialogTitle>
                        <DialogDescription>
                            {isEditMode ? 'Thực hiện các thay đổi cho bài đăng của bạn.' : 'Mọi thông tin sẽ được bảo mật theo lựa chọn của bạn.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-grow overflow-y-auto px-4 py-2">
                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <Label>Người bị tố cáo</Label>
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
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="title">Tiêu đề</Label>
                                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={isSaving || isAiLoading} />
                            </div>
                            <div className="space-y-2 relative">
                                <Label htmlFor="content">Nội dung</Label>
                                <Textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} rows={6} disabled={isSaving || isAiLoading} />
                            </div>
                            <Button variant="outline" onClick={handleRefineContent} disabled={isAiLoading || (!title.trim() && !content.trim())} className="w-full justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:hover:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800">
                                {isAiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                                Chuốt lại câu từ bằng AI
                            </Button>
                            <div className="space-y-2">
                                <Label>Đính kèm</Label>
                                <div className="flex flex-col sm:flex-row items-center gap-2">
                                    <Button asChild variant="outline" size="sm" className="w-full">
                                        <label htmlFor="file-upload"><Paperclip className="mr-2 h-4 w-4" />Chọn tệp</label>
                                    </Button>
                                    <input id="file-upload" type="file" multiple className="hidden" onChange={handleFileChange} />
                                    <Button variant="outline" size="sm" onClick={() => setIsCameraOpen(true)} className="w-full">
                                        <Camera className="mr-2 h-4 w-4" /> Chụp ảnh
                                    </Button>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {existingAttachments.map((att) => (
                                        <div key={att.url} className="relative w-20 h-20 group">
                                            {att.type.startsWith('image/') ? (
                                                <Image src={att.url} alt={att.name} fill className="object-cover rounded-md" />
                                            ) : (
                                                <div className="w-full h-full rounded-md bg-muted flex flex-col items-center justify-center p-1">
                                                    <FileIcon className="h-8 w-8 text-muted-foreground" />
                                                    <p className="text-xs text-muted-foreground text-center truncate">{att.name}</p>
                                                </div>
                                            )}
                                            <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-5 w-5 rounded-full" onClick={() => handleDeleteAttachment(att, true)}><X className="h-3 w-3" /></Button>
                                        </div>
                                    ))}
                                    {localAttachments.map((att) => (
                                        <div key={att.id} className="relative w-20 h-20 group">
                                            {att.file.type.startsWith('image/') || att.file.type.startsWith('video/') ? (
                                                <Image src={att.url} alt={att.file.name} fill className="object-cover rounded-md" />
                                            ) : (
                                                <div className="w-full h-full rounded-md bg-muted flex flex-col items-center justify-center p-1">
                                                    <FileIcon className="h-8 w-8 text-muted-foreground" />
                                                    <p className="text-xs text-muted-foreground text-center truncate">{att.file.name}</p>
                                                </div>
                                            )}
                                            <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-5 w-5 rounded-full" onClick={() => handleDeleteAttachment(att, false)}><X className="h-3 w-3" /></Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="flex-col sm:flex-row sm:justify-between items-center w-full p-4 border-t shrink-0">
                        <div className="flex flex-col sm:flex-col gap-y-2 gap-x-4 items-start w-full mb-4 sm:mb-0">
                            <div className="flex items-center space-x-2">
                                <Switch id="anonymous-mode" checked={isAnonymous} onCheckedChange={setIsAnonymous} />
                                <Label htmlFor="anonymous-mode" className="whitespace-normal">Gửi ẩn danh</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Switch id="visibility-mode" checked={visibility === 'private'} onCheckedChange={(checked) => setVisibility(checked ? 'private' : 'public')} />
                                <Label htmlFor="visibility-mode" className="whitespace-normal">Chỉ gửi cho Chủ nhà hàng</Label>
                            </div>
                        </div>
                        <div className="flex gap-2 self-end w-full sm:w-auto">
                            <Button variant="outline" onClick={onClose} disabled={isSaving} className="w-full sm:w-auto">Hủy</Button>
                            <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isEditMode ? 'Lưu thay đổi' : 'Gửi'}
                            </Button>
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
