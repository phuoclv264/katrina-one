'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Trophy, Sparkles } from 'lucide-react';
import { useBallotCountdown } from '@/hooks/use-ballot-countdown';
import BallotCountdownDisplay from './BallotCountdownDisplay';
import BallotResultDisplay from './BallotResultDisplay';
import type { Event, AuthUser } from '@/lib/types';

interface BallotCountdownProps {
    event: Event;
    currentUser: AuthUser;
    userVote: any;
    eventDraws: any[];
    onParticipate: () => void;
    isProcessing?: boolean;
}

export default function BallotCountdown({ 
    event, 
    currentUser, 
    userVote, 
    eventDraws, 
    onParticipate,
    isProcessing = false
}: BallotCountdownProps) {
    const { timeLeft, isEventEnded } = useBallotCountdown(event);

    return (
        <AnimatePresence mode="wait">
            {!userVote ? (
                <div key="countdown-section" className="text-center space-y-6">
                    <BallotCountdownDisplay timeLeft={timeLeft} event={event} />
                    
                    {!isEventEnded && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            <Button
                                onClick={onParticipate}
                                disabled={isProcessing}
                                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/30 transition-all duration-300"
                            >
                                {isProcessing ? (
                                    <>
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                        >
                                            <Sparkles className="h-4 w-4 mr-2" />
                                        </motion.div>
                                        Đang xử lý...
                                    </>
                                ) : (
                                    <>
                                        <Trophy className="h-4 w-4 mr-2" />
                                        Tham gia rút thăm
                                    </>
                                )}
                            </Button>
                            <p className="text-xs text-muted-foreground text-center mt-2">
                                Mỗi người chỉ được tham gia 1 lần duy nhất
                            </p>
                        </motion.div>
                    )}
                </div>
            ) : (
                <BallotResultDisplay 
                    key="result-section"
                    event={event} 
                    currentUser={currentUser} 
                    eventDraws={eventDraws} 
                />
            )}
        </AnimatePresence>
    );
}