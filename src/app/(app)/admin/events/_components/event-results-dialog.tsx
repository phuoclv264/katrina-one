
'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogFooter, 
    DialogDescription,
    DialogBody,
    DialogAction,
    DialogCancel
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Users, Star, MessageSquareText, Trophy, BarChart3, List, RefreshCw, Trash2, CheckCircle2, AlertCircle, Clock, Search, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getEventVotes, getEventDraws, deleteVote, runPrizeDraw } from '@/lib/events-store';
import { useAuth } from '@/hooks/use-auth';
import type { Event, EventVote, EventCandidate, ManagedUser, PrizeDrawResult, EventResult } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { UserAvatar } from '@/components/user-avatar';
import { format } from 'date-fns';
import { toast } from '@/components/ui/pro-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn, formatTime } from '@/lib/utils';
import { getEffectiveStatus, getStatusConfig } from '@/lib/events-utils';
import { Label } from '@/components/ui/label';

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
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<string>('overview');

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
        if (event.type === 'vote' || event.type === 'multi-vote' || event.type === 'ballot') {
            const voteCounts: { [key: string]: number } = {};
            const votersByCandidate: { [key: string]: { name: string; userId: string }[] } = {};
            const commentsByCandidate: { [key: string]: { text: string; author: string; userId: string; date: Date }[] } = {};

            allCandidates.forEach(c => {
                voteCounts[c.id] = 0;
                votersByCandidate[c.id] = [];
                commentsByCandidate[c.id] = [];
            });

            votes.forEach(vote => {
                const userId = vote.userId || vote.id;
                (vote.votes || []).forEach(candidateId => {
                    if (voteCounts.hasOwnProperty(candidateId)) {
                        voteCounts[candidateId]++;
                        if (!event.anonymousResults) {
                            votersByCandidate[candidateId].push({ name: vote.userDisplay.name, userId });
                        }
                    }
                });

                if (vote.comments) {
                    Object.entries(vote.comments).forEach(([candidateId, text]) => {
                        if (text && text.trim() && commentsByCandidate[candidateId]) {
                            commentsByCandidate[candidateId].push({
                                text,
                                author: event.anonymousResults ? 'Ẩn danh' : vote.userDisplay.name,
                                userId,
                                date: vote.createdAt.toDate()
                            });
                        }
                    });
                }
            });

            return Object.entries(voteCounts)
                .map(([id, count]) => {
                    const candidateVoters = (votersByCandidate[id] || []);
                    return {
                        id,
                        name: allCandidates.find(c => c.id === id)?.name || 'Không rõ',
                        votes: count,
                        voters: candidateVoters.map(v => v.name),
                        // Extended data for local UI
                        voterDetails: candidateVoters.map(v => ({
                            id: v.userId,
                            name: v.name,
                            avatar: allUsers.find(u => u.uid === v.userId)?.photoURL
                        })),
                        avgRating: 0,
                        ratingCount: 0,
                        comments: commentsByCandidate[id] || []
                    };
                })
                .sort((a, b) => b.votes - a.votes) as (EventResult & { voterDetails?: { id: string; name: string; avatar?: string }[] })[];
        }

        if (event.type === 'review') {
            const reviewData: { [key: string]: { ratings: { value: number; userId: string; name: string }[], comments: { text: string, author: string, userId?: string }[] } } = {};
            allCandidates.forEach(c => {
                reviewData[c.id] = { ratings: [], comments: [] };
            });

            votes.forEach(vote => {
                const userId = vote.userId || vote.id;
                if (vote.ratings) {
                    Object.entries(vote.ratings).forEach(([candidateId, rating]) => {
                        if (reviewData[candidateId]) {
                            reviewData[candidateId].ratings.push({ 
                                value: rating, 
                                userId, 
                                name: vote.userDisplay.name 
                            });
                        }
                    });
                }
                if (vote.comments) {
                    Object.entries(vote.comments).forEach(([candidateId, comment]) => {
                        if (reviewData[candidateId] && comment && candidateId !== 'general') {
                            reviewData[candidateId].comments.push({ 
                                text: comment, 
                                author: event.anonymousResults ? 'Ẩn danh' : vote.userDisplay.name,
                                userId: event.anonymousResults ? undefined : userId
                            });
                        }
                    });
                }
            });

            return Object.entries(reviewData).map(([id, data]) => ({
                id,
                name: allCandidates.find(c => c.id === id)?.name || 'Không rõ',
                avgRating: data.ratings.length > 0 ? data.ratings.reduce((a, b) => a + b.value, 0) / data.ratings.length : 0,
                ratingCount: data.ratings.length,
                comments: data.comments,
                votes: 0,
                voters: data.ratings.map(r => r.name),
                // Extended data
                voterDetails: data.ratings.map(r => ({
                    id: r.userId,
                    name: r.name,
                    avatar: allUsers.find(u => u.uid === r.userId)?.photoURL,
                    rating: r.value
                }))
            })).sort((a, b) => b.avgRating - a.avgRating) as (EventResult & { voterDetails?: { id: string; name: string; avatar?: string; rating?: number }[] })[];
        }

        return [] as EventResult[];
    }, [votes, event, allCandidates]);

    // Chart sizing: make height content-driven (rows × rowHeight) with sensible min/max caps.
    const chartRowHeight = 36; // px per row (includes bar + gap)
    const minChartHeight = 80;
    const maxChartHeight = 260;
    const chartHeight = useMemo(() => {
        const rows = Math.max(1, results.length);
        return Math.min(maxChartHeight, Math.max(minChartHeight, rows * chartRowHeight + 8));
    }, [results.length]);

    const allComments = useMemo(() => {
        const list: { text: string; author: string; candidateName?: string; date: Date; userId: string; avatar?: string }[] = [];
        votes.forEach(vote => {
            if (vote.comments) {
                Object.entries(vote.comments).forEach(([key, text]) => {
                    if (!text || text.trim() === '') return;
                    const candidate = allCandidates.find(c => c.id === key);
                    
                    // Filter by search query if applicable
                    if (searchQuery && !text.toLowerCase().includes(searchQuery.toLowerCase()) && !vote.userDisplay.name.toLowerCase().includes(searchQuery.toLowerCase())) {
                        return;
                    }
    
                    list.push({
                        text,
                        author: event.anonymousResults ? 'Ẩn danh' : vote.userDisplay.name,
                        candidateName: key === 'general' ? 'Nhận xét chung' : (candidate?.name || 'Về: ' + key),
                        date: vote.createdAt.toDate(),
                        userId: vote.userId || vote.id,
                        avatar: allUsers.find(u => u.uid === vote.userId)?.photoURL || undefined
                    });
                });
            }
        });
        return list.sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [votes, event.anonymousResults, allCandidates, allUsers, searchQuery]);
    
    // Precompute a safe, type-narrowed display string for the top result so we don't access
    // a property that may not exist on every EventResult variant (fixes TS2551).
    const leadingStat = useMemo(() => {
        if (results.length === 0) return '';
        const top = results[0];
        if (event.type === 'review') {
            return `${top.avgRating.toFixed(1)} sao`;
        }
        // use 'in' narrowing to safely check for the votes property on non-review results
        if ('votes' in top) {
            return `${top.votes} phiếu`;
        }
        return '0 phiếu';
    }, [results, event.type]);

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="relative">
                        <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
                        <Loader2 className="h-12 w-12 animate-spin text-primary absolute inset-0 [animation-delay:-0.3s]" />
                    </div>
                    <p className="text-sm font-bold text-muted-foreground animate-pulse uppercase tracking-[0.2em]">Đang xử lý dữ liệu...</p>
                </div>
            );
        }

        if (votes.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-20 gap-6 text-center px-6">
                    <div className="h-24 w-24 rounded-full bg-primary/5 flex items-center justify-center relative">
                        <Users className="h-10 w-10 text-primary/20 absolute" />
                        <div className="absolute inset-0 rounded-full border-2 border-dashed border-primary/10 animate-[spin_10s_linear_infinite]" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="font-extrabold text-xl">Chưa có lượt tham gia</h3>
                        <p className="text-sm text-muted-foreground max-w-[200px] mx-auto">Sự kiện này hiện tại chưa nhận được phản hồi nào từ nhân viên.</p>
                    </div>
                </div>
            );
        }

        return (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="px-6 mb-4 sticky top-0 z-20 pt-2 pb-4 bg-background/80 backdrop-blur-md">
                    <TabsList className="grid w-full grid-cols-3 h-12 p-1 bg-muted/30 rounded-2xl border border-primary/5">
                        <TabsTrigger value="overview" className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-soft font-black text-[10px] uppercase tracking-wider">
                            <BarChart3 className="h-3.5 w-3.5 mr-2" />
                            Tổng quan
                        </TabsTrigger>
                        <TabsTrigger value="details" className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-soft font-black text-[10px] uppercase tracking-wider">
                            <List className="h-3.5 w-3.5 mr-2" />
                            Danh sách
                        </TabsTrigger>
                        <TabsTrigger value="comments" className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-soft font-black text-[10px] uppercase tracking-wider whitespace-nowrap">
                            <MessageSquareText className="h-3.5 w-3.5 mr-2" />
                            Bình luận
                            {allComments.length > 0 && (
                                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[9px]">{allComments.length}</span>
                            )}
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="overview" className="px-6 pb-6 space-y-6 outline-none animate-in fade-in duration-300">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-5 bg-gradient-to-br from-primary/10 to-transparent rounded-[2.5rem] border border-primary/5 relative overflow-hidden group">
                           <Users className="absolute -right-2 -bottom-2 h-16 w-16 text-primary/5 rotate-12 group-hover:scale-110 transition-transform" />
                            <p className="text-[10px] font-black text-primary/60 uppercase tracking-[0.15em] mb-1">Tham gia</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black">{votes.length}</span>
                                <span className="text-xs font-bold text-muted-foreground/60 leading-none">người</span>
                            </div>
                            {/* Mini avatar stack */}
                            <div className="flex -space-x-2 mt-4 overflow-hidden">
                                {votes.slice(0, 5).map((v, i) => (
                                    <UserAvatar
                                        key={i}
                                        avatarUrl={allUsers.find(u => u.uid === v.userId)?.photoURL}
                                        nameOverride={v.userDisplay.name}
                                        size="h-6 w-6"
                                        className="border-2 border-white shadow-sm shrink-0"
                                        fallbackClassName="text-[8px]"
                                    />
                                ))}
                                {votes.length > 5 && (
                                    <div className="h-6 w-6 rounded-full bg-muted border-2 border-white flex items-center justify-center text-[8px] font-black z-10 shrink-0">
                                        +{votes.length - 5}
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="p-5 bg-gradient-to-br from-amber-500/10 to-transparent rounded-[2.5rem] border border-amber-500/5 relative overflow-hidden group">
                            {results.length > 0 ? (
                                <>
                                    <Trophy className="absolute -right-2 -bottom-2 h-16 w-16 text-amber-500/5 rotate-12 group-hover:scale-110 transition-transform" />
                                    <p className="text-[10px] font-black text-amber-600/60 uppercase tracking-[0.15em] mb-1">Dẫn đầu</p>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-black">{results[0].name}</span>
                                        <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
                                    </div>
                                    <p className="text-[10px] font-bold text-muted-foreground/60 italic">
                                        {leadingStat}
                                    </p>
                                </>
                            ) : (
                                <div className="h-full flex flex-col justify-center">
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] mb-1">Dẫn đầu</p>
                                    <p className="text-sm font-bold text-muted-foreground/30 italic">Chưa xác định</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {(event.type === 'vote' || event.type === 'multi-vote' || event.type === 'ballot') && (
                        <div className="bg-primary/[0.03] dark:bg-white/[0.02] rounded-[2rem] border border-primary/5 relative group/chart overflow-hidden">
                            <div className="px-5 pt-4 pb-0 flex items-center justify-between relative z-10">
                                <h4 className="text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-primary/60">
                                    <div className="h-1.5 w-1.5 rounded-full bg-primary/40" />
                                    Biểu đồ kết quả
                                </h4>
                                <span className="text-[8px] font-black text-muted-foreground/30 uppercase tracking-widest leading-none">Real-time</span>
                            </div>
                            <div className="p-2 sm:p-4 pt-0">
                                <div className="w-full relative" style={{ height: chartHeight }}>
                                    <ResponsiveContainer width="100%" height={chartHeight}>
                                        <BarChart data={results} layout="vertical" margin={{ left: -10, right: 35, top: 8, bottom: 0 }}>
                                            <XAxis type="number" hide />
                                            <YAxis
                                                type="category"
                                                dataKey="name"
                                                width={80}
                                                tick={{ fontSize: 9, fontWeight: 800, fill: 'currentColor', opacity: 0.5 }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <Tooltip
                                                cursor={{ fill: 'rgba(var(--primary-rgb), 0.04)', radius: 10 }}
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        const data = payload[0].payload;
                                                        return (
                                                            <div className="bg-white/95 dark:bg-black/95 backdrop-blur-xl px-2.5 py-1.5 shadow-2xl border border-primary/10 rounded-xl animate-in zoom-in-95 duration-200">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs font-black text-primary leading-none">{data.votes}</span>
                                                                    <span className="text-[9px] font-bold text-muted-foreground/50">({((data.votes / Math.max(1, votes.length)) * 100).toFixed(0)}%)</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Bar
                                                dataKey="votes"
                                                radius={[0, 10, 10, 0]}
                                                barSize={Math.min(24, Math.max(12, Math.floor(chartHeight / Math.max(1, results.length)) - 6))}
                                            >
                                                {results.map((entry, index) => (
                                                    <Cell 
                                                        key={`cell-${index}`} 
                                                        fill={index === 0 ? 'var(--primary)' : 'rgba(var(--primary-rgb), 0.15)'} 
                                                        className="transition-all duration-500 ease-out"
                                                    />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Detailed Selection Breakdown */}
                    {(event.type === 'vote' || event.type === 'multi-vote' || event.type === 'ballot') && (
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 px-2 text-muted-foreground/40">
                                <Users className="h-3 w-3 text-primary/60" />
                                Chi tiết lượt bình chọn
                            </h4>
                            <div className="grid gap-3">
                                {results.map((res: any, idx) => (
                                    <div key={res.id} className="p-3.5 sm:p-4 bg-background rounded-[1.5rem] border border-primary/5 shadow-sm hover:shadow-md transition-all">
                                        {/* safely narrow EventResult union before accessing vote-specific props */}
                                        {(() => {
                                            const voteCount = 'votes' in res ? res.votes : 0;
                                            const firstResult = results[0];
                                            const leaderVotes = firstResult && 'votes' in firstResult ? firstResult.votes || 0 : Math.max(1, voteCount);
                                            return (
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn(
                                                            "w-8 h-8 rounded-full flex items-center justify-center font-black text-[10px] shrink-0",
                                                            idx === 0 ? "bg-amber-400 text-white" : "bg-muted text-muted-foreground/40"
                                                        )}>
                                                            #{idx + 1}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-black text-sm truncate">{res.name}</p>
                                                            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                                                                {voteCount} phiếu ({((voteCount / Math.max(1, votes.length)) * 100).toFixed(1)}%)
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="h-1.5 w-full sm:w-32 bg-muted rounded-full overflow-hidden shrink-0">
                                                        <div 
                                                            className={cn("h-full rounded-full transition-all duration-1000", idx === 0 ? "bg-primary" : "bg-primary/20")}
                                                            style={{ width: `${(voteCount / Math.max(1, leaderVotes)) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {!event.anonymousResults && res.voterDetails && res.voterDetails.length > 0 && (
                                            <div className="mt-4 space-y-2">
                                                <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.15em] ml-1">Danh sách bình chọn</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                                    {res.voterDetails.map((voter: any) => (
                                                        <div key={voter.id} className="flex items-center gap-2 p-2 rounded-xl bg-muted/20 hover:bg-primary/5 transition-colors border border-transparent hover:border-primary/10 group">
                                                            <UserAvatar
                                                                avatarUrl={voter.avatar}
                                                                nameOverride={voter.name}
                                                                size="h-7 w-7"
                                                                className="border border-white shadow-sm shrink-0"
                                                                fallbackClassName="text-[9px] font-bold"
                                                            />
                                                            <span className="text-[11px] font-bold truncate flex-1">{voter.name}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Latest Comment for Vote/Ballot */}
                                        {res.comments && res.comments.length > 0 && (
                                            <div className="mt-4 pt-4 border-t border-black/[0.03]">
                                                <div className="bg-sky-50/50 dark:bg-sky-900/10 p-3 sm:p-4 rounded-2xl sm:rounded-3xl relative">
                                                    <div className="absolute -top-3 left-4 bg-sky-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                        Ý kiến mới
                                                    </div>
                                                    <p className="text-xs sm:text-sm font-medium italic text-sky-800/80 dark:text-sky-300/80 line-clamp-2 leading-relaxed">
                                                        "{res.comments[res.comments.length - 1].text}"
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <div className="h-0.5 w-3 rounded-full bg-sky-200" />
                                                        <span className="text-[9px] font-black text-sky-600/60 uppercase">— {res.comments[res.comments.length - 1].author}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {event.type === 'review' && (
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 px-2 text-muted-foreground/40">
                                <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                Xếp hạng chi tiết
                            </h4>
                            <div className="grid gap-3">
                                {results.map((res: any, idx) => (
                                    <div key={res.id} className="group relative">
                                        <div className="flex flex-col gap-3 p-3.5 sm:p-4 bg-background rounded-[1.5rem] border border-primary/5 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                                            {/* Rank badge */}
                                            <div className={cn(
                                                "absolute -left-1 -top-1 w-8 h-8 rounded-br-2xl flex items-center justify-center font-black text-[10px]",
                                                idx === 0 ? "bg-amber-400 text-white" : "bg-muted text-muted-foreground/40"
                                            )}>
                                                #{idx + 1}
                                            </div>

                                            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                                <div className="flex items-center gap-4 flex-1">
                                                    <div className="relative shrink-0">
                                                        <UserAvatar
                                                            avatarUrl={allCandidates.find(c => c.id === res.id)?.avatarUrl}
                                                            nameOverride={res.name}
                                                            size="h-12 w-12 sm:h-14 sm:w-14"
                                                            className="border-2 border-white shadow-soft"
                                                            fallbackClassName="font-bold text-lg"
                                                        />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm sm:text-md font-black truncate">{res.name}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <div className="flex gap-0.5">
                                                                {[1, 2, 3, 4, 5].map((s) => (
                                                                    <Star key={s} className={cn("h-3 w-3", s <= Math.round(res.avgRating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20")} />
                                                                ))}
                                                            </div>
                                                            <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                                                            <span className="text-[9px] sm:text-[10px] font-black text-muted-foreground/60 tracking-wider">
                                                                {res.ratingCount} LƯỢT ĐÁNH GIÁ
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right flex items-end sm:flex-col justify-between sm:justify-start">
                                                    <div className="sm:text-right">
                                                        <p className="text-2xl sm:text-3xl font-black text-primary leading-none tracking-tighter">{res.avgRating.toFixed(1)}</p>
                                                        <p className="text-[8px] font-black text-muted-foreground/40 uppercase mt-1 tracking-widest leading-none">stars</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Voters breakdown for this selection in Review */}
                                            {!event.anonymousResults && res.voterDetails && res.voterDetails.length > 0 && (
                                                <div className="mt-2 space-y-2">
                                                    <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.15em] ml-1">Danh sách đánh giá</p>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar">
                                                        {res.voterDetails.map((voter: any) => (
                                                            <div key={voter.id} className="flex items-center justify-between p-2 rounded-xl bg-muted/20 hover:bg-amber-500/5 transition-colors border border-transparent hover:border-amber-500/10">
                                                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                                                    <UserAvatar
                                                                        avatarUrl={voter.avatar}
                                                                        nameOverride={voter.name}
                                                                        size="h-6 w-6"
                                                                        className="border border-white shadow-sm shrink-0"
                                                                        fallbackClassName="text-[8px] font-bold"
                                                                    />
                                                                    <span className="text-[10px] font-bold truncate">{voter.name}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                                                    <span className="text-[11px] font-black text-amber-600 leading-none">{voter.rating}</span>
                                                                    <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Top Comment Preview for this candidate */}
                                            {res.comments && res.comments.length > 0 && (
                                                <div className="mt-1 pt-4 border-t border-black/[0.03]">
                                                    <div className="bg-amber-50/50 dark:bg-amber-900/10 p-3 sm:p-4 rounded-2xl sm:rounded-3xl relative">
                                                        <div className="absolute -top-3 left-4 bg-amber-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                            Phản hồi mới
                                                        </div>
                                                        <p className="text-xs sm:text-sm font-medium italic text-amber-800/80 dark:text-amber-300/80 line-clamp-2 leading-relaxed">
                                                            "{res.comments[res.comments.length - 1].text}"
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-2">
                                                            <div className="h-0.5 w-3 rounded-full bg-amber-200" />
                                                            <span className="text-[9px] font-black text-amber-600/60 uppercase">— {res.comments[res.comments.length - 1].author}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Latest General Feedback Section */}
                    {allComments.filter(c => c.candidateName === 'Nhận xét chung').length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-muted-foreground/60">
                                    <MessageSquareText className="h-3 w-3 text-primary" />
                                    Góp ý chung mới nhất
                                </h4>
                                <Button 
                                    variant="ghost" 
                                    className="h-7 text-[10px] font-black text-primary hover:bg-primary/5 uppercase tracking-wider"
                                    onClick={() => setActiveTab('comments')}
                                >
                                    Xem tất cả ({allComments.length})
                                </Button>
                            </div>
                            <div className="grid gap-3">
                                {allComments
                                    .filter(c => c.candidateName === 'Nhận xét chung')
                                    .slice(0, 2)
                                    .map((comment, i) => (
                                        <div key={i} className="p-5 bg-white shadow-soft rounded-[2rem] border border-black/[0.03] flex gap-4 items-start">
                                            <UserAvatar
                                                avatarUrl={comment.avatar}
                                                nameOverride={comment.author}
                                                size="h-10 w-10"
                                                className="shrink-0 border-2 border-white shadow-sm overflow-hidden"
                                                fallbackClassName="font-bold bg-muted"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-1">
                                                    <p className="text-sm font-black">{comment.author}</p>
                                                    <span className="text-[9px] font-bold text-muted-foreground/40">{format(comment.date, 'HH:mm • dd/MM')}</span>
                                                </div>
                                                <p className="text-sm font-medium leading-relaxed italic text-foreground/70 line-clamp-2">"{comment.text}"</p>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}

                    {event.type === 'ballot' && (
                        <div className="space-y-6 pt-4">
                            <div className="p-8 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent rounded-[3rem] border border-primary/10 relative overflow-hidden">
                                <Trophy className="absolute -right-8 -bottom-8 h-48 w-48 text-primary/5 -rotate-12" />
                                <div className="relative z-10 space-y-6">
                                    <div className="space-y-2">
                                        <h4 className="text-2xl font-black flex items-center gap-3">
                                            <Trophy className="h-8 w-8 text-amber-500 drop-shadow-sm" />
                                            Rút thăm may mắn
                                        </h4>
                                        <p className="text-sm text-balance text-muted-foreground font-medium">Hệ thống sẽ chọn ngẫu nhiên các nhân viên đã tham gia sự kiện này.</p>
                                    </div>

                                    {(user?.uid === event.ownerId || user?.role === 'Chủ nhà hàng') && (
                                        <div className="flex flex-col sm:flex-row items-center gap-4 bg-white/60 dark:bg-black/20 p-4 rounded-[2rem] border border-white/40 shadow-xl backdrop-blur-2xl">
                                            <div className="flex-1 w-full space-y-1.5 px-4 border-r-0 sm:border-r border-black/5">
                                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">Số người thắng</Label>
                                                <input
                                                    className="w-full bg-transparent border-none focus:ring-0 text-3xl font-black p-0 h-10"
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
                                                        await runPrizeDraw(event.id, winnerCount, user as any);
                                                        await fetchResults();
                                                        toast.success(`Đã rút ${winnerCount} người thắng.`);
                                                    } catch (e) {
                                                        console.error('Failed to run prize draw:', e);
                                                        toast.error('Rút thăm thất bại.');
                                                    }
                                                }}
                                                className="w-full sm:w-auto h-16 rounded-[1.5rem] px-10 font-black text-md shadow-2xl shadow-primary/30 bg-primary hover:scale-[1.02] active:scale-[0.98] transition-all"
                                            >
                                                BẮT ĐẦU RÚT THĂM
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 px-2">
                                    <Clock className="h-4 w-4 text-primary" />
                                    Lịch sử kết quả
                                </h4>
                                {draws.length > 0 ? (
                                    <div className="grid gap-4">
                                        {draws.map((draw, idx) => (
                                            <Card key={draw.id} className="border-none bg-background shadow-soft rounded-[2.5rem] overflow-hidden">
                                                <div className="bg-muted/30 px-6 py-3 border-b border-black/5 flex items-center justify-between">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Lượt #{draws.length - idx}</span>
                                                    <Badge variant="outline" className="text-[10px] font-bold bg-white/50 border-black/5">
                                                        {format(draw.drawnAt.toDate(), 'HH:mm • dd/MM')}
                                                    </Badge>
                                                </div>
                                                <CardContent className="p-6">
                                                    <div className="flex flex-wrap gap-3">
                                                        {draw.winners.map(winner => (
                                                            <div key={winner.userId} className="flex items-center gap-2 bg-primary/5 border border-primary/10 pl-1 pr-4 py-1 rounded-2xl">
                                                                <UserAvatar
                                                                    avatarUrl={allUsers.find(u => u.uid === winner.userId)?.photoURL}
                                                                    nameOverride={winner.userName}
                                                                    size="h-8 w-8"
                                                                    className="shadow-sm"
                                                                    fallbackClassName="text-[10px]"
                                                                />
                                                                <span className="text-sm font-black text-primary">{winner.userName}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-12 text-center border-2 border-dashed rounded-[3rem] border-primary/10">
                                        <p className="text-sm text-muted-foreground font-bold italic">Chưa thực hiện lượt rút nào.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="details" className="px-6 pb-6 outline-none animate-in slide-in-from-bottom-2 duration-300">
                    <div className="space-y-4">
                        <div className="flex flex-col gap-3">
                            <div className="relative group/search">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 group-focus-within/search:text-primary transition-colors" />
                                <input 
                                    placeholder="Tìm tên nhân viên..."
                                    className="w-full h-11 pl-11 pr-4 rounded-xl bg-muted/20 border border-primary/5 focus:border-primary/20 focus:ring-4 focus:ring-primary/5 text-sm font-bold transition-all placeholder:text-muted-foreground/30"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>

                            {(user?.uid === event.ownerId || user?.role === 'Chủ nhà hàng') && (
                                <div className="flex items-center justify-between px-1">
                                    <div 
                                        className="flex items-center gap-2.5 cursor-pointer select-none group/select"
                                        onClick={() => {
                                            if (selectedVoters.length === votes.length) setSelectedVoters([]);
                                            else setSelectedVoters(votes.map(v => v.userId || v.id));
                                        }}
                                    >
                                        <div className={cn(
                                            "h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all duration-300",
                                            selectedVoters.length > 0 ? "bg-primary border-primary shadow-sm" : "border-muted-foreground/20 group-hover/select:border-primary/40"
                                        )}>
                                            {selectedVoters.length === votes.length && <CheckCircle2 className="h-3 w-3 text-white" />}
                                            {selectedVoters.length > 0 && selectedVoters.length < votes.length && <div className="h-1.5 w-1.5 bg-white rounded-full" />}
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/60 transition-colors group-hover/select:text-primary">
                                            {selectedVoters.length === 0 ? "Chọn tất cả tham gia" : `Đã chọn ${selectedVoters.length} nhân viên`}
                                        </span>
                                    </div>
                                    
                                    {selectedVoters.length > 0 && (
                                        <Button 
                                            size="sm" 
                                            variant="destructive" 
                                            className="h-8 rounded-lg font-black text-[10px] px-4 flex gap-2 animate-in zoom-in-95 duration-300 shadow-lg shadow-destructive/10 uppercase tracking-widest" 
                                            onClick={deleteSelectedVoters}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                            Xóa bài gửi
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="grid gap-2.5">
                            {votes
                                .filter(v => !searchQuery || v.userDisplay.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                .map(v => (
                                    <div 
                                        key={v.id} 
                                        className={cn(
                                            "relative p-3.5 rounded-2xl border transition-all duration-300 group/item overflow-hidden",
                                            selectedVoters.includes(v.userId || v.id) 
                                                ? "bg-primary/[0.04] border-primary/20 shadow-md ring-1 ring-primary/10" 
                                                : "bg-white dark:bg-black/20 border-primary/5 hover:border-primary/10 hover:shadow-soft"
                                        )}
                                    >
                                        <div className="flex items-start gap-4 h-full">
                                            {(user?.uid === event.ownerId || user?.role === 'Chủ nhà hàng') && (
                                                <div 
                                                    className={cn(
                                                        "mt-1.5 h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 cursor-pointer transition-all duration-300",
                                                        selectedVoters.includes(v.userId || v.id) ? "bg-primary border-primary shadow-sm scale-110" : "border-muted-foreground/10 hover:border-primary/50"
                                                    )}
                                                    onClick={() => toggleSelectVoter(v.userId || v.id)}
                                                >
                                                    {selectedVoters.includes(v.userId || v.id) && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                                                </div>
                                            )}
                                            
                                            <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                {/* Left side: Avatar + User Info */}
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <UserAvatar
                                                        avatarUrl={allUsers.find(u => u.uid === v.userId)?.photoURL}
                                                        nameOverride={v.userDisplay?.name}
                                                        size="h-11 w-11"
                                                        className="border-2 border-white shadow-soft shrink-0"
                                                        fallbackClassName="font-bold bg-muted text-[10px]"
                                                    />
                                                    <div className="min-w-0">
                                                        <h5 className="font-black text-sm leading-tight">{event.anonymousResults ? "Nhân viên ẩn danh" : v.userDisplay?.name}</h5>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground/40">
                                                                <Clock className="h-2.5 w-2.5" />
                                                                {formatTime(v.createdAt, 'dd/MM HH:mm')}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right side: Results/Selection badges */}
                                                <div className="flex items-center justify-end gap-3 ml-auto sm:ml-0 min-w-0">
                                                    {(event.type === 'vote' || event.type === 'multi-vote' || event.type === 'ballot') && (
                                                        <div className="flex items-center gap-1.5 max-w-full">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                {(v.votes || []).map((choiceId) => {
                                                                    const choice = allCandidates.find(c => c.id === choiceId);
                                                                    return (
                                                                        <div
                                                                            key={choiceId}
                                                                            className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-muted/10 border border-primary/5 text-[12px] font-bold leading-snug break-words"
                                                                            title={choice?.name || '—'}
                                                                            aria-label={choice?.name || 'choice'}
                                                                        >
                                                                            <UserAvatar
                                                                                avatarUrl={choice?.avatarUrl}
                                                                                nameOverride={choice?.name || '·'}
                                                                                size="h-5 w-5"
                                                                                className="shrink-0"
                                                                                fallbackClassName="text-[9px] bg-muted font-black"
                                                                            />
                                                                            <span className="whitespace-normal break-words leading-tight">{choice?.name || 'Không rõ'}</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            {(v.votes || []).length > 0 && (
                                                                <span className="text-[9px] font-black text-primary/50 uppercase tracking-tighter ml-1">
                                                                    {(v.votes || []).length > 3 ? `+${(v.votes || []).length - 3}` : ""}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                    
                                                    {event.type === 'review' && v.ratings && (
                                                        <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-100 dark:border-amber-500/20">
                                                            <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                                                            <span className="text-[10px] font-black text-amber-600/80">{Object.keys(v.ratings).length}</span>
                                                        </div>
                                                    )}

                                                    {v.comments && ((Object.keys(v.comments).length > 0 && v.comments['general']) || Object.keys(v.comments).length > (v.comments['general'] ? 1 : 0)) && (
                                                        <div className="h-7 w-7 flex items-center justify-center rounded-full bg-sky-50 dark:bg-sky-500/10 text-sky-500 border border-sky-100 dark:border-sky-500/20 transition-transform group-hover/item:scale-110">
                                                            <MessageSquareText className="h-3 w-3" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="comments" className="px-6 pb-6 outline-none animate-in slide-in-from-right-2 duration-300">
                    <div className="space-y-6">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
                            <input 
                                placeholder="Tìm trong bình luận..."
                                className="w-full h-12 pl-12 pr-4 rounded-2xl bg-muted/30 border-none focus:ring-2 focus:ring-primary/20 text-sm font-bold transition-all"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {allComments.length > 0 ? (
                            <div className="grid gap-4">
                                {allComments.map((comment, idx) => (
                                    <div key={`${comment.userId}-${idx}`} className="flex flex-col gap-3 p-5 bg-background rounded-[2rem] border border-primary/5 shadow-soft hover:shadow-md transition-all group overflow-hidden relative">
                                        <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-125 transition-transform duration-500">
                                            <MessageSquareText className="h-16 w-16 text-primary" />
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <UserAvatar
                                                avatarUrl={comment.avatar}
                                                nameOverride={comment.author}
                                                size="h-8 w-8"
                                                className="border-2 border-white shadow-sm shrink-0"
                                                fallbackClassName="text-[10px] font-bold"
                                            />
                                            <div className="min-w-0">
                                                <p className="font-black text-sm truncate">{comment.author}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-muted-foreground/60">{format(comment.date, 'HH:mm • dd/MM')}</span>
                                                    {comment.candidateName && (
                                                        <Badge variant="outline" className={cn(
                                                            "text-[9px] font-black h-4 px-1 border-none",
                                                            comment.candidateName === 'Nhận xét chung' ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"
                                                        )}>
                                                            {comment.candidateName.toUpperCase()}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-4 bg-muted/20 rounded-2xl border border-black/5 relative min-h-[3rem]">
                                            <p className="text-sm font-medium leading-relaxed italic text-foreground/80">"{comment.text}"</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed rounded-[3rem] border-primary/5 text-center px-4">
                                <MessageSquareText className="h-12 w-12 text-primary/10 mb-4" />
                                <p className="text-sm text-muted-foreground font-bold italic">Không tìm thấy bình luận nào.</p>
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }} dialogTag="event-results-dialog" parentDialogTag={parentDialogTag}>
            <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl flex flex-col sm:rounded-[2rem] h-full sm:h-[90vh]">
                <DialogHeader iconkey="layout" variant="premium" className="max-sm:px-4 max-sm:py-3 shrink-0">
                    <div className="flex items-center justify-between w-full">
                        <div className="text-left space-y-1">
                            <DialogTitle className="max-sm:text-lg">
                                {event.title}
                            </DialogTitle>
                            <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-primary/60">
                                Kết quả sự kiện • {event.type}
                            </DialogDescription>
                        </div>
                        <button
                            onClick={fetchResults}
                            disabled={isLoading}
                            className="bg-white/20 hover:bg-white/40 backdrop-blur-md p-1 rounded-2xl transition-all active:scale-95 disabled:opacity-50 border border-white/20 shadow-xl"
                        >
                            <RefreshCw className={cn("h-5 w-5", isLoading && "animate-spin")} />
                        </button>
                    </div>
                </DialogHeader>

                <DialogBody className="p-0 flex-1 overflow-hidden">
                    <div className="h-full overflow-y-auto custom-scrollbar">
                        {renderContent()}
                    </div>
                </DialogBody>

                <DialogFooter className="p-4 sm:p-6 bg-muted/10 border-t border-black/5 gap-3 shrink-0">
                    <DialogCancel className="flex-1 sm:flex-none h-11 sm:h-12 px-10 rounded-xl sm:rounded-2xl bg-background border border-black/5 hover:bg-muted font-black text-sm uppercase tracking-widest">
                        Đóng
                    </DialogCancel>
                    {(selectedVoters.length > 0) && (
                         <Button 
                            variant="destructive" 
                            onClick={deleteSelectedVoters}
                            className="flex-1 sm:flex-none h-11 sm:h-12 rounded-xl sm:rounded-2xl px-8 font-black shadow-lg shadow-destructive/20 uppercase tracking-widest"
                        >
                            Xóa {selectedVoters.length}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

