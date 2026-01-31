'use client';

import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Clock, Gift } from 'lucide-react';
import { timestampToString } from '@/lib/utils';
import type { Event } from '@/lib/types';

interface BallotCountdownDisplayProps {
    timeLeft: string;
    event: Event;
}

export default function BallotCountdownDisplay({ timeLeft, event }: BallotCountdownDisplayProps) {
    const isCustomDrawTime = !!event.ballotConfig?.ballotDrawTime;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-4"
        >
            <div className="relative inline-block">
                <motion.div
                    animate={{ 
                        rotate: [0, 360],
                        scale: [1, 1.1, 1]
                    }}
                    transition={{ 
                        duration: 3, 
                        repeat: Infinity,
                        ease: "linear"
                    }}
                    className="h-20 w-20 mx-auto rounded-full bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/40 dark:to-amber-800/30 flex items-center justify-center shadow-lg"
                >
                    <Clock className="h-10 w-10 text-amber-600 dark:text-amber-400" />
                </motion.div>
                <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -inset-2 rounded-full bg-amber-400/20 dark:bg-amber-500/10"
                />
            </div>

            <div className="space-y-2">
                <h3 className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                    Rút thăm may mắn
                </h3>
                <p className="text-muted-foreground text-sm max-w-[280px] mx-auto">
                    {isCustomDrawTime 
                        ? 'Thời gian chờ đợi cho đến khi rút thăm' 
                        : 'Sự kiện sắp kết thúc, rút thăm sẽ diễn ra'
                    }
                </p>
            </div>

            <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800">
                <CardContent className="p-6 space-y-3">
                    <div className="flex items-center justify-center gap-2">
                        <Calendar className="h-4 w-4 text-amber-600" />
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                            {isCustomDrawTime ? 'Giờ rút thăm' : 'Kết thúc sự kiện'}
                        </span>
                    </div>
                    
                    <div className="text-center">
                        <motion.div
                            key={timeLeft}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent"
                        >
                            {timeLeft}
                        </motion.div>
                        {isCustomDrawTime && event.ballotConfig?.ballotDrawTime && (
                            <p className="text-xs text-muted-foreground mt-1">
                                {timestampToString(event.ballotConfig.ballotDrawTime, 'HH:mm - dd/MM/yyyy')}
                            </p>
                        )}
                    </div>

                    {event.prize && (
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="p-3 bg-white/60 dark:bg-gray-900/40 rounded-xl border border-amber-200 dark:border-amber-700"
                        >
                            <div className="flex items-center gap-3">
                                <Gift className="h-5 w-5 text-amber-600" />
                                <div className="flex-1">
                                    <h4 className="font-bold text-amber-800 dark:text-amber-300">{event.prize.name}</h4>
                                    {event.prize.description && (
                                        <p className="text-xs text-amber-700 dark:text-amber-400">{event.prize.description}</p>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
}