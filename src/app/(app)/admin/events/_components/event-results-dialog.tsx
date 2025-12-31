
'use client';
import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Users, Star, MessageSquare, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getEventVotes, getEventDraws } from '@/lib/events-store';
import type { Event, EventVote, EventCandidate, ManagedUser, PrizeDrawResult, EventResult } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';

type EventResultsDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    event: Event;
    allUsers: ManagedUser[];
};

export default function EventResultsDialog({ isOpen, onClose, event, allUsers }: EventResultsDialogProps) {
    const [votes, setVotes] = useState<EventVote[]>([]);
    const [draws, setDraws] = useState<PrizeDrawResult[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            setIsLoading(true);
            const fetchResults = async () => {
                const fetchedVotes = await getEventVotes(event.id);
                setVotes(fetchedVotes);
                if (event.type === 'ballot') {
                    const fetchedDraws = await getEventDraws(event.id);
                    setDraws(fetchedDraws);
                }
                setIsLoading(false);
            };
            fetchResults();
        }
    }, [isOpen, event.id, event.type]);
    
    const allCandidates = useMemo(() => [...(event.candidates || []), ...(event.options || [])], [event]);

    const results = useMemo<EventResult[]>(() => {
        if (event.type === 'vote' || event.type === 'multi-vote') {
            const voteCounts: { [key: string]: number } = {};
            const votersByCandidate: { [key: string]: string[] } = {};
            
            allCandidates.forEach(c => {
                voteCounts[c.id] = 0;
                votersByCandidate[c.id] = [];
            });

            votes.forEach(vote => {
                (vote.votes || []).forEach(candidateId => {
                    if (voteCounts.hasOwnProperty(candidateId)) {
                        voteCounts[candidateId]++;
                        if (!event.anonymousResults) {
                           votersByCandidate[candidateId].push(vote.userDisplay.name);
                        }
                    }
                });
            });

            return Object.entries(voteCounts)
                .map(([id, count]) => ({
                    id,
                    name: allCandidates.find(c => c.id === id)?.name || 'Không rõ',
                    votes: count,
                    voters: votersByCandidate[id] || [],
                    // include review fields with safe defaults so the shape matches EventResult
                    avgRating: 0,
                    ratingCount: 0,
                    comments: []
                }))
                .sort((a, b) => b.votes - a.votes) as EventResult[];
        }
        
         if (event.type === 'review') {
            const reviewData: { [key: string]: { ratings: number[], comments: { text: string, author: string }[] } } = {};
            allCandidates.forEach(c => {
                reviewData[c.id] = { ratings: [], comments: [] };
            });

            votes.forEach(vote => {
                if (vote.ratings) {
                    Object.entries(vote.ratings).forEach(([candidateId, rating]) => {
                        if (reviewData[candidateId]) reviewData[candidateId].ratings.push(rating);
                    });
                }
                if (vote.comments) {
                     Object.entries(vote.comments).forEach(([candidateId, comment]) => {
                        if (reviewData[candidateId] && comment) {
                            reviewData[candidateId].comments.push({ text: comment, author: event.anonymousResults ? 'Ẩn danh' : vote.userDisplay.name });
                        }
                    });
                }
            });

            return Object.entries(reviewData).map(([id, data]) => ({
                id,
                name: allCandidates.find(c => c.id === id)?.name || 'Không rõ',
                avgRating: data.ratings.length > 0 ? data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length : 0,
                ratingCount: data.ratings.length,
                comments: data.comments,
                // include vote fields for consistency
                votes: 0,
                voters: []
            })).sort((a,b) => b.avgRating - a.avgRating) as EventResult[];
        }

        return [] as EventResult[];
    }, [votes, event, allCandidates]);

    const renderContent = () => {
        if (isLoading) {
            return <div className="flex items-center justify-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
        }

        if (event.type === 'vote' || event.type === 'multi-vote') {
            return (
                <div className="space-y-4">
                    <h4 className="font-semibold">Bảng xếp hạng ({votes.length} phiếu)</h4>
                     <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={results} layout="vertical" margin={{ left: 10, right: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" allowDecimals={false} />
                            <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                            <Tooltip formatter={(value: number) => [`${value} phiếu`, 'Số phiếu']} />
                            <Bar dataKey="votes" fill="var(--color-primary)" barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                    {!event.anonymousResults && (
                        <div>
                            <h4 className="font-semibold mb-2">Chi tiết</h4>
                            {results.map(res => (
                                <div key={res.id} className="text-sm mb-1">
                                    <span className="font-medium">{res.name}: </span>
                                    <span className="text-muted-foreground">{res.voters.join(', ') || 'Chưa có phiếu'}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            );
        }
        
         if (event.type === 'review') {
            return (
                <div className="space-y-4">
                    <h4 className="font-semibold">Kết quả đánh giá ({votes.length} lượt)</h4>
                    {results.map(res => (
                        <Card key={res.id}>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-8 w-8"><AvatarImage src={allCandidates.find(c => c.id === res.id)?.avatarUrl} /><AvatarFallback>{res.name.charAt(0)}</AvatarFallback></Avatar>
                                        <span>{res.name}</span>
                                    </div>
                                     <div className="flex items-center gap-1 text-lg font-bold text-amber-500">
                                        <Star className="h-5 w-5 fill-current" />
                                        <span>{res.avgRating.toFixed(1)}</span>
                                        <span className="text-sm font-normal text-muted-foreground">({res.ratingCount} lượt)</span>
                                    </div>
                                </CardTitle>
                            </CardHeader>
                            {res.comments.length > 0 && (
                                <CardContent>
                                    <h5 className="text-xs font-bold mb-2 text-muted-foreground flex items-center gap-1"><MessageSquare className="h-4 w-4"/>Bình luận</h5>
                                    <div className="space-y-2">
                                        {res.comments.map((c, i) => (
                                            <div key={i} className="p-2 bg-muted/50 rounded-md text-sm">
                                                <p className="italic">"{c.text}"</p>
                                                <p className="text-right text-xs text-muted-foreground mt-1">- {c.author}</p>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    ))}
                </div>
            )
        }

        if (event.type === 'ballot') {
            return (
                <div>
                     <h4 className="font-semibold mb-2 flex items-center gap-2"><Users className="h-5 w-5"/> Danh sách tham gia ({votes.length} người)</h4>
                     <div className="flex flex-wrap gap-2">
                         {votes.map(v => <Badge key={v.id} variant="secondary">{v.userDisplay.name}</Badge>)}
                     </div>
                     
                     <Separator className="my-4" />

                     <h4 className="font-semibold mb-2 flex items-center gap-2"><Trophy className="h-5 w-5"/> Kết quả rút thăm</h4>
                     {draws.length > 0 ? (
                        <div className="space-y-3">
                            {draws.map(draw => (
                                <Card key={draw.id}>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base">Lượt rút thăm ngày {format(draw.drawnAt.toDate(), 'dd/MM/yyyy HH:mm')}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ul className="list-disc list-inside">
                                            {draw.winners.map(winner => (
                                                <li key={winner.userId} className="font-semibold">{winner.userName}</li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                     ) : (
                        <p className="text-sm text-muted-foreground">Chưa có kết quả rút thăm.</p>
                     )}
                </div>
            )
        }

        return null;
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Kết quả: {event.title}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] -mx-6 px-6">
                    <div className="py-4">
                        {renderContent()}
                    </div>
                </ScrollArea>
                 <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Đóng</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

    