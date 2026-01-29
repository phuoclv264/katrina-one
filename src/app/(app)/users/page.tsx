

'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRouter } from 'nextjs-toploader/app';
import { dataStore } from '@/lib/data-store';
import { toast } from '@/components/ui/pro-toast';
import type { ManagedUser, UserRole, AppSettings } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogIcon } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Users2, Trash2, Edit, Loader2, Settings, StickyNote, Search, FlaskConical } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Combobox } from '@/components/combobox';
import { Badge } from '@/components/ui/badge';
import { normalizeSearchString, cn } from '@/lib/utils';
import { AvatarUpload } from '@/components/avatar-upload';
import { UserAvatar as SharedUserAvatar } from '@/components/user-avatar';

const RoleBadge = ({ role, isSecondary = false }: { role: UserRole, isSecondary?: boolean }) => {
    const colors = {
        'Chủ nhà hàng': 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
        'Quản lý': 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800',
        'Pha chế': 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
        'Phục vụ': 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
        'Thu ngân': 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800',
    };

    return (
        <Badge 
            variant="outline" 
            className={cn(
                "font-medium",
                isSecondary ? "opacity-80 scale-95" : "shadow-sm",
                colors[role] || ""
            )}
        >
            {role}
        </Badge>
    );
};

const UserAvatar = ({ user, className, size }: { user: ManagedUser, className?: string, size?: string }) => (
    <SharedUserAvatar user={user} size={size || "h-9 w-9"} className={cn("border shadow-sm", className)} />
);

const TestBadge = () => (
    <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/50 flex items-center gap-1 font-bold py-0 h-5 px-1.5 text-[10px] uppercase tracking-wider shadow-sm">
        <FlaskConical className="h-2.5 w-2.5" />
        Test
    </Badge>
);


