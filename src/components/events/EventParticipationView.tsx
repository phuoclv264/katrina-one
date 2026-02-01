'use client';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CheckCircle, Star, MessageSquare, ClipboardCheck, Trophy, Users, Sparkles, Info } from 'lucide-react';
import { toDateSafe } from '@/lib/utils';
import { toast } from '@/components/ui/pro-toast';
import { getUserVote, submitVote, getEventDraws } from '@/lib/events-store';
import type { Event, AuthUser, EventVote } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { UserAvatar } from '@/components/user-avatar';
import { Textarea } from '@/components/ui/textarea';
import { motion, AnimatePresence } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import BallotEventView from './BallotEventView';

const StarRating = ({ rating, onRatingChange, disabled = false }: { rating: number, onRatingChange: (rating: number) => void, disabled?: boolean }) => {
    const [hovered, setHovered] = useState(0);

    return (
        <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
                <motion.button
                    key={star}
                    type="button"
                    whileHover={!disabled ? { scale: 1.2 } : {}}
                    whileTap={!disabled ? { scale: 0.9 } : {}}
                    onClick={() => !disabled && onRatingChange(star)}
                    onMouseEnter={() => !disabled && setHovered(star)}
                    onMouseLeave={() => !disabled && setHovered(0)}
                    className="relative"
                    disabled={disabled}
                >
                    <Star
                        className={`h-7 w-7 transition-all duration-200 ${star <= (hovered || rating)
                            ? 'text-yellow-400 fill-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]'
                            : 'text-muted-foreground/30'
                            }`}
                    />
                </motion.button>
            ))}
        </div>
    );
};

export type EventParticipationViewProps = {
    event: Event;
    currentUser: AuthUser;
    onSuccess?: () => void;
};

