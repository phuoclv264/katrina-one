'use client';

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, getInitials } from '@/lib/utils';
import { AuthUser, ManagedUser } from '@/lib/types';

interface UserAvatarProps {
    user?: ManagedUser | AuthUser | null;
    size?: string;
    className?: string;
    fallbackClassName?: string;
    // Allow overriding the initials logic if needed
    nameOverride?: string;
    // Allow overriding the avatar URL directly
    avatarUrl?: string | null;
    // Shape control
    rounded?: 'full' | 'lg' | 'xl' | '2xl' | '3xl';
    children?: React.ReactNode;
}

export const UserAvatar = ({ 
    user, 
    size, 
    className, 
    fallbackClassName,
    nameOverride,
    avatarUrl,
    rounded = 'xl',
    children
}: UserAvatarProps) => {
    const displayName = nameOverride || user?.displayName;
    const photoURL = avatarUrl || user?.photoURL || undefined;

    const roundedClass = {
        'full': 'rounded-full',
        'lg': 'rounded-lg',
        'xl': 'rounded-xl',
        '2xl': 'rounded-2xl',
        '3xl': 'rounded-3xl',
    }[rounded];

    if (!user && !nameOverride) {
        return (
            <div className={cn(
                size, 
                roundedClass,
                "bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black italic text-slate-400 relative",
                className
            )}>
                ?
                {children}
            </div>
        );
    }

    return (
        <Avatar className={cn(size, roundedClass, "relative", className)}>
            <AvatarImage src={photoURL} alt={displayName || 'User'} className="object-cover" />
            <AvatarFallback className={cn(
                "bg-slate-100 dark:bg-slate-800 text-slate-500 font-black text-[10px] uppercase",
                roundedClass,
                fallbackClassName
            )}>
                {getInitials(displayName)}
            </AvatarFallback>
            {children}
        </Avatar>
    );
};
