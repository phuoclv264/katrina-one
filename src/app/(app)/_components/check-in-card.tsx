'use client';
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogOverlay } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import type { AssignedShift, AttendanceRecord } from '@/lib/types';
import { Camera, CheckCircle, Loader2, Info, Clock, X, History, AlertTriangle } from 'lucide-react';
import { format, getISOWeek } from 'date-fns';
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

    const [currentTime, setCurrentTime] = useState(new Date());

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

    // Don't show the card if loading, or if there's no active shift AND no in-progress record to check out from.
    // This ensures the user can always check out.
    const handleToggleBreak = async () => {
        if (!latestInProgressRecord) return;
        setCameraAction('break');
        setIsCameraOpen(true);
    };

    const hasPendingLateRequest = attendanceRecords[0]?.status === 'pending_late';

    const renderRequestLateButton = () => {
        if (todaysShifts.length === 0) return null;
        if (hasPendingLateRequest) {
            return (
                <div className="p-4 bg-info/10 border border-info/20 rounded-lg text-sm">
                    <p className="text-info font-semibold text-base mb-2">Đã ghi nhận yêu cầu đi trễ:</p>
                    <div className="space-y-2 text-left text-info/80">
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
                    <p className="text-center text-info font-semibold mt-3 pt-3 border-t border-info/20">Vui lòng chấm công khi bạn đến nơi.</p>
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

    const renderStatus = () => {
        if (latestInProgressRecord && latestInProgressRecord.status === 'completed') {
            // This case is now handled by the logic in ShiftsPage to move the card down.
            // We can show a generic "no active shift" message here.
            return null;
        }
        if (latestInProgressRecord && latestInProgressRecord.checkInTime && latestInProgressRecord.status === 'in-progress') {
            const checkInTime = (latestInProgressRecord.checkInTime as Timestamp).toDate();
            return (
                <div className="text-center">
                    <p className="text-sm text-muted-foreground">Bạn đã chấm công vào lúc</p>
                    <p className="text-4xl font-bold font-mono mb-4">{format(checkInTime, 'HH:mm')}</p>

                    {latestInProgressRecord.onBreak ? (
                        <p className="text-lg font-semibold text-info">Đang trong giờ nghỉ...</p>
                    ) : (
                        <Button onClick={handleCheckInOrOut} disabled={isProcessing} className="w-full h-12 text-base">
                            {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Camera className="mr-2 h-5 w-5" />}
                            Chấm công ra
                        </Button>
                    )}

                    {(user?.role === 'Quản lý') && (
                        <Button onClick={handleToggleBreak} disabled={isProcessing} variant="outline" className="w-full mt-2">
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (latestInProgressRecord.onBreak ? <CheckCircle className="mr-2 h-4 w-4 text-success" /> : <Info className="mr-2 h-4 w-4 text-info" />)}
                            {latestInProgressRecord.onBreak ? 'Tiếp tục vào làm việc' : 'Tạm nghỉ'}
                        </Button>
                    )}
                </div>
            );
        }

        if (!latestInProgressRecord && !activeShift) {
            return (
                <div className="space-y-2">
                    <Button onClick={handleCheckInOrOut} disabled={isProcessing} className="w-full h-12 text-base" variant="outline">
                        {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Camera className="mr-2 h-5 w-5" />}
                        Chấm công ngoài giờ làm việc
                    </Button>

                    {renderRequestLateButton()}
                </div>
            );
        }

        if (!activeShift) {
            return null; // Don't show check-in button if there's no active shift
        }

        return (
            <div className="space-y-2">
                <Button onClick={() => handleCheckInOrOut()} disabled={isProcessing} className="w-full h-16 text-xl">
                    {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Camera className="mr-2 h-5 w-5" />}
                    Chấm công vào
                </Button>
                {renderRequestLateButton()}
            </div>
        );
    };

    const statusContent = renderStatus();

    if (authLoading || isLoading) {
        return null; // Still hide while initially loading auth state
    }

    const renderHistory = () => {
        if (attendanceRecords.length === 0) return null;

        return (
            <div className="mt-6 border-t pt-4">
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">Lịch sử trong ngày</h4>
                <ul className="space-y-2">
                    {attendanceRecords.map(record => {
                        const checkIn = record.checkInTime ? (record.checkInTime as Timestamp).toDate() : null;
                        const checkOut = record.checkOutTime ? (record.checkOutTime as Timestamp).toDate() : null;
                        const isOffShift = record.isOffShift;
                        return checkIn && (
                            <li key={record.id} className="text-sm flex justify-between items-center bg-muted/50 p-2 rounded-md">
                                <span>Vào{isOffShift ? ' ngoài giờ' : ''}: <span className="font-mono font-medium">{format(checkIn, 'HH:mm')}</span></span>
                                <span>Ra: <span className="font-mono font-medium">{checkOut ? format(checkOut, 'HH:mm') : '--:--'}</span></span>
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
    };

    return (
        <>
            <Card className="mb-6 shadow-lg border-primary/20 bg-gradient-to-br from-card to-primary/5">
                <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-4">
                    {latestInProgressRecord && latestInProgressRecord.photoInUrl && (
                        <button onClick={() => openLightbox([{ src: latestInProgressRecord.photoInUrl! }], 0)} className="relative h-16 w-16 rounded-full overflow-hidden shrink-0 cursor-pointer">
                            <Image src={latestInProgressRecord.photoInUrl} alt="Avatar" layout="fill" objectFit="cover" className="hover:scale-110 transition-transform duration-200" />
                        </button>
                    )}
                    <div className="flex-1">
                        <CardTitle className="text-xl">{user?.displayName}</CardTitle>
                        {activeShift && <CardDescription>
                            Ca làm việc: <span className="font-semibold">{activeShift ? `${activeShift.label} (${activeShift.timeSlot.start} - ${activeShift.timeSlot.end})` : 'Không có ca làm việc'}</span>
                        </CardDescription>}
                    </div>
                </CardHeader>
                <CardContent>
                    {statusContent}
                    {renderHistory()}
                </CardContent>
            </Card>
            <div className="px-4 -mt-4">
                <Button variant="secondary" className="w-full" onClick={() => setIsHistoryOpen(true)}>
                    <History className="mr-2 h-4 w-4" /> Xem lịch sử làm việc
                </Button>
            </div>
            <CameraDialog
                isOpen={isCameraOpen}
                onClose={() => setIsCameraOpen(false)}
                onSubmit={handleCameraSubmit}
                captureMode="photo"
                singlePhotoMode={true}
                isHD={true}
            />
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
        </>
    );
}
