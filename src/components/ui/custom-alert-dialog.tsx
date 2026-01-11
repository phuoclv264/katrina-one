'use client';

import React from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomAlertDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    title: React.ReactNode;
    description: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void | Promise<void>;
    onCancel?: () => void;
    variant?: 'primary' | 'destructive' | 'warning';
    icon?: LucideIcon;
    isLoading?: boolean;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    showConfirm?: boolean;
    showCancel?: boolean;
}

export function CustomAlertDialog({
    isOpen,
    onOpenChange,
    title,
    description,
    confirmText = "Xác nhận",
    cancelText = "Hủy",
    onConfirm,
    onCancel,
    variant = 'primary',
    icon: Icon,
    isLoading = false,
    maxWidth = 'md',
    showConfirm = true,
    showCancel = true
}: CustomAlertDialogProps) {
    
    const handleConfirm = async (e: React.MouseEvent) => {
        if (onConfirm) {
            e.preventDefault();
            await onConfirm();
        }
    };

    const variantStyles = {
        primary: {
            iconBg: "bg-blue-100/50 dark:bg-blue-900/20",
            iconHalo: "bg-blue-100 dark:bg-blue-900/40",
            iconColor: "text-blue-600 dark:text-blue-400",
            button: "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/25",
        },
        destructive: {
            iconBg: "bg-red-100/50 dark:bg-red-950/20",
            iconHalo: "bg-red-100 dark:bg-red-950/40",
            iconColor: "text-red-600 dark:text-red-400",
            button: "bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-red-500/25",
        },
        warning: {
            iconBg: "bg-amber-100/50 dark:bg-amber-950/20",
            iconHalo: "bg-amber-100 dark:bg-amber-950/40",
            iconColor: "text-amber-600 dark:text-amber-400",
            button: "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-amber-500/25",
        }
    };

    const maxWidthClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl'
    };

    return (
        <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
            <AlertDialogContent className={cn(
                "rounded-[42px] p-0 overflow-hidden border-none shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] bg-white dark:bg-slate-950",
                maxWidthClasses[maxWidth]
            )}>
                <div className="p-8 pb-10">
                    <AlertDialogHeader className="space-y-6">
                        {Icon && (
                            <div className="flex justify-center sm:justify-start">
                                <div className={cn(
                                    "relative h-20 w-20 rounded-[28px] flex items-center justify-center transition-transform hover:scale-105 duration-500",
                                    variantStyles[variant].iconBg
                                )}>
                                    <div className={cn(
                                        "absolute inset-2 rounded-[22px] opacity-50 blur-xl animate-pulse",
                                        variantStyles[variant].iconHalo
                                    )} />
                                    <div className={cn(
                                        "h-14 w-14 rounded-[20px] flex items-center justify-center z-10 shadow-inner border border-white/20 dark:border-white/5",
                                        variantStyles[variant].iconHalo
                                    )}>
                                        <Icon className={cn("h-7 w-7", variantStyles[variant].iconColor)} />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="space-y-2 text-center sm:text-left">
                            <AlertDialogTitle className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-50 leading-[1.1] border-none">
                                {title}
                            </AlertDialogTitle>
                            <AlertDialogDescription asChild>
                                <div className="text-[15px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed pt-2">
                                    {description}
                                </div>
                            </AlertDialogDescription>
                        </div>
                    </AlertDialogHeader>
                    
                    <AlertDialogFooter className="mt-12 flex-col-reverse sm:flex-row gap-3">
                        {showCancel && (
                            <AlertDialogCancel 
                                onClick={onCancel}
                                disabled={isLoading}
                                className="h-14 flex-1 rounded-2xl font-black border-none bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/80 transition-all active:scale-[0.98]"
                            >
                                {cancelText}
                            </AlertDialogCancel>
                        )}
                        {showConfirm && (
                            <AlertDialogAction
                                onClick={handleConfirm}
                                disabled={isLoading}
                                className={cn(
                                    "h-14 flex-[1.4] rounded-2xl font-black transition-all shadow-[0_12px_24px_-8px] active:scale-[0.98] border-t border-white/20 dark:border-white/5",
                                    variantStyles[variant].button
                                )}
                            >
                                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                                <span className="tracking-tight">{confirmText}</span>
                            </AlertDialogAction>
                        )}
                    </AlertDialogFooter>
                </div>
                
                {/* Decorative background element */}
                <div className={cn(
                    "absolute -bottom-24 -left-24 h-48 w-48 rounded-full blur-[80px] opacity-10 pointer-events-none",
                    variantStyles[variant].iconHalo
                )} />
            </AlertDialogContent>
        </AlertDialog>
    );
}