export default function EventParticipationView({ event, currentUser, onSuccess }: EventParticipationViewProps) {
    const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
    const [userVote, setUserVote] = useState<EventVote | null | undefined>(undefined);
    const [isProcessing, setIsProcessing] = useState(false);
    const [ratings, setRatings] = useState<{ [candidateId: string]: number }>({});
    const [comments, setComments] = useState<{ [candidateId: string]: string }>({});
    const [generalComment, setGeneralComment] = useState('');
    const [missingReviewIds, setMissingReviewIds] = useState<string[]>([]);
    const [eventDraws, setEventDraws] = useState<any[]>([]);
    const [isEventEnded, setIsEventEnded] = useState(false);

    const allCandidates = useMemo(() => [...(event.candidates || []), ...(event.options || [])], [event]);
    const ratedCount = useMemo(() => Object.values(ratings).filter(r => r > 0).length, [ratings]);
    const reviewProgress = useMemo(() => (ratedCount / allCandidates.length) * 100, [ratedCount, allCandidates.length]);

    useEffect(() => {
        setUserVote(undefined);
        
        Promise.all([
            getUserVote(event.id, currentUser.uid),
            event.type === 'ballot' ? getEventDraws(event.id) : Promise.resolve([])
        ]).then(([vote, draws]) => {
            setUserVote(vote);
            if (event.type === 'ballot') {
                setEventDraws(draws);
                const now = new Date();
                const eventEndTime = toDateSafe(event.endAt) || new Date();
                setIsEventEnded(now >= eventEndTime);
            }
            if (vote) {
                setSelectedCandidates(vote.votes || []);
                setRatings(vote.ratings || {});
                setComments(vote.comments || {});
                setGeneralComment(vote.comments?.general || '');
                setMissingReviewIds([]);
            } else {
                setSelectedCandidates([]);
                setRatings({});
                setComments({});
                setGeneralComment('');
                setMissingReviewIds([]);
            }
        });
    }, [event.id, event.type, event.endAt, currentUser.uid]);

    const handleSingleVoteChange = (value: string) => {
        setSelectedCandidates([value]);
    };

    const handleMultiVoteChange = (candidateId: string, checked: boolean) => {
        setSelectedCandidates(prev => {
            const maxVotes = event.maxVotesPerUser || 1;
            if (checked) {
                if (prev.includes(candidateId)) return prev;
                if (prev.length < maxVotes) {
                    return [...prev, candidateId];
                }
                return [...prev.slice(1), candidateId];
            } else {
                return prev.filter(id => id !== candidateId);
            }
        });
    };

    const handleRatingChange = (candidateId: string, rating: number) => {
        setRatings(prev => ({ ...prev, [candidateId]: rating }));
        setMissingReviewIds(prev => prev.filter(id => id !== candidateId));
    };

    const canSubmit = useMemo(() => {
        if (isProcessing || userVote !== null) return false;
        if (event.type === 'ballot' && isEventEnded) return false;

        switch (event.type) {
            case 'vote':
                return selectedCandidates.length === 1;
            case 'multi-vote':
                return selectedCandidates.length > 0 && selectedCandidates.length <= (event.maxVotesPerUser || 1);
            case 'review':
                return ratedCount === allCandidates.length;
            case 'ballot':
                return true;
            default:
                return false;
        }
    }, [event.type, event.maxVotesPerUser, selectedCandidates, ratedCount, allCandidates.length, isProcessing, userVote, isEventEnded]);

    const handleSubmit = async () => {
        if (!canSubmit) return;

        setIsProcessing(true);
        try {
            const voteData: Omit<EventVote, 'id' | 'createdAt'> = {
                eventId: event.id,
                userId: currentUser.uid,
                userDisplay: {
                    name: currentUser.displayName,
                    role: currentUser.role,
                },
            };

            if (event.type === 'vote' || event.type === 'multi-vote' || event.type === 'ballot') {
                voteData.votes = event.type === 'ballot' ? [currentUser.uid] : selectedCandidates;
                if (event.allowComments && generalComment.trim()) {
                    voteData.comments = { general: generalComment.trim() };
                }
            }

            if (event.type === 'review') {
                voteData.ratings = ratings;
                voteData.comments = comments;
            }

            await submitVote(event.id, voteData);
            toast.success('Cảm ơn bạn đã tham gia!');
            setUserVote(voteData as any);
            onSuccess?.();
        } catch (error) {
            console.error('Failed to submit vote:', error);
            toast.error('Không thể gửi bình chọn. Vui lòng thử lại.');
        } finally {
            setIsProcessing(false);
        }
    };

    const renderContent = () => {
        if (userVote && event.type !== 'ballot') {
            return (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center py-12 text-center space-y-6"
                >
                    <div className="relative">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.2 }}
                            className="h-24 w-24 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center"
                        >
                            <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
                        </motion.div>
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-2xl font-bold text-foreground">Tuyệt vời!</h3>
                        <p className="text-muted-foreground max-w-[280px]">
                            Bạn đã hoàn thành tham gia sự kiện <span className="font-semibold text-primary">{event.title}</span>.
                        </p>
                    </div>
                </motion.div>
            );
        }

        switch (event.type) {
            case 'vote':
                return (
                    <RadioGroup
                        value={selectedCandidates[0]}
                        onValueChange={handleSingleVoteChange}
                        className="space-y-4"
                    >
                        <div className="space-y-3">
                            {allCandidates.map((candidate, idx) => (
                                <motion.div
                                    key={candidate.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                >
                                    <Label
                                        htmlFor={`candidate-${candidate.id}`}
                                        className="flex items-center gap-4 rounded-xl border-2 p-4 cursor-pointer hover:bg-accent/50 transition-all [&:has([data-state=checked])]:border-emerald-500 [&:has([data-state=checked])]:bg-emerald-50/50 dark:[&:has([data-state=checked])]:bg-emerald-500/10 [&:has([data-state=checked])]:shadow-sm"
                                    >
                                        <UserAvatar
                                            avatarUrl={candidate.avatarUrl}
                                            nameOverride={candidate.name}
                                            size="h-12 w-12"
                                            className="border-2 border-background shadow-sm"
                                        />
                                        <div className="flex-1">
                                            <span className="font-bold text-base">{candidate.name}</span>
                                            {candidate.meta?.role && <p className="text-xs text-muted-foreground font-medium">{candidate.meta.role}</p>}
                                        </div>
                                        <RadioGroupItem value={candidate.id} id={`candidate-${candidate.id}`} className="h-5 w-5" />
                                    </Label>
                                </motion.div>
                            ))}
                        </div>

                        {event.allowComments && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="mt-8 space-y-3"
                            >
                                <Label className="text-sm font-bold flex items-center gap-2">
                                    <MessageSquare className="h-4 w-4 text-primary" />
                                    Lời nhắn hoặc góp ý
                                </Label>
                                <Textarea
                                    placeholder="Để lại bình luận của bạn (không bắt buộc)..."
                                    value={generalComment}
                                    onChange={(e) => setGeneralComment(e.target.value)}
                                    rows={3}
                                    className="resize-none bg-background focus:ring-1 focus:ring-primary rounded-xl"
                                />
                            </motion.div>
                        )}
                    </RadioGroup>
                );
            case 'multi-vote':
                const maxVotes = event.maxVotesPerUser || 1;
                return (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg border border-dashed">
                            <p className="text-sm font-medium text-muted-foreground">
                                Chọn tối đa <span className="text-foreground font-bold">{maxVotes}</span> lựa chọn
                            </p>
                            <Badge variant={selectedCandidates.length === maxVotes ? "default" : "secondary"} className="rounded-full">
                                {selectedCandidates.length} / {maxVotes}
                            </Badge>
                        </div>
                        <div className="space-y-3">
                            {allCandidates.map((candidate, idx) => (
                                <motion.div
                                    key={candidate.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                >
                                    <Label
                                        htmlFor={`candidate-${candidate.id}`}
                                        className="flex items-center gap-4 rounded-xl border-2 p-4 cursor-pointer hover:bg-accent/50 transition-all [&:has([data-state=checked])]:border-emerald-500 [&:has([data-state=checked])]:bg-emerald-50/50 dark:[&:has([data-state=checked])]:bg-emerald-500/10 [&:has([data-state=checked])]:shadow-sm"
                                    >
                                        <UserAvatar
                                            avatarUrl={candidate.avatarUrl}
                                            nameOverride={candidate.name}
                                            size="h-12 w-12"
                                            className="border-2 border-background shadow-sm"
                                        />
                                        <div className="flex-1">
                                            <span className="font-bold text-base">{candidate.name}</span>
                                            {candidate.meta?.role && <p className="text-xs text-muted-foreground font-medium">{candidate.meta.role}</p>}
                                        </div>
                                        <Checkbox
                                            id={`candidate-${candidate.id}`}
                                            checked={selectedCandidates.includes(candidate.id)}
                                            onCheckedChange={(checked) => handleMultiVoteChange(candidate.id, !!checked)}
                                            className="h-5 w-5 rounded-md"
                                        />
                                    </Label>
                                </motion.div>
                            ))}
                        </div>

                        {event.allowComments && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="mt-8 space-y-4 p-1"
                            >
                                <Label className="text-sm font-bold flex items-center gap-2">
                                    <MessageSquare className="h-4 w-4 text-primary" />
                                    Lời nhắn hoặc góp ý
                                </Label>
                                <Textarea
                                    placeholder="Để lại bình luận của bạn (không bắt buộc)..."
                                    value={generalComment}
                                    onChange={(e) => setGeneralComment(e.target.value)}
                                    rows={3}
                                    className="bg-background focus:ring-1 focus:ring-primary rounded-xl"
                                />
                            </motion.div>
                        )}
                    </div>
                );
            case 'review':
                return (
                    <div className="space-y-6">
                        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-4 pt-1 space-y-2">
                            <div className="flex items-center justify-between text-sm font-medium">
                                <span>Tiến độ đánh giá</span>
                                <span className={reviewProgress === 100 ? "text-green-600" : "text-primary"}>
                                    {ratedCount} / {allCandidates.length}
                                </span>
                            </div>
                            <Progress value={reviewProgress} className="h-2" />
                        </div>

                        <div className="space-y-4">
                            {allCandidates.map((candidate, idx) => (
                                <motion.div
                                    key={candidate.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                >
                                    <Card
                                        id={`candidate-card-${candidate.id}`}
                                        className={`overflow-hidden transition-all duration-300 ${missingReviewIds.includes(candidate.id)
                                            ? 'ring-2 ring-red-500 shadow-md shadow-red-100 dark:shadow-red-900/20'
                                            : ratings[candidate.id]
                                                ? 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/10'
                                                : 'hover:border-emerald-500/20'
                                            }`}
                                    >
                                        <CardContent className="p-5 space-y-4">
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                                <div className="flex items-center gap-3 flex-1">
                                                    <UserAvatar
                                                        avatarUrl={candidate.avatarUrl}
                                                        nameOverride={candidate.name}
                                                        size="h-12 w-12"
                                                        className="border-2 border-background shadow-sm"
                                                    />
                                                    <div className="flex-1">
                                                        <p className="font-bold text-base leading-tight">{candidate.name}</p>
                                                        {candidate.meta?.role && <p className="text-xs text-muted-foreground font-medium">{candidate.meta.role}</p>}
                                                    </div>
                                                </div>
                                                <div className="flex justify-center sm:justify-end">
                                                    <StarRating
                                                        rating={ratings[candidate.id] || 0}
                                                        onRatingChange={(rating) => handleRatingChange(candidate.id, rating)}
                                                    />
                                                </div>
                                            </div>

                                            <AnimatePresence>
                                                {(ratings[candidate.id] > 0 && event.allowComments) && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <Textarea
                                                            placeholder="Để lại bình luận hoặc góp ý (không bắt buộc)..."
                                                            value={comments[candidate.id] || ''}
                                                            onChange={(e) => setComments(prev => ({ ...prev, [candidate.id]: e.target.value }))}
                                                            rows={2}
                                                            className="resize-none bg-background/50 focus:bg-background transition-colors rounded-xl"
                                                        />
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                );
            case 'ballot':
                return (
                    <BallotEventView
                        event={event}
                        currentUser={currentUser}
                        userVote={userVote}
                        eventDraws={eventDraws}
                        onParticipate={handleSubmit}
                        isProcessing={isProcessing}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className="flex flex-col h-full">
            <ScrollArea className="flex-1 p-0">
                <div className="p-5 sm:p-8">
                    {isProcessing && userVote === undefined ? (
                        <div className="flex flex-col items-center justify-center space-y-4">
                            <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
                            <p className="text-sm text-muted-foreground animate-pulse font-bold uppercase tracking-widest text-[10px]">Đang tải dữ liệu...</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {!userVote && event.description && (
                                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                                    <div className="flex items-center gap-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">
                                        <Info className="h-3.5 w-3.5" />
                                        Mô tả sự kiện
                                    </div>
                                    <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed italic">
                                        {event.description}
                                    </p>
                                </div>
                            )}
                            {renderContent()}
                        </div>
                    )}
                </div>
            </ScrollArea>

            {!userVote && event.type !== 'ballot' && (
                <DialogFooter className="p-6 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 mt-auto shrink-0 sticky bottom-0 z-10">
                    <Button
                        size="lg"
                        className="w-full h-14 rounded-[1.5rem] font-black text-sm uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale"
                        onClick={handleSubmit}
                        disabled={!canSubmit || isProcessing}
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Đang xử lý...
                            </>
                        ) : (
                            <>
                                Gửi kết quả
                                <ClipboardCheck className="ml-2 h-5 w-5" />
                            </>
                        )}
                    </Button>
                </DialogFooter>
            )}
        </div>
    );
}

