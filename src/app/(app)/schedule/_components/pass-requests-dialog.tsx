
'use client';
import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { Schedule, ManagedUser, Notification, PassRequestPayload, AuthUser, UserRole, AssignedUser } from '@/lib/types';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { vi } from 'date-fns/locale';
import { AlertCircle, CheckCircle, XCircle, Undo, Info, UserCheck, Trash2, Calendar, Clock, User as UserIcon, Send, Loader2, UserCog, Replace, ChevronsDownUp, MailQuestion } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { dataStore } from '@/lib/data-store';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


type RequestCardProps = {
    notification: Notification;
    schedule: Schedule | null;
    currentUser: AuthUser;
    allUsers: ManagedUser[];
    isProcessing: boolean;
    onAccept: (notification: Notification) => void;
    onDecline: (notification: Notification) => void;
    onCancel: (notificationId: string) => void;
    onRevert: (notification: Notification) => void;
    onAssign: (notification: Notification) => void;
    onApprove: (notification: Notification) => void;
    onRejectApproval: (notificationId: string) => void;
    onDeleteHistory: (notificationId: string) => void;
};

const RequestCard = ({ notification, schedule, currentUser, allUsers, isProcessing, onAccept, onDecline, onCancel, onRevert, onAssign, onApprove, onRejectApproval, onDeleteHistory }: RequestCardProps) => {
    const { payload, status, createdAt, resolvedAt, resolvedBy } = notification;
    const { toast } = useToast();
    const isManagerOrOwner = currentUser.role === 'Quản lý' || currentUser.role === 'Chủ nhà hàng';

    const getStatusConfig = () => {
        switch (status) {
            case 'pending': return { text: 'Đang chờ', color: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700' };
            case 'pending_approval': return { text: 'Chờ duyệt', color: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700' };
            case 'resolved': return { text: 'Đã giải quyết', color: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700' };
            case 'cancelled': return { text: 'Đã huỷ', color: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700' };
            default: return { text: 'Không rõ', color: 'bg-gray-100 text-gray-800 border-gray-200' };
        }
    };

    const getTypeConfig = () => {
        if (payload.isSwapRequest) return { text: 'Đổi ca', icon: Replace, color: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-700' };
        if (payload.targetUserId) return { text: 'Nhờ nhận ca', icon: Send, color: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700' };
        return { text: 'Pass ca công khai', icon: MailQuestion, color: 'bg-gray-100 text-gray-800 border-gray-200' };
    };

    const statusConfig = getStatusConfig();
    const typeConfig = getTypeConfig();
    const TypeIcon = typeConfig.icon;

    const renderShiftInfo = (label: string, timeSlot: { start: string, end: string }, date: string) => (
        <div className="space-y-1 text-sm">
            <p className="font-semibold">{label}</p>
            <p className="text-muted-foreground"><Clock className="inline h-3 w-3 mr-1.5"/>{timeSlot.start} - {timeSlot.end}</p>
            <p className="text-muted-foreground"><Calendar className="inline h-3 w-3 mr-1.5"/>{format(parseISO(date), 'eeee, dd/MM/yyyy', { locale: vi })}</p>
        </div>
    );
    
    const renderUserBlock = (user: AssignedUser, label: string, shiftLabel: string, shiftTime: {start: string, end: string}, shiftDate: string) => (
        <div className="border p-3 rounded-lg bg-background flex-1 min-w-[200px]">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-bold text-lg">{user.userName}</p>
            {renderShiftInfo(shiftLabel, shiftTime, shiftDate)}
        </div>
    );

    const isMyRequest = payload.requestingUser.userId === currentUser.uid;
    const isDirectRequestToMe = status === 'pending' && payload.targetUserId === currentUser.uid;
    const isManagerReviewing = isManagerOrOwner && status === 'pending_approval';

    const renderActions = () => {
        // Priority 1: Direct requests to the current user
        if (isDirectRequestToMe) {
            return (
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="outline" size="sm" onClick={() => onDecline(notification)} disabled={isProcessing} className="flex-1"><XCircle className="mr-2 h-4 w-4"/>Từ chối</Button>
                    <Button size="sm" onClick={() => onAccept(notification)} disabled={isProcessing} className="flex-1">
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4"/>}
                        {payload.isSwapRequest ? 'Đổi ca' : 'Nhận ca'}
                    </Button>
                </div>
            );
        }
        
        // Priority 2: Manager's approval actions
        if (isManagerReviewing) {
            const canOwnerApprove = currentUser.role === 'Chủ nhà hàng';
            const isRequestInvolvingManager = allUsers.find(u => u.uid === payload.requestingUser.userId)?.role === 'Quản lý' || (payload.takenBy && allUsers.find(u => u.uid === payload.takenBy?.userId)?.role === 'Quản lý');
            const canManagerApprove = currentUser.role === 'Quản lý' && !isRequestInvolvingManager;
            if (canOwnerApprove || canManagerApprove) {
                 return (
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="destructive" size="sm" onClick={() => onRejectApproval(notification.id)} disabled={isProcessing} className="flex-1"><XCircle className="mr-2 h-4 w-4"/>Từ chối</Button>
                        <Button size="sm" onClick={() => onApprove(notification)} disabled={isProcessing} className="flex-1"><CheckCircle className="mr-2 h-4 w-4"/>Phê duyệt</Button>
                    </div>
                );
            }
        }
        
        // Priority 3: Public pending requests (for non-requesting staff)
        if (status === 'pending' && !isMyRequest && !payload.targetUserId) {
            return (
                 <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="outline" size="sm" onClick={() => onDecline(notification)} disabled={isProcessing} className="flex-1"><XCircle className="mr-2 h-4 w-4"/>Bỏ qua</Button>
                    <Button size="sm" onClick={() => onAccept(notification)} disabled={isProcessing} className="flex-1">
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4"/>}
                        Nhận ca
                    </Button>
                </div>
            )
        }
        
        // Priority 4: My own pending request
        if (status === 'pending' && isMyRequest) {
            return <Button variant="outline" size="sm" onClick={() => onCancel(notification.id)} disabled={isProcessing}>Hủy yêu cầu</Button>;
        }

        // Priority 5: Manager/Owner actions
        if(isManagerOrOwner) {
            if (status === 'pending') {
                 return (
                    <div className="flex gap-2 w-full sm:w-auto">
                         {currentUser.role === 'Chủ nhà hàng' && !payload.targetUserId && (
                            <Button variant="secondary" size="sm" onClick={() => onAssign(notification)} disabled={isProcessing} className="flex-1"><UserCheck className="mr-2 h-4 w-4"/>Chỉ định</Button>
                         )}
                        <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="destructive" size="sm" disabled={isProcessing} className="flex-1"><Trash2 className="mr-2 h-4 w-4"/>Hủy</Button></AlertDialogTrigger>
                            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hủy yêu cầu?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Không</AlertDialogCancel><AlertDialogAction onClick={() => onCancel(notification.id)}>Xác nhận Hủy</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                        </AlertDialog>
                    </div>
                );
            }
             if (status === 'resolved' && currentUser.role === 'Chủ nhà hàng') {
                return (
                    <div className="flex gap-2 w-full sm:w-auto">
                        <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="outline" size="sm" disabled={isProcessing}><Undo className="mr-2 h-4 w-4"/>Hoàn tác</Button></AlertDialogTrigger>
                            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hoàn tác yêu cầu?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Không</AlertDialogCancel><AlertDialogAction onClick={() => onRevert(notification)}>Xác nhận</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                        </AlertDialog>
                         <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive h-9 w-9"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Xóa khỏi lịch sử?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => onDeleteHistory(notification.id)}>Xóa</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                        </AlertDialog>
                    </div>
                );
            }
        }
        
        return null;
    }

    return (
        <Card className={cn("shadow-sm", statusConfig.color)}>
            <CardHeader className="p-3 pb-2 flex-row justify-between items-start">
                 <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={cn("pointer-events-none", typeConfig.color)}><TypeIcon className="h-3 w-3 mr-1.5"/>{typeConfig.text}</Badge>
                        <Badge className={cn("pointer-events-none", statusConfig.color)}>{statusConfig.text}</Badge>
                    </div>
                    {payload.isSwapRequest && (
                        <p className="font-semibold text-sm mt-2">{payload.requestingUser.userName} đổi ca với {payload.takenBy?.userName || payload.targetUserId && allUsers.find(u=>u.uid === payload.targetUserId)?.displayName || '??'}</p>
                    )}
                 </div>
                 <p className="text-xs text-muted-foreground whitespace-nowrap">{format(parseISO(createdAt as string), 'HH:mm, dd/MM')}</p>
            </CardHeader>
            <CardContent className="p-3 pt-0">
                <div className="flex flex-col md:flex-row gap-3">
                   {renderUserBlock(payload.requestingUser, "Người yêu cầu", payload.shiftLabel, payload.shiftTimeSlot, payload.shiftDate)}

                   {(payload.isSwapRequest && payload.targetUserShift) && <Replace className="h-6 w-6 text-muted-foreground mx-auto my-2 md:my-auto" />}

                   {(payload.isSwapRequest && payload.targetUserShift) && renderUserBlock(payload.takenBy || allUsers.find(u=>u.uid === payload.targetUserId)!, "Đổi với", payload.targetUserShift.label, payload.targetUserShift.timeSlot, payload.targetUserShift.date)}
                   
                   {(!payload.isSwapRequest && payload.takenBy) && renderUserBlock(payload.takenBy, "Người nhận", payload.shiftLabel, payload.shiftTimeSlot, payload.shiftDate)}
                </div>
                {(resolvedBy || payload.cancellationReason) && (
                    <div className="mt-2 text-xs text-muted-foreground border-t pt-2">
                        {resolvedBy && <p>Xử lý bởi: <span className="font-medium">{resolvedBy.userName}</span> lúc {format(parseISO(resolvedAt as string), 'HH:mm, dd/MM/yyyy')}</p>}
                        {payload.cancellationReason && <p>Lý do hủy: <span className="italic">{payload.cancellationReason}</span></p>}
                    </div>
                )}
            </CardContent>
            <CardFooter className="p-3 bg-muted/30 dark:bg-card/30 rounded-b-xl">
                {renderActions()}
            </CardFooter>
        </Card>
    );
};

type PassRequestsDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    notifications: Notification[];
    allUsers: ManagedUser[];
    weekInterval: { start: Date; end: Date };
    onAccept: (notification: Notification) => void;
    onDecline: (notification: Notification) => void;
    onCancel: (notificationId: string) => void;
    onRevert: (notification: Notification) => void;
    onAssign?: (notification: Notification) => void;
    onApprove: (notification: Notification) => void;
    onRejectApproval: (notificationId: string) => void;
    isProcessing: boolean;
    schedule: Schedule | null;
}


export default function PassRequestsDialog({
  isOpen,
  onClose,
  notifications,
  allUsers,
  weekInterval,
  onAccept,
  onDecline,
  onCancel,
  onRevert,
  onAssign = () => {},
  onApprove,
  onRejectApproval,
  isProcessing,
  schedule,
}: PassRequestsDialogProps) {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const isManagerOrOwner = currentUser?.role === 'Quản lý' || currentUser?.role === 'Chủ nhà hàng';

  const { pendingRequests, historicalRequests } = useMemo(() => {
    if (!currentUser) return { pendingRequests: [], historicalRequests: [] };
    
    const pending: Notification[] = [];
    const historical: Notification[] = [];

    const weekFilteredNotifications = notifications.filter(notification => {
        if (notification.type !== 'pass_request') return false;
        const shiftDate = parseISO(notification.payload.shiftDate);
        return isWithinInterval(shiftDate, weekInterval);
    });

    weekFilteredNotifications.forEach(notification => {
      const payload = notification.payload;
      const isMyRequest = payload.requestingUser.userId === currentUser.uid;
      const didITakeTheShift = payload.takenBy?.userId === currentUser.uid;
      const wasTargetedToMe = payload.targetUserId === currentUser.uid;

      if (notification.status === 'pending' || notification.status === 'pending_approval') {
        const isRequestInvolvingManager = allUsers.find(u => u.uid === payload.requestingUser.userId)?.role === 'Quản lý' || (payload.takenBy && allUsers.find(u => u.uid === payload.takenBy?.userId)?.role === 'Quản lý');

        if (notification.status === 'pending' && wasTargetedToMe) {
            pending.push(notification);
            return;
        }

        if (isManagerOrOwner) {
            if (currentUser.role === 'Chủ nhà hàng' || !isRequestInvolvingManager) {
                pending.push(notification);
                return;
            }
        }
        
        if (isMyRequest) {
           pending.push(notification);
           return;
        }

        if (notification.status === 'pending_approval' && didITakeTheShift) {
           pending.push(notification);
           return;
        }

        if (notification.status === 'pending') {
           const isPublicRequest = !payload.targetUserId;
           
           if (isPublicRequest) {
               const isDifferentRole = payload.shiftRole !== 'Bất kỳ' && currentUser.role !== payload.shiftRole && !currentUser.secondaryRoles?.includes(payload.shiftRole as UserRole);
               const hasDeclined = (payload.declinedBy || []).includes(currentUser.uid);
               if (!isDifferentRole && !hasDeclined) {
                   pending.push(notification);
               }
           }
        }
      } else {
        if (isManagerOrOwner) {
            historical.push(notification);
        } else {
            if (isMyRequest || didITakeTheShift || wasTargetedToMe) {
                historical.push(notification);
            }
        }
      }
    });

    pending.sort((a,b) => {
        const dateA = new Date(`${a.payload.shiftDate}T${a.payload.shiftTimeSlot.start}`);
        const dateB = new Date(`${b.payload.shiftDate}T${b.payload.shiftTimeSlot.end}`);
        return dateA.getTime() - dateB.getTime();
    });

    historical.sort((a,b) => {
        const timeA = a.resolvedAt || a.createdAt;
        const timeB = b.resolvedAt || b.createdAt;
        return new Date(timeB as string).getTime() - new Date(timeA as string).getTime();
    });

    return { pendingRequests: pending, historicalRequests: historical };
  }, [notifications, currentUser, allUsers, weekInterval, isManagerOrOwner]);
  
  const handleDeleteFromHistory = async (notificationId: string) => {
    if (currentUser?.role !== 'Chủ nhà hàng') return;
    try {
        await dataStore.deleteNotification(notificationId);
        toast({
            title: "Thành công",
            description: "Đã xóa yêu cầu khỏi lịch sử."
        });
    } catch(error) {
        toast({
            title: "Lỗi",
            description: "Không thể xóa yêu cầu.",
            variant: "destructive"
        });
    }
  }

  if (!currentUser) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-full md:h-[90vh] flex flex-col p-0 bg-white dark:bg-card">
        <DialogHeader className="p-4 sm:p-6 pb-2 border-b">
          <DialogTitle>Quản lý Yêu cầu Pass ca</DialogTitle>
          <DialogDescription>
            Tuần từ {format(weekInterval.start, 'dd/MM')} đến {format(weekInterval.end, 'dd/MM/yyyy')}.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="pending" className="flex-grow flex flex-col overflow-hidden px-4 sm:px-6">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="pending">
                    Đang chờ xử lý
                    {pendingRequests.length > 0 && <Badge variant="destructive" className="ml-2">{pendingRequests.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="history">Lịch sử</TabsTrigger>
            </TabsList>
            
            <TabsContent value="pending" className="flex-grow overflow-auto pt-4">
                 {pendingRequests.length > 0 ? (
                    <div className="space-y-4">
                        {pendingRequests.map(notification => (
                            <RequestCard
                                key={notification.id}
                                notification={notification}
                                schedule={schedule}
                                currentUser={currentUser}
                                allUsers={allUsers}
                                isProcessing={isProcessing}
                                onAccept={onAccept}
                                onDecline={onDecline}
                                onCancel={onCancel}
                                onRevert={onRevert}
                                onAssign={onAssign}
                                onApprove={onApprove}
                                onRejectApproval={onRejectApproval}
                                onDeleteHistory={handleDeleteFromHistory}
                            />
                        ))}
                    </div>
                 ) : (
                    <div className="text-center py-16 text-muted-foreground flex flex-col items-center gap-4">
                        <CheckCircle className="h-12 w-12 text-green-500"/>
                        <p>Không có yêu cầu nào đang chờ xử lý.</p>
                    </div>
                 )}
            </TabsContent>
            
            <TabsContent value="history" className="flex-grow overflow-auto pt-4">
                 {historicalRequests.length > 0 ? (
                    <div className="space-y-4">
                        {historicalRequests.map(notification => (
                             <RequestCard
                                key={notification.id}
                                notification={notification}
                                schedule={schedule}
                                currentUser={currentUser}
                                allUsers={allUsers}
                                isProcessing={isProcessing}
                                onAccept={onAccept}
                                onDecline={onDecline}
                                onCancel={onCancel}
                                onRevert={onRevert}
                                onAssign={onAssign}
                                onApprove={onApprove}
                                onRejectApproval={onRejectApproval}
                                onDeleteHistory={handleDeleteFromHistory}
                            />
                        ))}
                    </div>
                 ) : (
                    <div className="text-center py-16 text-muted-foreground flex flex-col items-center gap-4">
                        <Info className="h-12 w-12"/>
                        <p>Chưa có yêu cầu nào trong lịch sử.</p>
                    </div>
                 )}
            </TabsContent>

        </Tabs>
        <DialogFooter className="p-4 sm:p-6 border-t">
            <Button variant="outline" onClick={onClose}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
