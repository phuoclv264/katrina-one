
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
import type { Schedule, ManagedUser, PassRequest, AssignedShift } from '@/lib/types';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import AssignUserDialog from './_components/assign-user-dialog';

export default function NotificationsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState<string | null>(null); // Use a unique ID for processing state

    const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
    const [shiftToAssign, setShiftToAssign] = useState<{ shift: AssignedShift; weekId: string, passRequest: PassRequest } | null>(null);

    useEffect(() => {
        if (!authLoading && user?.role !== 'Chủ nhà hàng') {
            router.replace('/');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (!user) return;
        const unsubSchedules = dataStore.subscribeToAllSchedules(setSchedules);
        const unsubUsers = dataStore.subscribeToUsers(setAllUsers);
        
        Promise.all([
            new Promise(resolve => setTimeout(() => resolve(true), 500)) // Initial loading feel
        ]).then(() => setIsLoading(false));

        return () => {
            unsubSchedules();
            unsubUsers();
        };
    }, [user]);

    const { pendingRequests, completedRequests } = useMemo(() => {
        const pending: { shift: AssignedShift; weekId: string, passRequest: PassRequest }[] = [];
        const completed: { shift: AssignedShift; weekId: string, passRequest: PassRequest }[] = [];
        
        schedules.forEach(schedule => {
            schedule.shifts.forEach(shift => {
                shift.passRequests?.forEach(pr => {
                    const requestData = { shift, weekId: schedule.weekId, passRequest: pr };
                    if (pr.status === 'pending') {
                        pending.push(requestData);
                    } else if (pr.status === 'taken') {
                        completed.push(requestData);
                    }
                });
            });
        });
        
        pending.sort((a,b) => new Date(b.passRequest.timestamp as string).getTime() - new Date(a.passRequest.timestamp as string).getTime());
        completed.sort((a,b) => new Date(b.passRequest.timestamp as string).getTime() - new Date(a.passRequest.timestamp as string).getTime());
        
        return { pendingRequests: pending, completedRequests: completed };
    }, [schedules]);

    const handleCancelRequest = async (weekId: string, shiftId: string, requestingUserId: string) => {
        setIsProcessing(`cancel-${shiftId}`);
        try {
            await dataStore.cancelPassRequestByOwner(weekId, shiftId, requestingUserId);
            toast({ title: 'Thành công', description: 'Đã hủy yêu cầu pass ca.'});
        } catch (error) {
            console.error(error);
            toast({ title: 'Lỗi', description: 'Không thể hủy yêu cầu.', variant: 'destructive'});
        } finally {
            setIsProcessing(null);
        }
    };
    
    const handleRevertRequest = async (weekId: string, shiftId: string, passRequest: PassRequest) => {
        setIsProcessing(`revert-${shiftId}`);
        try {
            await dataStore.revertPassRequest(weekId, shiftId, passRequest);
            toast({ title: 'Thành công', description: 'Đã hoàn tác yêu cầu pass ca thành công.'});
        } catch (error) {
            console.error(error);
            toast({ title: 'Lỗi', description: 'Không thể hoàn tác yêu cầu.', variant: 'destructive'});
        } finally {
            setIsProcessing(null);
        }
    };

    const handleAssignUser = async (userToAssign: ManagedUser) => {
        if (!shiftToAssign) return;
        const { weekId, shift, passRequest } = shiftToAssign;
        
        setIsProcessing(`assign-${shift.id}`);
        setIsAssignDialogOpen(false);
        try {
            await dataStore.assignUserToShift(weekId, shift.id, { userId: userToAssign.uid, userName: userToAssign.displayName }, passRequest);
            toast({ title: 'Thành công', description: `Đã chỉ định ${userToAssign.displayName} vào ca thành công.`});
        } catch (error) {
            console.error("Failed to assign user:", error);
            toast({ title: 'Lỗi', description: 'Không thể chỉ định nhân viên.', variant: 'destructive'});
        } finally {
             setIsProcessing(null);
             setShiftToAssign(null);
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
                                pendingRequests.map(({ shift, weekId, passRequest }) => (
                                    <div key={`${shift.id}-${passRequest.requestingUser.userId}`} className={`p-4 border rounded-lg ${isProcessing === `cancel-${shift.id}` || isProcessing === `assign-${shift.id}` ? 'opacity-50' : ''}`}>
                                        <p className="font-semibold">{passRequest.requestingUser.userName} muốn pass ca</p>
                                        <p className="text-sm text-muted-foreground">{shift.label} ({shift.timeSlot.start}-{shift.timeSlot.end}) - {format(new Date(shift.date), "eeee, dd/MM/yyyy", { locale: vi })}</p>
                                        <p className="text-xs text-muted-foreground mt-1">Gửi lúc: {format(new Date(passRequest.timestamp as string), "HH:mm, dd/MM/yyyy")}</p>
                                        <div className="flex flex-wrap gap-2 mt-3">
                                             <Button size="sm" variant="secondary" onClick={() => setShiftToAssign({ shift, weekId, passRequest })}>
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
                                                            Hành động này sẽ xóa yêu cầu của {passRequest.requestingUser.userName}. Nhân viên này sẽ tiếp tục chịu trách nhiệm cho ca làm việc.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Không</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleCancelRequest(weekId, shift.id, passRequest.requestingUser.userId)}>Xác nhận Hủy</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    {/* Completed Requests */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><CheckCircle className="text-green-500"/> Lịch sử Pass ca</CardTitle>
                            <CardDescription>Các yêu cầu đã có người nhận. Bạn có thể xem lại hoặc hoàn tác nếu cần.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             {completedRequests.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">Chưa có lịch sử pass ca nào.</p>
                            ) : (
                                completedRequests.map(({ shift, weekId, passRequest }) => (
                                     <div key={`${shift.id}-${passRequest.requestingUser.userId}`} className={`p-4 border rounded-lg ${isProcessing === `revert-${shift.id}` ? 'opacity-50' : ''}`}>
                                        <p className="font-semibold">{shift.label} ({shift.timeSlot.start}-{shift.timeSlot.end}) - {format(new Date(shift.date), "dd/MM/yyyy")}</p>
                                        <p className="text-sm text-muted-foreground">
                                            <span className="font-medium">{passRequest.requestingUser.userName}</span> đã pass cho <span className="font-medium">{passRequest.takenBy?.userName || 'Không rõ'}</span>
                                        </p>
                                         <p className="text-xs text-muted-foreground mt-1">Thời gian: {format(new Date(passRequest.timestamp as string), "HH:mm, dd/MM/yyyy")}</p>
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
                                                            Hành động này sẽ gán ca làm việc trở lại cho nhân viên ban đầu ({passRequest.requestingUser.userName}) và xóa yêu cầu này khỏi lịch sử.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Không</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleRevertRequest(weekId, shift.id, passRequest)}>Xác nhận Hoàn tác</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
            
            {shiftToAssign && (
                 <AssignUserDialog
                    isOpen={!!shiftToAssign}
                    onClose={() => setShiftToAssign(null)}
                    shift={shiftToAssign.shift}
                    allUsers={allUsers}
                    onSave={handleAssignUser}
                />
            )}
        </>
    );
}