function EditUserDialog({ user, onSave, onOpenChange, open, isProcessing }: { user: ManagedUser, onSave: (data: Partial<ManagedUser>) => void, onOpenChange: (open: boolean) => void, open: boolean, isProcessing: boolean }) {
    const [displayName, setDisplayName] = useState(user.displayName);
    const [role, setRole] = useState<UserRole>(user.role);
    const [secondaryRoles, setSecondaryRoles] = useState<ManagedUser[]>([]);
    const [notes, setNotes] = useState(user.notes || '');
    const [photoURL, setPhotoURL] = useState(user.photoURL || null);
    const [isTestAccount, setIsTestAccount] = useState(user.isTestAccount || false);

    useEffect(() => {
        if (open) {
            setDisplayName(user.displayName);
            setRole(user.role);
            // This is a bit tricky. We need to create dummy ManagedUser objects for the multi-select.
            const secondaryRoleUsers = (user.secondaryRoles || []).map(r => ({ uid: r, displayName: r, email: '', role: r }));
            setSecondaryRoles(secondaryRoleUsers);
            setNotes(user.notes || '');
            setPhotoURL(user.photoURL || null);
            setIsTestAccount(user.isTestAccount || false);
        }
    }, [open, user]);

    const handleSave = () => {
        // If photoURL is explicitly null, send null to clear it. If it's a string, send it.
        // If it's undefined (no change), omit the field by passing undefined.
        const photoPayload = photoURL === null ? null : (photoURL ? photoURL : undefined);
        onSave({ 
            displayName, 
            role, 
            notes, 
            secondaryRoles: secondaryRoles.map(r => r.role), 
            photoURL: photoPayload,
            isTestAccount
        });
    };

    const roleOptions = [
        { uid: 'Phục vụ', displayName: 'Phục vụ', role: 'Phục vụ' },
        { uid: 'Pha chế', displayName: 'Pha chế', role: 'Pha chế' },
        { uid: 'Thu ngân', displayName: 'Thu ngân', role: 'Thu ngân' },
        { uid: 'Quản lý', displayName: 'Quản lý', role: 'Quản lý' },
    ] as ManagedUser[];


    return (
        <Dialog open={open} onOpenChange={onOpenChange} dialogTag="edit-user-dialog" parentDialogTag="root">
            <DialogContent className="max-w-lg p-0 overflow-hidden border-none sm:rounded-2xl">
                <DialogHeader iconkey='user' className="px-6 pt-8 pb-4 bg-muted/20">
                    <div className="flex items-center gap-4">
                        <UserAvatar user={user} className="h-14 w-14 ring-2 ring-primary/10 ring-offset-2" />
                        <div className="text-left space-y-0.5">
                            <DialogTitle className="text-xl font-bold tracking-tight">Thiết lập tài khoản</DialogTitle>
                            <DialogDescription className="text-sm font-medium break-all whitespace-normal max-w-full text-muted-foreground/80">
                                {user.displayName} • {user.email}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="px-6 py-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    {/* Identification Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                             <div className="h-1 w-8 bg-primary rounded-full" />
                             <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Thông tin cơ bản</span>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-sm font-semibold ml-1">Tên hiển thị</Label>
                                <Input 
                                    id="name" 
                                    value={displayName} 
                                    onChange={(e) => setDisplayName(e.target.value)} 
                                    className="h-11 rounded-xl bg-muted/50 border-muted-foreground/10 focus:bg-background transition-all"
                                    placeholder="Nhập tên nhân viên..."
                                    disabled={isProcessing}
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold ml-1">Ảnh đại diện</Label>
                                <div className="p-3 border rounded-xl bg-muted/30 border-dashed border-muted-foreground/20">
                                    <AvatarUpload
                                        currentPhotoURL={photoURL}
                                        onUploadComplete={setPhotoURL}
                                        uid={user.uid}
                                        displayName={user.displayName}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Roles Section */}
                    <div className="space-y-4 pt-2">
                        <div className="flex items-center gap-2 mb-2">
                             <div className="h-1 w-8 bg-primary rounded-full" />
                             <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Phân quyền & Vai trò</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="role" className="text-sm font-semibold ml-1 text-primary">Vai trò chính</Label>
                                <Combobox
                                    value={role}
                                    onChange={(value) => setRole(value as UserRole)}
                                    placeholder="Chọn vai trò"
                                    options={[
                                        { value: "Phục vụ", label: "Phục vụ" },
                                        { value: "Pha chế", label: "Pha chế" },
                                        { value: "Thu ngân", label: "Thu ngân" },
                                        { value: "Quản lý", label: "Quản lý" },
                                        { value: "Chủ nhà hàng", label: "Chủ nhà hàng" },
                                    ]}
                                    className="w-full h-11"
                                    disabled={isProcessing}
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="secondary-roles" className="text-sm font-semibold ml-1 text-muted-foreground">Vai trò phụ</Label>
                                <Combobox
                                    options={roleOptions
                                        .filter(r => r.role !== role)
                                        .map(r => ({ value: r.role, label: r.displayName }))}
                                    multiple
                                    value={secondaryRoles.map(r => r.role)}
                                    onChange={(next) => {
                                        const nextRoles = Array.isArray(next)
                                            ? next
                                            : typeof next === 'string' && next
                                                ? [next]
                                                : [];

                                        const nextUsers = nextRoles.map((roleValue) => {
                                            const existing = roleOptions.find(r => r.role === roleValue);
                                            if (existing) return existing;
                                            return { uid: roleValue, displayName: roleValue, email: '', role: roleValue as UserRole } as ManagedUser;
                                        });
                                        setSecondaryRoles(nextUsers);
                                    }}
                                    placeholder="Thêm vai trò..."
                                    searchPlaceholder="Tìm kiếm..."
                                    className="w-full h-11"
                                    disabled={isProcessing}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Advanced Section */}
                    <div className="space-y-4 pt-2">
                        <div className="flex items-center gap-2 mb-2">
                             <div className="h-1 w-8 bg-primary rounded-full" />
                             <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Khác</span>
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="notes" className="text-sm font-semibold ml-1">Ghi chú nội bộ</Label>
                            <Textarea 
                                id="notes" 
                                value={notes} 
                                onChange={(e) => setNotes(e.target.value)} 
                                className="min-h-[100px] rounded-xl bg-muted/50 border-muted-foreground/10 focus:bg-background transition-all resize-none" 
                                placeholder="Ghi chú về nhân viên, hiệu suất, v.v..." 
                                disabled={isProcessing}
                            />
                        </div>

                        <div className="group flex items-center justify-between rounded-xl border border-dashed border-orange-200 bg-orange-50/40 dark:bg-orange-950/5 dark:border-orange-900/20 p-4 transition-colors hover:bg-orange-50/60 dark:hover:bg-orange-950/10">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-orange-100 dark:bg-orange-900/30 rounded-full text-orange-600 dark:text-orange-400">
                                    <FlaskConical className="h-5 w-5" />
                                </div>
                                <div>
                                    <Label htmlFor="test-account-switch" className="font-bold text-orange-950 dark:text-orange-100 cursor-pointer">Tài khoản Thử nghiệm</Label>
                                    <p className="text-[11px] text-orange-700/70 dark:text-orange-400/70 leading-relaxed">
                                        Mở khóa các tính năng Beta và thông tin nhạy cảm.
                                    </p>
                                </div>
                            </div>
                            <Switch
                                id="test-account-switch"
                                checked={isTestAccount}
                                onCheckedChange={setIsTestAccount}
                                disabled={isProcessing}
                                className="data-[state=checked]:bg-orange-500"
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="px-6 py-4 bg-muted/20 border-t flex flex-row items-center justify-end gap-3">
                    <Button 
                        variant="ghost" 
                        onClick={() => onOpenChange(false)} 
                        disabled={isProcessing}
                        className="rounded-full px-6 font-semibold h-11"
                    >
                        Hủy bỏ
                    </Button>
                    <Button 
                        onClick={handleSave} 
                        disabled={isProcessing} 
                        className="rounded-full px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 h-11 min-w-[140px]"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Đang lưu...
                            </>
                        ) : (
                            'Lưu thay đổi'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function UsersPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const isMobile = useIsMobile();
    const [users, setUsers] = useState<ManagedUser[]>([]);
    const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [filterText, setFilterText] = useState('');

    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const handleDataRefresh = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
    }, []);

    const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    useEffect(() => {
        if (!authLoading) {
            if (!user || user.role !== 'Chủ nhà hàng') {
                router.replace('/');
            } else {
                let userSubscribed = false;

                const checkLoadingDone = () => {
                    if (userSubscribed) {
                        setIsLoading(false);
                    }
                }

                const unsubUsers = dataStore.subscribeToUsers((userList) => {
                    setUsers(userList);
                    userSubscribed = true;
                    checkLoadingDone();
                });
                const unsubSettings = dataStore.subscribeToAppSettings((settings) => {
                    setAppSettings(settings);
                });
                return () => {
                    unsubUsers();
                    unsubSettings();
                };
            }
        }
    }, [user, authLoading, router, refreshTrigger]);

    useDataRefresher(handleDataRefresh);

    const handleEditClick = (userToEdit: ManagedUser) => {
        setEditingUser(userToEdit);
        setIsEditDialogOpen(true);
    };

    const handleSaveChanges = async (data: Partial<ManagedUser>) => {
        if (!editingUser) return;
        setIsProcessing(true);
        try {
            await dataStore.updateUserData(editingUser.uid, data);
            toast.success("Đã cập nhật thông tin người dùng.");
        } catch (error) {
            console.error("Failed to update user:", error);
            toast.error("Không thể cập nhật thông tin người dùng.");
        } finally {
            setIsProcessing(false);
            setEditingUser(null);
            setIsEditDialogOpen(false);
        }
    };

    const handleDeleteUser = async (userToDelete: ManagedUser) => {
        if (userToDelete.uid === user?.uid) {
            toast.error("Bạn không thể xóa chính mình.");
            return;
        }
        setIsProcessing(true);
        try {
            await dataStore.deleteUser(userToDelete.uid);
            toast.success(`Đã xóa người dùng ${userToDelete.displayName}.`);
        } catch (error) {
            console.error("Failed to delete user:", error);
            toast.error("Không thể xóa người dùng.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRegistrationToggle = async (isEnabled: boolean) => {
        setAppSettings(prev => ({ ...prev!, isRegistrationEnabled: isEnabled })); // Optimistic update
        await dataStore.updateAppSettings({ isRegistrationEnabled: isEnabled });
        toast.success(`Đã ${isEnabled ? 'bật' : 'tắt'} tính năng đăng ký. Người dùng mới ${isEnabled ? 'có thể' : 'không thể'} tạo tài khoản.`);
    }

    const filteredUsers = useMemo(() => {
        if (!filterText) {
            return users;
        }
        const normalizedFilter = normalizeSearchString(filterText);
        return users.filter(u =>
            normalizeSearchString(u.displayName).includes(normalizedFilter) ||
            (u.email && normalizeSearchString(u.email).includes(normalizedFilter))
        );
    }, [users, filterText]);

    if (isLoading || authLoading) {
        return <LoadingPage />;
    }

    return (
        <div className="container mx-auto p-4 sm:p-6 md:p-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Users2 />
                    Quản lý Người dùng
                </h1>
                <p className="text-muted-foreground mt-2">
                    Xem, chỉnh sửa và quản lý tất cả các tài khoản người dùng trong hệ thống.
                </p>
            </header>

            <Card className="mb-8 border-primary/10 overflow-hidden">
                <div className="bg-primary/5 px-6 py-3 border-b border-primary/5 flex items-center gap-2">
                    <Settings className="h-4 w-4 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-widest text-primary/70">Cấu hình Hệ thống</span>
                </div>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between rounded-xl border bg-card p-5 shadow-sm transition-all hover:bg-muted/30">
                        <div className="space-y-1">
                            <Label htmlFor="registration-switch" className="text-base font-bold">Cổng đăng ký tài khoản</Label>
                            <p className="text-sm text-muted-foreground max-w-md">
                                Khi kích hoạt, nhân viên mới có thể tự tạo tài khoản qua trang đăng nhập.
                            </p>
                        </div>
                        <Switch
                            id="registration-switch"
                            checked={appSettings?.isRegistrationEnabled}
                            onCheckedChange={handleRegistrationToggle}
                            className="scale-110 data-[state=checked]:bg-primary"
                        />
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-lg border-muted/30">
                <CardHeader className="bg-muted/10 pb-6 border-b">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="space-y-1">
                            <CardTitle className="text-xl flex items-center gap-2">
                                <Users2 className="h-5 w-5 text-primary" />
                                Danh sách cộng sự
                            </CardTitle>
                            <CardDescription className="text-sm">
                                Hiện có <span className="font-bold text-foreground">{filteredUsers.length}</span> nhân sự trong hệ thống.
                            </CardDescription>
                        </div>
                        <div className="relative w-full md:max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                            <Input 
                                placeholder="Tìm theo tên, email, vai trò..." 
                                className="pl-10 h-11 w-full bg-background border-muted-foreground/20 focus:border-primary transition-all rounded-full shadow-sm" 
                                value={filterText} 
                                onChange={(e) => setFilterText(e.target.value)} 
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className='pt-4'>
                    {isMobile ? (
                        <div className="space-y-4">
                            {filteredUsers.length > 0 ? (
                                filteredUsers.map((u) => (
                                    <Card key={u.uid} className={cn("overflow-hidden group transition-all hover:shadow-md", isProcessing ? 'opacity-50 pointer-events-none' : '')}>
                                        <CardHeader className="pb-3 border-b bg-muted/30">
                                            <div className="flex items-center gap-3">
                                                <UserAvatar user={u} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <CardTitle className="text-base">{u.displayName}</CardTitle>
                                                        {u.isTestAccount && <TestBadge />}
                                                    </div>
                                                    <CardDescription className="text-xs break-words break-all whitespace-normal max-w-full">{u.email}</CardDescription>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="py-4 space-y-4">
                                            <div>
                                                <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">Vai trò</Label>
                                                <div className='flex flex-wrap gap-1.5'>
                                                    <RoleBadge role={u.role} />
                                                    {u.secondaryRoles?.map(role => <RoleBadge key={role} role={role} isSecondary />)}
                                                </div>
                                            </div>
                                            {u.notes && (
                                                <div className="bg-primary/5 rounded-md p-2.5 border border-primary/10">
                                                    <div className="flex items-start gap-2">
                                                        <StickyNote className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                                                        <p className="text-xs text-muted-foreground leading-relaxed italic">
                                                            {u.notes}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                        <CardFooter className="flex justify-end gap-2 bg-muted/20 border-t py-3">
                                            <Button variant="ghost" size="sm" className="h-8 px-3 transition-colors hover:bg-primary/10 hover:text-primary" onClick={() => handleEditClick(u)} disabled={isProcessing}>
                                                <Edit className="mr-2 h-3.5 w-3.5" /> Sửa
                                            </Button>
                                            <AlertDialog dialogTag="alert-dialog" parentDialogTag="root" variant="destructive">
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-8 px-3 text-destructive hover:text-destructive hover:bg-destructive/10" disabled={u.uid === user?.uid || isProcessing}>
                                                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Xóa
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl border-none shadow-2xl overflow-hidden p-0">
                                                    <div className="bg-destructive/10 p-6 flex flex-col items-center text-center space-y-3">
                                                        <div className="p-4 bg-destructive/20 rounded-full text-destructive">
                                                            <Trash2 className="h-8 w-8" />
                                                        </div>
                                                        <AlertDialogHeader className="space-y-1">
                                                            <AlertDialogTitle className="text-xl font-bold text-destructive">Xác nhận xóa tài khoản?</AlertDialogTitle>
                                                            <AlertDialogDescription className="text-sm font-medium text-destructive/70">
                                                                Hành động này không thể hoàn tác.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                    </div>
                                                    
                                                    <div className="p-6 text-center">
                                                         <p className="text-sm text-balance">
                                                            Tài khoản của <span className="font-bold text-foreground">{u.displayName}</span> sẽ bị gỡ bỏ vĩnh viễn khỏi hệ thống Katrina One.
                                                         </p>
                                                    </div>

                                                    <AlertDialogFooter className="p-4 bg-muted/30 flex sm:flex-row-reverse gap-2 border-t">
                                                        <AlertDialogAction 
                                                            onClick={() => handleDeleteUser(u)}
                                                            className="rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold h-11 px-8 min-w-[120px]"
                                                            disabled={isProcessing}
                                                            isLoading={isProcessing}
                                                        >
                                                            Xóa ngay
                                                        </AlertDialogAction>
                                                        <AlertDialogCancel 
                                                            className="rounded-full font-semibold h-11 px-6 border-none bg-transparent hover:bg-muted"
                                                            disabled={isProcessing}
                                                        >
                                                            Quay lại
                                                        </AlertDialogCancel>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </CardFooter>
                                    </Card>
                                ))
                            ) : (
                                <div className="text-center py-16 text-muted-foreground">
                                    <p>Không tìm thấy người dùng nào.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tên hiển thị</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Vai trò</TableHead>
                                        <TableHead>Ghi chú</TableHead>
                                        <TableHead className="text-right">Hành động</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUsers.map((u) => (
                                        <TableRow key={u.uid} className={cn("group hover:bg-muted/50 transition-colors", isProcessing ? 'opacity-50 pointer-events-none' : '')}>
                                            <TableCell className="py-4">
                                                <div className="flex items-center gap-3">
                                                    <UserAvatar user={u} />
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold text-sm">{u.displayName}</span>
                                                            {u.isTestAccount && <TestBadge />}
                                                        </div>
                                                        <span className="text-[11px] text-muted-foreground">{u.uid.substring(0, 8)}...</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                                            <TableCell>
                                                <div className='flex flex-wrap gap-1.5'>
                                                    <RoleBadge role={u.role} />
                                                    {u.secondaryRoles?.map(role => <RoleBadge key={role} role={role} isSecondary />)}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {u.notes ? (
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground italic max-w-[200px]">
                                                        <StickyNote className="h-3 w-3 shrink-0" />
                                                        <span>{u.notes}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground/30">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleEditClick(u)} disabled={isProcessing}>
                                                    <Edit className="h-4 w-4" />
                                                    <span className="sr-only">Sửa</span>
                                                </Button>
                                                <AlertDialog dialogTag="alert-dialog" parentDialogTag="root" variant="destructive">
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors" disabled={u.uid === user?.uid || isProcessing}>
                                                            <Trash2 className="h-4 w-4" />
                                                            <span className="sr-only">Xóa</span>
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="sm:max-w-md rounded-2xl border-none shadow-2xl overflow-hidden p-0">
                                                        <div className="bg-destructive/10 p-6 flex flex-col items-center text-center space-y-3">
                                                            <div className="p-4 bg-destructive/20 rounded-full text-destructive">
                                                                <Trash2 className="h-8 w-8" />
                                                            </div>
                                                            <AlertDialogHeader className="space-y-1">
                                                                <AlertDialogTitle className="text-xl font-bold text-destructive">Xác nhận xóa tài khoản?</AlertDialogTitle>
                                                                <AlertDialogDescription className="text-sm font-medium text-destructive/70">
                                                                    Hành động này không thể hoàn tác.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                        </div>
                                                        
                                                        <div className="p-6 text-center">
                                                            <p className="text-sm text-balance px-4 text-muted-foreground">
                                                                Tài khoản của <span className="font-bold text-foreground">{u.displayName}</span> sẽ bị gỡ bỏ vĩnh viễn khỏi hệ thống.
                                                            </p>
                                                        </div>

                                                        <AlertDialogFooter className="p-4 bg-muted/30 flex sm:flex-row-reverse gap-2 border-t">
                                                            <AlertDialogAction 
                                                                onClick={() => handleDeleteUser(u)}
                                                                className="rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold h-11 px-8 min-w-[120px]"
                                                                disabled={isProcessing}
                                                                isLoading={isProcessing}
                                                            >
                                                                Xác nhận xóa
                                                            </AlertDialogAction>
                                                            <AlertDialogCancel 
                                                                className="rounded-full font-semibold h-11 px-6 border-none bg-transparent hover:bg-muted"
                                                                disabled={isProcessing}
                                                            >
                                                                Quay lại
                                                            </AlertDialogCancel>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredUsers.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center">Không tìm thấy người dùng nào.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                    {isProcessing && <div className="absolute inset-0 bg-white/70 dark:bg-black/70 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}
                </CardContent>
            </Card>

            {editingUser && (
                <EditUserDialog
                    user={editingUser}
                    open={isEditDialogOpen}
                    onOpenChange={setIsEditDialogOpen}
                    onSave={handleSaveChanges}
                    isProcessing={isProcessing}
                />
            )}
        </div>
    );
}
