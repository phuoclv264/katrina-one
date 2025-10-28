'use client';
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import type { AssignedShift, AttendanceRecord } from '@/lib/types';
import { Camera, CheckCircle, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { dataStore } from '@/lib/data-store';
import CameraDialog from '@/components/camera-dialog';
import { toast } from 'react-hot-toast';
import Image from 'next/image';

export default function CheckInCard() {
    const { user, loading: authLoading } = useAuth();
    const [activeShift, setActiveShift] = useState<AssignedShift | null>(null);
    const [attendanceRecord, setAttendanceRecord] = useState<AttendanceRecord | null>(null);
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

        let unsub: (() => void) | null = null;
        
        const fetchActiveShiftAndAttendance = async () => {
            setIsLoading(true);
            try {
                const shift = await dataStore.getActiveShiftForUser(user.uid);
                setActiveShift(shift);
                if (shift) {
                    unsub = dataStore.subscribeToAttendanceRecord(user.uid, shift.id, (record) => {
                        setAttendanceRecord(record);
                        setIsLoading(false);
                    });
                } else {
                    setIsLoading(false);
                }
            } catch (error) {
                console.error("Error fetching active shift:", error);
                setIsLoading(false);
            }
        };

        fetchActiveShiftAndAttendance();

        return () => {
            if (unsub) unsub();
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
            if (attendanceRecord?.status === 'in-progress') {
                // This is a check-out
                await dataStore.updateAttendanceRecord(attendanceRecord.id, photoId);
                toast.success('Chấm công ra thành công!', { id: toastId });
            } else {
                // This is a check-in
                await dataStore.createAttendanceRecord(user, activeShift, photoId);
                toast.success('Chấm công vào thành công!', { id: toastId });
            }
        } catch (error) {
            console.error("Failed to check in/out:", error);
            toast.error('Thao tác thất bại. Vui lòng thử lại.', { id: toastId });
        } finally {
            setIsProcessing(false);
        }
    };
    
    if (authLoading || isLoading || !activeShift) {
        return null; // Don't show anything if no active shift
    }

    const checkInTime = attendanceRecord?.checkInTime ? new Date((attendanceRecord.checkInTime as any).seconds * 1000) : null;
    const checkOutTime = attendanceRecord?.checkOutTime ? new Date((attendanceRecord.checkOutTime as any).seconds * 1000) : null;

    const renderStatus = () => {
        if (checkOutTime) {
            return (
                 <div className="text-center">
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <p className="font-semibold text-lg">Ca làm việc đã kết thúc</p>
                    <p className="text-sm text-muted-foreground">
                        Vào: {format(checkInTime!, 'HH:mm')} - Ra: {format(checkOutTime, 'HH:mm')}
                    </p>
                </div>
            );
        }
        if (checkInTime) {
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

    return (
        <>
            <Card className="mb-6 shadow-lg border-primary/20 bg-gradient-to-br from-card to-primary/5">
                <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-4">
                    {attendanceRecord?.photoInUrl && (
                        <div className="relative h-16 w-16 rounded-full overflow-hidden shrink-0">
                            <Image src={attendanceRecord.photoInUrl} alt="Avatar" layout="fill" objectFit="cover" />
                        </div>
                    )}
                    <div className="flex-1">
                        <CardTitle className="text-xl">{user?.displayName}</CardTitle>
                        <CardDescription>
                            Ca làm việc: <span className="font-semibold">{activeShift.label} ({activeShift.timeSlot.start} - {activeShift.timeSlot.end})</span>
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    {renderStatus()}
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