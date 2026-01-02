
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
import { Loader2, CheckCircle, Info, Star, Send } from 'lucide-react';
import { toast } from '@/components/ui/pro-toast';
import { getUserVote, submitVote } from '@/lib/events-store';
import type { Event, EventCandidate, AuthUser, EventVote } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';

const StarRating = ({ rating, onRatingChange }: { rating: number, onRatingChange: (rating: number) => void }) => {
    return (
        <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} onClick={() => onRatingChange(star)}>
                    <Star
                        className={`h-6 w-6 transition-colors ${
                            star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
                        }`}
                    />
                </button>
            ))}
        </div>
    );
};

type VoteModalProps = {
  isOpen: boolean;
  onClose: () => void;
  event: Event;
  currentUser: AuthUser;
};

export default function VoteModal({ isOpen, onClose, event, currentUser }: VoteModalProps) {
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [userVote, setUserVote] = useState<EventVote | null | undefined>(undefined); // undefined means still loading
  const [isProcessing, setIsProcessing] = useState(false);
  const [ratings, setRatings] = useState<{[candidateId: string]: number}>({});
  const [comments, setComments] = useState<{[candidateId: string]: string}>({});

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
        } else {
            setSelectedCandidates([]);
            setRatings({});
            setComments({});
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
        // If already selected, no change
        if (prev.includes(candidateId)) return prev;
        // If under limit, append
        if (prev.length < maxVotes) {
          return [...prev, candidateId];
        }
        // At limit: replace the oldest selection with the new one
        const newSelection = [...prev.slice(1), candidateId];
        return newSelection;
      } else {
        // Unchecking: remove the candidate
        return prev.filter(id => id !== candidateId);
      }
    });
  };

  const handleSubmit = async () => {
    if (event.type !== 'ballot' && selectedCandidates.length === 0 && Object.keys(ratings).length === 0 && Object.keys(comments).length === 0) {
      toast.error('Vui lòng tham gia bình chọn.');
      return;
    }
    
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
        onClose();
    } catch (error) {
      console.error('Failed to submit vote:', error);
      toast.error('Không thể gửi bình chọn. Vui lòng thử lại.');
    } finally {
      setIsProcessing(false);
    }
  };

  const allCandidates = useMemo(() => [...(event.candidates || []), ...(event.options || [])], [event]);

  const renderContent = () => {
    if (userVote) {
      return (
        <Alert variant="default" className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Bạn đã tham gia</AlertTitle>
          <AlertDescription>
            Cảm ơn bạn đã tham gia sự kiện này.
          </AlertDescription>
        </Alert>
      );
    }

    switch(event.type) {
        case 'vote':
            return (
                <RadioGroup value={selectedCandidates[0]} onValueChange={handleSingleVoteChange}>
                    <div className="space-y-3">
                        {allCandidates.map(candidate => (
                        <Label key={candidate.id} htmlFor={`candidate-${candidate.id}`} className="flex items-center gap-4 rounded-lg border p-4 cursor-pointer hover:bg-accent/50 transition-colors [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5">
                            <Avatar><AvatarImage src={candidate.avatarUrl} alt={candidate.name} /><AvatarFallback>{candidate.name.charAt(0)}</AvatarFallback></Avatar>
                            <div className="flex-1"><span className="font-semibold">{candidate.name}</span>{candidate.meta?.role && <p className="text-xs text-muted-foreground">{candidate.meta.role}</p>}</div>
                            <RadioGroupItem value={candidate.id} id={`candidate-${candidate.id}`} />
                        </Label>
                        ))}
                    </div>
                </RadioGroup>
            );
        case 'multi-vote':
            const maxVotes = event.maxVotesPerUser || 1;
            return (
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Chọn tối đa {maxVotes} lựa chọn.</p>
                    {allCandidates.map(candidate => (
                        <Label key={candidate.id} htmlFor={`candidate-${candidate.id}`} className="flex items-center gap-4 rounded-lg border p-4 cursor-pointer hover:bg-accent/50 transition-colors [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5">
                            <Avatar><AvatarImage src={candidate.avatarUrl} alt={candidate.name} /><AvatarFallback>{candidate.name.charAt(0)}</AvatarFallback></Avatar>
                            <div className="flex-1"><span className="font-semibold">{candidate.name}</span>{candidate.meta?.role && <p className="text-xs text-muted-foreground">{candidate.meta.role}</p>}</div>
                            <Checkbox id={`candidate-${candidate.id}`} checked={selectedCandidates.includes(candidate.id)} onCheckedChange={(checked) => handleMultiVoteChange(candidate.id, !!checked)} />
                        </Label>
                    ))}
                </div>
            );
        case 'review':
             return (
                <div className="space-y-4">
                    {allCandidates.map(candidate => (
                        <Card key={candidate.id}>
                            <CardContent className="p-4 space-y-3">
                                <div className="flex items-center gap-4">
                                     <Avatar><AvatarImage src={candidate.avatarUrl} alt={candidate.name} /><AvatarFallback>{candidate.name.charAt(0)}</AvatarFallback></Avatar>
                                    <div className="flex-1">
                                        <p className="font-semibold">{candidate.name}</p>
                                        {candidate.meta?.role && <p className="text-xs text-muted-foreground">{candidate.meta.role}</p>}
                                    </div>
                                    <StarRating rating={ratings[candidate.id] || 0} onRatingChange={(rating) => setRatings(prev => ({...prev, [candidate.id]: rating}))} />
                                </div>
                                {event.allowComments && (
                                     <Textarea
                                        placeholder="Để lại bình luận (không bắt buộc)..."
                                        value={comments[candidate.id] || ''}
                                        onChange={(e) => setComments(prev => ({...prev, [candidate.id]: e.target.value}))}
                                        rows={2}
                                    />
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            );
        case 'ballot':
             return (
                <div className="text-center py-8">
                     <p className="mb-4">Nhấn nút bên dưới để tham gia rút thăm trúng thưởng.</p>
                </div>
            );
        default:
            return <p className="text-muted-foreground">Loại sự kiện này chưa được hỗ trợ.</p>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{event.title}</DialogTitle>
          <DialogDescription>{event.description}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] -mx-6 px-6">
            <div className="py-4">
                {isProcessing && userVote === undefined ? (
                    <div className="flex items-center justify-center h-40">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : renderContent()}
            </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
          {!userVote && (
            <Button onClick={handleSubmit} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Gửi
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
