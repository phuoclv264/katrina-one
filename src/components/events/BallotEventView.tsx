'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
    Trophy, 
    Sparkles, 
    Clock, 
    CheckCircle2, 
    Gift, 
    Calendar,
    AlertCircle,
    PartyPopper
} from 'lucide-react';
import { useBallotCountdown } from '@/hooks/use-ballot-countdown';
import { timestampToString } from '@/lib/utils';
import type { Event, AuthUser, EventVote, PrizeDrawResult } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

interface BallotEventViewProps {
    event: Event;
    currentUser: AuthUser;
    userVote: EventVote | null | undefined;
    eventDraws: PrizeDrawResult[];
    onParticipate: () => void;
    isProcessing?: boolean;
}

export default function BallotEventView({
    event,
    currentUser,
    userVote,
    eventDraws,
    onParticipate,
    isProcessing = false
}: BallotEventViewProps) {
    const { timeLeft, isEventEnded } = useBallotCountdown(event);
    const hasDrawn = eventDraws.length > 0;
    const isWinner = hasDrawn && eventDraws[0].winners.some((w) => w.userId === currentUser.uid);
    const hasJoined = !!userVote;

    const drawTime = useMemo(() => {
        return event.ballotConfig?.ballotDrawTime || event.endAt;
    }, [event.ballotConfig?.ballotDrawTime, event.endAt]);

    const getStatusInfo = () => {
        if (hasDrawn) return { label: 'Đã có kết quả', color: 'bg-green-500' };
        if (isEventEnded) return { label: 'Đang rút thăm', color: 'bg-amber-500' };
        if (hasJoined) return { label: 'Đã tham gia', color: 'bg-blue-500' };
        return { label: 'Đang diễn ra', color: 'bg-primary' };
    };

    const status = getStatusInfo();

    return (
        <div className="space-y-6">
            {/* Status Header */}
            <div className="flex items-center justify-between">
                <Badge className={`${status.color} text-white border-none px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest`}>
                    {status.label}
                </Badge>
                {!hasDrawn && (
                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                        <Clock className="h-3 w-3" />
                        {timeLeft}
                    </div>
                )}
            </div>

            <AnimatePresence mode="wait">
                {hasDrawn ? (
                    /* STATE: Result Revealed */
                    <motion.div
                        key="result"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="text-center space-y-6 py-4"
                    >
                        <div className="relative inline-block">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", damping: 12, stiffness: 200 }}
                                className={`h-24 w-24 rounded-full flex items-center justify-center border-4 ${
                                    isWinner 
                                        ? 'bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 border-green-500 shadow-lg shadow-green-500/20' 
                                        : 'bg-gradient-to-br from-zinc-100 to-slate-100 dark:from-zinc-900/30 dark:to-slate-900/30 border-zinc-400 shadow-lg'
                                }`}
                            >
                                {isWinner ? (
                                    <Trophy className="h-12 w-12 text-green-600 dark:text-green-400" />
                                ) : (
                                    <Sparkles className="h-12 w-12 text-zinc-500" />
                                )}
                            </motion.div>
                            {isWinner && (
                                <motion.div
                                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="absolute -inset-2 rounded-full border-2 border-green-500/30"
                                />
                            )}
                        </div>

                        <div className="space-y-2">
                            <h3 className={`text-2xl font-black uppercase tracking-tight ${isWinner ? 'text-green-600 dark:text-green-400' : 'text-foreground'}`}>
                                {isWinner ? 'Chúc mừng bạn!' : hasJoined ? 'Cảm ơn bạn!' : 'Sự kiện kết thúc'}
                            </h3>
                            <p className="text-muted-foreground text-sm font-medium px-4">
                                {isWinner 
                                    ? (event.ballotConfig?.resultMessage || 'Bạn đã trúng thưởng trong đợt rút thăm này!')
                                    : hasJoined 
                                        ? (event.ballotConfig?.loserMessage || 'Rất tiếc, bạn không nằm trong danh sách trúng thưởng lần này.')
                                        : 'Bạn đã bỏ lỡ cơ hội tham gia sự kiện rút thăm này.'
                                }
                            </p>
                        </div>

                        {event.prize && (
                            <div className="bg-muted/30 rounded-2xl p-4 border border-border/50 max-w-sm mx-auto">
                                <div className="flex items-center gap-3 text-left">
                                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <Gift className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm leading-tight text-primary uppercase tracking-wide">Giải thưởng</h4>
                                        <p className="font-medium text-sm text-foreground">{event.prize.name}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        <div className="pt-2">
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                                Rút thăm lúc: {timestampToString(eventDraws[0].drawnAt, 'HH:mm - dd/MM/yyyy')}
                            </p>
                        </div>
                    </motion.div>
                ) : (
                    /* STATE: Countdown & Joining */
                    <motion.div
                        key="not-drawn"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-6"
                    >
                        <div className="text-center space-y-4">
                            <div className="relative inline-block">
                                <motion.div
                                    animate={{ 
                                        rotate: [0, 360],
                                    }}
                                    transition={{ 
                                        duration: 20, 
                                        repeat: Infinity,
                                        ease: "linear"
                                    }}
                                    className="h-32 w-32 mx-auto rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border-2 border-dashed border-primary/20"
                                >
                                    <div className="text-center p-2">
                                        {isEventEnded ? (
                                            <Sparkles className="h-8 w-8 text-primary mx-auto" />
                                        ) : (
                                            <>
                                                <span className="text-2xl font-black text-primary leading-none tabular-nums">
                                                    {timeLeft.split(' ')[0]}
                                                </span>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">
                                                    {timeLeft.includes(' ') ? 'Còn lại' : 'Giây'}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                </motion.div>
                                <motion.div
                                    animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.3, 0.1] }}
                                    transition={{ duration: 3, repeat: Infinity }}
                                    className="absolute -inset-4 rounded-full bg-primary/20 -z-10"
                                />
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-xl font-black uppercase tracking-tight text-foreground">
                                    {isEventEnded ? 'Đang thực hiện rút thăm' : hasJoined ? 'Chờ đợi kết quả' : 'Cơ hội may mắn'}
                                </h3>
                                {!isEventEnded && (
                                    <div className="flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground">
                                        <Calendar className="h-3 w-3" />
                                        Rút thăm vào: {timestampToString(drawTime, 'HH:mm - dd/MM/yyyy')}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Joined Status or Join Action */}
                        <div className="p-1">
                            {hasJoined ? (
                                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 text-center space-y-3 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-2 opacity-10">
                                        <CheckCircle2 className="h-16 w-16" />
                                    </div>
                                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2 text-primary">
                                        <CheckCircle2 className="h-6 w-6" />
                                    </div>
                                    <p className="font-black uppercase tracking-widest text-xs text-primary">Bạn đã tham gia thành công!</p>
                                    <p className="text-xs text-muted-foreground max-w-[200px] mx-auto leading-relaxed">
                                        Hệ thống đã ghi nhận tên bạn. Vui lòng quay lại sau khi đồng hồ đếm ngược kết thúc để xem kết quả.
                                    </p>
                                </div>
                            ) : isEventEnded ? (
                                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 text-center space-y-2">
                                    <AlertCircle className="h-8 w-8 text-amber-500 mx-auto" />
                                    <p className="font-bold text-amber-700 dark:text-amber-400">Đã hết thời gian tham gia</p>
                                    <p className="text-xs text-muted-foreground">Vui lòng chờ trong giây lát để hệ thống thực hiện rút thăm.</p>
                                </div>
                            ) : (
                                <motion.div
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <Button
                                        onClick={onParticipate}
                                        disabled={isProcessing}
                                        className="w-full h-14 rounded-2xl text-base font-black uppercase tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/20 group relative overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
                                        {isProcessing ? (
                                            <div className="flex items-center gap-2">
                                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                                                    <Sparkles className="h-5 w-5" />
                                                </motion.div>
                                                ĐANG XỬ LÝ...
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <PartyPopper className="h-5 w-5" />
                                                THAM GIA NGAY
                                            </div>
                                        )}
                                    </Button>
                                    <p className="text-[10px] text-muted-foreground text-center mt-3 font-bold uppercase tracking-widest opacity-60">
                                        Mỗi nhân viên chỉ được tham gia 1 lần
                                    </p>
                                </motion.div>
                            )}
                        </div>

                        {/* {event.prize && (
                            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/10 rounded-2xl overflow-hidden">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                                            <Gift className="h-6 w-6 text-primary" />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-xs text-primary uppercase tracking-widest leading-none mb-1">Cơ cấu giải thưởng</h4>
                                            <p className="font-bold text-sm text-foreground">{event.prize.name}</p>
                                            {event.prize.description && (
                                                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{event.prize.description}</p>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )} */}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
