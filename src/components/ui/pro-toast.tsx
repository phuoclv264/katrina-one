'use client';

import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform } from 'framer-motion';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info, Bell } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export type ToastType = 'info' | 'success' | 'warning' | 'error' | 'notification';

export interface ToastOptions {
    title: string;
    message?: string;
    icon?: ReactNode;
    onPress?: () => void;
    duration?: number;
    type?: ToastType;
}

interface ToastItem extends ToastOptions {
    id: string;
    createdAt: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_DURATION = 4000;
const DRAG_DISMISS_THRESHOLD = -60;
const VELOCITY_DISMISS_THRESHOLD = -400;
const DRAG_CLICK_THRESHOLD = 6;
const EXIT_ANIMATION_DURATION = 280;
const MAX_VISIBLE_TOASTS = 5;

// ============================================================================
// TOAST STATE MANAGER
// ============================================================================

type ToastListener = (toasts: ToastItem[]) => void;

class ToastManager {
    private toasts: ToastItem[] = [];
    private listeners: Set<ToastListener> = new Set();
    private idCounter = 0;

    subscribe(listener: ToastListener) {
        this.listeners.add(listener);
        listener(this.toasts);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notify() {
        this.listeners.forEach((listener) => listener([...this.toasts]));
    }

    show(options: ToastOptions): string {
        const id = `toast-${Date.now()}-${++this.idCounter}`;
        const toast: ToastItem = {
            ...options,
            id,
            createdAt: Date.now(),
            duration: options.duration ?? DEFAULT_DURATION,
        };

        this.toasts = [toast, ...this.toasts].slice(0, MAX_VISIBLE_TOASTS);
        this.notify();
        return id;
    }

    dismiss(id: string) {
        this.toasts = this.toasts.filter((t) => t.id !== id);
        this.notify();
    }

    dismissAll() {
        this.toasts = [];
        this.notify();
    }
}

const toastManager = new ToastManager();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getTypeIcon(type: ToastType): ReactNode {
    const iconClass = 'h-5 w-5';
    switch (type) {
        case 'success':
            return <CheckCircle2 className={`${iconClass} text-emerald-500`} />;
        case 'error':
            return <AlertCircle className={`${iconClass} text-red-500`} />;
        case 'warning':
            return <AlertTriangle className={`${iconClass} text-amber-500`} />;
        case 'notification':
            return <Bell className={`${iconClass} text-primary`} />;
        case 'info':
        default:
            return <Info className={`${iconClass} text-primary`} />;
    }
}

function getTypeStyles(type: ToastType): string {
    switch (type) {
        case 'success':
            return 'bg-emerald-500/10 ring-emerald-500/20';
        case 'error':
            return 'bg-red-500/10 ring-red-500/20';
        case 'warning':
            return 'bg-amber-500/10 ring-amber-500/20';
        case 'notification':
            return 'bg-primary/10 ring-primary/20';
        case 'info':
        default:
            return 'bg-primary/10 ring-primary/20';
    }
}

// ============================================================================
// SINGLE TOAST COMPONENT
// ============================================================================

interface SingleToastProps {
    toast: ToastItem;
    index: number;
    onDismiss: (id: string) => void;
}

function SingleToast({ toast, index, onDismiss }: SingleToastProps) {
    const [isExiting, setIsExiting] = useState(false);
    const [hasDragged, setHasDragged] = useState(false);
    const dragStartY = useRef(0);
    const dismissTimeout = useRef<NodeJS.Timeout | null>(null);
    const exitTimeout = useRef<NodeJS.Timeout | null>(null);

    const y = useMotionValue(0);
    const opacity = useTransform(y, [-100, -60, 0], [0, 0.8, 1]);
    const scale = useTransform(y, [-100, 0], [0.95, 1]);

    const type = toast.type ?? 'info';
    const icon = toast.icon ?? getTypeIcon(type);
    const iconBgClass = getTypeStyles(type);

    const triggerDismiss = useCallback(() => {
        if (isExiting) return;
        setIsExiting(true);
        exitTimeout.current = setTimeout(() => {
            onDismiss(toast.id);
        }, EXIT_ANIMATION_DURATION);
    }, [isExiting, onDismiss, toast.id]);

    const handleTap = useCallback(() => {
        if (hasDragged) return;
        toast.onPress?.();
        triggerDismiss();
    }, [hasDragged, toast, triggerDismiss]);

    const handleCloseClick = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            triggerDismiss();
        },
        [triggerDismiss]
    );

