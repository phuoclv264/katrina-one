

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, AlertTriangle, CheckCircle, UserCheck, Trash2, Undo, Loader2, MailQuestion } from 'lucide-react';
import type { Notification, ManagedUser, PassRequestPayload, AssignedShift } from '@/lib/types';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import AssignUserDialog from './_components/assign-user-dialog';

export default function NotificationsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);

    const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
    const [notificationToAssign, setNotificationToAssign] = useState<Notification | null>(null);

    useEffect(() => {
        if (!authLoading && user?.role !== 'Chủ nhà hàng') {
            router.replace('/');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (!user) return;
        const unsubNotifications = dataStore.subscribeToAllNotifications(setNotifications);
        const unsubUsers = dataStore.subscribeToUsers(setAllUsers);
        
        Promise.all([
            new Promise(resolve => setTimeout(() => resolve(true), 500)) 
        ]).then(() => setIsLoading(false));

        return () => {
            unsubNotifications();
            unsubUsers();
        };
    }, [user]);
    
    const passRequestNotifications = useMemo(() => {
        return notifications.filter(n => n.type === 'pass_request');
    }, [notifications]);

    const { pendingRequests, completedRequests } = useMemo(() => {
        const pending = passRequestNotifications.filter(n => n.status === 'pending');
        const completed = passRequestNotifications.filter(n => n.status === 'resolved' || n.status === 'cancelled');

        pending.sort((a,b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
        completed.sort((a,b) => {
            const timeA = a.resolvedAt || a.createdAt;
            const timeB = b.resolvedAt || b.createdAt;
            return new Date(timeB as string).getTime() - new Date(timeA as string).getTime()
        });
        
        return { pendingRequests: pending, completedRequests: completed };
    }, [passRequestNotifications]);

    const handleCancelRequest = async (notificationId: string) => {
        setIsProcessing(`cancel-${notificationId}`);
        try {
            await dataStore.updateNotificationStatus(notificationId, 'cancelled');
            toast({ title: 'Thành công', description: 'Đã hủy yêu cầu pass ca.'});
        } catch (error) {
            console.error(error);
            toast({ title: 'Lỗi', description: 'Không thể hủy yêu cầu.', variant: 'destructive'});
        } finally {
            setIsProcessing(null);
        }
    };
    
    const handleRevertRequest = async (notification: Notification) => {
        setIsProcessing(`revert-${notification.id}`);
        try {
            await dataStore.revertPassRequest(notification);
            toast({ title: 'Thành công', description: 'Đã hoàn tác yêu cầu pass ca thành công.'});
        } catch (error) {
            console.error(error);
            toast({ title: 'Lỗi', description: 'Không thể hoàn tác yêu cầu.', variant: 'destructive'});
        } finally {
            setIsProcessing(null);
        }
    };

    const handleAssignUser = async (userToAssign: ManagedUser) => {
        if (!notificationToAssign) return;
        
        setIsProcessing(`assign-${notificationToAssign.id}`);
        setIsAssignDialogOpen(false);
        try {
            await dataStore.assignUserToShift(notificationToAssign, userToAssign);
            toast({ title: 'Thành công', description: `Đã chỉ định ${userToAssign.displayName} vào ca thành công.`});
        } catch (error) {
            console.error("Failed to assign user:", error);
            toast({ title: 'Lỗi', description: 'Không thể chỉ định nhân viên.', variant: 'destructive'});
        } finally {
             setIsProcessing(null);
             setNotificationToAssign(null);
        }
    }


    if (isLoading || authLoading) {
        return (
             <div className="container mx-auto p-4 sm:p-6 md:p-8">
                <Skeleton className="h-10 w-1/2 mb-2" />
                <Skeleton className="h-4 w-1/3 mb-8" />
                <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
            </div>
        );
    }
    
    return (
        <>
            <div className="container mx-auto p-4 sm:p-6 md:p-8">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <Bell /> Trung tâm Thông báo
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Quản lý các yêu cầu pass ca và các thông báo quan trọng khác.
                    </p>
                </header>

                <div className="space-y-8">
                    {/* Pending Requests */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><AlertTriangle className="text-yellow-500"/> Yêu cầu đang chờ</CardTitle>
                            <CardDescription>Các yêu cầu pass ca đang chờ xử lý. Bạn có thể hủy, hoặc chỉ định người thay thế.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {pendingRequests.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">Không có yêu cầu nào đang chờ.</p>
                            ) : (
                                pendingRequests.map(notification => {
                                    const payload = notification.payload;
                                    return (
                                     <div key={notification.id} className={`p-4 border rounded-lg ${isProcessing === `cancel-${notification.id}` || isProcessing === `assign-${notification.id}` ? 'opacity-50' : ''}`}>
                                        <p className="font-semibold">{payload.requestingUser.userName} muốn pass ca</p>
                                        <p className="text-sm text-muted-foreground">{payload.shiftLabel} ({payload.shiftTimeSlot.start}-{payload.shiftTimeSlot.end}) - {format(new Date(payload.shiftDate), "eeee, dd/MM/yyyy", { locale: vi })}</p>
                                        <p className="text-xs text-muted-foreground mt-1">Gửi lúc: {format(new Date(notification.createdAt as string), "HH:mm, dd/MM/yyyy")}</p>
                                        <div className="flex flex-wrap gap-2 mt-3">
                                             <Button size="sm" variant="secondary" onClick={() => setNotificationToAssign(notification)}>
                                                <UserCheck className="mr-2 h-4 w-4"/> Chỉ định
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button size="sm" variant="destructive">
                                                        <Trash2 className="mr-2 h-4 w-4"/> Hủy yêu cầu
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Hủy yêu cầu pass ca?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Hành động này sẽ hủy yêu cầu của {payload.requestingUser.userName}. Nhân viên này sẽ tiếp tục chịu trách nhiệm cho ca làm việc.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Không</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleCancelRequest(notification.id)}>Xác nhận Hủy</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>
                                )})
                            )}
                        </CardContent>
                    </Card>

                    {/* Completed Requests */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><CheckCircle className="text-green-500"/> Lịch sử Pass ca</CardTitle>
                            <CardDescription>Các yêu cầu đã có người nhận hoặc đã bị hủy. Bạn có thể xem lại hoặc hoàn tác nếu cần.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             {completedRequests.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">Chưa có lịch sử pass ca nào.</p>
                            ) : (
                                completedRequests.map(notification => {
                                    const payload = notification.payload;
                                    const timeToShow = (notification.status === 'resolved' ? notification.resolvedAt : notification.createdAt) as string;
                                    return (
                                     <div key={notification.id} className={`p-4 border rounded-lg ${isProcessing === `revert-${notification.id}` ? 'opacity-50' : ''}`}>
                                        <p className="font-semibold">{payload.shiftLabel} ({payload.shiftTimeSlot.start}-{payload.shiftTimeSlot.end}) - {format(new Date(payload.shiftDate), "dd/MM/yyyy")}</p>
                                        <p className="text-sm text-muted-foreground">
                                           {notification.status === 'resolved' ? (
                                             <>
                                                <span className="font-medium">{payload.requestingUser.userName}</span> đã pass cho <span className="font-medium">{payload.takenBy?.userName || 'Không rõ'}</span>
                                             </>
                                           ) : (
                                                `Yêu cầu của ${payload.requestingUser.userName} đã bị hủy`
                                           )}
                                        </p>
                                         <p className="text-xs text-muted-foreground mt-1">Thời gian: {format(new Date(timeToShow), "HH:mm, dd/MM/yyyy")}</p>
                                        {notification.status === 'resolved' && (
                                            <div className="flex gap-2 mt-3">
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button size="sm" variant="outline">
                                                            <Undo className="mr-2 h-4 w-4"/> Hoàn tác
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Hoàn tác yêu cầu?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Hành động này sẽ gán ca làm việc trở lại cho nhân viên ban đầu ({payload.requestingUser.userName}) và đặt lại trạng thái yêu cầu này.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Không</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleRevertRequest(notification)}>Xác nhận Hoàn tác</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        )}
                                    </div>
                                )})
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
            
            {notificationToAssign && (
                 <AssignUserDialog
                    isOpen={!!notificationToAssign}
                    onClose={() => setNotificationToAssign(null)}
                    notification={notificationToAssign}
                    allUsers={allUsers}
                    onSave={handleAssignUser}
                />
            )}
        </>
    );
}
