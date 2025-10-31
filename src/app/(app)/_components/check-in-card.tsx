'use client';
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import type { AssignedShift, AttendanceRecord } from '@/lib/types';
import { Camera, CheckCircle, Loader2, Info } from 'lucide-react';
import { format, getISOWeek } from 'date-fns';
import { dataStore } from '@/lib/data-store';
import CameraDialog from '@/components/camera-dialog';
import { toast } from 'react-hot-toast';
import Image from 'next/image';
import { Timestamp } from 'firebase/firestore';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";

export default function CheckInCard() {
    const { user, loading: authLoading, activeShifts } = useAuth();
    const [activeShift, setActiveShift] = useState<AssignedShift | null>(null);
    const [latestInProgressRecord, setLatestInProgressRecord] = useState<AttendanceRecord | null>(null);
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [lightboxSlides, setLightboxSlides] = useState<{ src: string }[]>([]);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    
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

    // Back button handling for Lightbox
    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            if (isLightboxOpen) {
                event.preventDefault();
                setIsLightboxOpen(false);
            }
        };

        if (isLightboxOpen) {
            window.history.pushState({ lightbox: 'open' }, '');
            window.addEventListener('popstate', handlePopState);
        } else {
            if (window.history.state?.lightbox) {
                window.history.back();
            }
        }

        return () => window.removeEventListener('popstate', handlePopState);
    }, [isLightboxOpen]);

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
        setIsCameraOpen(true);
    };

    const handleCameraSubmit = async (media: {id: string; type: 'photo' | 'video'}[]) => {
        const photoId = media.find(m => m.type === 'photo')?.id;
        if (!photoId) return;

        if (!user) return;

        setIsCameraOpen(false);
        setIsProcessing(true);
        const toastId = toast.loading('Đang gửi dữ liệu...');

        try {
            if (latestInProgressRecord?.status === 'in-progress') {
                // This is a check-out. We only need the user and the record to exist.
                await dataStore.updateAttendanceRecord(latestInProgressRecord.id, photoId);
                toast.success('Chấm công ra thành công!', { id: toastId });
            } else {
                // This is a check-in. We need an active shift to proceed.
                const isOffShiftCheckIn = !activeShift;
                await dataStore.createAttendanceRecord(user, photoId, isOffShiftCheckIn);
                toast.success(
                    isOffShiftCheckIn ? 'Chấm công ngoài giờ thành công!' : 'Chấm công vào thành công!',
                    { id: toastId }
                );
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
    const handleOpenLightbox = (slides: { src: string }[], index: number = 0) => {
        setLightboxSlides(slides);
        setLightboxIndex(index);
        setIsLightboxOpen(true);
    };

    const renderStatus = () => {
        if (latestInProgressRecord && latestInProgressRecord.status === 'completed') {
            // This case is now handled by the logic in ShiftsPage to move the card down.
            // We can show a generic "no active shift" message here.
            return null;
        }
        if (latestInProgressRecord && latestInProgressRecord.checkInTime && latestInProgressRecord.status === 'in-progress') {
            const checkInTime = new Date((latestInProgressRecord.checkInTime as Timestamp).seconds * 1000);
            return (
                <div className="text-center">
                    <p className="text-sm text-muted-foreground">Bạn đã chấm công vào lúc</p>
                    <p className="text-4xl font-bold font-mono">{format(checkInTime, 'HH:mm')}</p>
                    <Button onClick={handleCheckInOrOut} disabled={isProcessing} className="w-full mt-4 h-12 text-base">
                        {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Camera className="mr-2 h-5 w-5" />}
                        Chấm công ra
                    </Button>
                </div>
            );
        }

        if (!latestInProgressRecord && !activeShift) {
            return (
                <div className="text-center">
                    <Button onClick={handleCheckInOrOut} disabled={isProcessing} className="w-full h-12 text-base" variant="outline">
                        {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Camera className="mr-2 h-5 w-5" />}
                        Chấm công ngoài giờ làm việc
                    </Button>
                </div>
            );
        }

        if (!activeShift) {
            return null; // Don't show check-in button if there's no active shift
        }

        return (
            <Button onClick={handleCheckInOrOut} disabled={isProcessing} className="w-full h-16 text-xl">
                 {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Camera className="mr-2 h-5 w-5" />}
                Chấm công vào
            </Button>
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
                        const checkIn = new Date((record.checkInTime as any).seconds * 1000);
                        const checkOut = record.checkOutTime ? new Date((record.checkOutTime as any).seconds * 1000) : null;
                        return (
                            <li key={record.id} className="text-sm flex justify-between items-center bg-muted/50 p-2 rounded-md">
                                <span>Vào: <span className="font-mono font-medium">{format(checkIn, 'HH:mm')}</span></span>
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
                        <button onClick={() => handleOpenLightbox([{src: latestInProgressRecord.photoInUrl!}], 0)} className="relative h-16 w-16 rounded-full overflow-hidden shrink-0 cursor-pointer">
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
            <CameraDialog
                isOpen={isCameraOpen}
                onClose={() => setIsCameraOpen(false)}
                onSubmit={handleCameraSubmit}
                captureMode="photo"
                singlePhotoMode={true}
                isHD={true}
            />
            <Lightbox
                open={isLightboxOpen}
                close={() => setIsLightboxOpen(false)}
                slides={lightboxSlides}
                index={lightboxIndex}
                plugins={[Zoom]}
            />
        </>
    );
}