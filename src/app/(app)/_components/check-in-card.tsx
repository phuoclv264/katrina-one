'use client';
import { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogOverlay, AlertDialogIcon } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import type { AssignedShift, AttendanceRecord } from '@/lib/types';
import { Camera, CheckCircle, Loader2, Info, Clock, X, History, AlertTriangle, Coffee, LogOut, Play, Pause, ArrowRight, ArrowLeft, ChevronRight, User as UserIcon, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import LateReasonDialog from '@/components/late-reason-dialog';
import OffShiftReasonDialog from '@/components/off-shift-reason-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogBody, DialogCancel } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { vi } from 'date-fns/locale';
import { format, getISOWeek } from 'date-fns';
import { dataStore } from '@/lib/data-store';
import CameraDialog from '@/components/camera-dialog';
import { toast } from "@/components/ui/pro-toast"
import Image from '@/components/ui/image';
import { useLightbox } from '@/contexts/lightbox-context';
import { Timestamp } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { photoStore } from '@/lib/photo-store';
import { isToday } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import WorkHistoryDialog from './work-history-dialog';

export default function CheckInCard() {
    const { user, loading: authLoading, activeShifts, todaysShifts } = useAuth();
    const [activeShift, setActiveShift] = useState<AssignedShift | null>(null);
    const [latestInProgressRecord, setLatestInProgressRecord] = useState<AttendanceRecord | null>(null);
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    const [cameraAction, setCameraAction] = useState<'check-in-out' | 'break' | 'late-request'>('check-in-out');
    const [showOldShiftAlert, setShowOldShiftAlert] = useState(false);
    const [isOffShiftReasonDialogOpen, setIsOffShiftReasonDialogOpen] = useState(false);
    const [offShiftReason, setOffShiftReason] = useState('');

    const [isLateReasonDialogOpen, setIsLateReasonDialogOpen] = useState(false);
    const [lateReason, setLateReason] = useState('');
    const [estimatedLateMinutes, setEstimatedLateMinutes] = useState<number | string>('');
    const [lateReasonPhotoId, setLateReasonPhotoId] = useState<string | null>(null);
    const [lateReasonPhotoUrl, setLateReasonPhotoUrl] = useState<string | null>(null);
    const [lateReasonMediaType, setLateReasonMediaType] = useState<'photo' | 'video' | null>(null);
    const { openLightbox } = useLightbox();

    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isWorkHistoryOpen, setIsWorkHistoryOpen] = useState(false);
    const [checkInPhotoUrl, setCheckInPhotoUrl] = useState<string | null>(null);

    const [currentTime, setCurrentTime] = useState(new Date());

    const fileInputRef = useRef<HTMLInputElement>(null);

    // The active shift is now derived from the useAuth hook
    useEffect(() => {
        // The useAuth hook provides an array of currently active shifts. We'll use the first one for the check-in card.
        setActiveShift(activeShifts.length > 0 ? activeShifts[0] : null);
    }, [activeShifts]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000 * 60);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (latestInProgressRecord?.photoInUrl) {
            setCheckInPhotoUrl(latestInProgressRecord.photoInUrl);
        } else {
            setCheckInPhotoUrl(null);
        }
    }, [latestInProgressRecord]);

    useEffect(() => {
        let isMounted = true;
        if (lateReasonPhotoId) {
            photoStore.getPhotosAsUrls([lateReasonPhotoId]).then(urlMap => {
                if (isMounted) {
                    setLateReasonPhotoUrl(urlMap.get(lateReasonPhotoId) || null);
                }
            });
        } else {
            setLateReasonPhotoUrl(null);
        }
        return () => { isMounted = false; };
    }, [lateReasonPhotoId]);

    useEffect(() => {
        if (!user || authLoading) return;

        setIsLoading(true);

        let unsubLatest: (() => void) | null = null;
        let unsubToday: (() => void) | null = null;

        // Subscribe to the single latest "in-progress" record to determine status
        unsubLatest = dataStore.subscribeToLatestInProgressAttendanceRecord(user.uid, (record) => {
            setLatestInProgressRecord(record);
            setIsLoading(false); // Considered loaded once we have attendance status
        });

        // Subscribe to all of today's records for history display
        unsubToday = dataStore.subscribeToUserAttendanceForToday(user.uid, (records) => {
            setAttendanceRecords(records);
        });

        return () => {
            if (unsubLatest) unsubLatest();
            if (unsubToday) unsubToday();
        };

    }, [user, authLoading]);

    const handleCheckInOrOut = () => {
        if (!latestInProgressRecord && !activeShift) {
            setCameraAction('check-in-out'); // It's still a form of check-in
            setOffShiftReason(''); // Reset reason
            setIsOffShiftReasonDialogOpen(true);
        } else {
            if (latestInProgressRecord?.checkInTime) {
                const checkInDate = (latestInProgressRecord.checkInTime as Timestamp).toDate();
                if (!isToday(checkInDate)) {
                    setShowOldShiftAlert(true);
                    return;
                }
            }
            setCameraAction('check-in-out');
            setIsCameraOpen(true);
        }
    };

    const handleReasonSubmit = () => {
        if (!offShiftReason.trim()) {
            toast.error('Vui lòng nhập lý do chấm công ngoài giờ.');
            return;
        }
        setIsOffShiftReasonDialogOpen(false);
        setIsCameraOpen(true);
    };

    const handleOpenLateRequestDialog = () => {
        setLateReason('');
        setEstimatedLateMinutes('');
        setLateReasonPhotoId(null);
        setLateReasonPhotoUrl(null);
        setLateReasonMediaType(null);
        setIsLateReasonDialogOpen(true);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');

        if (!isImage && !isVideo) {
            toast.error('Vui lòng chọn tệp hình ảnh hoặc video.');
            return;
        }

        if (file.size > 20 * 1024 * 1024) {
            toast.error('Kích thước tệp quá lớn (tối đa 20MB).');
            return;
        }

        try {
            setIsProcessing(true);
            const id = uuidv4();
            await photoStore.addPhoto(id, file);
            setLateReasonPhotoId(id);
            setLateReasonMediaType(isImage ? 'photo' : 'video');
            toast.success('Đã tải tệp lên thành công.');
        } catch (error) {
            console.error("Failed to add file to store:", error);
            toast.error('Không thể tải tệp. Vui lòng thử lại.');
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleLateReasonSubmit = async () => {
        if (!user) return;
        const minutes = Number(estimatedLateMinutes);
        if (isNaN(minutes) || minutes <= 0) {
            toast.error('Vui lòng nhập số phút đi trễ hợp lệ.');
            return;
        }
        if (!lateReason.trim()) {
            toast.error('Vui lòng nhập lý do đi trễ.');
            return;
        }

        setIsLateReasonDialogOpen(false);
        setIsProcessing(true);
        const toastId = toast.loading('Đang gửi yêu cầu...');
        try {
            await dataStore.requestLateCheckIn(user, lateReason, minutes, lateReasonPhotoId || undefined);
            toast.success('Đã gửi yêu cầu xin đi trễ. Vui lòng chấm công khi bạn đến.', { id: toastId, duration: 5000 });
        } catch (error: any) {
            console.error("Failed to request late check-in:", error);
            toast.error(error.message || 'Không thể gửi yêu cầu. Vui lòng thử lại.', { id: toastId, duration: 4000 });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCameraSubmit = async (media: { id: string; type: 'photo' | 'video' }[]) => {
        const photoId = media.find(m => m.type === 'photo')?.id;
        if (!photoId) return;

        if (!user) return;

        setIsCameraOpen(false);
        setIsProcessing(true);
        let toastId;
        if (cameraAction !== 'late-request') {
            toastId = toast.loading('Đang gửi yêu cầu...');
        }

        try {
            if (cameraAction === 'break') {
                if (!latestInProgressRecord) throw new Error("No in-progress record for break.");
                if (latestInProgressRecord.onBreak) {
                    await dataStore.endBreak(latestInProgressRecord.id, photoId);
                    toast.success('Đã tiếp tục làm việc.', { id: toastId });
                } else {
                    await dataStore.startBreak(latestInProgressRecord.id, photoId);
                    toast.success('Đã bắt đầu nghỉ trưa.', { id: toastId });
                }
            } else if (cameraAction === 'late-request') {
                const mediaItem = media[0];
                if (mediaItem) {
                    setLateReasonPhotoId(mediaItem.id);
                    setLateReasonMediaType(mediaItem.type);
                }
            } else { // 'check-in-out'
                if (latestInProgressRecord?.status === 'in-progress') {
                    await dataStore.updateAttendanceRecord(latestInProgressRecord.id, photoId);
                    toast.success('Chấm công ra thành công!', { id: toastId });
                } else {
                    const isOffShiftCheckIn = !activeShift;
                    await dataStore.createAttendanceRecord(user, photoId, isOffShiftCheckIn, offShiftReason);
                    toast.success(
                        isOffShiftCheckIn ? 'Chấm công ngoài giờ thành công!' : 'Chấm công vào thành công!',
                        { id: toastId }
                    );
                }
            }
        } catch (error) {
            console.error("Failed to check in/out:", error);
            toast.error('Thao tác thất bại. Vui lòng thử lại.', { id: toastId });
        } finally {
            setIsProcessing(false);
        }
    };

    // Don't show the card if loading, or if there's no active shift AND no in-progress record to check out from.
    // This ensures the user can always check out.
    const handleToggleBreak = async () => {
        if (!latestInProgressRecord) return;
        setCameraAction('break');
        setIsCameraOpen(true);
    };

    const isCheckedIn = !!latestInProgressRecord && latestInProgressRecord.status === 'in-progress';
    const isOnBreak = latestInProgressRecord?.onBreak;
    const mainButtonText = isCheckedIn ? 'Chấm công ra' : 'Chấm công vào';

    const hasPendingLateRequest = attendanceRecords[0]?.status === 'pending_late';

    // Determine if the next (earliest) shift has already started. If it has, we should not allow late requests.
    const nextShift = todaysShifts.length > 0 ? todaysShifts[0] : null;
    const hasShiftStarted = (shift: AssignedShift | null) => {
        if (!shift) return false;
        const [h, m] = shift.timeSlot.start.split(':').map(Number);
        const shiftDate = new Date(shift.date);
        shiftDate.setHours(h, m, 0, 0);
        if (user?.role === 'Quản lý' && h === 6) {
            shiftDate.setHours(7, m, 0, 0);
        }
        return currentTime.getTime() >= shiftDate.getTime();
    };
    const showLateRequestButton = !isCheckedIn && !!nextShift && !hasShiftStarted(nextShift);

    // Calculate duration if checked in
    const getDuration = () => {
        if (latestInProgressRecord?.checkInTime) {
            const start = (latestInProgressRecord.checkInTime as Timestamp).toDate();
            const diff = currentTime.getTime() - start.getTime();
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            return `${hours}h ${minutes}m`;
        }
        return '--';
    };

    if (authLoading || isLoading) {
        return null;
    }

    return (
        <>
            <Card className={cn(
                "overflow-hidden border-0 shadow-2xl shadow-indigo-500/20 transition-all duration-500 relative",
                isCheckedIn ? "bg-zinc-900 text-white" : "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
            )}>
                {isCheckedIn && checkInPhotoUrl && (
                    <div className="absolute inset-0">
                        <Image
                            src={checkInPhotoUrl}
                            alt="Check-in photo"
                            fill
                            className="object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/40 to-indigo-700/40" />
                    </div>
                )}
                <div className="relative p-4 sm:p-6 overflow-hidden">
                    {/* Background decoration */}
                    {!isCheckedIn && (
                        <>
                            <div className="hidden sm:block absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl"></div>
                            <div className="hidden sm:block absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl"></div>
                        </>
                    )}

                    <div className="relative space-y-4 sm:space-y-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className={cn(
                                    "text-sm font-medium mb-1",
                                    isCheckedIn ? "text-blue-100" : "text-zinc-500 dark:text-zinc-400"
                                )}>
                                    {format(currentTime, 'EEEE, d MMMM', { locale: vi })}
                                </p>
                                <h2 className={cn(
                                    "text-2xl sm:text-3xl font-bold tracking-tight",
                                    isCheckedIn ? "text-white" : "text-zinc-900 dark:text-white"
                                )}>
                                    {format(currentTime, 'HH:mm')}
                                </h2>
                            </div>
                            <div className={cn(
                                "px-3 py-1 rounded-full text-xs font-semibold border",
                                isCheckedIn
                                    ? "bg-green-500/20 border-green-400/30 text-green-100"
                                    : "bg-zinc-100 border-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
                            )}>
                                {isCheckedIn ? (isOnBreak ? 'Đang nghỉ' : 'Đang làm việc') : 'Chưa vào ca'}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                            <div className={cn(
                                "rounded-2xl p-3 sm:p-4 border",
                                isCheckedIn
                                    ? "bg-white/10 backdrop-blur-md border-white/10"
                                    : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-800"
                            )}>
                                <p className={cn(
                                    "text-xs mb-1",
                                    isCheckedIn ? "text-blue-100" : "text-zinc-500 dark:text-zinc-400"
                                )}>Thời gian làm</p>
                                <p className={cn(
                                    "text-lg font-bold",
                                    isCheckedIn ? "text-white" : "text-zinc-900 dark:text-white"
                                )}>{getDuration()}</p>
                            </div>
                            <div className={cn(
                                "rounded-2xl p-3 sm:p-4 border",
                                isCheckedIn
                                    ? "bg-white/10 backdrop-blur-md border-white/10"
                                    : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-800"
                            )}>
                                <p className={cn(
                                    "text-xs mb-1",
                                    isCheckedIn ? "text-blue-100" : "text-zinc-500 dark:text-zinc-400"
                                )}>Ca làm việc</p>
                                <p className={cn(
                                    "text-lg font-bold",
                                    isCheckedIn ? "text-white" : "text-zinc-900 dark:text-white"
                                )}>
                                    {activeShift ? `${activeShift.label} (${activeShift.assignedUsers.find(u => u.userId === user?.uid)?.assignedRole || 'N/A'})` : 'Ngoài giờ'}
                                </p>
                            </div>
                        </div>

                        <Button
                            size="xl"
                            className={cn(
                                "w-full rounded-2xl font-bold text-md sm:text-lg py-2 sm:py-3 shadow-lg transition-all active:scale-[0.98]",
                                isCheckedIn
                                    ? "bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-rose-500/25 hover:shadow-rose-500/40"
                                    : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-600/25 hover:shadow-blue-600/40"
                            )}
                            onClick={handleCheckInOrOut}
                            disabled={isProcessing}
                        >
                            {isProcessing ? (
                                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                            ) : (
                                <Camera className="mr-2 h-6 w-6" />
                            )}
                            {mainButtonText}
                        </Button>

                        {/* Secondary Actions */}
                        <div className="space-y-3">
                            {isCheckedIn && (user?.role === 'Quản lý') && (
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "w-full h-10 sm:h-12 rounded-xl border transition-colors",
                                        isCheckedIn
                                            ? "bg-white/10 border-white/20 text-white hover:bg-white/20"
                                            : "border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                    )}
                                    onClick={handleToggleBreak}
                                    disabled={isProcessing}
                                >
                                    {isOnBreak ? <Play className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}
                                    {isOnBreak ? 'Tiếp tục' : 'Nghỉ ngơi'}
                                </Button>
                            )}

                            {showLateRequestButton && (
                                <Button
                                    variant="ghost"
                                    className="w-full h-10 sm:h-12 rounded-xl text-zinc-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                    onClick={handleOpenLateRequestDialog}
                                    disabled={isProcessing || hasPendingLateRequest}
                                >
                                    <Clock className="mr-2 h-4 w-4" />
                                    {hasPendingLateRequest ? 'Đã xin trễ' : 'Xin đi trễ'}
                                </Button>
                            )}

                            <Button
                                variant="outline"
                                className={cn(
                                    "w-full h-10 sm:h-12 rounded-xl border transition-colors",
                                    isCheckedIn
                                        ? "bg-white/10 border-white/20 text-white hover:bg-white/20"
                                        : "border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                )}
                                onClick={() => setIsWorkHistoryOpen(true)}
                            >
                                <History className="mr-2 h-4 w-4" />
                                Lịch sử làm việc
                            </Button>
                        </div>

                        {/* Recent History List */}
                        {attendanceRecords.length > 0 && (
                            <div className={cn(
                                "space-y-2 pt-3 border-t",
                                isCheckedIn ? "border-white/10" : "border-zinc-100 dark:border-zinc-800"
                            )}>
                                <div className="flex items-center justify-between">
                                    <h3 className={cn(
                                        "text-sm font-bold",
                                        isCheckedIn ? "text-white" : "text-zinc-900 dark:text-white"
                                    )}>Hoạt động gần đây</h3>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className={cn(
                                            "h-8 text-xs",
                                            isCheckedIn ? "text-blue-100 hover:bg-white/10" : "text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                                        )}
                                        onClick={() => setIsHistoryOpen(true)}
                                    >
                                        Xem tất cả <ChevronRight className="ml-1 h-3 w-3" />
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    {attendanceRecords.slice(0, 2).map((record) => (
                                        <div key={record.id} className={cn(
                                            "flex items-center justify-between p-2 rounded-lg border",
                                            isCheckedIn
                                                ? "bg-white/10 backdrop-blur-md border-white/10"
                                                : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-800"
                                        )}>
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "h-10 w-10 rounded-xl flex items-center justify-center",
                                                    record.checkOutTime
                                                        ? (isCheckedIn ? "bg-green-400/20 text-green-300" : "bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400")
                                                        : (isCheckedIn ? "bg-blue-400/20 text-blue-200" : "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400")
                                                )}>
                                                    {record.checkOutTime ? <CheckCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                                                </div>
                                                <div>
                                                    <p className={cn(
                                                        "text-sm font-bold",
                                                        isCheckedIn ? "text-white" : "text-zinc-900 dark:text-white"
                                                    )}>
                                                        {record.checkOutTime ? 'Hoàn thành ca' : 'Đang làm việc'}
                                                    </p>
                                                    <p className={cn(
                                                        "text-xs",
                                                        isCheckedIn ? "text-blue-100" : "text-zinc-50 dark:text-zinc-400"
                                                    )}>
                                                        {record.isOffShift ? 'Ca ngoài giờ' : 'Ca chính thức'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={cn(
                                                    "text-sm font-mono font-bold",
                                                    isCheckedIn ? "text-white" : "text-zinc-900 dark:text-white"
                                                )}>
                                                    {record.checkInTime ? format((record.checkInTime as Timestamp).toDate(), 'HH:mm') : '--:--'}
                                                </p>
                                                <p className={cn(
                                                    "text-xs",
                                                    isCheckedIn ? "text-blue-100" : "text-zinc-500 dark:text-zinc-400"
                                                )}>
                                                    {record.checkOutTime ? format((record.checkOutTime as Timestamp).toDate(), 'HH:mm') : '...'}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            {/* Dialogs */}
            <CameraDialog
                isOpen={isCameraOpen}
                onClose={() => setIsCameraOpen(false)}
                onSubmit={handleCameraSubmit}
                captureMode="photo"
                singlePhotoMode={true}
                isHD={true}
                parentDialogTag="root"
            />

            <LateReasonDialog
                open={isLateReasonDialogOpen}
                onOpenChange={setIsLateReasonDialogOpen}
                lateReason={lateReason}
                setLateReason={setLateReason}
                estimatedLateMinutes={estimatedLateMinutes}
                setEstimatedLateMinutes={setEstimatedLateMinutes}
                fileInputRef={fileInputRef}
                lateReasonPhotoId={lateReasonPhotoId}
                lateReasonPhotoUrl={lateReasonPhotoUrl}
                lateReasonMediaType={lateReasonMediaType}
                onOpenLightbox={openLightbox}
                onPickFromCamera={() => { setCameraAction('late-request'); setIsCameraOpen(true); }}
                onFileSelect={handleFileSelect}
                onRemoveMedia={() => { setLateReasonPhotoId(null); setLateReasonMediaType(null); }}
                onSubmit={handleLateReasonSubmit}
                isProcessing={isProcessing}
                parentDialogTag="root"
            />

            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen} dialogTag="history-dialog" parentDialogTag="root">
                <DialogContent className="max-w-md">
                    <DialogHeader variant="premium" iconkey="history">
                        <div>
                            <DialogTitle>Lịch sử chấm công hôm nay</DialogTitle>
                            <DialogDescription>
                                Xem lại các lượt vào/ra của bạn trong ngày.
                            </DialogDescription>
                        </div>
                    </DialogHeader>
                    <DialogBody>
                        {attendanceRecords.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8 font-medium">Chưa có dữ liệu chấm công hôm nay.</p>
                        ) : (
                            <div className="space-y-3">
                                {attendanceRecords.map((record) => (
                                    <div key={record.id} className="flex items-center justify-between p-4 rounded-2xl border-none bg-muted/30 shadow-none">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <Badge variant={record.isOffShift ? "secondary" : "default"} className="rounded-lg font-bold px-2 py-0.5">
                                                    {record.isOffShift ? 'Ngoài giờ' : 'Ca chính'}
                                                </Badge>
                                                {record.status === 'in-progress' && (
                                                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 rounded-lg font-bold px-2 py-0.5">
                                                        Đang làm
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right text-sm">
                                            <div className="flex items-center justify-end gap-2 text-green-600 font-bold font-mono">
                                                <ArrowRight className="h-4 w-4" />
                                                <span>
                                                    {record.checkInTime ? format((record.checkInTime as Timestamp).toDate(), 'HH:mm') : '--:--'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-end gap-2 text-red-600 mt-1 font-bold font-mono">
                                                <ArrowLeft className="h-4 w-4" />
                                                <span>
                                                    {record.checkOutTime ? format((record.checkOutTime as Timestamp).toDate(), 'HH:mm') : '--:--'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </DialogBody>
                    <DialogFooter>
                        <DialogCancel className="w-full" onClick={() => setIsHistoryOpen(false)}>Đóng</DialogCancel>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={showOldShiftAlert} onOpenChange={setShowOldShiftAlert} dialogTag="alert-dialog" parentDialogTag="root" variant="warning">
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogIcon icon={AlertTriangle} />
                        <div className="space-y-2 text-center sm:text-left">
                            <AlertDialogTitle>Cảnh báo ca làm việc cũ</AlertDialogTitle>
                            <AlertDialogDescription>
                                Không thể kết thúc ca làm việc trước ngày hôm nay, vui lòng liên hệ chủ quán.
                            </AlertDialogDescription>
                        </div>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setShowOldShiftAlert(false)}>Hủy</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <OffShiftReasonDialog
                open={isOffShiftReasonDialogOpen}
                onOpenChange={setIsOffShiftReasonDialogOpen}
                value={offShiftReason}
                onValueChange={setOffShiftReason}
                onCancel={() => setIsOffShiftReasonDialogOpen(false)}
                onSubmit={handleReasonSubmit}
                parentDialogTag="root"
            />

            {user && (
                <WorkHistoryDialog
                    isOpen={isWorkHistoryOpen}
                    onClose={() => setIsWorkHistoryOpen(false)}
                    user={user}
                    parentDialogTag='root'
                />
            )}
        </>
    );
}