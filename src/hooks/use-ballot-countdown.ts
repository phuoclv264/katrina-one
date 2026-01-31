import { useState, useEffect } from 'react';
import { toDateSafe } from '@/lib/utils';
import type { Event } from '@/lib/types';

export function useBallotCountdown(event: Event) {
    const [timeLeft, setTimeLeft] = useState<string>('');
    const [isEventEnded, setIsEventEnded] = useState(false);

    useEffect(() => {
        if (event.type !== 'ballot') return;

        const timer = setInterval(() => {
            const now = new Date();
            const drawTime = event.ballotConfig?.ballotDrawTime
                ? toDateSafe(event.ballotConfig.ballotDrawTime) || toDateSafe(event.endAt) || new Date()
                : toDateSafe(event.endAt) || new Date();
            
            const diff = drawTime.getTime() - now.getTime();
            
            if (diff <= 0) {
                setTimeLeft('Đã đến giờ rút thăm');
                setIsEventEnded(true);
                clearInterval(timer);
            } else {
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                
                if (hours > 0) {
                    setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
                } else if (minutes > 0) {
                    setTimeLeft(`${minutes}m ${seconds}s`);
                } else {
                    setTimeLeft(`${seconds}s`);
                }
                setIsEventEnded(false);
            }
        }, 1000);
        
        return () => clearInterval(timer);
    }, [event.type, event.endAt, event.ballotConfig?.ballotDrawTime]);

    return { timeLeft, isEventEnded };
}