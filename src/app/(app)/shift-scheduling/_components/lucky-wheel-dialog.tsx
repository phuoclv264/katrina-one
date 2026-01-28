'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogBody,
    DialogAction,
    DialogCancel,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogIcon,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trophy, RefreshCw, X, User, Search, Plus, UserPlus, Users, Sparkles, Trash2, ChevronRight, Wand2 } from 'lucide-react';
import type { ManagedUser } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { UserCombobox } from '@/components/user-combobox';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface LuckyWheelDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    users: ManagedUser[];
    onWinner: (user: ManagedUser) => void;
    parentDialogTag: string;
}

export function LuckyWheelDialog({
    open,
    onOpenChange,
    users,
    onWinner,
    parentDialogTag,
}: LuckyWheelDialogProps) {
    const { users: allUsers } = useAuth();
    const [candidates, setCandidates] = useState<ManagedUser[]>([]);
    const [isWheelOpen, setIsWheelOpen] = useState(false);

    useEffect(() => {
        if (open) {
            const initialCandidates = [...users].filter(u => !u.isTestAccount);
            setCandidates(initialCandidates);
        }
    }, [open, users]);

    const removeCandidate = (uid: string) => {
        setCandidates(prev => prev.filter(c => c.uid !== uid));
    };

    const addCandidate = (user: ManagedUser) => {
        if (!candidates.some(c => c.uid === user.uid)) {
            setCandidates(prev => [...prev, user]);
        }
    };

    const handleConfirmWinner = (winner: ManagedUser) => {
        onWinner(winner);
        setIsWheelOpen(false);
        onOpenChange(false);
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange} dialogTag="lucky-wheel-dialog" parentDialogTag={parentDialogTag}>
                <DialogContent className="max-w-md sm:max-w-xl sm:rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
                    <DialogHeader variant="premium" iconkey="trophy">
                        <DialogTitle className="text-xl font-black tracking-tight">Cấu hình Vòng Quay</DialogTitle>
                        <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                            Thiết lập danh sách nhân viên tham gia quay số
                        </DialogDescription>
                    </DialogHeader>

                    <DialogBody className="p-0 overflow-hidden flex flex-col sm:h-[500px]">
                        {/* Search & Add Section */}
                        <div className="p-6 pb-4 border-b border-primary/5 bg-slate-50/50">
                            <UserCombobox 
                                users={allUsers || []}
                                selectedUids={candidates.map(c => c.uid)}
                                onSelect={addCandidate}
                            />
                        </div>

                        {/* List of current candidates */}
                        <div className="flex-1 flex flex-col min-h-0">
                            <div className="px-6 py-4 flex items-center justify-between">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
                                    Ứng viên tham gia ({candidates.length})
                                </h4>
                                {candidates.length > 0 && (
                                    <Badge variant="outline" className="rounded-full border-primary/10 text-primary text-[10px] h-6 px-3 bg-primary/5">
                                        Đã chọn {candidates.length}
                                    </Badge>
                                )}
                            </div>
                            
                            <ScrollArea className="flex-1 px-6">
                                <div className="space-y-1.5 pb-6">
                                    {candidates.map(user => (
                                        <div
                                            key={user.uid}
                                            className="group flex items-center justify-between p-2.5 px-4 rounded-xl bg-white border border-slate-100/60 hover:border-primary/20 hover:shadow-sm transition-all"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-9 h-9 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                                                    <User className="w-4.5 h-4.5 text-primary/40" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-black text-slate-900 leading-tight">{user.displayName}</p>
                                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-tight">{user.role}</p>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => removeCandidate(user.uid)}
                                                className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}

                                    {candidates.length === 0 && (
                                        <div className="py-20 text-center">
                                            <div className="w-16 h-16 rounded-[2rem] bg-slate-50 flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                                <Users className="w-8 h-8 text-slate-200" />
                                            </div>
                                            <p className="text-xs font-bold text-slate-400 max-w-[200px] mx-auto leading-relaxed">
                                                Chưa có ứng viên nào. Hãy thêm từ danh sách staff.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    </DialogBody>

                    <DialogFooter className="p-6 border-t border-primary/5 bg-slate-50/30">
                        <DialogCancel className="rounded-2xl h-14">Hủy</DialogCancel>
                        <DialogAction
                            disabled={candidates.length === 0}
                            onClick={() => setIsWheelOpen(true)}
                            className="flex-1 h-14 rounded-2xl shadow-xl shadow-primary/20"
                        >
                            <Wand2 className="w-5 h-5 mr-2" />
                            Tiến hành quay ({candidates.length})
                        </DialogAction>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            {/* The actual Wheel Popup */}
            <SpinningWheelPopup 
                open={isWheelOpen}
                onOpenChange={setIsWheelOpen}
                participants={candidates}
                onConfirm={handleConfirmWinner}
                parentDialogTag="lucky-wheel-dialog"
            />
        </>
    );
}

interface SpinningWheelPopupProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    participants: ManagedUser[];
    onConfirm: (winner: ManagedUser) => void;
    parentDialogTag: string;
}

function SpinningWheelPopup({
    open,
    onOpenChange,
    participants,
    onConfirm,
    parentDialogTag,
}: SpinningWheelPopupProps) {
    const [isSpinning, setIsSpinning] = useState(false);
    const [winner, setWinner] = useState<ManagedUser | null>(null);
    const [showResult, setShowResult] = useState(false);
    const controls = useAnimation();

    useEffect(() => {
        if (open) {
            setWinner(null);
            setShowResult(false);
            controls.set({ rotate: 0 });
        }
    }, [open, controls]);

    const spin = async () => {
        if (isSpinning || participants.length === 0) return;
        setIsSpinning(true);
        setWinner(null);

        const winnerIndex = Math.floor(Math.random() * participants.length);
        const segmentAngle = 360 / participants.length;

        const extraSpins = 6 + Math.floor(Math.random() * 4);
        const finalRotation = (extraSpins * 360) - (winnerIndex * segmentAngle) - (segmentAngle / 2);

        await controls.start({
            rotate: finalRotation,
            transition: { duration: 5, ease: [0.45, 0.05, 0, 1] }
        });

        setIsSpinning(false);
        const result = participants[winnerIndex];
        setWinner(result);
        
        // Short delay before showing result alert
        setTimeout(() => {
            setShowResult(true);
        }, 500);
    };

    const handleConfirmResult = () => {
        if (winner) {
            onConfirm(winner);
            setShowResult(false);
            onOpenChange(false);
        }
    };

    const handleReSpin = () => {
        setShowResult(false);
        setWinner(null);
        controls.set({ rotate: 0 });
    };

    return (
        <>
            <Dialog 
                open={open} 
                onOpenChange={onOpenChange} 
                dialogTag="wheel-animation-dialog" 
                parentDialogTag={parentDialogTag}
            >
                <DialogContent 
                    hideClose 
                    className="max-w-fit bg-transparent shadow-none border-none p-0 overflow-visible"
                    onInteractOutside={() => onOpenChange(false)}
                    onPointerDownOutside={() => onOpenChange(false)}
                >
                    <DialogTitle className="sr-only">Vòng quay may mắn</DialogTitle>
                    <div className="flex flex-col items-center justify-center p-4 relative">
                        {/* Indicator Arrow */}
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20 filter drop-shadow-xl">
                            <motion.div 
                                animate={isSpinning ? { y: [0, 4, 0] } : {}}
                                transition={{ repeat: Infinity, duration: 0.5 }}
                                className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-t-[35px] border-t-primary" 
                            />
                        </div>

                        <div className="relative group cursor-pointer" onClick={spin}>
                            {/* Inner glow pulse when ready */}
                            {!isSpinning && !winner && (
                                <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl animate-pulse -z-10" />
                            )}
                            
                            <motion.div
                                animate={controls}
                                className="relative w-80 h-80 rounded-full border-[14px] border-white shadow-3xl overflow-hidden bg-white ring-8 ring-primary/5"
                                style={{ originX: 0.5, originY: 0.5 }}
                            >
                                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                                    {participants.map((u, i) => {
                                        const angle = 360 / participants.length;
                                        const startAngle = i * angle;
                                        const endAngle = (i + 1) * angle;

                                        const x1 = 50 + 50 * Math.cos((startAngle * Math.PI) / 180);
                                        const y1 = 50 + 50 * Math.sin((startAngle * Math.PI) / 180);
                                        const x2 = 50 + 50 * Math.cos((endAngle * Math.PI) / 180);
                                        const y2 = 50 + 50 * Math.sin((endAngle * Math.PI) / 180);

                                        const colors = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
                                        const color = colors[i % colors.length];

                                        return (
                                            <g key={u.uid}>
                                                <path
                                                    d={`M 50 50 L ${x1} ${y1} A 50 50 0 ${angle > 180 ? 1 : 0} 1 ${x2} ${y2} Z`}
                                                    fill={color}
                                                    fillOpacity={0.9}
                                                    stroke="white"
                                                    strokeWidth="1"
                                                />
                                                <text
                                                    x="72"
                                                    y="50"
                                                    transform={`rotate(${startAngle + angle / 2}, 50, 50)`}
                                                    textAnchor="middle"
                                                    className="text-[3.5px] font-black uppercase"
                                                    style={{ fill: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
                                                >
                                                    {u.displayName.split(' ').pop()}
                                                </text>
                                            </g>
                                        );
                                    })}
                                    {participants.length === 1 && <circle cx="50" cy="50" r="50" fill="#3b82f6" />}
                                </svg>
                            </motion.div>

                            {/* Center Pin / Click Target */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-white rounded-full shadow-2xl flex flex-col items-center justify-center z-10 border-4 border-slate-50 transition-transform active:scale-90 group-hover:scale-110">
                                <div className="w-4 h-4 bg-primary rounded-full shadow-inner animate-pulse transition-all group-hover:w-5 group-hover:h-5" />
                                {!isSpinning && !winner && (
                                    <span className="text-[6px] font-black uppercase tracking-tight text-primary mt-1">Quay</span>
                                )}
                            </div>
                        </div>

                        {!isSpinning && !winner && (
                            <p className="mt-8 text-[10px] font-black uppercase tracking-[0.4em] text-white/80 drop-shadow-md">
                                Chạm vào giữa để quay
                            </p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Result Alert */}
            <AlertDialog open={showResult} onOpenChange={setShowResult} parentDialogTag="root">
                <AlertDialogContent maxWidth="sm">
                    <AlertDialogHeader>
                        <AlertDialogIcon icon={Trophy} variant="primary"/>
                        <AlertDialogTitle>Kết quả quay số</AlertDialogTitle>
                        <AlertDialogDescription>
                            Chúc mừng nhân viên <span className="font-black text-foreground underline decoration-primary decoration-2">{winner?.displayName}</span> đã trúng tuyển ngẫu nhiên!
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={handleReSpin}>
                            Quay lại
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmResult}>
                            Xác nhận chọn
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