    const handleDragStart = useCallback(() => {
        dragStartY.current = y.get();
        setHasDragged(false);
        if (dismissTimeout.current) {
            clearTimeout(dismissTimeout.current);
            dismissTimeout.current = null;
        }
    }, [y]);

    const handleDrag = useCallback(() => {
        const currentY = y.get();
        if (Math.abs(currentY - dragStartY.current) > DRAG_CLICK_THRESHOLD) {
            setHasDragged(true);
        }
    }, [y]);

    const handleDragEnd = useCallback(
        (_: unknown, info: PanInfo) => {
            const shouldDismiss =
                info.offset.y < DRAG_DISMISS_THRESHOLD ||
                info.velocity.y < VELOCITY_DISMISS_THRESHOLD;

            if (shouldDismiss) {
                triggerDismiss();
            } else {
                // Reset drag state after a short delay
                setTimeout(() => setHasDragged(false), 100);
            }
        },
        [triggerDismiss]
    );

    // Auto-dismiss timer
    useEffect(() => {
        if (toast.duration && toast.duration > 0) {
            dismissTimeout.current = setTimeout(() => {
                triggerDismiss();
            }, toast.duration);
        }

        return () => {
            if (dismissTimeout.current) {
                clearTimeout(dismissTimeout.current);
            }
            if (exitTimeout.current) {
                clearTimeout(exitTimeout.current);
            }
        };
    }, [toast.duration, triggerDismiss]);

    // Stacking offset calculations
    const stackOffset = index * 8;
    const stackScale = 1 - index * 0.02;
    const stackOpacity = 1 - index * 0.15;

    return (
        <motion.div
            layout
            initial={{ y: -100, opacity: 0, scale: 0.9 }}
            animate={
                isExiting
                    ? {
                          y: -80,
                          opacity: 0,
                          scale: 0.9,
                          transition: {
                              type: 'spring',
                              stiffness: 500,
                              damping: 30,
                          },
                      }
                    : {
                          y: stackOffset,
                          opacity: stackOpacity,
                          scale: stackScale,
                          transition: {
                              type: 'spring',
                              stiffness: 400,
                              damping: 30,
                              mass: 0.8,
                          },
                      }
            }
            exit={{
                y: -80,
                opacity: 0,
                scale: 0.9,
                transition: {
                    type: 'spring',
                    stiffness: 500,
                    damping: 30,
                },
            }}
            drag="y"
            dragConstraints={{ top: -150, bottom: 0 }}
            dragElastic={{ top: 0.4, bottom: 0.1 }}
            dragMomentum={false}
            onDragStart={handleDragStart}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            onClick={handleTap}
            style={{ y, opacity, scale, zIndex: 100 - index }}
            className="absolute top-0 left-0 right-0 mx-auto w-[calc(100%-2rem)] max-w-md cursor-pointer touch-none"
        >
            <div
                className="
                    relative flex items-start gap-3 p-4
                    bg-background/95 dark:bg-card/95
                    backdrop-blur-xl backdrop-saturate-150
                    shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)]
                    dark:shadow-[0_8px_32px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.2)]
                    rounded-2xl
                    ring-1 ring-black/[0.04] dark:ring-white/[0.06]
                    overflow-hidden
                    select-none
                    active:scale-[0.98] transition-transform duration-100
                "
            >
                {/* Icon */}
                <div
                    className={`
                        flex-shrink-0 p-2 rounded-xl ring-1
                        ${iconBgClass}
                    `}
                >
                    {icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-sm font-semibold text-foreground leading-tight">
                        {toast.title}
                    </p>
                    {toast.message && (
                        <p className="mt-1 text-sm text-muted-foreground leading-snug line-clamp-2">
                            {toast.message}
                        </p>
                    )}
                </div>

                {/* Close button */}
                <button
                    onClick={handleCloseClick}
                    className="
                        flex-shrink-0 p-1.5 -mr-1 -mt-0.5
                        rounded-lg
                        text-muted-foreground/60 hover:text-muted-foreground
                        hover:bg-muted/80
                        transition-colors duration-150
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
                    "
                    aria-label="Đóng thông báo"
                >
                    <X className="h-4 w-4" />
                </button>

                {/* Drag indicator */}
                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-muted-foreground/20 rounded-full" />
            </div>
        </motion.div>
    );
}

