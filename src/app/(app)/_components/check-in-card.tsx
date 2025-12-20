
'use client';
import { useState, useEffect } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogOverlay } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import type { AssignedShift, AttendanceRecord } from '@/lib/types';
import { Camera, CheckCircle, Loader2, Info, Clock, X, History, AlertTriangle, LogOut } from 'lucide-react';
import { format } from 'date-fns';
import { dataStore } from '@/lib/data-store';
import CameraDialog from '@/components/camera-dialog';
import { toast } from 'react-hot-toast';
import Image from 'next/image';
import { useLightbox } from '@/contexts/lightbox-context';
import { Timestamp } from 'firebase/firestore';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { photoStore } from '@/lib/photo-store';
import { isToday } from 'date-fns';
import WorkHistoryDialog from './work-history-dialog';

export default function CheckInCard() {
    const { openLightbox } = useLightbox();
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

    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    useEffect(() => {
        setActiveShift(activeShifts.length > 0 ? activeShifts[0] : null);
    }, [activeShifts]);

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

        unsubLatest = dataStore.subscribeToLatestInProgressAttendanceRecord(user.uid, (record) => {
            setLatestInProgressRecord(record);
            setIsLoading(false);
        });

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
            setCameraAction('check-in-out');
            setOffShiftReason('');
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
        setIsLateReasonDialogOpen(true);
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
                if (photoId) {
                    setLateReasonPhotoId(photoId);
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

    const handleToggleBreak = async () => {
        if (!latestInProgressRecord) return;
        setCameraAction('break');
        setIsCameraOpen(true);
    };

    if (authLoading || isLoading) {
        return null;
    }

    const checkInTime = latestInProgressRecord?.checkInTime ? (latestInProgressRecord.checkInTime as Timestamp).toDate() : null;
    const hasPendingLateRequest = attendanceRecords[0]?.status === 'pending_late';

    const renderRequestLateButton = () => {
        if (todaysShifts.length === 0) return null;
        if (hasPendingLateRequest) {
            return (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                    <p className="text-blue-800 font-semibold text-base mb-2">Đã ghi nhận yêu cầu đi trễ:</p>
                    <div className="space-y-2 text-left text-blue-900/80">
                        <p><strong>Lý do:</strong> {attendanceRecords[0].lateReason}</p>
                        <p><strong>Dự kiến trễ:</strong> {attendanceRecords[0].estimatedLateMinutes} phút</p>
                        {attendanceRecords[0].lateReasonPhotoUrl && (
                            <div className="flex items-start gap-2">
                                <strong>Bằng chứng:</strong>
                                <button onClick={() => openLightbox([{ src: attendanceRecords[0].lateReasonPhotoUrl! }])} className="relative h-16 w-16 rounded-md overflow-hidden cursor-pointer shrink-0">
                                    <Image src={attendanceRecords[0].lateReasonPhotoUrl} alt="Ảnh bằng chứng đi trễ" layout="fill" objectFit="cover" className="hover:scale-110 transition-transform duration-200" />
                                </button>
                            </div>
                        )}
                    </div>
                    <p className="text-center text-blue-800 font-semibold mt-3 pt-3 border-t border-blue-200">Vui lòng chấm công khi bạn đến nơi.</p>
                </div>
            )
        } else {
            return (
                <Button onClick={handleOpenLateRequestDialog} disabled={isProcessing} variant="outline" className="w-full">
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock className="mr-2 h-4 w-4" />}
                    Xin đi trễ
                </Button>
            );
        }
    }

    return (
        <>
            <div className="bg-gradient-to-br from-primary to-blue-600 rounded-2xl p-5 text-white shadow-glow relative overflow-hidden group">
                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity duration-500"></div>
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <p className="text-blue-100 text-xs font-semibold uppercase tracking-wider mb-0.5">Trạng thái</p>
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-400 border-2 border-blue-600"></span>
                                </span>
                                <h2 className="text-lg font-bold">
                                    {latestInProgressRecord ? 'Đang trong ca' : 'Chưa chấm công'}
                                </h2>
                            </div>
                        </div>
                        {checkInTime && (
                             <div className="text-right">
                                <p className="text-blue-100 text-xs font-semibold uppercase tracking-wider mb-0.5">Check-in</p>
                                <p className="text-2xl font-display font-bold tracking-tight">{format(checkInTime, 'HH:mm')}</p>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <Button
                            onClick={handleCheckInOrOut}
                            disabled={isProcessing}
                            className="flex-1 bg-white text-primary hover:bg-blue-50 py-2.5 px-4 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                        >
                            {isProcessing
                                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                : latestInProgressRecord
                                    ? <><LogOut className="text-lg" /> Chấm công ra</>
                                    : <><Camera className="text-lg" /> Chấm công vào</>
                            }
                        </Button>
                        <Button
                            onClick={() => setIsHistoryOpen(true)}
                            className="bg-blue-700/50 hover:bg-blue-700 text-white p-2.5 rounded-xl transition-colors backdrop-blur-sm"
                            title="Lịch sử"
                        >
                            <History className="text-xl" />
                        </Button>
                    </div>
                    {latestInProgressRecord && (user?.role === 'Quản lý') && (
                        <Button onClick={handleToggleBreak} disabled={isProcessing} variant="outline" className="w-full mt-2">
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (latestInProgressRecord.onBreak ? <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> : <Info className="mr-2 h-4 w-4 text-blue-500" />)}
                            {latestInProgressRecord.onBreak ? 'Tiếp tục vào làm việc' : 'Tạm nghỉ'}
                        </Button>
                    )}
                    {!latestInProgressRecord && renderRequestLateButton()}
                </div>
            </div>
            <CameraDialog
                isOpen={isCameraOpen}
                onClose={() => setIsCameraOpen(false)}
                onSubmit={handleCameraSubmit}
                captureMode="photo"
                singlePhotoMode={true}
                isHD={true}
            />
             <AlertDialog open={isLateReasonDialogOpen} onOpenChange={setIsLateReasonDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Lý do đi trễ</AlertDialogTitle>
                        <AlertDialogDescription>
                            Vui lòng cung cấp lý do bạn đi trễ. Thông tin này sẽ được gửi đến quản lý.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="late-minutes">Số phút đi trễ (dự kiến)</Label>
                            <Input
                                id="late-minutes"
                                type="number"
                                value={estimatedLateMinutes}
                                onChange={(e) => setEstimatedLateMinutes(e.target.value)}
                                placeholder="VD: 15"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="late-reason">Lý do đi trễ</Label>
                            <Textarea id="late-reason" value={lateReason} onChange={(e) => setLateReason(e.target.value)} placeholder="VD: Kẹt xe, có việc đột xuất..." />
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button variant="outline" className="flex-1" onClick={() => { setCameraAction('late-request'); setIsCameraOpen(true); }}>
                            <Camera className="mr-2 h-4 w-4" />
                            {lateReasonPhotoId ? 'Chụp lại ảnh' : 'Đính kèm ảnh'}
                        </Button>
                        {lateReasonPhotoUrl && (
                            <div className="relative">
                                <button onClick={() => openLightbox([{ src: lateReasonPhotoUrl! }])} className="block w-12 h-12 rounded-md overflow-hidden">
                                    <Image src={lateReasonPhotoUrl} alt="Ảnh bằng chứng đi trễ" layout="fill" objectFit="cover" />
                                </button>
                                <Button
                                    variant="destructive"
                                    size="icon"
                                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full z-10"
                                    onClick={() => {
                                        if (lateReasonPhotoId) photoStore.deletePhoto(lateReasonPhotoId);
                                        setLateReasonPhotoId(null);
                                    }}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        )}
                    </div>
                    <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={handleLateReasonSubmit}>Gửi yêu cầu</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {user && (
                <WorkHistoryDialog
                    isOpen={isHistoryOpen}
                    onClose={() => setIsHistoryOpen(false)}
                    user={user}
                />
            )}
            <AlertDialog open={showOldShiftAlert} onOpenChange={setShowOldShiftAlert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="text-destructive" />
                            Không thể chấm công ra
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Bạn không thể chấm công ra cho một ca làm việc đã bắt đầu từ ngày hôm trước. Vui lòng liên hệ chủ quán để được hỗ trợ.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogAction onClick={() => setShowOldShiftAlert(false)}>Đã hiểu</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={isOffShiftReasonDialogOpen} onOpenChange={setIsOffShiftReasonDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Lý do chấm công ngoài giờ</AlertDialogTitle>
                        <AlertDialogDescription>
                            Vui lòng cung cấp lý do bạn cần chấm công khi không có trong ca làm việc đã được phân công. (VD: Tăng ca, làm thay,...)
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Textarea
                        value={offShiftReason}
                        onChange={(e) => setOffShiftReason(e.target.value)}
                        placeholder="Nhập lý do của bạn ở đây..."
                    />
                    <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={handleReasonSubmit}>Tiếp tục</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
