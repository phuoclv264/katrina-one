

'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import { useToast } from '@/hooks/use-toast';
import type { ManagedUser, UserRole, AppSettings } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users2, Trash2, Edit, Loader2, Settings } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { UserMultiSelect } from '@/components/user-multi-select';
import { Badge } from '@/components/ui/badge';


function EditUserDialog({ user, onSave, onOpenChange, open }: { user: ManagedUser, onSave: (data: Partial<ManagedUser>) => void, onOpenChange: (open: boolean) => void, open: boolean }) {
    const [displayName, setDisplayName] = useState(user.displayName);
    const [role, setRole] = useState<UserRole>(user.role);
    const [secondaryRoles, setSecondaryRoles] = useState<ManagedUser[]>([]);
    const [notes, setNotes] = useState(user.notes || '');

    useEffect(() => {
        if(open) {
            setDisplayName(user.displayName);
            setRole(user.role);
            // This is a bit tricky. We need to create dummy ManagedUser objects for the multi-select.
            const secondaryRoleUsers = (user.secondaryRoles || []).map(r => ({ uid: r, displayName: r, email: '', role: r }));
            setSecondaryRoles(secondaryRoleUsers);
            setNotes(user.notes || '');
        }
    }, [open, user]);

    const handleSave = () => {
        onSave({ displayName, role, notes, secondaryRoles: secondaryRoles.map(r => r.role) });
        onOpenChange(false);
    };

    const roleOptions = [
        { uid: 'Phục vụ', displayName: 'Phục vụ', role: 'Phục vụ' },
        { uid: 'Pha chế', displayName: 'Pha chế', role: 'Pha chế' },
        { uid: 'Thu ngân', displayName: 'Thu ngân', role: 'Thu ngân' },
        { uid: 'Quản lý', displayName: 'Quản lý', role: 'Quản lý' },
    ] as ManagedUser[];


    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Chỉnh sửa thông tin người dùng</DialogTitle>
                    <DialogDescription>
                        Thực hiện các thay đổi cho tài khoản của {user.displayName}.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="email" className="text-right">Email</Label>
                        <Input id="email" value={user.email} disabled className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">Tên hiển thị</Label>
                        <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="role" className="text-right">Vai trò chính</Label>
                         <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Chọn vai trò" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Phục vụ">Phục vụ</SelectItem>
                                <SelectItem value="Pha chế">Pha chế</SelectItem>
                                <SelectItem value="Thu ngân">Thu ngân</SelectItem>
                                <SelectItem value="Quản lý">Quản lý</SelectItem>
                                <SelectItem value="Chủ nhà hàng">Chủ nhà hàng</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-start gap-4">
                        <Label htmlFor="secondary-roles" className="text-right pt-2">
                        Vai trò phụ
                        </Label>
                        <UserMultiSelect
                            users={roleOptions.filter(r => r.role !== role)}
                            selectedUsers={secondaryRoles}
                            onChange={setSecondaryRoles}
                            className="col-span-3"
                        />
                    </div>
                     <div className="grid grid-cols-4 items-start gap-4">
                        <Label htmlFor="notes" className="text-right mt-2">Ghi chú</Label>
                        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="col-span-3" placeholder="Thêm ghi chú về người dùng này..." />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
                    <Button onClick={handleSave}>Lưu thay đổi</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function UsersPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [users, setUsers] = useState<ManagedUser[]>([]);
    const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    
    const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    useEffect(() => {
        if (!authLoading) {
            if (!user || user.role !== 'Chủ nhà hàng') {
                router.replace('/');
            } else {
                let userSubscribed = false;
                let settingsSubscribed = false;

                const checkLoadingDone = () => {
                    if (userSubscribed && settingsSubscribed) {
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
                    settingsSubscribed = true;
                    checkLoadingDone();
                });
                return () => {
                    unsubUsers();
                    unsubSettings();
                };
            }
        }
    }, [user, authLoading, router]);
    
    const handleEditClick = (userToEdit: ManagedUser) => {
        setEditingUser(userToEdit);
        setIsEditDialogOpen(true);
    };
    
    const handleSaveChanges = async (data: Partial<ManagedUser>) => {
        if (!editingUser) return;
        setIsProcessing(true);
        try {
            await dataStore.updateUserData(editingUser.uid, data);
            toast({ title: "Thành công", description: "Đã cập nhật thông tin người dùng." });
        } catch(error) {
            console.error("Failed to update user:", error);
            toast({ title: "Lỗi", description: "Không thể cập nhật thông tin người dùng.", variant: "destructive" });
        } finally {
            setIsProcessing(false);
            setEditingUser(null);
            setIsEditDialogOpen(false);
        }
    };
    
    const handleDeleteUser = async (userToDelete: ManagedUser) => {
        if (userToDelete.uid === user?.uid) {
            toast({ title: "Lỗi", description: "Bạn không thể xóa chính mình.", variant: "destructive" });
            return;
        }
        setIsProcessing(true);
        try {
            await dataStore.deleteUser(userToDelete.uid);
            toast({ title: "Đã xóa", description: `Đã xóa người dùng ${userToDelete.displayName}.` });
        } catch(error) {
            console.error("Failed to delete user:", error);
            toast({ title: "Lỗi", description: "Không thể xóa người dùng.", variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRegistrationToggle = async (isEnabled: boolean) => {
        setAppSettings(prev => ({...prev!, isRegistrationEnabled: isEnabled})); // Optimistic update
        await dataStore.updateAppSettings({ isRegistrationEnabled: isEnabled });
        toast({
            title: `Đã ${isEnabled ? 'bật' : 'tắt'} tính năng đăng ký`,
            description: `Người dùng mới ${isEnabled ? 'có thể' : 'không thể'} tạo tài khoản.`,
        })
    }
    
    if(isLoading || authLoading) {
        return (
            <div className="container mx-auto p-4 sm:p-6 md:p-8">
                <header className="mb-8">
                    <Skeleton className="h-10 w-1/2" />
                    <Skeleton className="h-4 w-1/3 mt-2" />
                </header>
                 <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-1/3" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </CardContent>
                </Card>
            </div>
          )
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

            <Card className="mb-8">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Settings /> Cài đặt hệ thống</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                            <Label htmlFor="registration-switch" className="font-semibold">Cho phép đăng ký tài khoản mới</Label>
                            <p className="text-sm text-muted-foreground">
                                Khi tắt, người dùng mới sẽ không thể tự tạo tài khoản.
                            </p>
                        </div>
                        <Switch
                            id="registration-switch"
                            checked={appSettings?.isRegistrationEnabled}
                            onCheckedChange={handleRegistrationToggle}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Danh sách người dùng</CardTitle>
                    <CardDescription>
                        Hiện có {users.length} tài khoản trong hệ thống.
                    </CardDescription>
                </CardHeader>
                <CardContent>
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
                                {users.map((u) => (
                                    <TableRow key={u.uid} className={isProcessing ? 'opacity-50 pointer-events-none' : ''}>
                                        <TableCell className="font-medium">{u.displayName}</TableCell>
                                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                                        <TableCell>
                                            <div className='flex flex-wrap gap-1'>
                                                <Badge>{u.role}</Badge>
                                                {u.secondaryRoles?.map(role => <Badge key={role} variant="secondary">{role}</Badge>)}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground italic max-w-xs truncate">{u.notes || '...'}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="mr-2" onClick={() => handleEditClick(u)} disabled={isProcessing}>
                                                <Edit className="h-4 w-4" />
                                                <span className="sr-only">Sửa</span>
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={u.uid === user?.uid || isProcessing}>
                                                        <Trash2 className="h-4 w-4" />
                                                        <span className="sr-only">Xóa</span>
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Hành động này sẽ xóa thông tin của người dùng <span className="font-bold">{u.displayName}</span> khỏi hệ thống. Người dùng này sẽ không thể đăng nhập được nữa. Hành động này không thể được hoàn tác.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteUser(u)}>Xác nhận Xóa</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    {isProcessing && <div className="absolute inset-0 bg-white/70 dark:bg-black/70 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin"/></div>}
                </CardContent>
            </Card>
            
            {editingUser && (
                <EditUserDialog 
                    user={editingUser}
                    open={isEditDialogOpen}
                    onOpenChange={setIsEditDialogOpen}
                    onSave={handleSaveChanges}
                />
            )}
        </div>
    );
}
