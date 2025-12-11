'use client';
import { motion, PanInfo, useMotionValue } from 'framer-motion';
import { useState, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { getNotificationDetails } from '@/lib/notification-utils';
import { dataStore } from '@/lib/data-store';
import type { Notification } from '@/lib/types';

interface NotificationToastProps {
    t: any;
    notification: Notification;
    userId: string;
    zIndex: number;
}

const NotificationToast = ({ t, notification, userId, zIndex }: NotificationToastProps) => {
    const router = useRouter();
    const [isDragging, setIsDragging] = useState(false);
    const [isExiting, setIsExiting] = useState(false);

    const userRole = 'admin'; // Derive from your auth context if needed
    const details = getNotificationDetails(notification, userId, userRole);
    const Icon = details.icon;

    const handleDragStart = () => {
        setIsDragging(true);
    };

    const handleDragEnd = (_: any, info: PanInfo) => {
        setIsDragging(false);

        // Any user drag action should dismiss the toast with fade-out
        setIsExiting(true);
        // allow exit animation to play
        setTimeout(() => toast.dismiss(t.id), 260);
    };

    const handleClick = async () => {
        // Prevent click when actively dragging
        if (isDragging) return;

        setIsExiting(true);
        // mark as read and navigate after brief exit animation
        setTimeout(async () => {
            toast.dismiss(t.id);
            if (!notification.isRead || !notification.isRead[userId]) {
                await dataStore.markNotificationAsRead(notification.id, userId);
            }
            router.push(details.href);
        }, 200);
    };

    return (
        <motion.div
            drag="y"
            dragConstraints={{ top: -200, bottom: 0 }}
            dragElastic={0.7}
            dragMomentum={false}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            initial={{ y: -50, opacity: 0, scale: 0.96 }}
            animate={isExiting ? { y: -40, opacity: 0, scale: 0.96 } : { y: 0, opacity: 1, scale: 1 }}
            transition={{
                type: 'spring',
                stiffness: 400,
                damping: 35,
            }}
            style={{
                position: 'relative',
                zIndex,
                touchAction: 'none',
            }}
            className="max-w-md w-full bg-background/95 backdrop-blur-sm shadow-xl rounded-2xl pointer-events-auto ring-1 ring-black/5 overflow-hidden"
        >
            <div
                onClick={handleClick}
                className="w-full p-4 text-left flex items-start gap-4 select-none cursor-pointer active:bg-accent/50 transition-colors"
            >
                <div className="flex-shrink-0 pt-1">
                    <div className="p-2 bg-primary/10 rounded-full">
                        <Icon className="h-5 w-5 text-primary" />
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-none mb-1.5">
                        {details.title}
                    </p>
                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                        {details.description}
                    </p>
                </div>
            </div>
            
            {/* Drag Handle Indicator */}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-10 h-1 bg-muted-foreground/20 rounded-full" />
        </motion.div>
    );
};

let toastOrderCounter = 1000;

export function showNotificationToast(notification: Notification, userId: string) {
    // Dismiss any existing toasts so the new toast appears alone (latest on top)
    toast.dismiss();

    toast.custom(
        (t) => (
            <NotificationToast
                t={t}
                notification={notification}
                userId={userId}
                zIndex={toastOrderCounter++}
            />
        ),
        {
            id: notification.id,
            duration: 4000,
            position: 'top-center',
        }
    );
}