// ============================================================================
// TOAST CONTAINER COMPONENT
// ============================================================================

function ToastContainer() {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const unsubscribe = toastManager.subscribe(setToasts);
        return () => {
            unsubscribe();
        };
    }, []);

    const handleDismiss = useCallback((id: string) => {
        toastManager.dismiss(id);
    }, []);

    if (!mounted) return null;

    const containerContent = (
        <div
            className="
                fixed top-0 left-0 right-0 z-[9999]
                pointer-events-none
                pt-[calc(env(safe-area-inset-top)+0.75rem)]
                px-4
            "
        >
            <div className="relative w-full max-w-md mx-auto pointer-events-auto">
                <AnimatePresence mode="popLayout">
                    {toasts.map((toast, index) => (
                        <SingleToast
                            key={toast.id}
                            toast={toast}
                            index={index}
                            onDismiss={handleDismiss}
                        />
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );

    return createPortal(containerContent, document.body);
}

// ============================================================================
// TOAST PROVIDER COMPONENT
// ============================================================================

let isProviderMounted = false;

export function ProToastProvider() {
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        if (!isProviderMounted) {
            isProviderMounted = true;
            setShouldRender(true);
        }
        return () => {
            isProviderMounted = false;
        };
    }, []);

    if (!shouldRender) return null;
    return <ToastContainer />;
}

// ============================================================================
// PUBLIC API
// ============================================================================

export function showToast(options: ToastOptions): string {
    return toastManager.show(options);
}

export function dismissToast(id: string): void {
    toastManager.dismiss(id);
}

export function dismissAllToasts(): void {
    toastManager.dismissAll();
}

// Convenience methods
export const toast = {
    show: showToast,
    dismiss: dismissToast,
    dismissAll: dismissAllToasts,
    success: (title: string, options?: Omit<ToastOptions, 'title' | 'type'>) =>
        showToast({ title, type: 'success', ...options }),
    error: (title: string, options?: Omit<ToastOptions, 'title' | 'type'>) =>
        showToast({ title, type: 'error', ...options }),
    warning: (title: string, options?: Omit<ToastOptions, 'title' | 'type'>) =>
        showToast({ title, type: 'warning', ...options }),
    info: (title: string, options?: Omit<ToastOptions, 'title' | 'type'>) =>
        showToast({ title, type: 'info', ...options }),
    notification: (title: string, options?: Omit<ToastOptions, 'title' | 'type'>) =>
        showToast({ title, type: 'notification', ...options }),
};

// ============================================================================
// EXAMPLE USAGE
// ============================================================================
/*

// 1. Add ProToastProvider to your root layout (layout.tsx):

import { ProToastProvider } from '@/components/ui/pro-toast';

export default function RootLayout({ children }) {
    return (
        <html>
            <body>
                {children}
                <ProToastProvider />
            </body>
        </html>
    );
}

// 2. Use showToast anywhere in your app:

import { showToast, toast } from '@/components/ui/pro-toast';

// Basic usage
showToast({
    title: 'Thành công!',
    message: 'Đã lưu thay đổi của bạn.',
    type: 'success',
});

// With custom duration
showToast({
    title: 'Thông báo mới',
    message: 'Bạn có một tin nhắn mới từ quản lý.',
    type: 'notification',
    duration: 6000,
    onPress: () => {
        router.push('/messages');
    },
});

// Convenience methods
toast.success('Đã lưu!');
toast.error('Có lỗi xảy ra', { message: 'Vui lòng thử lại sau.' });
toast.warning('Cảnh báo', { duration: 5000 });
toast.info('Mẹo', { message: 'Vuốt lên để tắt thông báo.' });

// Custom icon
import { Star } from 'lucide-react';

showToast({
    title: 'Đánh giá 5 sao!',
    icon: <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />,
});

// Dismiss programmatically
const toastId = showToast({ title: 'Loading...' });
// Later...
dismissToast(toastId);

// Dismiss all
dismissAllToasts();

*/
