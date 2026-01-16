
'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle, Info, Star, Send, Trophy, Users, StarHalf, ClipboardCheck, Sparkles } from 'lucide-react';
import { toast } from '@/components/ui/pro-toast';
import { getUserVote, submitVote } from '@/lib/events-store';
import type { Event, EventCandidate, AuthUser, EventVote } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { motion, AnimatePresence } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

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

type VoteModalProps = {
    isOpen: boolean;
    onClose: () => void;
    event: Event;
    currentUser: AuthUser;
    parentDialogTag: string;
};

export default function VoteModal({ isOpen, onClose, event, currentUser, parentDialogTag }: VoteModalProps) {
    const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
    const [userVote, setUserVote] = useState<EventVote | null | undefined>(undefined); // undefined means still loading
    const [isProcessing, setIsProcessing] = useState(false);
    const [ratings, setRatings] = useState<{ [candidateId: string]: number }>({});
    const [comments, setComments] = useState<{ [candidateId: string]: string }>({});
    const [missingReviewIds, setMissingReviewIds] = useState<string[]>([]);

    const allCandidates = useMemo(() => [...(event.candidates || []), ...(event.options || [])], [event]);

    const ratedCount = useMemo(() => Object.values(ratings).filter(r => r > 0).length, [ratings]);
    const reviewProgress = useMemo(() => (ratedCount / allCandidates.length) * 100, [ratedCount, allCandidates.length]);

    useEffect(() => {
        if (isOpen) {
            setIsProcessing(true);
            setUserVote(undefined);
            getUserVote(event.id, currentUser.uid).then(vote => {
                setUserVote(vote);
                if (vote) {
                    setSelectedCandidates(vote.votes || []);
                    setRatings(vote.ratings || {});
                    setComments(vote.comments || {});
                    setMissingReviewIds([]);
                } else {
                    setSelectedCandidates([]);
                    setRatings({});
                    setComments({});
                    setMissingReviewIds([]);
                }
                setIsProcessing(false);
            });
        }
    }, [isOpen, event.id, currentUser.uid]);

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
                const newSelection = [...prev.slice(1), candidateId];
                return newSelection;
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
    }, [event.type, event.maxVotesPerUser, selectedCandidates, ratedCount, allCandidates.length, isProcessing, userVote]);

    const getEventIcon = () => {
        switch (event.type) {
            case 'vote': return <Trophy className="h-5 w-5 text-yellow-500" />;
            case 'multi-vote': return <Users className="h-5 w-5 text-blue-500" />;
            case 'review': return <Star className="h-5 w-5 text-orange-500" />;
            case 'ballot': return <Sparkles className="h-5 w-5 text-purple-500" />;
            default: return <ClipboardCheck className="h-5 w-5 text-primary" />;
        }
    };

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
            }

            if (event.type === 'review') {
                voteData.ratings = ratings;
                voteData.comments = comments;
            }

            await submitVote(event.id, voteData);
            toast.success('Cảm ơn bạn đã tham gia!');
            // Refresh local state to show success screen
            setUserVote(voteData as any);
        } catch (error) {
            console.error('Failed to submit vote:', error);
            toast.error('Không thể gửi bình chọn. Vui lòng thử lại.');
        } finally {
            setIsProcessing(false);
        }
    };

    const renderContent = () => {
        if (userVote) {
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
                        <motion.div
                            animate={{
                                scale: [1, 1.2, 1],
                                opacity: [0, 1, 0]
                            }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute inset-0 rounded-full border-4 border-green-500/30"
                        />
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
                    <RadioGroup value={selectedCandidates[0]} onValueChange={handleSingleVoteChange}>
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
                                        className="flex items-center gap-4 rounded-xl border-2 p-4 cursor-pointer hover:bg-accent/50 transition-all [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5 [&:has([data-state=checked])]:shadow-sm"
                                    >
                                        <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                                            <AvatarImage src={candidate.avatarUrl} alt={candidate.name} />
                                            <AvatarFallback>{candidate.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1">
                                            <span className="font-bold text-base">{candidate.name}</span>
                                            {candidate.meta?.role && <p className="text-xs text-muted-foreground font-medium">{candidate.meta.role}</p>}
                                        </div>
                                        <RadioGroupItem value={candidate.id} id={`candidate-${candidate.id}`} className="h-5 w-5" />
                                    </Label>
                                </motion.div>
                            ))}
                        </div>
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
                                        className="flex items-center gap-4 rounded-xl border-2 p-4 cursor-pointer hover:bg-accent/50 transition-all [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5 [&:has([data-state=checked])]:shadow-sm"
                                    >
                                        <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                                            <AvatarImage src={candidate.avatarUrl} alt={candidate.name} />
                                            <AvatarFallback>{candidate.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
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
                                                ? 'border-primary/30 bg-primary/5'
                                                : 'hover:border-primary/20'
                                            }`}
                                    >
                                        <CardContent className="p-5 space-y-4">
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                                <div className="flex items-center gap-3 flex-1">
                                                    <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                                                        <AvatarImage src={candidate.avatarUrl} alt={candidate.name} />
                                                        <AvatarFallback>{candidate.name.charAt(0)}</AvatarFallback>
                                                    </Avatar>
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
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center justify-center py-10 text-center space-y-6"
                    >
                        <div className="h-24 w-24 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                            <Sparkles className="h-12 w-12 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="space-y-3 max-w-[300px]">
                            <h3 className="text-xl font-bold">Rút thăm may mắn</h3>
                            <p className="text-muted-foreground text-sm">
                                Nhấn nút bên dưới để ghi danh tham gia chương trình rút thăm trúng thưởng của sự kiện này.
                            </p>
                        </div>
                        <div className="w-full p-4 bg-muted/30 rounded-2xl border border-dashed border-muted-foreground/30">
                            <p className="text-xs text-muted-foreground italic">
                                * Mỗi nhân viên chỉ được tham gia 1 lần duy nhất.
                            </p>
                        </div>
                    </motion.div>
                );
            default:
                return (
                    <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                        <Info className="h-12 w-12 text-muted-foreground/50" />
                        <p className="text-muted-foreground">Loại sự kiện này chưa được hỗ trợ.</p>
                    </div>
                );
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose} dialogTag="vote-modal" parentDialogTag={parentDialogTag}>
            <DialogContent className="max-w-md p-0 overflow-hidden flex flex-col min-h-0 max-h-[90vh] sm:rounded-2xl">
                <DialogHeader className="p-6 pb-4 border-b bg-muted/5 flex-shrink-0">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2 rounded-lg bg-background shadow-sm border">
                            {getEventIcon()}
                        </div>
                        <DialogTitle className="text-xl font-bold leading-tight">{event.title}</DialogTitle>
                    </div>
                    <DialogDescription className="text-sm line-clamp-2">
                        {event.description}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 px-6 min-h-0 overflow-auto">
                    <div className="py-6">
                        {isProcessing && userVote === undefined ? (
                            <div className="flex flex-col items-center justify-center h-60 space-y-4">
                                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground animate-pulse">Đang tải dữ liệu...</p>
                            </div>
                        ) : renderContent()}
                    </div>
                </ScrollArea>

                <DialogFooter className="p-6 pt-4 border-t bg-muted/5 flex sm:justify-between items-center gap-4 flex-shrink-0">
                    <Button variant="ghost" onClick={onClose} className="rounded-full" aria-label="Đóng">
                        Đóng
                    </Button>
                    {!userVote && (
                        <Button
                            onClick={handleSubmit}
                            disabled={!canSubmit || isProcessing}
                            className="rounded-full px-8 shadow-lg shadow-primary/20 transition-all active:scale-95"
                        >
                            {isProcessing ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="mr-2 h-4 w-4" />
                            )}
                            {event.type === 'ballot' ? 'Tham gia ngay' : 'Gửi kết quả'}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
