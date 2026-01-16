
'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Users, Star, MessageSquare, Trophy, BarChart3, List, RefreshCw, Trash2, User, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getEventVotes, getEventDraws, deleteVote, runPrizeDraw } from '@/lib/events-store';
import { useAuth } from '@/hooks/use-auth';
import type { Event, EventVote, EventCandidate, ManagedUser, PrizeDrawResult, EventResult } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/pro-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn, formatTime } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { formatWithOptions } from 'util';

type EventResultsDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    event: Event;
    allUsers: ManagedUser[];
    parentDialogTag: string;
};

export default function EventResultsDialog({ isOpen, onClose, event, allUsers, parentDialogTag }: EventResultsDialogProps) {
    const [votes, setVotes] = useState<EventVote[]>([]);
    const [draws, setDraws] = useState<PrizeDrawResult[]>([]);
    const [winnerCount, setWinnerCount] = useState<number>(1);
    const [isLoading, setIsLoading] = useState(true);
    const { user } = useAuth();
    const [selectedVoters, setSelectedVoters] = useState<string[]>([]);

    const toggleSelectVoter = (id: string) => {
        setSelectedVoters(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const deleteSelectedVoters = async () => {
        if (selectedVoters.length === 0) return;
        if (!confirm(`Xác nhận xóa ${selectedVoters.length} báo cáo đã chọn? Hành động này sẽ xóa toàn bộ bài gửi của người dùng.`)) return;
        try {
            for (const voterId of selectedVoters) {
                await deleteVote(event.id, voterId);
            }
            await fetchResults();
            setSelectedVoters([]);
            toast.success('Đã xóa các báo cáo đã chọn.');
        } catch (e) {
            console.error('Failed to delete selected voters:', e);
            toast.error('Không thể xóa các báo cáo.');
        }
    };

    const fetchResults = useCallback(async () => {
        setIsLoading(true);
        try {
            const fetchedVotes = await getEventVotes(event.id);
            setVotes(fetchedVotes);
            if (event.type === 'ballot') {
                const fetchedDraws = await getEventDraws(event.id);
                setDraws(fetchedDraws);
            }
        } finally {
            setIsLoading(false);
        }
    }, [event.id, event.type]);

    useEffect(() => {
        if (isOpen) fetchResults();
    }, [isOpen, fetchResults]);

    const allCandidates = useMemo(() => [...(event.candidates || []), ...(event.options || [])], [event]);

    const results = useMemo<EventResult[]>(() => {
        if (event.type === 'vote' || event.type === 'multi-vote') {
            const voteCounts: { [key: string]: number } = {};
            const votersByCandidate: { [key: string]: { name: string; userId: string }[] } = {};

            allCandidates.forEach(c => {
                voteCounts[c.id] = 0;
                votersByCandidate[c.id] = [];
            });

            votes.forEach(vote => {
                (vote.votes || []).forEach(candidateId => {
                    if (voteCounts.hasOwnProperty(candidateId)) {
                        voteCounts[candidateId]++;
                        if (!event.anonymousResults) {
                            votersByCandidate[candidateId].push({ name: vote.userDisplay.name, userId: vote.userId || vote.id });
                        }
                    }
                });
            });

            return Object.entries(voteCounts)
                .map(([id, count]) => ({
                    id,
                    name: allCandidates.find(c => c.id === id)?.name || 'Không rõ',
                    votes: count,
                    voters: (votersByCandidate[id] || []).map(v => v.name),
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
            })).sort((a, b) => b.avgRating - a.avgRating) as EventResult[];
        }

        return [] as EventResult[];
    }, [votes, event, allCandidates]);

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
                    <p className="text-sm text-muted-foreground animate-pulse">Đang tải kết quả...</p>
                </div>
            );
        }

        if (votes.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-6">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                        <Users className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="font-bold text-lg">Chưa có dữ liệu</h3>
                        <p className="text-sm text-muted-foreground">Sự kiện này hiện chưa có lượt tham gia nào.</p>
                    </div>
                </div>
            );
        }

        return (
            <Tabs defaultValue="overview" className="w-full">
                <div className="px-6 mb-4">
                    <TabsList className="grid w-full grid-cols-2 h-11 p-1 bg-muted/50 rounded-xl">
                        <TabsTrigger value="overview" className="rounded-lg data-[state=active]:shadow-sm">
                            <BarChart3 className="h-4 w-4 mr-2" />
                            Tổng quan
                        </TabsTrigger>
                        <TabsTrigger value="details" className="rounded-lg data-[state=active]:shadow-sm">
                            <List className="h-4 w-4 mr-2" />
                            Chi tiết
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="overview" className="px-6 pb-6 space-y-6 outline-none">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-4">
                        <Card className="bg-primary/5 border-none shadow-none">
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <Users className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Tổng lượt tham gia</p>
                                    <p className="text-2xl font-black">{votes.length}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-amber-50 border-none shadow-none">
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                                    <CheckCircle2 className="h-5 w-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Trạng thái</p>
                                    <p className="text-lg font-bold capitalize">{event.status === 'active' ? 'Đang diễn ra' : event.status === 'closed' ? 'Đã kết thúc' : 'Bản nháp'}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {(event.type === 'vote' || event.type === 'multi-vote') && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold flex items-center gap-2">
                                    <BarChart3 className="h-4 w-4 text-primary" />
                                    Biểu đồ kết quả
                                </h4>
                            </div>
                            <div className="h-[300px] w-full bg-muted/20 rounded-2xl p-4 border border-muted/30">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={results} layout="vertical" margin={{ left: 20, right: 30, top: 10, bottom: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.05)" />
                                        <XAxis type="number" hide />
                                        <YAxis
                                            type="category"
                                            dataKey="name"
                                            width={100}
                                            tick={{ fontSize: 11, fontWeight: 600 }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <Tooltip
                                            cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    return (
                                                        <div className="bg-white p-3 shadow-xl border rounded-xl text-xs">
                                                            <p className="font-bold mb-1">{payload[0].payload.name}</p>
                                                            <p className="text-primary font-medium">{payload[0].value} phiếu ({((payload[0].value as number / votes.length) * 100).toFixed(1)}%)</p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Bar dataKey="votes" radius={[0, 4, 4, 0]} barSize={24}>
                                            {results.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--primary)' : 'var(--primary-foreground)'} fillOpacity={index === 0 ? 1 : 0.4} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {event.type === 'review' && (
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold flex items-center gap-2">
                                <Star className="h-4 w-4 text-amber-500" />
                                Điểm trung bình
                            </h4>
                            <div className="grid gap-3">
                                {results.map((res, idx) => (
                                    <div key={res.id} className="flex items-center gap-4 p-3 bg-muted/30 rounded-xl border border-transparent hover:border-muted transition-all">
                                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
                                            {idx + 1}
                                        </div>
                                        <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                                            <AvatarImage src={allCandidates.find(c => c.id === res.id)?.avatarUrl} />
                                            <AvatarFallback>{res.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold truncate">{res.name}</p>
                                            <div className="flex items-center gap-1">
                                                <div className="flex gap-0.5">
                                                    {[1, 2, 3, 4, 5].map((s) => (
                                                        <Star key={s} className={cn("h-3 w-3", s <= Math.round(res.avgRating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
                                                    ))}
                                                </div>
                                                <span className="text-[10px] text-muted-foreground ml-1">({res.ratingCount} đánh giá)</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-black text-primary">{res.avgRating.toFixed(1)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {event.type === 'ballot' && (
                        <div className="space-y-6">
                            <div className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-3xl border border-primary/10 relative overflow-hidden">
                                <Trophy className="absolute -right-4 -bottom-4 h-32 w-32 text-primary/5 rotate-12" />
                                <div className="relative z-10 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <h4 className="text-lg font-black flex items-center gap-2">
                                                <Trophy className="h-5 w-5 text-primary" />
                                                Rút thăm may mắn
                                            </h4>
                                            <p className="text-xs text-muted-foreground">Chọn số lượng người thắng và thực hiện rút thăm ngẫu nhiên.</p>
                                        </div>
                                    </div>

                                    {user && (user.uid === event.ownerId || user.role === 'Chủ nhà hàng') && (
                                        <div className="flex items-center gap-3 bg-white/50 p-3 rounded-2xl border border-white shadow-sm">
                                            <div className="space-y-1 flex-1">
                                                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Số người thắng</Label>
                                                <input
                                                    className="w-full bg-transparent border-none focus:ring-0 text-xl font-black p-0"
                                                    type="number"
                                                    min={1}
                                                    max={Math.max(1, votes.length)}
                                                    value={winnerCount}
                                                    onChange={(e) => setWinnerCount(Math.max(1, Number(e.target.value) || 1))}
                                                />
                                            </div>
                                            <Button
                                                size="lg"
                                                onClick={async () => {
                                                    if (votes.length === 0) { toast.error('Chưa có người tham gia để rút thăm.'); return; }
                                                    try {
                                                        await runPrizeDraw(event.id, winnerCount, user);
                                                        await fetchResults();
                                                        toast.success(`Đã rút ${winnerCount} người thắng.`);
                                                    } catch (e) {
                                                        console.error('Failed to run prize draw:', e);
                                                        toast.error('Rút thăm thất bại.');
                                                    }
                                                }}
                                                className="rounded-xl px-8 font-bold shadow-lg shadow-primary/20"
                                            >
                                                Bắt đầu rút
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-sm font-bold flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    Lịch sử rút thăm
                                </h4>
                                {draws.length > 0 ? (
                                    <div className="grid gap-3">
                                        {draws.map((draw, idx) => (
                                            <Card key={draw.id} className="border-none bg-muted/20 shadow-none overflow-hidden">
                                                <div className="bg-muted/30 px-4 py-2 border-b flex items-center justify-between">
                                                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Lượt #{draws.length - idx}</span>
                                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {format(draw.drawnAt.toDate(), 'HH:mm, dd/MM/yyyy')}
                                                    </span>
                                                </div>
                                                <CardContent className="p-4">
                                                    <div className="flex flex-wrap gap-2">
                                                        {draw.winners.map(winner => (
                                                            <Badge key={winner.userId} variant="secondary" className="bg-white border-primary/20 text-primary font-bold py-1 px-3 rounded-lg">
                                                                <Trophy className="h-3 w-3 mr-1.5 text-amber-500" />
                                                                {winner.userName}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center border-2 border-dashed rounded-3xl border-muted">
                                        <p className="text-sm text-muted-foreground italic">Chưa có kết quả rút thăm nào.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="details" className="px-6 pb-6 space-y-6 outline-none">
                    <div className="space-y-6">
                        {/* Bulk selection toolbar for details */}
                        {user && (user.uid === event.ownerId || user.role === 'Chủ nhà hàng') && (
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" className="h-4 w-4" checked={selectedVoters.length > 0 && selectedVoters.length === votes.length} onChange={(e) => {
                                        if (e.currentTarget.checked) setSelectedVoters((votes || []).map(v => v.userId || v.id));
                                        else setSelectedVoters([]);
                                    }} />
                                    <span className="text-xs text-muted-foreground">Chọn tất cả</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {selectedVoters.length > 0 ? (
                                        <div className="text-sm text-muted-foreground">Đã chọn {selectedVoters.length} báo cáo</div>
                                    ) : (
                                        <div className="text-sm text-muted-foreground">Chưa chọn báo cáo</div>
                                    )}
                                    <Button size="sm" variant="destructive" disabled={selectedVoters.length === 0} onClick={deleteSelectedVoters}>Xóa báo cáo đã chọn</Button>
                                </div>
                            </div>
                        )}

                        {event.type === 'ballot' ? (
                            <div className="grid gap-3">
                                {(votes || []).map(v => (
                                    <div key={v.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            {user && (user.uid === event.ownerId || user.role === 'Chủ nhà hàng') && (
                                                <input type="checkbox" className="h-4 w-4" checked={selectedVoters.includes(v.userId || v.id)} onChange={() => toggleSelectVoter(v.userId || v.id)} />
                                            )}
                                            <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                                                <AvatarFallback>{(v.userDisplay?.name || v.userId || '').charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <h5 className="font-bold text-sm">{v.userDisplay?.name || v.userId}</h5>
                                                <p className="text-[10px] text-muted-foreground">Tham gia: {formatTime(v.createdAt, 'dd/MM/yyyy HH:mm')}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {user && (user.uid === event.ownerId || user.role === 'Chủ nhà hàng') && (
                                                <button
                                                    onClick={async () => {
                                                        if (!confirm(`Xóa báo cáo của ${v.userDisplay?.name || v.userId}?`)) return;
                                                        try {
                                                            await deleteVote(event.id, v.userId || v.id);
                                                            await fetchResults();
                                                            setSelectedVoters(prev => prev.filter(i => i !== (v.userId || v.id)));
                                                            toast.success('Đã xóa.');
                                                        } catch (e) {
                                                            toast.error('Lỗi khi xóa.');
                                                        }
                                                    }}
                                                    className="p-1.5 text-muted-foreground hover:text-destructive transition-opacity"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {(votes || []).length === 0 && <p className="text-xs text-muted-foreground italic">Chưa có người tham gia.</p>}
                            </div>
                        ) : (
                            results.map(res => (
                                <div key={res.id} className="space-y-3">
                                    <div className="flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                                                <AvatarImage src={allCandidates.find(c => c.id === res.id)?.avatarUrl} />
                                                <AvatarFallback>{res.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <h5 className="font-bold text-sm">{res.name}</h5>
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                                                    {event.type === 'review' ? `${res.ratingCount} đánh giá` : `${res.voters.length} phiếu bầu`}
                                                </p>
                                            </div>
                                        </div>
                                        {user && (user.uid === event.ownerId || user.role === 'Chủ nhà hàng') && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-destructive hover:bg-destructive/10 font-bold text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={async () => {
                                                    const voters = (votes || []).filter(v => (v.votes || []).includes(res.id) || (v.ratings && v.ratings[res.id] !== undefined) || (v.comments && v.comments[res.id]));
                                                    if (voters.length === 0) return;
                                                    if (!confirm(`Xóa tất cả ${voters.length} dữ liệu liên quan đến "${res.name}"? Lưu ý: đây sẽ xóa toàn bộ bài gửi của từng người (nếu một người đã bình chọn nhiều mục, cả các mục đó sẽ bị xóa).`)) return;
                                                    try {
                                                        for (const v of voters) {
                                                            await deleteVote(event.id, v.userId || v.id);
                                                        }
                                                        await fetchResults();
                                                        toast.success('Đã xóa dữ liệu.');
                                                    } catch (e) {
                                                        console.error('Failed to delete bulk:', e);
                                                        toast.error('Lỗi khi xóa.');
                                                    }
                                                }}
                                            >
                                                Xóa tất cả (bằng báo cáo người gửi)
                                            </Button>
                                        )}
                                    </div>

                                    <div className="grid gap-2 pl-4 border-l-2 border-muted ml-5">
                                        {(() => {
                                            const entries = (votes || []).filter(v => {
                                                if (event.type === 'review') return (v.ratings && v.ratings[res.id] !== undefined) || (v.comments && v.comments[res.id]);
                                                return (v.votes || []).includes(res.id) || (event.type === 'ballot' && res.id === v.userId);
                                            });

                                            if (entries.length === 0) return <p className="text-xs text-muted-foreground italic">Chưa có dữ liệu.</p>;

                                            return entries.map(v => (
                                                <div key={v.id} className="flex items-start justify-between p-3 bg-muted/20 rounded-xl group/item">
                                                    <div className="space-y-1 flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            {user && (user.uid === event.ownerId || user.role === 'Chủ nhà hàng') && (
                                                                <input type="checkbox" className="h-4 w-4" checked={selectedVoters.includes(v.userId || v.id)} onChange={() => toggleSelectVoter(v.userId || v.id)} />
                                                            )}
                                                            <span className="text-xs font-bold">
                                                                {event.anonymousResults ? 'Người dùng ẩn danh' : (v.userDisplay?.name || v.userId)}
                                                            </span>
                                                            {v.ratings && v.ratings[res.id] !== undefined && (
                                                                <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-none text-[10px] h-5 px-1.5">
                                                                    ⭐ {v.ratings[res.id]}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        {v.comments && v.comments[res.id] && (
                                                            <p className="text-xs text-muted-foreground italic leading-relaxed">"{v.comments[res.id]}"</p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {user && (user.uid === event.ownerId || user.role === 'Chủ nhà hàng') && (
                                                            <button
                                                                onClick={async () => {
                                                                    if (!confirm(`Xóa báo cáo của ${event.anonymousResults ? 'Ẩn danh' : (v.userDisplay?.name || v.userId)}? (Sẽ xóa toàn bộ bài gửi của người này)`)) return;
                                                                    try {
                                                                        await deleteVote(event.id, v.userId || v.id);
                                                                        await fetchResults();
                                                                        setSelectedVoters(prev => prev.filter(i => i !== (v.userId || v.id)));
                                                                        toast.success('Đã xóa.');
                                                                    } catch (e) {
                                                                        toast.error('Lỗi khi xóa.');
                                                                    }
                                                                }}
                                                                className="p-1.5 text-muted-foreground hover:text-destructive transition-opacity"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }} dialogTag="event-results-dialog" parentDialogTag={parentDialogTag}>
            <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl flex flex-col max-h-[90vh]">
                <div className="bg-primary/5 px-6 py-5 border-b flex items-center justify-between">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-primary" />
                            Kết quả: {event.title}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Xem thống kê chi tiết và quản lý các lượt tham gia.
                        </DialogDescription>
                    </DialogHeader>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={fetchResults}
                        disabled={isLoading}
                        className="rounded-full h-9 w-9 bg-white shadow-sm border-muted hover:bg-primary/5 hover:text-primary transition-all"
                    >
                        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                    </Button>
                </div>

                <ScrollArea className="flex-1 overflow-auto">
                    <div className="py-4">
                        {renderContent()}
                    </div>
                </ScrollArea>

                <div className="p-4 border-t bg-muted/10 flex justify-end">
                    <Button variant="outline" onClick={onClose} className="font-bold px-8 rounded-xl">Đóng</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

