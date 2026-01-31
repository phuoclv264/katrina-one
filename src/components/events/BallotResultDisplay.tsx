'use client';

import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, Sparkles, Gift } from 'lucide-react';
import { timestampToString } from '@/lib/utils';
import type { Event, AuthUser } from '@/lib/types';

interface BallotResultDisplayProps {
    event: Event;
    currentUser: AuthUser;
    eventDraws: any[];
}

export default function BallotResultDisplay({ event, currentUser, eventDraws }: BallotResultDisplayProps) {
    const hasDrawn = eventDraws.length > 0;
    const isWinner = hasDrawn && eventDraws[0].winners.some((w: any) => w.userId === currentUser.uid);

    const getBallotMessage = () => {
        if (isWinner) {
            return event.ballotConfig?.resultMessage || 'Chúc mừng bạn đã trúng thưởng! 🎉';
        }
        return event.ballotConfig?.loserMessage || 'Cảm ơn bạn đã tham gia! Lần sau may mắn hơn nhé! 💪';
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6"
        >
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.2 }}
                className={`h-24 w-24 mx-auto rounded-full flex items-center justify-center border-4 ${
                    isWinner 
                        ? 'bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 border-green-500' 
                        : 'bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 border-blue-500'
                }`}
            >
                {isWinner ? (
                    <motion.div
                        animate={{ 
                            rotate: [0, 10, -10, 0],
                            scale: [1, 1.1, 1]
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                    >
                        <Trophy className="h-12 w-12 text-green-600 dark:text-green-400" />
                    </motion.div>
                ) : (
                    <Sparkles className="h-12 w-12 text-blue-600 dark:text-blue-400" />
                )}
            </motion.div>

            <div className="space-y-3 max-w-[300px] mx-auto">
                <motion.h3 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-2xl font-bold"
                >
                    {isWinner ? 'Chúc mừng!' : 'Cảm ơn!'}
                </motion.h3>
                
                <motion.p 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-muted-foreground text-sm"
                >
                    {getBallotMessage()}
                </motion.p>

                {event.prize && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="p-4 bg-white/50 dark:bg-gray-900/50 rounded-2xl border border-primary/10"
                    >
                        <div className="flex items-center justify-center gap-3">
                            <Gift className="h-6 w-6 text-primary" />
                            <div>
                                <h4 className="font-bold text-primary">{event.prize.name}</h4>
                                {event.prize.description && (
                                    <p className="text-xs text-muted-foreground mt-1">{event.prize.description}</p>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}

                {hasDrawn && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="pt-4 border-t border-border"
                    >
                        <p className="text-xs text-muted-foreground">
                            Kết quả được công bố vào {timestampToString(eventDraws[0].drawnAt, 'HH:mm - dd/MM/yyyy')}
                        </p>
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
}