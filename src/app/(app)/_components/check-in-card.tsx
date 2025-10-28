'use client';
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import type { AssignedShift, AttendanceRecord } from '@/lib/types';
import { Camera, CheckCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { dataStore } from '@/lib/data-store';
import CameraDialog from '@/components/camera-dialog';
import { toast } from 'react-hot-toast';
import Image from 'next/image';
import { Timestamp } from '@google-cloud/firestore';

export default function CheckInCard() {
    const { user, loading: authLoading } = useAuth();
    const [activeShift, setActiveShift] = useState<AssignedShift | null>(null);
    const [latestRecord, setLatestRecord] = useState<AttendanceRecord | null>(null);
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000 * 60);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!user || authLoading) return;

        let unsubLatest: (() => void) | null = null;
        let unsubToday: (() => void) | null = null;
        
        const fetchActiveShiftAndAttendance = async () => {
            setIsLoading(true);
            try {
                const shift = await dataStore.getActiveShiftForUser(user.uid);
                setActiveShift(shift);

                // Subscribe to the single latest "in-progress" record to determine status
                unsubLatest = dataStore.subscribeToLatestAttendanceRecord(user.uid, (record) => {
                    setLatestRecord(record);
                    setIsLoading(false);
                });

                // Subscribe to all of today's records for history display
                unsubToday = dataStore.subscribeToUserAttendanceForToday(user.uid, (records) => {
                    setAttendanceRecords(records);
                });

            } catch (error) {
                console.error("Error fetching active shift:", error);
                setIsLoading(false);
            }
        };

        fetchActiveShiftAndAttendance();

        return () => {
            if (unsubLatest) unsubLatest();
            if (unsubToday) unsubToday();
        };

    }, [user, authLoading]);

    const handleCheckInOrOut = () => {
        setIsCameraOpen(true);
    };

    const handleCameraSubmit = async (media: {id: string; type: 'photo' | 'video'}[]) => {
        if (!user || !activeShift) return;
        const photoId = media.find(m => m.type === 'photo')?.id;
        if (!photoId) return;

        setIsCameraOpen(false);
        setIsProcessing(true);
        const toastId = toast.loading('Đang gửi dữ liệu...');

        try {
            if (latestRecord?.status === 'in-progress') {
                // This is a check-out
                await dataStore.updateAttendanceRecord(latestRecord.id, photoId);
                toast.success('Chấm công ra thành công!', { id: toastId });
            } else {
                // This is a check-in
                await dataStore.createAttendanceRecord(user, photoId);
                toast.success('Chấm công vào thành công!', { id: toastId });
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
    if (authLoading || isLoading || (!activeShift && latestRecord?.status !== 'in-progress')) {
        return null;
    }

    const renderStatus = () => {
        if (latestRecord && latestRecord.status === 'completed') {
            const checkInTime = new Date((latestRecord.checkInTime as Timestamp).seconds * 1000);
            const checkOutTime = new Date((latestRecord.checkOutTime as Timestamp).seconds * 1000);
            return (
                 <div className="text-center py-4">
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <p className="font-semibold text-lg">Ca làm việc đã kết thúc</p>
                    <p className="text-sm text-muted-foreground">
                        Vào: {checkInTime ? format(checkInTime, 'HH:mm') : '--:--'} - Ra: {checkOutTime ? format(checkOutTime, 'HH:mm') : '--:--'}
                    </p>
                </div>
            );
        }
        if (latestRecord && latestRecord.checkInTime && latestRecord.status === 'in-progress') {
            const checkInTime = new Date((latestRecord.checkInTime as Timestamp).seconds * 1000);
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
        return (
            <Button onClick={handleCheckInOrOut} disabled={isProcessing} className="w-full h-16 text-xl">
                 {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Camera className="mr-2 h-5 w-5" />}
                Chấm công vào
            </Button>
        );
    };

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
                    {latestRecord && (
                        <div className="relative h-16 w-16 rounded-full overflow-hidden shrink-0">
                            <Image src={latestRecord.photoInUrl} alt="Avatar" layout="fill" objectFit="cover" />
                        </div>
                    )}
                    <div className="flex-1">
                        <CardTitle className="text-xl">{user?.displayName}</CardTitle>
                        <CardDescription>
                            Ca làm việc: <span className="font-semibold">{activeShift ? `${activeShift.label} (${activeShift.timeSlot.start} - ${activeShift.timeSlot.end})` : 'Không có ca làm việc'}</span>
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    {renderStatus()}
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
        </>
    );
}